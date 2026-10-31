import 'server-only';
// Decision aid of a CAPEX by rules (AR-037, docs/spec/06 §7): the forecast of its execution (S-curve and EAC projected from its
// own months, cost and schedule drift), the reference class of the CAPEX the viewer sees that are built or well advanced (cost
// against their G2 budget) with the likely final cost of its budget, and the brief of what a decider looks at before a gate.
// No AI and nothing sent outside (C-13).
import { eq, inArray } from 'drizzle-orm';
import { irr, npv, payback } from '@/domain/bp';
import { forecastOf, likelyRange, referenceClass, type Reference } from '@/domain/forecast';
import type { Outcome } from '@/domain/circuits';
import { currentGate, type CycleState } from '@/domain/lifecycle';
import { businessPlans, capex, capexLots, closureStatements, lotFinalCosts } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';
import { currentEvaluation } from '@/server/cycle/evaluation';
import { visibleCapex } from './capex';
import { gatesOf, risksOf, versionsOf } from './cycle';
import { stepsOf } from './dossiers';
import { executionOf } from './execution';
import { capexDashboards } from './governance';

type Q = DB | Tx;

/** A CAPEX in execution counts in the reference class once this share of its budget is earned. */
const ADVANCED_SHARE = 0.5;

/** The CAPEX the viewer sees that tell how far a cost ends from its G2 budget: closed (final cost) or well advanced (EAC). */
export async function referencesFor(q: Q, viewer: Viewer, today: string): Promise<Reference[]> {
  const seen = (await visibleCapex(viewer)).filter((c) => c.status === 'closed' || (c.status === 'active' && (c.phase === 'execution' || c.phase === 'demarrage')));
  if (!seen.length) return [];
  const rows = await q.select({ id: capex.id, code: capex.code, status: capex.status, phase: capex.phase, typology: capex.typology, typologyProposed: capex.typologyProposed, openedAt: capex.openedAt, investmentType: capex.investmentType })
    .from(capex).where(inArray(capex.id, seen.map((c) => c.id)));
  const [dashes, closures] = await Promise.all([capexDashboards(q, rows, today), q.select({ capexId: closureStatements.capexId }).from(closureStatements).where(inArray(closureStatements.capexId, rows.map((r) => r.id)))]);
  const closed = new Set(closures.map((x) => x.capexId));
  const lots = closed.size ? await q.select({ id: capexLots.id, capexId: capexLots.capexId }).from(capexLots).where(inArray(capexLots.capexId, [...closed])) : [];
  const costs = lots.length ? await q.select().from(lotFinalCosts).where(inArray(lotFinalCosts.lotId, lots.map((l) => l.id))) : [];
  const finalOf = (capexId: string) => {
    const mine = costs.filter((x) => lots.some((l) => l.id === x.lotId && l.capexId === capexId));
    return mine.length ? mine.reduce((s, x) => s + x.finalKeur, 0) : null;
  };
  const out: Reference[] = [];
  for (const [i, r] of rows.entries()) {
    const d = dashes[i];
    if (!d.g2Keur) continue;
    const final = closed.has(r.id) ? finalOf(r.id) : null;
    if (final != null) out.push({ code: r.code, investmentType: r.investmentType, g2Keur: d.g2Keur, outcomeKeur: final, final: true });
    else if (d.indicators.bacKeur > 0 && d.indicators.evKeur / d.indicators.bacKeur >= ADVANCED_SHARE) out.push({ code: r.code, investmentType: r.investmentType, g2Keur: d.g2Keur, outcomeKeur: d.indicators.eacKeur, final: false });
  }
  return out;
}

/** The decision aid of a CAPEX the viewer sees (the caller has read it through the visibility filter). */
export async function decisionAidOf(q: Q, viewer: Viewer, c: CycleState & { id: string; code: string; typology: string | null; investmentType: string }, today: string) {
  const [exec, versions, [bp], risks, sessions, refs, ev] = await Promise.all([
    executionOf(q, c, today), versionsOf(q, c.id), q.select().from(businessPlans).where(eq(businessPlans.capexId, c.id)),
    risksOf(q, c.id), gatesOf(q, c.id), referencesFor(q, viewer, today), currentEvaluation(q, c),
  ]);
  const measured = exec.indicators.acKeur > 0 || exec.indicators.evKeur > 0;
  const forecast = measured ? forecastOf(exec.curve, exec.indicators.bacKeur, exec.month) : null;
  const latest = versions[0] ?? null;
  const budgetKeur = exec.g2Keur ?? latest?.centralKeur ?? null;
  const rc = referenceClass(refs, c.investmentType, c.code);
  const range = rc && budgetKeur ? { ...likelyRange(budgetKeur, rc), budgetKeur } : null;
  const flows = bp?.flows ?? [];
  const plan = flows.length ? { npvKeur: Math.round(npv(bp!.discountRatePct, flows)), irrPct: irr(flows), paybackYears: payback(flows), validated: !!bp!.validatedAt } : null;
  // The opinions of the running session of the gate the CAPEX faces, else of its last session.
  const gate = currentGate(c);
  const session = sessions.filter((g) => g.code === gate).at(-1) ?? null;
  const opinions = session ? (await stepsOf(q, [session.id])).filter((s) => s.kind === 'opinion') : [];
  const count = (o: Outcome) => opinions.filter((s) => s.outcome === o).length;
  return {
    gate,
    exec,
    forecast,
    reference: rc,
    range,
    brief: {
      budget: latest ? { keur: latest.centralKeur, estimateClass: latest.estimateClass, version: latest.number } : null,
      plan,
      criteria: ev ? { met: ev.results.filter((r) => r.state === 'met').length, forced: ev.results.filter((r) => r.state === 'forced').length, unmet: ev.results.filter((r) => r.state === 'unmet').map((r) => r.label) } : null,
      opinions: opinions.length ? { favourable: count('favorable'), reserved: count('reserved'), unfavourable: count('unfavorable'), missing: opinions.filter((s) => s.status !== 'done').length } : null,
      risks: risks.filter((r) => r.status === 'open' && r.probability * r.impact >= 9).sort((a, b) => b.probability * b.impact - a.probability * a.impact).slice(0, 3),
    },
  };
}

export type DecisionAid = Awaited<ReturnType<typeof decisionAidOf>>;
