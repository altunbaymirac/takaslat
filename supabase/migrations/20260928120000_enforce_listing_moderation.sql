-- ============================================================================
-- Sonradan moderasyon: ilan anında yayında, kaldırma kalıcı
--
-- SORUN 1 — kaldırma kalıcı değildi.
--   İlanların herkese açık SELECT politikası prod'da hâlâ şemanın ilk
--   sürümünden geliyordu: USING (is_active = true). İlan sahibinin kendi
--   ilanı üzerinde UPDATE yetkisi olduğu için, yönetici bir ilanı kaldırdıktan
--   (is_active = false) sonra sahibi onu tekrar true yapıp yayına
--   döndürebiliyordu. Yani moderasyon kararı geri alınabilirdi.
--
-- SORUN 2 — "teklif ver" butonu çalışmıyordu.
--   Yeni ilanlar moderation_status = 'pending' doğuyor ve yukarıdaki gevşek
--   politika yüzünden herkese görünüyordu; ama create_offer, revise_offer,
--   create_listing_report, create_listing_question ve increment_listing_view
--   ilanın 'approved' olmasını şart koşuyor. Sonuç: yayında görünen ama
--   teklif alamayan, şikayet edilemeyen, soru sorulamayan ilanlar.
--
-- KARAR: sonradan moderasyon. İlan anında yayına girer, kötüsü sonradan
-- kaldırılır. Bunu sistemin geri kalanıyla tutarlı hale getirmenin en güvenli
-- yolu, ilanları doğrudan 'approved' doğurmak: böylece hâlihazırdaki tüm
-- 'approved' kontrolleri olduğu gibi çalışmaya devam eder ve create_offer
-- gibi kritik fonksiyonları yeniden yazmak gerekmez.
--
-- Kaldırma mekanizması artık 'rejected'. Sahibi bu alana dokunamadığı için
-- (protect_listing_system_fields) yönetici kararı kalıcıdır.
-- ============================================================================

BEGIN;

-- ─── 1. Yeni ilan doğrudan yayında ──────────────────────────────────────────

ALTER TABLE public.listings
  ALTER COLUMN moderation_status SET DEFAULT 'approved';

-- Bekleyen ilanlar da yayına alınsın; sonradan moderasyonda "bekleyen" diye
-- bir ara durum yok. (Reddedilmişlere dokunulmuyor.)
UPDATE public.listings
SET moderation_status = 'approved'
WHERE moderation_status = 'pending';

DROP POLICY IF EXISTS "Giriş yapmış ilan ekleyebilir" ON public.listings;
CREATE POLICY "Giriş yapmış ilan ekleyebilir"
  ON public.listings FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND moderation_status = 'approved'
    AND view_count = 0
  );

-- ─── 2. Görünürlük: reddedilen ilan geri dönemez ────────────────────────────
-- is_active ilan sahibinin kendi anahtarı (ilanını duraklatabilmeli).
-- Yönetici kararı ayrı bir alanda tutulur ki sahibi geri alamasın.

DROP POLICY IF EXISTS "Aktif ilanlar herkese açık" ON public.listings;
CREATE POLICY "Aktif ilanlar herkese açık"
  ON public.listings FOR SELECT
  USING (is_active = TRUE AND moderation_status <> 'rejected');

DROP POLICY IF EXISTS "Sahip tüm ilanlarını görebilir" ON public.listings;
CREATE POLICY "Sahip tüm ilanlarını görebilir"
  ON public.listings FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Yöneticiler tüm ilanları görebilir" ON public.listings;
CREATE POLICY "Yöneticiler tüm ilanları görebilir"
  ON public.listings FOR SELECT
  USING (public.is_platform_admin());

-- ─── 3. Sahip sistem alanlarına dokunamaz ───────────────────────────────────
-- Bu trigger olmadan sahip kendi ilanının moderation_status'ünü 'approved'
-- yapıp kaldırma kararını geri alabilir ya da görüntülenmesini şişirebilir.
--
-- Depodaki orijinal mantık: yalnızca SAHİBİN kendi güncellemesi kısıtlanır.
-- increment_listing_view sahibi zaten hariç tuttuğu (owner_id IS DISTINCT
-- FROM auth.uid()) için görüntülenme sayacı bu kontrole takılmaz.

CREATE OR REPLACE FUNCTION public.protect_listing_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() = OLD.owner_id AND NOT public.is_platform_admin() AND (
    NEW.owner_id IS DISTINCT FROM OLD.owner_id OR
    NEW.moderation_status IS DISTINCT FROM OLD.moderation_status OR
    NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
    NEW.view_count IS DISTINCT FROM OLD.view_count
  ) THEN
    RAISE EXCEPTION 'Protected listing fields cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS protect_listing_system_fields ON public.listings;
CREATE TRIGGER protect_listing_system_fields
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_listing_system_fields();

COMMIT;
