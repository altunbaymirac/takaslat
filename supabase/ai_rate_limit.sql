-- ============================================================
-- Takaslat — AI Rate Limit Tablosu
-- Supabase Dashboard → SQL Editor → çalıştır
--
-- Edge function her AI çağrısını buraya kaydeder ve kullanıcı/IP
-- başına saatlik + günlük kotayı buradan kontrol eder.
-- Maliyet patlamasını (incir ağacı 🌳) önler.
-- ============================================================

-- ─── SORGU 1 — TABLO ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier  TEXT        NOT NULL,   -- kullanıcı id'si veya 'ip:1.2.3.4'
  action      TEXT,                   -- describe | estimate | risk | ...
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SORGU 2 — İNDEKS (hızlı kota sorgusu) ───────────────────
CREATE INDEX IF NOT EXISTS idx_ai_usage_identifier_time
  ON public.ai_usage (identifier, created_at DESC);

-- ─── SORGU 3 — RLS ───────────────────────────────────────────
-- Tabloya yalnızca edge function (service role) yazar/okur.
-- Normal kullanıcıların erişimi kapalı kalsın.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- ─── SORGU 4 — OTOMATİK TEMİZLİK (opsiyonel) ─────────────────
-- 7 günden eski kayıtları silmek için pg_cron varsa kullanılabilir.
-- Manuel temizlik için istediğinde şunu çalıştır:
-- DELETE FROM public.ai_usage WHERE created_at < NOW() - INTERVAL '7 days';
