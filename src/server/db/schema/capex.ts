// CAPEX (docs/spec/02-objets.md §3–4): identity and status (delivery 1); the cycle, lots, budget versions, risks and
// decisions (delivery 2). Dossiers, circuits and changes come with delivery 3 (new migrations).
import { boolean, date, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, rowVersion, timestamps } from './_common';
import { sites, subsidiaries, users } from './organisation';
import {
  BUDGET_STATUSES, CAPEX_STATUSES, CRITERION_STATES, CURRENCY_RE, DECISION_BODIES, ESTIMATE_CLASSES, GATE_DECISIONS, GATE_STATUSES,
  GATES, INVESTMENT_TYPES, LOT_KINDS, MONTH_RE, PHASES, RISK_CATEGORIES, RISK_STATUSES, TEAM_ROLES, TYPOLOGIES, TYPOLOGY_SOURCES,
  filled, oneOf, rule, shaped, together, within, type OneOf,
} from './_checks';

export type CapexStatus = OneOf<typeof CAPEX_STATUSES>;
export type CapexPhase = OneOf<typeof PHASES>;
export type Typology = OneOf<typeof TYPOLOGIES>;
export type InvestmentType = OneOf<typeof INVESTMENT_TYPES>;
export type CapexRole = OneOf<typeof TEAM_ROLES>;

export const capex = arche.table('capex', {
  id: id(),
  /** "CPX-APM-2026-01" (N-9). */
  code: text('code').notNull().unique(),
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  siteId: uuid('site_id').references(() => sites.id),
  title: text('title').notNull(),
  description: text('description'),
  investmentType: text('investment_type').$type<InvestmentType>().notNull(),
  status: text('status').$type<CapexStatus>().notNull().default('draft'),
  phase: text('phase').$type<CapexPhase>().notNull().default('cadrage'),
  typology: text('typology').$type<Typology>(),
  /** `computed` (budget / reference revenue, C-5) or `forced` by the group industrial director with a reason. */
  typologySource: text('typology_source').$type<OneOf<typeof TYPOLOGY_SOURCES>>(),
  typologyReason: text('typology_reason'),
  /** A recomputed typology that differs from the current one, waiting for the group industrial director's confirmation. */
  typologyProposed: text('typology_proposed').$type<Typology>(),
  /** Version of the DIG-PRODI model the CAPEX was opened with ("4.0"). */
  lifecycleModelVersion: text('lifecycle_model_version'),
  needDate: date('need_date', { mode: 'string' }),
  mesStartedOn: date('mes_started_on', { mode: 'string' }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  sponsorUserId: uuid('sponsor_user_id').references(() => users.id),
  leadUserId: uuid('lead_user_id').references(() => users.id),
  ...timestamps,
  /** Takeover of a CAPEX already in progress (N-20, pilot): when and by whom it was opened in its current phase. */
  takenOverAt: timestamp('taken_over_at', { withTimezone: true }),
  takenOverByName: text('taken_over_by_name'),
  rowVersion: rowVersion(),
}, (t) => [
  shaped('capex_code_shape', t.code, '^CPX-[A-Z]{3}-[0-9]{4}-[0-9]{2,}$'),
  rule('capex_code_of_subsidiary', sql`substr(${t.code}, 5, 4) = ${t.subsidiaryCode} || '-'`),
  filled('capex_title_filled', t.title),
  oneOf('capex_investment_type_domain', t.investmentType, INVESTMENT_TYPES),
  oneOf('capex_status_domain', t.status, CAPEX_STATUSES),
  oneOf('capex_phase_domain', t.phase, PHASES),
  oneOf('capex_typology_domain', t.typology, TYPOLOGIES),
  oneOf('capex_typology_source_domain', t.typologySource, TYPOLOGY_SOURCES),
  oneOf('capex_typology_proposed_domain', t.typologyProposed, TYPOLOGIES),
  rule('capex_forced_typology_reason', sql`${t.typologySource} is distinct from 'forced' or length(btrim(${t.typologyReason})) > 0`),
  together('capex_taken_over_together', t.takenOverAt, t.takenOverByName),
]);

/** Named CAPEX team (docs/spec/02 §3). */
export const capexMembers = arche.table('capex_members', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  capexRole: text('capex_role').$type<CapexRole>().notNull(),
  ...timestamps,
}, (t) => [unique('capex_members_uq').on(t.capexId, t.userId, t.capexRole), oneOf('capex_members_role_domain', t.capexRole, TEAM_ROLES)]);

export type GateCode = OneOf<typeof GATES>;
export type GateDecision = OneOf<typeof GATE_DECISIONS>;
export type EstimateClass = OneOf<typeof ESTIMATE_CLASSES>;
export type BudgetStatus = OneOf<typeof BUDGET_STATUSES>;

