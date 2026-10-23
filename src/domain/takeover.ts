// Takeover of a CAPEX already in progress (N-20, pilot): the sponsor opens a draft directly in its current phase, with the
// gates already passed dated and their decider named, and the budget validated before Arche. No bulk import in v1. The gates
// taken over are history recorded by hand: they carry no circuit, no signature and no frozen dossier, are shown as "taken
// over", and are left out of the delay and traceability indicators (C-10). Pure: messages are EN source strings.
import type { Check } from './admin';
import { parseKeur, round1, type EstimateClass } from './budget';
import { GATE_OF_PHASE, PHASES, type GateCode, type Phase } from './lifecycle';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isoDate = (v: unknown): string | null => {
  const s = text(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
};

/** Reason of the cycle transitions written by a takeover (an Arche label, shown through t()). */
export const TAKEOVER_REASON = 'Taken over in progress (N-20)';

/** The phases a CAPEX can be taken over in (phase 1 is the ordinary opening). */
export const TAKEOVER_PHASES: readonly Phase[] = ['avant_projet', 'execution', 'demarrage'];

/** The gates passed before the current phase, in order: phase 2 → G1; phase 3 → G1, G2; phase 4 → G1, G2, K3. */
export function gatesPassedBefore(phase: Phase): GateCode[] {
  return PHASES.slice(0, PHASES.indexOf(phase)).map((p) => GATE_OF_PHASE[p]);
}

/** The estimate classes the validated budget may have: E50 or E30 in phase 2, E10 (the G2 baseline) after G2. */
export function takeoverClasses(phase: Phase): EstimateClass[] {
  return phase === 'avant_projet' ? ['E50', 'E30'] : ['E10'];
}

export interface TakeoverInput {
  phase: Phase;
  openedOn: string;
  gates: { code: GateCode; decidedOn: string; decidedByName: string }[];
  budget: { estimateClass: EstimateClass; validatedOn: string; validatedByName: string; lines: { lotId: string; amountKeur: number }[] };
  /** Start of commissioning, phase 4 only (optional). */
  mesStartedOn: string | null;
}

/**
 * Checks what the sponsor typed: the phase, the opening day, each gate passed (date, decider), the validated budget (class,
 * date, validator, one amount per lot) and, in phase 4, the start of commissioning. Dates are in the past or today and in
 * order: opening ≤ G1 ≤ G2 ≤ K3 ≤ start of commissioning; the E10 budget is validated by G2 at the latest.
 */
export function checkTakeover(raw: Record<string, unknown>, ctx: { today: string; lotIds: readonly string[] }): Check<TakeoverInput> {
  const phase = text(raw.phase) as Phase;
  if (!TAKEOVER_PHASES.includes(phase)) return { ok: false, error: 'Choose the current phase' };
  if (!ctx.lotIds.length) return { ok: false, error: 'Add the lots of the CAPEX first' };
  const openedOn = isoDate(raw.openedOn);
  if (!openedOn || openedOn > ctx.today) return { ok: false, error: 'Enter the opening date (not in the future)' };
  const gates: TakeoverInput['gates'] = [];
  let last = openedOn;
  for (const code of gatesPassedBefore(phase)) {
    const decidedOn = isoDate(raw[`${code}:on`]);
    if (!decidedOn || decidedOn > ctx.today) return { ok: false, error: `Enter the date of ${code} (not in the future)` };
    if (decidedOn < last) return { ok: false, error: `The date of ${code} comes before the previous step` };
    const decidedByName = text(raw[`${code}:by`]).slice(0, 200);
    if (!decidedByName) return { ok: false, error: `Name who decided ${code}` };
    gates.push({ code, decidedOn, decidedByName });
    last = decidedOn;
  }
  const estimateClass = text(raw.estimateClass) as EstimateClass;
  if (!takeoverClasses(phase).includes(estimateClass)) return { ok: false, error: 'Choose the class of the validated budget' };
  const validatedOn = isoDate(raw.validatedOn);
  if (!validatedOn || validatedOn > ctx.today || validatedOn < openedOn) return { ok: false, error: 'Enter the validation date of the budget (between the opening and today)' };
  const g2 = gates.find((g) => g.code === 'G2');
  if (estimateClass === 'E10' && g2 && validatedOn > g2.decidedOn) return { ok: false, error: 'The E10 budget is validated by G2 at the latest' };
  const validatedByName = text(raw.validatedByName).slice(0, 200);
  if (!validatedByName) return { ok: false, error: 'Name who validated the budget' };
  const lines: TakeoverInput['budget']['lines'] = [];
  for (const lotId of ctx.lotIds) {
    const amountKeur = parseKeur(raw[`lot:${lotId}`]);
    if (amountKeur == null) return { ok: false, error: 'Enter the amount of every lot (k€)' };
    lines.push({ lotId, amountKeur });
  }
  if (round1(lines.reduce((s, l) => s + l.amountKeur, 0)) <= 0) return { ok: false, error: 'The validated budget cannot be zero' };
  let mesStartedOn: string | null = null;
  if (phase === 'demarrage' && text(raw.mesStartedOn)) {
    mesStartedOn = isoDate(raw.mesStartedOn);
    if (!mesStartedOn || mesStartedOn > ctx.today) return { ok: false, error: 'Enter the start of commissioning (not in the future)' };
    if (mesStartedOn < last) return { ok: false, error: 'The start of commissioning comes before K3' };
  }
  return { ok: true, value: { phase, openedOn, gates, budget: { estimateClass, validatedOn, validatedByName, lines }, mesStartedOn } };
}
