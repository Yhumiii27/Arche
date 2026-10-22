// Safety milestones (HS) of a CAPEX (docs/spec/03 §4, C-3; N-13): until Vigie publishes them, the group HSE declares each
// milestone's status with a reference of its evidence (a Vigie or Codex reference). PSSR also needs the group HSE's discharge
// (quitus) before G3. Pure: labels are EN source strings translated by the pages.
import type { GateCode, Phase } from './lifecycle';

export type HsCode = 'HS2' | 'HS3' | 'HS4' | 'PSSR' | 'HS6';
export type HsStatus = 'not_started' | 'in_progress' | 'passed' | 'waived';

export interface HsMilestone {
  code: HsCode;
  phase: Phase;
  /** EN source string. */
  content: string;
  /** The gate the milestone blocks; null for PSSR, which comes before the start of commissioning (and G3 through its discharge). */
  blocks: GateCode | 'mes';
}

/** The HS table (C-3, confirmed): HS 1 does not exist in the CDC; RSPDI and ASPD definitions are to come from the group HSE. */
export const HS_MILESTONES: readonly HsMilestone[] = [
  { code: 'HS2', phase: 'cadrage', content: 'HazID: initial hazard identification, pre-validation of process safety', blocks: 'G1' },
  { code: 'HS3', phase: 'avant_projet', content: 'HazOp / FMEA', blocks: 'G2' },
  { code: 'HS4', phase: 'execution', content: 'Physical site inspection', blocks: 'K3' },
  { code: 'PSSR', phase: 'demarrage', content: 'Pre-startup safety review with RSPDI, before fluids or materials are introduced', blocks: 'mes' },
  { code: 'HS6', phase: 'demarrage', content: 'ASPD audit by the group HSE department', blocks: 'G3' },
];
export const HS_CODES = HS_MILESTONES.map((m) => m.code);
export const isHsCode = (v: unknown): v is HsCode => typeof v === 'string' && (HS_CODES as string[]).includes(v);

export const HS_LABEL: Record<HsCode, string> = { HS2: 'HS 2 HazID', HS3: 'HS 3 HazOp / FMEA', HS4: 'HS 4 site inspection', PSSR: 'PSSR', HS6: 'HS 6 ASPD' };
export const HS_STATUSES: readonly HsStatus[] = ['not_started', 'in_progress', 'passed', 'waived'];
export const HS_STATUS_LABEL: Record<HsStatus, string> = { not_started: 'Not started', in_progress: 'In progress', passed: 'Achieved', waived: 'Waived' };

export interface HsState {
  code: HsCode;
  status: HsStatus;
  evidenceRef: string | null;
  passedOn: string | null;
  note: string | null;
  source: 'declared' | 'vigie';
}

export const emptyHs = (code: HsCode): HsState => ({ code, status: 'not_started', evidenceRef: null, passedOn: null, note: null, source: 'declared' });

/** The states of the five milestones, the missing ones "not started". */
export const hsBoard = (rows: readonly HsState[]): HsState[] => HS_CODES.map((c) => rows.find((r) => r.code === c) ?? emptyHs(c));

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isoDay = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : null);

export interface HsInput {
  status: HsStatus;
  evidenceRef: string | null;
  passedOn: string | null;
  note: string | null;
}

/**
 * A declaration of the group HSE (N-13): a passed milestone needs its evidence reference and its date (not in the future); a
 * waived one needs the reason.
 */
export function checkHs(raw: Record<string, unknown>, today: string): { ok: true; value: HsInput } | { ok: false; error: string } {
  const status = text(raw.status) as HsStatus;
  if (!HS_STATUSES.includes(status)) return { ok: false, error: 'Choose a status' };
  const evidenceRef = text(raw.evidenceRef).slice(0, 120) || null;
  const note = text(raw.note).slice(0, 2000) || null;
  const passedOn = isoDay(raw.passedOn);
  if (status === 'passed') {
    if (!evidenceRef) return { ok: false, error: 'Give the reference of the evidence (Vigie or Codex)' };
    if (!passedOn) return { ok: false, error: 'Give the date the milestone was passed' };
    if (passedOn > today) return { ok: false, error: 'The date cannot be in the future' };
  }
  if (status === 'waived' && !note) return { ok: false, error: 'Give the reason the milestone is waived' };
  return { ok: true, value: { status, evidenceRef, passedOn: status === 'passed' ? passedOn : null, note } };
}

const done = (s: HsState) => s.status === 'passed' || s.status === 'waived';
/** The value shown with the criterion: the date passed, else the status (EN source string). */
const valueOf = (s: HsState) => (s.status === 'passed' ? s.passedOn ?? undefined : HS_STATUS_LABEL[s.status]);

/** The facts of the safety criteria (spec 03 §3): HS 2 → G1, HS 3 → G2, HS 4 → K3, PSSR and HS 6 → G3 (the PSSR discharge is added by the circuit). */
export function safetyFacts(rows: readonly HsState[]): Record<string, { met: boolean; value?: string }> {
  const b = Object.fromEntries(hsBoard(rows).map((s) => [s.code, s])) as Record<HsCode, HsState>;
  return {
    g1_hs2: { met: done(b.HS2), value: valueOf(b.HS2) },
    g2_hs3: { met: done(b.HS3), value: valueOf(b.HS3) },
    k3_hs4: { met: done(b.HS4), value: valueOf(b.HS4) },
    g3_pssr: { met: done(b.PSSR), value: valueOf(b.PSSR) },
    g3_hs6: { met: done(b.HS6), value: valueOf(b.HS6) },
  };
}

/**
 * G3 "PSSR passed and PSSR discharge given" (spec 03 §3): the milestone passed (declared or from Vigie) and the discharge step of
 * the G3 circuit done (`pssr_discharge`, given by circuitFacts).
 */
export function withPssrDischarge(facts: Readonly<Record<string, { met: boolean; value?: string } | undefined>>): Record<string, { met: boolean; value?: string } | undefined> {
  const pssr = facts.g3_pssr;
  const discharge = facts.pssr_discharge;
  if (!pssr || !discharge) return facts;
  return { ...facts, g3_pssr: { met: pssr.met && discharge.met, value: pssr.met && !discharge.met ? 'No discharge' : pssr.value } };
}