/** DIG-PRODI model versions (spec 03): the structure ships with the code, the stored definition holds the adjustable values. */
export const lifecycleModels = arche.table('lifecycle_models', {
  code: text('code').notNull(),
  version: text('version').notNull(),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  active: boolean('active').notNull().default(true),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('lifecycle_models_uq').on(t.code, t.version),
  filled('lifecycle_models_code_filled', t.code),
  filled('lifecycle_models_version_filled', t.version),
  filled('lifecycle_models_updated_by_filled', t.updatedByName),
]);

/** Lots of a CAPEX (N-12); machine lots (`fromKeystone`, column `epc2i` kept: a stored name
 * Matrix's catalogue reads, renamed with Matrix, docs/DEMANDES-MATRIX.md M-16) are fed by the Keystone projects. */
export const capexLots = arche.table('capex_lots', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  fromKeystone: boolean('epc2i').notNull().default(false),
  /** Planned window of the lot ("2026-10"), over which its budget is spread evenly (S-curve, delivery 5). */
  plannedStart: text('planned_start'),
  plannedEnd: text('planned_end'),
  ...timestamps,
  /** Asset class of the lot (AR-050); null: the class of its kind. */
  assetClassCode: text('asset_class_code'),
  /** Sage analytic code of the lot (AR-047): the extraction's lines with this code go to the lot. */
  sageCode: text('sage_code'),
}, (t) => [
  unique('capex_lots_number_uq').on(t.capexId, t.number),
  within('capex_lots_number_positive', t.number, 1, null),
  oneOf('capex_lots_kind_domain', t.kind, LOT_KINDS),
  filled('capex_lots_title_filled', t.title),
  shaped('capex_lots_planned_start_shape', t.plannedStart, MONTH_RE),
  shaped('capex_lots_planned_end_shape', t.plannedEnd, MONTH_RE),
  rule('capex_lots_planned_order', sql`${t.plannedStart} is null or ${t.plannedEnd} is null or ${t.plannedEnd} >= ${t.plannedStart}`),
]);

/** Budget versions: the precision funnel E50 → E30 → E10 (spec 03 §5); a validated version is frozen. */
export const budgetVersions = arche.table('budget_versions', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  estimateClass: text('estimate_class').$type<EstimateClass>().notNull(),
  status: text('status').$type<BudgetStatus>().notNull().default('draft'),
  basis: text('basis'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  validatedByName: text('validated_by_name'),
  validatedByUserId: uuid('validated_by_user_id').references(() => users.id),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  /** The E10 version validated at G2 (baseline). */
  isG2Baseline: boolean('is_g2_baseline').notNull().default(false),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
  rowVersion: rowVersion(),
}, (t) => [
  unique('budget_versions_number_uq').on(t.capexId, t.number),
  within('budget_versions_number_positive', t.number, 1, null),
  oneOf('budget_versions_class_domain', t.estimateClass, ESTIMATE_CLASSES),
  oneOf('budget_versions_status_domain', t.status, BUDGET_STATUSES),
  filled('budget_versions_created_by_filled', t.createdByName),
]);

/** Central amount of a lot in a version (k€); range = class × central. */
export const budgetLines = arche.table('budget_lines', {
  budgetVersionId: uuid('budget_version_id').notNull().references(() => budgetVersions.id, { onDelete: 'cascade' }),
  lotId: uuid('lot_id').notNull().references(() => capexLots.id),
  amountKeur: keur('amount_keur').notNull(),
  /** As typed in the subsidiary's currency (AR-039): thousands, the currency and the rate applied (units per euro); null when typed in k€. */
  amountLocal: keur('amount_local'),
  currency: text('currency'),
  rate: keur('rate'),
}, (t) => [
  unique('budget_lines_uq').on(t.budgetVersionId, t.lotId),
  within('budget_lines_amount_non_negative', t.amountKeur, 0, null),
  within('budget_lines_local_non_negative', t.amountLocal, 0, null),
  shaped('budget_lines_currency_shape', t.currency, CURRENCY_RE),
  rule('budget_lines_rate_positive', sql`${t.rate} > 0`),
  together('budget_lines_currency_rate_together', t.currency, t.rate),
  rule('budget_lines_local_has_currency', sql`${t.amountLocal} is null or ${t.currency} is not null`),
]);

export const risks = arche.table('risks', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  probability: integer('probability').notNull(),
  impact: integer('impact').notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  response: text('response'),
  status: text('status').notNull().default('open'),
  dueOn: date('due_on', { mode: 'string' }),
  ...timestamps,
}, (t) => [
  unique('risks_number_uq').on(t.capexId, t.number),
  within('risks_number_positive', t.number, 1, null),
  filled('risks_title_filled', t.title),
  oneOf('risks_category_domain', t.category, RISK_CATEGORIES),
  within('risks_probability_range', t.probability, 1, 4),
  within('risks_impact_range', t.impact, 1, 4),
  oneOf('risks_status_domain', t.status, RISK_STATUSES),
]);

