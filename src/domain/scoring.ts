// Multi-criteria prioritisation of the CAPEX (AR-044, DECISIONS.md §5): a grid of weighted criteria kept by the group industrial
// director — financial value (NPV of the business plan over the budget) and return (IRR), computed; risk, computed from the open
// risks; strategic alignment, urgency, safety and compliance, scored by the group (0 to 5) —, the score of each CAPEX on 100
// (weighted mean of the criteria scored) and the ranking of the CAPEX across subsidiaries and zones. Pure.

/** Who scores a CAPEX on the manual criteria: the group industrial director, the group CFO, a COPIL GPI member. */
export const SCORERS = ['dir_ig', 'group_cfo', 'copil_member'] as const;

export type ScoringSource = 'npv_ratio' | 'irr' | 'risk';

export interface ScoringCriterion {
  code: string;
  /** EN source string. */
  label: string;
  kind: 'computed' | 'manual';
  source: ScoringSource | null;
  /** Default weight (the director's grid overrides it). */
  weight: number;
}

export const SCORING_CRITERIA: readonly ScoringCriterion[] = [
  { code: 'value', label: 'Financial value (NPV / budget)', kind: 'computed', source: 'npv_ratio', weight: 30 },
  { code: 'return', label: 'Internal rate of return', kind: 'computed', source: 'irr', weight: 10 },
  { code: 'risk', label: 'Risk (open risks)', kind: 'computed', source: 'risk', weight: 15 },
  { code: 'strategy', label: 'Strategic alignment', kind: 'manual', source: null, weight: 25 },
  { code: 'urgency', label: 'Urgency', kind: 'manual', source: null, weight: 10 },
  { code: 'safety', label: 'Safety and compliance', kind: 'manual', source: null, weight: 10 },
];

export const MANUAL_CRITERIA = SCORING_CRITERIA.filter((c) => c.kind === 'manual');

export interface ScoringFacts {
  npvKeur: number | null;
  bacKeur: number | null;
  irrPct: number | null;
  majorRisks: number;
  openRisks: number;
}

/** The score (0 to 5) a computed criterion gets from the CAPEX's data; null when the data is missing. */
export function computedScore(source: ScoringSource, f: ScoringFacts): number | null {
  switch (source) {
    case 'npv_ratio': {
      if (f.npvKeur == null || !f.bacKeur) return null;
      const r = f.npvKeur / f.bacKeur;
      return r >= 1 ? 5 : r >= 0.5 ? 4 : r >= 0.2 ? 3 : r >= 0 ? 2 : 1;
    }
    case 'irr':
      if (f.irrPct == null) return null;
      return f.irrPct >= 25 ? 5 : f.irrPct >= 15 ? 4 : f.irrPct >= 10 ? 3 : f.irrPct >= 5 ? 2 : 1;
    case 'risk':
      return f.majorRisks === 0 ? (f.openRisks <= 3 ? 5 : 4) : f.majorRisks === 1 ? 3 : f.majorRisks === 2 ? 2 : 1;
  }
}

export interface CriterionScore {
  code: string;
  label: string;
  weight: number;
  kind: 'computed' | 'manual';
  score: number | null;
  note: string | null;
}

/** The criteria of a CAPEX with their score (computed, or the group's for the manual ones). */
export function criteriaScores(weights: Readonly<Record<string, number>>, facts: ScoringFacts, manual: Readonly<Record<string, { score: number; note: string | null }>>): CriterionScore[] {
  return SCORING_CRITERIA.map((c) => ({
    code: c.code, label: c.label, weight: weights[c.code] ?? c.weight, kind: c.kind,
    score: c.kind === 'computed' ? computedScore(c.source!, facts) : manual[c.code]?.score ?? null,
    note: c.kind === 'manual' ? manual[c.code]?.note ?? null : null,
  }));
}

/** Below this share of the grid's weight scored, a CAPEX has no score (one criterion alone does not rank it). */
export const MIN_COVERAGE_PCT = 80;

/** The score on 100: the weighted mean of the scored criteria (× 20), once `MIN_COVERAGE_PCT` of the weight is scored;
 * `coverage`: the share of the weight scored. */
export function totalScore(scores: readonly CriterionScore[]): { score: number | null; coveragePct: number } {
  const all = scores.reduce((s, c) => s + c.weight, 0);
  const scored = scores.filter((c) => c.score != null && c.weight > 0);
  const w = scored.reduce((s, c) => s + c.weight, 0);
  if (!w) return { score: null, coveragePct: 0 };
  const coveragePct = Math.round((w / all) * 100);
  if (coveragePct < MIN_COVERAGE_PCT) return { score: null, coveragePct };
  return { score: Math.round((scored.reduce((s, c) => s + c.weight * c.score!, 0) / w) * 20 * 10) / 10, coveragePct };
}

/** The CAPEX ranked by score (unscored last), ties by code. */
export function ranked<T extends { code: string; score: number | null }>(rows: readonly T[]): (T & { rank: number | null })[] {
  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.code.localeCompare(b.code));
  let rank = 0;
  return sorted.map((r) => ({ ...r, rank: r.score == null ? null : ++rank }));
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };

/** The manual scores of a CAPEX: each 0 to 5 (empty: not scored), a note each. */
export function checkScores(raw: Record<string, unknown>): Check<{ code: string; score: number; note: string | null }[]> {
  const out: { code: string; score: number; note: string | null }[] = [];
  for (const c of MANUAL_CRITERIA) {
    const s = String(raw[`score:${c.code}`] ?? '').trim();
    if (!s) continue;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0 || n > 5) return { ok: false, error: 'Scores go from 0 to 5' };
    out.push({ code: c.code, score: n, note: String(raw[`note:${c.code}`] ?? '').trim().slice(0, 500) || null });
  }
  return { ok: true, value: out };
}

/** The weights of the grid: whole numbers from 0 to 100, not all zero. */
export function checkWeights(raw: Record<string, unknown>): Check<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const c of SCORING_CRITERIA) {
    const n = Number(String(raw[`weight:${c.code}`] ?? '').trim());
    if (!Number.isInteger(n) || n < 0 || n > 100) return { ok: false, error: 'Weights are whole numbers from 0 to 100' };
    out[c.code] = n;
  }
  if (!Object.values(out).some((w) => w > 0)) return { ok: false, error: 'Give a weight to at least one criterion' };
  return { ok: true, value: out };
}
