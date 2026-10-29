import 'server-only';
// Currencies (AR-039): the group's reference rates and the conversion of an amount typed in a subsidiary's currency, at the
// rate of a month (else of its fiscal year). Rules: src/domain/currency.ts.
import { asc, eq } from 'drizzle-orm';
import { EUR, entryCurrency, rateFor, toKeur, type Rate } from '@/domain/currency';
import { exchangeRates, subsidiaries } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

type Q = DB | Tx;

export async function ratesOf(q: Q): Promise<(Rate & { note: string | null; enteredByName: string; enteredAt: Date })[]> {
  return q.select().from(exchangeRates).orderBy(asc(exchangeRates.currency), asc(exchangeRates.period));
}

export async function subsidiaryCurrency(q: Q, subsidiaryCode: string): Promise<string> {
  const [s] = await q.select({ currency: subsidiaries.currency }).from(subsidiaries).where(eq(subsidiaries.code, subsidiaryCode));
  return s?.currency ?? EUR;
}

export const NO_RATE = 'No reference rate for this currency and month: the group CFO enters it (Administration › Subsidiaries)';

export interface Converter {
  currency: string;
  rate: number;
  /** k€ of an amount typed in thousands of `currency`. */
  keur(amount: number): number;
  /** The columns kept beside the k€ (null when typed in euros). */
  local(amount: number | null): number | null;
}

/**
 * The converter of a form's amounts: the currency it chose (the subsidiary's by default, or the euro) at the rate of `month`;
 * an error when the currency is not allowed or the rate was not entered.
 */
export async function converterFor(q: Q, subsidiaryCode: string, raw: unknown, month: string): Promise<{ ok: true; value: Converter } | { ok: false; error: string }> {
  const sub = await subsidiaryCurrency(q, subsidiaryCode);
  const currency = entryCurrency(raw, sub);
  if (!currency) return { ok: false, error: 'Choose the currency of the amounts' };
  const rate = currency === EUR ? 1 : rateFor(await ratesOf(q), currency, month);
  if (rate == null) return { ok: false, error: NO_RATE };
  return {
    ok: true,
    value: { currency, rate, keur: (a) => (currency === EUR ? a : toKeur(a, rate)), local: (a) => (currency === EUR || a == null ? null : a) },
  };
}

/** A month's actuals typed in `conv`'s currency: the k€ read everywhere, and the amounts as typed with their rate (AR-039). */
export function convertActual(a: { committedKeur: number | null; spentKeur: number | null; physicalPct: number | null }, conv: Converter) {
  const local = conv.currency !== EUR;
  return {
    committedKeur: a.committedKeur == null ? null : conv.keur(a.committedKeur),
    spentKeur: a.spentKeur == null ? null : conv.keur(a.spentKeur),
    physicalPct: a.physicalPct,
    committedLocal: local ? a.committedKeur : null,
    spentLocal: local ? a.spentKeur : null,
    currency: local ? conv.currency : null,
    rate: local ? conv.rate : null,
  };
}
