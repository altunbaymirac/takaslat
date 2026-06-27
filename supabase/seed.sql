-- ============================================================
-- Takaslat — Lansman Tohum (Seed) Verisi
-- Supabase Dashboard → SQL Editor → yeni sorgu → tümünü çalıştır
--
-- Bu script:
--   1) 4 vitrin hesabı (auth.users) oluşturur
--   2) Profillerini doldurur (isim, şehir, puan, doğrulama)
--   3) ~30 gerçekçi takas ilanı ekler (araç, elektronik, gayrimenkul)
--
-- Idempotent: tekrar çalıştırılırsa ON CONFLICT ile çift kayıt olmaz.
-- Geri almak için en alttaki "SORGU 4 — TEMİZLİK" bloğunu kullan.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SORGU 1 — VİTRİN HESAPLARI (auth.users)
-- pgcrypto crypt() ile şifre hash'lenir, e-posta doğrulanmış sayılır.
-- ════════════════════════════════════════════════════════════
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'vitrin.murat@takaslat.com',  crypt('Vitrin!2026', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Murat Yılmaz"}',  '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'vitrin.ayse@takaslat.com',   crypt('Vitrin!2026', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Ayşe Kaya"}',     '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'vitrin.emre@takaslat.com',   crypt('Vitrin!2026', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Emre Demir"}',    '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'vitrin.zeynep@takaslat.com', crypt('Vitrin!2026', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Zeynep Şahin"}',  '', '', '', '')
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SORGU 2 — VİTRİN PROFİLLERİ (public.profiles)
-- handle_new_user trigger'ı temel profili açar; burada zenginleştiriyoruz.
-- ════════════════════════════════════════════════════════════
INSERT INTO public.profiles (id, name, email, city, avatar, rating, total_swaps, email_verified, phone_verified)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Murat Yılmaz',  'vitrin.murat@takaslat.com',  'İstanbul', 'https://ui-avatars.com/api/?name=Murat+Yilmaz&background=1B4FD8&color=fff&size=128',  4.80, 12, TRUE, TRUE),
  ('a0000000-0000-4000-8000-000000000002', 'Ayşe Kaya',     'vitrin.ayse@takaslat.com',   'Ankara',   'https://ui-avatars.com/api/?name=Ayse+Kaya&background=0F6E56&color=fff&size=128',     4.90, 21, TRUE, TRUE),
  ('a0000000-0000-4000-8000-000000000003', 'Emre Demir',    'vitrin.emre@takaslat.com',   'İzmir',    'https://ui-avatars.com/api/?name=Emre+Demir&background=993C1D&color=fff&size=128',    4.70,  8, TRUE, FALSE),
  ('a0000000-0000-4000-8000-000000000004', 'Zeynep Şahin',  'vitrin.zeynep@takaslat.com', 'Bursa',    'https://ui-avatars.com/api/?name=Zeynep+Sahin&background=534AB7&color=fff&size=128',  5.00, 15, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  city = EXCLUDED.city, avatar = EXCLUDED.avatar, rating = EXCLUDED.rating,
  total_swaps = EXCLUDED.total_swaps, email_verified = EXCLUDED.email_verified,
  phone_verified = EXCLUDED.phone_verified;


-- ════════════════════════════════════════════════════════════
-- SORGU 3 — TOHUM İLANLAR (public.listings)
-- listing_code UNIQUE olduğu için ON CONFLICT ile tekrar eklenmez.
-- ════════════════════════════════════════════════════════════
INSERT INTO public.listings (
  listing_code, owner_id, title, category, estimated_value, description, wanted_for, city,
  images, condition, tags, brand, model, year, km, fuel, transmission, color, has_accident_record, body_type, engine_cc, extra_details
) VALUES

-- ───────────── ARAÇ — OTOMOBİL ─────────────
('TKS-2000001', 'a0000000-0000-4000-8000-000000000001', '2019 BMW 320i xDrive M Sport', 'Araç', 1150000,
 'Bakımı eksiksiz, hasar kayıtsız BMW 320i. M Sport paketi, cam tavan, ısıtmalı koltuk, adaptif cruise. Servis geçmişi yetkili serviste.',
 'SUV veya crossover, max 150k TL fark. Tiguan, Karoq, Sportage olabilir.', 'İstanbul',
 '["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&h=600&fit=crop&q=80","https://images.unsplash.com/photo-1617531653332-bd46c16f4d68?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["M Sport","Cam Tavan","Hasar Kayıtsız"]', 'BMW', '320i xDrive M Sport', 2019, 68000, 'Benzin', 'Otomatik', 'Mineral Gri', FALSE, 'Sedan', 1998, NULL),

('TKS-2000002', 'a0000000-0000-4000-8000-000000000002', '2021 Toyota Corolla 1.8 Hybrid', 'Araç', 1080000,
 'Hibrit teknolojisiyle düşük yakıt. CVT şanzıman, hasar kayıtsız, Toyota güvencesi. Şehir içi için ideal.',
 'Aynı segment sedan veya hafif SUV, 60k TL fark öderim. Civic, Megane olabilir.', 'Ankara',
 '["https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Hibrit","Düşük Yakıt","Hasar Kayıtsız"]', 'Toyota', 'Corolla 1.8 Hybrid', 2021, 42000, 'Hibrit', 'Otomatik', 'İnci Beyazı', FALSE, 'Sedan', 1798, NULL),

('TKS-2000003', 'a0000000-0000-4000-8000-000000000003', '2018 Volkswagen Golf 1.6 TDI Highline', 'Araç', 890000,
 'Dizel ekonomisi, DSG şanzıman. Bakımlı, lastikler yeni. Tek hafif arka tampon boyası var.',
 'Sedan veya station wagon, fark konuşulur. Passat, Octavia ilgimi çeker.', 'İzmir',
 '["https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Dizel","DSG","Ekonomik"]', 'Volkswagen', 'Golf 1.6 TDI Highline', 2018, 95000, 'Dizel', 'Otomatik', 'Gece Siyahı', FALSE, 'Hatchback', 1598, NULL),

('TKS-2000004', 'a0000000-0000-4000-8000-000000000004', '2020 Renault Clio 1.0 TCe Touch', 'Araç', 720000,
 'Düşük kilometre, ilk sahibinden. Benzinli turbo motor, ekonomik. Garaj arabası.',
 'Üstüne nakit ekleyip SUV''a geçmek istiyorum. T-Roc, Captur olur.', 'Bursa',
 '["https://images.unsplash.com/photo-1549924231-f129b911e442?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["İlk Sahip","Düşük KM","Ekonomik"]', 'Renault', 'Clio 1.0 TCe Touch', 2020, 31000, 'Benzin', 'Manuel', 'Beyaz', FALSE, 'Hatchback', 999, NULL),

('TKS-2000005', 'a0000000-0000-4000-8000-000000000001', '2017 Mercedes C200 AMG', 'Araç', 1320000,
 'AMG paket, panoramik tavan, deri döşeme. Komple bakımı yeni yapıldı. Hasar kaydı yok.',
 'Üst segment SUV, fark öderim. GLC, X3, Q5 düşünüyorum.', 'İstanbul',
 '["https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["AMG","Panoramik","Deri Döşeme"]', 'Mercedes', 'C200 AMG', 2017, 88000, 'Benzin', 'Otomatik', 'Obsidyen Siyah', FALSE, 'Sedan', 1991, NULL),

('TKS-2000006', 'a0000000-0000-4000-8000-000000000002', '2022 Fiat Egea 1.4 Fire Urban', 'Araç', 760000,
 'Sıfır ayarında, garanti devam ediyor. Türkiye''nin en çok satan sedanı, yedek parça bol.',
 'Hatchback veya küçük SUV, fark almam. Egea Cross, Kuga olur.', 'Ankara',
 '["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Garantili","Ekonomik","Az KM"]', 'Fiat', 'Egea 1.4 Fire Urban', 2022, 18000, 'Benzin', 'Manuel', 'Gri', FALSE, 'Sedan', 1368, NULL),

('TKS-2000007', 'a0000000-0000-4000-8000-000000000003', '2016 Audi A4 2.0 TDI quattro', 'Araç', 1050000,
 'Quattro çekiş, S-Line jant. Bakımlı, çok temiz. Kış için ideal dört çeker.',
 'SUV veya pickup, fark konuşulur. Amarok, Ranger ilgimi çeker.', 'İzmir',
 '["https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Quattro","S-Line","Dizel"]', 'Audi', 'A4 2.0 TDI quattro', 2016, 142000, 'Dizel', 'Otomatik', 'Lacivert', FALSE, 'Sedan', 1968, NULL),

('TKS-2000008', 'a0000000-0000-4000-8000-000000000004', '2021 Hyundai Tucson 1.6 CRDi', 'Araç', 1450000,
 'Yeni kasa Tucson, dizel hibrit. Geniş iç hacim, aile için ideal SUV. Hasar kaydı yok.',
 'Sedan + nakit fark isterim ya da daha üst SUV. Sportage, Kuga olur.', 'Bursa',
 '["https://images.unsplash.com/photo-1606220838315-056192d5e927?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["SUV","Dizel Hibrit","Geniş"]', 'Hyundai', 'Tucson 1.6 CRDi', 2021, 54000, 'Dizel', 'Otomatik', 'Gümüş', FALSE, 'SUV', 1598, NULL),

('TKS-2000009', 'a0000000-0000-4000-8000-000000000001', '2015 Ford Focus 1.6 TDCi Titanium', 'Araç', 640000,
 'Titanium donanım, dizel. Uzun yol arabası, yakıtı çok ekonomik. Lastikler ve akü yeni.',
 'Daha yeni model hatchback, fark öderim. Astra, i30 olabilir.', 'Antalya',
 '["https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Titanium","Dizel","Ekonomik"]', 'Ford', 'Focus 1.6 TDCi Titanium', 2015, 168000, 'Dizel', 'Manuel', 'Kırmızı', TRUE, 'Hatchback', 1560, NULL),

('TKS-2000010', 'a0000000-0000-4000-8000-000000000002', '2023 Togg T10X V2 RWD Long Range', 'Araç', 1650000,
 'Yerli elektrikli SUV, uzun menzil. Sıfır ayarında, garanti tam. Şarj ekipmanları dahil.',
 'Premium sedan veya SUV, fark konuşulur. Model 3, ID.4 düşünürüm.', 'İstanbul',
 '["https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Elektrikli","Yerli","Uzun Menzil"]', 'Togg', 'T10X V2 RWD Long Range', 2023, 9000, 'Elektrik', 'Otomatik', 'Gece Mavisi', FALSE, 'SUV', NULL, NULL),

-- ───────────── ARAÇ — MOTOSİKLET ─────────────
('TKS-2000011', 'a0000000-0000-4000-8000-000000000003', '2020 Honda PCX 125', 'Araç', 145000,
 'Şehir içi için ideal scooter. Düşük yakıt, kolay park. Bakımları zamanında yapıldı.',
 'Daha büyük motor veya bisiklet + nakit. CB500, Forza olur.', 'İzmir',
 '["https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Scooter","Ekonomik","Şehir İçi"]', 'Honda', 'PCX 125', 2020, 22000, 'Benzin', 'Otomatik', 'Mat Siyah', FALSE, 'Scooter', 125, NULL),

('TKS-2000012', 'a0000000-0000-4000-8000-000000000004', '2019 Yamaha MT-07', 'Araç', 285000,
 'Naked motor, 689cc. Çok keyifli sürüş. Egzoz ve bazı aksesuarlar değişti, faturası var.',
 'Otomobil + üste nakit alırım ya da daha büyük motor. MT-09 olur.', 'Bursa',
 '["https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Naked","689cc","Aksesuarlı"]', 'Yamaha', 'MT-07', 2019, 18500, 'Benzin', 'Manuel', 'Mavi', FALSE, 'Motosiklet', 689, NULL),

-- ───────────── ARAÇ — TİCARİ ─────────────
('TKS-2000013', 'a0000000-0000-4000-8000-000000000001', '2018 Ford Transit 350L Panelvan', 'Araç', 980000,
 'Uzun şasi panelvan, ticari kullanıma hazır. Bakımlı, motor sağlam. Nakliyeci için ideal.',
 'Binek araç + nakit fark ya da pickup. Transit Custom, Ranger olur.', 'Kocaeli',
 '["https://images.unsplash.com/photo-1591768793355-74d04bb6608f?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Panelvan","Ticari","Uzun Şasi"]', 'Ford', 'Transit 350L', 2018, 210000, 'Dizel', 'Manuel', 'Beyaz', TRUE, 'Van/Panelvan', 1995, NULL),

('TKS-2000014', 'a0000000-0000-4000-8000-000000000002', '2020 Fiat Doblo 1.6 Multijet', 'Araç', 560000,
 'Hem ticari hem aile aracı. Geniş bagaj, ekonomik dizel. Tek elden, bakımlı.',
 'Sedan veya hatchback, fark almadan. Egea, Clio olur.', 'Konya',
 '["https://images.unsplash.com/photo-1604671801908-6f0c6a092c05?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Doblo","Geniş","Ekonomik"]', 'Fiat', 'Doblo 1.6 Multijet', 2020, 98000, 'Dizel', 'Manuel', 'Gri', FALSE, 'Van/Panelvan', 1598, NULL),

-- ───────────── ELEKTRONİK ─────────────
('TKS-2000015', 'a0000000-0000-4000-8000-000000000003', 'iPhone 14 Pro 256GB', 'Elektronik', 52000,
 'Kutusunda, faturası mevcut. Batarya sağlığı %91. Ekran ve kasada çizik yok, hep kılıflı kullanıldı.',
 'Android amiral gemisi + nakit fark ya da MacBook. S23 Ultra olur.', 'İstanbul',
 '["https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Telefon","Garanti Bitti","Kutulu"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Telefon","brand":"Apple","model":"iPhone 14 Pro","storage":"256 GB","color":"Uzay Siyahı","batteryHealth":91,"warranty":"Yok","accessories":["Orijinal kutu","Şarj cihazı","Fatura"]}'),

('TKS-2000016', 'a0000000-0000-4000-8000-000000000004', 'MacBook Air M2 13" 512GB', 'Elektronik', 58000,
 'M2 çip, 16GB RAM, 512GB SSD. Çok az kullanıldı, döngü sayısı düşük. AppleCare devam ediyor.',
 'Oyun laptopu + nakit fark ya da iPad Pro + nakit. ROG, Legion olur.', 'Bursa',
 '["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Laptop","M2","AppleCare"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Laptop","brand":"Apple","model":"MacBook Air M2","storage":"512 GB","ram":"16 GB","screenSize":13.6,"os":"macOS","warranty":"Devam ediyor","accessories":["Orijinal kutu","Şarj cihazı"]}'),

('TKS-2000017', 'a0000000-0000-4000-8000-000000000001', 'Samsung Galaxy S23 Ultra 256GB', 'Elektronik', 46000,
 'S Pen dahil, kutulu. Batarya %95. 200MP kamera. Ekran koruyucu ilk günden takılı.',
 'iPhone 14/15 + nakit fark ya da tablet + nakit. iPhone 14 Pro olur.', 'Ankara',
 '["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Telefon","S Pen","Kutulu"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Telefon","brand":"Samsung","model":"Galaxy S23 Ultra","storage":"256 GB","color":"Yeşil","batteryHealth":95,"warranty":"Devam ediyor","accessories":["Orijinal kutu","Şarj cihazı","Kılıf"]}'),

('TKS-2000018', 'a0000000-0000-4000-8000-000000000002', 'PlayStation 5 Slim + 2 Kol', 'Elektronik', 24000,
 'Disk sürümlü PS5 Slim, 2 DualSense kol. 3 oyun hediye. Kutusunda, garantili.',
 'Xbox Series X + nakit ya da gaming monitör + nakit. Xbox olur.', 'İzmir',
 '["https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Konsol","2 Kol","Garantili"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Konsol","brand":"Sony","model":"PlayStation 5 Slim","warranty":"Devam ediyor","accessories":["Orijinal kutu","2 Kol"]}'),

('TKS-2000019', 'a0000000-0000-4000-8000-000000000003', 'iPad Pro 11" M4 256GB', 'Elektronik', 48000,
 'M4 çip, Apple Pencil Pro dahil. Tasarımcılar için ideal. Çok temiz, çiziksiz.',
 'MacBook + nakit fark ya da amiral gemisi telefon + nakit.', 'İstanbul',
 '["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Tablet","M4","Apple Pencil"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Tablet","brand":"Apple","model":"iPad Pro 11 M4","storage":"256 GB","warranty":"Devam ediyor","accessories":["Orijinal kutu","Apple Pencil"]}'),

('TKS-2000020', 'a0000000-0000-4000-8000-000000000004', 'Sony WH-1000XM5 Kulaklık', 'Elektronik', 9500,
 'Sektörün en iyi gürültü engelleme kulaklığı. Kutulu, taşıma çantası dahil. Az kullanıldı.',
 'AirPods Max + nakit ya da Bluetooth hoparlör + nakit.', 'Bursa',
 '["https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Kulaklık","ANC","Kutulu"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Kulaklık","brand":"Sony","model":"WH-1000XM5","warranty":"Yok","accessories":["Orijinal kutu","Taşıma çantası"]}'),

-- ───────────── GAYRİMENKUL ─────────────
('TKS-2000021', 'a0000000-0000-4000-8000-000000000001', 'Kadıköy 2+1 Eşyalı Daire', 'Gayrimenkul', 4200000,
 'Metroya 5 dakika, eşyalı ve hazır. Aidat düşük, asansörlü bina. Yatırımlık veya oturuma uygun.',
 'Araç + üste nakit ya da daha büyük daire + fark. Lüks SUV olur.', 'İstanbul',
 '["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["2+1","Eşyalı","Metroya Yakın"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Daire","netSqm":95,"grossSqm":110,"rooms":"2+1","buildingAge":4,"floor":"3/8","heating":"Doğalgaz Kombi","furnished":true,"balcony":true,"elevator":true,"parking":true,"titleDeed":"Kat Mülkiyetli","monthlyDues":1200}'),

('TKS-2000022', 'a0000000-0000-4000-8000-000000000002', 'Çankaya 3+1 Geniş Daire', 'Gayrimenkul', 5100000,
 'Merkezi konumda, geniş cepheli 3+1. Yerden ısıtma, kapalı otopark. Site içi, güvenlikli.',
 'Daire + araç ya da iki araç + nakit fark. Premium sedan olur.', 'Ankara',
 '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["3+1","Site İçi","Otoparklı"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Daire","netSqm":140,"grossSqm":165,"rooms":"3+1","buildingAge":2,"floor":"5/12","heating":"Yerden Isıtma","furnished":false,"balcony":true,"elevator":true,"parking":true,"titleDeed":"Kat Mülkiyetli","monthlyDues":2000}'),

('TKS-2000023', 'a0000000-0000-4000-8000-000000000003', 'Çeşme Müstakil Yazlık', 'Gayrimenkul', 8500000,
 'Denize 400m, bahçeli müstakil yazlık. 4+1, havuzlu. Yaz sezonu kiralık potansiyeli yüksek.',
 'İstanbul/İzmir merkez daire + fark ya da lüks araç + nakit.', 'İzmir',
 '["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["Villa","Havuzlu","Denize Yakın"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Villa","netSqm":210,"grossSqm":260,"rooms":"4+1","buildingAge":6,"heating":"Klima","furnished":true,"balcony":true,"parking":true,"titleDeed":"Müstakil Tapu"}'),

('TKS-2000024', 'a0000000-0000-4000-8000-000000000004', 'Nilüfer 1+1 Yatırımlık', 'Gayrimenkul', 2300000,
 'Üniversiteye yakın, öğrenci için ideal 1+1. Yeni bina, kiracılı satılık. Net getiri sağlıyor.',
 'Otomobil + nakit fark ya da motosiklet + nakit. Sedan olur.', 'Bursa',
 '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["1+1","Yatırımlık","Kiracılı"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL,
 '{"type":"Daire","netSqm":55,"grossSqm":65,"rooms":"1+1","buildingAge":3,"floor":"2/5","heating":"Doğalgaz Kombi","furnished":false,"balcony":true,"elevator":true,"parking":false,"titleDeed":"Kat Mülkiyetli","monthlyDues":600}'),

-- ───────────── EK ARAÇLAR (çeşitlilik için) ─────────────
('TKS-2000025', 'a0000000-0000-4000-8000-000000000001', '2019 Skoda Octavia 1.6 TDI Elite', 'Araç', 980000,
 'Geniş bagaj, dizel ekonomi. Elite donanım, full. Aile ve uzun yol için ideal.',
 'SUV ya da daha yeni sedan, fark konuşulur. Tiguan, Superb olur.', 'Eskişehir',
 '["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Elite","Dizel","Geniş Bagaj"]', 'Skoda', 'Octavia 1.6 TDI Elite', 2019, 112000, 'Dizel', 'Otomatik', 'Beyaz', FALSE, 'Sedan', 1598, NULL),

('TKS-2000026', 'a0000000-0000-4000-8000-000000000002', '2017 Opel Astra 1.4 T Dynamic', 'Araç', 670000,
 'Turbo benzinli, dolu paket. Bakımlı, lastik ve akü yeni. Aile arabası.',
 'Hatchback + nakit ya da küçük SUV. Mokka, Crossland olur.', 'Adana',
 '["https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Turbo","Dynamic","Bakımlı"]', 'Opel', 'Astra 1.4 T Dynamic', 2017, 124000, 'Benzin', 'Otomatik', 'Gri', FALSE, 'Hatchback', 1399, NULL),

('TKS-2000027', 'a0000000-0000-4000-8000-000000000003', '2022 Dacia Duster 1.5 Blue dCi', 'Araç', 1080000,
 'Dizel SUV, 4x2. Az kilometre, garanti devam ediyor. Arazi ve şehir için pratik.',
 'Sedan + nakit ya da daha üst SUV. Tucson, Kuga ilgimi çeker.', 'Antalya',
 '["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["SUV","Dizel","Garantili"]', 'Dacia', 'Duster 1.5 Blue dCi', 2022, 28000, 'Dizel', 'Manuel', 'Kahve', FALSE, 'SUV', 1461, NULL),

('TKS-2000028', 'a0000000-0000-4000-8000-000000000004', '2016 Volvo XC60 D4 Momentum', 'Araç', 1180000,
 'Güvenliğin simgesi Volvo SUV. Dizel, deri döşeme, full donanım. Bakımları yetkili serviste.',
 'Sedan + nakit fark ya da daha yeni SUV. XC40, GLC olur.', 'İstanbul',
 '["https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["SUV","Dizel","Deri Döşeme"]', 'Volvo', 'XC60 D4 Momentum', 2016, 156000, 'Dizel', 'Otomatik', 'Lacivert', FALSE, 'SUV', 1969, NULL),

('TKS-2000029', 'a0000000-0000-4000-8000-000000000001', '2020 Peugeot 2008 1.2 PureTech GT', 'Araç', 920000,
 'Küçük SUV, kokpit tasarımı çok şık. Benzinli otomatik, ekonomik. İlk sahibinden.',
 'Sedan ya da hatchback + nakit alırım. Megane, Corolla olur.', 'Mersin',
 '["https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=800&h=600&fit=crop&q=80"]',
 'Mükemmel', '["SUV","GT","İlk Sahip"]', 'Peugeot', '2008 1.2 PureTech GT', 2020, 46000, 'Benzin', 'Otomatik', 'Kırmızı', FALSE, 'SUV', 1199, NULL),

('TKS-2000030', 'a0000000-0000-4000-8000-000000000002', '2014 Honda Civic 1.6 i-DTEC Premium', 'Araç', 690000,
 'Efsane Civic, dizel. Premium donanım. Çok bakımlı, motoru sağlam. Uzun yol canavarı.',
 'Daha yeni sedan + nakit ekleyebilirim. Corolla, Megane olur.', 'Samsun',
 '["https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&h=600&fit=crop&q=80"]',
 'İyi', '["Civic","Dizel","Premium"]', 'Honda', 'Civic 1.6 i-DTEC Premium', 2014, 184000, 'Dizel', 'Manuel', 'Beyaz', TRUE, 'Sedan', 1597, NULL)

ON CONFLICT (listing_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SORGU 4 — TEMİZLİK (yalnızca seed verisini geri almak istersen)
-- Üstteki blokları silmez; sadece tohum kayıtları kaldırır.
-- Çalıştırmak için baştaki -- işaretlerini kaldır.
-- ════════════════════════════════════════════════════════════
-- DELETE FROM public.listings WHERE listing_code LIKE 'TKS-2______';
-- DELETE FROM auth.users WHERE id IN (
--   'a0000000-0000-4000-8000-000000000001',
--   'a0000000-0000-4000-8000-000000000002',
--   'a0000000-0000-4000-8000-000000000003',
--   'a0000000-0000-4000-8000-000000000004'
-- );
