// Deposit of a document in Codex (CX-03: POST /api/documents, Codex docs/api.md). Arche sends one file with its metadata and
// gets the Codex identifier back; the document is born a draft A.1 that its owner submits to a circuit in Codex. Arche keeps
// no file (N-17): the bytes are relayed and forgotten, only the identifier is stored. Rejouable: the same `sourceRef` with
// the same file answers the document already created (200 `replayed`).
//   CODEX_API_URL           Codex's base URL for server calls; unset → NEXT_PUBLIC_CODEX_URL. Credentials in the URL
//                           (https://user:password@codex…, HTTP authentication of the host) go as Basic authentication.
//   CODEX_DOCUMENTS_TOKEN   bearer token of the deposit endpoint. It uses the Authorization header too, so it cannot be
//                           combined with credentials in the URL: behind HTTP authentication, use the signature instead.
//   CODEX_DOCUMENTS_SECRET  HMAC-SHA256 signature of the raw body (X-Codex-Timestamp, X-Codex-Signature: v1=…).
//   CODEX_CAPEX             "on" once Codex accepts the CAPEX attachment (`attachment: "capex"`, `capexCode`, CX-01) and the
//                           legal hold of a deposit (`legalHold: true`, CX-07): the fields are sent only then, Codex refusing
//                           unknown fields; off, a deposit goes to the owner's department context as a draft.
// Codex demands every proof it has set; Arche sends every proof it has. Neither token nor secret → the deposit is off.
// Codex refuses at start-up a token or a secret shorter than 32 characters: Arche's configuration checks the same.
import { createHash, createHmac, randomUUID } from 'node:crypto';

/** The variables read: CODEX_API_URL, NEXT_PUBLIC_CODEX_URL, CODEX_DOCUMENTS_TOKEN, CODEX_DOCUMENTS_SECRET, CODEX_CAPEX. */
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
  /** Sub-type of the registry (CX-02). */
  subtype?: string | null;
  /** The CAPEX the document belongs to (CX-01), sent with CODEX_CAPEX=on. */
  capexCode?: string;
  /** A milestone dossier stays as deposited: legal hold (CX-07), sent with CODEX_CAPEX=on. */
  legalHold?: boolean;
}

/** True when Codex accepts the CAPEX attachment and the legal hold (CX-01, CX-07). */
export const codexCapexEnabled = (env: CodexDepositEnv = process.env): boolean => clean(env.CODEX_CAPEX) === 'on';

/** The `meta` sent to Codex: optional fields left out when empty, the CAPEX ones only when Codex accepts them. */
export function depositMetaOf(meta: CodexDepositMeta, sha256: string, env: CodexDepositEnv = process.env): Record<string, unknown> {
  const { owner, subtype, capexCode, legalHold, ...rest } = meta;
  const capex = codexCapexEnabled(env);
  return {
    ...rest, ...ownerField(owner), sha256,
    ...(subtype ? { subtype } : {}),
    ...(capex && capexCode ? { attachment: 'capex', capexCode } : {}),
    ...(capex && legalHold ? { legalHold: true } : {}),
  };
}

export interface CodexDepositFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export type CodexDepositResult =
  | { ok: true; id: string; replayed: boolean }
  | {
    ok: false;
    reason: 'off' | 'misconfigured' | 'refused' | 'invalid' | 'conflict' | 'unavailable';
    message: string;
    /** 409 `source_ref_reused`: the document Codex already holds under this `sourceRef` (another file). */
    id?: string;
  };

/** Attempts of one deposit: the first and two more on a transient failure (network, 429, 502–504). */
export const DEPOSIT_ATTEMPTS = 3;
/** Longest wait between two attempts, in seconds: a longer `Retry-After` is not waited for, the failure comes back. */
export const DEPOSIT_MAX_WAIT_S = 5;

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

type CodexBody = {
  id?: string; replayed?: boolean; error?: string; reason?: string; requestId?: string; maxBytes?: number; ext?: string; threat?: string;
  retryAfter?: number; issues?: { field?: string; code?: string; message?: string }[];
} | null;

/** First message of a Codex refusal: `issues[].message`, else the error code. */
function refusalOf(body: CodexBody, status: number): string {
  const b = body ?? {};
  const issues = (b.issues ?? []).map((i) => (i.field ? `${i.field}: ${i.message ?? ''}` : (i.message ?? ''))).filter(Boolean);
  if (issues.length) return issues.join(' ; ');
  return [b.error, b.reason].filter(Boolean).join(' — ') || `HTTP ${status}`;
}

/** Seconds Codex asks to wait (`Retry-After` header, else `retryAfter` of the body), null when it says nothing. */
function retryAfterOf(res: Response, body: CodexBody): number | null {
  const h = Number(res.headers.get('retry-after'));
  if (Number.isFinite(h) && h >= 0) return h;
  return typeof body?.retryAfter === 'number' && body.retryAfter >= 0 ? body.retryAfter : null;
}

type Outcome = { result: CodexDepositResult; retryAfterS?: number | null };

