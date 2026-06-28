-- ============================================================
-- Takaslat — Admin Yetki Politikaları
-- Supabase Dashboard → SQL Editor → çalıştır
--
-- Admin panelindeki "rol değiştir" ve "kullanıcıyı banla (ilanları pasif)"
-- işlemleri RLS tarafından engelleniyordu. Bu script, rolü admin/moderator
-- olan kullanıcılara güvenli şekilde bu yetkileri verir.
-- Normal kullanıcılar etkilenmez; yetki yalnızca admin rolüne bağlıdır.
-- ============================================================


-- ─── SORGU 1 — is_admin() yardımcı fonksiyonu ────────────────
-- SECURITY DEFINER: RLS'i atlayarak çağıranın rolünü kontrol eder
-- (politika içinden profiles sorgulamanın özyineleme riskini önler).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ─── SORGU 2 — Rol escalation trigger'ı: admin'e izin ver ────
-- Eski hali her giriş yapmış kullanıcının rol değişimini engelliyordu.
-- Artık admin/moderator rol değiştirebilir; diğerleri yine engellenir.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Rol değiştirme yetkisi yok';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── SORGU 3 — Admin her profili güncelleyebilsin (rol için) ─
DROP POLICY IF EXISTS "Admin profilleri günceller" ON public.profiles;
CREATE POLICY "Admin profilleri günceller"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());


-- ─── SORGU 4 — Admin her ilanı güncelleyebilsin (ban için) ───
DROP POLICY IF EXISTS "Admin ilanları günceller" ON public.listings;
CREATE POLICY "Admin ilanları günceller"
  ON public.listings FOR UPDATE
  USING (public.is_admin());
