// Project governance of a CAPEX (docs/spec/06 §2; CDC §3; N-19): the project steering committee's cadence by typology
// (Light: quarterly, Strategic: monthly), the next review due and its delay (alert to the project lead and the sponsor when
// due, flagged to the group industrial director 15 days later), the cross-functional audits of Strategic CAPEX (one per phase,
// held by the group industrial director or the EPC2i PMO, recorded as a review of kind "audit"). Pure.
import type { Phase } from './lifecycle';

export type ReviewKind = 'copil_projet' | 'audit';
export const REVIEW_KINDS: readonly ReviewKind[] = ['copil_projet', 'audit'];
export const REVIEW_KIND_LABEL: Record<ReviewKind, string> = { copil_projet: 'Project steering committee', audit: 'Cross-functional audit' };

/** Months between two project steering committees (CDC §3). */
export const REVIEW_PERIOD_MONTHS: Record<'light' | 'strategic', number> = { light: 3, strategic: 1 };
export const CADENCE_LABEL: Record<'light' | 'strategic', string> = { light: 'Quarterly', strategic: 'Monthly' };

/** Days after the due date when a late review is flagged to the group industrial director (spec 06 §2). */
export const ESCALATION_DAYS = 15;

const pad = (n: number) => String(n).padStart(2, '0');
/** `iso` + `n` months, the day kept within the month ("2026-01-31" + 1 → "2026-02-28"). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface ReviewState {
  /** Null when the CAPEX has no cadence (draft, closed, abandoned, or typology not determined). */
  dueOn: string | null;
  state: 'none' | 'ok' | 'late' | 'escalated';
  daysLate: number;
}

/**
 * Next project steering committee: the last one held + the period of the typology; without any, the opening + the period. A
 * CAPEX that is not active has none.
 */
export function nextReview(i: { status: string; typology: string | null; openedOn: string | null; lastHeldOn: string | null }, today: string): ReviewState {
  if (i.status !== 'active' || (i.typology !== 'light' && i.typology !== 'strategic')) return { dueOn: null, state: 'none', daysLate: 0 };
  const from = i.lastHeldOn ?? i.openedOn;
  if (!from) return { dueOn: null, state: 'none', daysLate: 0 };
  const dueOn = addMonths(from, REVIEW_PERIOD_MONTHS[i.typology]);
  const daysLate = Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dueOn}T12:00:00Z`)) / 86_400_000));
  return { dueOn, state: daysLate === 0 ? 'ok' : daysLate > ESCALATION_DAYS ? 'escalated' : 'late', daysLate };
}

const ORDER: readonly Phase[] = ['cadrage', 'avant_projet', 'execution', 'demarrage'];

/**
 * Phases of a Strategic CAPEX whose audit is missing (N-19): every phase left (passed by its gate) needs one audit recorded
 * during that phase or after; the current phase's audit is not due yet.
 */
export function missingAudits(i: { typology: string | null; phase: string; status: string }, audits: readonly { phase: string }[]): Phase[] {
  if (i.typology !== 'strategic' || i.status === 'draft') return [];
  const reached = i.status === 'closed' ? ORDER.length : ORDER.indexOf(i.phase as Phase);
  return ORDER.slice(0, Math.max(0, reached)).filter((p) => !audits.some((a) => a.phase === p));
}

export interface ReviewInput {
  kind: ReviewKind;
  heldOn: string;
  attendees: string;
  summary: string;
  decisions: string[];
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A review held: kind, date (not in the future), attendees and summary required; one decision per line, optional. */
export function checkReview(raw: Record<string, unknown>, today: string): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const kind = text(raw.kind) as ReviewKind;
  if (!REVIEW_KINDS.includes(kind)) return { ok: false, error: 'Choose the kind of review' };
  const heldOn = text(raw.heldOn);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heldOn)) return { ok: false, error: 'Give the date of the review' };
  if (heldOn > today) return { ok: false, error: 'The date cannot be in the future' };
  const attendees = text(raw.attendees).slice(0, 1000);
  if (!attendees) return { ok: false, error: 'List the attendees' };
  const summary = text(raw.summary).slice(0, 5000);
  if (!summary) return { ok: false, error: 'Write the summary' };
  const decisions = text(raw.decisions).split('\n').map((d) => d.trim()).filter(Boolean).slice(0, 20).map((d) => d.slice(0, 1000));
  return { ok: true, value: { kind, heldOn, attendees, summary, decisions } };
}
