import 'server-only';
// Reads of a CAPEX's delivery and safety (delivery 5): permits, safety milestones, engineering pack (the subsidiary's part and
// EPC2i's, read in the Keystone mirror), lots with their planned window and budget, monthly actuals (EPC2i lots from their
// projects), the S-curve and its indicators, and the facts of the gate criteria these data feed. Callers pass the CAPEX of a
// row already read through the visibility filter.
import { asc, eq, inArray } from 'drizzle-orm';
import { actualAt, epc2iLotValues, indicatorsAt, monthOf, sCurve, worksFact, type LotActual, type LotPlan } from '@/domain/execution';
import { packFact, packSummary, type Epc2iPackRow, type PackItemState } from '@/domain/pack';
import { permitsFact, type PermitState } from '@/domain/permits';
import { safetyFacts, type HsState } from '@/domain/safety';
import type { CriterionFact, ModelValues } from '@/domain/lifecycle';
import { authorizations, capexLots, hsStatuses, lotActuals, packItems } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { projectsOf, type Epc2iProject } from '@/server/integrations/keystone';
import { needsOf } from './needs';
import { startupFacts } from './rampup';
import { latestValidated, versionsOf } from './cycle';

type Q = DB | Tx;

export async function permitsOf(q: Q, capexId: string) {
  return q.select().from(authorizations).where(eq(authorizations.capexId, capexId)).orderBy(asc(authorizations.number));
}

export async function hsOf(q: Q, capexId: string): Promise<HsState[]> {
  const rows = await q.select().from(hsStatuses).where(eq(hsStatuses.capexId, capexId));
  return rows.map((r) => ({ code: r.hsCode, status: r.status, evidenceRef: r.evidenceRef, passedOn: r.passedOn, note: r.note, source: r.source }));
}

export async function packItemsOf(q: Q, capexId: string): Promise<PackItemState[]> {
  const rows = await q.select().from(packItems).where(eq(packItems.capexId, capexId));
  return rows.map((r) => ({ code: r.itemCode, status: r.status, codexRef: r.codexRef, validatedOn: r.validatedOn }));
}

/** EPC2i's pack rows of the CAPEX's projects. */
export const epc2iPackOf = (projects: readonly Epc2iProject[]): Epc2iPackRow[] =>
  projects.flatMap((p) => p.pack.map((f) => ({ projectCode: p.code, family: f.family, expected: f.expected, validated: f.validated, weight: f.weight })));

/**
 * The lots with the budget the S-curve measures against: the G2 baseline once there is one, else the latest validated version
 * (before G2 the curve is indicative); `budgetSource` says which.
 */
export async function lotPlansOf(q: Q, capexId: string): Promise<{ lots: LotPlan[]; budgetSource: 'g2_baseline' | 'latest_validated' | 'none'; g2Keur: number | null; latestClass: 'E50' | 'E30' | 'E10' | null }> {
  const [lots, versions] = await Promise.all([q.select().from(capexLots).where(eq(capexLots.capexId, capexId)).orderBy(asc(capexLots.number)), versionsOf(q, capexId)]);
  const g2 = versions.find((v) => v.isG2Baseline) ?? null;
  const latest = latestValidated(versions);
  const ref = g2 ?? latest;
  return {
    lots: lots.map((l) => ({ id: l.id, number: l.number, kind: l.kind, title: l.title, epc2i: l.epc2i, budgetKeur: ref?.lines[l.id] ?? 0, start: l.plannedStart, end: l.plannedEnd })),
    budgetSource: g2 ? 'g2_baseline' : latest ? 'latest_validated' : 'none',
    g2Keur: g2?.centralKeur ?? null,
    latestClass: latest?.estimateClass ?? null,
  };
}

async function actualRowsOf(q: Q, lotIds: string[]) {
  if (!lotIds.length) return [];
  return q.select().from(lotActuals).where(inArray(lotActuals.lotId, lotIds)).orderBy(asc(lotActuals.month));
}