/** Decisions register of a CAPEX; gate decisions are written here too. */
export const decisions = arche.table('decisions', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  takenOn: date('taken_on', { mode: 'string' }).notNull(),
  body: text('body').notNull(),
  text: text('text').notNull(),
  gateId: uuid('gate_id'),
  recordedByName: text('recorded_by_name').notNull(),
  ...timestamps,
  /** The review that took the decision (delivery 5). */
  reviewId: uuid('review_id'),
}, (t) => [
  unique('decisions_number_uq').on(t.capexId, t.number),
  within('decisions_number_positive', t.number, 1, null),
  oneOf('decisions_body_domain', t.body, DECISION_BODIES),
  filled('decisions_text_filled', t.text),
  filled('decisions_recorded_by_filled', t.recordedByName),
]);

/** One row per session of a gate; a "deferred" decision opens a new session (spec 02 §4). */
export const gates = arche.table('gates', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  code: text('code').$type<GateCode>().notNull(),
  session: integer('session').notNull(),
  status: text('status').$type<OneOf<typeof GATE_STATUSES>>().notNull().default('open'),
  decision: text('decision').$type<GateDecision>(),
  decisionReason: text('decision_reason'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedByName: text('decided_by_name'),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
  dueAt: date('due_at', { mode: 'string' }),
  /** The frozen dossier version the session decides on (delivery 3; none at K3). */
  dossierVersionId: uuid('dossier_version_id'),
  ...timestamps,
  /** A gate passed before Arche, recorded at the takeover (N-20): no circuit, no signature; left out of the C-10 indicators. */
  takenOver: boolean('taken_over').notNull().default(false),
}, (t) => [
  unique('gates_session_uq').on(t.capexId, t.code, t.session),
  oneOf('gates_code_domain', t.code, GATES),
  within('gates_session_positive', t.session, 1, null),
  oneOf('gates_status_domain', t.status, GATE_STATUSES),
  oneOf('gates_decision_domain', t.decision, GATE_DECISIONS),
  rule('gates_decided_has_decision', sql`${t.status} <> 'decided' or ${t.decision} is not null`),
]);

/** Snapshot of the criteria when the gate was decided. */
export const gateCriteriaResults = arche.table('gate_criteria_results', {
  gateId: uuid('gate_id').notNull().references(() => gates.id, { onDelete: 'cascade' }),
  criterionCode: text('criterion_code').notNull(),
  state: text('state').$type<OneOf<typeof CRITERION_STATES>>().notNull(),
  value: text('value'),
  forcedReason: text('forced_reason'),
}, (t) => [
  unique('gate_criteria_results_uq').on(t.gateId, t.criterionCode),
  filled('gate_criteria_results_code_filled', t.criterionCode),
  oneOf('gate_criteria_results_state_domain', t.state, CRITERION_STATES),
]);

/** Conditions of a "Go with conditions". */
export const gateConditions = arche.table('gate_conditions', {
  id: id(),
  gateId: uuid('gate_id').notNull().references(() => gates.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  text: text('text').notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  dueOn: date('due_on', { mode: 'string' }),
  closedOn: date('closed_on', { mode: 'string' }),
  ...timestamps,
}, (t) => [within('gate_conditions_number_positive', t.number, 1, null), filled('gate_conditions_text_filled', t.text)]);

/** History of the cycle (opening, gates, suspension, resumption). */
export const phaseTransitions = arche.table('phase_transitions', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status').notNull(),
  fromPhase: text('from_phase').notNull(),
  toStatus: text('to_status').notNull(),
  toPhase: text('to_phase').notNull(),
  gateCode: text('gate_code').$type<GateCode>(),
  effectiveOn: date('effective_on', { mode: 'string' }).notNull(),
  forced: boolean('forced').notNull().default(false),
  reason: text('reason'),
  byName: text('by_name').notNull(),
  byUserId: uuid('by_user_id').references(() => users.id),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('phase_transitions_capex_idx').on(t.capexId),
  oneOf('phase_transitions_from_status_domain', t.fromStatus, CAPEX_STATUSES),
  oneOf('phase_transitions_from_phase_domain', t.fromPhase, PHASES),
  oneOf('phase_transitions_to_status_domain', t.toStatus, CAPEX_STATUSES),
  oneOf('phase_transitions_to_phase_domain', t.toPhase, PHASES),
  oneOf('phase_transitions_gate_domain', t.gateCode, GATES),
  filled('phase_transitions_by_filled', t.byName),
]);
