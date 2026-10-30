// Guided opening of a CAPEX (owner's request, 24 Oct 2026; DECISIONS.md §5): one wizard that asks, from the start, what the
// opening and the framing need — identity sheet, lots, indicative budget, team, initial risks, the dossier of the phase — or,
// for a CAPEX already in progress (N-20), its phase, the gates passed and the validated budget. Only the title and the
// investment type are required: what is not answered is completed later on the CAPEX pages. Pure: reuses the checks of each
// page (checkSheet, checkLot, checkRisk, checkSectionText, checkTakeover); messages are EN source strings.
import type { Check } from './admin';
import { parseKeur, round1, type TeamRole } from './budget';
import { checkLot, checkRisk, checkSheet, TEAM_ROLES, type CapexSheet, type LotKind, type RiskInput } from './capex';
import { checkSectionText, DOSSIER_OF_GATE, SECTIONS, type DossierKind } from './dossiers';
import { GATE_OF_PHASE, type Phase } from './lifecycle';
import { checkTakeover, type TakeoverInput } from './takeover';

export const GUIDED_STEPS = ['start', 'identity', 'lots', 'budget', 'team', 'risks', 'dossier', 'summary'] as const;
export type GuidedStep = (typeof GUIDED_STEPS)[number];
export const GUIDED_STEP_LABEL: Record<GuidedStep, string> = {
  start: 'Start', identity: 'Identity', lots: 'Lots', budget: 'Budget', team: 'Team', risks: 'Initial risks', dossier: 'Dossier', summary: 'Review and create',
};

/** The team roles the wizard names (the project lead is named on the identity step). */
export const GUIDED_TEAM_ROLES: readonly TeamRole[] = TEAM_ROLES.filter((r) => r !== 'lead');

/** The dossier the CAPEX works on next: the business case in phase 1, the investment dossier in phase 2, else transfer. */
export function dossierOfPhase(phase: Phase): DossierKind {
  return DOSSIER_OF_GATE[GATE_OF_PHASE[phase]] ?? 'transfer';
}

/** The sections of a dossier typed in the wizard (text sections only; computed sections fill themselves). */
export const textSections = (kind: DossierKind) => SECTIONS[kind].filter((s) => s.mode === 'text');

export interface GuidedRaw {
  mode?: unknown;
  finish?: unknown;
  sheet?: Record<string, unknown>;
  lots?: unknown;
  budget?: { basis?: unknown; amounts?: unknown };
  team?: unknown;
  risks?: unknown;
  sections?: Record<string, unknown>;
  takeover?: Record<string, unknown>;
}

