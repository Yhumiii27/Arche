// Budget versions, estimate classes and typology (docs/spec/03 §5, 06 §1; C-5, C-8). Pure: the Server Functions and the
// pages share it. Amounts in k€ (N-2).

export type EstimateClass = 'E50' | 'E30' | 'E10';
export type BudgetStatus = 'draft' | 'submitted' | 'validated' | 'superseded';
export type Typology = 'light' | 'strategic';

export const ESTIMATE_CLASSES: readonly EstimateClass[] = ['E50', 'E30', 'E10'];

/** Range of each class around the central amount (spec 03 §5). */
export const CLASS_RANGE: Record<EstimateClass, { lowPct: number; highPct: number }> = {
  E50: { lowPct: -50, highPct: 50 },
  E30: { lowPct: -30, highPct: 30 },
  E10: { lowPct: -5, highPct: 10 },
};

/** Precision rank: a higher rank is a narrower class. */
export const classRank = (c: EstimateClass) => ESTIMATE_CLASSES.indexOf(c);

/** True when `c` is at least as precise as `needed`. */
export const meetsClass = (c: EstimateClass | null | undefined, needed: EstimateClass) => !!c && classRank(c) >= classRank(needed);

/** Low and high bounds of a central amount in a class. */
export function rangeOf(centralKeur: number, c: EstimateClass): { low: number; high: number } {
  const r = CLASS_RANGE[c];
  return { low: round1(centralKeur * (1 + r.lowPct / 100)), high: round1(centralKeur * (1 + r.highPct / 100)) };
}

/** Relative width of a class (E30 → 60, E10 → 15). */
export const classWidthPct = (c: EstimateClass) => CLASS_RANGE[c].highPct - CLASS_RANGE[c].lowPct;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Who validates a version: the group CFO for E10 (spec 03 §5); for E50 and E30 the subsidiary controller or the group CFO. */
export function validatorsOf(c: EstimateClass): readonly ('controller' | 'group_cfo')[] {
  return c === 'E10' ? ['group_cfo'] : ['controller', 'group_cfo'];
}

/** Allowed status moves of a version; a validated version is frozen (spec 01 §3). */
export function canMoveVersion(from: BudgetStatus, to: BudgetStatus): boolean {
  return (from === 'draft' && to === 'submitted') || (from === 'submitted' && (to === 'validated' || to === 'draft')) || (from === 'validated' && to === 'superseded');
}

/** A budget amount typed by a person: "1 250,5" → 1250.5; null when not a non-negative number. */
export function parseKeur(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? round1(n) : null;
}

/** Central amount of a version: the sum of its lines. */
export const centralOf = (lines: readonly { amountKeur: number }[]) => round1(lines.reduce((s, l) => s + l.amountKeur, 0));

// ── Typology (C-5, spec 06 §1) ────────────────────────────────────────────────────────────────────────────────────────

export interface TypologyInput {
  investmentType: string;
  /** Central amount of the latest validated version; null without one. */
  centralKeur: number | null;
  /** Reference revenue of the subsidiary (latest closed fiscal year); null when not entered. */
  revenueKeur: number | null;
  thresholdPct: number;
}

export interface TypologyResult {
  /** null = "to be determined" (no reference revenue or no validated budget): it blocks G1. */
  typology: Typology | null;
  ratioPct: number | null;
  /** EN source string explaining the result. */
  basis: string;
}

/** A new plant is Strategic outright; otherwise ratio budget / revenue ≥ threshold → Strategic ("= 20 %" counts as Strategic). */
export function computeTypology(i: TypologyInput): TypologyResult {
  if (i.investmentType === 'new_plant') return { typology: 'strategic', ratioPct: ratio(i), basis: 'New plant: Strategic outright' };
  if (i.revenueKeur == null || i.revenueKeur <= 0) return { typology: null, ratioPct: null, basis: 'No reference revenue entered for the subsidiary' };
  if (i.centralKeur == null) return { typology: null, ratioPct: null, basis: 'No validated budget version yet' };
  // Compared unrounded: 19.99 % stays Light even though it is shown as 20 %.
  const exact = (i.centralKeur / i.revenueKeur) * 100;
  return { typology: exact >= i.thresholdPct ? 'strategic' : 'light', ratioPct: ratio(i), basis: 'Budget / reference revenue ratio' };
}

function ratio(i: TypologyInput): number | null {
  if (i.centralKeur == null || i.revenueKeur == null || i.revenueKeur <= 0) return null;
  return round1((i.centralKeur / i.revenueKeur) * 100);
}

/** Reference revenue to use: the latest fiscal year strictly before the current year (latest closed year), else the latest. */
export function referenceRevenueOf(rows: readonly { fiscalYear: number; revenueKeur: number }[], today: string): { fiscalYear: number; revenueKeur: number } | null {
  const year = Number(today.slice(0, 4));
  const sorted = [...rows].sort((a, b) => b.fiscalYear - a.fiscalYear);
  return sorted.find((r) => r.fiscalYear < year) ?? sorted[0] ?? null;
}

// ── Staffing template (CDC §3, spec 06 §2) ────────────────────────────────────────────────────────────────────────────

export type TeamRole = 'lead' | 'controller' | 'co_dig' | 'epc2i_pmo' | 'internal_client' | 'member';

export const STAFFING: Record<Typology, readonly TeamRole[]> = {
  light: ['lead', 'co_dig'],
  strategic: ['lead', 'controller', 'epc2i_pmo'],
};

/** The template roles nobody holds yet (empty = the team is complete); a CAPEX without typology uses the Light template. */
export function missingStaff(typology: Typology | null, held: readonly string[]): TeamRole[] {
  return STAFFING[typology ?? 'light'].filter((r) => !held.includes(r));
}
