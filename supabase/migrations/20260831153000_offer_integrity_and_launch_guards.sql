-- Offer and auction integrity guards for production launch.
-- Apply after 20260831140000_security_quality_and_private_documents.sql.

BEGIN;

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_participants_differ;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_participants_differ
  CHECK (from_user_id <> to_user_id) NOT VALID;

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_message_length;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_message_length
  CHECK (char_length(trim(message)) BETWEEN 10 AND 2000) NOT VALID;

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_value_range;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_value_range
  CHECK (offered_value IS NULL OR offered_value BETWEEN 0 AND 2000000000) NOT VALID;

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_meeting_note_length;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_meeting_note_length
  CHECK (meeting_note IS NULL OR char_length(trim(meeting_note)) BETWEEN 1 AND 1000) NOT VALID;

ALTER TABLE public.swap_ratings DROP CONSTRAINT IF EXISTS swap_ratings_comment_length;
ALTER TABLE public.swap_ratings
  ADD CONSTRAINT swap_ratings_comment_length
  CHECK (comment IS NULL OR char_length(trim(comment)) BETWEEN 1 AND 1000) NOT VALID;

CREATE OR REPLACE FUNCTION public.create_offer(
  p_listing_id UUID,
  p_message TEXT,
  p_offered_value INTEGER DEFAULT NULL,
  p_offered_listing_id UUID DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.listings%ROWTYPE;
  v_offered public.listings%ROWTYPE;
  v_offer public.offers%ROWTYPE;
  v_message TEXT := trim(p_message);
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
  IF v_message IS NULL OR char_length(v_message) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Teklif mesaji 10 ile 2000 karakter arasinda olmalidir';
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
    listing_id,
    from_user_id,
    to_user_id,
    message,
    status,
    offered_value,
    offered_listing_id,
    offered_listing_title,
    from_accepted,
    to_accepted,
    from_confirmed,
    to_confirmed
  ) VALUES (
    v_target.id,
    auth.uid(),
    v_target.owner_id,
    v_message,
    'Beklemede',
    p_offered_value,
    p_offered_listing_id,
    CASE WHEN p_offered_listing_id IS NULL THEN NULL ELSE v_offered.title END,
    FALSE,
    FALSE,
    FALSE,
    FALSE
  )
  RETURNING * INTO v_offer;

  RETURN v_offer;
END;
$$;

