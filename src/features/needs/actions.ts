'use server';
// Machine needs (docs/spec/07 §1): the project lead enters them as drafts in phases 1 and 2, submits them to EPC2i (they are
// then published in pub_besoins_machines) and may withdraw a submitted need until it is ordered at the G2 Go.
import { and, eq } from 'drizzle-orm';
import { nextNumber } from '@/domain/capex';
import { canSubmitNeeds, checkNeed, needRef } from '@/domain/needs';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { capexLots, machineNeeds } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { auditOf, fieldsOf, onCapex, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { catalogue } from '@/server/integrations/keystone';

async function needOf(tx: Tx, c: CapexRowFull, id: string) {
  return (await tx.select().from(machineNeeds).where(and(eq(machineNeeds.id, id), eq(machineNeeds.capexId, c.id))))[0] ?? null;
}

async function machinesLot(tx: Tx, capexId: string, raw: string): Promise<string | null | false> {
  if (!raw) return null;
  const [lot] = await tx.select({ id: capexLots.id }).from(capexLots).where(and(eq(capexLots.id, raw), eq(capexLots.capexId, capexId)));
  return lot?.id ?? false;
}

/** Creates (needId null) or updates a draft need. */
export async function saveNeedAction(code: string, needId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'needs', async (tx, c, v) => {
    if (!canSubmitNeeds(c)) return { ok: false, error: 'Machine needs are entered in phases 1 and 2' };
    const ch = checkNeed(fieldsOf(fd), await catalogue(tx), fd.getAll('options').map(String));
    if (!ch.ok) return ch;
    const lotId = await machinesLot(tx, c.id, String(fd.get('lotId') ?? ''));
    if (lotId === false) return { ok: false, error: 'Unknown lot' };
    if (needId) {
      const n = await needOf(tx, c, needId);
      if (!n) return { ok: false, error: 'Unknown need' };
      if (n.status !== 'draft') return { ok: false, error: 'A submitted need is no longer edited: withdraw it and enter a new one' };
      await tx.update(machineNeeds).set({ ...ch.value, lotId, updatedAt: new Date() }).where(eq(machineNeeds.id, n.id));
      await writeAudit(tx, auditOf(v, c, `machine need ${needRef(c.code, n.number)} edited`, { entityType: 'machine_need', entityId: n.id, after: { ...ch.value } }));
      return { ok: true };
    }
    const number = nextNumber((await tx.select({ n: machineNeeds.number }).from(machineNeeds).where(eq(machineNeeds.capexId, c.id))).map((x) => x.n));
    const [row] = await tx.insert(machineNeeds).values({ capexId: c.id, number, ...ch.value, lotId, createdByName: v.name }).returning({ id: machineNeeds.id });
    await writeAudit(tx, auditOf(v, c, `machine need ${needRef(c.code, number)} entered`, { entityType: 'machine_need', entityId: row.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

/** Deletes a draft (never seen by EPC2i). */
export async function deleteNeedAction(code: string, needId: string): Promise<ActionResult> {
  return onCapex(code, 'needs', async (tx, c, v) => {
    const n = await needOf(tx, c, needId);
    if (!n) return { ok: false, error: 'Unknown need' };
    if (n.status !== 'draft') return { ok: false, error: 'Only a draft is deleted; a submitted need is withdrawn' };
    await tx.delete(machineNeeds).where(eq(machineNeeds.id, n.id));
    await writeAudit(tx, auditOf(v, c, `machine need ${needRef(c.code, n.number)} deleted (draft)`, { entityType: 'machine_need', entityId: n.id }));
    return { ok: true };
  });
}

/** Submits a draft to EPC2i. */
export async function submitNeedAction(code: string, needId: string): Promise<ActionResult> {
  return onCapex(code, 'needs', async (tx, c, v) => {
    if (!canSubmitNeeds(c)) return { ok: false, error: 'Machine needs are submitted in phases 1 and 2' };
    const n = await needOf(tx, c, needId);
    if (!n) return { ok: false, error: 'Unknown need' };
    if (n.status !== 'draft') return { ok: false, error: 'This need is already submitted' };
    await tx.update(machineNeeds).set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() }).where(eq(machineNeeds.id, n.id));
    const ref = needRef(c.code, n.number);
    await writeAudit(tx, auditOf(v, c, `machine need ${ref} submitted to EPC2i`, { entityType: 'machine_need', entityId: n.id }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'need.submitted', text: `${ref} submitted to EPC2i`, capexId: c.id });
    return { ok: true };
  });
}

/** Withdraws a submitted need (with a reason); an ordered need is not withdrawn (a change after G2 goes through the MoC). */
export async function withdrawNeedAction(code: string, needId: string, reason: string): Promise<ActionResult> {
  return onCapex(code, 'needs', async (tx, c, v) => {
    const n = await needOf(tx, c, needId);
    if (!n) return { ok: false, error: 'Unknown need' };
    if (n.status !== 'submitted') return { ok: false, error: 'Only a submitted need is withdrawn' };
    const why = String(reason ?? '').trim();
    if (!why) return { ok: false, error: 'Give the reason' };
    await tx.update(machineNeeds).set({ status: 'withdrawn', updatedAt: new Date() }).where(eq(machineNeeds.id, n.id));
    const ref = needRef(c.code, n.number);
    await writeAudit(tx, auditOf(v, c, `machine need ${ref} withdrawn`, { entityType: 'machine_need', entityId: n.id, reason: why.slice(0, 2000) }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'need.withdrawn', text: `${ref} withdrawn`, capexId: c.id });
    return { ok: true };
  });
}
