// Accounting closure of a CAPEX (N-15, confirmed): the subsidiary controller's statement — final cost of every lot, gap to
// the G2 budget, AFE balance — without a Sage link in v1. G3 needs the statement complete; the controller then attests it in
// the G3 circuit ("Accounting closure attestation"). Lessons learned (REX, D22): entries by phase and category, published to
// the library and to pub_rex; G3 needs at least one entry per phase. Pure.
import { parseKeur, round1 } from './budget';
import type { Phase } from './lifecycle';

export interface FinalCostInput {
  /** Lot id → final cost (k€). */
  costs: Record<string, number>;
  afeBalanceKeur: number;
  note: string | null;
}

/** The statement: a final cost (k€, ≥ 0) for every lot, the AFE balance (may be negative: overrun). */
export function checkClosure(raw: Record<string, unknown>, lotIds: readonly string[]): { ok: true; value: FinalCostInput } | { ok: false; error: string } {
  const costs: Record<string, number> = {};
  for (const id of lotIds) {
    const v = parseKeur(raw[`lot:${id}`]);
    if (v == null) return { ok: false, error: 'Give the final cost of every lot (k€)' };
    costs[id] = v;
  }
  const s = String(raw.afeBalanceKeur ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  const afe = s && /^-?\d+(\.\d+)?$/.test(s) ? round1(Number(s)) : null;
  if (afe == null) return { ok: false, error: 'Give the AFE balance (k€)' };
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 2000) || null : null;
  return { ok: true, value: { costs, afeBalanceKeur: afe, note } };
}

export interface ClosureSummary {
  finalKeur: number;
  g2Keur: number | null;
  gapKeur: number | null;
  gapPct: number | null;
}

export function closureSummary(costs: readonly number[], g2Keur: number | null): ClosureSummary {
  const finalKeur = round1(costs.reduce((a, b) => a + b, 0));
  return { finalKeur, g2Keur, gapKeur: g2Keur == null ? null : round1(finalKeur - g2Keur), gapPct: g2Keur ? round1((finalKeur / g2Keur - 1) * 100) : null };
}

/** G3 criterion "accounting closure attested by the controller": the statement covers every lot. */
export function accountsFact(i: { lots: number; costed: number; statement: boolean }): { met: boolean; value: string } {
  return { met: i.statement && i.lots > 0 && i.costed === i.lots, value: i.statement ? `${i.costed} / ${i.lots}` : 'No statement' };
}

// ── Lessons learned ───────────────────────────────────────────────────────────────────────────────────────────────────

export const REX_CATEGORIES = ['technical', 'schedule', 'cost', 'hse', 'organisation', 'supplier', 'regulatory', 'other'] as const;
export type RexCategory = (typeof REX_CATEGORIES)[number];
export const REX_CATEGORY_LABEL: Record<RexCategory, string> = {
  technical: 'Technical', schedule: 'Schedule', cost: 'Cost', hse: 'HSE', organisation: 'Organisation', supplier: 'Suppliers and EPC2i', regulatory: 'Regulatory', other: 'Other',
};

const PHASES: readonly Phase[] = ['cadrage', 'avant_projet', 'execution', 'demarrage'];

export interface RexInput {
  phase: Phase;
  category: RexCategory;
  title: string;
  text: string;
  /** What to do next time (optional; `recommandation` of the common REX contract). */
  recommendation: string | null;
}

export function checkRex(raw: Record<string, unknown>): { ok: true; value: RexInput } | { ok: false; error: string } {
  const phase = String(raw.phase ?? '') as Phase;
  if (!PHASES.includes(phase)) return { ok: false, error: 'Choose the phase' };
  const category = String(raw.category ?? '') as RexCategory;
  if (!REX_CATEGORIES.includes(category)) return { ok: false, error: 'Choose the category' };
  const title = String(raw.title ?? '').trim().slice(0, 200);
  if (!title) return { ok: false, error: 'Give a title' };
  const text = String(raw.text ?? '').trim().slice(0, 5000);
  if (!text) return { ok: false, error: 'Describe the lesson' };
  const recommendation = String(raw.recommendation ?? '').trim().slice(0, 5000) || null;
  return { ok: true, value: { phase, category, title, text, recommendation } };
}

/** G3 criterion "lessons learned entered for every phase" (spec 03 §3): ≥ 1 entry per phase. */
export function rexFact(entries: readonly { phase: string }[]): { met: boolean; value: string } {
  const covered = PHASES.filter((p) => entries.some((e) => e.phase === p)).length;
  return { met: covered === PHASES.length, value: `${covered} / ${PHASES.length}` };
}
