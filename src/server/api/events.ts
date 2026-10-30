import 'server-only';
// The events of Arche's webhooks (AR-048, docs/API.md): written to the outbox in the transaction of the change — one delivery
// per active subscription that listens to the event and whose client sees the CAPEX — and sent by the job `webhooks`.
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { inClientScope, type WebhookEvent } from '@/domain/api';
import { apiClients, capex, webhookDeliveries, webhookSubscriptions } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

type Q = DB | Tx;

export interface EventCapex {
  id: string;
}

/** Queues `event` on the CAPEX `capexId` with its data; returns the number of deliveries queued. */
export async function enqueueEvent(q: Q, event: WebhookEvent, capexId: string, data: Record<string, unknown>, at: Date = new Date()): Promise<number> {
  const subs = await q.select({ id: webhookSubscriptions.id, events: webhookSubscriptions.events, subsidiaries: apiClients.subsidiaries })
    .from(webhookSubscriptions).innerJoin(apiClients, eq(apiClients.id, webhookSubscriptions.clientId))
    .where(and(eq(webhookSubscriptions.active, true), isNull(apiClients.revokedAt)));
  const listening = subs.filter((s) => s.events.includes(event));
  if (!listening.length) return 0;
  const [c] = await q.select({ code: capex.code, subsidiaryCode: capex.subsidiaryCode, title: capex.title, status: capex.status, phase: capex.phase }).from(capex).where(eq(capex.id, capexId));
  if (!c) return 0;
  const targets = listening.filter((s) => inClientScope(s.subsidiaries, c));
  if (!targets.length) return 0;
  const payload = { id: randomUUID(), event, occurredAt: at.toISOString(), capex: { code: c.code, subsidiary: c.subsidiaryCode, title: c.title, status: c.status, phase: c.phase }, data };
  await q.insert(webhookDeliveries).values(targets.map((s) => ({ subscriptionId: s.id, event, payload })));
  return targets.length;
}