export interface GuidedInput {
  mode: 'new' | 'takeover';
  /** draft: created as a draft; open: opened in phase 1 (sponsor); takeover: opened in its phase (sponsor). */
  finish: 'draft' | 'open' | 'takeover';
  sheet: CapexSheet;
  leadUserId: string | null;
  lots: { kind: LotKind; title: string; epc2i: boolean }[];
  /** Indicative E50 budget (a draft version), by lot index; null when nothing was typed. */
  budget: { basis: string | null; amounts: number[] } | null;
  team: { userId: string; capexRole: TeamRole }[];
  risks: RiskInput[];
  dossier: DossierKind;
  sections: { key: string; text: string }[];
  /** Takeover: lot ids are the lot indexes ("0", "1"…), mapped to the lots created. */
  takeover: TakeoverInput | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').slice(0, 50) : []);

export interface GuidedContext {
  today: string;
  /** The role creating: a sponsor (opens, takes over, names the lead) or a project lead (creates the draft, is the lead). */
  role: 'sponsor' | 'project_lead';
  /** The creator (the project lead when a project lead creates). */
  userId: string;
  /** Sites of the subsidiary. */
  sites: ReadonlySet<string>;
  /** People who may be named on a CAPEX of the subsidiary (its people and the group's). */
  people: ReadonlySet<string>;
  /** The sponsor of the CAPEX (the creator when a sponsor creates). */
  sponsorUserId: string | null;
}

export function checkGuided(raw: GuidedRaw, ctx: GuidedContext): Check<GuidedInput> {
  const mode = raw.mode === 'takeover' ? 'takeover' : 'new';
  const finish = raw.finish === 'open' || raw.finish === 'takeover' ? raw.finish : 'draft';
  if (ctx.role !== 'sponsor' && (mode === 'takeover' || finish !== 'draft')) return { ok: false, error: 'Only the sponsor opens or takes over a CAPEX' };
  if ((mode === 'takeover') !== (finish === 'takeover') && finish !== 'draft') return { ok: false, error: 'Choose how to finish' };
  const sheet = checkSheet(raw.sheet ?? {}, { sites: ctx.sites });
  if (!sheet.ok) return sheet;
  let leadUserId: string | null = ctx.role === 'project_lead' ? ctx.userId : text(raw.sheet?.leadUserId) || null;
  if (leadUserId && !ctx.people.has(leadUserId)) return { ok: false, error: 'Choose a person of the subsidiary or of the group' };
  if (finish !== 'draft' && !leadUserId) return { ok: false, error: 'Name the project lead first' };
  leadUserId = leadUserId ?? null;

  const lots: GuidedInput['lots'] = [];
  for (const r of rows(raw.lots)) {
    if (!text(r.title)) continue;
    const ch = checkLot(r);
    if (!ch.ok) return { ok: false, error: `${ch.error} — ${text(r.title)}` };
    lots.push(ch.value);
  }

  let budget: GuidedInput['budget'] = null;
  const amountsRaw = Array.isArray(raw.budget?.amounts) ? raw.budget!.amounts as unknown[] : [];
  if (mode === 'new' && amountsRaw.some((a) => text(a))) {
    if (!lots.length) return { ok: false, error: 'Add the lots of the CAPEX first' };
    const amounts: number[] = [];
    for (let i = 0; i < lots.length; i++) {
      const v = text(amountsRaw[i]);
      const n = v ? parseKeur(v) : 0;
      if (n == null) return { ok: false, error: 'Enter the amounts in k€' };
      amounts.push(n);
    }
    budget = { basis: text(raw.budget?.basis).slice(0, 1000) || null, amounts: amounts.map(round1) };
  }

  const team: GuidedInput['team'] = [];
  for (const r of rows(raw.team)) {
    const userId = text(r.userId);
    if (!userId) continue;
    const capexRole = GUIDED_TEAM_ROLES.find((x) => x === r.capexRole);
    if (!capexRole) return { ok: false, error: 'Choose the role in the team' };
    if (!ctx.people.has(userId)) return { ok: false, error: 'Choose a person of the subsidiary or of the group' };
    if (!team.some((m) => m.userId === userId && m.capexRole === capexRole)) team.push({ userId, capexRole });
  }

  const owners = new Set([...team.map((m) => m.userId), ...(leadUserId ? [leadUserId] : []), ...(ctx.sponsorUserId ? [ctx.sponsorUserId] : [])]);
  const risks: RiskInput[] = [];
  for (const r of rows(raw.risks)) {
    if (!text(r.title)) continue;
    const ch = checkRisk({ status: 'open', ...r }, { people: owners });
    if (!ch.ok) return { ok: false, error: `${ch.error} — ${text(r.title)}` };
    risks.push(ch.value);
  }

  let takeover: TakeoverInput | null = null;
  if (mode === 'takeover') {
    const t = raw.takeover ?? {};
    const flat: Record<string, unknown> = { ...t };
    const amounts = Array.isArray(t.amounts) ? (t.amounts as unknown[]) : [];
    lots.forEach((_, i) => (flat[`lot:${i}`] = amounts[i] ?? ''));
    const ch = checkTakeover(flat, { today: ctx.today, lotIds: lots.map((_, i) => String(i)) });
    if (!ch.ok) return ch;
    takeover = ch.value;
  }

  const dossier = dossierOfPhase(takeover?.phase ?? 'cadrage');
  const sections: GuidedInput['sections'] = [];
  for (const s of textSections(dossier)) {
    const v = text(raw.sections?.[s.key]);
    if (!v) continue;
    const ch = checkSectionText(dossier, s.key, v);
    if (!ch.ok) return ch;
    sections.push({ key: s.key, text: ch.value });
  }

  return { ok: true, value: { mode, finish, sheet: sheet.value, leadUserId, lots, budget, team, risks, dossier, sections, takeover } };
}

/** What is answered and what is left for later (summary step), as EN source strings. */
export function guidedGaps(v: Pick<GuidedInput, 'mode' | 'lots' | 'budget' | 'team' | 'risks' | 'sections' | 'leadUserId' | 'dossier'>): string[] {
  const out: string[] = [];
  if (!v.leadUserId) out.push('Project lead');
  if (!v.lots.length) out.push('Lots');
  if (v.mode === 'new' && !v.budget) out.push('Indicative E50 budget');
  if (!v.team.length) out.push('Team');
  if (!v.risks.length) out.push('Initial risks');
  if (v.sections.length < textSections(v.dossier).length) out.push('Dossier sections');
  return out;
}
