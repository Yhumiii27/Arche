// CAPEX rules (docs/spec/01 §3, 02 §3; N-9, N-12): codes, the checks of what people type (identity sheet, lots, risks,
// decisions) and who may write what in which state. Pure: shared by the Server Functions, the pages and the tests. Messages
// are EN source strings.
import type { RoleKey } from '@/config/roles';
import type { RoleAssignment } from './rights';
import type { Check } from './admin';
import { parseKeur, type TeamRole } from './budget';

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (v: unknown): string | null => {
  const s = text(v);
  if (!ISO_DATE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
};

// ── Codes (N-9) ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** "CPX-APM-2026-03": the next number of the subsidiary in the year, from the codes already taken. */
export function nextCapexCode(subsidiaryCode: string, year: number, taken: readonly string[]): string {
  const prefix = `CPX-${subsidiaryCode}-${year}-`;
  const max = taken.filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length))).filter(Number.isInteger).reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

/** "R-03", "D-12": the next number of a register inside a CAPEX. */
export const nextNumber = (numbers: readonly number[]) => numbers.reduce((m, n) => Math.max(m, n), 0) + 1;
export const refOf = (prefix: string, n: number) => `${prefix}-${String(n).padStart(2, '0')}`;

// ── Identity sheet ────────────────────────────────────────────────────────────────────────────────────────────────────

export const INVESTMENT_TYPES = ['new_plant', 'new_line', 'extension', 'other'] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export interface CapexSheet {
  title: string;
  description: string | null;
  investmentType: InvestmentType;
  siteId: string | null;
  needDate: string | null;
}

/** The identity sheet: a title, a known investment type, a site of the subsidiary, an optional need date. */
export function checkSheet(raw: Record<string, unknown>, ctx: { sites: ReadonlySet<string> }): Check<CapexSheet> {
  const title = text(raw.title);
  if (title.length < 3 || title.length > 160) return { ok: false, error: 'Enter the CAPEX title' };
  const investmentType = text(raw.investmentType);
  if (!(INVESTMENT_TYPES as readonly string[]).includes(investmentType)) return { ok: false, error: 'Choose the investment type' };
  const siteId = text(raw.siteId) || null;
  if (siteId && !ctx.sites.has(siteId)) return { ok: false, error: 'Choose a site of the subsidiary' };
  const needRaw = text(raw.needDate);
  const needDate = needRaw ? isoDate(needRaw) : null;
  if (needRaw && !needDate) return { ok: false, error: 'Enter a valid date' };
  return { ok: true, value: { title, description: text(raw.description).slice(0, 4000) || null, investmentType: investmentType as InvestmentType, siteId, needDate } };
}

// ── Lots (N-12) ───────────────────────────────────────────────────────────────────────────────────────────────────────

export const LOT_KINDS = ['civil_works', 'buildings', 'utilities', 'vrd', 'land', 'machines', 'recruitment', 'other'] as const;
export type LotKind = (typeof LOT_KINDS)[number];

export const LOT_KIND_LABEL: Record<LotKind, string> = {
  civil_works: 'Civil works',
  buildings: 'Buildings',
  utilities: 'Utilities',
  vrd: 'Roads and networks',
  land: 'Land',
  machines: 'Machines',
  recruitment: 'Recruitment',
  other: 'Other',
};

