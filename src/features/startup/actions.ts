'use server';
// Start-up and transfer of a CAPEX (delivery 6; docs/spec/06 §6, N-15, N-16, D22): the start of commissioning (project lead,
// after the PSSR), the production lines and their daily ramp-up entries — by the project lead or the operations expert of the
// CAPEX (right `rampup`), entered or imported from Arche's CSV template —, the controller's accounting closure statement
// (right `closure`) and the lessons learned (right `rex`; published by the project lead or the sponsor). Every write on the
// ramp-up recomputes the lines' results read by pub_rampup.
import { and, eq } from 'drizzle-orm';
import { canDo, nextNumber, refOf } from '@/domain/capex';
import { checkClosure, checkRex } from '@/domain/closure';
import { checkDay, checkLine, checkMesStart, parseRampupCsv } from '@/domain/rampup';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { capex, capexLots, closureStatements, lotFinalCosts, productionLines, rampupDays, rexEntries } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { auditOf, fieldsOf, onCapex, REFUSED, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { modelValues } from '@/server/dal/cycle';
import { hsOf } from '@/server/dal/execution';
import { recomputeLines } from '@/server/dal/rampup';

async function recompute(tx: Tx, c: { id: string }, today: string) {
  const [row] = await tx.select({ mesStartedOn: capex.mesStartedOn }).from(capex).where(eq(capex.id, c.id));
  await recomputeLines(tx, { id: c.id, mesStartedOn: row?.mesStartedOn ?? null }, await modelValues(tx), today);
}

export async function startMesAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v, today) => {
    if (!canDo('rampup', v.role, v.assignments, c) || v.role !== 'project_lead') return REFUSED;
    const pssr = (await hsOf(tx, c.id)).find((s) => s.code === 'PSSR');
    const ch = checkMesStart(fieldsOf(fd), { phase: c.phase, status: c.status, pssrPassed: pssr?.status === 'passed' || pssr?.status === 'waived', mesStartedOn: c.mesStartedOn, today });
    if (!ch.ok) return ch;
    await tx.update(capex).set({ mesStartedOn: ch.value, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await recompute(tx, c, today);
    await writeAudit(tx, auditOf(v, c, `start of commissioning: ${ch.value}`, { entityType: 'capex', entityId: c.id, after: { mesStartedOn: ch.value } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'mes.started', text: `${c.code}: commissioning started`, capexId: c.id });
    return { ok: true };
  });
}

export async function saveLineAction(code: string, lineId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'rampup', async (tx, c, v, today) => {
    if (c.phase !== 'demarrage') return { ok: false, error: 'Production lines are set up in phase 4' };
    const ch = checkLine(fieldsOf(fd));
    if (!ch.ok) return ch;
    const now = new Date();
    if (lineId) {
      const [before] = await tx.select().from(productionLines).where(and(eq(productionLines.id, lineId), eq(productionLines.capexId, c.id)));
      if (!before) return { ok: false, error: 'Unknown production line' };
      await tx.update(productionLines).set({ ...ch.value, updatedByName: v.name, updatedAt: now }).where(eq(productionLines.id, before.id));
      await writeAudit(tx, auditOf(v, c, `production line ${before.number} updated`, { entityType: 'production_line', entityId: before.id, before: { name: before.name, nominalPerDay: before.nominalPerDay, scrapTargetPct: before.scrapTargetPct }, after: { ...ch.value } }));
    } else {
      const number = nextNumber((await tx.select({ n: productionLines.number }).from(productionLines).where(eq(productionLines.capexId, c.id))).map((x) => x.n));
      const [row] = await tx.insert(productionLines).values({ capexId: c.id, number, ...ch.value, updatedByName: v.name }).returning({ id: productionLines.id });
      await writeAudit(tx, auditOf(v, c, `production line ${number} added`, { entityType: 'production_line', entityId: row.id, after: { ...ch.value } }));
    }
    await recompute(tx, c, today);
    return { ok: true };
  });
}

async function lineOf(tx: Tx, c: CapexRowFull, lineId: string) {
  return (await tx.select().from(productionLines).where(and(eq(productionLines.id, lineId), eq(productionLines.capexId, c.id))))[0] ?? null;
}

