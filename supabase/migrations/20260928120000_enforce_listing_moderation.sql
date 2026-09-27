-- ============================================================================
-- Moderasyon kapısını gerçekten kapat
--
-- Prod'da ilanların herkese açık SELECT politikası hâlâ şemanın ilk
-- sürümünden geliyor: USING (is_active = true). Yani `moderation_status`
-- 'pending' olan ilanlar da anında yayında — detay sayfası açılıyor, teklif
-- alınabiliyor. Admin panelindeki onay kuyruğu hiçbir şeyi kapıda tutmuyor.
--
-- Doğru politika security_hardening.sql'de zaten yazılıydı ama prod'a
-- uygulanmamış. Burada onu yürürlüğe koyuyoruz, yanında iki koruma ile:
--
--   1. Sahip ve yöneticiler kendi/tüm ilanlarını görmeye devam eder
--      (panodaki "onay bekliyor" ilanları kaybolmasın).
--   2. protect_listing_system_fields trigger'ı: ilan sahibi UPDATE yetkisine
--      sahip olduğu için, bu trigger olmadan kendi ilanının
--      moderation_status'ünü 'approved' yapıp kapıyı delebilir.
--
-- DİKKAT — davranış değişikliği: bu dosya uygulandığı anda onay bekleyen
-- ilanlar herkese görünmez olur. Uygulamadan önce admin panelindeki
-- "İnceleme" kuyruğunu boşalt, yoksa bekleyen ilanlar sahipleri dışında
-- kimseye görünmez (sahibi kendi panosunda görmeye devam eder).
-- ============================================================================

BEGIN;

-- ─── 1. Herkese açık görünürlük: yalnızca onaylanmış ve aktif ────────────────

DROP POLICY IF EXISTS "Aktif ilanlar herkese açık" ON public.listings;
CREATE POLICY "Aktif ilanlar herkese açık"
  ON public.listings FOR SELECT
  USING (is_active = TRUE AND moderation_status = 'approved');

-- Sahip kendi ilanlarını her durumda görür (onay bekleyenler dahil).
DROP POLICY IF EXISTS "Sahip tüm ilanlarını görebilir" ON public.listings;
CREATE POLICY "Sahip tüm ilanlarını görebilir"
  ON public.listings FOR SELECT
  USING (auth.uid() = owner_id);

-- Yöneticiler moderasyon kuyruğunu görebilmeli.
DROP POLICY IF EXISTS "Yöneticiler tüm ilanları görebilir" ON public.listings;
CREATE POLICY "Yöneticiler tüm ilanları görebilir"
  ON public.listings FOR SELECT
  USING (public.is_platform_admin());

-- ─── 2. Yeni ilan her zaman kuyruğa girer ───────────────────────────────────

DROP POLICY IF EXISTS "Giriş yapmış ilan ekleyebilir" ON public.listings;
CREATE POLICY "Giriş yapmış ilan ekleyebilir"
  ON public.listings FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND moderation_status = 'pending'
    AND view_count = 0
  );

-- ─── 3. Sahip sistem alanlarını elle değiştiremez ───────────────────────────
-- Sahibin UPDATE yetkisi var; bu trigger olmadan kendi ilanını onaylı
-- yapabilir veya görüntülenme sayısını şişirebilir.

CREATE OR REPLACE FUNCTION public.protect_listing_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Yalnızca ilan sahibinin kendi yaptığı güncellemeyi kısıtlıyoruz.
  -- increment_listing_view sahibi zaten hariç tuttuğu için (owner_id IS
  -- DISTINCT FROM auth.uid()) görüntülenme sayacı bu kontrole takılmaz.
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
