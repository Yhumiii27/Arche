// Depreciation and fixed assets (AR-050, DECISIONS.md §5): asset classes of the group (useful life, straight-line or
// declining-balance method) — each lot takes the class chosen for it, else the class of its kind; the depreciation simulated
// from the business plan (yearly charge from the start of commissioning, pro rata of the months of the first year; the
// declining balance switches to straight line when that is higher, French rule) and the transfer of the lots into fixed
// assets at the accounting closure, exported for Sage FI-AA. Pure.
import { round1 } from './budget';

export type DepreciationMethod = 'linear' | 'declining';

export interface AssetClass {
  code: string;
  label: string;
  lifeYears: number;
  method: DepreciationMethod;
  /** Declining-balance coefficient (1.25, 1.75, 2.25 in France); null for straight line. */
  factor: number | null;
  /** Lot kinds this class applies to by default. */
  lotKinds: readonly string[];
}

/** The class of a lot: the one chosen for it, else the first class of its kind; null when none fits. */
export function classOf(classes: readonly AssetClass[], lot: { kind: string; assetClassCode: string | null }): AssetClass | null {
  return (lot.assetClassCode ? classes.find((c) => c.code === lot.assetClassCode) : null) ?? classes.find((c) => c.lotKinds.includes(lot.kind)) ?? null;
}

/** The yearly charges of one asset put in service in `month` ("YYYY-MM") for `years` fiscal years. */
export function scheduleOf(amountKeur: number, cls: Pick<AssetClass, 'lifeYears' | 'method' | 'factor'>, month: string, years: number): number[] {
  const firstMonths = 12 - Number(month.slice(5, 7)) + 1;
  const out: number[] = [];
  let net = amountKeur;
  const linearRate = 1 / cls.lifeYears;
  const decliningRate = cls.method === 'declining' && cls.factor ? linearRate * cls.factor : linearRate;
  for (let y = 0; y < years && net > 0.0001; y++) {
    const prorata = y === 0 ? firstMonths / 12 : 1;
    let charge: number;
    if (cls.method === 'linear') charge = Math.min(amountKeur * linearRate * prorata, net);
    else {
      // Remaining life at the start of the year (in years, the first one counted pro rata).
      const remaining = cls.lifeYears - (y === 0 ? 0 : y - 1 + firstMonths / 12);
      const declining = net * decliningRate * prorata;
      const straight = remaining > 0 ? (net / remaining) * prorata : net;
      charge = Math.min(Math.max(declining, straight), net);
    }
    out.push(round1(charge));
    net -= charge;
  }
  while (out.length < years) out.push(0);
  return out;
}

/** The simulated depreciation of a CAPEX: one schedule per class, summed by year from the year of commissioning. */
export function simulate(items: readonly { amountKeur: number; cls: AssetClass }[], month: string, years: number) {
  const startYear = Number(month.slice(0, 4));
  const yearly = Array.from({ length: years }, () => 0);
  const byClass = new Map<string, { cls: AssetClass; amountKeur: number; charges: number[] }>();
  for (const it of items) {
    const c = byClass.get(it.cls.code) ?? { cls: it.cls, amountKeur: 0, charges: Array.from({ length: years }, () => 0) };
    c.amountKeur += it.amountKeur;
    byClass.set(it.cls.code, c);
  }
  for (const c of byClass.values()) {
    c.charges = scheduleOf(c.amountKeur, c.cls, month, years);
    c.charges.forEach((x, i) => (yearly[i] += x));
  }
  return { years: yearly.map((charge, i) => ({ year: startYear + i, charge: round1(charge) })), classes: [...byClass.values()].map((c) => ({ ...c, amountKeur: round1(c.amountKeur) })) };
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** An asset class typed by the group CFO. */
export function checkAssetClass(raw: Record<string, unknown>, lotKinds: readonly string[]): Check<Omit<AssetClass, 'lotKinds'> & { lotKinds: string[] }> {
  const code = text(raw.code).toUpperCase();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code)) return { ok: false, error: 'Give a code (2 to 12 letters or digits)' };
  const label = text(raw.label);
  if (label.length < 2 || label.length > 80) return { ok: false, error: 'Give the label' };
  const lifeYears = Number(text(raw.lifeYears));
  if (!Number.isInteger(lifeYears) || lifeYears < 1 || lifeYears > 60) return { ok: false, error: 'The useful life goes from 1 to 60 years' };
  const method = text(raw.method) === 'declining' ? 'declining' : 'linear';
  const factor = method === 'declining' ? Number(text(raw.factor).replace(',', '.')) : null;
  if (method === 'declining' && (!Number.isFinite(factor) || factor! < 1 || factor! > 3)) return { ok: false, error: 'The declining-balance coefficient goes from 1 to 3' };
  const kinds = lotKinds.filter((k) => raw[`kind:${k}`] === 'on');
  return { ok: true, value: { code, label, lifeYears, method, factor, lotKinds: kinds } };
}

/** The month the assets go in service: the start of commissioning, else the month after the last lot's window, else the need date's. */
export function inServiceMonth(c: { mesStartedOn: string | null; needDate: string | null }, lotEnds: readonly (string | null)[]): string | null {
  if (c.mesStartedOn) return c.mesStartedOn.slice(0, 7);
  const last = lotEnds.filter((x): x is string => !!x).sort().at(-1);
  if (last) {
    const [y, m] = last.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return c.needDate ? c.needDate.slice(0, 7) : null;
}
