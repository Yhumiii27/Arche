// Process safety studies held in Vigie (AR-033, AC-3, DEMANDES-VIGIE.md VG-01 to VG-05): HazID (HS 2), HazOp / FMEA (HS 3),
// site inspection (HS 4), PSSR with the RSPDI, ASPD (HS 6), read through vigie.pub_etudes_securite. A milestone with studies
// in Vigie takes its status from them (mirrored, `source = vigie`); the others stay declared by the group HSE (N-13). Pure.
import type { HsCode, HsStatus } from './safety';

export const STUDY_TYPES = ['hazid', 'hazop', 'amdec', 'controle_chantier', 'pssr', 'rspdi', 'aspd'] as const;
export type StudyType = (typeof STUDY_TYPES)[number];
export const STUDY_TYPE_LABEL: Record<StudyType, string> = {
  hazid: 'HazID', hazop: 'HazOp', amdec: 'FMEA', controle_chantier: 'Site inspection', pssr: 'PSSR', rspdi: 'RSPDI', aspd: 'ASPD audit',
};
export type StudyStatus = 'planifiee' | 'realisee' | 'validee' | 'annulee';
export const STUDY_STATUS_LABEL: Record<StudyStatus, string> = { planifiee: 'Session planned', realisee: 'Session held', validee: 'Validated', annulee: 'Cancelled' };
export type StudyConclusion = 'favorable' | 'reserves' | 'defavorable';
export const STUDY_CONCLUSION_LABEL: Record<StudyConclusion, string> = { favorable: 'Favourable', reserves: 'With reservations', defavorable: 'Unfavourable' };

/** One row of vigie.pub_etudes_securite (the contract proposed to Vigie, CONTRATS.md §2.5). */
export interface Study {
  ref: string;
  capexCode: string | null;
  projectCode: string | null;
  milestone: HsCode;
  type: StudyType;
  status: StudyStatus;
  heldOn: string | null;
  concludedOn: string | null;
  conclusion: StudyConclusion | null;
  leaderName: string | null;
  reportRef: string | null;
  recommendations: number;
  openRecommendations: number;
  lateRecommendations: number;
  blockingReservations: number;
  link: string | null;
  updatedAt: string | null;
}

const MILESTONES: readonly HsCode[] = ['HS2', 'HS3', 'HS4', 'PSSR', 'HS6'];
const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const int = (v: unknown): number => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.trunc(Number(v))) : 0);
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** A row of the view as Arche reads it; null when it cannot be read (unknown milestone, type or status). */
export function studyOf(r: Record<string, unknown>): Study | null {
  const milestone = String(r.jalon ?? '').toUpperCase().replace(/\s+/g, '') as HsCode;
  const type = String(r.type ?? '').toLowerCase() as StudyType;
  const status = String(r.statut ?? '').toLowerCase() as StudyStatus;
  if (!str(r.etude_ref) || !MILESTONES.includes(milestone) || !STUDY_TYPES.includes(type) || !(status in STUDY_STATUS_LABEL)) return null;
  const conclusion = String(r.conclusion ?? '').toLowerCase();
  return {
    ref: String(r.etude_ref), capexCode: str(r.capex_code), projectCode: str(r.projet_code), milestone, type, status,
    heldOn: day(r.seance_le), concludedOn: day(r.conclue_le), conclusion: conclusion in STUDY_CONCLUSION_LABEL ? (conclusion as StudyConclusion) : null,
    leaderName: str(r.animateur), reportRef: str(r.rapport_ref), recommendations: int(r.recommandations), openRecommendations: int(r.recommandations_ouvertes),
    lateRecommendations: int(r.recommandations_en_retard), blockingReservations: int(r.reserves_bloquantes), link: str(r.lien), updatedAt: str(r.maj_le),
  };
}

/** A study that passes its milestone: validated, not unfavourable, no blocking reservation left. */
export const passes = (s: Study) => s.status === 'validee' && s.conclusion !== 'defavorable' && s.blockingReservations === 0;

/**
 * The milestones of a CAPEX that Vigie holds, from its studies (cancelled ones left out): passed when one of its studies
 * passes (the latest one gives the date and the evidence: its report in Codex, else the study's reference); in progress
 * otherwise. A milestone without studies is not in the result: it stays declared.
 */
export function milestonesFromStudies(studies: readonly Study[]): Map<HsCode, { status: HsStatus; passedOn: string | null; evidenceRef: string | null }> {
  const out = new Map<HsCode, { status: HsStatus; passedOn: string | null; evidenceRef: string | null }>();
  for (const m of MILESTONES) {
    const mine = studies.filter((s) => s.milestone === m && s.status !== 'annulee');
    if (!mine.length) continue;
    const ok = mine.filter(passes).sort((a, b) => (b.concludedOn ?? '').localeCompare(a.concludedOn ?? ''))[0];
    out.set(m, ok ? { status: 'passed', passedOn: ok.concludedOn, evidenceRef: ok.reportRef ?? ok.ref } : { status: 'in_progress', passedOn: null, evidenceRef: null });
  }
  return out;
}

/** The recommendations of a CAPEX's studies: open and late (an alert when some are late). */
export function recommendationsOf(studies: readonly Study[]): { total: number; open: number; late: number } {
  const live = studies.filter((s) => s.status !== 'annulee');
  return { total: live.reduce((n, s) => n + s.recommendations, 0), open: live.reduce((n, s) => n + s.openRecommendations, 0), late: live.reduce((n, s) => n + s.lateRecommendations, 0) };
}
