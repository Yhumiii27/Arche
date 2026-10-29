// Backlog of investment ideas (AR-051, DECISIONS.md §5): before the formal request, anyone of the business proposes an idea for
// a subsidiary (title, stake, order of magnitude); the subsidiary's sponsor, its zone director or the group industrial director
// qualifies it, retains it or sets it aside (with a reason); a retained idea becomes a CAPEX draft through the guided opening
// ("Open a CAPEX"), which marks it converted. Pure: statuses, transitions, rights and checks.
import type { RoleKey } from '@/config/roles';
import { INVESTMENT_TYPES, type InvestmentType } from './capex';
import type { RoleAssignment } from './rights';

export const IDEA_STATUSES = ['new', 'qualified', 'retained', 'rejected', 'converted'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'New', qualified: 'Qualified', retained: 'Retained', rejected: 'Set aside', converted: 'Became a CAPEX',
};

export type IdeaDecision = 'qualify' | 'retain' | 'reject';
export const IDEA_DECISION_LABEL: Record<IdeaDecision, string> = { qualify: 'Qualify', retain: 'Retain', reject: 'Set aside' };

/** The decisions open on an idea in this status. */
export const decisionsOn = (s: IdeaStatus): IdeaDecision[] => (s === 'new' ? ['qualify', 'retain', 'reject'] : s === 'qualified' ? ['retain', 'reject'] : []);
const NEXT: Record<IdeaDecision, IdeaStatus> = { qualify: 'qualified', retain: 'retained', reject: 'rejected' };
export const statusAfter = (d: IdeaDecision): IdeaStatus => NEXT[d];

/** "IDEA-APM-007". */
export const ideaRef = (subsidiaryCode: string, n: number) => `IDEA-${subsidiaryCode}-${String(n).padStart(3, '0')}`;

/** Anyone of the business proposes (the administrator writes nothing of the business). */
export const canPropose = (role: RoleKey) => role !== 'admin';

/** Who decides on an idea of a subsidiary: its sponsor, the director of its zone, the group industrial director. */
export function canDecideIdea(role: RoleKey, assignments: readonly RoleAssignment[], idea: { subsidiaryCode: string; zoneCode: string }): boolean {
  const holds = (r: RoleKey, kind: string, ref: string | null) => assignments.some((a) => a.role === r && (a.scopeKind === 'group' || (a.scopeKind === kind && a.scopeRef === ref)));
  if (role === 'dir_ig') return holds('dir_ig', 'group', null);
  if (role === 'sponsor') return holds('sponsor', 'subsidiary', idea.subsidiaryCode);
  if (role === 'zone_director') return holds('zone_director', 'zone', idea.zoneCode);
  return false;
}

type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** An idea typed: a subsidiary among `subsidiaries`, a title, the stake, an order of magnitude in k€ (optional), a type. */
export function checkIdea(raw: Record<string, unknown>, subsidiaries: readonly string[]): Check<{ subsidiaryCode: string; title: string; stake: string; sizeKeur: number | null; investmentType: InvestmentType | null }> {
  const subsidiaryCode = text(raw.subsidiaryCode).toUpperCase();
  if (!subsidiaries.includes(subsidiaryCode)) return { ok: false, error: 'Choose a subsidiary of your scope' };
  const title = text(raw.title);
  if (title.length < 3 || title.length > 160) return { ok: false, error: 'Give the idea a title (160 characters at most)' };
  const stake = text(raw.stake);
  if (stake.length < 10 || stake.length > 2000) return { ok: false, error: 'Describe the stake in a few words (2 000 characters at most)' };
  const sizeRaw = text(raw.sizeKeur).replace(/\s/g, '').replace(',', '.');
  const sizeKeur = sizeRaw ? Number(sizeRaw) : null;
  if (sizeKeur != null && (!Number.isFinite(sizeKeur) || sizeKeur < 0 || sizeKeur > 1_000_000)) return { ok: false, error: 'Give the order of magnitude in k€' };
  const type = text(raw.investmentType);
  if (type && !(INVESTMENT_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'Choose the investment type' };
  return { ok: true, value: { subsidiaryCode, title, stake, sizeKeur: sizeKeur == null ? null : Math.round(sizeKeur * 10) / 10, investmentType: (type || null) as InvestmentType | null } };
}

/** A decision on an idea: one open in its status; setting aside needs a reason. */
export function checkIdeaDecision(raw: Record<string, unknown>, status: IdeaStatus): Check<{ decision: IdeaDecision; note: string | null }> {
  const decision = text(raw.decision) as IdeaDecision;
  if (!decisionsOn(status).includes(decision)) return { ok: false, error: 'This decision is not open on the idea' };
  const note = text(raw.note).slice(0, 1000) || null;
  if (decision === 'reject' && !note) return { ok: false, error: 'Say why the idea is set aside' };
  return { ok: true, value: { decision, note } };
}
