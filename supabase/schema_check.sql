-- ============================================================================
-- Şema denetimi — prod veritabanı koda ayak uyduruyor mu?
--
-- Migration'lar elle (Dashboard → SQL Editor) uygulandığı için prod şeması
-- depodaki dosyalardan geride kalabiliyor; bir dosyanın yarısının çalışıp
-- yarısının çalışmadığı da görüldü (2026-09'da listing_reports,
-- listing_questions ve listing_verifications hiç oluşmamışken aynı
-- dosyalardaki fonksiyonlar prod'da mevcuttu).
--
-- Bu dosya frontend'in kullandığı HER tabloyu, sütunu, RPC'yi ve bildirim
-- trigger'ını kontrol eder. Sadece EKSİK olanları listeler.
--
-- Kullanım: Supabase Dashboard → SQL Editor → çalıştır.
--   Sonuç boşsa  → şema kodla uyumlu, sorun yok.
--   Satır varsa  → o nesneyi getiren migration'ı uygula.
--
-- Yeni tablo/RPC eklendiğinde aşağıdaki listelere de eklemeyi unutma.
-- ============================================================================

WITH beklenen_tablo(ad) AS (VALUES
  ('auctions'), ('auction_bids'), ('auction_requests'),
  ('listings'), ('listing_questions'), ('listing_reports'), ('listing_verifications'),
  ('messages'), ('notifications'), ('offers'), ('profiles'), ('swap_ratings')
),

beklenen_fonksiyon(ad) AS (VALUES
  -- teklif akışı
  ('create_offer'), ('accept_offer'), ('revise_offer'), ('update_offer_status'),
  ('confirm_offer_complete'), ('rate_offer'), ('send_offer_message'),
  -- ilan
  ('increment_listing_view'), ('create_listing_report'),
  ('create_listing_question'), ('answer_listing_question'), ('delete_listing_question'),
  -- mezat
  ('place_auction_bid'), ('finalize_auction'), ('finalize_expired_auctions'),
  -- bildirim
  ('mark_notifications_read'), ('notify_user'),
  -- yönetim
  ('is_platform_admin'), ('admin_get_stats'), ('admin_get_users'), ('admin_get_listings'),
  ('admin_moderate_listing'), ('admin_set_user_role'), ('admin_ban_user'),
  ('admin_get_auction_requests'), ('admin_review_auction_request'),
  ('admin_get_listing_reports'), ('admin_review_listing_report')
),

beklenen_sutun(tablo, sutun) AS (VALUES
  ('profiles', 'id'), ('profiles', 'name'), ('profiles', 'email'), ('profiles', 'city'),
  ('profiles', 'avatar'), ('profiles', 'rating'), ('profiles', 'total_swaps'),
  ('profiles', 'role'), ('profiles', 'email_verified'), ('profiles', 'phone_verified'),
  ('profiles', 'email_notifications'), ('profiles', 'created_at'),

  ('listings', 'id'), ('listings', 'owner_id'), ('listings', 'title'), ('listings', 'category'),
  ('listings', 'estimated_value'), ('listings', 'wanted_for'), ('listings', 'city'),
  ('listings', 'images'), ('listings', 'condition'), ('listings', 'tags'),
  ('listings', 'attachments'), ('listings', 'video_url'), ('listings', 'view_count'),
  ('listings', 'is_active'), ('listings', 'moderation_status'), ('listings', 'rejection_reason'),
  ('listings', 'listing_code'), ('listings', 'brand'), ('listings', 'model'), ('listings', 'year'),
  ('listings', 'km'), ('listings', 'fuel'), ('listings', 'transmission'), ('listings', 'color'),
  ('listings', 'has_accident_record'), ('listings', 'body_type'), ('listings', 'engine_cc'),
  ('listings', 'extra_details'),

  ('offers', 'listing_id'), ('offers', 'from_user_id'), ('offers', 'to_user_id'),
  ('offers', 'message'), ('offers', 'status'), ('offers', 'offered_value'),
  ('offers', 'offered_listing_id'), ('offers', 'offered_listing_title'),
  ('offers', 'counter_message'), ('offers', 'meeting_note'),
  ('offers', 'from_confirmed'), ('offers', 'to_confirmed'),
  ('offers', 'from_rated'), ('offers', 'to_rated'),
  ('offers', 'from_accepted'), ('offers', 'to_accepted'),

  ('messages', 'offer_id'), ('messages', 'from_user_id'), ('messages', 'text'),

  ('notifications', 'user_id'), ('notifications', 'type'), ('notifications', 'title'),
  ('notifications', 'body'), ('notifications', 'href'), ('notifications', 'read'),
  ('notifications', 'email_sent_at'),

  ('auctions', 'listing_id'), ('auctions', 'owner_id'), ('auctions', 'title'),
  ('auctions', 'starts_at'), ('auctions', 'ends_at'), ('auctions', 'starting_price'),
  ('auctions', 'current_bid'), ('auctions', 'bid_increment'), ('auctions', 'reserve_price'),
  ('auctions', 'status'), ('auctions', 'watcher_count'),

  ('auction_bids', 'auction_id'), ('auction_bids', 'user_id'),
  ('auction_bids', 'amount'), ('auction_bids', 'note'),

  ('auction_requests', 'listing_id'), ('auction_requests', 'owner_id'),
  ('auction_requests', 'expected_price'), ('auction_requests', 'note'),
  ('auction_requests', 'status'), ('auction_requests', 'review_note'),
  ('auction_requests', 'reviewed_by'), ('auction_requests', 'reviewed_at'),
  ('auction_requests', 'auction_id'),

  ('listing_questions', 'listing_id'), ('listing_questions', 'user_id'),
  ('listing_questions', 'question'), ('listing_questions', 'answer'),
  ('listing_questions', 'answered_at'),

  ('listing_reports', 'listing_id'), ('listing_reports', 'reporter_id'),
  ('listing_reports', 'reason'), ('listing_reports', 'details'),
  ('listing_reports', 'status'), ('listing_reports', 'reviewed_at'),
  ('listing_reports', 'reviewed_by'),

  ('listing_verifications', 'listing_id'), ('listing_verifications', 'identity_state'),
  ('listing_verifications', 'ownership_state'), ('listing_verifications', 'vin_state'),
  ('listing_verifications', 'mileage_state'), ('listing_verifications', 'damage_state'),
  ('listing_verifications', 'expertise_state'), ('listing_verifications', 'source_refs')
),

-- Bildirim çanı realtime'a dayanır: tablo supabase_realtime yayınında
-- değilse trigger satırı yazar ama çan anlık güncellenmez.
beklenen_realtime(ad) AS (VALUES
  ('notifications'), ('messages'), ('offers')
),

-- Görsel ve özel belge yüklemeleri bu bucket'lara yazar.
beklenen_bucket(ad) AS (VALUES
  ('images'), ('documents')
),

beklenen_trigger(ad, tablo) AS (VALUES
  -- Sistem alanlarını (moderation_status, view_count) ilan sahibinin elle
  -- değiştirmesini engeller. Yoksa sahip kendi ilanını onaylı yapabilir.
  ('protect_listing_system_fields', 'listings'),
  ('notify_offer_created',      'offers'),
  ('notify_offer_status',       'offers'),
  ('notify_message',            'messages'),
  ('notify_auction_bid',        'auction_bids'),
  ('notify_listing_moderation', 'listings'),
  ('notify_auction_request',    'auction_requests')
)

SELECT 'TABLO EKSİK' AS sorun, ad AS nesne, '' AS ayrinti
FROM beklenen_tablo
WHERE to_regclass('public.' || ad) IS NULL

UNION ALL

SELECT 'FONKSİYON EKSİK', ad, ''
FROM beklenen_fonksiyon
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = beklenen_fonksiyon.ad
)

