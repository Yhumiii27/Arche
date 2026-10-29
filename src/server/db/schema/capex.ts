// CAPEX (docs/spec/02-objets.md §3–4): identity and status (delivery 1); the cycle, lots, budget versions, risks and
// decisions (delivery 2). Dossiers, circuits and changes come with delivery 3 (new migrations).
import { boolean, date, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, keur, rowVersion, timestamps } from './_common';
import { sites, subsidiaries, users } from './organisation';

export type CapexStatus = 'draft' | 'active' | 'on_hold' | 'closed' | 'abandoned';
export type CapexPhase = 'cadrage' | 'avant_projet' | 'execution' | 'demarrage';
export type Typology = 'light' | 'strategic';
export type InvestmentType = 'new_plant' | 'new_line' | 'extension' | 'other';
export type CapexRole = 'lead' | 'controller' | 'co_dig' | 'epc2i_pmo' | 'internal_client' | 'member';

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
  typologySource: text('typology_source').$type<'computed' | 'forced'>(),
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
});

/** Named CAPEX team (docs/spec/02 §3). */
export const capexMembers = arche.table('capex_members', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  capexRole: text('capex_role').$type<CapexRole>().notNull(),
  ...timestamps,
}, (t) => [unique('capex_members_uq').on(t.capexId, t.userId, t.capexRole)]);

export type GateCode = 'G1' | 'G2' | 'K3' | 'G3';
export type GateDecision = 'go' | 'go_with_conditions' | 'deferred' | 'no_go';
export type EstimateClass = 'E50' | 'E30' | 'E10';
export type BudgetStatus = 'draft' | 'submitted' | 'validated' | 'superseded';

/** DIG-PRODI model versions (spec 03): the structure ships with the code, the stored definition holds the adjustable values. */
export const lifecycleModels = arche.table('lifecycle_models', {
  code: text('code').notNull(),
  version: text('version').notNull(),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  active: boolean('active').notNull().default(true),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('lifecycle_models_uq').on(t.code, t.version)]);

/** Lots of a CAPEX (N-12); `epc2i` lots (machines) are fed by the EPC2i projects. */
export const capexLots = arche.table('capex_lots', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  epc2i: boolean('epc2i').notNull().default(false),
  /** Planned window of the lot ("2026-10"), over which its budget is spread evenly (S-curve, delivery 5). */
  plannedStart: text('planned_start'),
  plannedEnd: text('planned_end'),
  ...timestamps,
  /** Asset class of the lot (AR-050); null: the class of its kind. */
  assetClassCode: text('asset_class_code'),
}, (t) => [unique('capex_lots_number_uq').on(t.capexId, t.number)]);

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
}, (t) => [unique('budget_versions_number_uq').on(t.capexId, t.number)]);

/** Central amount of a lot in a version (k€); range = class × central. */
export const budgetLines = arche.table('budget_lines', {
  budgetVersionId: uuid('budget_version_id').notNull().references(() => budgetVersions.id, { onDelete: 'cascade' }),
  lotId: uuid('lot_id').notNull().references(() => capexLots.id),
  amountKeur: keur('amount_keur').notNull(),
  /** As typed in the subsidiary's currency (AR-039): thousands, the currency and the rate applied (units per euro); null when typed in k€. */
  amountLocal: keur('amount_local'),
  currency: text('currency'),
  rate: keur('rate'),
}, (t) => [unique('budget_lines_uq').on(t.budgetVersionId, t.lotId)]);

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
}, (t) => [unique('risks_number_uq').on(t.capexId, t.number)]);

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
}, (t) => [unique('decisions_number_uq').on(t.capexId, t.number)]);

/** One row per session of a gate; a "deferred" decision opens a new session (spec 02 §4). */
export const gates = arche.table('gates', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  code: text('code').$type<GateCode>().notNull(),
  session: integer('session').notNull(),
  status: text('status').$type<'open' | 'submitted' | 'in_review' | 'decided' | 'returned'>().notNull().default('open'),
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
}, (t) => [unique('gates_session_uq').on(t.capexId, t.code, t.session)]);

/** Snapshot of the criteria when the gate was decided. */
export const gateCriteriaResults = arche.table('gate_criteria_results', {
  gateId: uuid('gate_id').notNull().references(() => gates.id, { onDelete: 'cascade' }),
  criterionCode: text('criterion_code').notNull(),
  state: text('state').$type<'met' | 'unmet' | 'forced' | 'not_evaluated'>().notNull(),
  value: text('value'),
  forcedReason: text('forced_reason'),
}, (t) => [unique('gate_criteria_results_uq').on(t.gateId, t.criterionCode)]);

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
});

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
}, (t) => [index('phase_transitions_capex_idx').on(t.capexId)]);
