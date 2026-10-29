import 'server-only';
// Authentication of the business API (AR-048, docs/API.md): `Authorization: Bearer <key>` (the key of an API client created by
// the administrator; Arche keeps only its SHA-256); a write also needs the client's write right and the signature of its body
// (X-Arche-Timestamp, X-Arche-Signature = v1=HMAC-SHA256(key, "<timestamp>.<body>")), accepted once (anti-replay). Answers follow
// Codex's conventions: JSON, a stable error code, no-store, X-Request-Id.
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { bearerKey, checkSignature, hashKey, SIGNATURE_WINDOW_S } from '@/domain/api';
import { getDb } from '@/server/db/client';
import { apiClients, apiSignatures } from '@/server/db/schema';
import { log } from '@/server/log';

export type ApiClient = typeof apiClients.$inferSelect;

const requestIdOf = (r: Request) => {
  const id = r.headers.get('x-request-id');
  return id && /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : randomUUID();
};

export function json(request: Request, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-Id': requestIdOf(request), ...extra },
  });
}

const unauthorized = (r: Request, reason?: string) => json(r, 401, reason ? { error: 'unauthorized', reason } : { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer realm="arche"' });

/** The client of a read request, or the 401 answer. */
export async function readClient(request: Request): Promise<ApiClient | Response> {
  const key = bearerKey(request.headers.get('authorization'));
  if (!key) return unauthorized(request);
  const db = await getDb();
  const [client] = await db.select().from(apiClients).where(and(eq(apiClients.keyHash, hashKey(key)), isNull(apiClients.revokedAt)));
  if (!client) {
    log.warn('API key refused', { component: 'api', path: new URL(request.url).pathname });
    return unauthorized(request);
  }
  // Last use, at most once a minute.
  if (!client.lastUsedAt || Date.now() - client.lastUsedAt.getTime() > 60_000) await db.update(apiClients).set({ lastUsedAt: new Date() }).where(eq(apiClients.id, client.id));
  return client;
}

/** The client and the body of a signed write request, or the 401 / 403 answer. */
export async function writeClient(request: Request): Promise<{ client: ApiClient; body: string } | Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  if (!client.canWrite) return json(request, 403, { error: 'forbidden', reason: 'read_only_client' });
  const body = await request.text();
  if (body.length > 100_000) return json(request, 413, { error: 'too_large' });
  const key = bearerKey(request.headers.get('authorization'))!;
  const now = Math.floor(Date.now() / 1000);
  const sig = checkSignature(key, request.headers.get('x-arche-timestamp'), request.headers.get('x-arche-signature'), body, now);
  if (!sig.ok) {
    log.warn('API signature refused', { component: 'api', client: client.name, reason: sig.reason });
    return unauthorized(request, sig.reason);
  }
  const db = await getDb();
  await db.delete(apiSignatures).where(lt(apiSignatures.receivedAt, new Date(Date.now() - 2 * SIGNATURE_WINDOW_S * 1000)));
  const fresh = await db.insert(apiSignatures).values({ clientId: client.id, signature: sig.value }).onConflictDoNothing().returning();
  if (!fresh.length) return unauthorized(request, 'signature_replayed');
  return { client, body };
}
