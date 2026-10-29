// Business API and webhooks (AR-048) on a fresh database with the demo data set: an application created by the administrator
// reads the CAPEX of its scope with its key (never a draft, never another subsidiary), writes the actuals of a lot by a signed
// request accepted once, and receives the events of its subscriptions — signed — from the outbox; a read-only key cannot write.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { signature } from '@/domain/api';
import { capex, capexLots, lotActuals, webhookDeliveries } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';
import { createApiClientAction, createWebhookAction, revokeApiClientAction } from '@/features/admin/api-actions';
import { openCapexAction } from '@/features/capex/actions';
import { GET as listGet } from '@/app/api/v1/capex/route';
import { GET as detailGet } from '@/app/api/v1/capex/[code]/route';
import { POST as actualsPost } from '@/app/api/v1/capex/[code]/actuals/route';
import { POST as actionsPost } from '@/app/api/v1/capex/[code]/actions/route';
import { deliverWebhooks, raiseAlerts } from './deliver';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'admin'));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
async function newClient(o: Record<string, string>) {
  const r = await createApiClientAction(null, form(o));
  if (!r.ok) throw new Error(r.error);
  return r.secret;
}
const req = (key: string, path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) =>
  new Request(`http://arche.test${path}`, { method: init.method ?? 'GET', body: init.body, headers: { Authorization: `Bearer ${key}`, ...init.headers } });
const signed = (key: string, path: string, body: unknown, ts = Math.floor(Date.now() / 1000)) => {
  const b = JSON.stringify(body);
  return req(key, path, { method: 'POST', body: b, headers: { 'Content-Type': 'application/json', 'X-Arche-Timestamp': String(ts), 'X-Arche-Signature': signature(key, ts, b) } });
};
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

