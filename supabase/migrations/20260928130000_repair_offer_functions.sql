-- ============================================================================
-- Prod onarımı: teklif verme ve mesajlaşma fonksiyonları
--
-- schema_check.sql prod'da iki fonksiyonun HİÇ olmadığını gösterdi:
--   create_offer        → kimse teklif veremiyor
--   send_offer_message  → kimse mesaj gönderemiyor
--
-- Takas sitesinin ana akışı bu ikisine dayanıyor. Kaynak dosyaları
-- (20260831153000, 20260904120000) prod'a hiç ya da yarım uygulanmış.
--
-- Bu dosya hangi parçanın çalışıp hangisinin çalışmadığından bağımsız
-- olarak doğru sonucu verecek şekilde yazıldı; tamamı idempotent:
--
--   1. create_offer'ın yazdığı from_accepted / to_accepted sütunları
--      20260831140000'de ekleniyordu; yoksa fonksiyon kurulur ama ilk
--      çağrıda patlar. IF NOT EXISTS ile garantiye alıyoruz.
--   2. Eski "mesaj zorunlu" kısıtı kalmışsa, boş mesajlı teklif INSERT'te
--      reddedilir. 20260904120000'deki gevşek sürümle değiştiriyoruz.
--   3. create_offer: 20260904120000'deki EN GÜNCEL sürüm (mesaj opsiyonel).
--   4. send_offer_message: 20260831153000'deki sürüm (tek tanım).
-- ============================================================================

BEGIN;

-- ─── 1. create_offer'ın yazdığı sütunlar ────────────────────────────────────

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS from_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS to_accepted   BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Mesaj opsiyonel ─────────────────────────────────────────────────────
-- Boş bırakılabilir; yazıldıysa en fazla 2000 karakter. NOT VALID: mevcut
-- satırları yeniden taramaz, yalnızca yeni kayıtlara uygulanır.

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_message_length;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_message_length
  CHECK (message IS NULL OR char_length(trim(message)) <= 2000) NOT VALID;

-- ─── 3. Teklif verme ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_offer(
  p_listing_id UUID,
  p_message TEXT DEFAULT NULL,
  p_offered_value INTEGER DEFAULT NULL,
  p_offered_listing_id UUID DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_target public.listings%ROWTYPE;
  v_offered public.listings%ROWTYPE;
  v_offer public.offers%ROWTYPE;
  v_message TEXT := NULLIF(trim(COALESCE(p_message, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Teklif gondermek icin giris yapmalisiniz';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('offer-rate:' || auth.uid()::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_listing_id::text, 0));

  SELECT * INTO v_target
  FROM public.listings
  WHERE id = p_listing_id
  FOR SHARE;

  IF NOT FOUND OR NOT v_target.is_active OR v_target.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'Ilan teklif almaya uygun degil';
  END IF;
  IF v_target.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Kendi ilaniniza teklif veremezsiniz';
  END IF;

  -- Mesaj opsiyonel; yalnizca uzunluk siniri kontrol edilir.
  IF v_message IS NOT NULL AND char_length(v_message) > 2000 THEN
    RAISE EXCEPTION 'Teklif mesaji en fazla 2000 karakter olabilir';
  END IF;

  IF p_offered_value IS NOT NULL AND p_offered_value NOT BETWEEN 0 AND 2000000000 THEN
    RAISE EXCEPTION 'Teklif degeri gecersiz';
  END IF;
  IF p_offered_listing_id IS NULL AND COALESCE(p_offered_value, 0) <= 0 THEN
    RAISE EXCEPTION 'Bir ilan veya gecerli teklif degeri gereklidir';
  END IF;
  IF (
    SELECT COUNT(*) FROM public.offers
    WHERE from_user_id = auth.uid() AND created_at >= NOW() - INTERVAL '1 hour'
  ) >= 20 THEN
    RAISE EXCEPTION 'Cok fazla teklif gonderdiniz, daha sonra tekrar deneyin';
  END IF;

  IF p_offered_listing_id IS NOT NULL THEN
    IF p_offered_listing_id = p_listing_id THEN
      RAISE EXCEPTION 'Ayni ilan takas teklifi olarak kullanilamaz';
    END IF;
    SELECT * INTO v_offered
    FROM public.listings
    WHERE id = p_offered_listing_id
      AND owner_id = auth.uid()
      AND is_active = TRUE
      AND moderation_status = 'approved';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Yalnizca kendi aktif ilaninizi teklif edebilirsiniz';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.offers
    WHERE listing_id = p_listing_id
      AND from_user_id = auth.uid()
      AND status IN ('Beklemede', 'Gorusuluyor', 'Görüşülüyor', 'Onaylandi', 'Onaylandı')
  ) THEN
    RAISE EXCEPTION 'Bu ilan icin zaten acik bir teklifiniz var';
  END IF;

  INSERT INTO public.offers (
    listing_id, from_user_id, to_user_id, message, status,
    offered_value, offered_listing_id, offered_listing_title,
    from_accepted, to_accepted, from_confirmed, to_confirmed
  ) VALUES (
    v_target.id, auth.uid(), v_target.owner_id, COALESCE(v_message, ''), 'Beklemede',
    p_offered_value, p_offered_listing_id,
    CASE WHEN p_offered_listing_id IS NULL THEN NULL ELSE v_offered.title END,
    FALSE, FALSE, FALSE, FALSE
  )
  RETURNING * INTO v_offer;

  RETURN v_offer;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_offer(UUID, TEXT, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer(UUID, TEXT, INTEGER, UUID) TO authenticated;

-- ─── 4. Mesaj gönderme ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_offer_message(p_offer_id UUID, p_text TEXT)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_message public.messages%ROWTYPE;
  v_text TEXT := trim(p_text);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Mesaj icin giris yapmalisiniz'; END IF;
  IF v_text IS NULL OR char_length(v_text) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Mesaj 1 ile 4000 karakter arasinda olmalidir';
  END IF;

  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR SHARE;
  IF NOT FOUND OR (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Gorusme bulunamadi veya erisim reddedildi';
  END IF;
  IF v_offer.status IN ('Reddedildi', 'Tamamlandı') THEN
    RAISE EXCEPTION 'Kapali gorusmeye mesaj gonderilemez';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('message-rate:' || auth.uid()::text, 0));
  IF (
    SELECT COUNT(*) FROM public.messages
    WHERE from_user_id = auth.uid() AND created_at >= NOW() - INTERVAL '1 minute'
  ) >= 30 THEN
    RAISE EXCEPTION 'Cok fazla mesaj gonderdiniz, kisa bir sure bekleyin';
  END IF;

  INSERT INTO public.messages (offer_id, from_user_id, text)
  VALUES (p_offer_id, auth.uid(), v_text)
  RETURNING * INTO v_message;
  RETURN v_message;
END;
$fn$;

REVOKE ALL ON FUNCTION public.send_offer_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_offer_message(UUID, TEXT) TO authenticated;

COMMIT;

-- PostgREST şema önbelleğini tazele ki yeni fonksiyonlar hemen görünsün.
NOTIFY pgrst, 'reload schema';
