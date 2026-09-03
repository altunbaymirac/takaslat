-- Açık artırma başvuruları.
-- Kullanıcı aracını açık artırmaya sunmak için başvurur; ekip inceler,
-- onaylananlar 7 günlük açık artırmaya çıkar.

BEGIN;

CREATE TABLE IF NOT EXISTS public.auction_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expected_price  NUMERIC(14,2),
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  review_note     TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  auction_id      UUID REFERENCES public.auctions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.auction_requests DROP CONSTRAINT IF EXISTS auction_requests_status_check;
ALTER TABLE public.auction_requests
  ADD CONSTRAINT auction_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Aynı ilan için aynı anda tek bekleyen başvuru.
CREATE UNIQUE INDEX IF NOT EXISTS auction_requests_pending_listing_idx
  ON public.auction_requests (listing_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS auction_requests_owner_idx ON public.auction_requests (owner_id, created_at DESC);

ALTER TABLE public.auction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanıcı kendi başvurusunu görür" ON public.auction_requests;
CREATE POLICY "Kullanıcı kendi başvurusunu görür"
  ON public.auction_requests FOR SELECT
  USING (auth.uid() = owner_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "İlan sahibi başvuru oluşturur" ON public.auction_requests;
CREATE POLICY "İlan sahibi başvuru oluşturur"
  ON public.auction_requests FOR INSERT
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

DROP POLICY IF EXISTS "Yöneticiler başvuruyu günceller" ON public.auction_requests;
CREATE POLICY "Yöneticiler başvuruyu günceller"
  ON public.auction_requests FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ── Yönetim: başvuruları listele ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_auction_requests(p_status TEXT DEFAULT NULL)
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
    RAISE EXCEPTION 'Invalid request status';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(r) || jsonb_build_object(
        'listing', jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'city', l.city,
          'estimated_value', l.estimated_value,
          'images', l.images
        ),
        'owner', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email
        )
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT *
    FROM public.auction_requests
    WHERE p_status IS NULL OR status = p_status
    ORDER BY created_at DESC
    LIMIT 250
  ) AS r
  LEFT JOIN public.listings l ON l.id = r.listing_id
  LEFT JOIN public.profiles p ON p.id = r.owner_id;

  RETURN v_result;
END;
$$;

-- ── Yönetim: başvuruyu karara bağla ─────────────────────────────────────────
-- Onayda ilan sahibi adına 7 günlük mezat açılır.
CREATE OR REPLACE FUNCTION public.admin_review_auction_request(
  p_request_id     UUID,
  p_approve        BOOLEAN,
  p_starting_price NUMERIC DEFAULT NULL,
  p_bid_increment  NUMERIC DEFAULT NULL,
  p_review_note    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.auction_requests%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_start   NUMERIC;
  v_step    NUMERIC;
  v_auction public.auctions%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_request FROM public.auction_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Başvuru bulunamadı';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Bu başvuru zaten sonuçlandırılmış';
  END IF;

  IF NOT p_approve THEN
    UPDATE public.auction_requests
    SET status = 'rejected',
        review_note = p_review_note,
        reviewed_by = auth.uid(),
        reviewed_at = NOW()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v_request.listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İlan bulunamadı';
  END IF;

  v_start := COALESCE(p_starting_price, v_request.expected_price, ROUND(v_listing.estimated_value * 0.75));
  v_step  := COALESCE(p_bid_increment, GREATEST(1000, ROUND(v_listing.estimated_value * 0.015)));

  IF v_start < 1000 THEN
    RAISE EXCEPTION 'Başlangıç fiyatı çok düşük';
  END IF;

  INSERT INTO public.auctions (
    listing_id, owner_id, title, starts_at, ends_at,
    starting_price, current_bid, bid_increment, status
  )
  VALUES (
    v_request.listing_id, v_request.owner_id, v_listing.title, NOW(), NOW() + INTERVAL '7 days',
    v_start, v_start, v_step, 'live'
  )
  RETURNING * INTO v_auction;

  UPDATE public.auction_requests
  SET status = 'approved',
      review_note = p_review_note,
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      auction_id = v_auction.id
  WHERE id = p_request_id;

  RETURN jsonb_build_object('status', 'approved', 'auction_id', v_auction.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_auction_requests(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_auction_requests(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_auction_request(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_auction_request(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