export interface ExecutionView {
  lots: (LotPlan & { actual: { committedKeur: number; spentKeur: number; physicalPct: number }; projects: string[]; source: 'manual' | 'import' | 'keystone' | null; lastMonth: string | null })[];
  rows: LotActual[];
  budgetSource: 'g2_baseline' | 'latest_validated' | 'none';
  g2Keur: number | null;
  latestClass: 'E50' | 'E30' | 'E10' | null;
  month: string;
  indicators: ReturnType<typeof indicatorsAt>;
  curve: ReturnType<typeof sCurve>;
  projects: Epc2iProject[];
  /** EPC2i projects linked to no lot of the CAPEX (their need has no lot). */
  unassigned: string[];
}

/**
 * The execution of a CAPEX at `today`: actuals entered for the lots outside EPC2i; for each EPC2i lot, the values of its
 * projects (through the machine needs of the lot) as the current month's actuals.
 */
export async function executionOf(q: Q, c: { id: string; code: string }, today: string): Promise<ExecutionView> {
  const month = monthOf(today);
  const [plans, projects, needs] = await Promise.all([lotPlansOf(q, c.id), projectsOf(q, c.code), needsOf(q, c)]);
  const stored = await actualRowsOf(q, plans.lots.map((l) => l.id));
  const rows: LotActual[] = stored.map((r) => ({ lotId: r.lotId, month: r.month, committedKeur: r.committedKeur, spentKeur: r.spentKeur, physicalPct: r.physicalPct }));
  const lotOfNeed = new Map(needs.map((n) => [n.ref, n.lotId]));
  const projectsOfLot = new Map<string, Epc2iProject[]>();
  const unassigned: string[] = [];
  for (const p of projects) {
    const lot = p.needRef ? lotOfNeed.get(p.needRef) : null;
    if (lot) projectsOfLot.set(lot, [...(projectsOfLot.get(lot) ?? []), p]);
    else unassigned.push(p.code);
  }
  for (const l of plans.lots.filter((x) => x.epc2i)) {
    const live = epc2iLotValues((projectsOfLot.get(l.id) ?? []).flatMap((p) => (p.progress ? [p.progress] : [])));
    if (!live) continue;
    const i = rows.findIndex((r) => r.lotId === l.id && r.month === month);
    const row = { lotId: l.id, month, ...live };
    if (i >= 0) rows[i] = row;
    else rows.push(row);
  }
  const lots = plans.lots.map((l) => {
    const mine = stored.filter((r) => r.lotId === l.id);
    const last = mine.at(-1);
    return { ...l, actual: actualAt(rows, l.id, month), projects: (projectsOfLot.get(l.id) ?? []).map((p) => p.code), source: l.epc2i && projectsOfLot.get(l.id)?.length ? ('keystone' as const) : last?.source ?? null, lastMonth: last?.month ?? null };
  });
  return {
    lots, rows, budgetSource: plans.budgetSource, g2Keur: plans.g2Keur, latestClass: plans.latestClass, month,
    indicators: indicatorsAt(plans.lots, rows, month), curve: sCurve(plans.lots, rows, month), projects, unassigned,
  };
}

/** The pack summary of a CAPEX (the subsidiary's items and EPC2i's part of its projects). */
export async function packOf(q: Q, c: { id: string; code: string }, projects?: Epc2iProject[]) {
  const [items, ps] = await Promise.all([packItemsOf(q, c.id), projects ? Promise.resolve(projects) : projectsOf(q, c.code)]);
  return { items, projects: ps, summary: packSummary(items, epc2iPackOf(ps)) };
}

/** Facts of the criteria fed by deliveries 5 and 6: safety milestones, permits, pack, works lots; ramp-up, closure, REX. */
export async function deliveryFacts(q: Q, c: { id: string; code: string }, values: ModelValues, today: string): Promise<Record<string, CriterionFact>> {
  const [hs, permits, exec] = await Promise.all([hsOf(q, c.id), permitsOf(q, c.id), executionOf(q, c, today)]);
  const pack = await packOf(q, c, exec.projects);
  const works = worksFact(exec.lots, exec.rows, exec.month, values.worksThresholdPct);
  return {
    ...safetyFacts(hs),
    g2_permits: permitsFact(permits as PermitState[]),
    g2_pack: packFact(pack.summary, values.packThresholdPct),
    ...(works ? { k3_works: works } : {}),
    ...(await startupFacts(q, c, values, today, exec.g2Keur)),
  };
}
