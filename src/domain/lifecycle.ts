// The DIG-PRODI v4.0 cycle as a versioned definition read by a pure engine (docs/spec/03-cycle-dig-prodi.md). The STRUCTURE
// (phases, gates, criteria) ships with the code — a change is a new model version; the VALUES (target delays, thresholds)
// are stored with the model (`lifecycle_models.definition`) and adjusted by the administrator. A CAPEX keeps the model version
// it was opened with. Messages and labels are EN source strings translated by the pages.
import type { RoleKey } from '@/config/roles';

export type Phase = 'cadrage' | 'avant_projet' | 'execution' | 'demarrage';
export type GateCode = 'G1' | 'G2' | 'K3' | 'G3';
export type GateDecision = 'go' | 'go_with_conditions' | 'deferred' | 'no_go';

export const PHASES: readonly Phase[] = ['cadrage', 'avant_projet', 'execution', 'demarrage'];
export const GATES: readonly GateCode[] = ['G1', 'G2', 'K3', 'G3'];

// Phase labels: src/domain/capex-labels.ts.

export const GATE_LABEL: Record<GateCode, string> = {
  G1: 'Go studies',
  G2: 'Single gate CEO',
  K3: 'Ready to start',
  G3: 'Go transfer / closure',
};

export const DECISION_LABEL: Record<GateDecision, string> = {
  go: 'Go',
  go_with_conditions: 'Go with conditions',
  deferred: 'Deferred',
  no_go: 'No-go',
};

/** The gate that closes each phase (C-1: phase 4 closes with G3; Execution → Start-up is the K3 checkpoint). */
export const GATE_OF_PHASE: Record<Phase, GateCode> = { cadrage: 'G1', avant_projet: 'G2', execution: 'K3', demarrage: 'G3' };

/** The phase a Go at the gate leads to; null = the CAPEX is closed. */
export const NEXT_PHASE: Record<GateCode, Phase | null> = { G1: 'avant_projet', G2: 'execution', K3: 'demarrage', G3: null };

/** K3 is a checkpoint: a visa, no arbitration — only Go (C-1). */
export const DECISIONS_OF_GATE: Record<GateCode, readonly GateDecision[]> = {
  G1: ['go', 'go_with_conditions', 'deferred', 'no_go'],
  G2: ['go', 'go_with_conditions', 'deferred', 'no_go'],
  K3: ['go', 'deferred'],
  G3: ['go', 'go_with_conditions', 'deferred'],
};

/**
 * Who records the decision until the circuits of delivery 3 (spec 03 §2): the COPIL GPI through its president, the group
 * industrial director (N-6), for G1; the CEO for G2; the group industrial director for K3 and for G3 (countersigning the
 * internal client).
 */
export const GATE_DECIDER: Record<GateCode, RoleKey> = { G1: 'dir_ig', G2: 'ceo', K3: 'dir_ig', G3: 'dir_ig' };

export type CriterionSource = 'arche' | 'circuit' | 'safety' | 'keystone';

export interface CriterionDef {
  code: string;
  gate: GateCode;
  /** EN source string. */
  label: string;
  /** A blocking criterion prevents the decision unless forced with a reason. */
  blocking: boolean;
  /** False: the decider cannot force it. */
  forcible: boolean;
  source: CriterionSource;
  /** Delivery that brings the data the criterion reads (docs/PLAN.md); before it, the criterion is "not evaluated yet". */
  from: 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
}

