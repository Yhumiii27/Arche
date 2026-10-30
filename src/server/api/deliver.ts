import 'server-only';
// Sending the webhooks (AR-048, job `webhooks`): the due deliveries of the outbox are POSTed as JSON, signed with their
// subscription's secret (X-Arche-Signature, Codex's convention); a 2xx answer marks a delivery sent, anything else schedules the
// next attempt (src/domain/api.ts nextAttemptIn) until it fails for good. And `alert.raised`: the alerts of the open CAPEX are
// computed and a new one (a CAPEX and a rule) is announced once while it lasts.
import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import { nextAttemptIn, signature } from '@/domain/api';
import { capex, raisedAlerts, webhookDeliveries, webhookSubscriptions } from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { capexDashboards } from '@/server/dal/governance';
import { enqueueEvent } from './events';

export type Fetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number }>;

const TIMEOUT_MS = 10_000;

/** Sends the deliveries due at `now` (at most `limit`); returns how many were sent and how many failed this time. */
export async function deliverWebhooks(db: DB, now: Date, send: Fetch = fetch as unknown as Fetch, limit = 50): Promise<{ sent: number; failed: number }> {
  const due = await db.select({ d: webhookDeliveries, url: webhookSubscriptions.url, secret: webhookSubscriptions.secret, active: webhookSubscriptions.active })
    .from(webhookDeliveries).innerJoin(webhookSubscriptions, eq(webhookSubscriptions.id, webhookDeliveries.subscriptionId))
    .where(and(eq(webhookDeliveries.status, 'pending'), lte(webhookDeliveries.nextAttemptAt, now))).orderBy(asc(webhookDeliveries.createdAt)).limit(limit);
  let sent = 0;
  let failed = 0;
  for (const { d, url, secret, active } of due) {
    if (!active) {
      await db.update(webhookDeliveries).set({ status: 'failed', lastError: 'subscription disabled' }).where(eq(webhookDeliveries.id, d.id));
      continue;
    }
    const body = JSON.stringify(d.payload);
    const ts = Math.floor(now.getTime() / 1000);
    let status: number | null = null;
    let error: string | null = null;
    try {
      const r = await send(url, {
        method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Arche-Webhooks/1', 'X-Arche-Event': d.event, 'X-Arche-Delivery': d.id, 'X-Arche-Timestamp': String(ts), 'X-Arche-Signature': signature(secret, ts, body) },
      });
      status = r.status;
      if (r.status < 200 || r.status >= 300) error = `HTTP ${r.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 300) : 'unreachable';
    }
    const attempts = d.attempts + 1;
    if (!error) {
      await db.update(webhookDeliveries).set({ status: 'sent', attempts, lastStatus: status, lastError: null, sentAt: now }).where(eq(webhookDeliveries.id, d.id));
      sent++;
      continue;
    }
    const wait = nextAttemptIn(attempts);
    await db.update(webhookDeliveries).set({
      status: wait == null ? 'failed' : 'pending', attempts, lastStatus: status, lastError: error, nextAttemptAt: new Date(now.getTime() + (wait ?? 0) * 60_000),
    }).where(eq(webhookDeliveries.id, d.id));
    failed++;
  }
  return { sent, failed };
}

/** Announces the new alerts of the active CAPEX (`alert.raised`) and forgets the cleared ones; returns how many were new. */
export async function raiseAlerts(db: DB, today: string, now: Date): Promise<number> {
  const rows = await db.select({ id: capex.id, code: capex.code, status: capex.status, phase: capex.phase, typology: capex.typology, typologyProposed: capex.typologyProposed, openedAt: capex.openedAt })
    .from(capex).where(eq(capex.status, 'active'));
  const dashes = await capexDashboards(db, rows, today);
  const known = rows.length ? await db.select().from(raisedAlerts).where(inArray(raisedAlerts.capexId, rows.map((r) => r.id))) : [];
  let raised = 0;
  await db.transaction(async (tx) => {
    for (const [i, c] of rows.entries()) {
      const current = new Map(dashes[i].alerts.map((a) => [a.rule, a]));
      const mine = known.filter((k) => k.capexId === c.id);
      for (const k of mine.filter((x) => !current.has(x.rule))) await tx.delete(raisedAlerts).where(and(eq(raisedAlerts.capexId, c.id), eq(raisedAlerts.rule, k.rule)));
      for (const a of current.values()) {
        if (mine.some((k) => k.rule === a.rule)) continue;
        await tx.insert(raisedAlerts).values({ capexId: c.id, rule: a.rule, raisedOn: today });
        await enqueueEvent(tx, 'alert.raised', c.id, { rule: a.rule, level: a.level, text: a.text, detail: a.detail }, now);
        raised++;
      }
    }
  });
  return raised;
}
