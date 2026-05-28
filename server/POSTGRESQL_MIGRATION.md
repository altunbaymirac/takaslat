# PostgreSQL'e Geçiş

Takaslat şu an geliştirme için SQLite kullanıyor:

```env
DATABASE_URL="file:./dev.db"
```

Production için PostgreSQL'e geçişte yapılacaklar:

1. `server/prisma/schema.prisma` içinde datasource provider değerini değiştir:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. `.env` dosyasında PostgreSQL bağlantısını tanımla:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/takaslat?schema=public"
```

3. Şemayı uygula:

```bash
npx prisma migrate dev --name init_postgres
npx prisma generate
```

4. Production'da migration:

```bash
npx prisma migrate deploy
```

Notlar:
- SQLite dosyası `server/prisma/dev.db` yalnızca lokal geliştirme içindir.
- Şifreler bcrypt ile hashlenir, düz metin tutulmaz.
- JWT gizli anahtarı production'da güçlü ve ortam değişkeni olarak saklanmalıdır.
- Yüklenen dosyalar şu an `server/uploads` altında tutulur; production'da S3/R2 gibi obje depolamaya taşınmalıdır.
