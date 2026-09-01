-- Repairs the admin listing RPC and refreshes the PostgREST schema cache.
-- Safe to run repeatedly after the base admin migrations.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_listings(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid moderation status';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(l) || jsonb_build_object(
        'owner', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email,
          'avatar', p.avatar,
          'rating', p.rating,
          'total_swaps', p.total_swaps,
          'email_verified', p.email_verified,
          'phone_verified', p.phone_verified
        )
      )
      ORDER BY l.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT *
    FROM public.listings
    WHERE p_status IS NULL OR moderation_status = p_status
    ORDER BY created_at DESC
    LIMIT 250
  ) AS l
  LEFT JOIN public.profiles AS p ON p.id = l.owner_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_listings(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_listings(TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
