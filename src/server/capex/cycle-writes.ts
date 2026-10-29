import 'server-only';
// Cycle writes shared by the CAPEX Server Functions and the guided opening (src/features/capex/actions.ts, guided.ts): the
// opening of a draft in phase 1, the takeover of a CAPEX in progress (N-20) and the typology recomputed after a budget
// validation. They run inside the caller's transaction, after its rights and input checks.
import { and, eq } from 'drizzle-orm';
import { nextNumber } from '@/domain/capex';
import { MODEL_VERSION, NEXT_PHASE, openCapex } from '@/domain/lifecycle';
import { TAKEOVER_REASON, type TakeoverInput } from '@/domain/takeover';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { budgetLines, budgetVersions, capex, gates, phaseTransitions } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { enqueueEvent } from '@/server/api/events';
import { computedTypologyOf, modelValues } from '@/server/dal/cycle';
import { capexEnvelopeCheck } from '@/server/dal/finance';
import type { Viewer } from '@/server/session';
import { auditOf, type ActionResult, type CapexRowFull } from './write';

type Row = CapexRowFull;

/** Draft → Active, phase 1 (the sponsor; a project lead must be named). */
export async function applyOpen(tx: Tx, c: Row, v: Viewer, today: string): Promise<ActionResult> {
  const t = openCapex(c, !!c.leadUserId);
  if (!t.ok) return t;
  await tx.update(capex).set({ ...t.value, openedAt: new Date(), lifecycleModelVersion: MODEL_VERSION, sponsorUserId: c.sponsorUserId ?? v.userId, updatedAt: new Date() }).where(eq(capex.id, c.id));
  await tx.insert(phaseTransitions).values({ capexId: c.id, fromStatus: c.status, fromPhase: c.phase, toStatus: t.value.status, toPhase: t.value.phase, effectiveOn: today, byName: v.name, byUserId: v.userId });
  await writeAudit(tx, auditOf(v, c, 'status: Draft → Active (phase 1)', { entityType: 'capex', entityId: c.id }));
  await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'capex.opened', text: `${c.code} opened: phase 1`, capexId: c.id });
  await enqueueEvent(tx, 'capex.opened', c.id, { openedOn: today, takenOver: false });
  // Envelope control at the opening (AR-040): over its envelope, the opening is recorded with the overrun (an alert follows).
  const env = await capexEnvelopeCheck(tx, c, (await modelValues(tx)).envelopeBlockPct, today);
  if (env.over.length) {
    const over = env.over.map((r) => `${r.year} +${r.overKeur} k€`).join(', ');
    await writeAudit(tx, auditOf(v, c, `opened over its envelope: ${over}`, { entityType: 'capex', entityId: c.id }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'capex.envelope_over', text: `${c.code} over its envelope: ${over}`, capexId: c.id });
  }
  return { ok: true };
}

/** Takeover of a CAPEX in progress (N-20): opened in its phase with the gates taken over and the validated budget. */
export async function applyTakeover(tx: Tx, c: Row, v: Viewer, input: TakeoverInput, today: string): Promise<void> {
  const t = input;
  const now = new Date();
  const at = (day: string) => new Date(`${day}T12:00:00Z`);
  await tx.update(capex).set({
    status: 'active', phase: t.phase, openedAt: at(t.openedOn), lifecycleModelVersion: MODEL_VERSION, sponsorUserId: c.sponsorUserId ?? v.userId,
    mesStartedOn: t.mesStartedOn, takenOverAt: now, takenOverByName: v.name, updatedAt: now,
  }).where(eq(capex.id, c.id));
  const reason = TAKEOVER_REASON;
  await tx.insert(phaseTransitions).values({ capexId: c.id, fromStatus: 'draft', fromPhase: 'cadrage', toStatus: 'active', toPhase: 'cadrage', effectiveOn: t.openedOn, reason, byName: v.name, byUserId: v.userId });
  let phase = 'cadrage';
  for (const g of t.gates) {
    const session = await tx.select({ s: gates.session }).from(gates).where(and(eq(gates.capexId, c.id), eq(gates.code, g.code)));
    await tx.insert(gates).values({
      capexId: c.id, code: g.code, session: nextNumber(session.map((x) => x.s)), status: 'decided', decision: 'go', decidedAt: at(g.decidedOn), decidedByName: g.decidedByName, takenOver: true,
    });
    const to = NEXT_PHASE[g.code]!;
    await tx.insert(phaseTransitions).values({ capexId: c.id, fromStatus: 'active', fromPhase: phase, toStatus: 'active', toPhase: to, gateCode: g.code, effectiveOn: g.decidedOn, reason, byName: v.name, byUserId: v.userId });
    phase = to;
  }
  const b = t.budget;
  await tx.update(budgetVersions).set({ status: 'superseded', updatedAt: now }).where(and(eq(budgetVersions.capexId, c.id), eq(budgetVersions.status, 'validated')));
  const numbers = (await tx.select({ n: budgetVersions.number }).from(budgetVersions).where(eq(budgetVersions.capexId, c.id))).map((x) => x.n);
  const [bv] = await tx.insert(budgetVersions).values({
    capexId: c.id, number: nextNumber(numbers), estimateClass: b.estimateClass, status: 'validated', basis: null, submittedAt: at(b.validatedOn),
    validatedAt: at(b.validatedOn), validatedByName: b.validatedByName, isG2Baseline: b.estimateClass === 'E10', createdByName: v.name,
  }).returning({ id: budgetVersions.id, number: budgetVersions.number });
  await tx.insert(budgetLines).values(b.lines.map((l) => ({ budgetVersionId: bv.id, lotId: l.lotId, amountKeur: l.amountKeur })));
  const gatesText = t.gates.map((g) => `${g.code} ${g.decidedOn} (${g.decidedByName})`).join(', ');
  await writeAudit(tx, auditOf(v, c, `taken over in progress (N-20): Draft → Active, phase ${t.phase}; opened ${t.openedOn}; gates ${gatesText}; budget version ${bv.number} (${b.estimateClass}) validated ${b.validatedOn} by ${b.validatedByName}${t.mesStartedOn ? `; commissioning started ${t.mesStartedOn}` : ''}`, {
    entityType: 'capex', entityId: c.id, after: { ...t },
  }));
  await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'capex.taken_over', text: `${c.code} taken over in progress`, capexId: c.id });
  await enqueueEvent(tx, 'capex.opened', c.id, { openedOn: t.openedOn, takenOver: true, phase: t.phase });
  const [fresh] = await tx.select().from(capex).where(eq(capex.id, c.id));
  await recomputeTypology(tx, fresh as Row, v, today);
}

export async function recomputeTypology(tx: Tx, c: Row, v: Viewer, today: string) {
  if (c.typologySource === 'forced') return;
  const t = await computedTypologyOf(tx, c, today);
  if (!t.typology) return;
  if (!c.typology) {
    await tx.update(capex).set({ typology: t.typology, typologySource: 'computed', typologyProposed: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `typology: ${t.typology} (computed, ratio ${t.ratioPct ?? '—'} %)`, { entityType: 'capex', entityId: c.id }));
  } else if (t.typology !== c.typology) {
    await tx.update(capex).set({ typologyProposed: t.typology, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `typology to confirm: ${c.typology} → ${t.typology} (ratio ${t.ratioPct ?? '—'} %)`, { entityType: 'capex', entityId: c.id }));
  } else if (c.typologyProposed) {
    await tx.update(capex).set({ typologyProposed: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
  }
}
