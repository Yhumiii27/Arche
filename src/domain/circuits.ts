// Gate circuits (docs/spec/05 §1–2, §4): the steps each gate goes through — expert opinions, visas, the decision, the
// signature, countersignatures, discharge and attestation — in parallel groups, their deadlines in working days and who may
// act on them. Pure: the Server Functions run the transitions inside their transaction; the pages show them. EN strings.
import type { ExpertSpeciality, RoleKey } from '@/config/roles';
import { addDaysIso, dowOfIso } from '@/lib/dates';
import type { RoleAssignment } from './rights';
import type { Check } from './admin';
import { holdsOn } from './capex';
import type { GateCode, GateDecision, ModelValues } from './lifecycle';

export type StepKind = 'opinion' | 'review' | 'visa' | 'decision' | 'signature' | 'countersign' | 'quitus' | 'attestation';
export type StepStatus = 'waiting' | 'open' | 'done' | 'cancelled';
/** Who acts: a profile, or the internal client named in the CAPEX team (G3 countersignature). */
export type StepActor = RoleKey | 'internal_client';

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  opinion: 'Expert opinion', review: 'COPIL GPI review', visa: 'Visa', decision: 'Decision', signature: 'Signature',
  countersign: 'Countersignature', quitus: 'Discharge', attestation: 'Attestation',
};

export interface StepTemplate {
  group: number;
  kind: StepKind;
  actor: StepActor;
  speciality?: ExpertSpeciality;
  /** A step whose absence never blocks (COPIL GPI members' online opinions). */
  optional?: boolean;
  /** Its outcome is the gate decision. */
  decides?: boolean;
  /** EN source string. */
  label: string;
}

/** Circuit of each gate (spec 05 §2): G1 depends on the typology (Strategic: finance opinion too). */
export function circuitTemplate(gate: GateCode, typology: 'light' | 'strategic' | null): StepTemplate[] {
  switch (gate) {
    case 'G1':
      return [
        { group: 1, kind: 'opinion', actor: 'expert', speciality: 'hse', label: 'HSE opinion' },
        ...(typology === 'strategic' ? [{ group: 1, kind: 'opinion' as const, actor: 'expert' as const, speciality: 'finance' as const, label: 'Finance opinion' }] : []),
        { group: 2, kind: 'visa', actor: 'sponsor', label: 'Sponsor visa' },
        { group: 3, kind: 'review', actor: 'copil_member', optional: true, label: 'COPIL GPI members’ review' },
        { group: 3, kind: 'decision', actor: 'dir_ig', decides: true, label: 'COPIL GPI decision (president)' },
      ];
    case 'G2':
      return [
        { group: 1, kind: 'opinion', actor: 'expert', speciality: 'quality', label: 'Quality opinion' },
        { group: 1, kind: 'opinion', actor: 'expert', speciality: 'hse', label: 'HSE opinion' },
        { group: 1, kind: 'opinion', actor: 'expert', speciality: 'finance', label: 'Finance opinion' },
        { group: 1, kind: 'opinion', actor: 'expert', speciality: 'operations', label: 'Operations opinion' },
        { group: 2, kind: 'visa', actor: 'dir_ig', label: 'Technical compliance visa' },
        { group: 2, kind: 'visa', actor: 'group_cfo', label: 'E10 business plan visa' },
        { group: 3, kind: 'signature', actor: 'ceo', decides: true, label: 'CEO signature' },
      ];
    case 'K3':
      return [{ group: 1, kind: 'visa', actor: 'dir_ig', decides: true, label: 'Ready-to-start visa' }];
    case 'G3':
      return [
        { group: 1, kind: 'quitus', actor: 'group_hse', label: 'PSSR discharge' },
        { group: 1, kind: 'attestation', actor: 'controller', label: 'Accounting closure attestation' },
        { group: 2, kind: 'countersign', actor: 'internal_client', label: 'Internal client countersignature' },
        { group: 2, kind: 'countersign', actor: 'dir_ig', decides: true, label: 'Group industrial director countersignature' },
      ];
  }
}

