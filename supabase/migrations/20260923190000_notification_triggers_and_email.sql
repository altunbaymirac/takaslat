-- ============================================================================
-- Bildirim üretimi + e-posta tercihi
--
-- Şema başından beri `notifications` tablosunu taşıyor ve istemci onu okuyup
-- realtime dinliyor; ama tabloya satır YAZAN hiçbir kod yoktu. Bildirim çanı
-- bu yüzden hep boştu. Eski INSERT politikası da (auth.uid() = user_id)
-- kullanıcının yalnızca kendine bildirim yazmasına izin veriyordu, yani karşı
-- tarafa haber vermek şema düzeyinde zaten imkânsızdı.
--
-- Burada bildirimleri olayın kaynağında, trigger ile üretiyoruz. E-posta için
-- `notifications` INSERT'ine bağlanan Supabase Database Webhook
-- `notify-email` edge function'ını çağırır (bkz. supabase/functions/notify-email).
-- ============================================================================

BEGIN;

-- ─── 1. Kullanıcı tercihi ve e-posta izi ────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- profiles üzerindeki SELECT izni sütun bazlı verilmişti (security_hardening.sql);
-- yeni sütunu listeye eklemezsek istemci kendi tercihini okuyamaz.
-- Yalnızca oturum açmış kullanıcıya: kimin mail istediği anonime açılmamalı.
GRANT SELECT (email_notifications) ON public.profiles TO authenticated;
GRANT UPDATE (email_notifications) ON public.profiles TO authenticated;

-- Okunmamış bildirim sorguları ve mesaj tekilleştirmesi için.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC);

-- ─── 2. Bildirimi yalnızca sistem yazar ─────────────────────────────────────
-- Kullanıcının kendi kendine bildirim üretmesinin bir faydası yok; kaldırıyoruz.
-- Tüm yazma işi aşağıdaki SECURITY DEFINER trigger'larından geçer.

DROP POLICY IF EXISTS "Sistem bildirim ekleyebilir" ON public.notifications;
REVOKE INSERT ON public.notifications FROM authenticated, anon;

-- ─── 3. Ortak yardımcılar ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT,
  p_href    TEXT DEFAULT '/'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, href)
  VALUES (p_user_id, p_type, p_title, left(p_body, 500), p_href)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- Yalnızca trigger'lar (tablo sahibi) çağırabilir; istemciye kapalı.
REVOKE ALL ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- Türk Lirası biçimi: 1250000 -> ₺1.250.000
CREATE OR REPLACE FUNCTION public.format_try(p_amount NUMERIC)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $fn$
  SELECT '₺' || replace(trim(to_char(COALESCE(p_amount, 0), 'FM999,999,999,999')), ',', '.');
$fn$;

-- ─── 4. Teklif geldi ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_offer_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sender  TEXT;
  v_listing TEXT;
BEGIN
  SELECT name  INTO v_sender  FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT title INTO v_listing FROM public.listings WHERE id = NEW.listing_id;

  PERFORM public.notify_user(
    NEW.to_user_id,
    'offer',
    'Yeni takas teklifi',
    COALESCE(NULLIF(v_sender, ''), 'Bir kullanıcı') || ', "' ||
      COALESCE(v_listing, 'ilanın') || '" için teklif verdi' ||
      CASE WHEN NEW.offered_value IS NOT NULL
           THEN ' (' || public.format_try(NEW.offered_value) || ')'
           ELSE '' END || '.',
    '/offers'
  );

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_offer_created ON public.offers;
CREATE TRIGGER notify_offer_created
  AFTER INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_offer_created();

-- ─── 5. Teklif durumu değişti ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_offer_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_actor  UUID := auth.uid();
  v_target UUID;
  v_title  TEXT;
  v_body   TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  -- Durumu değiştiren kişiye kendi işlemini bildirmenin anlamı yok.
  -- Aktör bilinmiyorsa (sistem işi) teklifi veren tarafa haber veriyoruz.
  v_target := CASE
    WHEN v_actor = NEW.to_user_id   THEN NEW.from_user_id
    WHEN v_actor = NEW.from_user_id THEN NEW.to_user_id
    ELSE NEW.from_user_id
  END;

  CASE NEW.status
    WHEN 'Görüşülüyor' THEN
      v_title := 'Teklifin görüşmeye alındı';
      v_body  := 'Karşı taraf teklifini değerlendirmeye aldı, mesajlaşmaya başlayabilirsin.';
    WHEN 'Onaylandı' THEN
      v_title := 'Teklifin kabul edildi';
      v_body  := 'Takas onaylandı. Buluşma ayrıntılarını konuşmak için teklifi aç.';
    WHEN 'Reddedildi' THEN
      v_title := 'Teklifin reddedildi';
      v_body  := 'Karşı taraf bu teklifi kabul etmedi. Başka bir teklifle tekrar deneyebilirsin.';
    WHEN 'Tamamlandı' THEN
      v_title := 'Takas tamamlandı';
      v_body  := 'Takas kapandı. Karşı tarafı puanlamayı unutma.';
    ELSE
      RETURN NULL;
  END CASE;

  PERFORM public.notify_user(v_target, 'status', v_title, v_body, '/offers');
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_offer_status ON public.offers;
CREATE TRIGGER notify_offer_status
  AFTER UPDATE OF status ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_offer_status();

