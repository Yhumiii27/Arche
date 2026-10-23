// Indicators of the DIG-PRODI objectives (CDC §1, C-10, measured from the pilot): validation delays −40 %, static documents
// −50 %, decisions traced 100 %. Arche measures, on the gate sessions decided in Arche (the gates taken over at a takeover,
// N-20, are history and left out):
// - the delay from submission (the session opens) to the decision, in working days, by gate;
// - the static documents of a gate: the Codex references attached to the frozen dossier version the session decided on;
// - the share of decisions traced: gate decisions taken by a signed deciding step, and budget validations by a named account.
// Each is compared with the reference measured on the existing process ("relevé de l'existant") entered by the group
// industrial director. Pure: labels are EN source strings.
import type { Check } from './admin';
import { round1 } from './budget';
import { GATES, type GateCode } from './lifecycle';

export type KpiKey = `delay:${GateCode}` | 'documents' | 'traced';
export const KPI_KEYS: readonly KpiKey[] = [...GATES.map((g) => `delay:${g}` as KpiKey), 'documents', 'traced'];
export const isKpiKey = (v: unknown): v is KpiKey => typeof v === 'string' && (KPI_KEYS as readonly string[]).includes(v);

export const KPI_LABEL: Record<KpiKey, string> = {
  'delay:G1': 'G1 validation delay', 'delay:G2': 'G2 validation delay', 'delay:K3': 'K3 validation delay', 'delay:G3': 'G3 validation delay',
  documents: 'Static documents per gate dossier', traced: 'Decisions traced',
};
export const KPI_UNIT: Record<KpiKey, string> = {
  'delay:G1': 'working days', 'delay:G2': 'working days', 'delay:K3': 'working days', 'delay:G3': 'working days', documents: 'documents', traced: '%',
};

/** The objectives of the CDC: the target is the reference × this factor (traced: always 100 %). */
export const KPI_FACTOR: Record<'delay' | 'documents', number> = { delay: 0.6, documents: 0.5 };
export const OBJECTIVE_LABEL: Record<KpiKey, string> = {
  'delay:G1': '−40 %', 'delay:G2': '−40 %', 'delay:K3': '−40 %', 'delay:G3': '−40 %', documents: '−50 %', traced: '100 %',
};

export interface SessionFact {
  code: GateCode;
  submittedOn: string;
  decidedOn: string;
  /** Working days between them (computed by the caller with the business calendar). */
  delayDays: number;
  /** Codex references of the frozen dossier version decided on; null without a dossier (K3). */
  documents: number | null;
  /** The deciding step was done and signed. */
  signed: boolean;
}

export interface Measure {
  /** Measured value; null when nothing is measured yet. */
  value: number | null;
  /** Number of sessions (or decisions) measured. */
  count: number;
}

const avg = (xs: readonly number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** The measures of the indicators from the sessions decided in Arche and the budget validations (traced or not). */
export function measureKpis(sessions: readonly SessionFact[], budgets: { traced: number; total: number }): Record<KpiKey, Measure> {
  const out = {} as Record<KpiKey, Measure>;
  for (const g of GATES) {
    const mine = sessions.filter((s) => s.code === g);
    out[`delay:${g}`] = { value: avg(mine.map((s) => s.delayDays)), count: mine.length };
  }
  const docs = sessions.filter((s) => s.documents != null).map((s) => s.documents!);
  out.documents = { value: avg(docs), count: docs.length };
  const total = sessions.length + budgets.total;
  const traced = sessions.filter((s) => s.signed).length + budgets.traced;
  out.traced = { value: total ? round1((100 * traced) / total) : null, count: total };
  return out;
}

export type KpiState = 'met' | 'not_met' | 'no_reference' | 'not_measured';

export interface KpiView {
  key: KpiKey;
  measured: Measure;
  reference: number | null;
  target: number | null;
  /** Change against the reference, in % (negative = lower); null without both. */
  changePct: number | null;
  state: KpiState;
}

/** Target and state of an indicator: lower is better for delays and documents; traced aims at 100 %. */
export function kpiView(key: KpiKey, measured: Measure, reference: number | null): KpiView {
  const target = key === 'traced' ? 100 : reference == null ? null : round1(reference * KPI_FACTOR[key === 'documents' ? 'documents' : 'delay']);
  const changePct = measured.value != null && reference ? round1((measured.value / reference - 1) * 100) : null;
  let state: KpiState;
  if (measured.value == null) state = 'not_measured';
  else if (target == null) state = 'no_reference';
  else state = key === 'traced' ? (measured.value >= target ? 'met' : 'not_met') : measured.value <= target ? 'met' : 'not_met';
  return { key, measured, reference, target, changePct, state };
}

export interface BaselineInput {
  value: number;
  source: string | null;
  measuredOn: string | null;
}

/** The reference of an indicator: a number ≥ 0 (a share ≤ 100 for traced), where it comes from, when it was measured. */
export function checkBaseline(key: KpiKey, raw: Record<string, unknown>, today: string): Check<BaselineInput> {
  const s = String(raw.value ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: 'Enter the reference value' };
  const value = round1(Number(s));
  if (key === 'traced' && value > 100) return { ok: false, error: 'A share is at most 100 %' };
  const source = String(raw.source ?? '').trim().slice(0, 2000) || null;
  const m = String(raw.measuredOn ?? '').trim();
  const measuredOn = m ? (/^\d{4}-\d{2}-\d{2}$/.test(m) && !Number.isNaN(new Date(`${m}T00:00:00Z`).getTime()) ? m : '') : null;
  if (measuredOn === '' || (measuredOn && measuredOn > today)) return { ok: false, error: 'Enter the date of the survey (not in the future)' };
  return { ok: true, value: { value, source, measuredOn } };
}
