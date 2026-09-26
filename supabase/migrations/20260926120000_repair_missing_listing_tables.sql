-- ============================================================================
-- Prod şema onarımı: eksik ilan tabloları
--
-- Canlı veritabanında üç tablo hiç oluşmamıştı:
--   listing_verifications  (schema.sql)
--   listing_reports        (20260831153000_offer_integrity_and_launch_guards.sql)
--   listing_questions      (aynı dosya)
--
-- İlgili fonksiyonlar (place_auction_bid vb.) prod'a girmiş ama tablolar
-- girmemiş; anlaşılan o dosyalar parça parça çalıştırılmış. Sonuç olarak ilan
-- detay sayfası her açılışta listing_verifications'a istek atıp 404 alıyor,
-- şikayet ve soru-cevap akışları ise çalışmıyor.
--
-- Bu dosya SADECE eksik olanı tamamlar. Kaynak dosyaları olduğu gibi tekrar
-- çalıştırmak güvenli DEĞİL: 20260831153000 içindeki create_offer, daha sonra
-- 20260904120000 ile "mesaj opsiyonel" hâline getirilmişti; eskisini yeniden
-- çalıştırmak o değişikliği geri alırdı. Burada create_offer'a dokunulmuyor.
--
-- Tümü idempotent — tablolar zaten varsa hiçbir şey değişmez.
-- ============================================================================

BEGIN;

-- ─── 1. İlan doğrulama durumları ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listing_verifications (
  listing_id       UUID PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  identity_state   TEXT NOT NULL DEFAULT 'not_started' CHECK (identity_state IN ('verified', 'pending', 'not_started')),
  ownership_state  TEXT NOT NULL DEFAULT 'not_started' CHECK (ownership_state IN ('verified', 'pending', 'not_started')),
  vin_state        TEXT NOT NULL DEFAULT 'not_started' CHECK (vin_state IN ('verified', 'pending', 'not_started')),
  mileage_state    TEXT NOT NULL DEFAULT 'not_started' CHECK (mileage_state IN ('verified', 'pending', 'not_started')),
  damage_state     TEXT NOT NULL DEFAULT 'not_started' CHECK (damage_state IN ('verified', 'pending', 'not_started')),
  expertise_state  TEXT NOT NULL DEFAULT 'not_started' CHECK (expertise_state IN ('verified', 'pending', 'not_started')),
  source_refs      JSONB NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.listing_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "İlan doğrulamaları herkese açık" ON public.listing_verifications;
CREATE POLICY "İlan doğrulamaları herkese açık"
  ON public.listing_verifications FOR SELECT USING (true);

-- Doğrulama durumlarını yalnızca ekip belirler; istemci sadece okur.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.listing_verifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.listing_verifications TO anon, authenticated;

-- ─── 2. İlan şikayetleri ────────────────────────────────────────────────────

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

-- Aynı kullanıcı aynı ilan için tek açık şikayet tutabilir.
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
AS $fn$
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
$fn$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.listing_reports FROM anon, authenticated;
GRANT SELECT ON TABLE public.listing_reports TO authenticated;
REVOKE ALL ON FUNCTION public.create_listing_report(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_listing_report(UUID, TEXT, TEXT) TO authenticated;

-- ─── 3. İlan soru-cevap ─────────────────────────────────────────────────────

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
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.answer_listing_question(p_question_id UUID, p_answer TEXT)
RETURNS public.listing_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.delete_listing_question(p_question_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.listing_questions FROM anon, authenticated;
GRANT SELECT ON TABLE public.listing_questions TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_listing_question(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.answer_listing_question(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_listing_question(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_listing_question(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.answer_listing_question(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_listing_question(UUID) TO authenticated;

COMMIT;
