// Delegation matrix and management of change (docs/spec/05 §5; C-4): after G2, every change (MoC) goes to the smallest level
// whose ceilings all cover the change and the cumulative cost of the changes already approved. The values are the seed values
// of the spec, dated, replaced by the group's matrix through the administration. Pure.
import type { Check } from './admin';
import { parseKeur, type Typology } from './budget';

export type DeciderLevel = 'copil_projet' | 'dir_ig' | 'ceo';
export const LEVELS: readonly DeciderLevel[] = ['copil_projet', 'dir_ig', 'ceo'];
/** The profile that records a level's decision: the sponsor for the project steering committee (N-29 family default). */
export const DECIDER_ROLE_OF = { copil_projet: 'sponsor', dir_ig: 'dir_ig', ceo: 'ceo' } as const;

export const LEVEL_LABEL: Record<DeciderLevel, string> = { copil_projet: 'Project steering committee', dir_ig: 'Group industrial director', ceo: 'CEO' };

export type ChangeKind = 'cost' | 'schedule' | 'scope' | 'contingency_draw';
export const CHANGE_KINDS: readonly ChangeKind[] = ['cost', 'schedule', 'scope', 'contingency_draw'];
export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = { cost: 'Cost', schedule: 'Schedule', scope: 'Scope', contingency_draw: 'Contingency draw-down' };

/** Ceilings of one level: % of the G2 budget and k€ for a cost change, days for a schedule change. */
export interface Ceiling {
  costPct: number;
  costKeur: number;
  delayDays: number;
}

export interface DelegationMatrix {
  /** Copil projet and Dir.IG ceilings by typology; above Dir.IG, the CEO. */
  light: { copil_projet: Ceiling; dir_ig: Ceiling };
  strategic: { copil_projet: Ceiling; dir_ig: Ceiling };
  /** Cumulative cost of the approved changes, % of the G2 budget: Copil projet up to, then Dir.IG up to, then CEO (rebaseline). */
  cumulativePct: { copil_projet: number; dir_ig: number };
  /** Contingency draw-down up to this % of the provision: Copil projet; above: Dir.IG. */
  contingencyPct: number;
}

/** Seed values of spec 05 §5 (to replace with the group's matrix, C-4). */
export const DEFAULT_MATRIX: DelegationMatrix = {
  light: { copil_projet: { costPct: 3, costKeur: 250, delayDays: 30 }, dir_ig: { costPct: 7, costKeur: 1000, delayDays: 90 } },
  strategic: { copil_projet: { costPct: 1, costKeur: 500, delayDays: 15 }, dir_ig: { costPct: 5, costKeur: 2500, delayDays: 60 } },
  cumulativePct: { copil_projet: 5, dir_ig: 10 },
  contingencyPct: 50,
};

export interface ChangeFacts {
  kind: ChangeKind;
  /** Extra cost in k€ (0 when none). */
  amountKeur: number;
  /** Extra delay in days (0 when none). */
  delayDays: number;
}

export interface DelegationContext {
  typology: Typology;
  /** Central amount of the G2 baseline (E10). */
  g2BudgetKeur: number;
  /** Cost of the changes already approved. */
  approvedCostKeur: number;
  /** Contingency provision (k€), for a draw-down; null when unknown. */
  contingencyKeur: number | null;
}

const rank = (l: DeciderLevel) => LEVELS.indexOf(l);
const max = (...ls: DeciderLevel[]) => ls.reduce((a, b) => (rank(b) > rank(a) ? b : a), 'copil_projet');

function costLevel(m: DelegationMatrix, ctx: DelegationContext, amount: number): DeciderLevel {
  if (amount <= 0) return 'copil_projet';
  const pct = ctx.g2BudgetKeur > 0 ? (amount / ctx.g2BudgetKeur) * 100 : Infinity;
  const t = m[ctx.typology];
  const fits = (c: Ceiling) => pct <= c.costPct && amount <= c.costKeur;
  const own: DeciderLevel = fits(t.copil_projet) ? 'copil_projet' : fits(t.dir_ig) ? 'dir_ig' : 'ceo';
  const cum = ctx.g2BudgetKeur > 0 ? ((ctx.approvedCostKeur + amount) / ctx.g2BudgetKeur) * 100 : Infinity;
  const cumLevel: DeciderLevel = cum <= m.cumulativePct.copil_projet ? 'copil_projet' : cum <= m.cumulativePct.dir_ig ? 'dir_ig' : 'ceo';
  return max(own, cumLevel);
}

function delayLevel(m: DelegationMatrix, typology: Typology, days: number): DeciderLevel {
  if (days <= 0) return 'copil_projet';
  const t = m[typology];
  return days <= t.copil_projet.delayDays ? 'copil_projet' : days <= t.dir_ig.delayDays ? 'dir_ig' : 'ceo';
}

