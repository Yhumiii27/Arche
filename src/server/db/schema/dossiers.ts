// Living dossiers, gate circuits, signatures, management of change, business plan and delegation matrix (docs/spec/02 §3–4,
// 04, 05; delivery 3).
import { boolean, date, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, rowVersion, timestamps } from './_common';
import { capex, gates } from './capex';
import { users } from './organisation';
import {
  CHANGE_KINDS, CHANGE_STATUSES, DECIDER_LEVELS, DOSSIER_KINDS, DOSSIER_STATES, EXPERT_SPECIALITIES, SIGNATURE_LEVELS, SIGNATURE_PROVIDERS,
  SIGNATURE_REQUEST_STATUSES, STEP_ACTORS, STEP_KINDS, STEP_OUTCOMES, STEP_STATUSES, filled, oneOf, rule, within, type OneOf,
} from './_checks';

/** One dossier per kind and per CAPEX: `business_case` (G1), `investment` (G2), `transfer` (G3). */
export const dossiers = arche.table('dossiers', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<OneOf<typeof DOSSIER_KINDS>>().notNull(),
  ...timestamps,
}, (t) => [unique('dossiers_capex_kind_uq').on(t.capexId, t.kind), oneOf('dossiers_kind_domain', t.kind, DOSSIER_KINDS)]);

/**
 * Versions of a dossier: a draft is edited; freezing copies the computed values in and fixes the SHA-256 of the canonical
 * content — a frozen version never changes (a change makes the next version).
 */
