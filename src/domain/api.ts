// The business API and webhooks (AR-048, docs/API.md), pure rules: the key of a client (shown once, only its SHA-256 kept),
// the HMAC signature of a write request and of a webhook delivery (Codex's convention: "<timestamp>.<body>", hex, "v1="), the
// signature window, the events, the retry schedule of a delivery, a webhook URL and the scope of a client.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { WEBHOOK_EVENTS, type WebhookEvent } from './api-events';

/** "arche_<8 characters>_<43 characters>": the prefix tells the keys apart, the rest is the secret (256 bits). */
export function newApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = randomBytes(6).toString('base64url');
  const key = `arche_${prefix}_${randomBytes(32).toString('base64url')}`;
  return { key, prefix: `arche_${prefix}`, hash: hashKey(key) };
}

export const hashKey = (key: string) => createHash('sha256').update(key, 'utf8').digest('hex');

/** The key of an `Authorization: Bearer …` header, when it has the shape of an Arche key. */
export function bearerKey(header: string | null): string | null {
  const m = /^Bearer\s+(arche_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43})\s*$/.exec(header ?? '');
  return m ? m[1] : null;
}

export const newWebhookSecret = () => `whsec_${randomBytes(32).toString('base64url')}`;

/** Seconds a signed request stays valid on either side of its timestamp. */
export const SIGNATURE_WINDOW_S = 300;

/** "v1=<hex HMAC-SHA256(secret, "<timestamp>.<body>")>". */
export function signature(secret: string, timestamp: number, body: string | Uint8Array): string {
  const h = createHmac('sha256', secret);
  h.update(`${timestamp}.`);
  h.update(body);
  return `v1=${h.digest('hex')}`;
}

export type SignatureCheck = { ok: true; value: string } | { ok: false; reason: 'signature_missing' | 'signature_invalid' | 'signature_expired' };

/** Checks the signature headers of a write request signed with the client's key; the value is the signature (anti-replay). */
export function checkSignature(key: string, tsHeader: string | null, sigHeader: string | null, body: string, nowS: number): SignatureCheck {
  if (!tsHeader || !sigHeader) return { ok: false, reason: 'signature_missing' };
  if (!/^\d{9,11}$/.test(tsHeader)) return { ok: false, reason: 'signature_invalid' };
  const ts = Number(tsHeader);
  if (Math.abs(nowS - ts) > SIGNATURE_WINDOW_S) return { ok: false, reason: 'signature_expired' };
  const expected = Buffer.from(signature(key, ts, body));
  const sent = sigHeader.split(',').map((x) => x.trim()).slice(0, 4);
  const match = sent.find((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), expected));
  return match ? { ok: true, value: match } : { ok: false, reason: 'signature_invalid' };
}

export { isWebhookEvent, WEBHOOK_EVENTS, type WebhookEvent } from './api-events';

/** Minutes before the next attempt after `attempts` failures (1, 5, 15, 60 min, then every 4 h); none after 8 attempts. */
export function nextAttemptIn(attempts: number): number | null {
  if (attempts >= 8) return null;
  return [1, 5, 15, 60, 240, 240, 240, 240][attempts - 1] ?? 1;
}

/** A webhook URL: HTTPS, or HTTP on this machine (development); no credentials in it. */
export function checkWebhookUrl(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'Enter the address of the webhook (https://…)' };
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return { ok: false, error: 'A webhook address uses HTTPS' };
  if (u.username || u.password) return { ok: false, error: 'No credentials in the address: the deliveries are signed' };
  return { ok: true, value: u.toString() };
}

/** A client's scope: the CAPEX of its subsidiaries (every subsidiary when the list is empty). Drafts are never served. */
export const inClientScope = (subsidiaries: readonly string[], c: { subsidiaryCode: string; status: string }) =>
  c.status !== 'draft' && (!subsidiaries.length || subsidiaries.includes(c.subsidiaryCode));

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A new API client: a unique name, read or read and write, a subsidiary scope (none ticked = the whole group). */
export function checkApiClient(raw: Record<string, unknown>, ctx: { subsidiaries: ReadonlySet<string>; takenNames: ReadonlySet<string> }): Check<{ name: string; canWrite: boolean; subsidiaries: string[] }> {
  const name = text(raw.name);
  if (name.length < 3 || name.length > 80) return { ok: false, error: 'Name the application (3 to 80 characters)' };
  if ([...ctx.takenNames].some((n) => n.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'This name is already used' };
  const subs = [...new Set(Object.keys(raw).filter((k) => k.startsWith('sub:') && raw[k] === 'on').map((k) => k.slice(4)))].sort();
  if (subs.some((s) => !ctx.subsidiaries.has(s))) return { ok: false, error: 'Unknown subsidiary' };
  return { ok: true, value: { name, canWrite: raw.canWrite === 'on', subsidiaries: subs } };
}

/** A webhook subscription: an active client, an HTTPS address and at least one event. */
export function checkWebhook(raw: Record<string, unknown>, ctx: { clients: ReadonlySet<string> }): Check<{ clientId: string; url: string; events: WebhookEvent[] }> {
  const clientId = text(raw.clientId);
  if (!ctx.clients.has(clientId)) return { ok: false, error: 'Choose the application' };
  const u = checkWebhookUrl(text(raw.url));
  if (!u.ok) return u;
  const events = WEBHOOK_EVENTS.filter((e) => raw[`event:${e}`] === 'on');
  if (!events.length) return { ok: false, error: 'Choose at least one event' };
  return { ok: true, value: { clientId, url: u.value, events } };
}