-- ─── 6. Yeni mesaj ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_offer  RECORD;
  v_target UUID;
  v_sender TEXT;
  v_href   TEXT;
BEGIN
  SELECT from_user_id, to_user_id INTO v_offer
  FROM public.offers WHERE id = NEW.offer_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_target := CASE WHEN NEW.from_user_id = v_offer.from_user_id
                   THEN v_offer.to_user_id ELSE v_offer.from_user_id END;

  v_href := '/conversations?offer=' || NEW.offer_id::text;

  -- Sohbet hızlı akarken her mesaj için ayrı bildirim (ve e-posta) üretmiyoruz:
  -- aynı teklif için okunmamış bir mesaj bildirimi duruyorsa yenisini atlıyoruz.
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_target
      AND type = 'message'
      AND read = FALSE
      AND href = v_href
  ) THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_sender FROM public.profiles WHERE id = NEW.from_user_id;

  PERFORM public.notify_user(
    v_target,
    'message',
    'Yeni mesaj',
    COALESCE(NULLIF(v_sender, ''), 'Bir kullanıcı') || ': ' || left(NEW.text, 140),
    v_href
  );

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_message ON public.messages;
CREATE TRIGGER notify_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_message();

-- ─── 7. Mezat teklifi ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_auction_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_auction  RECORD;
  v_previous UUID;
BEGIN
  SELECT owner_id, title INTO v_auction
  FROM public.auctions WHERE id = NEW.auction_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Geçilen önceki en yüksek teklif sahibi.
  SELECT user_id INTO v_previous
  FROM public.auction_bids
  WHERE auction_id = NEW.auction_id AND id <> NEW.id
  ORDER BY amount DESC, created_at DESC
  LIMIT 1;

  IF v_previous IS NOT NULL AND v_previous <> NEW.user_id THEN
    PERFORM public.notify_user(
      v_previous,
      'status',
      'Teklifin geçildi',
      '"' || v_auction.title || '" mezatında teklifin ' ||
        public.format_try(NEW.amount) || ' ile geçildi.',
      '/auctions'
    );
  END IF;

  IF v_auction.owner_id <> NEW.user_id THEN
    PERFORM public.notify_user(
      v_auction.owner_id,
      'offer',
      'Mezatına yeni teklif',
      '"' || v_auction.title || '" için ' || public.format_try(NEW.amount) ||
        ' teklif geldi.',
      '/auctions'
    );
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_auction_bid ON public.auction_bids;
CREATE TRIGGER notify_auction_bid
  AFTER INSERT ON public.auction_bids
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_auction_bid();

-- ─── 8. İlan moderasyonu ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_listing_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
    RETURN NULL;
  END IF;

  IF NEW.moderation_status = 'approved' THEN
    PERFORM public.notify_user(
      NEW.owner_id,
      'moderation',
      'İlanın yayında',
      '"' || NEW.title || '" incelemeden geçti ve yayına alındı.',
      '/listing/' || NEW.id::text
    );
  ELSIF NEW.moderation_status = 'rejected' THEN
    PERFORM public.notify_user(
      NEW.owner_id,
      'moderation',
      'İlanın yayınlanmadı',
      '"' || NEW.title || '" yayına alınmadı' ||
        CASE WHEN COALESCE(NEW.rejection_reason, '') <> ''
             THEN ': ' || NEW.rejection_reason
             ELSE '.' END,
      '/dashboard'
    );
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_listing_moderation ON public.listings;
CREATE TRIGGER notify_listing_moderation
  AFTER UPDATE OF moderation_status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_listing_moderation();

-- ─── 9. Mezat başvurusu sonuçlandı ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_notify_auction_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  IF NEW.status = 'approved' THEN
    PERFORM public.notify_user(
      NEW.owner_id,
      'status',
      'Mezat başvurun onaylandı',
      'Aracın açık artırmaya çıkıyor. Salonu takip etmek için mezat sayfasına git.',
      '/auctions'
    );
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.notify_user(
      NEW.owner_id,
      'status',
      'Mezat başvurun onaylanmadı',
      COALESCE(NULLIF(NEW.review_note, ''),
               'Başvurun bu sefer süzgeçten geçmedi. Dilersen ilanını güncelleyip tekrar başvurabilirsin.'),
      '/auctions'
    );
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS notify_auction_request ON public.auction_requests;
CREATE TRIGGER notify_auction_request
  AFTER UPDATE OF status ON public.auction_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_auction_request();

COMMIT;