export const dossierVersions = arche.table('dossier_versions', {
  id: id(),
  dossierId: uuid('dossier_id').notNull().references(() => dossiers.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  state: text('state').$type<OneOf<typeof DOSSIER_STATES>>().notNull().default('draft'),
  /** Sections typed (text and Codex references). */
  content: jsonb('content').$type<Record<string, unknown>>().notNull(),
  /** Values computed by Arche, copied in when frozen (budget, risks, team, typology, business plan). */
  computed: jsonb('computed').$type<Record<string, unknown>>(),
  completenessPct: integer('completeness_pct').notNull().default(0),
  contentHash: text('content_hash'),
  frozenAt: timestamp('frozen_at', { withTimezone: true }),
  frozenByName: text('frozen_by_name'),
  frozenByUserId: uuid('frozen_by_user_id').references(() => users.id),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
  rowVersion: rowVersion(),
  /** Version of the dossier's template its sections follow (AR-052); null = the built-in sections. */
  templateVersion: integer('template_version'),
  /** Codex document holding the PDF of this frozen version, once deposited from Arche (CX-03; Arche keeps no file). */
  codexDocumentId: text('codex_document_id'),
  codexDepositedAt: timestamp('codex_deposited_at', { withTimezone: true }),
  codexDepositedByName: text('codex_deposited_by_name'),
}, (t) => [
  unique('dossier_versions_number_uq').on(t.dossierId, t.number),
  within('dossier_versions_number_positive', t.number, 1, null),
  oneOf('dossier_versions_state_domain', t.state, DOSSIER_STATES),
  within('dossier_versions_completeness_range', t.completenessPct, 0, 100),
  rule('dossier_versions_frozen_hashed', sql`${t.state} in ('draft', 'superseded') or (${t.contentHash} is not null and ${t.frozenAt} is not null)`),
  rule('dossier_versions_hash_shape', sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`),
  within('dossier_versions_template_version_positive', t.templateVersion, 1, null),
  filled('dossier_versions_created_by_filled', t.createdByName),
]);

/** Steps of a gate session's circuit, instantiated from the model (src/domain/circuits.ts). */
export const circuitSteps = arche.table('circuit_steps', {
  id: id(),
  gateId: uuid('gate_id').notNull().references(() => gates.id),
  position: integer('position').notNull(),
  group: integer('group_no').notNull(),
  kind: text('kind').$type<OneOf<typeof STEP_KINDS>>().notNull(),
  /** Profile that acts, or `internal_client`. */
  actor: text('actor').$type<OneOf<typeof STEP_ACTORS>>().notNull(),
  speciality: text('speciality').$type<OneOf<typeof EXPERT_SPECIALITIES>>(),
  label: text('label').notNull(),
  optional: boolean('optional').notNull().default(false),
  decides: boolean('decides').notNull().default(false),
  /** A person named on the step (an expert chosen by the project lead); null = whoever holds the profile. */
  assigneeUserId: uuid('assignee_user_id').references(() => users.id),
  status: text('status').$type<OneOf<typeof STEP_STATUSES>>().notNull().default('waiting'),
  openedOn: date('opened_on', { mode: 'string' }),
  dueOn: date('due_on', { mode: 'string' }),
  outcome: text('outcome'),
  comment: text('comment'),
  actedByName: text('acted_by_name'),
  actedByUserId: uuid('acted_by_user_id').references(() => users.id),
  actedAt: timestamp('acted_at', { withTimezone: true }),
  ...timestamps,
  rowVersion: rowVersion(),
  /** The absent person the actor stood in for (AR-041); null when they acted in their own name. */
  onBehalfOfName: text('on_behalf_of_name'),
}, (t) => [
  index('circuit_steps_gate_idx').on(t.gateId),
  within('circuit_steps_position_non_negative', t.position, 0, null),
  within('circuit_steps_group_positive', t.group, 1, null),
  oneOf('circuit_steps_kind_domain', t.kind, STEP_KINDS),
  oneOf('circuit_steps_actor_domain', t.actor, STEP_ACTORS),
  oneOf('circuit_steps_speciality_domain', t.speciality, EXPERT_SPECIALITIES),
  filled('circuit_steps_label_filled', t.label),
  oneOf('circuit_steps_status_domain', t.status, STEP_STATUSES),
  oneOf('circuit_steps_outcome_domain', t.outcome, STEP_OUTCOMES),
  rule('circuit_steps_done_has_outcome', sql`${t.status} <> 'done' or ${t.outcome} is not null`),
]);

/** Proof of a simple signature (spec 05 §3). Append-only (database trigger). */
export const signatures = arche.table('signatures', {
  id: id(),
  circuitStepId: uuid('circuit_step_id').notNull().references(() => circuitSteps.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  level: text('level').$type<OneOf<typeof SIGNATURE_LEVELS>>().notNull().default('simple'),
  /** SHA-256 of the frozen dossier version signed (null at K3, which has no dossier). */
  contentHash: text('content_hash'),
  /** The statement the signer confirmed. */
  statement: text('statement').notNull(),
  /** When the signer last entered their credentials (null in demo mode). */
  authTime: timestamp('auth_time', { withTimezone: true }),
  ipHash: text('ip_hash'),
  providerRef: text('provider_ref'),
}, (t) => [
  oneOf('signatures_level_domain', t.level, SIGNATURE_LEVELS),
  filled('signatures_user_name_filled', t.userName),
  filled('signatures_statement_filled', t.statement),
  rule('signatures_hash_shape', sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`),
]);

/** Management of change after G2 (spec 05 §5): routed to the decider of the delegation matrix in force. */
export const changes = arche.table('changes', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  kind: text('kind').$type<OneOf<typeof CHANGE_KINDS>>().notNull(),
  amountKeur: keur('amount_keur').notNull().default(0),
  delayDays: integer('delay_days').notNull().default(0),
  status: text('status').$type<OneOf<typeof CHANGE_STATUSES>>().notNull().default('submitted'),
  requiredDecider: text('required_decider').$type<OneOf<typeof DECIDER_LEVELS>>().notNull(),
  /** `valid_from` of the matrix the change was judged with. */
  matrixValidFrom: date('matrix_valid_from', { mode: 'string' }),
  decisionReason: text('decision_reason'),
  decidedByName: text('decided_by_name'),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('changes_number_uq').on(t.capexId, t.number),
  within('changes_number_positive', t.number, 1, null),
  filled('changes_title_filled', t.title),
  oneOf('changes_kind_domain', t.kind, CHANGE_KINDS),
  within('changes_delay_range', t.delayDays, 0, 3650),
  oneOf('changes_status_domain', t.status, CHANGE_STATUSES),
  oneOf('changes_decider_domain', t.requiredDecider, DECIDER_LEVELS),
  rule('changes_decided_dated', sql`${t.status} = 'submitted' or ${t.decidedAt} is not null`),
  filled('changes_created_by_filled', t.createdByName),
]);

