// The three living dossiers (docs/spec/04): structured data, not documents — sections typed in Arche, values computed by
// Arche (budget, risks, team, business plan) and references to Codex documents (N-17). A version is a draft until it is
// frozen; a frozen version is immutable and carries the SHA-256 of its canonical content, which the signatures carry too.
// Pure: completeness, canonical JSON, checks of what people type. Titles are EN source strings.
import type { Check } from './admin';
import type { GateCode } from './lifecycle';

export type DossierKind = 'business_case' | 'investment' | 'transfer';
export const DOSSIER_KINDS: readonly DossierKind[] = ['business_case', 'investment', 'transfer'];
export const isDossierKind = (v: unknown): v is DossierKind => typeof v === 'string' && (DOSSIER_KINDS as readonly string[]).includes(v);

export const DOSSIER_LABEL: Record<DossierKind, string> = {
  business_case: 'Business case (scoping)',
  investment: 'Investment dossier',
  transfer: 'Transfer & lessons learned',
};

/** The dossier each gate decides on (C-2: no dossier at K3). */
export const DOSSIER_OF_GATE: Partial<Record<GateCode, DossierKind>> = { G1: 'business_case', G2: 'investment', G3: 'transfer' };

export type VersionState = 'draft' | 'frozen' | 'approved' | 'rejected' | 'superseded';
export const VERSION_STATE_LABEL: Record<VersionState, string> = {
  draft: 'Draft', frozen: 'Frozen', approved: 'Approved', rejected: 'Rejected', superseded: 'Superseded',
};

/** What a computed section needs to be complete (facts read by the server at the time). */
export type ComputedNeed = 'budget_e50' | 'budget_e10' | 'business_plan' | 'business_plan_validated' | 'risks' | 'team';

export interface SectionDef {
  key: string;
  /** EN source string. */
  title: string;
  /** EN source string: what the section holds. */
  hint: string;
  /**
   * `text`: typed, required; `computed`: Arche's values, complete when `need` holds (a comment may be typed); `optional`:
   * typed, not counted (conditional sections whose data comes with a later delivery); `circuit`: filled by the circuit.
   */
  mode: 'text' | 'computed' | 'optional' | 'circuit';
  need?: ComputedNeed;
  /** Expected Codex document types for the references of the section (docs/spec/04 "Type Codex"). */
  codexTypes?: string[];
}

export const SECTIONS: Record<DossierKind, readonly SectionDef[]> = {
  business_case: [
    { key: 'need', title: '1. Need and scope', hint: 'Need, product, target capacity, site, scope included and excluded', mode: 'text' },
    { key: 'strategy', title: '2. Strategic fit and market', hint: 'Market, customers, fit with the subsidiary’s and the group’s strategy', mode: 'text' },
    { key: 'barriers', title: '3. Barriers to entry', hint: 'Technological, regulatory, competition', mode: 'text' },
    { key: 'land', title: '4. Land and regulatory constraints', hint: 'ICPE, local plan, site access, land status and area', mode: 'text' },
    { key: 'prelim_bp', title: '5. Preliminary business plan', hint: 'E50 budget by lot (validated version), OPEX, expected revenue, NPV / IRR / payback', mode: 'computed', need: 'budget_e50' },
    { key: 'machines', title: '6. Machine needs', hint: 'Need lines and indicative EPC2i answers (delivery 4)', mode: 'optional' },
    { key: 'risks', title: '7. Initial risks', hint: 'Open risks of the register', mode: 'computed', need: 'risks' },
    { key: 'safety', title: '8. Safety', hint: 'HS 2 HazID status and its proof (Codex reference)', mode: 'text' },
    { key: 'team', title: '9. Team and typology', hint: 'Sponsor, project lead, team, typology computed or forced', mode: 'computed', need: 'team' },
  ],
  investment: [
    { key: 'baseline', title: '1. Technical baseline', hint: 'Variants studied, variant retained, freeze date', mode: 'text' },
    { key: 'pack', title: '2. Engineering pack', hint: 'Weighted % (subsidiary + EPC2i), documents by family', mode: 'text', codexTypes: ['PID', 'BOM', 'GA', 'SCH', 'FDS'] },
    { key: 'regulatory', title: '3. Regulatory file', hint: 'ICPE, building permit, local plan, ATEX zoning', mode: 'text', codexTypes: ['AUT'] },
    { key: 'safety', title: '4. Safety', hint: 'HS 3 HazOp / FMEA (proof), open actions', mode: 'text' },
    { key: 'afe', title: '5. AFE', hint: 'Amount requested (E10 budget), disbursement phasing, lots, contingency', mode: 'computed', need: 'budget_e10' },
    { key: 'bp', title: '6. Consolidated business plan', hint: 'Flows, NPV, IRR, payback, sensitivities — validated by the group CFO', mode: 'computed', need: 'business_plan_validated' },
    { key: 'offers', title: '7. EPC2i offers', hint: 'Firm offers for each machine need (delivery 4)', mode: 'optional' },
    { key: 'schedule', title: '8. Master schedule', hint: 'Planned milestones: order, works, commissioning, ramp-up, G3', mode: 'text' },
    { key: 'risks', title: '9. Risks', hint: 'Register up to date', mode: 'computed', need: 'risks' },
    { key: 'opinions', title: '10. Expert opinions', hint: 'Quality, HSE, finance, operations — given in the circuit', mode: 'circuit' },
  ],
  transfer: [
    { key: 'assets', title: '1. Assets transferred', hint: 'Lots and machines, value', mode: 'text' },
    { key: 'reservations', title: '2. Reservations', hint: 'Gate conditions and changes cleared; EPC2i reservations and acceptance reports', mode: 'text' },
    { key: 'safety', title: '3. Safety', hint: 'PSSR discharge, HS 6 ASPD', mode: 'text' },
    { key: 'rampup', title: '4. Ramp-up', hint: 'Curve, date of the continuous days, OEE and scrap at acceptance', mode: 'text' },
    { key: 'accounting', title: '5. Accounting closure', hint: 'Final cost by lot, gap to the G2 budget, AFE balance', mode: 'text' },
    { key: 'rex', title: '6. Lessons learned', hint: 'Lessons by phase and by category', mode: 'text' },
    { key: 'pv', title: '7. Asset transfer report', hint: 'Countersigned by the internal client and the group industrial director in the circuit', mode: 'circuit' },
  ],
};