export async function saveRampupDayAction(code: string, lineId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'rampup', async (tx, c, v, today) => {
    const line = await lineOf(tx, c, lineId);
    if (!line) return { ok: false, error: 'Unknown production line' };
    const ch = checkDay(fieldsOf(fd), { mesStartedOn: c.mesStartedOn, today });
    if (!ch.ok) return ch;
    const values = { ...ch.value, source: 'manual' as const, enteredByName: v.name, enteredAt: new Date() };
    await tx.insert(rampupDays).values({ lineId: line.id, ...values }).onConflictDoUpdate({ target: [rampupDays.lineId, rampupDays.day], set: values });
    await recompute(tx, c, today);
    await writeAudit(tx, auditOf(v, c, `ramp-up, line ${line.number}, ${ch.value.day}: ${ch.value.plannedStop ? 'planned stop' : `output ${ch.value.output}, OEE ${ch.value.oeePct ?? '—'} %, scrap ${ch.value.scrapPct} %`}`, { entityType: 'rampup_day', entityId: line.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

/** Import of Arche's ramp-up template (N-16): every line checked first; one error refuses the whole file. */
export async function importRampupAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'rampup', async (tx, c, v, today) => {
    const csv = String(fd.get('csv') ?? '');
    if (csv.length > 400_000) return { ok: false, error: 'The file is too large' };
    const lines = await tx.select({ id: productionLines.id, number: productionLines.number }).from(productionLines).where(eq(productionLines.capexId, c.id));
    const r = parseRampupCsv(csv, lines, { mesStartedOn: c.mesStartedOn, today });
    if (!r.ok) return { ok: false, error: r.line ? `Line ${r.line} — ${r.error}` : r.error };
    const at = new Date();
    for (const d of r.value) {
      const { lineId, ...rest } = d;
      const values = { ...rest, source: 'import' as const, enteredByName: v.name, enteredAt: at };
      await tx.insert(rampupDays).values({ lineId, ...values }).onConflictDoUpdate({ target: [rampupDays.lineId, rampupDays.day], set: values });
    }
    await recompute(tx, c, today);
    await writeAudit(tx, auditOf(v, c, `ramp-up imported: ${r.value.length} day(s)`, { entityType: 'rampup_day', after: { lines: r.value.length } }));
    return { ok: true };
  });
}

export async function saveClosureAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'closure', async (tx, c, v) => {
    if (c.phase !== 'demarrage') return { ok: false, error: 'The accounting closure is entered in phase 4' };
    const lots = await tx.select({ id: capexLots.id }).from(capexLots).where(eq(capexLots.capexId, c.id));
    if (!lots.length) return { ok: false, error: 'The CAPEX has no lot' };
    const ch = checkClosure(fieldsOf(fd), lots.map((l) => l.id));
    if (!ch.ok) return ch;
    const now = new Date();
    const values = { afeBalanceKeur: ch.value.afeBalanceKeur, note: ch.value.note, enteredByName: v.name, updatedAt: now };
    await tx.insert(closureStatements).values({ capexId: c.id, ...values }).onConflictDoUpdate({ target: closureStatements.capexId, set: values });
    for (const [lotId, finalKeur] of Object.entries(ch.value.costs)) {
      await tx.insert(lotFinalCosts).values({ lotId, finalKeur }).onConflictDoUpdate({ target: lotFinalCosts.lotId, set: { finalKeur } });
    }
    await writeAudit(tx, auditOf(v, c, 'accounting closure statement entered', { entityType: 'closure_statement', entityId: c.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

export async function saveRexAction(code: string, rexId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'rex', async (tx, c, v) => {
    const ch = checkRex(fieldsOf(fd));
    if (!ch.ok) return ch;
    if (rexId) {
      const [before] = await tx.select().from(rexEntries).where(and(eq(rexEntries.id, rexId), eq(rexEntries.capexId, c.id)));
      if (!before) return { ok: false, error: 'Unknown lesson' };
      if (before.publishedAt) return { ok: false, error: 'A published lesson is not changed' };
      await tx.update(rexEntries).set({ ...ch.value, updatedAt: new Date() }).where(eq(rexEntries.id, before.id));
      await writeAudit(tx, auditOf(v, c, `lesson ${refOf('REX', before.number)} updated`, { entityType: 'rex_entry', entityId: before.id, after: { ...ch.value } }));
      return { ok: true };
    }
    const number = nextNumber((await tx.select({ n: rexEntries.number }).from(rexEntries).where(eq(rexEntries.capexId, c.id))).map((x) => x.n));
    const [row] = await tx.insert(rexEntries).values({ capexId: c.id, number, ...ch.value, authorName: v.name }).returning({ id: rexEntries.id });
    await writeAudit(tx, auditOf(v, c, `lesson ${refOf('REX', number)} entered`, { entityType: 'rex_entry', entityId: row.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

/** Publishing a lesson to the library and to pub_rex (project lead or sponsor; final). */
export async function publishRexAction(code: string, rexId: string): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const [r] = await tx.select().from(rexEntries).where(and(eq(rexEntries.id, rexId), eq(rexEntries.capexId, c.id)));
    if (!r) return { ok: false, error: 'Unknown lesson' };
    if (r.publishedAt) return { ok: false, error: 'This lesson is already published' };
    await tx.update(rexEntries).set({ publishedAt: new Date(), updatedAt: new Date() }).where(eq(rexEntries.id, r.id));
    await writeAudit(tx, auditOf(v, c, `lesson ${refOf('REX', r.number)} published`, { entityType: 'rex_entry', entityId: r.id }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'rex.published', text: `${c.code}: ${refOf('REX', r.number)} published`, capexId: c.id });
    return { ok: true };
  });
}
