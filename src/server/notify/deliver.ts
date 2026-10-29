import 'server-only';
// Sending the e-mail outbox (AR-041) with the transport of ARCHE_MAIL_TRANSPORT: `none` holds the messages (they stay readable
// in Administration › Connectors and in "My approvals"); `file` writes each one as an .eml file in ARCHE_MAIL_DIR. SMTP or
// Microsoft Graph wait on the owner's choice (N-35). A message that fails 5 times is marked failed.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { emailOutbox } from '@/server/db/schema';
import type { DB } from '@/server/db/types';

export interface MailSettings {
  transport: 'none' | 'file';
  dir: string | null;
  from: string;
}

const MAX_ATTEMPTS = 5;

/** RFC 2047 encoded-word for a header with non-ASCII characters. */
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

/** The message as an .eml file (UTF-8 text body, base64). */
export function emlOf(m: { from: string; to: string; subject: string; body: string; date: Date; id: string }): string {
  const b64 = Buffer.from(m.body, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${m.from}`, `To: ${m.to}`, `Subject: ${header(m.subject)}`, `Date: ${m.date.toUTCString()}`, `Message-ID: <${m.id}@arche>`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64, '',
  ].join('\r\n');
}

/** Sends the pending messages (oldest first, 200 at a time). */
export async function deliverEmails(db: DB, mail: MailSettings, now: Date): Promise<{ sent: number; held: number; failed: number }> {
  const pending = await db.select().from(emailOutbox).where(eq(emailOutbox.status, 'pending')).orderBy(asc(emailOutbox.createdAt)).limit(200);
  const r = { sent: 0, held: 0, failed: 0 };
  for (const m of pending) {
    if (mail.transport === 'none') {
      await db.update(emailOutbox).set({ status: 'held' }).where(eq(emailOutbox.id, m.id));
      r.held++;
      continue;
    }
    try {
      await mkdir(mail.dir!, { recursive: true });
      await writeFile(path.join(mail.dir!, `${now.toISOString().replace(/[:.]/g, '-')}-${m.id}.eml`), emlOf({ from: mail.from, to: m.toEmail, subject: m.subject, body: m.body, date: now, id: m.id }));
      await db.update(emailOutbox).set({ status: 'sent', sentAt: now, attempts: m.attempts + 1, lastError: null }).where(eq(emailOutbox.id, m.id));
      r.sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await db.update(emailOutbox).set({ attempts, lastError: String((e as Error).message).slice(0, 500), status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending' }).where(eq(emailOutbox.id, m.id));
      if (attempts >= MAX_ATTEMPTS) r.failed++;
    }
  }
  return r;
}
