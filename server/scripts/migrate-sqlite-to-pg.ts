/**
 * SQLite → PostgreSQL tek seferlik veri migration scripti
 *
 * Kullanım:
 *   1. server/.env → DATABASE_URL'yi SQLite'a çevirin:
 *      DATABASE_URL="file:./prisma/dev.db"
 *   2. npx ts-node scripts/migrate-sqlite-to-pg.ts
 *
 * Script otomatik olarak:
 *   - SQLite'tan tüm tabloları okur
 *   - PG bağlantısını açar
 *   - Kayıtları upsert ile PG'ye yazar
 */

import { PrismaClient as SqliteClient } from '@prisma/client';
import { PrismaClient as PgClient }     from '@prisma/client';

// SQLite istemcisi — ayrı bir env ile başlatılır
const sqlite = new SqliteClient({
  datasourceUrl: 'file:./prisma/dev.db',
});

// PostgreSQL istemcisi — .env'deki DATABASE_URL'yi kullanır
const pg = new PgClient();

async function main() {
  console.log('🔄  SQLite → PostgreSQL migration başlıyor...\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  const users = await sqlite.user.findMany();
  console.log(`👤  ${users.length} kullanıcı aktarılıyor...`);
  for (const u of users) {
    await pg.user.upsert({ where: { id: u.id }, update: u, create: u });
  }

  // ── Listings ───────────────────────────────────────────────────────────────
  const listings = await sqlite.listing.findMany();
  console.log(`📋  ${listings.length} ilan aktarılıyor...`);
  for (const l of listings) {
    await pg.listing.upsert({ where: { id: l.id }, update: l, create: l });
  }

  // ── Offers ─────────────────────────────────────────────────────────────────
  const offers = await sqlite.offer.findMany();
  console.log(`🤝  ${offers.length} teklif aktarılıyor...`);
  for (const o of offers) {
    await pg.offer.upsert({ where: { id: o.id }, update: o, create: o });
  }

  // ── Messages ───────────────────────────────────────────────────────────────
  const messages = await sqlite.message.findMany();
  console.log(`💬  ${messages.length} mesaj aktarılıyor...`);
  for (const m of messages) {
    await pg.message.upsert({ where: { id: m.id }, update: m, create: m });
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifications = await sqlite.notification.findMany();
  console.log(`🔔  ${notifications.length} bildirim aktarılıyor...`);
  for (const n of notifications) {
    await pg.notification.upsert({ where: { id: n.id }, update: n, create: n });
  }

  console.log('\n✅  Migration tamamlandı!');
}

main()
  .catch((e) => { console.error('❌ Migration hatası:', e); process.exit(1); })
  .finally(async () => { await sqlite.$disconnect(); await pg.$disconnect(); });