// ── Outcomes ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Outcome =
  | 'favorable' | 'reserved' | 'unfavorable' // opinion
  | 'noted' // review
  | 'approved' | 'refused' // visa, countersign, quitus, attestation
  | GateDecision; // decision, signature

export const OUTCOMES_OF: Record<StepKind, readonly Outcome[]> = {
  opinion: ['favorable', 'reserved', 'unfavorable'],
  review: ['noted'],
  visa: ['approved', 'refused'],
  countersign: ['approved', 'refused'],
  quitus: ['approved', 'refused'],
  attestation: ['approved', 'refused'],
  decision: ['go', 'go_with_conditions', 'deferred', 'no_go'],
  signature: ['go', 'go_with_conditions', 'deferred', 'no_go'],
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  favorable: 'Favourable', reserved: 'With reservations', unfavorable: 'Unfavourable', noted: 'Noted', approved: 'Approved', refused: 'Refused',
  go: 'Go', go_with_conditions: 'Go with conditions', deferred: 'Deferred', no_go: 'No-go',
};

/** Refusal of a signature when the signer's sign-in is older than 10 minutes (N-8); the page offers to sign in again. */
export const REAUTH_ERROR = 'Sign in again to sign: your last sign-in is more than 10 minutes old';

/** Steps that leave a signature (spec 05 §1: every step but opinions and reviews). */
export const isSigned = (k: StepKind) => k !== 'opinion' && k !== 'review';

/** A refusal stops the circuit and sends the dossier back to the project lead (spec 05 §1). */
export const isRefusal = (o: Outcome) => o === 'refused';

// ── Engine ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface StepState {
  id: string;
  group: number;
  kind: StepKind;
  optional: boolean;
  decides: boolean;
  status: StepStatus;
  outcome: Outcome | null;
}

/** The lowest group with a required step not done: its steps are open, the later ones wait. */
export function openGroup(steps: readonly StepState[]): number | null {
  const live = steps.filter((s) => s.status !== 'cancelled');
  const pending = live.filter((s) => s.status !== 'done' && !s.optional).map((s) => s.group);
  return pending.length ? Math.min(...pending) : null;
}

/** Statuses after a change: steps of the open group (optional ones of that group too) are open, later ones wait. */
export function refreshStatuses<T extends StepState>(steps: readonly T[]): T[] {
  const g = openGroup(steps);
  return steps.map((s) => {
    if (s.status === 'done' || s.status === 'cancelled') return s;
    return { ...s, status: g != null && s.group <= g ? 'open' : 'waiting' };
  });
}

/** Checks an outcome on a step: open, of the right kind, a reason for a refusal and for a deferred or no-go decision. */
export function checkOutcome(step: StepState, outcome: unknown, comment: string | null): Check<Outcome> {
  if (step.status !== 'open') return { ok: false, error: 'This step is not open' };
  if (!OUTCOMES_OF[step.kind].includes(outcome as Outcome)) return { ok: false, error: 'Choose the outcome' };
  const o = outcome as Outcome;
  if ((o === 'refused' || o === 'unfavorable' || o === 'reserved' || o === 'deferred' || o === 'no_go') && !comment?.trim()) return { ok: false, error: 'Give the reason' };
  return { ok: true, value: o };
}

export type CircuitState = 'running' | 'refused' | 'decided';

/** Running, stopped by a refusal, or decided (the deciding step is done). */
export function circuitState(steps: readonly StepState[]): CircuitState {
  const live = steps.filter((s) => s.status !== 'cancelled');
  if (live.some((s) => s.status === 'done' && s.outcome && isRefusal(s.outcome))) return 'refused';
  return live.some((s) => s.decides && s.status === 'done') ? 'decided' : 'running';
}

