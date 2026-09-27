-- ============================================================================
-- Bot hesap tespiti ve temizliği
--
-- 2026 Ağustos–Eylül'de kayıt formu otomatik doldurularak sahte hesaplar
-- açıldı. Desen:
--   · isim rastgele büyük/küçük harf dizisi (ör. DbOBQcgpTvGoYsqEE)
--   · Gmail "nokta hilesi" adresi (ör. o.tav.a.c.aga230@gmail.com)
--   · e-posta hiç doğrulanmamış
--   · şehir hep listenin ilk ili (Adana) — bot ilk seçeneği seçiyor
--
-- Bir hesabın "şüpheli" sayılması için HEPSİ gerekir: rastgele isim deseni,
-- doğrulanmamış e-posta ve sitede HİÇBİR hareket olmaması (ilan, teklif,
-- mesaj). Gerçek bir kullanıcı bu üçünü birden pek karşılamaz; yine de
-- silmeden önce 2. adımdaki listeyi gözden geçir.
--
-- Supabase Dashboard → SQL Editor'da adım adım çalıştır.
-- ============================================================================


-- ─── 1. Özet: kaç hesap, kaçı şüpheli ───────────────────────────────────────

WITH aday AS (
  SELECT
    p.id,
    p.name ~ '^[A-Za-z]{12,}$'                                   AS rastgele_isim,
    length(regexp_replace(p.name, '[^A-Z]', '', 'g')) >= 3       AS cok_buyuk_harf,
    NOT COALESCE(p.email_verified, FALSE)                        AS dogrulanmamis,
    NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.owner_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE p.id IN (o.from_user_id, o.to_user_id))
      AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.from_user_id = p.id)
                                                                 AS hareketsiz
  FROM public.profiles p
)
SELECT
  COUNT(*)                                                                   AS toplam_hesap,
  COUNT(*) FILTER (WHERE rastgele_isim AND cok_buyuk_harf AND dogrulanmamis AND hareketsiz) AS supheli,
  COUNT(*) FILTER (WHERE NOT (rastgele_isim AND cok_buyuk_harf AND dogrulanmamis AND hareketsiz)) AS gercek_gorunen
FROM aday;


-- ─── 2. Şüpheli hesapların listesi (silmeden önce incele) ───────────────────

SELECT
  p.created_at::date                                      AS kayit_tarihi,
  p.name,
  p.email,
  length(split_part(p.email, '@', 1))
    - length(replace(split_part(p.email, '@', 1), '.', '')) AS adresteki_nokta,
  p.city
FROM public.profiles p
WHERE p.name ~ '^[A-Za-z]{12,}$'
  AND length(regexp_replace(p.name, '[^A-Z]', '', 'g')) >= 3
  AND NOT COALESCE(p.email_verified, FALSE)
  AND NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.owner_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE p.id IN (o.from_user_id, o.to_user_id))
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.from_user_id = p.id)
ORDER BY p.created_at;


-- ─── 3. Temizlik (GERİ ALINAMAZ) ────────────────────────────────────────────
-- 2. adımdaki listeyi inceledikten ve içinde gerçek kimse olmadığından emin
-- olduktan sonra, aşağıdaki bloğun başındaki ve sonundaki /* */ işaretlerini
-- kaldırıp çalıştır. auth.users'tan silmek profili de otomatik siler.

/*
DELETE FROM auth.users u
USING public.profiles p
WHERE p.id = u.id
  AND p.name ~ '^[A-Za-z]{12,}$'
  AND length(regexp_replace(p.name, '[^A-Z]', '', 'g')) >= 3
  AND NOT COALESCE(p.email_verified, FALSE)
  AND NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.owner_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.offers o WHERE p.id IN (o.from_user_id, o.to_user_id))
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.from_user_id = p.id);
*/
