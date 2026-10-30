import 'server-only';
// Benefits realised and post-audits of a CAPEX (AR-046): its validated business plan, the years entered, the realised returns
// (the investment at its final cost once the accounting closure is entered) and its post-audits.
import { asc, eq, inArray } from 'drizzle-orm';
import { benefitRows, postAuditsOf, realisedFlows, returnsOf } from '@/domain/benefits';
import { benefitActuals, businessPlans, capexLots, closureStatements, lotFinalCosts, postAudits } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

type Q = DB | Tx;

export async function benefitsOf(q: Q, c: { id: string; mesStartedOn: string | null }, today: string) {
  const [[bp], actuals, audits, [closure]] = await Promise.all([
    q.select().from(businessPlans).where(eq(businessPlans.capexId, c.id)),
    q.select().from(benefitActuals).where(eq(benefitActuals.capexId, c.id)).orderBy(asc(benefitActuals.year)),
    q.select().from(postAudits).where(eq(postAudits.capexId, c.id)).orderBy(asc(postAudits.milestone)),
    q.select().from(closureStatements).where(eq(closureStatements.capexId, c.id)),
  ]);
  let finalCostKeur: number | null = null;
  if (closure) {
    const lots = (await q.select({ id: capexLots.id }).from(capexLots).where(eq(capexLots.capexId, c.id))).map((l) => l.id);
    const costs = lots.length ? await q.select().from(lotFinalCosts).where(inArray(lotFinalCosts.lotId, lots)) : [];
    finalCostKeur = costs.length ? costs.reduce((s, x) => s + x.finalKeur, 0) : null;
  }
  const plan = bp?.flows ?? [];
  const realised = realisedFlows(plan, actuals, finalCostKeur);
  return {
    bp: bp ?? null,
    actuals,
    rows: benefitRows(plan, actuals),
    finalCostKeur,
    returns: bp ? returnsOf(bp.discountRatePct, plan, realised) : null,
    audits: postAuditsOf(c.mesStartedOn, audits, today).map((a) => ({ ...a, record: audits.find((x) => x.milestone === a.milestone) ?? null })),
  };
}