/** The gate decision a deciding step carries: its own outcome, or Go for a visa or countersignature. */
export function decisionOf(step: StepState): GateDecision | null {
  if (!step.decides || step.status !== 'done' || !step.outcome) return null;
  if (step.kind === 'decision' || step.kind === 'signature') return step.outcome as GateDecision;
  return step.outcome === 'approved' ? 'go' : null;
}

/** Criteria facts the circuit gives (spec 03 §3): opinions given, sponsor visa, the PSSR discharge (combined by safety.ts). */
export function circuitFacts(gate: GateCode, steps: readonly (StepState & { actor: StepActor })[]): Record<string, { met: boolean; value?: string }> {
  const live = steps.filter((s) => s.status !== 'cancelled');
  const opinions = live.filter((s) => s.kind === 'opinion');
  const given = opinions.filter((s) => s.status === 'done').length;
  const f: Record<string, { met: boolean; value?: string }> = {};
  if (gate === 'G1' || gate === 'G2') f[`${gate.toLowerCase()}_experts`] = { met: given === opinions.length, value: `${given} / ${opinions.length}` };
  if (gate === 'G1') {
    const visa = live.find((s) => s.kind === 'visa' && s.actor === 'sponsor');
    f.g1_sponsor_visa = { met: visa?.status === 'done' && visa.outcome === 'approved' };
  }
  if (gate === 'G3') {
    const quitus = live.find((s) => s.kind === 'quitus' && s.actor === 'group_hse');
    if (quitus) f.pssr_discharge = { met: quitus.status === 'done' && quitus.outcome === 'approved' };
  }
  return f;
}

// ── Deadlines (working days, N-7, N-10) ───────────────────────────────────────────────────────────────────────────────

/** `n` working days (Monday to Friday) after `iso`. Public holidays are not known to Arche yet. */
export function addWorkingDays(iso: string, n: number): string {
  let d = iso;
  let left = n;
  while (left > 0) {
    d = addDaysIso(d, 1);
    const w = dowOfIso(d);
    if (w !== 0 && w !== 6) left--;
  }
  return d;
}

/** Deadline of a step opened on `openedOn`: 5 working days for an opinion (N-10), the gate's target delay otherwise. */
export function dueOf(kind: StepKind, gate: GateCode, openedOn: string, values: ModelValues): string {
  return addWorkingDays(openedOn, kind === 'opinion' ? 5 : values.gateDelayDays[gate]);
}

// ── Who acts ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Central functions that may give the opinion of a speciality (besides an expert of that speciality on the CAPEX). */
const CENTRAL_FOR: Partial<Record<ExpertSpeciality, RoleKey>> = { hse: 'group_hse', finance: 'group_cfo' };

export interface ActorContext {
  role: RoleKey;
  userId: string;
  assignments: readonly (RoleAssignment & { speciality?: string | null })[];
  /** The viewer is named internal client in the CAPEX team. */
  internalClient: boolean;
}

/** True when the viewer, in their active role, may act on the step (a step named on someone is theirs only). */
export function canActOn(step: { actor: StepActor; speciality: string | null; assigneeUserId: string | null }, v: ActorContext, c: { code: string; subsidiaryCode: string; status: string }): boolean {
  if (step.assigneeUserId && step.assigneeUserId !== v.userId) return false;
  if (step.actor === 'internal_client') return v.internalClient && (v.role === 'project_lead' || v.role === 'expert' || v.role === 'sponsor' || v.role === 'controller');
  if (step.actor === 'expert') {
    const spec = step.speciality as ExpertSpeciality | null;
    if (v.role === 'expert') return v.assignments.some((a) => a.role === 'expert' && a.scopeRef === c.code && a.speciality === spec);
    return !!spec && CENTRAL_FOR[spec] === v.role && holdsOn(v.assignments, v.role, c);
  }
  return v.role === step.actor && holdsOn(v.assignments, v.role, c);
}