/** A reference to a Codex document (N-17): identifier TYPE-CONTEXT-SEQ, revision letter, title as seen. */
export interface CodexRef {
  id: string;
  revision: string | null;
  title: string | null;
  /** True when found in Codex (pub_documents, or the simulation) when it was attached. */
  verified: boolean;
}

export interface SectionContent {
  text: string;
  refs: CodexRef[];
}

export interface DossierContent {
  sections: Record<string, SectionContent>;
}

export const emptyContent = (kind: DossierKind): DossierContent => ({ sections: Object.fromEntries(SECTIONS[kind].map((s) => [s.key, { text: '', refs: [] }])) });

/** Reads stored content over the empty one (unknown sections dropped, missing ones empty). */
export function readContent(kind: DossierKind, stored: unknown): DossierContent {
  const base = emptyContent(kind);
  const sec = (stored && typeof stored === 'object' ? (stored as { sections?: unknown }).sections : null) as Record<string, unknown> | null;
  if (!sec || typeof sec !== 'object') return base;
  for (const s of SECTIONS[kind]) {
    const v = sec[s.key] as Partial<SectionContent> | undefined;
    if (!v || typeof v !== 'object') continue;
    base.sections[s.key] = {
      text: typeof v.text === 'string' ? v.text : '',
      refs: Array.isArray(v.refs) ? v.refs.filter((r): r is CodexRef => !!r && typeof (r as CodexRef).id === 'string') : [],
    };
  }
  return base;
}

/** Facts of the computed sections, read by the server at the time (and frozen with the version). */
export type ComputedFacts = Record<ComputedNeed, boolean>;

export interface Completeness {
  /** Section key → complete (null = not counted: optional or filled by the circuit). */
  bySection: Record<string, boolean | null>;
  pct: number;
}

/** % of the required sections complete: a typed section has text; a computed one has its data. */
export function completeness(kind: DossierKind, content: DossierContent, facts: ComputedFacts): Completeness {
  const bySection: Record<string, boolean | null> = {};
  let counted = 0;
  let done = 0;
  for (const s of SECTIONS[kind]) {
    if (s.mode === 'optional' || s.mode === 'circuit') {
      bySection[s.key] = null;
      continue;
    }
    const ok = s.mode === 'text' ? (content.sections[s.key]?.text.trim().length ?? 0) > 0 : !!facts[s.need!];
    bySection[s.key] = ok;
    counted++;
    if (ok) done++;
  }
  return { bySection, pct: counted ? Math.round((done / counted) * 100) : 100 };
}

/** JSON with object keys sorted at every depth: the canonical form whose SHA-256 is the version's fingerprint. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

/** A Codex identifier: TYPE-CONTEXT-SEQ (e.g. "PID-CPX-APM-2026-01-003", "AUT-APM-012"). */
export const CODEX_ID = /^[A-Z]{2,5}-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{1,5}$/;

/** A Codex reference typed by a person: identifier (upper-cased), optional revision letter (A, B… or A.1). */
export function checkCodexRef(raw: Record<string, unknown>): Check<{ id: string; revision: string | null }> {
  const id = String(raw.codexId ?? '').trim().toUpperCase();
  if (!CODEX_ID.test(id)) return { ok: false, error: 'Enter a Codex identifier such as PID-CPX-APM-2026-01-003' };
  const rev = String(raw.revision ?? '').trim().toUpperCase();
  if (rev && !/^[A-Z]{1,2}(\.\d{1,3})?$/.test(rev)) return { ok: false, error: 'The revision is a letter (A, B…), possibly with a working version (A.1)' };
  return { ok: true, value: { id, revision: rev || null } };
}

/** The text of a section typed by a person (at most 20 000 characters). */
export function checkSectionText(kind: DossierKind, key: string, raw: unknown): Check<string> {
  const s = SECTIONS[kind].find((x) => x.key === key);
  if (!s || s.mode === 'circuit') return { ok: false, error: 'Unknown section' };
  const text = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim() : '';
  if (text.length > 20000) return { ok: false, error: 'The text is too long (20 000 characters at most)' };
  return { ok: true, value: text };
}