REVOKE INSERT ON TABLE public.offers FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_offer(UUID, TEXT, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_offer(UUID, TEXT, INTEGER, UUID) TO authenticated;

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
    RAISE EXCEPTION 'Teklif bulunamadi veya erisim reddedildi';
  END IF;
  IF v_offer.status NOT IN ('Beklemede', 'Görüşülüyor') THEN
    RAISE EXCEPTION 'Teklif mevcut durumunda kabul edilemez';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = v_offer.listing_id
      AND owner_id = v_offer.to_user_id
      AND is_active = TRUE
      AND moderation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Hedef ilan artik teklif almaya uygun degil';
  END IF;
  IF v_offer.offered_listing_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = v_offer.offered_listing_id
      AND owner_id = v_offer.from_user_id
      AND is_active = TRUE
      AND moderation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Teklif edilen ilan artik uygun degil';
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

REVOKE ALL ON FUNCTION public.accept_offer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_offer(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_offer_message(p_offer_id UUID, p_text TEXT)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE INSERT ON TABLE public.messages FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.send_offer_message(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_offer_message(UUID, TEXT) TO authenticated;

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
  v_offered_title TEXT;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() <> v_offer.from_user_id THEN
    RAISE EXCEPTION 'Yalnizca teklifi gonderen kisi revizyon yapabilir';
  END IF;
  IF v_offer.status NOT IN ('Beklemede', 'Görüşülüyor') THEN
    RAISE EXCEPTION 'Kapali teklif revize edilemez';
  END IF;
  IF p_offered_value IS NOT NULL AND p_offered_value NOT BETWEEN 0 AND 2000000000 THEN
    RAISE EXCEPTION 'Teklif degeri gecersiz';
  END IF;
  IF p_offered_listing_id IS NULL AND COALESCE(p_offered_value, 0) <= 0 THEN
    RAISE EXCEPTION 'Bir ilan veya gecerli teklif degeri gereklidir';
  END IF;
  IF p_offered_listing_id IS NOT NULL THEN
    IF p_offered_listing_id = v_offer.listing_id THEN
      RAISE EXCEPTION 'Ayni ilan takas teklifi olarak kullanilamaz';
    END IF;
    SELECT title INTO v_offered_title
    FROM public.listings
    WHERE id = p_offered_listing_id
      AND owner_id = auth.uid()
      AND is_active = TRUE
      AND moderation_status = 'approved';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Yalnizca kendi aktif ilaninizi teklif edebilirsiniz';
    END IF;
  END IF;

  UPDATE public.offers
  SET offered_value = p_offered_value,
      offered_listing_id = p_offered_listing_id,
      offered_listing_title = v_offered_title,
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

REVOKE ALL ON FUNCTION public.revise_offer(UUID, INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_offer(UUID, INTEGER, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.place_auction_bid(
  p_auction_id UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_auction public.auctions%ROWTYPE;
  result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Teklif vermek icin giris yapmalisiniz';
  END IF;

  SELECT * INTO locked_auction
  FROM public.auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mezat bulunamadi'; END IF;
  IF locked_auction.owner_id = auth.uid() THEN RAISE EXCEPTION 'Kendi mezadiniza teklif veremezsiniz'; END IF;
  IF locked_auction.status = 'ended' OR NOW() >= locked_auction.ends_at THEN
    UPDATE public.auctions SET status = 'ended' WHERE id = p_auction_id;
    RAISE EXCEPTION 'Bu mezat sona erdi';
  END IF;
  IF NOW() < locked_auction.starts_at THEN RAISE EXCEPTION 'Bu mezat henuz baslamadi'; END IF;
  IF p_amount <= 0 OR p_amount > 2000000000 THEN RAISE EXCEPTION 'Teklif tutari gecersiz'; END IF;
  IF p_amount < locked_auction.current_bid + locked_auction.bid_increment THEN
    RAISE EXCEPTION 'Teklif minimum artis tutarinin altinda';
  END IF;
  IF p_note IS NOT NULL AND char_length(trim(p_note)) > 240 THEN RAISE EXCEPTION 'Teklif notu cok uzun'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = locked_auction.listing_id
      AND is_active = TRUE
      AND moderation_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Ilan artik teklif almaya uygun degil';
  END IF;

  INSERT INTO public.auction_bids (auction_id, user_id, amount, note)
  VALUES (p_auction_id, auth.uid(), p_amount, NULLIF(trim(p_note), ''));

  UPDATE public.auctions SET current_bid = p_amount, status = 'live' WHERE id = p_auction_id;

  SELECT to_jsonb(a) || jsonb_build_object(
    'bids', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(b) || jsonb_build_object('bidder', jsonb_build_object('name', COALESCE(p.name, 'Katilimci')))
        ORDER BY b.created_at DESC
      )
      FROM public.auction_bids b
      LEFT JOIN public.profiles p ON p.id = b.user_id
      WHERE b.auction_id = a.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.auctions a
  WHERE a.id = p_auction_id;

  RETURN result;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.auction_bids FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.place_auction_bid(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(UUID, NUMERIC, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('fake', 'misleading', 'spam', 'inappropriate', 'scam', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(trim(details)) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_reports_one_pending_per_user
  ON public.listing_reports (listing_id, reporter_id)
  WHERE status = 'pending';

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Yöneticiler şikayetleri görür" ON public.listing_reports;
CREATE POLICY "Yöneticiler şikayetleri görür"
  ON public.listing_reports FOR SELECT
  USING (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.create_listing_report(
  p_listing_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS public.listing_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_report public.listing_reports%ROWTYPE;
  v_details TEXT := NULLIF(trim(p_details), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sikayet icin giris yapmalisiniz';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('fake', 'misleading', 'spam', 'inappropriate', 'scam', 'other') THEN
    RAISE EXCEPTION 'Gecersiz sikayet nedeni';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > 1000 THEN
    RAISE EXCEPTION 'Sikayet detayi cok uzun';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id AND is_active = TRUE AND moderation_status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ilan bulunamadi'; END IF;
  IF v_owner_id = auth.uid() THEN RAISE EXCEPTION 'Kendi ilaninizi sikayet edemezsiniz'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('report-rate:' || auth.uid()::text, 0));
  IF (
    SELECT COUNT(*) FROM public.listing_reports
    WHERE reporter_id = auth.uid() AND created_at >= NOW() - INTERVAL '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'Sikayet sinirina ulastiniz, daha sonra tekrar deneyin';
  END IF;

  INSERT INTO public.listing_reports (listing_id, reporter_id, reason, details)
  VALUES (p_listing_id, auth.uid(), p_reason, v_details)
  RETURNING * INTO v_report;
  RETURN v_report;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Bu ilan icin zaten acik bir sikayetiniz var';
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.listing_reports FROM anon, authenticated;
GRANT SELECT ON TABLE public.listing_reports TO authenticated;
REVOKE ALL ON FUNCTION public.create_listing_report(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_listing_report(UUID, TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.listing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(trim(question)) BETWEEN 5 AND 500),
  answer TEXT CHECK (answer IS NULL OR char_length(trim(answer)) BETWEEN 2 AND 1000),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_questions_listing_created_idx
  ON public.listing_questions (listing_id, created_at DESC);

ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "İlan soruları herkese açık" ON public.listing_questions;
CREATE POLICY "İlan soruları herkese açık"
  ON public.listing_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id
        AND (l.is_active = TRUE OR l.owner_id = auth.uid() OR public.is_platform_admin())
    )
  );

CREATE OR REPLACE FUNCTION public.create_listing_question(p_listing_id UUID, p_question TEXT)
RETURNS public.listing_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_question public.listing_questions%ROWTYPE;
  v_text TEXT := trim(p_question);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Soru icin giris yapmalisiniz'; END IF;
  IF v_text IS NULL OR char_length(v_text) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Soru 5 ile 500 karakter arasinda olmalidir';
  END IF;
  SELECT owner_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id AND is_active = TRUE AND moderation_status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ilan soru almaya uygun degil'; END IF;
  IF v_owner_id = auth.uid() THEN RAISE EXCEPTION 'Kendi ilaniniza soru soramazsiniz'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('question-rate:' || auth.uid()::text, 0));
  IF (
    SELECT COUNT(*) FROM public.listing_questions
    WHERE user_id = auth.uid() AND created_at >= NOW() - INTERVAL '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Soru sinirina ulastiniz, daha sonra tekrar deneyin';
  END IF;

  INSERT INTO public.listing_questions (listing_id, user_id, question)
  VALUES (p_listing_id, auth.uid(), v_text)
  RETURNING * INTO v_question;
  RETURN v_question;
END;
$$;

CREATE OR REPLACE FUNCTION public.answer_listing_question(p_question_id UUID, p_answer TEXT)
RETURNS public.listing_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question public.listing_questions%ROWTYPE;
  v_text TEXT := trim(p_answer);
BEGIN
  IF auth.uid() IS NULL OR v_text IS NULL OR char_length(v_text) NOT BETWEEN 2 AND 1000 THEN
    RAISE EXCEPTION 'Gecersiz yanit';
  END IF;
  SELECT q.* INTO v_question
  FROM public.listing_questions q
  JOIN public.listings l ON l.id = q.listing_id
  WHERE q.id = p_question_id AND l.owner_id = auth.uid()
  FOR UPDATE OF q;
  IF NOT FOUND THEN RAISE EXCEPTION 'Soru bulunamadi veya erisim reddedildi'; END IF;

  UPDATE public.listing_questions
  SET answer = v_text, answered_at = NOW()
  WHERE id = p_question_id
  RETURNING * INTO v_question;
  RETURN v_question;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_listing_question(p_question_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Giris gerekli'; END IF;
  DELETE FROM public.listing_questions q
  USING public.listings l
  WHERE q.id = p_question_id
    AND l.id = q.listing_id
    AND (q.user_id = auth.uid() OR l.owner_id = auth.uid() OR public.is_platform_admin());
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RAISE EXCEPTION 'Soru bulunamadi veya erisim reddedildi'; END IF;
  RETURN TRUE;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.listing_questions FROM anon, authenticated;
GRANT SELECT ON TABLE public.listing_questions TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_listing_question(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.answer_listing_question(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_listing_question(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_listing_question(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.answer_listing_question(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_listing_question(UUID) TO authenticated;

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
    'reports', (SELECT COUNT(*) FROM public.listing_reports WHERE status = 'pending'),
    'notifications', (SELECT COUNT(*) FROM public.notifications)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;

COMMIT;
