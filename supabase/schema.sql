-- ============================================================
-- Takaslat — Supabase Şema
-- Supabase Dashboard → SQL Editor → yeni sorgu → çalıştır
-- ============================================================

-- ─── 1. PROFILES ─────────────────────────────────────────────────────────────
-- auth.users kayıtları otomatik buraya yansır (trigger aşağıda)

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name            TEXT        NOT NULL DEFAULT '',
  email           TEXT        NOT NULL DEFAULT '',
  phone           TEXT,
  city            TEXT,
  avatar          TEXT,
  rating          NUMERIC(3,2) DEFAULT 5.0,
  total_swaps     INTEGER     DEFAULT 0,
  two_factor_enabled BOOLEAN  DEFAULT FALSE,
  role            TEXT        DEFAULT 'user',   -- 'user' | 'admin' | 'moderator'
  email_verified  BOOLEAN     DEFAULT FALSE,
  phone_verified  BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ
);

-- Yeni kullanıcı kaydında otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. LISTINGS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_code        TEXT        UNIQUE,        -- TKS-XXXXXXX
  owner_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  category            TEXT        NOT NULL,      -- 'Araç' | 'Elektronik' | 'Gayrimenkul' | 'Diğer'
  estimated_value     INTEGER     NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  wanted_for          TEXT        NOT NULL DEFAULT '',
  city                TEXT        NOT NULL DEFAULT '',
  images              JSONB       DEFAULT '[]',
  condition           TEXT        NOT NULL DEFAULT 'İyi',
  tags                JSONB       DEFAULT '[]',
  attachments         JSONB       DEFAULT '[]',
  video_url           TEXT,
  view_count          INTEGER     DEFAULT 0,
  is_active           BOOLEAN     DEFAULT TRUE,
  moderation_status   TEXT        DEFAULT 'approved', -- 'pending' | 'approved' | 'rejected'
  rejection_reason    TEXT,
  -- Araç alanları
  brand               TEXT,
  model               TEXT,
  year                INTEGER,
  km                  INTEGER,
  fuel                TEXT,
  transmission        TEXT,
  color               TEXT,
  has_accident_record BOOLEAN     DEFAULT FALSE,
  body_type           TEXT,
  engine_cc           INTEGER,
  -- Elektronik / Gayrimenkul (JSON)
  extra_details       JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_owner      ON public.listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_category   ON public.listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_city       ON public.listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_active     ON public.listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listings_code       ON public.listings(listing_code);
CREATE INDEX IF NOT EXISTS idx_listings_brand      ON public.listings(brand);
CREATE INDEX IF NOT EXISTS idx_listings_value      ON public.listings(estimated_value);

-- ─── 3. OFFERS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.offers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            UUID        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  from_user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message               TEXT        NOT NULL DEFAULT '',
  status                TEXT        NOT NULL DEFAULT 'Beklemede',
  offered_value         INTEGER,
  offered_listing_id    UUID        REFERENCES public.listings(id) ON DELETE SET NULL,
  offered_listing_title TEXT,
  counter_message       TEXT,
  meeting_note          TEXT,
  from_confirmed        BOOLEAN     DEFAULT FALSE,
  to_confirmed          BOOLEAN     DEFAULT FALSE,
  from_rated            BOOLEAN     DEFAULT FALSE,
  to_rated              BOOLEAN     DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_listing   ON public.offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_from_user ON public.offers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_offers_to_user   ON public.offers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_offers_status    ON public.offers(status);

-- ─── 4. MESSAGES ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     UUID        NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  from_user_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_offer ON public.messages(offer_id);

-- ─── 5. NOTIFICATIONS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  href       TEXT        NOT NULL DEFAULT '/',
  read       BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

-- ─── 6. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Önce varsa sil (idempotent — defalarca çalıştırılabilir)
DROP POLICY IF EXISTS "Profiller herkese açık"                  ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcı kendi profilini günceller"     ON public.profiles;

DROP POLICY IF EXISTS "Aktif ilanlar herkese açık"              ON public.listings;
DROP POLICY IF EXISTS "Sahip tüm ilanlarını görebilir"          ON public.listings;
DROP POLICY IF EXISTS "Giriş yapmış ilan ekleyebilir"           ON public.listings;
DROP POLICY IF EXISTS "Sahip ilanı güncelleyebilir"             ON public.listings;
DROP POLICY IF EXISTS "Sahip ilanı silebilir"                   ON public.listings;

