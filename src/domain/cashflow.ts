// Phased cash-flow forecast of a CAPEX (AR-045, DECISIONS.md §5): the disbursements of each lot, month by month — the G2
// baseline (the reference budget spread over the lot's window, spec 06 §3), the actuals (the month's increase of the
// cumulative spent) and the forecast entered by the project lead or the controller for the months to come; a lot without a
// forecast spreads what is left to spend evenly over the rest of its window. The projection is the actuals up to the current
// month and the forecast after it; consolidated by fiscal year (the calendar year) for the group's treasury and the envelopes
// (AR-040). Pure.
import { round1 } from './budget';
import { actualAt, addMonths, isMonth, monthsBetween, plannedAt, type LotActual, type LotPlan, type Month } from './execution';

/** The disbursement forecast for a lot in a month (not cumulative). */
export interface LotForecast {
  lotId: string;
  month: Month;
  amountKeur: number;
}

export interface CashflowMonth {
  month: Month;
  /** The G2 baseline's disbursement of the month (the reference budget spread over the windows). */
  baseline: number;
  /** The actual disbursement of the month (up to the current month), else null. */
  actual: number | null;
  /** After the current month: the forecast disbursement; up to it: 0. */
  forecast: number;
  /** Actual up to the current month, forecast after. */
  projected: number;
}

export interface Cashflow {
  months: CashflowMonth[];
  baselineKeur: number;
  spentKeur: number;
  /** Still to spend: the forecast after the current month. */
  remainingKeur: number;
  /** Spent to date + remaining. */
  atCompletionKeur: number;
}

const cmp = (a: Month, b: Month) => (a < b ? -1 : a > b ? 1 : 0);

/** One lot's forecast after `current`: the entered months, else what is left spread evenly over the rest of its window. */
function lotForecast(l: LotPlan, rows: readonly LotActual[], forecasts: readonly LotForecast[], current: Month): Map<Month, number> {
  const mine = forecasts.filter((f) => f.lotId === l.id && cmp(f.month, current) > 0);
  if (mine.length) return new Map(mine.map((f) => [f.month, f.amountKeur]));
  const left = Math.max(l.budgetKeur - actualAt(rows, l.id, current).spentKeur, 0);
  if (!left) return new Map();
  const from = addMonths(current, 1);
  const to = l.end && cmp(l.end, from) >= 0 ? l.end : from;
  const months = monthsBetween(from, to);
  return new Map(months.map((m) => [m, left / months.length]));
}

export function cashflow(lots: readonly LotPlan[], rows: readonly LotActual[], forecasts: readonly LotForecast[], current: Month): Cashflow {
  const perLot = lots.map((l) => ({ l, fc: lotForecast(l, rows, forecasts, current) }));
  const bounds = [
    ...lots.flatMap((l) => [l.start, l.end]), ...rows.map((r) => r.month), current,
    ...perLot.flatMap((x) => [...x.fc.keys()]),
  ].filter(isMonth).sort(cmp);
  if (!lots.length || !bounds.length) return { months: [], baselineKeur: 0, spentKeur: 0, remainingKeur: 0, atCompletionKeur: 0 };
  const months = monthsBetween(bounds[0], bounds[bounds.length - 1]).map((m): CashflowMonth => {
    const prev = addMonths(m, -1);
    let baseline = 0, actual = 0, forecast = 0;
    for (const { l, fc } of perLot) {
      const p = plannedAt(l, m);
      if (p != null) baseline += p - (plannedAt(l, prev) ?? 0);
      if (cmp(m, current) <= 0) actual += actualAt(rows, l.id, m).spentKeur - actualAt(rows, l.id, prev).spentKeur;
      else forecast += fc.get(m) ?? 0;
    }
    const past = cmp(m, current) <= 0;
    return { month: m, baseline: round1(baseline), actual: past ? round1(actual) : null, forecast: round1(forecast), projected: round1(past ? actual : forecast) };
  });
  const spent = lots.reduce((s, l) => s + actualAt(rows, l.id, current).spentKeur, 0);
  const remaining = perLot.reduce((s, x) => s + [...x.fc].filter(([m]) => cmp(m, current) > 0).reduce((a, [, v]) => a + v, 0), 0);
  return { months, baselineKeur: round1(lots.reduce((s, l) => s + l.budgetKeur, 0)), spentKeur: round1(spent), remainingKeur: round1(remaining), atCompletionKeur: round1(spent + remaining) };
}

/** The months' values summed by fiscal year (calendar year). */
export function byYear(months: readonly CashflowMonth[], pick: (m: CashflowMonth) => number | null = (m) => m.projected): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of months) {
    const y = Number(m.month.slice(0, 4));
    out[y] = round1((out[y] ?? 0) + (pick(m) ?? 0));
  }
  return out;
}

/** A lot's forecast typed for the months to come: amounts ≥ 0 in thousands (empty = no disbursement), months after `current`. */
export function checkForecast(raw: Record<string, unknown>, current: Month): { ok: true; value: { month: Month; amount: number }[] } | { ok: false; error: string } {
  const out: { month: Month; amount: number }[] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('m:')) continue;
    const month = k.slice(2);
    if (!isMonth(month) || cmp(month, current) <= 0) return { ok: false, error: 'Forecast the months after the current one' };
    const s = typeof v === 'string' ? v.replace(/\s/g, '').replace(',', '.') : '';
    if (!s) continue;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Amounts are positive numbers' };
    out.push({ month, amount: round1(n) });
  }
  return { ok: true, value: out.sort((a, b) => cmp(a.month, b.month)) };
}
