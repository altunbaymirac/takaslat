// ============================================================
// Takaslat — Bildirim E-postası (Resend)
//
// `notifications` tablosuna satır düştüğünde Supabase Database Webhook bu
// fonksiyonu çağırır; fonksiyon kullanıcının e-posta tercihini kontrol edip
// Resend üzerinden bildirim maili gönderir.
//
// Deploy:  supabase functions deploy notify-email --no-verify-jwt
// Secrets: RESEND_API_KEY, RESEND_FROM, NOTIFY_WEBHOOK_SECRET, SITE_URL
//
// GÜVENLİK: Webhook'u yalnızca Supabase'in çağırabildiğinden emin olmak için
// paylaşılan gizli anahtar başlığı (x-notify-secret) doğrulanır. Fonksiyon
// --no-verify-jwt ile deploy edildiği için bu kontrol zorunludur.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_URL = 'https://api.resend.com/emails';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.takaslat.com';

// E-posta gönderilecek bildirim türleri. 'system' ve 'wishlist' yalnızca
// uygulama içinde kalır; kullanıcıyı mailde boğmanın anlamı yok.
const EMAILABLE = new Set(['offer', 'message', 'status', 'moderation']);

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  email_sent_at: string | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: NotificationRecord;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** HTML'e gömülen kullanıcı metnini kaçır — isim ve mesaj içeriği bize dışarıdan gelir. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ctaLabel(type: string): string {
  switch (type) {
    case 'offer':      return 'Teklifi gör';
    case 'message':    return 'Mesajı aç';
    case 'moderation': return 'İlanı gör';
    default:           return 'Takaslat\'ı aç';
  }
}

function renderEmail(n: NotificationRecord, name: string): string {
  const greeting = name.trim() ? `Merhaba ${escapeHtml(name.trim())},` : 'Merhaba,';
  const link = `${SITE_URL}${n.href.startsWith('/') ? n.href : `/${n.href}`}`;

  return `<!DOCTYPE html>
<html lang="tr">
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:20px 28px;background:#0f214f;">
          <span style="font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Takaslat</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:15px;color:#475569;">${greeting}</p>
          <h1 style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#0f172a;font-weight:700;">${escapeHtml(n.title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(n.body)}</p>
          <a href="${link}" style="display:inline-block;padding:12px 22px;background:#f5b400;color:#0f214f;font-size:15px;font-weight:700;text-decoration:none;border-radius:9px;">${ctaLabel(n.type)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
            Bu e-postayı Takaslat hesabında bir hareket olduğu için aldın.
            Bildirim maillerini <a href="${SITE_URL}/settings" style="color:#1b4fd8;">ayarlar sayfandan</a> kapatabilirsin.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ─── Webhook doğrulaması ───────────────────────────────────────────────
  const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
  if (!expected) {
    console.error('NOTIFY_WEBHOOK_SECRET tanımlı değil');
    return json({ error: 'Not configured' }, 500);
  }
  if (req.headers.get('x-notify-secret') !== expected) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const record = payload.record;
  if (payload.type !== 'INSERT' || !record?.id) {
    return json({ skipped: 'not an insert' });
  }
  if (!EMAILABLE.has(record.type)) {
    return json({ skipped: `type ${record.type}` });
  }
  if (record.email_sent_at) {
    return json({ skipped: 'already sent' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, email, email_notifications')
    .eq('id', record.user_id)
    .single();

  if (profileError) {
    console.error('Profil okunamadı:', profileError.message);
    return json({ error: 'Profile lookup failed' }, 500);
  }
  if (!profile?.email) {
    return json({ skipped: 'no email' });
  }
  if (profile.email_notifications === false) {
    return json({ skipped: 'opted out' });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('RESEND_API_KEY tanımlı değil');
    return json({ error: 'Not configured' }, 500);
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'Takaslat <bildirim@takaslat.com>',
      to: [profile.email],
      subject: `${record.title} · Takaslat`,
      html: renderEmail(record, profile.name ?? ''),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`Resend hatası (${res.status}): ${detail}`);
    return json({ error: 'Send failed', status: res.status }, 502);
  }

  // Aynı bildirim için ikinci mail gitmesin.
  await supabase
    .from('notifications')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', record.id);

  return json({ sent: true });
});