/** Criteria of the gates (spec 03 §3; G1 typology: spec 06 §1). */
export const CRITERIA: readonly CriterionDef[] = [
  { code: 'g1_dossier', gate: 'G1', label: 'Dossier 1 complete and frozen', blocking: true, forcible: false, source: 'arche', from: 'L3' },
  { code: 'g1_budget_e50', gate: 'G1', label: 'E50 budget validated', blocking: true, forcible: true, source: 'arche', from: 'L2' },
  { code: 'g1_typology', gate: 'G1', label: 'Typology determined', blocking: true, forcible: false, source: 'arche', from: 'L2' },
  { code: 'g1_hs2', gate: 'G1', label: 'HS 2 HazID passed', blocking: true, forcible: true, source: 'safety', from: 'L5' },
  { code: 'g1_staffing', gate: 'G1', label: 'Team matches the staffing template', blocking: false, forcible: true, source: 'arche', from: 'L2' },
  { code: 'g1_sponsor_visa', gate: 'G1', label: 'Sponsor visa', blocking: true, forcible: false, source: 'circuit', from: 'L3' },
  { code: 'g1_experts', gate: 'G1', label: 'Required expert opinions given', blocking: true, forcible: true, source: 'circuit', from: 'L3' },
  { code: 'g2_dossier', gate: 'G2', label: 'Dossier 2 complete and frozen', blocking: true, forcible: false, source: 'arche', from: 'L3' },
  { code: 'g2_budget_e10', gate: 'G2', label: 'E10 budget validated by the group CFO', blocking: true, forcible: false, source: 'arche', from: 'L2' },
  { code: 'g2_pack', gate: 'G2', label: 'Engineering pack above the threshold', blocking: true, forcible: true, source: 'arche', from: 'L5' },
  { code: 'g2_hs3', gate: 'G2', label: 'HS 3 HazOp / FMEA passed', blocking: true, forcible: true, source: 'safety', from: 'L5' },
  { code: 'g2_permits', gate: 'G2', label: 'ICPE and building permit filed', blocking: true, forcible: true, source: 'arche', from: 'L5' },
  { code: 'g2_epc2i_offers', gate: 'G2', label: 'Firm EPC2i offers for every submitted machine need', blocking: true, forcible: true, source: 'keystone', from: 'L4' },
  { code: 'g2_experts', gate: 'G2', label: 'Quality, HSE, finance and operations opinions given', blocking: true, forcible: true, source: 'circuit', from: 'L3' },
  { code: 'g2_staffing', gate: 'G2', label: 'Staffing template complete', blocking: true, forcible: true, source: 'arche', from: 'L2' },
  { code: 'k3_hs4', gate: 'K3', label: 'HS 4 site inspection passed', blocking: true, forcible: true, source: 'safety', from: 'L5' },
  { code: 'k3_works', gate: 'K3', label: 'Works lots at the completion threshold', blocking: true, forcible: true, source: 'arche', from: 'L5' },
  { code: 'k3_sat_planned', gate: 'K3', label: 'EPC2i SATs planned', blocking: true, forcible: true, source: 'keystone', from: 'L4' },
  { code: 'g3_pssr', gate: 'G3', label: 'PSSR passed and PSSR discharge given', blocking: true, forcible: false, source: 'safety', from: 'L5' },
  { code: 'g3_hs6', gate: 'G3', label: 'HS 6 ASPD passed', blocking: true, forcible: true, source: 'safety', from: 'L5' },
  { code: 'g3_reserves', gate: 'G3', label: 'Reservations cleared (Arche and EPC2i projects)', blocking: true, forcible: true, source: 'keystone', from: 'L4' },
  { code: 'g3_rampup', gate: 'G3', label: 'Continuous days at nominal capacity reached', blocking: true, forcible: true, source: 'arche', from: 'L6' },
  { code: 'g3_mes_delay', gate: 'G3', label: 'Within the time limit after the start of commissioning', blocking: false, forcible: true, source: 'arche', from: 'L6' },
  { code: 'g3_accounts', gate: 'G3', label: 'Accounting closure attested by the controller', blocking: true, forcible: true, source: 'arche', from: 'L6' },
  { code: 'g3_rex', gate: 'G3', label: 'Lessons learned entered for every phase', blocking: true, forcible: true, source: 'arche', from: 'L6' },
];

export const criteriaOf = (gate: GateCode) => CRITERIA.filter((c) => c.gate === gate);

/** Adjustable values of a model version (spec 03 header; admin screen `admin-model`). */
export interface ModelValues {
  /** Target delay between submission and decision, in working days. */
  gateDelayDays: Record<GateCode, number>;
  /** Budget / reference revenue ratio from which a CAPEX is Strategic (C-5). */
  strategicRatioPct: number;
  /** Weighted engineering pack needed at G2. */
  packThresholdPct: number;
  /** Works lots completion needed at K3. */
  worksThresholdPct: number;
  /** Continuous days at nominal capacity needed at G3. */
  rampupDays: number;
  /** Months after the start of commissioning within which G3 is expected. */
  mesMaxMonths: number;
}

export const MODEL_CODE = 'dig-prodi';
export const MODEL_VERSION = '4.0';

