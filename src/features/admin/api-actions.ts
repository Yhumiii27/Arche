'use server';
// Business API administration (AR-048, docs/API.md), the administrator only: API clients (the key is shown once, at its
// creation; only its SHA-256 is kept), their revocation, webhook subscriptions (the signing secret is shown once), their
// suspension, and a new attempt of a failed delivery. Each one checks the active role server-side, validates its input with
// src/domain/api.ts, writes and audits (area "Administration").
import { eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkApiClient, checkWebhook, newApiKey, newWebhookSecret } from '@/domain/api';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { apiClients, subsidiaries, webhookDeliveries, webhookSubscriptions } from '@/server/db/schema';
import { getViewer, type Viewer } from '@/server/session';

export type SecretResult = { ok: true; secret: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

const REFUSED = { ok: false as const, error: 'This action is reserved to the administrator' };
const fieldsOf = (fd: FormData) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
const audit = (v: Viewer, objectRef: string, change: string, extra: { entityType?: string; entityId?: string; after?: Record<string, unknown> } = {}) => ({
  actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef, change, area: 'Administration', ...extra,
});

async function admin(): Promise<Viewer | null> {
  const v = await getViewer();
  return v.role === 'admin' ? v : null;
}

const done = () => revalidatePath('/admin/api');

export async function createApiClientAction(_prev: SecretResult | null, fd: FormData): Promise<SecretResult> {
  const v = await admin();
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<SecretResult> => {
    const subs = new Set((await tx.select({ c: subsidiaries.code }).from(subsidiaries)).map((x) => x.c));
    const taken = new Set((await tx.select({ n: apiClients.name }).from(apiClients)).map((x) => x.n));
    const ch = checkApiClient(fieldsOf(fd), { subsidiaries: subs, takenNames: taken });
    if (!ch.ok) return ch;
    const k = newApiKey();
    const [c] = await tx.insert(apiClients).values({ ...ch.value, keyPrefix: k.prefix, keyHash: k.hash, createdByName: v.name }).returning({ id: apiClients.id });
    await writeAudit(tx, audit(v, `API client ${ch.value.name}`, `API client created (${ch.value.canWrite ? 'read and write' : 'read'}; ${ch.value.subsidiaries.join(', ') || 'whole group'})`, { entityType: 'api_client', entityId: c.id, after: { ...ch.value, keyPrefix: k.prefix } }));
    return { ok: true, secret: k.key };
  });
  if (r.ok) done();
  return r;
}

export async function revokeApiClientAction(id: string): Promise<ActionResult> {
  const v = await admin();
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [c] = await tx.select().from(apiClients).where(eq(apiClients.id, id));
    if (!c) return { ok: false, error: 'Unknown application' };
    if (c.revokedAt) return { ok: false, error: 'This key is already revoked' };
    await tx.update(apiClients).set({ revokedAt: new Date(), revokedByName: v.name, updatedAt: new Date() }).where(eq(apiClients.id, c.id));
    await tx.update(webhookSubscriptions).set({ active: false, updatedAt: new Date() }).where(eq(webhookSubscriptions.clientId, c.id));
    await writeAudit(tx, audit(v, `API client ${c.name}`, 'API key revoked; its webhooks suspended', { entityType: 'api_client', entityId: c.id }));
    return { ok: true };
  });
  if (r.ok) done();
  return r;
}

export async function createWebhookAction(_prev: SecretResult | null, fd: FormData): Promise<SecretResult> {
  const v = await admin();
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<SecretResult> => {
    const clients = await tx.select({ id: apiClients.id, name: apiClients.name }).from(apiClients).where(isNull(apiClients.revokedAt));
    const ch = checkWebhook(fieldsOf(fd), { clients: new Set(clients.map((c) => c.id)) });
    if (!ch.ok) return ch;
    const secret = newWebhookSecret();
    const [w] = await tx.insert(webhookSubscriptions).values({ ...ch.value, secret, createdByName: v.name }).returning({ id: webhookSubscriptions.id });
    const name = clients.find((c) => c.id === ch.value.clientId)!.name;
    await writeAudit(tx, audit(v, `API client ${name}`, `webhook subscribed: ${ch.value.url} (${ch.value.events.join(', ')})`, { entityType: 'webhook_subscription', entityId: w.id, after: { url: ch.value.url, events: ch.value.events } }));
    return { ok: true, secret };
  });
  if (r.ok) done();
  return r;
}

export async function setWebhookActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const v = await admin();
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [w] = await tx.select({ w: webhookSubscriptions, revoked: apiClients.revokedAt, name: apiClients.name }).from(webhookSubscriptions)
      .innerJoin(apiClients, eq(apiClients.id, webhookSubscriptions.clientId)).where(eq(webhookSubscriptions.id, id));
    if (!w) return { ok: false, error: 'Unknown webhook' };
    if (active && w.revoked) return { ok: false, error: 'The key of this application is revoked' };
    await tx.update(webhookSubscriptions).set({ active, updatedAt: new Date() }).where(eq(webhookSubscriptions.id, id));
    await writeAudit(tx, audit(v, `API client ${w.name}`, `webhook ${w.w.url} ${active ? 'resumed' : 'suspended'}`, { entityType: 'webhook_subscription', entityId: id }));
    return { ok: true };
  });
  if (r.ok) done();
  return r;
}

export async function retryDeliveryAction(id: string): Promise<ActionResult> {
  const v = await admin();
  if (!v) return REFUSED;
  const db = await getDb();
  const [d] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
  if (!d) return { ok: false, error: 'Unknown delivery' };
  if (d.status !== 'failed') return { ok: false, error: 'Only a failed delivery is sent again' };
  await db.update(webhookDeliveries).set({ status: 'pending', attempts: 0, nextAttemptAt: new Date() }).where(eq(webhookDeliveries.id, id));
  done();
  return { ok: true };
}
