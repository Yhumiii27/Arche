import 'server-only';
// Acting on a circuit step (docs/spec/05), shared by the step form and the advanced signature (AR-037): who may act (in their
// own right or standing in for an absent person, AR-041), what the step's outcome leads to (the decision when no required step
// is left, with the criteria evaluated then) — checked before anything is written, so an advanced signature is only asked when
// the decision can be applied — and the writes: the step, its signature, the audit, then the refusal or the gate decision.
import { eq } from 'drizzle-orm';
import {
  canActOn, circuitFacts, decisionOf, dueOf, isRefusal, isSigned, openGroup, refreshStatuses, STEP_KIND_LABEL,
  type Outcome, type StepActor, type StepKind, type StepState,
} from '@/domain/circuits';
import { CRITERIA, decideGate, evaluateGate, type CycleState, type GateCode } from '@/domain/lifecycle';
import { withPssrDischarge } from '@/domain/safety';
import { writeAudit } from '@/server/db/helpers';
import { circuitSteps, dossierVersions, gates, signatures } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';
import { auditOf, REFUSED_MSG, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { applyGateDecision } from '@/server/cycle/gate-decision';
import { gateFacts, modelValues, teamOf } from '@/server/dal/cycle';
import { standInFor, standInsOf } from '@/server/dal/absences';
import { stepsOf, type StepRow } from '@/server/dal/dossiers';

export type StepRecord = typeof circuitSteps.$inferSelect;
export type GateRecord = typeof gates.$inferSelect;

/** What the actor chose on a step. */
export interface StepInput {
  outcome: Outcome;
  comment: string | null;
  /** On the deciding step: one condition per line, and the criteria forced with their reason. */
  conditions: string[];
  forced: Record<string, string>;
}

export const asState = (s: StepRow): StepState & { actor: StepActor } => ({
  id: s.id, group: s.group, kind: s.kind as StepKind, optional: s.optional, decides: s.decides, status: s.status, outcome: (s.outcome as Outcome | null) ?? null, actor: s.actor as StepActor,
});

/** Writes the statuses the engine computes; a step that opens gets its opening date and deadline. */
export async function syncStatuses(tx: Tx, gate: GateCode, steps: StepRow[], today: string) {
  const values = await modelValues(tx);
  const next = refreshStatuses(steps.map(asState));
  for (const n of next) {
    const s = steps.find((x) => x.id === n.id)!;
    if (n.status === s.status) continue;
    const opening = n.status === 'open' && s.status === 'waiting';
    await tx.update(circuitSteps).set({ status: n.status, ...(opening ? { openedOn: today, dueOn: dueOf(s.kind as StepKind, gate, today, values) } : {}), updatedAt: new Date() }).where(eq(circuitSteps.id, s.id));
  }
}

/** The step and its running session, when the viewer may act on it now: in their own right or standing in (AR-041). */
export async function stepForActor(tx: Tx, c: CapexRowFull, v: Viewer, stepId: string, today: string): Promise<{ ok: false; error: string } | { ok: true; row: StepRecord; g: GateRecord; onBehalfOf: string | null }> {
  const [row] = await tx.select().from(circuitSteps).where(eq(circuitSteps.id, stepId));
  if (!row) return { ok: false, error: 'Unknown step' };
  const [g] = await tx.select().from(gates).where(eq(gates.id, row.gateId));
  if (!g || g.capexId !== c.id || g.status !== 'in_review') return { ok: false, error: 'This circuit is not running' };
  const team = await teamOf(tx, c.id);
  const actor = { role: v.role, userId: v.userId, assignments: v.assignments, internalClient: team.some((m) => m.userId === v.userId && m.capexRole === 'internal_client') };
  const own = canActOn({ actor: row.actor as StepActor, speciality: row.speciality, assigneeUserId: row.assigneeUserId }, actor, c);
  const standIn = own ? null : standInFor(row, c, await standInsOf(tx, v.userId, today));
  if (!own && !standIn) return { ok: false, error: REFUSED_MSG };
  // A suspended, closed or abandoned CAPEX is read-only.
  if (c.status !== 'active') return { ok: false, error: REFUSED_MSG };
  return { ok: true, row, g, onBehalfOf: standIn?.person.displayName ?? null };
}

export interface StepPlan {
  steps: StepRow[];
  version: typeof dossierVersions.$inferSelect | null;
  refused: boolean;
  decided: { decision: NonNullable<ReturnType<typeof decisionOf>>; next: CycleState; ev: ReturnType<typeof evaluateGate> } | null;
}

/** What the outcome leads to, before anything is written: a refusal stops the circuit; the last required step decides. */
export async function planStep(tx: Tx, c: CapexRowFull, row: StepRecord, g: GateRecord, input: StepInput): Promise<{ ok: false; error: string } | { ok: true; plan: StepPlan }> {
  const version = g.dossierVersionId ? (await tx.select().from(dossierVersions).where(eq(dossierVersions.id, g.dossierVersionId)))[0] ?? null : null;
  const steps = await stepsOf(tx, [g.id]);
  const after = refreshStatuses(steps.map((s) => (s.id === row.id ? { ...asState(s), status: 'done' as const, outcome: input.outcome } : asState(s))));
  const refused = isRefusal(input.outcome);
  const complete = !refused && openGroup(after) == null;
  let decided: StepPlan['decided'] = null;
  if (complete) {
    const deciding = after.find((s) => s.decides);
    const decision = deciding ? decisionOf(deciding) : null;
    if (!decision) return { ok: false, error: 'The circuit has no decision' };
    const forced = Object.fromEntries(CRITERIA.filter((x) => x.gate === g.code && input.forced[x.code]?.trim()).map((x) => [x.code, input.forced[x.code].trim()]));
    const dossierFact = version ? { [`${g.code.toLowerCase()}_dossier`]: { met: version.completenessPct === 100, value: `v${version.number} · ${version.completenessPct} %` } } : {};
    const facts = { ...(await gateFacts(tx, c)), ...circuitFacts(g.code as GateCode, after), ...dossierFact };
    const ev = evaluateGate(g.code as GateCode, withPssrDischarge(facts), forced);
    const t = decideGate(c as CycleState, g.code as GateCode, decision, ev, { reason: input.comment, conditions: input.conditions });
    if (!t.ok) return t;
    decided = { decision, next: t.value, ev };
  }
  return { ok: true, plan: { steps, version, refused, decided } };
}

/** The statement a signer confirms (and the signature row keeps). */
export function statementOf(row: StepRecord, c: { code: string }, g: GateRecord, version: StepPlan['version'], outcome: string, onBehalfOf: string | null): string {
  return `${row.label} — ${c.code}, ${g.code} session ${g.session}${version ? `, dossier version ${version.number}, SHA-256 ${version.contentHash}` : ''}: ${outcome}${onBehalfOf ? ` (on behalf of ${onBehalfOf}, absent)` : ''}`;
}

/** Writes the step's outcome planned by planStep; a signed step leaves its signature (simple, or advanced with the provider's reference). */
export async function applyStep(
  tx: Tx, c: CapexRowFull, v: Viewer, today: string, row: StepRecord, g: GateRecord, plan: StepPlan, input: StepInput,
  sig: { onBehalfOf: string | null; ipHash: string | null; level: 'simple' | 'advanced'; providerRef: string | null },
): Promise<ActionResult> {
  const { steps, version, refused, decided } = plan;
  const { outcome, comment } = input;
  const onBehalfOf = sig.onBehalfOf;
  await tx.update(circuitSteps).set({ status: 'done', outcome, comment, actedByName: v.name, actedByUserId: v.userId, actedAt: new Date(), onBehalfOfName: onBehalfOf, updatedAt: new Date() }).where(eq(circuitSteps.id, row.id));
  if (isSigned(row.kind as StepKind)) {
    const statement = statementOf(row, c, g, version, outcome, onBehalfOf);
    await tx.insert(signatures).values({ circuitStepId: row.id, userId: v.userId, userName: v.name, contentHash: version?.contentHash ?? null, statement, authTime: v.authenticatedAt ?? null, ipHash: sig.ipHash, level: sig.level, providerRef: sig.providerRef });
  }
  const how = sig.level === 'advanced' ? ` (advanced signature, ${sig.providerRef})` : '';
  await writeAudit(tx, auditOf(v, c, `${g.code} session ${g.session}: ${STEP_KIND_LABEL[row.kind as StepKind].toLowerCase()} "${row.label}" — ${outcome}${onBehalfOf ? ` (on behalf of ${onBehalfOf}, absent)` : ''}${how}`, { entityType: 'circuit_step', entityId: row.id, reason: comment }));

  if (refused) {
    // A refusal stops the circuit and sends the dossier back (spec 05 §1).
    await tx.update(gates).set({ status: 'returned', updatedAt: new Date() }).where(eq(gates.id, g.id));
    for (const s of steps.filter((x) => x.id !== row.id && (x.status === 'open' || x.status === 'waiting'))) await tx.update(circuitSteps).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(circuitSteps.id, s.id));
    if (version) await tx.update(dossierVersions).set({ state: 'rejected', updatedAt: new Date() }).where(eq(dossierVersions.id, version.id));
    await writeAudit(tx, auditOf(v, c, `${g.code} session ${g.session}: circuit stopped (refused), dossier sent back`, { entityType: 'gate', entityId: g.id, reason: comment }));
    return { ok: true };
  }
  if (decided) {
    for (const s of steps.filter((x) => x.id !== row.id && (x.status === 'open' || x.status === 'waiting'))) await tx.update(circuitSteps).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(circuitSteps.id, s.id));
    await applyGateDecision(tx, c, v, { id: g.id, code: g.code as GateCode, session: g.session }, decided.decision, decided.next, decided.ev, { reason: comment, conditions: input.conditions, today });
    if (version) {
      const state = decided.decision === 'go' || decided.decision === 'go_with_conditions' ? 'approved' : decided.decision === 'no_go' ? 'rejected' : 'frozen';
      if (state !== 'frozen') await tx.update(dossierVersions).set({ state, updatedAt: new Date() }).where(eq(dossierVersions.id, version.id));
    }
    return { ok: true };
  }
  await syncStatuses(tx, g.code as GateCode, await stepsOf(tx, [g.id]), today);
  return { ok: true };
}