/** A lot: a kind of the list and a title; machine lots are fed by the EPC2i projects (spec 02 §3). */
export function checkLot(raw: Record<string, unknown>): Check<{ kind: LotKind; title: string; epc2i: boolean }> {
  const kind = text(raw.kind);
  if (!(LOT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Choose the kind of lot' };
  const title = text(raw.title);
  if (title.length < 2 || title.length > 120) return { ok: false, error: 'Enter the lot title' };
  return { ok: true, value: { kind: kind as LotKind, title, epc2i: kind === 'machines' } };
}

// ── Budget lines ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The amounts of a version, one field `lot:<id>` per lot; an empty field is 0. */
export function checkBudgetLines(raw: Record<string, unknown>, lotIds: readonly string[]): Check<{ lotId: string; amountKeur: number }[]> {
  const lines: { lotId: string; amountKeur: number }[] = [];
  for (const id of lotIds) {
    const v = text(raw[`lot:${id}`]);
    const n = v ? parseKeur(v) : 0;
    if (n == null) return { ok: false, error: 'Enter the amounts in k€' };
    lines.push({ lotId: id, amountKeur: n });
  }
  return { ok: true, value: lines };
}

// ── Risks ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const RISK_CATEGORIES = ['technical', 'schedule', 'cost', 'hse', 'regulatory', 'market', 'other'] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = {
  technical: 'Technical', schedule: 'Schedule', cost: 'Cost', hse: 'HSE', regulatory: 'Regulatory', market: 'Market', other: 'Other',
};
export const RISK_STATUSES = ['open', 'mitigated', 'closed'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
export const RISK_STATUS_LABEL: Record<RiskStatus, string> = { open: 'Open', mitigated: 'Mitigated', closed: 'Closed' };

export interface RiskInput {
  title: string;
  category: RiskCategory;
  probability: number;
  impact: number;
  ownerUserId: string | null;
  response: string | null;
  status: RiskStatus;
  dueOn: string | null;
}

/** Probability and impact on a 1–4 scale; score = probability × impact (≥ 9 is a major risk). */
export const riskScore = (p: number, i: number) => p * i;
export const isMajorRisk = (p: number, i: number) => riskScore(p, i) >= 9;

export function checkRisk(raw: Record<string, unknown>, ctx: { people: ReadonlySet<string> }): Check<RiskInput> {
  const title = text(raw.title);
  if (title.length < 3 || title.length > 200) return { ok: false, error: 'Describe the risk' };
  const category = text(raw.category);
  if (!(RISK_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'Choose the category' };
  const probability = Number(text(raw.probability));
  const impact = Number(text(raw.impact));
  if (![probability, impact].every((n) => Number.isInteger(n) && n >= 1 && n <= 4)) return { ok: false, error: 'Probability and impact go from 1 to 4' };
  const ownerUserId = text(raw.ownerUserId) || null;
  if (ownerUserId && !ctx.people.has(ownerUserId)) return { ok: false, error: 'Choose the owner in the team' };
  const status = text(raw.status) || 'open';
  if (!(RISK_STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Choose the status' };
  const dueRaw = text(raw.dueOn);
  const dueOn = dueRaw ? isoDate(dueRaw) : null;
  if (dueRaw && !dueOn) return { ok: false, error: 'Enter a valid date' };
  return { ok: true, value: { title, category: category as RiskCategory, probability, impact, ownerUserId, response: text(raw.response).slice(0, 2000) || null, status: status as RiskStatus, dueOn } };
}

// ── Decisions register ────────────────────────────────────────────────────────────────────────────────────────────────

export const DECISION_BODIES = ['copil_projet', 'copil_gpi', 'dir_ig', 'ceo'] as const;
export type DecisionBody = (typeof DECISION_BODIES)[number];
export const DECISION_BODY_LABEL: Record<DecisionBody, string> = {
  copil_projet: 'Project steering committee', copil_gpi: 'COPIL GPI', dir_ig: 'Group industrial director', ceo: 'CEO',
};

export function checkDecision(raw: Record<string, unknown>, today: string): Check<{ takenOn: string; body: DecisionBody; text: string }> {
  const takenOn = isoDate(raw.takenOn);
  if (!takenOn || takenOn > today) return { ok: false, error: 'Enter the date of the decision (not in the future)' };
  const body = text(raw.body);
  if (!(DECISION_BODIES as readonly string[]).includes(body)) return { ok: false, error: 'Choose who decided' };
  const t = text(raw.text);
  if (t.length < 3 || t.length > 2000) return { ok: false, error: 'Write the decision' };
  return { ok: true, value: { takenOn, body: body as DecisionBody, text: t } };
}

// ── Team ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const TEAM_ROLES: readonly TeamRole[] = ['lead', 'controller', 'co_dig', 'epc2i_pmo', 'internal_client', 'member'];
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  lead: 'Project lead', controller: 'Controller', co_dig: 'Co-DIG', epc2i_pmo: 'EPC2i PMO', internal_client: 'Internal client', member: 'Team member',
};

/** The CAPEX-scoped role a team role gives (spec 01 §2: the named team sees the CAPEX); null = none (subsidiary roles). */
export const ROLE_OF_TEAM_ROLE: Partial<Record<TeamRole, RoleKey>> = { lead: 'project_lead', co_dig: 'co_dig', epc2i_pmo: 'epc2i_pmo' };

// ── Write rights (spec 01 §3) ─────────────────────────────────────────────────────────────────────────────────────────

export type CapexAction =
  | 'edit' // identity sheet, lots, risks, decisions, team
  | 'open'
  | 'budget' // budget versions: create, edit, submit
  | 'needs' // machine needs to EPC2i: enter, submit, withdraw (spec 07 §1)
  | 'force_typology'
  | 'confirm_typology'
  | 'decide_gate'
  | 'suspend'
  | 'safety' // safety milestones declared by the group HSE (N-13)
  | 'audit' // cross-functional audit of a Strategic CAPEX (N-19)
  | 'rampup' // start of commissioning, production lines, daily ramp-up entries (N-16; the operations expert enters days)
  | 'closure' // accounting closure statement of the subsidiary controller (N-15)
  | 'rex'; // lessons learned entered by the team

export interface CapexWriteFacts {
  code: string;
  subsidiaryCode: string;
  status: string;
}

/** Holds `role` with an assignment that covers the CAPEX (its subsidiary, or the CAPEX itself). */
export function holdsOn(assignments: readonly RoleAssignment[], role: RoleKey, c: CapexWriteFacts): boolean {
  return assignments.some((a) => a.role === role && (a.scopeKind === 'group' || (a.scopeKind === 'subsidiary' && a.scopeRef === c.subsidiaryCode) || (a.scopeKind === 'capex' && a.scopeRef === c.code)));
}

/**
 * True when the viewer, in their active role, may do `action` on the CAPEX. Reading is decided by the visibility (rights.ts);
 * this adds the writing rules: the role, an assignment that covers the CAPEX, and a state that is open (a closed or abandoned
 * CAPEX is read-only everywhere; a suspended one only resumes).
 */
export function canDo(action: CapexAction, role: RoleKey, assignments: readonly RoleAssignment[], c: CapexWriteFacts): boolean {
  const on = (r: RoleKey) => role === r && holdsOn(assignments, r, c);
  const open = c.status === 'draft' || c.status === 'active';
  switch (action) {
    case 'edit':
      return open && (on('project_lead') || on('sponsor'));
    case 'open':
      return c.status === 'draft' && on('sponsor');
    case 'budget':
      return open && (on('project_lead') || on('controller'));
    case 'needs':
      return c.status === 'active' && on('project_lead');
    case 'force_typology':
    case 'confirm_typology':
      return open && on('dir_ig');
    case 'decide_gate':
      return c.status === 'active' && (on('dir_ig') || on('ceo'));
    case 'suspend':
      return (c.status === 'active' || c.status === 'on_hold') && on('dir_ig');
    case 'safety':
      return open && on('group_hse');
    case 'audit':
      return c.status === 'active' && (on('dir_ig') || on('epc2i_pmo'));
    case 'rampup':
      return c.status === 'active' && (on('project_lead') || (role === 'expert' && assignments.some((a) => a.role === 'expert' && a.speciality === 'operations' && a.scopeKind === 'capex' && a.scopeRef === c.code)));
    case 'closure':
      return c.status === 'active' && on('controller');
    case 'rex':
      return open && (on('project_lead') || on('sponsor') || on('controller') || on('co_dig') || on('epc2i_pmo'));
  }
}

/** Who may create a draft and in which subsidiary: a sponsor in theirs, a project lead in the subsidiary of their account. */
export function creatableSubsidiaries(role: RoleKey, assignments: readonly RoleAssignment[], userSubsidiary: string | null): string[] {
  if (role === 'sponsor') return [...new Set(assignments.filter((a) => a.role === 'sponsor' && a.scopeKind === 'subsidiary' && a.scopeRef).map((a) => a.scopeRef!))].sort();
  if (role === 'project_lead' && userSubsidiary) return [userSubsidiary];
  return [];
}
