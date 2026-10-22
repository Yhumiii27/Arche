import 'server-only';
// Reads of one CAPEX's cycle (delivery 2): lots, budget versions, typology, team, risks, decisions, gates and their criteria
// facts, the DIG-PRODI model values and the journal. These take the CAPEX id of a row already read through the visibility
// filter (capexForViewer, ./capex.ts) or locked by a writer — never an id from the request.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { centralOf, computeTypology, meetsClass, missingStaff, referenceRevenueOf, type EstimateClass, type TypologyResult } from '@/domain/budget';
import { MODEL_CODE, MODEL_VERSION, readValues, type CriterionFact, type GateCode, type ModelValues } from '@/domain/lifecycle';
import {
  activityEvents, auditEntries, budgetLines, budgetVersions, capex, capexLots, capexMembers, decisions, gateConditions, gateCriteriaResults, gates,
  lifecycleModels, phaseTransitions, referenceRevenues, risks, users,
} from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

type Q = DB | Tx;

/** Adjustable values of the active DIG-PRODI 4.0 model (defaults until the administrator changes one). */
export async function modelValues(q: Q): Promise<ModelValues> {
  const [m] = await q.select({ d: lifecycleModels.definition }).from(lifecycleModels).where(and(eq(lifecycleModels.code, MODEL_CODE), eq(lifecycleModels.version, MODEL_VERSION)));
  return readValues(m?.d);
}

export async function lotsOf(q: Q, capexId: string) {
  return q.select().from(capexLots).where(eq(capexLots.capexId, capexId)).orderBy(asc(capexLots.number));
}

export interface VersionView {
  id: string;
  number: number;
  estimateClass: EstimateClass;
  status: 'draft' | 'submitted' | 'validated' | 'superseded';
  basis: string | null;
  centralKeur: number;
  lines: Record<string, number>;
  validatedByName: string | null;
  validatedAt: Date | null;
  isG2Baseline: boolean;
  createdByName: string;
  createdAt: Date;
}

/** Budget versions, newest first, with their lines (lot id → k€) and central amount. */
export async function versionsOf(q: Q, capexId: string): Promise<VersionView[]> {
  const vs = await q.select().from(budgetVersions).where(eq(budgetVersions.capexId, capexId)).orderBy(desc(budgetVersions.number));
  if (!vs.length) return [];
  const ls = await q.select().from(budgetLines).where(inArray(budgetLines.budgetVersionId, vs.map((v) => v.id)));
  return vs.map((v) => {
    const mine = ls.filter((l) => l.budgetVersionId === v.id);
    return {
      id: v.id, number: v.number, estimateClass: v.estimateClass, status: v.status, basis: v.basis, centralKeur: centralOf(mine),
      lines: Object.fromEntries(mine.map((l) => [l.lotId, l.amountKeur])), validatedByName: v.validatedByName, validatedAt: v.validatedAt,
      isG2Baseline: v.isG2Baseline, createdByName: v.createdByName, createdAt: v.createdAt,
    };
  });
}

/** The latest validated version (the reference of the typology and of the G1 / G2 criteria). */
export const latestValidated = (vs: readonly VersionView[]) => vs.find((v) => v.status === 'validated') ?? null;

export interface TypologyView extends TypologyResult {
  revenueYear: number | null;
  revenueKeur: number | null;
}

/** Computed typology of a CAPEX from its latest validated version and its subsidiary's reference revenue (C-5). */
export async function computedTypologyOf(q: Q, c: { id: string; subsidiaryCode: string; investmentType: string }, today: string, values?: ModelValues): Promise<TypologyView> {
  const [vs, revs, v] = await Promise.all([
    versionsOf(q, c.id),
    q.select({ fiscalYear: referenceRevenues.fiscalYear, revenueKeur: referenceRevenues.revenueKeur }).from(referenceRevenues).where(eq(referenceRevenues.subsidiaryCode, c.subsidiaryCode)),
    values ? Promise.resolve(values) : modelValues(q),
  ]);
  const rev = referenceRevenueOf(revs, today);
  const r = computeTypology({ investmentType: c.investmentType, centralKeur: latestValidated(vs)?.centralKeur ?? null, revenueKeur: rev?.revenueKeur ?? null, thresholdPct: v.strategicRatioPct });
  return { ...r, revenueYear: rev?.fiscalYear ?? null, revenueKeur: rev?.revenueKeur ?? null };
}

export async function teamOf(q: Q, capexId: string) {
  return q
    .select({ id: capexMembers.id, userId: capexMembers.userId, capexRole: capexMembers.capexRole, name: users.displayName, email: users.email, jobTitle: users.jobTitle, subsidiaryCode: users.subsidiaryCode })
    .from(capexMembers)
    .innerJoin(users, eq(users.id, capexMembers.userId))
    .where(eq(capexMembers.capexId, capexId))
    .orderBy(asc(capexMembers.capexRole), asc(users.displayName));
}