export const DEFAULT_VALUES: ModelValues = {
  gateDelayDays: { G1: 2, G2: 10, K3: 5, G3: 10 },
  strategicRatioPct: 20,
  packThresholdPct: 80,
  worksThresholdPct: 95,
  rampupDays: 30,
  mesMaxMonths: 6,
};

/** Bounds of each value (the administrator's input is checked against them). */
export const VALUE_BOUNDS = {
  gateDelayDays: [1, 60],
  strategicRatioPct: [1, 100],
  packThresholdPct: [1, 100],
  worksThresholdPct: [1, 100],
  rampupDays: [1, 365],
  mesMaxMonths: [1, 36],
} as const;

/** Reads stored values over the defaults (a value missing or out of bounds falls back to its default). */
export function readValues(stored: unknown): ModelValues {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const num = (v: unknown, [lo, hi]: readonly [number, number], d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : d);
  const delays = (s.gateDelayDays && typeof s.gateDelayDays === 'object' ? s.gateDelayDays : {}) as Record<string, unknown>;
  return {
    gateDelayDays: Object.fromEntries(GATES.map((g) => [g, num(delays[g], VALUE_BOUNDS.gateDelayDays, DEFAULT_VALUES.gateDelayDays[g])])) as Record<GateCode, number>,
    strategicRatioPct: num(s.strategicRatioPct, VALUE_BOUNDS.strategicRatioPct, DEFAULT_VALUES.strategicRatioPct),
    packThresholdPct: num(s.packThresholdPct, VALUE_BOUNDS.packThresholdPct, DEFAULT_VALUES.packThresholdPct),
    worksThresholdPct: num(s.worksThresholdPct, VALUE_BOUNDS.worksThresholdPct, DEFAULT_VALUES.worksThresholdPct),
    rampupDays: num(s.rampupDays, VALUE_BOUNDS.rampupDays, DEFAULT_VALUES.rampupDays),
    mesMaxMonths: num(s.mesMaxMonths, VALUE_BOUNDS.mesMaxMonths, DEFAULT_VALUES.mesMaxMonths),
  };
}

// ── Criteria evaluation ───────────────────────────────────────────────────────────────────────────────────────────────

/** What is known of a criterion: met or not, with a short value ("E30", "2 / 3"); absent = its data does not exist yet. */
export interface CriterionFact {
  met: boolean;
  value?: string;
}

export type CriterionState = 'met' | 'unmet' | 'forced' | 'not_evaluated';

export interface CriterionResult {
  code: string;
  label: string;
  blocking: boolean;
  forcible: boolean;
  state: CriterionState;
  value: string | null;
  forcedReason: string | null;
  from: CriterionDef['from'];
}

export interface GateEvaluation {
  gate: GateCode;
  results: CriterionResult[];
  /** Blocking criteria neither met nor forced. */
  blockers: CriterionResult[];
  /** Non-blocking criteria not met (alerts). */
  alerts: CriterionResult[];
  /** True when a Go can be recorded. */
  passable: boolean;
}

/**
 * Evaluates a gate from the facts known and the criteria the decider forces (code → reason). A criterion without a fact is
 * "not evaluated": its data comes with a later delivery, and it does not block until then. A forced reason is accepted only on
 * a forcible criterion that is not met.
 */
export function evaluateGate(gate: GateCode, facts: Readonly<Record<string, CriterionFact | undefined>>, forced: Readonly<Record<string, string>> = {}): GateEvaluation {
  const results = criteriaOf(gate).map((c): CriterionResult => {
    const f = facts[c.code];
    const reason = forced[c.code]?.trim() || null;
    let state: CriterionState = !f ? 'not_evaluated' : f.met ? 'met' : 'unmet';
    if (state === 'unmet' && c.forcible && reason) state = 'forced';
    return { code: c.code, label: c.label, blocking: c.blocking, forcible: c.forcible, state, value: f?.value ?? null, forcedReason: state === 'forced' ? reason : null, from: c.from };
  });
  const blockers = results.filter((r) => r.blocking && r.state === 'unmet');
  const alerts = results.filter((r) => !r.blocking && r.state === 'unmet');
  return { gate, results, blockers, alerts, passable: blockers.length === 0 };
}

// ── Transitions ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type CapexStatus = 'draft' | 'active' | 'on_hold' | 'closed' | 'abandoned';

