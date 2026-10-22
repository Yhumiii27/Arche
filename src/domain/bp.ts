// Business plan (docs/spec/06 §4; N-11): yearly flows over the horizon (CAPEX, OPEX, revenue, k€), NPV at the group discount
// rate, IRR and payback. Pure.
import type { Check } from './admin';
import { parseKeur, round1 } from './budget';

export interface BpYear {
  /** 0 = the investment year. */
  year: number;
  capexKeur: number;
  opexKeur: number;
  revenueKeur: number;
}

export const netOf = (y: BpYear) => y.revenueKeur - y.opexKeur - y.capexKeur;

/** Net present value at `ratePct` (year 0 not discounted). */
export function npv(ratePct: number, years: readonly BpYear[]): number {
  const r = ratePct / 100;
  return round1(years.reduce((s, y) => s + netOf(y) / (1 + r) ** y.year, 0));
}

/** Internal rate of return (%), by bisection between −99 % and 1000 %; null when the flows never change sign. */
export function irr(years: readonly BpYear[]): number | null {
  const f = (r: number) => years.reduce((s, y) => s + netOf(y) / (1 + r) ** y.year, 0);
  let lo = -0.99;
  let hi = 10;
  let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-7) return round1(mid * 100);
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return round1(((lo + hi) / 2) * 100);
}

/** Simple payback in years (interpolated inside the year the cumulative net flow turns non-negative); null when never. */
export function payback(years: readonly BpYear[]): number | null {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  let cum = 0;
  for (const y of sorted) {
    const net = netOf(y);
    const before = cum;
    cum += net;
    if (cum >= 0 && before < 0 && net > 0) return round1(y.year - 1 + -before / net);
  }
  return null;
}

/** The business plan typed by the controller: rate, and per year (0 … horizon−1) CAPEX, OPEX and revenue. */
export function checkBusinessPlan(raw: Record<string, unknown>, horizon: number): Check<{ discountRatePct: number; years: BpYear[] }> {
  const rate = Number(String(raw.discountRatePct ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) return { ok: false, error: 'Enter the discount rate (0 to 50 %)' };
  const years: BpYear[] = [];
  for (let y = 0; y < horizon; y++) {
    const v = (k: string) => {
      const s = String(raw[`${k}:${y}`] ?? '').trim();
      return s ? parseKeur(s) : 0;
    };
    const capexKeur = v('capex');
    const opexKeur = v('opex');
    const revenueKeur = v('revenue');
    if (capexKeur == null || opexKeur == null || revenueKeur == null) return { ok: false, error: 'Enter the amounts in k€' };
    years.push({ year: y, capexKeur, opexKeur, revenueKeur });
  }
  return { ok: true, value: { discountRatePct: rate, years } };
}

export const BP_HORIZON = 10;
