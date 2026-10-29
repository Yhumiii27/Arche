// CAPEX envelopes (AR-040, DECISIONS.md §5): the amount the group votes for a fiscal year — and the next ones (multi-year plan)
// — for the group, a zone or a subsidiary, for every CAPEX or for one typology (Light / Strategic). Each CAPEX open or on hold
// consumes, in each fiscal year, its phased disbursements (AR-045) from its most specific envelope; carry-overs to the next
// year and reallocations between envelopes are traced movements. Over its envelope a CAPEX raises an alert; beyond the
// tolerance of the model (`envelopeBlockPct`), the G2 criterion "within the envelope" is unmet (the decider may force it). Pure.
import { round1 } from './budget';

export type EnvelopeCategory = 'all' | 'light' | 'strategic';
export const ENVELOPE_CATEGORIES: readonly EnvelopeCategory[] = ['all', 'light', 'strategic'];
export const ENVELOPE_CATEGORY_LABEL: Record<EnvelopeCategory, string> = { all: 'Every CAPEX', light: 'Light', strategic: 'Strategic' };

export interface Envelope {
  id: string;
  fiscalYear: number;
  zoneCode: string | null;
  subsidiaryCode: string | null;
  category: EnvelopeCategory;
  amountKeur: number;
}

export interface EnvelopeMovement {
  fromId: string | null;
  toId: string | null;
  amountKeur: number;
}

/** A CAPEX as the envelopes see it: where it is, its typology and its phased disbursements by fiscal year. */
export interface PhasedCapex {
  id: string;
  subsidiaryCode: string;
  zoneCode: string;
  typology: string | null;
  byYear: Record<number, number>;
}

