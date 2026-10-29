import 'server-only';
// Reads of the start-up of a CAPEX (delivery 6): production lines and their days with the ramp-up rules applied, the stored
// results of each line (read by pub_rampup) recomputed after every write, the accounting closure statement, the lessons
// learned of a CAPEX and the library (the published entries of the CAPEX the viewer sees). Callers pass the CAPEX of a row
// already read through the visibility filter.
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { accountsFact, closureSummary, rexFact } from '@/domain/closure';
import { capexRampup, DEFAULT_CAPACITY_PCT, rampupFacts, type LineDef, type RampupDay, type RampupRules } from '@/domain/rampup';
import type { ModelValues } from '@/domain/lifecycle';
import { capex, capexLots, closureStatements, lotFinalCosts, productionLines, rampupDays, rexEntries } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { getDb } from '@/server/db/client';
import type { Viewer } from '@/server/viewer';
import { visibleCapex } from './capex';

type Q = DB | Tx;

export const rulesOf = (v: ModelValues): RampupRules => ({ requiredDays: v.rampupDays, capacityPct: DEFAULT_CAPACITY_PCT, maxMonths: v.mesMaxMonths });

export async function linesOf(q: Q, capexId: string) {
  return q.select().from(productionLines).where(eq(productionLines.capexId, capexId)).orderBy(asc(productionLines.number));
}

const lineDef = (l: Awaited<ReturnType<typeof linesOf>>[number]): LineDef => ({
  id: l.id, number: l.number, name: l.name, nominalPerDay: l.nominalPerDay, unit: l.unit, scrapTargetPct: l.scrapTargetPct, machineNumbers: l.machineNumbers,
});

export async function daysOf(q: Q, lineIds: string[]): Promise<RampupDay[]> {
  if (!lineIds.length) return [];
  const rows = await q.select().from(rampupDays).where(inArray(rampupDays.lineId, lineIds)).orderBy(asc(rampupDays.day));
  return rows.map((r) => ({ lineId: r.lineId, day: r.day, output: r.output, availabilityPct: r.availabilityPct, performancePct: r.performancePct, qualityPct: r.qualityPct, oeePct: r.oeePct, scrapPct: r.scrapPct, plannedStop: r.plannedStop }));
}

/** The ramp-up of a CAPEX: its lines, their days and the rules applied. */
export async function rampupOf(q: Q, c: { id: string; mesStartedOn: string | null }, values: ModelValues, today: string) {
  const rows = await linesOf(q, c.id);
  const days = await daysOf(q, rows.map((l) => l.id));
  return rampupFrom(c, rows, days, values, today);
}

/** rampupOf from rows already read. */
export function rampupFrom(c: { mesStartedOn: string | null }, rows: Awaited<ReturnType<typeof linesOf>>, days: RampupDay[], values: ModelValues, today: string) {
  const lines = rows.map(lineDef);
  const rules = rulesOf(values);
  return { lines, rows, days, rules, result: capexRampup({ mesStartedOn: c.mesStartedOn, lines, days }, rules, today) };
}

/** Stores each line's result (pub_rampup) after a write on the lines, the days or the start of commissioning. */
export async function recomputeLines(q: Q, c: { id: string; mesStartedOn: string | null }, values: ModelValues, today: string) {
  const r = await rampupOf(q, c, values, today);
  const at = new Date();
  for (const l of r.result.lines) {
    const status = l.reachedOn ? 'atteint' : r.result.status === 'overdue' ? 'hors_delai' : 'en_cours';
    await q.update(productionLines).set({ reachedOn: l.reachedOn, avgCapacityPct: l.avgCapacityPct, avgOeePct: l.avgOeePct, avgScrapPct: l.avgScrapPct, rampupStatus: status, computedAt: at }).where(eq(productionLines.id, l.lineId));
  }
}

/** The accounting closure statement of a CAPEX with its lots and the G2 budget. */
export async function closureOf(q: Q, capexId: string, g2Keur: number | null) {
  const [statement] = await q.select().from(closureStatements).where(eq(closureStatements.capexId, capexId));
  const lots = await q.select({ id: capexLots.id, number: capexLots.number, title: capexLots.title, epc2i: capexLots.epc2i }).from(capexLots).where(eq(capexLots.capexId, capexId)).orderBy(asc(capexLots.number));
  const costs = lots.length ? await q.select().from(lotFinalCosts).where(inArray(lotFinalCosts.lotId, lots.map((l) => l.id))) : [];
  const byLot = new Map(costs.map((x) => [x.lotId, x.finalKeur]));
  return {
    statement: statement ?? null,
    lots: lots.map((l) => ({ ...l, finalKeur: byLot.get(l.id) ?? null })),
    summary: closureSummary(costs.map((x) => x.finalKeur), g2Keur),
    fact: accountsFact({ lots: lots.length, costed: lots.filter((l) => byLot.has(l.id)).length, statement: !!statement }),
  };
}

export async function rexOf(q: Q, capexId: string) {
  return q.select().from(rexEntries).where(eq(rexEntries.capexId, capexId)).orderBy(asc(rexEntries.number));
}

/** The library: published lessons of the CAPEX the viewer sees, newest first. */
export async function rexLibrary(viewer: Viewer) {
  const seen = await visibleCapex(viewer);
  if (!seen.length) return [];
  const db = await getDb();
  const byId = new Map(seen.map((c) => [c.id, c]));
  const rows = await db.select().from(rexEntries).where(and(inArray(rexEntries.capexId, seen.map((c) => c.id)), isNotNull(rexEntries.publishedAt))).orderBy(desc(rexEntries.publishedAt));
  return rows.map((r) => ({ ...r, capex: byId.get(r.capexId)! }));
}

/** Facts of the G3 criteria of delivery 6: ramp-up, delay after the start of commissioning, accounting closure, REX. */
export async function startupFacts(q: Q, c: { id: string }, values: ModelValues, today: string, g2Keur: number | null) {
  const [row] = await q.select({ mesStartedOn: capex.mesStartedOn }).from(capex).where(eq(capex.id, c.id));
  const r = await rampupOf(q, { id: c.id, mesStartedOn: row?.mesStartedOn ?? null }, values, today);
  const [closure, rex] = await Promise.all([closureOf(q, c.id, g2Keur), rexOf(q, c.id)]);
  return { ...rampupFacts(r.result, values.rampupDays, today), g3_accounts: closure.fact, g3_rex: rexFact(rex) };
}