describe('business API (AR-048)', () => {
  let apmKey = '';

  it('only the administrator creates a key; it reads the CAPEX of its scope, never a draft', async () => {
    jar.set('arche-role', 'sponsor');
    expect(await createApiClientAction(null, form({ name: 'Sneaky' }))).toEqual({ ok: false, error: 'This action is reserved to the administrator' });
    jar.set('arche-role', 'admin');
    apmKey = await newClient({ name: 'Sage connector APM', canWrite: 'on', 'sub:APM': 'on' });
    expect(apmKey).toMatch(/^arche_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);
    expect(await createApiClientAction(null, form({ name: 'sage connector apm' }))).toEqual({ ok: false, error: 'This name is already used' });
    const r = await listGet(req(apmKey, '/api/v1/capex'));
    expect(r.status).toBe(200);
    const codes = ((await r.json()) as { data: { code: string }[] }).data.map((c) => c.code);
    expect(codes).toEqual(['CPX-APM-2025-01', 'CPX-APM-2026-01']);
    expect((await detailGet(req(apmKey, '/x'), params({ code: 'CPX-SAI-2026-01' }))).status).toBe(404);
    const d = (await (await detailGet(req(apmKey, '/x'), params({ code: 'CPX-APM-2026-01' }))).json()) as { data: { lots: unknown[]; gates: unknown[]; indicators: { bacKeur: number } } };
    expect(d.data.lots.length).toBeGreaterThan(0);
    expect(d.data.gates.length).toBeGreaterThan(0);
    expect((await listGet(new Request('http://arche.test/api/v1/capex'))).status).toBe(401);
    expect((await listGet(req('arche_AAAAAAAA_' + 'B'.repeat(43), '/api/v1/capex'))).status).toBe(401);
  });

  it('writes the actuals of a lot by a signed request, accepted once; unsigned, replayed or read-only: refused', async () => {
    const [c] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-APM-2026-01'));
    const [lot] = (await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id))).filter((l) => !l.epc2i);
    const path = '/api/v1/capex/CPX-APM-2026-01/actuals';
    const body = { lot: lot.number, month: '2026-09', committedKeur: 120, spentKeur: 80 };
    const first = signed(apmKey, path, body);
    const again = first.clone();
    const r = await actualsPost(first, params({ code: 'CPX-APM-2026-01' }));
    expect(r.status).toBe(200);
    const [row] = await t.db.select().from(lotActuals).where(and(eq(lotActuals.lotId, lot.id), eq(lotActuals.month, '2026-09')));
    expect(row).toMatchObject({ committedKeur: 120, spentKeur: 80, source: 'import', enteredByName: 'API · Sage connector APM' });
    expect(await (await actualsPost(again, params({ code: 'CPX-APM-2026-01' }))).json()).toEqual({ error: 'unauthorized', reason: 'signature_replayed' });
    const unsigned = req(apmKey, path, { method: 'POST', body: JSON.stringify(body) });
    expect(await (await actualsPost(unsigned, params({ code: 'CPX-APM-2026-01' }))).json()).toEqual({ error: 'unauthorized', reason: 'signature_missing' });
    const old = signed(apmKey, path, body, Math.floor(Date.now() / 1000) - 3600);
    expect(await (await actualsPost(old, params({ code: 'CPX-APM-2026-01' }))).json()).toEqual({ error: 'unauthorized', reason: 'signature_expired' });
    const bad = await actualsPost(signed(apmKey, path, { lot: lot.number, month: '2099-01', spentKeur: 1 }), params({ code: 'CPX-APM-2026-01' }));
    expect(bad.status).toBe(422);
    const readOnly = await newClient({ name: 'Power BI groupe' });
    expect((await actualsPost(signed(readOnly, path, body), params({ code: 'CPX-APM-2026-01' }))).status).toBe(403);
    expect((await actualsPost(signed(apmKey, '/api/v1/capex/CPX-SAI-2026-01/actuals', body, Math.floor(Date.now() / 1000) - 7), params({ code: 'CPX-SAI-2026-01' }))).status).toBe(404);
    const a = await actionsPost(signed(apmKey, '/api/v1/capex/CPX-APM-2026-01/actions', { title: 'Reconcile the September invoices' }), params({ code: 'CPX-APM-2026-01' }));
    expect(a.status).toBe(201);
  });

  it('the events of a subscription are signed and sent from the outbox; a failure is tried again later', async () => {
    const { apiClients } = await import('@/server/db/schema');
    const [apm] = await t.db.select().from(apiClients).where(eq(apiClients.name, 'Sage connector APM'));
    const sub = await createWebhookAction(null, form({ clientId: apm.id, url: 'https://hooks.example.com/arche', 'event:capex.opened': 'on', 'event:gate.decided': 'on', 'event:alert.raised': 'on' }));
    if (!sub.ok) throw new Error(sub.error);
    expect(sub.secret).toMatch(/^whsec_/);
    expect(await createWebhookAction(null, form({ clientId: apm.id, url: 'http://hooks.example.com/x', 'event:gate.decided': 'on' }))).toEqual({ ok: false, error: 'A webhook address uses HTTPS' });
    // Opening a draft of APM: one delivery queued.
    jar.set('arche-role', 'sponsor');
    expect(await openCapexAction('CPX-APM-2026-02')).toEqual({ ok: true });
    const queued = await t.db.select().from(webhookDeliveries);
    expect(queued.map((d) => d.event)).toEqual(['capex.opened']);
    expect(queued[0].payload).toMatchObject({ event: 'capex.opened', capex: { code: 'CPX-APM-2026-02', subsidiary: 'APM' } });
    const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
    const now = new Date();
    expect(await deliverWebhooks(t.db, now, async (url, init) => { sent.push({ url, headers: init.headers, body: init.body }); return { status: 500 }; })).toEqual({ sent: 0, failed: 1 });
    const [retry] = await t.db.select().from(webhookDeliveries);
    expect(retry).toMatchObject({ status: 'pending', attempts: 1, lastStatus: 500 });
    expect(retry.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);
    expect(await deliverWebhooks(t.db, new Date(now.getTime() + 61_000), async (url, init) => { sent.push({ url, headers: init.headers, body: init.body }); return { status: 204 }; })).toEqual({ sent: 1, failed: 0 });
    const last = sent.at(-1)!;
    expect(last.headers['X-Arche-Event']).toBe('capex.opened');
    expect(last.headers['X-Arche-Signature']).toBe(signature(sub.secret, Number(last.headers['X-Arche-Timestamp']), last.body));
    // Alerts: announced once (APM's alerts only: the client's scope), not again on the next run.
    const n = await raiseAlerts(t.db, '2026-10-22', now);
    expect(n).toBeGreaterThan(0);
    const alerts = (await t.db.select().from(webhookDeliveries)).filter((d) => d.event === 'alert.raised');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((d) => (d.payload.capex as { subsidiary: string }).subsidiary === 'APM')).toBe(true);
    expect(await raiseAlerts(t.db, '2026-10-22', now)).toBe(0);
  });

  it('a revoked key no longer reads', async () => {
    const { apiClients } = await import('@/server/db/schema');
    const [apm] = await t.db.select().from(apiClients).where(eq(apiClients.name, 'Sage connector APM'));
    expect(await revokeApiClientAction(apm.id)).toEqual({ ok: true });
    expect((await listGet(req(apmKey, '/api/v1/capex'))).status).toBe(401);
  });
});
