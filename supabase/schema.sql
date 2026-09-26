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
  rating          NUMERIC(3,2),
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
  moderation_status   TEXT        NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
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

-- Listing verification records are written only by trusted integrations or service_role.
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

-- Shared post-acceptance transaction checklist.
CREATE TABLE IF NOT EXISTS public.swap_process_steps (
  offer_id       UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  step           TEXT NOT NULL CHECK (step IN ('identity', 'expertise', 'agreement', 'secure_payment', 'notary')),
  completed_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (offer_id, step, completed_by)
);

CREATE INDEX IF NOT EXISTS idx_swap_process_offer ON public.swap_process_steps(offer_id);

ALTER TABLE public.swap_process_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Takas tarafları işlem adımlarını görür" ON public.swap_process_steps;
DROP POLICY IF EXISTS "Takas tarafları işlem adımı ekler" ON public.swap_process_steps;
DROP POLICY IF EXISTS "Kullanıcı kendi işlem adımını geri alır" ON public.swap_process_steps;

CREATE POLICY "Takas tarafları işlem adımlarını görür"
  ON public.swap_process_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND (o.from_user_id = auth.uid() OR o.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Takas tarafları işlem adımı ekler"
  ON public.swap_process_steps FOR INSERT
  WITH CHECK (
    completed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id
        AND o.status IN ('Onaylandı', 'Tamamlandı')
        AND (o.from_user_id = auth.uid() OR o.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Kullanıcı kendi işlem adımını geri alır"
  ON public.swap_process_steps FOR DELETE
  USING (completed_by = auth.uid());

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

-- ─── 9. ROL YÜKSELTME KORUMASI ───────────────────────────────────────────────
-- Kullanıcı kendi profilini güncelleyebilir AMA role alanını değiştiremez.
-- Sadece service_role (sunucu tarafı admin) role değiştirebilir.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Rol değiştirme yetkisi yok';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- ─── 10. E-POSTA DOĞRULAMA SYNC ──────────────────────────────────────────────
-- auth.users.email_confirmed_at dolduğunda profiles.email_verified = true yapar

CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles SET email_verified = TRUE WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_email_verified ON auth.users;
CREATE TRIGGER sync_email_verified
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_verified();

-- ─── 11. UPDATED_AT OTOMATİK GÜNCELLEMESİ ───────────────────────────────────

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

-- ─── 12. CANLI MEZAT ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auctions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  starting_price  NUMERIC(14,2) NOT NULL CHECK (starting_price > 0),
  current_bid     NUMERIC(14,2) NOT NULL CHECK (current_bid > 0),
  bid_increment   NUMERIC(14,2) NOT NULL CHECK (bid_increment > 0),
  reserve_price   NUMERIC(14,2),
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'live', 'ended')),
  watcher_count   INTEGER NOT NULL DEFAULT 0 CHECK (watcher_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (current_bid >= starting_price)
);

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note        TEXT CHECK (char_length(note) <= 240),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_auction_per_listing
  ON public.auctions(listing_id)
  WHERE status IN ('scheduled', 'live');

CREATE INDEX IF NOT EXISTS auctions_status_ends_at_idx
  ON public.auctions(status, ends_at);

CREATE INDEX IF NOT EXISTS auction_bids_auction_created_idx
  ON public.auction_bids(auction_id, created_at DESC);

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mezatlar herkese açık" ON public.auctions;
DROP POLICY IF EXISTS "İlan sahibi mezat açabilir" ON public.auctions;
DROP POLICY IF EXISTS "İlan sahibi mezadı güncelleyebilir" ON public.auctions;
DROP POLICY IF EXISTS "İlan sahibi mezadı silebilir" ON public.auctions;
DROP POLICY IF EXISTS "Mezat teklifleri herkese açık" ON public.auction_bids;

CREATE POLICY "Mezatlar herkese açık"
  ON public.auctions FOR SELECT USING (true);

CREATE POLICY "İlan sahibi mezat açabilir"
  ON public.auctions FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_id
        AND listings.owner_id = auth.uid()
        AND listings.is_active = TRUE
    )
  );

CREATE POLICY "İlan sahibi mezadı güncelleyebilir"
  ON public.auctions FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "İlan sahibi mezadı silebilir"
  ON public.auctions FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Mezat teklifleri herkese açık"
  ON public.auction_bids FOR SELECT USING (true);

DROP TRIGGER IF EXISTS set_auctions_updated_at ON public.auctions;
CREATE TRIGGER set_auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
    RAISE EXCEPTION 'Teklif vermek için giriş yapmalısın';
  END IF;

  SELECT *
  INTO locked_auction
  FROM public.auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mezat bulunamadı';
  END IF;

  IF locked_auction.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Kendi mezadına teklif veremezsin';
  END IF;

  IF locked_auction.status = 'ended' OR NOW() >= locked_auction.ends_at THEN
    UPDATE public.auctions SET status = 'ended' WHERE id = p_auction_id;
    RAISE EXCEPTION 'Bu mezat sona erdi';
  END IF;

  IF NOW() < locked_auction.starts_at THEN
    RAISE EXCEPTION 'Bu mezat henüz başlamadı';
  END IF;

  IF p_amount < locked_auction.current_bid + locked_auction.bid_increment THEN
    RAISE EXCEPTION 'Teklif minimum artış tutarının altında';
  END IF;

  INSERT INTO public.auction_bids (auction_id, user_id, amount, note)
  VALUES (p_auction_id, auth.uid(), p_amount, NULLIF(trim(p_note), ''));

  UPDATE public.auctions
  SET current_bid = p_amount, status = 'live'
  WHERE id = p_auction_id;

  SELECT to_jsonb(a) || jsonb_build_object(
    'bids',
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(b) || jsonb_build_object(
          'bidder',
          jsonb_build_object('name', COALESCE(p.name, 'Katılımcı'))
        )
        ORDER BY b.created_at DESC
      )
      FROM public.auction_bids b
      LEFT JOIN public.profiles p ON p.id = b.user_id
      WHERE b.auction_id = a.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.auctions a
  WHERE a.id = p_auction_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.place_auction_bid(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_auction(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Mezat kapatmak için giriş yapmalısın';
  END IF;

  UPDATE public.auctions
  SET status = 'ended'
  WHERE id = p_auction_id
    AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mezat bulunamadı veya kapatma yetkin yok';
  END IF;

  SELECT to_jsonb(a) || jsonb_build_object(
    'bids',
    COALESCE((
      SELECT jsonb_agg(
        to_jsonb(b) || jsonb_build_object(
          'bidder',
          jsonb_build_object('name', COALESCE(p.name, 'Katılımcı'))
        )
        ORDER BY b.created_at DESC
      )
      FROM public.auction_bids b
      LEFT JOIN public.profiles p ON p.id = b.user_id
      WHERE b.auction_id = a.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.auctions a
  WHERE a.id = p_auction_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.close_auction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_auction(UUID) TO authenticated;
REVOKE UPDATE ON public.auctions FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'auctions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'auction_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  END IF;
END;
$$;

-- ─── 13. ADMIN KULLANICI ATAMA ───────────────────────────────────────────────
-- Kayıt olduktan sonra bir kullanıcıyı admin yapmak için:
-- (email adresini değiştir)
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'senin@emailin.com';
--
-- Ya da kullanıcı ID ile:
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'USER_UUID_HERE';

-- ─── 14. DEMO HESAP (opsiyonel) ───────────────────────────────────────────────
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