/** The most specific envelope of a CAPEX for a year: its subsidiary, else its zone, else the group; its typology before "every". */
export function envelopeOf(envs: readonly Envelope[], c: { subsidiaryCode: string; zoneCode: string; typology: string | null }, year: number): Envelope | null {
  const mine = envs.filter((e) => e.fiscalYear === year && (e.category === 'all' || e.category === c.typology));
  const rank = (e: Envelope) => (e.subsidiaryCode === c.subsidiaryCode ? 0 : !e.subsidiaryCode && e.zoneCode === c.zoneCode ? 2 : !e.subsidiaryCode && !e.zoneCode ? 4 : 9) + (e.category === 'all' ? 1 : 0);
  return mine.filter((e) => rank(e) < 9).sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export interface EnvelopeState {
  envelope: Envelope;
  /** Voted amount + movements in − movements out. */
  totalKeur: number;
  consumedKeur: number;
  availableKeur: number;
  /** Consumed / total (null when the total is zero). */
  usedPct: number | null;
  /** The CAPEX that consume it, with their amount for the year. */
  capex: { id: string; keur: number }[];
}

export function envelopeStates(envs: readonly Envelope[], movements: readonly EnvelopeMovement[], phased: readonly PhasedCapex[]): EnvelopeState[] {
  return envs.map((e) => {
    const moved = movements.reduce((s, m) => s + (m.toId === e.id ? m.amountKeur : 0) - (m.fromId === e.id ? m.amountKeur : 0), 0);
    const total = e.amountKeur + moved;
    const capex = phased.filter((c) => (c.byYear[e.fiscalYear] ?? 0) > 0 && envelopeOf(envs, c, e.fiscalYear)?.id === e.id).map((c) => ({ id: c.id, keur: round1(c.byYear[e.fiscalYear]) }));
    const consumed = capex.reduce((s, c) => s + c.keur, 0);
    return { envelope: e, totalKeur: round1(total), consumedKeur: round1(consumed), availableKeur: round1(total - consumed), usedPct: total > 0 ? Math.round((consumed / total) * 1000) / 10 : null, capex };
  });
}

/**
 * The control of one CAPEX (at its opening, at G2): for each year it disburses in and has an envelope, the envelope's
 * consumption with this CAPEX in it. `over`: beyond the envelope; `blocked`: beyond the tolerance. No envelope: no fact.
 */
export function envelopeCheck(envs: readonly Envelope[], movements: readonly EnvelopeMovement[], phased: readonly PhasedCapex[], c: PhasedCapex, tolerancePct: number) {
  const all = [...phased.filter((x) => x.id !== c.id), c];
  const states = envelopeStates(envs, movements, all);
  const years = Object.keys(c.byYear).map(Number).filter((y) => c.byYear[y] > 0).sort();
  const rows = years.map((y) => {
    const e = envelopeOf(envs, c, y);
    const s = e ? states.find((x) => x.envelope.id === e.id)! : null;
    return { year: y, envelope: e, state: s, overKeur: s ? round1(Math.max(s.consumedKeur - s.totalKeur, 0)) : 0 };
  }).filter((r) => r.envelope);
  const over = rows.filter((r) => r.overKeur > 0);
  const blocked = over.filter((r) => r.state!.totalKeur <= 0 || (r.overKeur / r.state!.totalKeur) * 100 > tolerancePct);
  return { rows, over, blocked };
}

/** The G2 fact: within the tolerance of every envelope it falls in; absent when no envelope covers it. */
export function envelopeFact(check: ReturnType<typeof envelopeCheck>): { met: boolean; value: string } | undefined {
  if (!check.rows.length) return undefined;
  if (!check.over.length) return { met: true, value: check.rows.map((r) => `${r.year}: ${r.state!.usedPct ?? '—'} %`).join(' · ') };
  return { met: !check.blocked.length, value: check.over.map((r) => `${r.year}: +${r.overKeur} k€`).join(' · ') };
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const amountOf = (v: unknown) => {
  const n = Number(text(v).replace(/\s/g, '').replace(',', '.'));
  return text(v) && Number.isFinite(n) && n >= 0 ? round1(n) : null;
};

/** A voted envelope: a fiscal year, a scope (group, zone or subsidiary), a category, an amount in k€. */
export function checkEnvelope(raw: Record<string, unknown>, ctx: { zones: ReadonlySet<string>; subsidiaries: ReadonlySet<string> }): Check<{ fiscalYear: number; zoneCode: string | null; subsidiaryCode: string | null; category: EnvelopeCategory; amountKeur: number; note: string | null }> {
  const fiscalYear = Number(text(raw.fiscalYear));
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2100) return { ok: false, error: 'Give the fiscal year' };
  const scope = text(raw.scope);
  let zoneCode: string | null = null;
  let subsidiaryCode: string | null = null;
  if (scope.startsWith('zone:') && ctx.zones.has(scope.slice(5))) zoneCode = scope.slice(5);
  else if (scope.startsWith('sub:') && ctx.subsidiaries.has(scope.slice(4))) subsidiaryCode = scope.slice(4);
  else if (scope !== 'group') return { ok: false, error: 'Choose the group, a zone or a subsidiary' };
  const category = (text(raw.category) || 'all') as EnvelopeCategory;
  if (!ENVELOPE_CATEGORIES.includes(category)) return { ok: false, error: 'Choose the category' };
  const amountKeur = amountOf(raw.amountKeur);
  if (amountKeur == null) return { ok: false, error: 'Give the amount in k€' };
  return { ok: true, value: { fiscalYear, zoneCode, subsidiaryCode, category, amountKeur, note: text(raw.note).slice(0, 500) || null } };
}

/** A carry-over (to the same scope next year) or a reallocation (to another envelope): an amount within the available, a reason. */
export function checkMovement(raw: Record<string, unknown>, from: EnvelopeState | null): Check<{ amountKeur: number; reason: string }> {
  if (!from) return { ok: false, error: 'Unknown envelope' };
  const amountKeur = amountOf(raw.amountKeur);
  if (amountKeur == null || amountKeur <= 0) return { ok: false, error: 'Give the amount in k€' };
  if (amountKeur > from.availableKeur) return { ok: false, error: 'The amount exceeds what is available in the envelope' };
  const reason = text(raw.reason).slice(0, 1000);
  if (reason.length < 3) return { ok: false, error: 'Give the reason' };
  return { ok: true, value: { amountKeur, reason } };
}

/** The scope of an envelope as text ("Group", "Zone AFN", "APM"). */
export const scopeOf = (e: { zoneCode: string | null; subsidiaryCode: string | null }) => e.subsidiaryCode ?? (e.zoneCode ? `Zone ${e.zoneCode}` : 'Group');