export async function risksOf(q: Q, capexId: string) {
  return q
    .select({
      id: risks.id, number: risks.number, title: risks.title, category: risks.category, probability: risks.probability, impact: risks.impact, ownerUserId: risks.ownerUserId,
      ownerName: users.displayName, response: risks.response, status: risks.status, dueOn: risks.dueOn,
    })
    .from(risks)
    .leftJoin(users, eq(users.id, risks.ownerUserId))
    .where(eq(risks.capexId, capexId))
    .orderBy(asc(risks.number));
}

export async function decisionsOf(q: Q, capexId: string) {
  return q.select().from(decisions).where(eq(decisions.capexId, capexId)).orderBy(desc(decisions.takenOn), desc(decisions.number));
}

export async function gatesOf(q: Q, capexId: string) {
  const gs = await q.select().from(gates).where(eq(gates.capexId, capexId)).orderBy(asc(gates.createdAt));
  if (!gs.length) return [];
  const ids = gs.map((g) => g.id);
  const [crit, conds] = await Promise.all([
    q.select().from(gateCriteriaResults).where(inArray(gateCriteriaResults.gateId, ids)),
    q.select().from(gateConditions).where(inArray(gateConditions.gateId, ids)).orderBy(asc(gateConditions.number)),
  ]);
  return gs.map((g) => ({ ...g, criteria: crit.filter((c) => c.gateId === g.id), conditions: conds.filter((c) => c.gateId === g.id) }));
}

export async function transitionsOf(q: Q, capexId: string) {
  return q.select().from(phaseTransitions).where(eq(phaseTransitions.capexId, capexId)).orderBy(desc(phaseTransitions.occurredAt));
}

/**
 * The facts of the criteria Arche can evaluate in delivery 2 (budget class, typology, staffing). The other criteria have no
 * fact yet: their data comes with later deliveries and they are "not evaluated" (src/domain/lifecycle.ts).
 */
export async function gateFacts(q: Q, c: { id: string; typology: string | null }): Promise<Record<string, CriterionFact>> {
  const [vs, team] = await Promise.all([versionsOf(q, c.id), teamOf(q, c.id)]);
  const validated = latestValidated(vs);
  const typology = (c.typology as 'light' | 'strategic' | null) ?? null;
  const missing = missingStaff(typology, team.map((m) => m.capexRole));
  const staffing: CriterionFact = { met: missing.length === 0, value: missing.length ? missing.join(', ') : undefined };
  const e10 = vs.find((v) => v.status === 'validated' && v.estimateClass === 'E10');
  return {
    g1_budget_e50: { met: meetsClass(validated?.estimateClass, 'E50'), value: validated?.estimateClass ?? '—' },
    g1_typology: { met: !!typology, value: typology ?? undefined },
    g1_staffing: staffing,
    g2_budget_e10: { met: !!e10, value: validated?.estimateClass ?? '—' },
    g2_staffing: staffing,
  };
}

/** Next session number of a gate. */
export async function nextSession(q: Q, capexId: string, code: GateCode): Promise<number> {
  const rows = await q.select({ s: gates.session }).from(gates).where(and(eq(gates.capexId, capexId), eq(gates.code, code)));
  return rows.reduce((m, r) => Math.max(m, r.s), 0) + 1;
}

/** Audit trail and activity of a CAPEX, newest first. */
export async function journalOf(q: Q, capexId: string, limit = 200) {
  const [a, e] = await Promise.all([
    q.select({ at: auditEntries.occurredAt, who: auditEntries.actorName, role: auditEntries.actorRole, what: auditEntries.change, object: auditEntries.objectRef, area: auditEntries.area, reason: auditEntries.reason })
      .from(auditEntries).where(eq(auditEntries.capexId, capexId)).orderBy(desc(auditEntries.occurredAt)).limit(limit),
    q.select({ at: activityEvents.occurredAt, who: activityEvents.actorName, what: activityEvents.text }).from(activityEvents).where(eq(activityEvents.capexId, capexId)).orderBy(desc(activityEvents.occurredAt)).limit(limit),
  ]);
  return [...a.map((x) => ({ kind: 'audit' as const, ...x })), ...e.map((x) => ({ kind: 'activity' as const, role: null, object: null, area: null, reason: null, ...x }))]
    .sort((x, y) => y.at.getTime() - x.at.getTime())
    .slice(0, limit);
}

/** The full row of a CAPEX by id (writers: after the visibility check). */
export async function capexRow(q: Q, id: string) {
  return (await q.select().from(capex).where(eq(capex.id, id)))[0] ?? null;
}

/** People who can be named on the team of a CAPEX of `subsidiaryCode`: active, of that subsidiary or of the group. */
export async function teamCandidates(q: Q, subsidiaryCode: string): Promise<{ id: string; name: string }[]> {
  const rows = await q.select({ id: users.id, name: users.displayName, sub: users.subsidiaryCode }).from(users).where(eq(users.active, true)).orderBy(asc(users.displayName));
  return rows.filter((u) => !u.sub || u.sub === subsidiaryCode).map(({ id, name }) => ({ id, name }));
}
