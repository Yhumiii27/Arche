import 'server-only';
// Finance reads of delivery 7 (lot 7b): the phased cash-flow of a CAPEX (AR-045: G2 baseline, actuals, forecasts), the phased
// disbursements of every CAPEX open or on hold by fiscal year, the envelopes with their movements and consumption (AR-040),
// and the envelope control of one CAPEX (opening, G2, alerts). In a fixed number of queries; the consumption is computed on
// every CAPEX of the group (an envelope is shared), the views show only what the viewer sees.
import { asc, eq, inArray, or } from 'drizzle-orm';
import { byYear, cashflow, type LotForecast } from '@/domain/cashflow';
import { envelopeCheck, envelopeStates, type Envelope, type EnvelopeMovement, type PhasedCapex } from '@/domain/envelopes';
import { monthOf, type LotActual } from '@/domain/execution';
import { assetClasses, capex, capexLots, envelopeMovements, envelopes, fixedAssetTransfers, lotActuals, lotForecasts, subsidiaries } from '@/server/db/schema';
import { classOf, inServiceMonth, simulate, type AssetClass } from '@/domain/depreciation';
import type { DB, Tx } from '@/server/db/types';
import { versionsOfMany } from './cycle';
import { lotPlansFrom } from './execution';

type Q = DB | Tx;

export async function forecastsOf(q: Q, lotIds: readonly string[]): Promise<LotForecast[]> {
  if (!lotIds.length) return [];
  const rows = await q.select().from(lotForecasts).where(inArray(lotForecasts.lotId, [...lotIds])).orderBy(asc(lotForecasts.month));
  return rows.map((r) => ({ lotId: r.lotId, month: r.month, amountKeur: r.amountKeur }));
}

/** The forecast rows as stored (with the amounts as typed), for the forecast form. */
export async function forecastRowsOf(q: Q, lotIds: readonly string[]) {
  if (!lotIds.length) return [];
  return q.select().from(lotForecasts).where(inArray(lotForecasts.lotId, [...lotIds])).orderBy(asc(lotForecasts.month));
}

/** The phased disbursements by fiscal year of the CAPEX open or on hold, and of `extra` (a draft being opened). */
export async function phasedCapex(q: Q, today: string, extra: readonly string[] = []): Promise<(PhasedCapex & { code: string; status: string })[]> {
  const rows = await q.select({ id: capex.id, code: capex.code, status: capex.status, subsidiaryCode: capex.subsidiaryCode, zoneCode: subsidiaries.zoneCode, typology: capex.typology })
    .from(capex).innerJoin(subsidiaries, eq(subsidiaries.code, capex.subsidiaryCode))
    .where(extra.length ? or(inArray(capex.status, ['active', 'on_hold']), inArray(capex.id, [...extra])) : inArray(capex.status, ['active', 'on_hold']));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [lots, versions] = await Promise.all([q.select().from(capexLots).where(inArray(capexLots.capexId, ids)).orderBy(asc(capexLots.number)), versionsOfMany(q, ids)]);
  const lotIds = lots.map((l) => l.id);
  const [actuals, forecasts] = await Promise.all([
    lotIds.length ? q.select().from(lotActuals).where(inArray(lotActuals.lotId, lotIds)).orderBy(asc(lotActuals.month)) : Promise.resolve([]),
    forecastsOf(q, lotIds),
  ]);
  const month = monthOf(today);
  return rows.map((r) => {
    const mine = lots.filter((l) => l.capexId === r.id);
    const ids2 = new Set(mine.map((l) => l.id));
    const plans = lotPlansFrom(mine, versions.get(r.id) ?? []);
    const rowsOfCapex: LotActual[] = actuals.filter((a) => ids2.has(a.lotId)).map((a) => ({ lotId: a.lotId, month: a.month, committedKeur: a.committedKeur, spentKeur: a.spentKeur, physicalPct: a.physicalPct }));
    const cf = cashflow(plans.lots, rowsOfCapex, forecasts.filter((f) => ids2.has(f.lotId)), month);
    return { ...r, byYear: byYear(cf.months) };
  });
}

