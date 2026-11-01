// Decision aid by rules (AR-037, docs/spec/06 §7; no AI, no data sent anywhere): the projection of a CAPEX's S-curve and EAC
// from its own history, the detection of a cost or schedule drift, and the reference class of the CAPEX already built (how
// far their cost ended from their G2 budget) that gives a request its likely range. An AI provider may refine this later,
// only once one is validated as compliant (C-13). Pure.
import { round1 } from './budget';
import { addMonths, type Month, type SCurvePoint } from './execution';

/** The months looked back to measure a trend. */
export const TREND_MONTHS = 3;
/** EAC growth over the trend window that is a cost drift (%). */
export const COST_DRIFT_PCT = 3;
/** Projected finish later than planned by this many months: a schedule drift. */
export const SCHEDULE_DRIFT_MONTHS = 2;
/** Fewest CAPEX of a reference class for its range to be shown. */
export const MIN_REFERENCES = 3;

export interface MonthHistory {
  month: Month;
  spi: number | null;
  cpi: number | null;
  /** EAC = AC + (BAC − EV) / CPI at the end of the month; BAC while nothing is spent. */
  eacKeur: number;
}

const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : null);

/** SPI, CPI and EAC month by month, up to the current month (the measured part of the S-curve). */
export function historyOf(curve: readonly SCurvePoint[], bacKeur: number): MonthHistory[] {
  return curve
    .filter((p) => p.earned != null && p.actual != null)
    .map((p) => {
      const cpi = ratio(p.earned!, p.actual!);
      return { month: p.month, spi: ratio(p.earned!, p.planned), cpi, eacKeur: round1(p.actual! > 0 && cpi ? p.actual! + (bacKeur - p.earned!) / cpi : bacKeur) };
    });
}

export interface Forecast {
  /** Earned value projected month by month after the current month at the recent pace, until the budget is earned. */
  projection: { month: Month; earned: number }[];
  /** Average earned value per month over the trend window (k€). */
  paceKeur: number;
  plannedFinish: Month | null;
  /** The month the budget would be earned at the recent pace; null when nothing is earned yet. */
  projectedFinish: Month | null;
  /** Months between the planned and the projected finish (positive: late). */
  delayMonths: number | null;
  eacKeur: number;
  /** EAC with the schedule performance too: AC + (BAC − EV) / (CPI × SPI). */
  eacCompositeKeur: number | null;
  /** EAC change over the trend window. */
  eacTrend: { fromKeur: number; deltaKeur: number; deltaPct: number } | null;
  /** SPI change over the trend window. */
  spiTrend: number | null;
  drift: { cost: boolean; schedule: boolean };
}

const monthIdx = (m: Month) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;

/**
 * The forecast of a CAPEX at the current month: the earned value continues at its pace of the last months; the drift is a
 * growth of the EAC above COST_DRIFT_PCT over that window, or a projected finish SCHEDULE_DRIFT_MONTHS late or more.
 */
export function forecastOf(curve: readonly SCurvePoint[], bacKeur: number, current: Month): Forecast {
  const hist = historyOf(curve, bacKeur);
  const last = hist.at(-1) ?? null;
  const measured = curve.filter((p) => p.earned != null);
  const now = measured.at(-1) ?? null;
  const back = measured.length > TREND_MONTHS ? measured[measured.length - 1 - TREND_MONTHS] : measured[0] ?? null;
  const span = now && back ? monthIdx(now.month) - monthIdx(back.month) : 0;
  const paceKeur = now && back && span > 0 ? round1((now.earned! - back.earned!) / span) : 0;
  const plannedFinish = curve.find((p) => bacKeur > 0 && p.planned >= bacKeur - 0.05)?.month ?? curve.at(-1)?.month ?? null;

  const projection: { month: Month; earned: number }[] = [];
  let projectedFinish: Month | null = null;
  const earnedNow = now?.earned ?? 0;
  if (now && earnedNow >= bacKeur - 0.05 && bacKeur > 0) projectedFinish = now.month;
  else if (now && paceKeur > 0) {
    let e = earnedNow;
    for (let i = 1; i <= 120; i++) {
      e = Math.min(bacKeur, e + paceKeur);
      const m = addMonths(current, i);
      projection.push({ month: m, earned: round1(e) });
      if (e >= bacKeur) { projectedFinish = m; break; }
    }
  }
  const delayMonths = projectedFinish && plannedFinish ? monthIdx(projectedFinish) - monthIdx(plannedFinish) : null;

  // The trend starts at the first month with a cost: before it, the EAC is the budget by construction.
  const costed = hist.filter((h) => h.cpi != null);
  const backHist = costed.length > 1 ? costed[Math.max(0, costed.length - 1 - TREND_MONTHS)] : null;
  const eacTrend = last && backHist && backHist.eacKeur > 0
    ? { fromKeur: backHist.eacKeur, deltaKeur: round1(last.eacKeur - backHist.eacKeur), deltaPct: round1((last.eacKeur / backHist.eacKeur - 1) * 100) }
    : null;
  const spiTrend = last?.spi != null && backHist?.spi != null ? round1(last.spi - backHist.spi) : null;
  const composite = now && last?.cpi && last.spi && now.actual! > 0 ? round1(now.actual! + (bacKeur - now.earned!) / (last.cpi * last.spi)) : null;
  const spent = (now?.actual ?? 0) > 0;
  return {
    projection, paceKeur, plannedFinish, projectedFinish, delayMonths,
    eacKeur: last?.eacKeur ?? bacKeur, eacCompositeKeur: composite, eacTrend, spiTrend,
    drift: {
      cost: spent && !!eacTrend && eacTrend.deltaPct > COST_DRIFT_PCT,
      schedule: spent && delayMonths != null && delayMonths >= SCHEDULE_DRIFT_MONTHS,
    },
  };
}

export interface Reference {
  code: string;
  investmentType: string;
  g2Keur: number;
  /** Final cost (closed CAPEX) or EAC of a CAPEX well advanced. */
  outcomeKeur: number;
  final: boolean;
}

export interface ReferenceClass {
  /** The CAPEX of the class: same investment type when there are enough, else every one. */
  sameType: boolean;
  n: number;
  /** Cost against the G2 budget (%), median and 80th percentile. */
  medianPct: number;
  p80Pct: number;
  codes: string[];
}

/** The value at rank ⌈p × n⌉ of the sorted values (nearest rank). */
function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

/** The reference class of a CAPEX of `investmentType` (itself left out): null under MIN_REFERENCES CAPEX. */
export function referenceClass(refs: readonly Reference[], investmentType: string, selfCode: string): ReferenceClass | null {
  const pool = refs.filter((r) => r.code !== selfCode && r.g2Keur > 0);
  const same = pool.filter((r) => r.investmentType === investmentType);
  const used = same.length >= MIN_REFERENCES ? same : pool;
  if (used.length < MIN_REFERENCES) return null;
  const gaps = used.map((r) => round1((r.outcomeKeur / r.g2Keur - 1) * 100)).sort((a, b) => a - b);
  return { sameType: used === same, n: used.length, medianPct: percentile(gaps, 0.5), p80Pct: percentile(gaps, 0.8), codes: used.map((r) => r.code).sort() };
}

/** The likely final cost of a budget given its reference class: median and 80th percentile (k€). */
export function likelyRange(budgetKeur: number, rc: ReferenceClass): { medianKeur: number; p80Keur: number } {
  return { medianKeur: round1(budgetKeur * (1 + rc.medianPct / 100)), p80Keur: round1(budgetKeur * (1 + rc.p80Pct / 100)) };
}
