import 'server-only';
// Prioritisation and scenarios reads (delivery 7, lot 7c): the grid's weights, the score of each CAPEX (computed criteria from
// its business plan, reference budget and open risks; manual ones from the group's scores) and its rank (AR-044); the portfolio
// scenarios evaluated on the CAPEX open, on hold or in draft with a budget (AR-043). In a fixed number of queries.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { isMajorRisk } from '@/domain/capex';
import { npv, irr } from '@/domain/bp';
import { monthOf } from '@/domain/execution';
import { evaluate, type ScenarioCapex } from '@/domain/scenarios';
import { criteriaScores, SCORING_CRITERIA, totalScore, type CriterionScore } from '@/domain/scoring';
import { businessPlans, capex, capexScores, portfolioScenarios, risks, scenarioItems, scoringWeights } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { phasedCapex } from './finance';

type Q = DB | Tx;

export async function weightsOf(q: Q): Promise<Record<string, number>> {
  const rows = await q.select().from(scoringWeights);
  return Object.fromEntries(SCORING_CRITERIA.map((c) => [c.code, rows.find((r) => r.code === c.code)?.weight ?? c.weight]));
}

export interface Priority {
  criteria: CriterionScore[];
  score: number | null;
  coveragePct: number;
  npvKeur: number | null;
  majorRisks: number;
}

/** The priority of each CAPEX (by id), its BAC given (the reference budget; the dashboards' or the phasing's). */
export async function prioritiesOf(q: Q, cs: readonly { id: string; bacKeur: number | null }[]): Promise<Map<string, Priority>> {
  const out = new Map<string, Priority>();
  if (!cs.length) return out;
  const ids = cs.map((c) => c.id);
  const [weights, bps, rs, scores] = await Promise.all([
    weightsOf(q),
    q.select().from(businessPlans).where(inArray(businessPlans.capexId, ids)),
    q.select({ capexId: risks.capexId, p: risks.probability, i: risks.impact }).from(risks).where(and(inArray(risks.capexId, ids), inArray(risks.status, ['open', 'mitigated']))),
    q.select().from(capexScores).where(inArray(capexScores.capexId, ids)),
  ]);
  for (const c of cs) {
    const bp = bps.find((b) => b.capexId === c.id);
    const mine = rs.filter((r) => r.capexId === c.id);
    const facts = { npvKeur: bp ? npv(bp.discountRatePct, bp.flows) : null, irrPct: bp ? irr(bp.flows) : null, bacKeur: c.bacKeur, majorRisks: mine.filter((r) => isMajorRisk(r.p, r.i)).length, openRisks: mine.length };
    const manual = Object.fromEntries(scores.filter((s) => s.capexId === c.id).map((s) => [s.criterionCode, { score: s.score, note: s.note }]));
    const criteria = criteriaScores(weights, facts, manual);
    out.set(c.id, { criteria, ...totalScore(criteria), npvKeur: facts.npvKeur, majorRisks: facts.majorRisks });
  }
  return out;
}

/** The manual scores of a CAPEX with who gave them. */
export async function scoresOf(q: Q, capexId: string) {
  return q.select().from(capexScores).where(eq(capexScores.capexId, capexId));
}

/** The CAPEX the scenarios work on: open, on hold, or in draft with a phased budget; with their return, risks and score. */
export async function scenarioCapex(q: Q, today: string): Promise<(ScenarioCapex & { subsidiaryCode: string; status: string; bacKeur: number })[]> {
  const drafts = (await q.select({ id: capex.id }).from(capex).where(eq(capex.status, 'draft'))).map((d) => d.id);
  const phased = (await phasedCapex(q, today, drafts)).filter((p) => p.status !== 'draft' || p.bacKeur > 0);
  const prio = await prioritiesOf(q, phased.map((p) => ({ id: p.id, bacKeur: p.bacKeur })));
  return phased.map((p) => ({ id: p.id, code: p.code, subsidiaryCode: p.subsidiaryCode, status: p.status, bacKeur: p.bacKeur, months: p.months, npvKeur: prio.get(p.id)!.npvKeur, majorRisks: prio.get(p.id)!.majorRisks, score: prio.get(p.id)!.score }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Every scenario evaluated, newest first; the retained one flagged. */
export async function scenariosOf(q: Q, today: string) {
  const [list, capexRows] = await Promise.all([q.select().from(portfolioScenarios).orderBy(desc(portfolioScenarios.retained), asc(portfolioScenarios.createdAt)), scenarioCapex(q, today)]);
  const items = list.length ? await q.select().from(scenarioItems).where(inArray(scenarioItems.scenarioId, list.map((s) => s.id))) : [];
  const current = monthOf(today);
  return {
    capex: capexRows,
    scenarios: list.map((s) => {
      const mine = items.filter((i) => i.scenarioId === s.id).filter((i) => capexRows.some((c) => c.id === i.capexId));
      const env = Object.fromEntries(Object.entries(s.envelopes).map(([y, v]) => [Number(y), v]));
      return { ...s, items: mine, result: evaluate(mine, env, capexRows, current) };
    }),
  };
}