export async function envelopeData(q: Q) {
  const [envs, moves] = await Promise.all([
    q.select().from(envelopes).orderBy(asc(envelopes.fiscalYear)),
    q.select().from(envelopeMovements).orderBy(asc(envelopeMovements.occurredAt)),
  ]);
  const env: (Envelope & { note: string | null; createdByName: string })[] = envs.map((e) => ({ id: e.id, fiscalYear: e.fiscalYear, zoneCode: e.zoneCode, subsidiaryCode: e.subsidiaryCode, category: e.category, amountKeur: e.amountKeur, note: e.note, createdByName: e.createdByName }));
  const movements: (EnvelopeMovement & { id: string; kind: string; reason: string; byName: string; occurredAt: Date })[] = moves.map((m) => ({ id: m.id, kind: m.kind, fromId: m.fromEnvelopeId, toId: m.toEnvelopeId, amountKeur: m.amountKeur, reason: m.reason, byName: m.byName, occurredAt: m.occurredAt }));
  return { envelopes: env, movements };
}

/** Every envelope with its consumption (all the CAPEX of the group). */
export async function envelopeOverview(q: Q, today: string) {
  const [{ envelopes: envs, movements }, phased] = await Promise.all([envelopeData(q), phasedCapex(q, today)]);
  return { envelopes: envs, movements, phased, states: envelopeStates(envs, movements, phased) };
}

/** The envelope control of one CAPEX (it counts even while a draft): years over its envelope, and beyond the tolerance. */
export async function capexEnvelopeCheck(q: Q, c: { id: string }, tolerancePct: number, today: string) {
  const [{ envelopes: envs, movements }, phased] = await Promise.all([envelopeData(q), phasedCapex(q, today, [c.id])]);
  const mine = phased.find((p) => p.id === c.id);
  if (!mine || !envs.length) return { rows: [], over: [], blocked: [] } as ReturnType<typeof envelopeCheck>;
  return envelopeCheck(envs, movements, phased, mine, tolerancePct);
}

export async function assetClassesOf(q: Q): Promise<AssetClass[]> {
  const rows = await q.select().from(assetClasses).where(eq(assetClasses.active, true)).orderBy(asc(assetClasses.code));
  return rows.map((r) => ({ code: r.code, label: r.label, lifeYears: r.lifeYears, method: r.method, factor: r.factor, lotKinds: r.lotKinds }));
}

/**
 * The simulated depreciation of a CAPEX (AR-050): each lot's reference budget (G2 baseline, else latest validated) in its
 * class from the month it goes in service, over the business plan's horizon; lots without a class are listed apart.
 */
export async function depreciationOf(q: Q, c: { id: string; mesStartedOn: string | null; needDate: string | null }, horizon: number) {
  const [classes, lots, versions] = await Promise.all([
    assetClassesOf(q),
    q.select().from(capexLots).where(eq(capexLots.capexId, c.id)).orderBy(asc(capexLots.number)),
    versionsOfMany(q, [c.id]).then((m) => m.get(c.id) ?? []),
  ]);
  const plans = lotPlansFrom(lots, versions);
  const month = inServiceMonth(c, lots.map((l) => l.plannedEnd));
  const rows = lots.map((l) => ({ lot: l, budgetKeur: plans.lots.find((p) => p.id === l.id)?.budgetKeur ?? 0, cls: classOf(classes, l) }));
  const sim = month ? simulate(rows.filter((r) => r.cls && r.budgetKeur > 0).map((r) => ({ amountKeur: r.budgetKeur, cls: r.cls! })), month, horizon) : null;
  return { classes, rows, month, simulation: sim, unclassed: rows.filter((r) => !r.cls && r.budgetKeur > 0) };
}

export async function transfersOf(q: Q, capexId: string) {
  return q.select().from(fixedAssetTransfers).where(eq(fixedAssetTransfers.capexId, capexId));
}
