// Currencies (AR-039, DECISIONS.md §5; revises N-2): a subsidiary keeps its books in its currency (`subsidiaries.currency`);
// budget lines and monthly actuals are typed in it — or in euros — and converted at the group's reference rate, entered by the
// group CFO: the month's rate when there is one, else the fiscal year's. Every consolidation (portfolios, dossiers, `pub_`
// views, indicators) stays in k€; the amount as typed, its currency and the rate applied are kept beside it. Pure.

export const EUR = 'EUR';

/** A reference rate: units of `currency` for one euro, for a month ("2026-10") or a fiscal year ("2026"). */
export interface Rate {
  currency: string;
  period: string;
  unitsPerEur: number;
}

export const isCurrency = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{3}$/.test(v);
const PERIOD_RE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

/** The rate of `currency` for `month` ("YYYY-MM"): the month's, else the fiscal year's; 1 for the euro; null when not entered. */
export function rateFor(rates: readonly Rate[], currency: string, month: string): number | null {
  if (currency === EUR) return 1;
  const mine = rates.filter((r) => r.currency === currency);
  return mine.find((r) => r.period === month)?.unitsPerEur ?? mine.find((r) => r.period === month.slice(0, 4))?.unitsPerEur ?? null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Thousands of a currency in k€ at a rate (units per euro). */
export const toKeur = (amountK: number, unitsPerEur: number) => round1(amountK / unitsPerEur);

/** "k€", "kMAD": the unit of an amount in thousands. */
export const unitOf = (currency: string) => (currency === EUR ? 'k€' : `k${currency}`);

/** The currencies a CAPEX's amounts may be typed in: its subsidiary's first, then the euro. */
export const entryCurrencies = (subsidiaryCurrency: string) => (subsidiaryCurrency === EUR ? [EUR] : [subsidiaryCurrency, EUR]);

/** A reference rate typed by the group CFO. */
export function checkRate(raw: Record<string, unknown>): { ok: true; value: Rate & { note: string | null } } | { ok: false; error: string } {
  const currency = String(raw.currency ?? '').trim().toUpperCase();
  if (!isCurrency(currency) || currency === EUR) return { ok: false, error: 'Give the currency (ISO code, three letters, not EUR)' };
  const period = String(raw.period ?? '').trim();
  if (!PERIOD_RE.test(period)) return { ok: false, error: 'Give the month (YYYY-MM) or the fiscal year (YYYY)' };
  const n = Number(String(raw.unitsPerEur ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return { ok: false, error: 'Give the rate: units of the currency for one euro' };
  const note = String(raw.note ?? '').trim().slice(0, 200) || null;
  return { ok: true, value: { currency, period, unitsPerEur: n, note } };
}

/** The currency a form's amounts are typed in: one of the entry currencies (the subsidiary's by default). */
export function entryCurrency(raw: unknown, subsidiaryCurrency: string): string | null {
  const allowed = entryCurrencies(subsidiaryCurrency);
  if (raw == null || raw === '') return allowed[0];
  return allowed.includes(String(raw)) ? String(raw) : null;
}