/**
 * Advanced signatures asked of a provider (AR-037, C-7): the G2 / AFE signature goes through Yousign (or its simulation). The
 * signer's choices wait here while they sign at the provider; once signed, the step is completed with them and the
 * signature row carries the provider's reference. Arche keeps no file: the signed PDF and its proof stay at the provider.
 */
export const signatureRequests = arche.table('signature_requests', {
  id: id(),
  circuitStepId: uuid('circuit_step_id').notNull().references(() => circuitSteps.id),
  provider: text('provider').$type<OneOf<typeof SIGNATURE_PROVIDERS>>().notNull(),
  /** creating → pending (at the provider) → completed (step done); or declined, expired, cancelled, failed. */
  status: text('status').$type<OneOf<typeof SIGNATURE_REQUEST_STATUSES>>().notNull().default('creating'),
  /** The last status read at the provider (pending, signed, declined, expired, cancelled). */
  providerStatus: text('provider_status'),
  providerRef: text('provider_ref'),
  signerRef: text('signer_ref'),
  documentRef: text('document_ref'),
  signingUrl: text('signing_url'),
  /** What the signer chose in Arche: outcome, comment, conditions, criteria forced with their reason. */
  input: jsonb('input').$type<{ outcome: string; comment: string | null; conditions: string[]; forced: Record<string, string> }>().notNull(),
  statement: text('statement').notNull(),
  contentHash: text('content_hash'),
  signerUserId: uuid('signer_user_id').notNull().references(() => users.id),
  signerName: text('signer_name').notNull(),
  onBehalfOfName: text('on_behalf_of_name'),
  error: text('error'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index('signature_requests_step_idx').on(t.circuitStepId),
  oneOf('signature_requests_provider_domain', t.provider, SIGNATURE_PROVIDERS),
  oneOf('signature_requests_status_domain', t.status, SIGNATURE_REQUEST_STATUSES),
  filled('signature_requests_statement_filled', t.statement),
  filled('signature_requests_signer_name_filled', t.signerName),
  rule('signature_requests_completed_dated', sql`${t.status} <> 'completed' or ${t.completedAt} is not null`),
]);

/** Business plan of a CAPEX (N-11): yearly flows, discount rate; prepared by the controller, validated by the group CFO. */
export const businessPlans = arche.table('business_plans', {
  capexId: uuid('capex_id').primaryKey().references(() => capex.id, { onDelete: 'cascade' }),
  horizonYears: integer('horizon_years').notNull(),
  discountRatePct: keur('discount_rate_pct').notNull(),
  flows: jsonb('flows').$type<{ year: number; capexKeur: number; opexKeur: number; revenueKeur: number }[]>().notNull(),
  updatedByName: text('updated_by_name').notNull(),
  validatedByName: text('validated_by_name'),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  within('business_plans_horizon_range', t.horizonYears, 1, 50),
  within('business_plans_discount_range', t.discountRatePct, 0, 50),
  filled('business_plans_updated_by_filled', t.updatedByName),
]);

/** Delegation matrices, dated: a change is judged with the matrix in force when it is submitted (C-4). */
export const delegationMatrices = arche.table('delegation_matrices', {
  validFrom: date('valid_from', { mode: 'string' }).primaryKey(),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  updatedByName: text('updated_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [filled('delegation_matrices_updated_by_filled', t.updatedByName)]);
