import path from 'path';
import { mkdir, appendFile } from 'fs/promises';

interface MailPayload {
  to?: string | null;
  subject: string;
  text: string;
}

export async function sendMail(payload: MailPayload) {
  const logDir = path.resolve(process.cwd(), 'logs');
  await mkdir(logDir, { recursive: true });

  const entry = [
    `--- ${new Date().toISOString()} ---`,
    `to: ${payload.to ?? 'unknown'}`,
    `subject: ${payload.subject}`,
    payload.text,
    '',
  ].join('\n');

  await appendFile(path.join(logDir, 'emails.log'), entry, 'utf8');

  if (process.env.SMTP_HOST) {
    console.log('[mail:stub] SMTP env detected; logged email notification for now.');
  }
}
