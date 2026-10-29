// Circuit notifications and absences (AR-041, DECISIONS.md §5). A step that opens is announced to those who may act on it; a
// step is recalled the working day before its deadline and on the day; once late, every `reminderEveryDays` working days;
// late by `escalationDays` working days, it is escalated once to the group industrial director and the CAPEX's sponsor. An
// absent person names a delegate for a period: the delegate receives their notifications and may act on their steps. Pure.
import type { RoleKey } from '@/config/roles';
import { addWorkingDays, canActOn, workingDaysBetween, type ActorContext } from './circuits';
import { dowOfIso } from '@/lib/dates';

export const NOTICE_KINDS = ['step_open', 'step_due_soon', 'step_due', 'step_late', 'step_escalated'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const NOTICE_LABEL: Record<NoticeKind, string> = {
  step_open: 'Step to act on',
  step_due_soon: 'Step due tomorrow',
  step_due: 'Step due today',
  step_late: 'Step late',
  step_escalated: 'Step escalated',
};

export const MAIL_STATUS_LABEL: Record<string, string> = { pending: 'To send', sent: 'Sent', held: 'Kept (sending off)', failed: 'Failed' };

export interface NoticeStep {
  id: string;
  status: string;
  openedOn: string | null;
  dueOn: string | null;
}

/** A notice due on `today`: its kind and the key that makes it sent once (per recipient). */
export interface Notice {
  kind: NoticeKind;
  key: string;
  /** Working days late (step_late, step_escalated). */
  lateDays?: number;
}

/** The notices an open step gives on `today` (the opening is announced once, whatever the day the job runs). */
export function noticesOf(step: NoticeStep, today: string, v: { reminderEveryDays: number; escalationDays: number }): Notice[] {
  if (step.status !== 'open') return [];
  const out: Notice[] = [];
  if (step.openedOn && step.openedOn <= today) out.push({ kind: 'step_open', key: `step_open:${step.id}` });
  // Reminders and escalations go out on working days only.
  const dow = dowOfIso(today);
  if (!step.dueOn || dow === 0 || dow === 6) return out;
  if (step.dueOn > today) {
    if (addWorkingDays(today, 1) === step.dueOn) out.push({ kind: 'step_due_soon', key: `step_due_soon:${step.id}` });
    return out;
  }
  if (step.dueOn === today) return [...out, { kind: 'step_due', key: `step_due:${step.id}` }];
  const late = workingDaysBetween(step.dueOn, today);
  if (late > 0 && late % v.reminderEveryDays === 0) out.push({ kind: 'step_late', key: `step_late:${step.id}:${today}`, lateDays: late });
  if (late >= v.escalationDays) out.push({ kind: 'step_escalated', key: `step_escalated:${step.id}`, lateDays: late });
  return out;
}

/** The subject and body of a notice (EN source strings translated by `t`; the step's label and the CAPEX's title as typed). */
export function noticeText(t: (s: string) => string, n: { kind: NoticeKind; lateDays?: number }, s: { capexCode: string; capexTitle: string; gate: string; stepLabel: string; dueOn: string | null; link: string; onBehalfOf?: string | null }) {
  const subject = `[Arche] ${s.capexCode} · ${s.gate} — ${t(NOTICE_LABEL[n.kind])} · ${s.stepLabel}`;
  const lines = [
    `${s.capexCode} — ${s.capexTitle}`,
    `${t('Gate')} ${s.gate} · ${s.stepLabel}`,
    s.dueOn ? `${t('Due on')} ${s.dueOn}` : null,
    n.lateDays ? `${n.lateDays} ${t('working day(s) late')}` : null,
    n.kind === 'step_escalated' ? t('This step is escalated to the group industrial director and the sponsor of the CAPEX.') : null,
    s.onBehalfOf ? `${t('You receive this message as the delegate of')} ${s.onBehalfOf}.` : null,
    '',
    `${t('Open the circuit')} → ${s.link}`,
  ].filter((l) => l != null);
  return { subject, body: lines.join('\n') };
}

// ── Absences ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Absence {
  userId: string;
  delegateUserId: string;
  fromOn: string;
  toOn: string;
  cancelledAt?: Date | null;
}

/** True when the absence covers `today`. */
export const absentOn = (a: Absence, today: string) => !a.cancelledAt && a.fromOn <= today && today <= a.toOn;

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** An absence declared by `userId`: dates (from today on, 6 months at most), a delegate other than oneself, a note. */
export function checkAbsence(raw: Record<string, unknown>, userId: string, today: string, others: readonly Absence[]): Check<{ fromOn: string; toOn: string; delegateUserId: string; note: string | null }> {
  const fromOn = String(raw.fromOn ?? '').trim();
  const toOn = String(raw.toOn ?? '').trim();
  const delegateUserId = String(raw.delegateUserId ?? '').trim();
  if (!ISO.test(fromOn) || !ISO.test(toOn)) return { ok: false, error: 'Give the first and last days of the absence' };
  if (toOn < fromOn) return { ok: false, error: 'The last day comes after the first' };
  if (toOn < today) return { ok: false, error: 'This absence is over' };
  if (workingDaysBetween(fromOn, toOn) > 130) return { ok: false, error: 'An absence lasts 6 months at most' };
  if (!delegateUserId) return { ok: false, error: 'Choose a delegate' };
  if (delegateUserId === userId) return { ok: false, error: 'Choose a delegate other than yourself' };
  const overlaps = (a: Absence) => !a.cancelledAt && a.fromOn <= toOn && fromOn <= a.toOn;
  if (others.some((a) => a.userId === userId && overlaps(a))) return { ok: false, error: 'You already have an absence over these days' };
  if (others.some((a) => a.userId === delegateUserId && overlaps(a))) return { ok: false, error: 'Your delegate is absent over these days' };
  const note = String(raw.note ?? '').trim().slice(0, 500) || null;
  return { ok: true, value: { fromOn, toOn, delegateUserId, note } };
}

/** A person as the circuits see them: every role they hold, with its assignments. */
export interface Person {
  userId: string;
  roles: readonly RoleKey[];
  assignments: ActorContext['assignments'];
}

/** True when the person, in any of their roles, may act on the step (`internalClient`: named internal client of the CAPEX). */
export function personCanAct(step: Parameters<typeof canActOn>[0], p: Person, c: Parameters<typeof canActOn>[2], internalClient: boolean): boolean {
  return p.roles.some((role) => canActOn(step, { role, userId: p.userId, assignments: p.assignments, internalClient }, c));
}
