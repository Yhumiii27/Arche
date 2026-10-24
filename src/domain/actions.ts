// Action plan of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): a follow-up action opened from any page of a
// CAPEX — title, owner (a member of the team, the sponsor or the lead), due date, the element it comes from — then done or
// cancelled with a note. Late = open past its due date. Pure: messages and labels are EN source strings.
import type { Check } from './admin';
import type { ScreenId } from '@/config/screens';

export const ACTION_SOURCES = ['general', 'gate', 'dossier', 'budget', 'change', 'governance', 'machines', 'pack', 'permits', 'execution', 'risk', 'safety', 'rampup'] as const;
export type ActionSource = (typeof ACTION_SOURCES)[number];
export const ACTION_SOURCE_LABEL: Record<ActionSource, string> = {
  general: 'General', gate: 'Gates & circuits', dossier: 'Living dossiers', budget: 'Budget & business plan', change: 'Management of change',
  governance: 'Governance', machines: 'Machine needs', pack: 'Engineering pack', permits: 'Permits', execution: 'Execution', risk: 'Risks',
  safety: 'Safety milestones', rampup: 'Ramp-up',
};

/** The source an action opened from a CAPEX page gets by default. */
export const SOURCE_OF_SCREEN: Partial<Record<ScreenId, ActionSource>> = {
  'capex-gates': 'gate', 'capex-dossiers': 'dossier', 'capex-budget': 'budget', 'capex-changes': 'change', 'capex-governance': 'governance',
  'capex-machines': 'machines', 'capex-pack': 'pack', 'capex-permits': 'permits', 'capex-execution': 'execution', 'capex-risks': 'risk',
  'capex-safety': 'safety', 'capex-rampup': 'rampup',
};

/** The page of the element an action comes from. */
export const SCREEN_OF_SOURCE: Record<ActionSource, ScreenId> = {
  general: 'capex-overview', gate: 'capex-gates', dossier: 'capex-dossiers', budget: 'capex-budget', change: 'capex-changes', governance: 'capex-governance',
  machines: 'capex-machines', pack: 'capex-pack', permits: 'capex-permits', execution: 'capex-execution', risk: 'capex-risks', safety: 'capex-safety', rampup: 'capex-rampup',
};

export type ActionStatus = 'open' | 'done' | 'cancelled';
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { open: 'Open', done: 'Done', cancelled: 'Cancelled' };

export interface ActionInput {
  title: string;
  description: string | null;
  source: ActionSource;
  sourceRef: string | null;
  ownerUserId: string | null;
  dueOn: string | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) ? v : null);

/** A new or edited action: a title, a known source, an owner among the people of the CAPEX, a valid due date. */
export function checkAction(raw: Record<string, unknown>, ctx: { people: ReadonlySet<string> }): Check<ActionInput> {
  const title = text(raw.title);
  if (title.length < 3 || title.length > 200) return { ok: false, error: 'Describe the action' };
  const source = (text(raw.source) || 'general') as ActionSource;
  if (!ACTION_SOURCES.includes(source)) return { ok: false, error: 'Choose what the action comes from' };
  const ownerUserId = text(raw.ownerUserId) || null;
  if (ownerUserId && !ctx.people.has(ownerUserId)) return { ok: false, error: 'Choose the owner in the team' };
  const due = text(raw.dueOn);
  const dueOn = due ? isoDate(due) : null;
  if (due && !dueOn) return { ok: false, error: 'Enter a valid date' };
  return { ok: true, value: { title, description: text(raw.description).slice(0, 2000) || null, source, sourceRef: text(raw.sourceRef).slice(0, 100) || null, ownerUserId, dueOn } };
}

/** Closing an open action: done (note optional) or cancelled (reason required). */
export function checkClosing(status: { status: ActionStatus }, outcome: unknown, note: unknown): Check<{ status: 'done' | 'cancelled'; note: string | null }> {
  if (status.status !== 'open') return { ok: false, error: 'This action is already closed' };
  if (outcome !== 'done' && outcome !== 'cancelled') return { ok: false, error: 'Choose how to close the action' };
  const n = text(note).slice(0, 2000) || null;
  if (outcome === 'cancelled' && !n) return { ok: false, error: 'Give the reason for the cancellation' };
  return { ok: true, value: { status: outcome, note: n } };
}

export const isLate = (a: { status: string; dueOn: string | null }, today: string) => a.status === 'open' && !!a.dueOn && a.dueOn < today;

/** Counts of the action plan: open, late, done. */
export function actionCounts(list: readonly { status: string; dueOn: string | null }[], today: string) {
  return { open: list.filter((a) => a.status === 'open').length, late: list.filter((a) => isLate(a, today)).length, done: list.filter((a) => a.status === 'done').length };
}
