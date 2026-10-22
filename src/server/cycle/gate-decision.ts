import 'server-only';
// The effect of a gate decision (docs/spec/03 §2), recorded by the deciding step of the gate's circuit (src/features/gates):
// the gate session is decided with its criteria snapshot and its conditions, the CAPEX changes phase or status, the cycle
// history, the decisions register, the G2 baseline, the machine needs ordered and the audit trail are written — all in the caller's transaction.
import { and, eq } from 'drizzle-orm';
import { nextNumber } from '@/domain/capex';
import { isValidFirmOffer, latestAnswer, needRef } from '@/domain/needs';
import type { GateCode, GateDecision, GateEvaluation, CycleState } from '@/domain/lifecycle';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { budgetVersions, capex, decisions, machineNeeds, gateConditions, gateCriteriaResults, gates, phaseTransitions } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { auditOf } from '@/server/capex/write';
import { answersOf } from '@/server/integrations/keystone';

const PHASE_NO: Record<string, number> = { cadrage: 1, avant_projet: 2, execution: 3, demarrage: 4 };

export async function applyGateDecision(
  tx: Tx,
  c: { id: string; code: string; status: string; phase: string },
  actor: { name: string; userId: string; role: string },
  g: { id: string; code: GateCode; session: number },
  decision: GateDecision,
  next: CycleState,
  ev: GateEvaluation,
  opts: { reason: string | null; conditions: readonly string[]; today: string },
): Promise<void> {
  const { reason, conditions, today } = opts;
  await tx.update(gates).set({ status: 'decided', decision, decisionReason: reason, decidedAt: new Date(), decidedByName: actor.name, decidedByUserId: actor.userId, updatedAt: new Date() }).where(eq(gates.id, g.id));
  await tx.delete(gateCriteriaResults).where(eq(gateCriteriaResults.gateId, g.id));
  await tx.insert(gateCriteriaResults).values(ev.results.map((r) => ({ gateId: g.id, criterionCode: r.code, state: r.state, value: r.value, forcedReason: r.forcedReason })));
  if (conditions.length && decision === 'go_with_conditions') await tx.insert(gateConditions).values(conditions.map((text, i) => ({ gateId: g.id, number: i + 1, text })));
  const anyForced = ev.results.some((r) => r.state === 'forced');
  if (next.status !== c.status || next.phase !== c.phase) {
    await tx.update(capex).set({ ...next, closedAt: next.status === 'closed' || next.status === 'abandoned' ? new Date() : null, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await tx.insert(phaseTransitions).values({
      capexId: c.id, fromStatus: c.status, fromPhase: c.phase, toStatus: next.status, toPhase: next.phase, gateCode: g.code, effectiveOn: today, forced: anyForced, reason, byName: actor.name, byUserId: actor.userId,
    });
  }
  if (g.code === 'G2' && (decision === 'go' || decision === 'go_with_conditions')) {
    await tx.update(budgetVersions).set({ isG2Baseline: true, updatedAt: new Date() }).where(and(eq(budgetVersions.capexId, c.id), eq(budgetVersions.status, 'validated'), eq(budgetVersions.estimateClass, 'E10')));
    // The submitted machine needs with a valid firm EPC2i offer are ordered (spec 07 §1); the others stay submitted.
    const answers = await answersOf(tx, c.code);
    for (const n of await tx.select().from(machineNeeds).where(and(eq(machineNeeds.capexId, c.id), eq(machineNeeds.status, 'submitted')))) {
      const ref = needRef(c.code, n.number);
      if (!isValidFirmOffer(latestAnswer(answers, ref), today)) continue;
      await tx.update(machineNeeds).set({ status: 'ordered', orderedOn: today, updatedAt: new Date() }).where(eq(machineNeeds.id, n.id));
      await writeAudit(tx, auditOf(actor, c, `machine need ${ref} ordered (G2 Go)`, { entityType: 'machine_need', entityId: n.id }));
    }
  }
  const number = nextNumber((await tx.select({ n: decisions.number }).from(decisions).where(eq(decisions.capexId, c.id))).map((x) => x.n));
  const body = g.code === 'G1' ? 'copil_gpi' : g.code === 'G2' ? 'ceo' : 'dir_ig';
  await tx.insert(decisions).values({ capexId: c.id, number, takenOn: today, body, text: `${g.code} ${decision}${reason ? ` — ${reason}` : ''}`, gateId: g.id, recordedByName: actor.name });
  for (const r of ev.results.filter((x) => x.state === 'forced')) {
    await writeAudit(tx, auditOf(actor, c, `${g.code}: criterion forced (${r.code})`, { entityType: 'gate', entityId: g.id, reason: r.forcedReason }));
  }
  const label = next.status === 'closed' ? 'closed' : next.status === 'abandoned' ? 'abandoned' : `phase ${PHASE_NO[next.phase]}`;
  await writeAudit(tx, auditOf(actor, c, `${g.code} session ${g.session}: ${decision} → ${label}`, { entityType: 'gate', entityId: g.id, reason }));
  await recordActivity(tx, { actorName: actor.name, actorUserId: actor.userId, kind: 'gate.decided', text: `${c.code}: ${g.code} ${decision}`, capexId: c.id });
}
