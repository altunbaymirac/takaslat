-- Takaslat security and transaction hardening.
-- Apply after schema.sql.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS from_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS to_accepted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS reserve_met BOOLEAN,
  ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_bid NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.listings ALTER COLUMN moderation_status SET DEFAULT 'pending';
UPDATE public.listings SET moderation_status = 'approved' WHERE moderation_status IS NULL;
ALTER TABLE public.listings ALTER COLUMN moderation_status SET NOT NULL;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_moderation_status_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected')) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_wanted_for_min_length'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_wanted_for_min_length
      CHECK (char_length(trim(wanted_for)) >= 20) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_content_quality;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_content_quality
  CHECK (
    estimated_value BETWEEN 1000 AND 2000000000
    AND char_length(trim(title)) BETWEEN 5 AND 120
    AND char_length(trim(description)) BETWEEN 30 AND 5000
    AND jsonb_array_length(COALESCE(images, '[]'::jsonb)) BETWEEN 1 AND 8
  ) NOT VALID;

CREATE TABLE IF NOT EXISTS public.swap_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT CHECK (char_length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (offer_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
);

ALTER TABLE public.swap_ratings ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Kullanıcı kendi profilini günceller" ON public.profiles;
CREATE POLICY "Kullanıcı kendi profilini günceller"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_platform_admin())
  WITH CHECK (auth.uid() = id OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.protect_listing_system_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS protect_listing_system_fields ON public.listings;
CREATE TRIGGER protect_listing_system_fields
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_listing_system_fields();

DROP POLICY IF EXISTS "Aktif ilanlar herkese açık" ON public.listings;
CREATE POLICY "Aktif ilanlar herkese açık"
  ON public.listings FOR SELECT
  USING (is_active = TRUE AND moderation_status = 'approved');

DROP POLICY IF EXISTS "Giriş yapmış ilan ekleyebilir" ON public.listings;
CREATE POLICY "Giriş yapmış ilan ekleyebilir"
  ON public.listings FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND moderation_status = 'pending'
    AND view_count = 0
  );

DROP POLICY IF EXISTS "Sahip ilanı güncelleyebilir" ON public.listings;
CREATE POLICY "Sahip ilanı güncelleyebilir"
  ON public.listings FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_platform_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Yöneticiler tüm ilanları görebilir" ON public.listings;
CREATE POLICY "Yöneticiler tüm ilanları görebilir"
  ON public.listings FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "İlan sahibi mezat açabilir" ON public.auctions;
CREATE POLICY "İlan sahibi mezat açabilir"
  ON public.auctions FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.owner_id = auth.uid()
        AND l.is_active = TRUE
        AND l.moderation_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Giriş yapmış teklif oluşturabilir" ON public.offers;