/** The level that decides the change (spec 05 §5): the highest of what its cost, its delay and its kind require. */
export function deciderOf(ch: ChangeFacts, ctx: DelegationContext, m: DelegationMatrix = DEFAULT_MATRIX): DeciderLevel {
  if (ch.kind === 'contingency_draw') {
    const within = ctx.contingencyKeur != null && ctx.contingencyKeur > 0 && (ch.amountKeur / ctx.contingencyKeur) * 100 <= m.contingencyPct;
    return max(within ? 'copil_projet' : 'dir_ig', delayLevel(m, ctx.typology, ch.delayDays));
  }
  const cost = costLevel(m, ctx, ch.amountKeur);
  const delay = delayLevel(m, ctx.typology, ch.delayDays);
  if (ch.kind === 'scope') return max('dir_ig', cost === 'ceo' ? 'ceo' : 'dir_ig', delay);
  return max(cost, delay);
}

/** A change typed by the project lead: a title, a kind, a cost and / or a delay that is not zero for its kind. */
export function checkChange(raw: Record<string, unknown>): Check<ChangeFacts & { title: string; description: string | null }> {
  const title = String(raw.title ?? '').trim();
  if (title.length < 3 || title.length > 200) return { ok: false, error: 'Describe the change' };
  const kind = String(raw.kind ?? '');
  if (!(CHANGE_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Choose the kind of change' };
  const a = String(raw.amountKeur ?? '').trim();
  const amountKeur = a ? parseKeur(a) : 0;
  if (amountKeur == null) return { ok: false, error: 'Enter the amount in k€' };
  const d = String(raw.delayDays ?? '').trim();
  const delayDays = d ? Number(d) : 0;
  if (!Number.isInteger(delayDays) || delayDays < 0 || delayDays > 3650) return { ok: false, error: 'Enter the delay in days' };
  if (kind === 'schedule' && !delayDays) return { ok: false, error: 'Enter the delay in days' };
  if ((kind === 'cost' || kind === 'contingency_draw') && !amountKeur) return { ok: false, error: 'Enter the amount in k€' };
  return { ok: true, value: { title, kind: kind as ChangeKind, amountKeur, delayDays, description: String(raw.description ?? '').trim().slice(0, 4000) || null } };
}

/** Reads a stored matrix over the defaults (missing or invalid values fall back). */
export function readMatrix(stored: unknown): DelegationMatrix {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<DelegationMatrix>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const ceil = (v: Partial<Ceiling> | undefined, d: Ceiling): Ceiling => ({ costPct: num(v?.costPct, d.costPct), costKeur: num(v?.costKeur, d.costKeur), delayDays: num(v?.delayDays, d.delayDays) });
  const typ = (t: 'light' | 'strategic') => ({ copil_projet: ceil(s[t]?.copil_projet, DEFAULT_MATRIX[t].copil_projet), dir_ig: ceil(s[t]?.dir_ig, DEFAULT_MATRIX[t].dir_ig) });
  return {
    light: typ('light'),
    strategic: typ('strategic'),
    cumulativePct: { copil_projet: num(s.cumulativePct?.copil_projet, DEFAULT_MATRIX.cumulativePct.copil_projet), dir_ig: num(s.cumulativePct?.dir_ig, DEFAULT_MATRIX.cumulativePct.dir_ig) },
    contingencyPct: num(s.contingencyPct, DEFAULT_MATRIX.contingencyPct),
  };
}

/** The administrator's input of the matrix: one field per value (`light.copil_projet.costPct`…), non-negative numbers; each level above the one below. */
export function checkMatrix(raw: Record<string, unknown>): Check<DelegationMatrix> {
  const out = structuredClone(DEFAULT_MATRIX) as DelegationMatrix;
  const read = (k: string) => {
    const n = Number(String(raw[k] ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  for (const t of ['light', 'strategic'] as const)
    for (const l of ['copil_projet', 'dir_ig'] as const)
      for (const f of ['costPct', 'costKeur', 'delayDays'] as const) {
        const n = read(`${t}.${l}.${f}`);
        if (n == null) return { ok: false, error: 'Enter non-negative numbers' };
        out[t][l][f] = n;
      }
  const c1 = read('cumulativePct.copil_projet');
  const c2 = read('cumulativePct.dir_ig');
  const cp = read('contingencyPct');
  if (c1 == null || c2 == null || cp == null) return { ok: false, error: 'Enter non-negative numbers' };
  out.cumulativePct = { copil_projet: c1, dir_ig: c2 };
  out.contingencyPct = cp;
  for (const t of ['light', 'strategic'] as const) {
    const a = out[t].copil_projet;
    const b = out[t].dir_ig;
    if (a.costPct > b.costPct || a.costKeur > b.costKeur || a.delayDays > b.delayDays) return { ok: false, error: 'The group industrial director’s ceilings must be at least those of the project steering committee' };
  }
  if (c1 > c2) return { ok: false, error: 'The group industrial director’s ceilings must be at least those of the project steering committee' };
  return { ok: true, value: out };
}