/** Reads one answer of Codex (docs/api.md « POST /api/documents », « Réponses »); `retryAfterS` set when it may be retried. */
function outcomeOf(res: Response, body: CodexBody, meta: CodexDepositMeta, requestId: string): Outcome {
  const s = res.status;
  if ((s === 200 || s === 201) && body?.id) return { result: { ok: true, id: body.id, replayed: body.replayed === true } };
  const fail = (reason: Exclude<CodexDepositResult, { ok: true }>['reason'], message: string, retryAfterS?: number | null): Outcome =>
    ({ result: { ok: false, reason, message }, retryAfterS });
  const req = `request ${body?.requestId ?? requestId}`;
  if (s === 409) return { result: { ok: false, reason: 'conflict', message: `Another file was already deposited in Codex under this reference (${body?.id ?? '?'})`, ...(body?.id ? { id: body.id } : {}) } };
  if (s === 401 || s === 403) return fail('refused', `Codex refused Arche's credentials (${refusalOf(body, s)})`);
  if (s === 503 && body?.error === 'disabled') return fail('off', 'The deposit is not open in Codex');
  if (s === 413 && body?.error === 'scan_too_large') return fail('invalid', "The file is beyond the limits of Codex's antivirus scan");
  if (s === 413) return fail('invalid', typeof body?.maxBytes === 'number' ? `The file is too large for Codex (${Math.floor(body.maxBytes / (1024 * 1024))} MB at most)` : 'The file is too large for Codex');
  if (s === 415) return fail('invalid', `Codex does not accept this file (${[body?.reason ?? body?.error ?? 'format', body?.ext ? `.${body.ext}` : null].filter(Boolean).join(', ')})`);
  if (s === 422 && body?.error === 'file_infected') return fail('invalid', `Codex's antivirus found a threat in the file (${body.threat ?? '?'})`);
  if (s === 400 && body?.issues?.some((i) => i.code === 'capex_unknown') && meta.capexCode)
    return fail('invalid', `Codex does not know the CAPEX ${meta.capexCode} yet (it reads arche.pub_capex)`);
  if (s === 500) return fail('unavailable', `Codex is unavailable (internal error; ${req})`);
  // Transient: too many requests, a gateway or Codex itself unavailable (the antivirus included). Nothing was done.
  if (s === 429 || s === 502 || s === 503 || s === 504) return fail('unavailable', `Codex is unavailable (${refusalOf(body, s)}; ${req})`, retryAfterOf(res, body) ?? 1);
  if (s >= 500) return fail('unavailable', `Codex is unavailable (${refusalOf(body, s)}; ${req})`);
  return fail('invalid', `Codex refused the deposit: ${refusalOf(body, s)}`);
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Deposits one document in Codex. Never throws: every failure is a result with a reason. A transient failure (Codex out of
 * reach, 429, 502–504) is tried again, at most DEPOSIT_ATTEMPTS times in all, after the delay Codex asks for (DEPOSIT_MAX_WAIT_S
 * at most): the deposit is idempotent by `sourceRef`, and each attempt is signed again with a new timestamp (Codex refuses a
 * signed request it already received, `signature_replayed`). Each attempt carries its own `X-Request-Id` (`arche-…`), quoted
 * in the failure so that Codex's technical log finds it.
 */
export async function depositToCodex({ meta, file, env = process.env, fetchImpl = fetch, now = () => Date.now(), sleep = pause }: {
  meta: CodexDepositMeta; file: CodexDepositFile; env?: CodexDepositEnv; fetchImpl?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>;
}): Promise<CodexDepositResult> {
  const base = clean(env.CODEX_API_URL) ?? clean(env.NEXT_PUBLIC_CODEX_URL);
  const token = clean(env.CODEX_DOCUMENTS_TOKEN);
  const secret = clean(env.CODEX_DOCUMENTS_SECRET);
  if (!base || (!token && !secret)) return { ok: false, reason: 'off', message: 'The deposit in Codex is not configured' };
  let url: URL;
  const auth: Record<string, string> = {};
  try {
    url = new URL('/api/documents', base);
  } catch {
    return { ok: false, reason: 'misconfigured', message: 'The Codex URL is invalid' };
  }
  if (url.username) {
    if (token) return { ok: false, reason: 'misconfigured', message: 'CODEX_DOCUMENTS_TOKEN cannot go with credentials in the Codex URL: use CODEX_DOCUMENTS_SECRET' };
    auth.authorization = `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}`;
    url.username = '';
    url.password = '';
  } else if (token) auth.authorization = `Bearer ${token}`;
  const sha256 = createHash('sha256').update(file.bytes).digest('hex');
  const form = new FormData();
  form.set('meta', JSON.stringify(depositMetaOf(meta, sha256, env)));
  form.set('file', new Blob([file.bytes as BlobPart], { type: file.type || 'application/octet-stream' }), file.name);
  // The signature covers the exact bytes sent: the multipart body is built once, signed, then sent as is (every attempt).
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const contentType = encoded.headers.get('content-type')!;
  const deposit = `arche-${randomUUID()}`;
  let lastTs = 0;
  let last: CodexDepositResult = { ok: false, reason: 'unavailable', message: 'Codex could not be reached' };
  for (let attempt = 1; attempt <= DEPOSIT_ATTEMPTS; attempt++) {
    const requestId = `${deposit}.${attempt}`;
    const headers: Record<string, string> = { ...auth, 'content-type': contentType, 'x-request-id': requestId };
    if (secret) {
      // Never the timestamp of a previous attempt: the same timestamp and body would be a replay for Codex.
      const ts = Math.max(Math.floor(now() / 1000), lastTs + 1);
      lastTs = ts;
      headers['x-codex-timestamp'] = String(ts);
      headers['x-codex-signature'] = codexSignature(secret, ts, body);
    }
    let wait: number | null | undefined;
    try {
      const res = await fetchImpl(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(60_000) });
      const json = (await res.json().catch(() => null)) as CodexBody;
      const o = outcomeOf(res, json, meta, requestId);
      last = o.result;
      wait = o.retryAfterS;
    } catch (e) {
      last = { ok: false, reason: 'unavailable', message: `Codex could not be reached (${e instanceof Error ? e.message : String(e)}; request ${requestId})` };
      wait = attempt;
    }
    if (last.ok || wait == null || wait > DEPOSIT_MAX_WAIT_S || attempt === DEPOSIT_ATTEMPTS) return last;
    await sleep(Math.max(wait, 1) * 1000);
  }
  return last;
}