export interface CycleState {
  status: CapexStatus;
  phase: Phase;
}

export type TransitionCheck<T> = { ok: true; value: T } | { ok: false; error: string };

/** The gate the CAPEX faces now, or null when it is not in an open phase. */
export function currentGate(s: CycleState): GateCode | null {
  return s.status === 'active' ? GATE_OF_PHASE[s.phase] : null;
}

/** Opening a draft: it enters phase 1 (spec 03 §1). The lead must be named (spec 01 §3). */
export function openCapex(s: CycleState, hasLead: boolean): TransitionCheck<CycleState> {
  if (s.status !== 'draft') return { ok: false, error: 'Only a draft can be opened' };
  if (!hasLead) return { ok: false, error: 'Name the project lead before opening the CAPEX' };
  return { ok: true, value: { status: 'active', phase: 'cadrage' } };
}

/**
 * The effect of a decision at the current gate: Go and Go with conditions pass to the next phase (G3: closed); Deferred keeps
 * the phase (a new session of the gate); No-go abandons the CAPEX (reason required). A Go needs a passable evaluation.
 */
export function decideGate(
  s: CycleState,
  gate: GateCode,
  decision: GateDecision,
  ev: GateEvaluation,
  opts: { reason?: string | null; conditions?: readonly string[] } = {},
): TransitionCheck<CycleState> {
  if (currentGate(s) !== gate) return { ok: false, error: 'This gate is not the one the CAPEX faces' };
  if (!DECISIONS_OF_GATE[gate].includes(decision)) return { ok: false, error: 'This decision is not possible at this gate' };
  if (decision === 'no_go' || decision === 'deferred') {
    if (!opts.reason?.trim()) return { ok: false, error: 'Give the reason for the decision' };
    return { ok: true, value: decision === 'no_go' ? { status: 'abandoned', phase: s.phase } : s };
  }
  if (!ev.passable) return { ok: false, error: 'Blocking criteria are not met' };
  if (decision === 'go_with_conditions' && !opts.conditions?.some((c) => c.trim())) return { ok: false, error: 'Enter at least one condition' };
  const next = NEXT_PHASE[gate];
  return { ok: true, value: next ? { status: 'active', phase: next } : { status: 'closed', phase: s.phase } };
}

/** Suspension on decision and resumption to the phase of origin (spec 03 §1). */
export function suspend(s: CycleState): TransitionCheck<CycleState> {
  return s.status === 'active' ? { ok: true, value: { status: 'on_hold', phase: s.phase } } : { ok: false, error: 'Only an active CAPEX can be suspended' };
}
export function resume(s: CycleState): TransitionCheck<CycleState> {
  return s.status === 'on_hold' ? { ok: true, value: { status: 'active', phase: s.phase } } : { ok: false, error: 'Only a suspended CAPEX can be resumed' };
}

/** The administrator's input for the values (fields `delay:<gate>` and one per value); each one within its bounds. */
export function checkModelValues(raw: Record<string, unknown>): { ok: true; value: ModelValues } | { ok: false; error: string } {
  const read = (k: string, [lo, hi]: readonly [number, number]) => {
    const n = Number(String(raw[k] ?? '').trim().replace(',', '.'));
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  };
  const delays: Partial<Record<GateCode, number>> = {};
  for (const g of GATES) {
    const n = read(`delay:${g}`, VALUE_BOUNDS.gateDelayDays);
    if (n == null) return { ok: false, error: 'Delays go from 1 to 60 working days' };
    delays[g] = n;
  }
  const v = {
    strategicRatioPct: read('strategicRatioPct', VALUE_BOUNDS.strategicRatioPct),
    packThresholdPct: read('packThresholdPct', VALUE_BOUNDS.packThresholdPct),
    worksThresholdPct: read('worksThresholdPct', VALUE_BOUNDS.worksThresholdPct),
    rampupDays: read('rampupDays', VALUE_BOUNDS.rampupDays),
    mesMaxMonths: read('mesMaxMonths', VALUE_BOUNDS.mesMaxMonths),
  };
  if (Object.values(v).some((x) => x == null)) return { ok: false, error: 'Enter whole numbers within the bounds shown' };
  return { ok: true, value: { gateDelayDays: delays as Record<GateCode, number>, ...(v as Omit<ModelValues, 'gateDelayDays'>) } };
}