DROP POLICY IF EXISTS "Taraflar teklifi görebilir"              ON public.offers;
DROP POLICY IF EXISTS "Giriş yapmış teklif oluşturabilir"       ON public.offers;
DROP POLICY IF EXISTS "Taraflar teklifi güncelleyebilir"        ON public.offers;

DROP POLICY IF EXISTS "Taraflar mesajları görebilir"            ON public.messages;
DROP POLICY IF EXISTS "Taraflar mesaj gönderebilir"             ON public.messages;

DROP POLICY IF EXISTS "Kullanıcı kendi bildirimlerini görür"    ON public.notifications;
DROP POLICY IF EXISTS "Sistem bildirim ekleyebilir"             ON public.notifications;
DROP POLICY IF EXISTS "Kullanıcı bildirimlerini güncelleyebilir" ON public.notifications;

-- Profiles
CREATE POLICY "Profiller herkese açık"              ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Kullanıcı kendi profilini günceller" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Listings
CREATE POLICY "Aktif ilanlar herkese açık"     ON public.listings FOR SELECT USING (is_active = true);
CREATE POLICY "Sahip tüm ilanlarını görebilir" ON public.listings FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Giriş yapmış ilan ekleyebilir"  ON public.listings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Sahip ilanı güncelleyebilir"    ON public.listings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Sahip ilanı silebilir"          ON public.listings FOR DELETE USING (auth.uid() = owner_id);

-- Offers
CREATE POLICY "Taraflar teklifi görebilir"        ON public.offers FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Giriş yapmış teklif oluşturabilir" ON public.offers FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Taraflar teklifi güncelleyebilir"  ON public.offers FOR UPDATE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Messages
CREATE POLICY "Taraflar mesajları görebilir" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND (o.from_user_id = auth.uid() OR o.to_user_id = auth.uid())));
CREATE POLICY "Taraflar mesaj gönderebilir"  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND (o.from_user_id = auth.uid() OR o.to_user_id = auth.uid())));

-- Notifications
CREATE POLICY "Kullanıcı kendi bildirimlerini görür"    ON public.notifications FOR SELECT USING (auth.uid() = user_id);
-- Bildirimler ideal olarak DB trigger'larla oluşturulmalı.
-- Şimdilik sadece kimlik doğrulanmış kullanıcılar insert yapabilir
-- ve yalnızca kendi user_id'lerine bildirim ekleyebilirler.
CREATE POLICY "Sistem bildirim ekleyebilir"             ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kullanıcı bildirimlerini güncelleyebilir" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ─── 7. REALTIME ─────────────────────────────────────────────────────────────
-- Dashboard → Database → Replication → Tablolar altına ekle:
-- notifications, messages, offers

-- SQL ile de açılabilir (publication zaten varsa):
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;

-- ─── 8. STORAGE BUCKET ───────────────────────────────────────────────────────
-- Dashboard → Storage → New bucket → "images" → Public: ON
-- Aşağıdaki politikalar otomatik oluşur, ama elle de eklenebilir:

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Herkes görselleri okuyabilir"                ON storage.objects;
DROP POLICY IF EXISTS "Giriş yapmış kullanıcı görsel yükleyebilir" ON storage.objects;
DROP POLICY IF EXISTS "Sahip görseli silebilir"                     ON storage.objects;

CREATE POLICY "Herkes görselleri okuyabilir"
  ON storage.objects FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Giriş yapmış kullanıcı görsel yükleyebilir"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Sahip görseli silebilir"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 9. UPDATED_AT OTOMATİK GÜNCELLEMESİ ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_listings_updated_at ON public.listings;
CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_offers_updated_at ON public.offers;
CREATE TRIGGER set_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 10. ADMIN KULLANICI ATAMA ───────────────────────────────────────────────
-- Kayıt olduktan sonra bir kullanıcıyı admin yapmak için:
-- (email adresini değiştir)
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'senin@emailin.com';
--
-- Ya da kullanıcı ID ile:
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'USER_UUID_HERE';

-- ─── 11. DEMO HESAP (opsiyonel) ───────────────────────────────────────────────
-- Supabase Dashboard → Authentication → Users → Invite user:
--   Email: demo@takaslat.com
--   Password: demo1234
-- Sonra bu SQL ile profil güncelle:
--
-- UPDATE public.profiles
-- SET name = 'Demo Kullanıcı', city = 'İstanbul'
-- WHERE email = 'demo@takaslat.com';

-- ─── TAMAMLANDI ──────────────────────────────────────────────────────────────
-- Tabloları kontrol etmek için:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
