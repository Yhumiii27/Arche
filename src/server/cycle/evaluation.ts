import 'server-only';
// The criteria of the gate a CAPEX faces, evaluated now (docs/spec/03 §3): Arche's facts (budget, typology, staffing), the
// circuit's (opinions given, sponsor visa) and the dossier's (latest version of the gate's dossier: frozen and complete).
import { circuitFacts, type StepActor, type StepKind } from '@/domain/circuits';
import { DOSSIER_OF_GATE } from '@/domain/dossiers';
import { currentGate, evaluateGate, type CycleState, type GateEvaluation } from '@/domain/lifecycle';
import type { DB, Tx } from '@/server/db/types';
import { gateFacts } from '@/server/dal/cycle';
import { dossierVersionsOf, runningSession, stepsOf } from '@/server/dal/dossiers';

export async function currentEvaluation(q: DB | Tx, c: CycleState & { id: string; typology: string | null }): Promise<GateEvaluation | null> {
  const gate = currentGate(c);
  if (!gate) return null;
  const facts = { ...(await gateFacts(q, c)) };
  const session = await runningSession(q, c.id, gate);
  if (session) {
    const steps = await stepsOf(q, [session.id]);
    Object.assign(facts, circuitFacts(gate, steps.map((s) => ({ id: s.id, group: s.group, kind: s.kind as StepKind, optional: s.optional, decides: s.decides, status: s.status, outcome: null, actor: s.actor as StepActor }))));
  }
  const kind = DOSSIER_OF_GATE[gate];
  if (kind) {
    const [v] = await dossierVersionsOf(q, c.id, kind);
    const done = !!v && v.state !== 'draft' && v.state !== 'superseded' && v.state !== 'rejected';
    facts[`${gate.toLowerCase()}_dossier`] = { met: done && v.completenessPct === 100, value: v ? `v${v.number} · ${v.completenessPct} %` : '—' };
  }
  return evaluateGate(gate, facts);
}