UNION ALL

-- Tablosu hiç yoksa sütununu ayrıca raporlamıyoruz; gürültü olur.
SELECT 'SÜTUN EKSİK', tablo || '.' || sutun, ''
FROM beklenen_sutun
WHERE to_regclass('public.' || tablo) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = beklenen_sutun.tablo
      AND c.column_name = beklenen_sutun.sutun
  )

UNION ALL

SELECT 'TRIGGER EKSİK', ad, tablo || ' üzerinde'
FROM beklenen_trigger
WHERE to_regclass('public.' || tablo) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = beklenen_trigger.tablo
      AND t.tgname = beklenen_trigger.ad
      AND NOT t.tgisinternal
  )

UNION ALL

SELECT 'REALTIME KAPALI', ad, 'supabase_realtime yayınında değil'
FROM beklenen_realtime
WHERE to_regclass('public.' || ad) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables pt
    WHERE pt.pubname = 'supabase_realtime'
      AND pt.schemaname = 'public'
      AND pt.tablename = beklenen_realtime.ad
  )

UNION ALL

-- İlanların herkese açık SELECT politikası onay durumunu da şart koşmalı;
-- koşmazsa onay bekleyen ilanlar anında yayında olur.
SELECT 'MODERASYON KAPISI AÇIK',
       'listings SELECT politikası',
       'onay bekleyen ilanlar herkese görünür'
WHERE to_regclass('public.listings') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'listings' AND cmd = 'SELECT'
      AND qual LIKE '%moderation_status%'
  )

UNION ALL

SELECT 'STORAGE BUCKET EKSİK', ad, ''
FROM beklenen_bucket
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = beklenen_bucket.ad)

ORDER BY 1, 2;
