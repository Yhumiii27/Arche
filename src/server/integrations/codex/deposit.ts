// Deposit of a document in Codex (CX-03: POST /api/documents, Codex docs/api.md). Arche sends one file with its metadata and
// gets the Codex identifier back; the document is born a draft A.1 that its owner submits to a circuit in Codex. Arche keeps
// no file (N-17): the bytes are relayed and forgotten, only the identifier is stored. Rejouable: the same `sourceRef` with
// the same file answers the document already created (200 `replayed`).
//   CODEX_API_URL           Codex's base URL for server calls; unset → NEXT_PUBLIC_CODEX_URL. Credentials in the URL
//                           (https://user:password@codex…, HTTP authentication of the host) go as Basic authentication.
//   CODEX_DOCUMENTS_TOKEN   bearer token of the deposit endpoint. It uses the Authorization header too, so it cannot be
//                           combined with credentials in the URL: behind HTTP authentication, use the signature instead.
//   CODEX_DOCUMENTS_SECRET  HMAC-SHA256 signature of the raw body (X-Codex-Timestamp, X-Codex-Signature: v1=…).
// Codex demands every proof it has set; Arche sends every proof it has. Neither token nor secret → the deposit is off.
import { createHash, createHmac } from 'node:crypto';

/** The variables read: CODEX_API_URL, NEXT_PUBLIC_CODEX_URL, CODEX_DOCUMENTS_TOKEN, CODEX_DOCUMENTS_SECRET. */
export type CodexDepositEnv = Record<string, string | undefined>;

/** Metadata of a deposit (Codex docs/api.md "Métadonnées"); `sha256` is added by Arche from the file. */
export interface CodexDepositMeta {
  /** `arche:<reference>`, unique: it makes the call replayable. */
  sourceRef: string;
  title: string;
  typeCode: string;
  /** Owner's department code (3 letters). */
  department: string;
  /** Codex identifier or matricule (EMP-…) of the owner. */
  owner: string;
  conf?: string;
  comment?: string;
}

export interface CodexDepositFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export type CodexDepositResult =
  | { ok: true; id: string; replayed: boolean }
  | { ok: false; reason: 'off' | 'misconfigured' | 'refused' | 'invalid' | 'conflict' | 'unavailable'; message: string };

const clean = (v: string | undefined) => v?.trim() || undefined;

/** True when Arche can deposit in Codex (a URL and at least one proof). */
export const codexDepositEnabled = (env: CodexDepositEnv = process.env): boolean =>
  Boolean((clean(env.CODEX_API_URL) ?? clean(env.NEXT_PUBLIC_CODEX_URL)) && (clean(env.CODEX_DOCUMENTS_TOKEN) || clean(env.CODEX_DOCUMENTS_SECRET)));

/** Codex identifier (`USR-…`, any id) or matricule (`EMP-0042`) of the owner, as Codex names the field. */
export function ownerField(owner: string): { ownerId: string } | { ownerMatricule: string } {
  const o = owner.trim();
  return /^EMP-/i.test(o) ? { ownerMatricule: o.toUpperCase() } : { ownerId: o };
}

/** v1=<hex HMAC-SHA256(secret, "<timestamp>." + body)> (Codex src/lib/server-auth.ts). */
export function codexSignature(secret: string, timestamp: number, body: Uint8Array): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`;
}

/** First message of a Codex refusal: `issues[].message`, else the error code. */
function refusalOf(body: unknown, status: number): string {
  const b = (body ?? {}) as { error?: string; reason?: string; issues?: { field?: string; message?: string }[] };
  const issues = (b.issues ?? []).map((i) => (i.field ? `${i.field}: ${i.message ?? ''}` : (i.message ?? ''))).filter(Boolean);
  if (issues.length) return issues.join(' ; ');
  return [b.error, b.reason].filter(Boolean).join(' — ') || `HTTP ${status}`;
}

/** Deposits one document in Codex. Never throws: every failure is a result with a reason. */
export async function depositToCodex({ meta, file, env = process.env, fetchImpl = fetch, now = () => Date.now() }: {
  meta: CodexDepositMeta; file: CodexDepositFile; env?: CodexDepositEnv; fetchImpl?: typeof fetch; now?: () => number;
}): Promise<CodexDepositResult> {
  const base = clean(env.CODEX_API_URL) ?? clean(env.NEXT_PUBLIC_CODEX_URL);
  const token = clean(env.CODEX_DOCUMENTS_TOKEN);
  const secret = clean(env.CODEX_DOCUMENTS_SECRET);
  if (!base || (!token && !secret)) return { ok: false, reason: 'off', message: 'The deposit in Codex is not configured' };
  try {
    const url = new URL('/api/documents', base);
    const headers: Record<string, string> = {};
    if (url.username) {
      if (token) return { ok: false, reason: 'misconfigured', message: 'CODEX_DOCUMENTS_TOKEN cannot go with credentials in the Codex URL: use CODEX_DOCUMENTS_SECRET' };
      headers.authorization = `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}`;
      url.username = '';
      url.password = '';
    } else if (token) headers.authorization = `Bearer ${token}`;
    const { owner, ...rest } = meta;
    const sha256 = createHash('sha256').update(file.bytes).digest('hex');
    const form = new FormData();
    form.set('meta', JSON.stringify({ ...rest, ...ownerField(owner), sha256 }));
    form.set('file', new Blob([file.bytes as BlobPart], { type: file.type || 'application/octet-stream' }), file.name);
    // The signature covers the exact bytes sent: the multipart body is built once, signed, then sent as is.
    const encoded = new Response(form);
    const body = new Uint8Array(await encoded.arrayBuffer());
    headers['content-type'] = encoded.headers.get('content-type')!;
    if (secret) {
      const ts = Math.floor(now() / 1000);
      headers['x-codex-timestamp'] = String(ts);
      headers['x-codex-signature'] = codexSignature(secret, ts, body);
    }
    const res = await fetchImpl(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(60_000) });
    const json = (await res.json().catch(() => null)) as { id?: string; replayed?: boolean } | null;
    if ((res.status === 200 || res.status === 201) && json?.id) return { ok: true, id: json.id, replayed: json.replayed === true };
    if (res.status === 409) return { ok: false, reason: 'conflict', message: `Another file was already deposited in Codex under this reference (${(json as { id?: string } | null)?.id ?? '?'})` };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'refused', message: `Codex refused Arche's credentials (${refusalOf(json, res.status)})` };
    if (res.status === 503 && (json as { error?: string } | null)?.error === 'disabled') return { ok: false, reason: 'off', message: 'The deposit is not open in Codex' };
    if (res.status >= 500 || res.status === 429) return { ok: false, reason: 'unavailable', message: `Codex is unavailable (${refusalOf(json, res.status)})` };
    return { ok: false, reason: 'invalid', message: `Codex refused the deposit: ${refusalOf(json, res.status)}` };
  } catch (e) {
    return { ok: false, reason: 'unavailable', message: `Codex could not be reached (${e instanceof Error ? e.message : String(e)})` };
  }
}
