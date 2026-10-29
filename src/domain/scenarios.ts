// Portfolio scenarios (AR-043, DECISIONS.md §5): named scenarios of the group's portfolio — base, constrained, growth — that
// keep or leave out CAPEX and shift their disbursements still to come by whole months, under an envelope per fiscal year; they
// are compared on the spend by year against the envelope, the expected return (NPV of the business plans), the major risks and
// the mean priority score (AR-044); one scenario is retained for the COPIL GPI. Pure.
import { round1 } from './budget';
import { addMonths } from './execution';

export const SCENARIO_KINDS = ['base', 'constrained', 'growth', 'other'] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];
export const SCENARIO_KIND_LABEL: Record<ScenarioKind, string> = { base: 'Base', constrained: 'Constrained', growth: 'Growth', other: 'Other' };

/** A CAPEX as the scenarios see it: its projected disbursements by month (actuals, then forecast), its return, risks and score. */
export interface ScenarioCapex {
  id: string;
  code: string;
  months: readonly { month: string; projected: number }[];
  npvKeur: number | null;
  majorRisks: number;
  score: number | null;
}

export interface ScenarioItem {
  capexId: string;
  included: boolean;
  shiftMonths: number;
}

/** The disbursements by fiscal year, the months after `current` moved by `shift` months (the past does not move). */
export function shiftedByYear(months: readonly { month: string; projected: number }[], current: string, shift: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of months) {
    const month = m.month > current && shift ? addMonths(m.month, shift) : m.month;
    const y = Number(month.slice(0, 4));
    out[y] = round1((out[y] ?? 0) + m.projected);
  }
  return out;
}

export interface ScenarioResult {
  /** Spend by fiscal year of the CAPEX kept. */
  byYear: Record<number, number>;
  /** Spend over the scenario's envelope, by year (only the years with an envelope). */
  overByYear: Record<number, number>;
  npvKeur: number;
  majorRisks: number;
  meanScore: number | null;
  kept: number;
  left: number;
}

/** A scenario on the portfolio: every CAPEX is kept with no shift unless its item says otherwise. */
export function evaluate(items: readonly ScenarioItem[], envelopes: Readonly<Record<number, number>>, capex: readonly ScenarioCapex[], current: string): ScenarioResult {
  const byYear: Record<number, number> = {};
  let npv = 0, risks = 0, kept = 0;
  const scores: number[] = [];
  for (const c of capex) {
    const it = items.find((i) => i.capexId === c.id);
    if (it && !it.included) continue;
    kept++;
    for (const [y, v] of Object.entries(shiftedByYear(c.months, current, it?.shiftMonths ?? 0))) byYear[+y] = round1((byYear[+y] ?? 0) + v);
    npv += c.npvKeur ?? 0;
    risks += c.majorRisks;
    if (c.score != null) scores.push(c.score);
  }
  const overByYear: Record<number, number> = {};
  for (const [y, env] of Object.entries(envelopes)) overByYear[+y] = round1(Math.max((byYear[+y] ?? 0) - env, 0));
  return { byYear, overByYear, npvKeur: round1(npv), majorRisks: risks, meanScore: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null, kept, left: capex.length - kept };
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A scenario's heading: a name, a kind, a description and the group's envelope by fiscal year (fields `env:<year>`). */
export function checkScenario(raw: Record<string, unknown>): Check<{ name: string; kind: ScenarioKind; description: string | null; envelopes: Record<string, number> }> {
  const name = text(raw.name);
  if (name.length < 2 || name.length > 80) return { ok: false, error: 'Name the scenario' };
  const kind = (text(raw.kind) || 'other') as ScenarioKind;
  if (!SCENARIO_KINDS.includes(kind)) return { ok: false, error: 'Choose the kind of scenario' };
  const envelopes: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('env:') || !/^\d{4}$/.test(k.slice(4))) continue;
    const s = text(v).replace(/\s/g, '').replace(',', '.');
    if (!s) continue;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Give the envelopes in k€' };
    envelopes[k.slice(4)] = round1(n);
  }
  return { ok: true, value: { name, kind, description: text(raw.description).slice(0, 1000) || null, envelopes } };
}

/** The CAPEX of a scenario (fields `keep:<id>` = "on" and `shift:<id>` = months, −36 to 36). */
export function checkItems(raw: Record<string, unknown>, ids: readonly string[]): Check<ScenarioItem[]> {
  const out: ScenarioItem[] = [];
  for (const id of ids) {
    const s = text(raw[`shift:${id}`]) || '0';
    const n = Number(s);
    if (!Number.isInteger(n) || n < -36 || n > 36) return { ok: false, error: 'Shifts are whole months, from −36 to 36' };
    out.push({ capexId: id, included: raw[`keep:${id}`] === 'on', shiftMonths: n });
  }
  return { ok: true, value: out };
}
