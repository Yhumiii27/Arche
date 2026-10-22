'use server';
// Delivery of a CAPEX (delivery 5): the permits register and the subsidiary's part of the engineering pack (project lead,
// sponsor: right `edit`), the lots' planned windows and their monthly committed / spent / physical % — entered or imported from
// Arche's CSV template (controller, project lead: right `budget`, N-14). EPC2i lots are read in Keystone, never entered.
import { and, eq } from 'drizzle-orm';
import { nextNumber, refOf } from '@/domain/capex';
import { checkActual, checkWindow, monthOf, parseActualsCsv } from '@/domain/execution';
import { checkPackItem, isPackItem } from '@/domain/pack';
import { checkPermit } from '@/domain/permits';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { authorizations, capexLots, lotActuals, packItems } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, type ActionResult } from '@/server/capex/write';
import type { Tx } from '@/server/db/types';

export async function savePermitAction(code: string, permitId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v, today) => {
    const ch = checkPermit(fieldsOf(fd), today);
    if (!ch.ok) return ch;
    const now = new Date();
    if (permitId) {
      const [before] = await tx.select().from(authorizations).where(and(eq(authorizations.id, permitId), eq(authorizations.capexId, c.id)));
      if (!before) return { ok: false, error: 'Unknown permit' };
      await tx.update(authorizations).set({ ...ch.value, updatedByName: v.name, updatedAt: now }).where(eq(authorizations.id, before.id));
      await writeAudit(tx, auditOf(v, c, `permit ${refOf('AUT', before.number)} updated (${ch.value.status})`, {
        entityType: 'authorization', entityId: before.id, before: { status: before.status, filedOn: before.filedOn, dueOn: before.dueOn, obtainedOn: before.obtainedOn }, after: { ...ch.value },
      }));
      return { ok: true };
    }
    const number = nextNumber((await tx.select({ n: authorizations.number }).from(authorizations).where(eq(authorizations.capexId, c.id))).map((x) => x.n));
    const [row] = await tx.insert(authorizations).values({ capexId: c.id, number, ...ch.value, updatedByName: v.name }).returning({ id: authorizations.id });
    await writeAudit(tx, auditOf(v, c, `permit ${refOf('AUT', number)} recorded (${ch.value.kind}, ${ch.value.status})`, { entityType: 'authorization', entityId: row.id, after: { ...ch.value } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'permit.recorded', text: `${c.code}: ${refOf('AUT', number)} recorded`, capexId: c.id });
    return { ok: true };
  });
}

export async function savePackItemAction(code: string, itemCode: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v, today) => {
    if (!isPackItem(itemCode)) return { ok: false, error: 'Unknown pack item' };
    const ch = checkPackItem(fieldsOf(fd), today);
    if (!ch.ok) return ch;
    const [before] = await tx.select().from(packItems).where(and(eq(packItems.capexId, c.id), eq(packItems.itemCode, itemCode)));
    // A validated item keeps the date it was validated on while it stays validated.
    const validatedOn = ch.value.status === 'validated' && before?.status === 'validated' ? before.validatedOn : ch.value.validatedOn;
    const values = { ...ch.value, validatedOn, updatedByName: v.name, updatedAt: new Date() };
    await tx.insert(packItems).values({ capexId: c.id, itemCode, ...values }).onConflictDoUpdate({ target: [packItems.capexId, packItems.itemCode], set: values });
    await writeAudit(tx, auditOf(v, c, `engineering pack ${itemCode}: ${ch.value.status}`, {
      entityType: 'pack_item', before: before ? { status: before.status, codexRef: before.codexRef } : undefined, after: { status: ch.value.status, codexRef: ch.value.codexRef },
    }));
    return { ok: true };
  });
}

async function lotOf(tx: Tx, capexId: string, lotId: string) {
  return (await tx.select().from(capexLots).where(and(eq(capexLots.id, lotId), eq(capexLots.capexId, capexId))))[0] ?? null;
}

export async function saveLotWindowAction(code: string, lotId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v) => {
    const lot = await lotOf(tx, c.id, lotId);
    if (!lot) return { ok: false, error: 'Unknown lot' };
    const ch = checkWindow(fieldsOf(fd));
    if (!ch.ok) return ch;
    await tx.update(capexLots).set({ plannedStart: ch.value.start, plannedEnd: ch.value.end, updatedAt: new Date() }).where(eq(capexLots.id, lot.id));
    await writeAudit(tx, auditOf(v, c, `lot ${lot.number}: planned window ${ch.value.start ?? '—'} → ${ch.value.end ?? '—'}`, {
      entityType: 'capex_lot', entityId: lot.id, before: { start: lot.plannedStart, end: lot.plannedEnd }, after: { ...ch.value },
    }));
    return { ok: true };
  });
}

export async function saveActualAction(code: string, lotId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v, today) => {
    const lot = await lotOf(tx, c.id, lotId);
    if (!lot) return { ok: false, error: 'Unknown lot' };
    if (lot.epc2i) return { ok: false, error: 'EPC2i lots come from Keystone' };
    const ch = checkActual(fieldsOf(fd), monthOf(today));
    if (!ch.ok) return ch;
    const values = { ...ch.value, source: 'manual' as const, enteredByName: v.name, enteredAt: new Date() };
    const [before] = await tx.select().from(lotActuals).where(and(eq(lotActuals.lotId, lot.id), eq(lotActuals.month, ch.value.month)));
    await tx.insert(lotActuals).values({ lotId: lot.id, ...values }).onConflictDoUpdate({ target: [lotActuals.lotId, lotActuals.month], set: values });
    await writeAudit(tx, auditOf(v, c, `lot ${lot.number}, ${ch.value.month}: actuals entered`, {
      entityType: 'lot_actual', entityId: lot.id,
      before: before ? { committedKeur: before.committedKeur, spentKeur: before.spentKeur, physicalPct: before.physicalPct } : undefined,
      after: { committedKeur: ch.value.committedKeur, spentKeur: ch.value.spentKeur, physicalPct: ch.value.physicalPct },
    }));
    return { ok: true };
  });
}

/** Import of Arche's CSV template (N-14): every line checked first; one error refuses the whole file. */
export async function importActualsAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v, today) => {
    const csv = String(fd.get('csv') ?? '');
    if (csv.length > 200_000) return { ok: false, error: 'The file is too large' };
    const lots = await tx.select({ id: capexLots.id, number: capexLots.number, epc2i: capexLots.epc2i }).from(capexLots).where(eq(capexLots.capexId, c.id));
    const r = parseActualsCsv(csv, lots, monthOf(today));
    if (!r.ok) return { ok: false, error: r.line ? `Line ${r.line} — ${r.error}` : r.error };
    const at = new Date();
    for (const row of r.value) {
      const values = { committedKeur: row.committedKeur, spentKeur: row.spentKeur, physicalPct: row.physicalPct, source: 'import' as const, enteredByName: v.name, enteredAt: at };
      await tx.insert(lotActuals).values({ lotId: row.lotId, month: row.month, ...values }).onConflictDoUpdate({ target: [lotActuals.lotId, lotActuals.month], set: values });
    }
    await writeAudit(tx, auditOf(v, c, `actuals imported: ${r.value.length} line(s)`, { entityType: 'lot_actual', after: { lines: r.value.length } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'actuals.imported', text: `${c.code}: ${r.value.length} line(s) of actuals imported`, capexId: c.id });
    return { ok: true };
  });
}
