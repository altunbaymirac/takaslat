-- ============================================================================
-- Şikayet inceleme
--
-- `listing_reports` tablosu ve `create_listing_report` RPC'si vardı; kullanıcı
-- şikayet edebiliyordu ve admin panelinde bekleyen şikayet sayısı bile
-- gösteriliyordu. Ama şikayetleri okuyan ya da sonuçlandıran hiçbir arayüz
-- yoktu — ihbarlar tabloya düşüp orada kalıyordu.
--
-- Burada eksik iki ucu ekliyoruz: listeleme ve sonuçlandırma.
-- ============================================================================

BEGIN;

-- Bekleyen şikayetleri tarih sırasına göre çekerken kullanılır.
CREATE INDEX IF NOT EXISTS listing_reports_status_created_idx
  ON public.listing_reports (status, created_at DESC);

-- ─── Listeleme ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_listing_reports(p_status TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'reviewed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid report status';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(r) || jsonb_build_object(
        'listing', CASE WHEN l.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'city', l.city,
          'is_active', l.is_active,
          'moderation_status', l.moderation_status,
          'owner_id', l.owner_id
        ) END,
        'reporter', CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', rp.id,
          'name', rp.name,
          'email', rp.email
        ) END
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT *
    FROM public.listing_reports
    WHERE p_status IS NULL OR status = p_status
    ORDER BY created_at DESC
    LIMIT 250
  ) AS r
  LEFT JOIN public.listings l  ON l.id  = r.listing_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id;

  RETURN v_result;
END;
$fn$;

-- ─── Sonuçlandırma ──────────────────────────────────────────────────────────
--
-- p_action:
--   'dismiss'  → şikayet yersiz, ilan olduğu gibi kalır
--   'reviewed' → şikayet incelendi, ilana dokunulmaz (elle başka işlem yapıldı)
--   'reject'   → ilan yayından kaldırılır ve şikayet kapatılır
--
-- 'reject' ilanı reddederken listings trigger'ı ilan sahibine bildirim üretir.

CREATE OR REPLACE FUNCTION public.admin_review_listing_report(
  p_report_id UUID,
  p_action    TEXT,
  p_reason    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_report public.listing_reports%ROWTYPE;
  v_status TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_action NOT IN ('dismiss', 'reviewed', 'reject') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT * INTO v_report FROM public.listing_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Şikayet bulunamadı';
  END IF;
  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'Bu şikayet zaten sonuçlandırılmış';
  END IF;

  IF p_action = 'reject' THEN
    UPDATE public.listings
    SET moderation_status = 'rejected',
        rejection_reason  = COALESCE(NULLIF(trim(p_reason), ''), 'Şikayet üzerine yayından kaldırıldı'),
        is_active         = FALSE,
        updated_at        = NOW()
    WHERE id = v_report.listing_id;

    -- Aynı ilana ait diğer bekleyen şikayetler de kapanır; ilan zaten kalktı.
    UPDATE public.listing_reports
    SET status      = 'reviewed',
        reviewed_by = auth.uid(),
        reviewed_at = NOW()
    WHERE listing_id = v_report.listing_id
      AND status = 'pending';

    RETURN jsonb_build_object('status', 'reviewed', 'listing_removed', TRUE);
  END IF;

  v_status := CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'reviewed' END;

  UPDATE public.listing_reports
  SET status      = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object('status', v_status, 'listing_removed', FALSE);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_get_listing_reports(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_listing_reports(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_review_listing_report(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_listing_report(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
