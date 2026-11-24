// Formats in the database (Norma §4: "every column has its constraint — domain of a state, shape of a code, non-empty name,
// consistency between columns; the application checks too, for a clear message, never alone"). The value lists of the
// state columns live here, with no import, so that drizzle-kit loads the schema without the domain modules; the TypeScript
// types of the columns are derived from them (`$type<OneOf<typeof X>>()`), and src/server/db/formats.test.ts compares each
// list with the constant of the domain and with the CHECK of a migrated database (a value added in the code and not in a
// migration breaks the CI). A CHECK lets null through: `notNull()` says whether the column may be empty.
import { sql, type SQL } from 'drizzle-orm';
import { check, type PgColumn } from 'drizzle-orm/pg-core';

export type OneOf<T extends readonly unknown[]> = T[number];

// ── Value lists (same order as the domain constants) ──────────────────────────────────────────────────────────────────
export const ROLE_KEYS = ['ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'epc2i_pmo', 'expert', 'admin'] as const;
export const SCOPE_KINDS = ['group', 'zone', 'subsidiary', 'capex'] as const;
export const EXPERT_SPECIALITIES = ['quality', 'hse', 'finance', 'operations'] as const;
export const CAPEX_STATUSES = ['draft', 'active', 'on_hold', 'closed', 'abandoned'] as const;
export const PHASES = ['cadrage', 'avant_projet', 'execution', 'demarrage'] as const;
export const TYPOLOGIES = ['light', 'strategic'] as const;
export const TYPOLOGY_SOURCES = ['computed', 'forced'] as const;
export const INVESTMENT_TYPES = ['new_plant', 'new_line', 'extension', 'other'] as const;
export const TEAM_ROLES = ['lead', 'controller', 'co_dig', 'epc2i_pmo', 'internal_client', 'member'] as const;
export const GATES = ['G1', 'G2', 'K3', 'G3'] as const;
export const GATE_DECISIONS = ['go', 'go_with_conditions', 'deferred', 'no_go'] as const;
export const GATE_STATUSES = ['open', 'submitted', 'in_review', 'decided', 'returned'] as const;
export const CRITERION_STATES = ['met', 'unmet', 'forced', 'not_evaluated'] as const;
export const ESTIMATE_CLASSES = ['E50', 'E30', 'E10'] as const;
export const BUDGET_STATUSES = ['draft', 'submitted', 'validated', 'superseded'] as const;
export const LOT_KINDS = ['civil_works', 'buildings', 'utilities', 'vrd', 'land', 'machines', 'recruitment', 'other'] as const;
export const RISK_CATEGORIES = ['technical', 'schedule', 'cost', 'hse', 'regulatory', 'market', 'other'] as const;
export const RISK_STATUSES = ['open', 'mitigated', 'closed'] as const;
export const DECISION_BODIES = ['copil_projet', 'copil_gpi', 'dir_ig', 'ceo'] as const;
export const DOSSIER_KINDS = ['business_case', 'investment', 'transfer'] as const;
export const DOSSIER_STATES = ['draft', 'frozen', 'approved', 'rejected', 'superseded'] as const;
export const STEP_KINDS = ['opinion', 'review', 'visa', 'decision', 'signature', 'countersign', 'quitus', 'attestation'] as const;
export const STEP_ACTORS = [...ROLE_KEYS, 'internal_client'] as const;
export const STEP_STATUSES = ['waiting', 'open', 'done', 'cancelled'] as const;
export const STEP_OUTCOMES = ['favorable', 'reserved', 'unfavorable', 'noted', 'approved', 'refused', ...GATE_DECISIONS] as const;
export const SIGNATURE_LEVELS = ['simple', 'advanced'] as const;
export const CHANGE_KINDS = ['cost', 'schedule', 'scope', 'contingency_draw'] as const;
export const CHANGE_STATUSES = ['submitted', 'approved', 'rejected'] as const;
export const DECIDER_LEVELS = ['copil_projet', 'dir_ig', 'ceo'] as const;
export const SIGNATURE_PROVIDERS = ['simulation', 'yousign'] as const;
export const SIGNATURE_REQUEST_STATUSES = ['creating', 'pending', 'completed', 'declined', 'expired', 'cancelled', 'failed'] as const;
export const PERMIT_KINDS = ['icpe', 'building_permit', 'plu', 'atex', 'other'] as const;
export const PERMIT_STATUSES = ['to_file', 'filed', 'obtained', 'refused', 'not_required'] as const;
export const PACK_ITEM_STATUSES = ['expected', 'in_progress', 'validated', 'not_applicable'] as const;
export const HS_CODES = ['HS2', 'HS3', 'HS4', 'PSSR', 'HS6'] as const;
export const HS_STATUSES = ['not_started', 'in_progress', 'passed', 'waived'] as const;
export const HS_SOURCES = ['declared', 'vigie'] as const;
export const SYNC_SOURCES = ['views', 'simulation', 'off'] as const;
export const ACTUAL_SOURCES = ['manual', 'import', 'keystone', 'sage'] as const;
export const REVIEW_KINDS = ['copil_projet', 'audit'] as const;
export const ENVELOPE_CATEGORIES = ['all', 'light', 'strategic'] as const;
export const ENVELOPE_MOVEMENT_KINDS = ['carry_over', 'reallocation'] as const;
export const DEPRECIATION_METHODS = ['linear', 'declining'] as const;
export const ACTION_SOURCES = ['general', 'gate', 'dossier', 'budget', 'change', 'governance', 'machines', 'pack', 'permits', 'execution', 'risk', 'safety', 'rampup'] as const;
export const ACTION_STATUSES = ['open', 'done', 'cancelled'] as const;
export const WEBHOOK_EVENTS = ['capex.opened', 'gate.decided', 'alert.raised'] as const;
export const DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const;
export const DESIGN_KINDS = ['dossier', 'circuit'] as const;
export const DESIGN_STATES = ['draft', 'published', 'retired'] as const;
export const IDEA_STATUSES = ['new', 'qualified', 'retained', 'rejected', 'converted'] as const;
export const POST_AUDIT_MONTHS = [6, 12, 24] as const;
export const POST_AUDIT_CONCLUSIONS = ['above', 'on_track', 'below'] as const;
export const NEED_STATUSES = ['draft', 'submitted', 'withdrawn', 'ordered'] as const;
export const EMAIL_STATUSES = ['pending', 'sent', 'held', 'failed'] as const;
export const KPI_KEYS = ['delay:G1', 'delay:G2', 'delay:K3', 'delay:G3', 'documents', 'traced'] as const;
export const JOB_STATUSES = ['ok', 'error'] as const;
export const SCORING_CODES = ['value', 'return', 'risk', 'strategy', 'urgency', 'safety'] as const;
export const MANUAL_SCORING_CODES = ['strategy', 'urgency', 'safety'] as const;
export const SCENARIO_KINDS = ['base', 'constrained', 'growth', 'other'] as const;
export const RAMPUP_STATUSES = ['en_cours', 'atteint', 'hors_delai'] as const;
export const RAMPUP_SOURCES = ['manual', 'import'] as const;
export const REX_CATEGORIES = ['technical', 'schedule', 'cost', 'hse', 'organisation', 'supplier', 'regulatory', 'other'] as const;
export const SAGE_SOURCES = ['upload', 'folder', 'demo'] as const;
export const SAGE_LINE_KINDS = ['order', 'invoice', 'credit'] as const;

// ── Shapes ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** "2026-10". */
export const MONTH_RE = '^[0-9]{4}-(0[1-9]|1[0-2])$';
/** ISO 4217 / ISO 3166 codes, upper case. */
export const CURRENCY_RE = '^[A-Z]{3}$';
export const COUNTRY_RE = '^[A-Z]{2}$';

// ── Builders ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const lit = (v: string | number) => (typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

/** Every domain CHECK declared by the schema (name → values), compared with the database by formats.test.ts. */
export const DOMAIN_CHECKS = new Map<string, readonly (string | number)[]>();

/** The column takes one of the values (null passes). */
export function oneOf(name: string, col: PgColumn, values: readonly (string | number)[]) {
  DOMAIN_CHECKS.set(name, values);
  return check(name, sql`${col} in (${sql.raw(values.map(lit).join(', '))})`);
}

/** A name or a text that is not blank. */
export const filled = (name: string, col: PgColumn) => check(name, sql`length(btrim(${col})) > 0`);

/** The text matches a POSIX regular expression. */
export const shaped = (name: string, col: PgColumn, re: string) => check(name, sql`${col} ~ ${sql.raw(lit(re))}`);

/** lo ≤ col ≤ hi (a bound may be null: no bound). */
export function within(name: string, col: PgColumn, lo: number | null, hi: number | null) {
  if (lo != null && hi != null) return check(name, sql`${col} between ${sql.raw(String(lo))} and ${sql.raw(String(hi))}`);
  if (lo != null) return check(name, sql`${col} >= ${sql.raw(String(lo))}`);
  return check(name, sql`${col} <= ${sql.raw(String(hi))}`);
}

/** Any other rule between columns. */
export const rule = (name: string, expr: SQL) => check(name, expr);

/** The columns are all null or all filled (an amount as typed in a currency, with the currency and its rate). */
export const together = (name: string, ...cols: PgColumn[]) =>
  check(name, sql`(${sql.join(cols.map((c) => sql`(${c} is null)::int`), sql` + `)}) in (0, ${sql.raw(String(cols.length))})`);