CREATE POLICY "Giriş yapmış teklif oluşturabilir"
  ON public.offers FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id <> to_user_id
    AND status = 'Beklemede'
    AND NOT from_accepted
    AND NOT to_accepted
    AND NOT from_confirmed
    AND NOT to_confirmed
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND l.owner_id = to_user_id
        AND l.is_active = TRUE
        AND l.moderation_status = 'approved'
    )
    AND (
      offered_listing_id IS NULL OR EXISTS (
        SELECT 1 FROM public.listings own_listing
        WHERE own_listing.id = offered_listing_id
          AND own_listing.owner_id = auth.uid()
          AND own_listing.is_active = TRUE
          AND own_listing.moderation_status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "Taraflar teklifi güncelleyebilir" ON public.offers;
REVOKE UPDATE ON public.offers FROM authenticated;

DROP POLICY IF EXISTS "Taraflar mesaj gönderebilir" ON public.messages;
CREATE POLICY "Taraflar mesaj gönderebilir"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND char_length(trim(text)) BETWEEN 1 AND 4000
    AND EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND o.status NOT IN ('Reddedildi', 'Tamamlandı')
        AND (o.from_user_id = auth.uid() OR o.to_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Takas puanlarını herkes görür" ON public.swap_ratings;
CREATE POLICY "Takas puanlarını herkes görür"
  ON public.swap_ratings FOR SELECT USING (TRUE);

REVOKE INSERT, UPDATE, DELETE ON public.swap_ratings FROM authenticated;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, name, city, avatar, rating, total_swaps, role,
  email_verified, phone_verified, created_at, updated_at, last_seen_at
) ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Kullanıcı bildirimlerini güncelleyebilir" ON public.notifications;
REVOKE UPDATE ON public.notifications FROM authenticated;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.notifications SET read = TRUE
  WHERE user_id = auth.uid() AND read = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_offer_for_actor(p_offer_id UUID)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id;
  IF NOT FOUND OR auth.uid() IS NULL OR
     (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Offer not found or access denied';
  END IF;
  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_offer_status(
  p_offer_id UUID,
  p_status TEXT,
  p_meeting_note TEXT DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR
     (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Offer not found or access denied';
  END IF;

  IF p_status = 'Görüşülüyor' THEN
    IF auth.uid() <> v_offer.to_user_id OR v_offer.status <> 'Beklemede' THEN
      RAISE EXCEPTION 'Only the recipient can open a pending offer';
    END IF;
  ELSIF p_status = 'Reddedildi' THEN
    IF v_offer.status IN ('Reddedildi', 'Tamamlandı') THEN
      RAISE EXCEPTION 'Closed offer cannot be changed';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid direct status transition';
  END IF;

  UPDATE public.offers
  SET status = p_status,
      meeting_note = COALESCE(NULLIF(trim(p_meeting_note), ''), meeting_note)
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;
  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_offer(p_offer_id UUID)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR
     (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Offer not found or access denied';
  END IF;
  IF v_offer.status NOT IN ('Beklemede', 'Görüşülüyor') THEN
    RAISE EXCEPTION 'Offer cannot be accepted in its current state';
  END IF;

  UPDATE public.offers
  SET from_accepted = from_accepted OR auth.uid() = from_user_id,
      to_accepted = to_accepted OR auth.uid() = to_user_id
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  IF v_offer.from_accepted AND v_offer.to_accepted THEN
    UPDATE public.offers SET status = 'Onaylandı'
    WHERE id = p_offer_id RETURNING * INTO v_offer;
  END IF;
  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_offer_complete(p_offer_id UUID)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR
     (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Offer not found or access denied';
  END IF;
  IF v_offer.status <> 'Onaylandı' THEN
    RAISE EXCEPTION 'Only an accepted offer can be completed';
  END IF;

  UPDATE public.offers
  SET from_confirmed = from_confirmed OR auth.uid() = from_user_id,
      to_confirmed = to_confirmed OR auth.uid() = to_user_id
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;

  IF v_offer.from_confirmed AND v_offer.to_confirmed THEN
    UPDATE public.offers SET status = 'Tamamlandı'
    WHERE id = p_offer_id RETURNING * INTO v_offer;
    UPDATE public.profiles
    SET total_swaps = COALESCE(total_swaps, 0) + 1
    WHERE id IN (v_offer.from_user_id, v_offer.to_user_id);
  END IF;
  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.revise_offer(
  p_offer_id UUID,
  p_offered_value INTEGER DEFAULT NULL,
  p_offered_listing_id UUID DEFAULT NULL,
  p_offered_listing_title TEXT DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR
     (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Offer not found or access denied';
  END IF;
  IF v_offer.status NOT IN ('Beklemede', 'Görüşülüyor') THEN
    RAISE EXCEPTION 'Closed offer cannot be revised';
  END IF;
  IF p_offered_value IS NOT NULL AND p_offered_value < 0 THEN
    RAISE EXCEPTION 'Cash difference cannot be negative';
  END IF;
  IF p_offered_listing_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = p_offered_listing_id
      AND l.owner_id = auth.uid()
      AND l.is_active = TRUE
      AND l.moderation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Offered listing is not available';
  END IF;

  UPDATE public.offers
  SET offered_value = p_offered_value,
      offered_listing_id = p_offered_listing_id,
      offered_listing_title = NULLIF(trim(p_offered_listing_title), ''),
      status = 'Görüşülüyor',
      from_accepted = FALSE,
      to_accepted = FALSE,
      from_confirmed = FALSE,
      to_confirmed = FALSE
  WHERE id = p_offer_id
  RETURNING * INTO v_offer;
  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.rate_offer(
  p_offer_id UUID,
  p_score SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_reviewee UUID;
  v_rating NUMERIC;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR
     (auth.uid() <> v_offer.from_user_id AND auth.uid() <> v_offer.to_user_id) THEN
    RAISE EXCEPTION 'Offer not found or access denied';
  END IF;
  IF v_offer.status <> 'Tamamlandı' THEN
    RAISE EXCEPTION 'Only completed swaps can be rated';
  END IF;
  IF p_score NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Score must be between 1 and 5';
  END IF;

  v_reviewee := CASE WHEN auth.uid() = v_offer.from_user_id
    THEN v_offer.to_user_id ELSE v_offer.from_user_id END;

  INSERT INTO public.swap_ratings (offer_id, reviewer_id, reviewee_id, score, comment)
  VALUES (p_offer_id, auth.uid(), v_reviewee, p_score, NULLIF(trim(p_comment), ''));

  UPDATE public.offers
  SET from_rated = from_rated OR auth.uid() = from_user_id,
      to_rated = to_rated OR auth.uid() = to_user_id
  WHERE id = p_offer_id;

  SELECT ROUND(AVG(score)::NUMERIC, 2) INTO v_rating
  FROM public.swap_ratings WHERE reviewee_id = v_reviewee;
  UPDATE public.profiles SET rating = v_rating WHERE id = v_reviewee;
  RETURN v_rating;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_listing_view(p_listing_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.listings
  SET view_count = view_count + 1
  WHERE id = p_listing_id
    AND is_active = TRUE
    AND moderation_status = 'approved'
    AND owner_id IS DISTINCT FROM auth.uid()
  RETURNING view_count INTO v_count;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_auction(p_auction_id UUID)
RETURNS public.auctions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction public.auctions%ROWTYPE;
  v_top_bid public.auction_bids%ROWTYPE;
BEGIN
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;
  IF NOW() < v_auction.ends_at AND auth.uid() <> v_auction.owner_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Auction has not ended';
  END IF;
  IF NOW() < v_auction.ends_at AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auction has not ended';
  END IF;

  SELECT * INTO v_top_bid
  FROM public.auction_bids
  WHERE auction_id = p_auction_id
  ORDER BY amount DESC, created_at ASC
  LIMIT 1;

  UPDATE public.auctions
  SET status = 'ended',
      reserve_met = v_top_bid.id IS NOT NULL
        AND (reserve_price IS NULL OR v_top_bid.amount >= reserve_price),
      winner_id = CASE
        WHEN v_top_bid.id IS NOT NULL
          AND (reserve_price IS NULL OR v_top_bid.amount >= reserve_price)
        THEN v_top_bid.user_id ELSE NULL END,
      winning_bid = CASE
        WHEN v_top_bid.id IS NOT NULL
          AND (reserve_price IS NULL OR v_top_bid.amount >= reserve_price)
        THEN v_top_bid.amount ELSE NULL END,
      closed_at = NOW()
  WHERE id = p_auction_id
  RETURNING * INTO v_auction;
  RETURN v_auction;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.auctions
    WHERE status <> 'ended' AND ends_at <= NOW()
  LOOP
    PERFORM public.finalize_auction(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

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

REVOKE ALL ON FUNCTION public.get_offer_for_actor(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notifications_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_offer_status(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_offer(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_offer_complete(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revise_offer(UUID, INTEGER, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_offer(UUID, SMALLINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_listing_view(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_auction(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_expired_auctions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_ban_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_users(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_auction(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_offer_for_actor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_offer_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_offer_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revise_offer(UUID, INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_offer(UUID, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_listing_view(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_auction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_expired_auctions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;

DROP POLICY IF EXISTS "Giriş yapmış kullanıcı görsel yükleyebilir" ON storage.objects;
CREATE POLICY "Giriş yapmış kullanıcı görsel yükleyebilir"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'images';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Kullanıcı kendi belgesini yükler" ON storage.objects;
DROP POLICY IF EXISTS "Giriş yapmış kullanıcı belgeleri görüntüler" ON storage.objects;
DROP POLICY IF EXISTS "Kullanıcı kendi belgesini siler" ON storage.objects;

CREATE POLICY "Kullanıcı kendi belgesini yükler"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Giriş yapmış kullanıcı belgeleri görüntüler"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Kullanıcı kendi belgesini siler"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
