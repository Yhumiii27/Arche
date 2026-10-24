// WBS and Gantt of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): the monthly window of the Gantt, the
// position of a bar or a milestone in it, the roll-up of tasks into a lot and of lots into the CAPEX (duration-weighted
// progress), the summary bar of an EPC2i project (from Keystone's milestones and progress, no detail) and the checks of a
// task. Pure: dates are ISO days ("2026-10-22") or months ("2026-10"); labels and messages are EN source strings.
import type { Check } from './admin';

/** Months shown at most (and at least) on a Gantt. */
export const GANTT_MAX_MONTHS = 36;
export const GANTT_MIN_MONTHS = 6;

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const monthIdx = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const monthOf = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const daysIn = (i: number) => new Date(Date.UTC(Math.floor(i / 12), (i % 12) + 1, 0)).getUTCDate();

/** First and last day of a month ("2026-03" → "2026-03-01", "2026-03-31"). */
export const monthStart = (m: string) => `${m.slice(0, 7)}-01`;
export const monthEnd = (m: string) => `${m.slice(0, 7)}-${String(daysIn(monthIdx(m))).padStart(2, '0')}`;

/** Fractional month position of a day (2026-03-16 → index of March + 0.5). */
export function monthPos(iso: string): number {
  const i = monthIdx(iso);
  return i + (Number(iso.slice(8, 10)) - 1) / daysIn(i);
}

export interface GanttWindow {
  /** First month shown ("2026-01"). */
  first: string;
  months: number;
}

/** The window covering `days` (and `today`), from its first month, between GANTT_MIN_MONTHS and GANTT_MAX_MONTHS long. */
export function ganttWindow(days: readonly (string | null | undefined)[], today: string): GanttWindow {
  const all = [...days.filter((d): d is string => !!d), today].map(monthIdx);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const months = Math.min(GANTT_MAX_MONTHS, Math.max(GANTT_MIN_MONTHS, hi - lo + 1));
  return { first: monthOf(lo), months };
}

/** The month labels of a window ("2026-01" …). */
export const windowMonths = (w: GanttWindow) => Array.from({ length: w.months }, (_, k) => monthOf(monthIdx(w.first) + k));

const pctOf = (n: number) => `${Math.round(n * 10000) / 100}%`;

/** Left offset of a day in the window, as a CSS percentage (clamped to the window). */
export function dayLeft(iso: string, w: GanttWindow): string {
  const x = (monthPos(iso) - monthIdx(w.first)) / w.months;
  return pctOf(Math.min(1, Math.max(0, x)));
}

/** A bar from `start` to `end` (inclusive days) in the window: left and width percentages; null when outside. */
export function barOf(start: string, end: string, w: GanttWindow): { left: string; width: string; clipped: boolean } | null {
  const lo = monthIdx(w.first);
  const a = monthPos(start) - lo;
  const b = monthPos(end) + 1 / daysIn(monthIdx(end)) - lo;
  if (b <= 0 || a >= w.months) return null;
  const s = Math.max(0, a);
  const e = Math.min(w.months, b);
  return { left: pctOf(s / w.months), width: pctOf(Math.max(e - s, 0.15) / w.months), clipped: a < 0 || b > w.months };
}

export interface Span {
  start: string;
  end: string;
  progressPct: number;
}

const days = (s: Span) => Math.max(1, (utc(s.end) - utc(s.start)) / DAY + 1);

/** Roll-up of spans: earliest start, latest end, duration-weighted progress; null without span. */
export function rollup(spans: readonly Span[]): Span | null {
  if (!spans.length) return null;
  const total = spans.reduce((a, s) => a + days(s), 0);
  return {
    start: spans.reduce((a, s) => (s.start < a ? s.start : a), spans[0].start),
    end: spans.reduce((a, s) => (s.end > a ? s.end : a), spans[0].end),
    progressPct: Math.round(spans.reduce((a, s) => a + s.progressPct * days(s), 0) / total),
  };
}

/** A lot's span: its tasks rolled up, else its planned months with the physical progress entered (execution). */
export function lotSpan(lot: { start: string | null; end: string | null; physicalPct: number | null }, tasks: readonly Span[]): Span | null {
  const r = rollup(tasks);
  if (r) return r;
  if (!lot.start || !lot.end) return null;
  return { start: monthStart(lot.start), end: monthEnd(lot.end), progressPct: Math.round(lot.physicalPct ?? 0) };
}

/**
 * The summary bar of an EPC2i project (no detail, owner 24 Oct 2026): from its order (or first milestone) to its forecast end
 * (or last milestone), with its physical progress.
 */
export function epc2iSpan(p: { milestones: readonly { code: string; plannedOn: string | null; actualOn: string | null }[]; progress: { physicalPct: number | null; endOn: string | null } | null }): Span | null {
  const on = (m: { plannedOn: string | null; actualOn: string | null }) => m.actualOn ?? m.plannedOn;
  const dated = p.milestones.map(on).filter((d): d is string => !!d).sort();
  const order = p.milestones.find((m) => m.code === 'commande');
  const start = (order && on(order)) ?? dated[0] ?? null;
  const end = p.progress?.endOn ?? dated[dated.length - 1] ?? null;
  if (!start || !end || end < start) return null;
  return { start, end, progressPct: Math.round(p.progress?.physicalPct ?? 0) };
}

export interface TaskInput {
  lotId: string | null;
  name: string;
  startOn: string;
  endOn: string;
  progressPct: number;
  ownerUserId: string | null;
  milestone: boolean;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(utc(v)) && new Date(utc(v)).toISOString().slice(0, 10) === v ? v : null);

/** A WBS task: a name, a lot of the CAPEX (or none), dates in order (a milestone has one date), progress 0–100, an owner of the team. */
export function checkTask(raw: Record<string, unknown>, ctx: { lots: ReadonlySet<string>; people: ReadonlySet<string> }): Check<TaskInput> {
  const name = text(raw.name);
  if (name.length < 2 || name.length > 200) return { ok: false, error: 'Name the task' };
  const lotId = text(raw.lotId) || null;
  if (lotId && !ctx.lots.has(lotId)) return { ok: false, error: 'Unknown lot' };
  const milestone = raw.milestone === 'on' || raw.milestone === 'true' || raw.milestone === true;
  const startOn = isoDate(text(raw.startOn));
  const endOn = milestone ? startOn : isoDate(text(raw.endOn));
  if (!startOn || !endOn) return { ok: false, error: 'Enter the dates of the task' };
  if (endOn < startOn) return { ok: false, error: 'The end comes before the start' };
  const p = text(raw.progressPct);
  const progressPct = p ? Number(p.replace(',', '.')) : 0;
  if (!Number.isFinite(progressPct) || progressPct < 0 || progressPct > 100) return { ok: false, error: 'Progress goes from 0 to 100 %' };
  const ownerUserId = text(raw.ownerUserId) || null;
  if (ownerUserId && !ctx.people.has(ownerUserId)) return { ok: false, error: 'Choose the owner in the team' };
  return { ok: true, value: { lotId, name, startOn, endOn, progressPct: Math.round(progressPct), ownerUserId, milestone } };
}
