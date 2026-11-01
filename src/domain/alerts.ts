// Rule-based alerts of a CAPEX (docs/spec/06 §7), always on, no AI: gate late on its target delay, circuit step past due (an
// expert opinion missing), project review late (flagged to the group industrial director after 15 days), Strategic audit
// missing, permit decision due within 30 days, SPI or CPI below 0.9, EAC above the G2 budget + 5 %, typology to confirm, team
// incomplete, gate condition past due; ramp-up close to (M+5) or beyond (M+6) its time limit; over its envelope (AR-040); cost or schedule drift of the
// forecast (AR-037). Pure: texts are EN source strings, details are values.
import type { ScreenId } from '@/config/screens';
import type { TeamRole } from './budget';
import { TEAM_ROLE_LABEL } from './capex';
import { PHASE_LABEL, TYPOLOGY_LABEL } from './capex-labels';
import type { ReviewState } from './governance';

export type AlertLevel = 'alert' | 'watch';

export interface Alert {
  rule: string;
  capexCode: string;
  level: AlertLevel;
  /** EN source string. */
  text: string;
  /** Values (dates, ratios) and Arche labels (EN source strings), joined by " · ": shown through t(); never typed text. */
  detail: string | null;
  screen: ScreenId;
}

export interface AlertInput {
  code: string;
  status: string;
  typologyProposed: string | null;
  /** The gate session whose circuit runs, with its submission day and target decision day. */
  running: { gate: string; submittedOn: string; targetOn: string } | null;
  openSteps: readonly { label: string; kind: string; dueOn: string | null }[];
  review: ReviewState;
  missingAudits: readonly string[];
  permitsDue: readonly { dueOn: string | null }[];
  indicators: { spi: number | null; cpi: number | null; eacKeur: number } | null;
  g2Keur: number | null;
  missingStaff: readonly string[];
  lateConditions: number;
  /** Ramp-up after the start of commissioning (delivery 6): M+5 alert date, M+6 limit, reached or not. */
  rampup?: { alertOn: string | null; limitOn: string | null; reached: boolean } | null;
  /** Fiscal years where the CAPEX takes its envelope over (AR-040); `blocked`: beyond the model's tolerance. */
  envelopeOver?: readonly { year: number; overKeur: number; blocked: boolean }[];
  /** Drift of the forecast by rules (AR-037, src/domain/forecast.ts): EAC growth over the trend window, months late. */
  drift?: { cost: boolean; schedule: boolean; eacDeltaPct: number | null; delayMonths: number | null } | null;
}

/** SPI / CPI below this ratio raise an alert (spec 06 §7). */
export const PERFORMANCE_FLOOR = 0.9;
/** EAC above the G2 budget by more than this share raises an alert. */
export const EAC_TOLERANCE_PCT = 5;

export function alertsOf(i: AlertInput, today: string): Alert[] {
  const out: Alert[] = [];
  const add = (rule: string, level: AlertLevel, text: string, detail: string | null, screen: ScreenId) => out.push({ rule, capexCode: i.code, level, text, detail, screen });
  if (i.status !== 'active' && i.status !== 'draft') return out;
  if (i.running && i.running.targetOn < today) add('gate_late', 'alert', 'Gate decision past its target delay', `${i.running.gate} · ${i.running.targetOn}`, 'capex-gates');
  for (const s of i.openSteps.filter((x) => x.dueOn && x.dueOn < today)) {
    add(s.kind === 'opinion' ? 'opinion_missing' : 'step_late', 'alert', s.kind === 'opinion' ? 'Expert opinion missing' : 'Circuit step past due', `${s.label} · ${s.dueOn}`, 'capex-gates');
  }
  if (i.review.state === 'late' || i.review.state === 'escalated') {
    add(i.review.state === 'escalated' ? 'review_escalated' : 'review_late', i.review.state === 'escalated' ? 'alert' : 'watch', i.review.state === 'escalated' ? 'Project review late (flagged to the group industrial director)' : 'Project review late', i.review.dueOn, 'capex-governance');
  }
  if (i.missingAudits.length) add('audit_missing', 'watch', 'Phase audit missing', i.missingAudits.map((p) => PHASE_LABEL[p as keyof typeof PHASE_LABEL] ?? p).join(' · '), 'capex-governance');
  for (const p of i.permitsDue) add('permit_due', p.dueOn && p.dueOn < today ? 'alert' : 'watch', 'Permit decision due', p.dueOn, 'capex-permits');
  if (i.indicators) {
    if (i.indicators.spi != null && i.indicators.spi < PERFORMANCE_FLOOR) add('spi_low', 'alert', 'SPI below 0.9', String(i.indicators.spi), 'capex-execution');
    if (i.indicators.cpi != null && i.indicators.cpi < PERFORMANCE_FLOOR) add('cpi_low', 'alert', 'CPI below 0.9', String(i.indicators.cpi), 'capex-execution');
    if (i.g2Keur && i.indicators.eacKeur > i.g2Keur * (1 + EAC_TOLERANCE_PCT / 100)) add('eac_over', 'alert', 'EAC above the G2 budget + 5 %', `${Math.round(i.indicators.eacKeur)} / ${Math.round(i.g2Keur)} k€`, 'capex-execution');
  }
  if (i.typologyProposed) add('typology_to_confirm', 'watch', 'Typology to confirm', TYPOLOGY_LABEL[i.typologyProposed as keyof typeof TYPOLOGY_LABEL] ?? i.typologyProposed, 'capex-governance');
  if (i.missingStaff.length) add('team_incomplete', 'watch', 'Team incomplete', i.missingStaff.map((r) => TEAM_ROLE_LABEL[r as TeamRole] ?? r).join(' · '), 'capex-governance');
  if (i.lateConditions) add('condition_late', 'alert', 'Gate condition past due', String(i.lateConditions), 'capex-gates');
  if (i.rampup && !i.rampup.reached && i.rampup.limitOn && i.rampup.alertOn) {
    if (today > i.rampup.limitOn) add('rampup_overdue', 'alert', 'Ramp-up beyond the time limit (flagged to the group industrial director)', i.rampup.limitOn, 'capex-rampup');
    else if (today >= i.rampup.alertOn) add('rampup_m5', 'watch', 'Ramp-up close to the time limit', i.rampup.limitOn, 'capex-rampup');
  }
  if (i.drift?.cost) add('cost_drift', 'watch', 'Cost drift: the EAC keeps growing', i.drift.eacDeltaPct == null ? null : `+${i.drift.eacDeltaPct} %`, 'capex-execution');
  if (i.drift?.schedule) add('schedule_drift', 'watch', 'Schedule drift: the projected finish is late', i.drift.delayMonths == null ? null : `+${i.drift.delayMonths}`, 'capex-execution');
  for (const e of i.envelopeOver ?? []) add('envelope_over', e.blocked ? 'alert' : 'watch', 'Over the CAPEX envelope', `${e.year} · +${Math.round(e.overKeur)} k€`, 'capex-budget');
  return out;
}

/** Alerts first, then watch items; by CAPEX code. */
export const sortAlerts = (a: readonly Alert[]) => [...a].sort((x, y) => (x.level === y.level ? x.capexCode.localeCompare(y.capexCode) : x.level === 'alert' ? -1 : 1));
