-- Admin panel backend. Safe to run repeatedly after the base schema.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.listings
  ALTER COLUMN moderation_status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_platform_admin() AND (
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.rating IS DISTINCT FROM OLD.rating OR
    NEW.total_swaps IS DISTINCT FROM OLD.total_swaps OR
    NEW.email_verified IS DISTINCT FROM OLD.email_verified OR
    NEW.phone_verified IS DISTINCT FROM OLD.phone_verified OR
    NEW.two_factor_enabled IS DISTINCT FROM OLD.two_factor_enabled OR
    NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
DROP TRIGGER IF EXISTS protect_profile_system_fields ON public.profiles;
CREATE TRIGGER protect_profile_system_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_system_fields();

DROP POLICY IF EXISTS "Yöneticiler tüm ilanları görür" ON public.listings;
CREATE POLICY "Yöneticiler tüm ilanları görür"
  ON public.listings FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin profilleri günceller" ON public.profiles;
CREATE POLICY "Admin profilleri günceller"
  ON public.profiles FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin ilanları günceller" ON public.listings;
CREATE POLICY "Admin ilanları günceller"
  ON public.listings FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.admin_moderate_listing(
  p_listing_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN RAISE EXCEPTION 'Invalid moderation status'; END IF;
  UPDATE public.listings
  SET moderation_status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN NULLIF(trim(p_reason), '') ELSE NULL END
  WHERE id = p_listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_role NOT IN ('user', 'admin', 'moderator') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Admin cannot remove own access';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Admin cannot ban own account'; END IF;
  UPDATE public.listings SET is_active = FALSE WHERE owner_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_users(p_search TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'email', p.email,
    'role', p.role,
    'email_verified', p.email_verified,
    'phone_verified', p.phone_verified,
    'rating', p.rating,
    'total_swaps', p.total_swaps,
    'created_at', p.created_at,
    'listing_count', (SELECT COUNT(*) FROM public.listings l WHERE l.owner_id = p.id),
    'offer_count', (SELECT COUNT(*) FROM public.offers o WHERE o.from_user_id = p.id)
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT * FROM public.profiles
    WHERE p_search IS NULL
       OR name ILIKE '%' || p_search || '%'
       OR email ILIKE '%' || p_search || '%'
    ORDER BY created_at DESC
    LIMIT 100
  ) p;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT COUNT(*) FROM public.profiles),
    'listings', (SELECT COUNT(*) FROM public.listings),
    'pending_listings', (SELECT COUNT(*) FROM public.listings WHERE moderation_status = 'pending'),
    'offers', (SELECT COUNT(*) FROM public.offers),
    'notifications', (SELECT COUNT(*) FROM public.notifications)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_ban_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_users(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;
