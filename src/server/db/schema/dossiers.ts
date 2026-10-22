// Living dossiers, gate circuits, signatures, management of change, business plan and delegation matrix (docs/spec/02 §3–4,
// 04, 05; delivery 3).
import { boolean, date, index, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { capex, gates } from './capex';
import { users } from './organisation';

/** One dossier per kind and per CAPEX: `business_case` (G1), `investment` (G2), `transfer` (G3). */
export const dossiers = arche.table('dossiers', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'business_case' | 'investment' | 'transfer'>().notNull(),
  ...timestamps,
}, (t) => [unique('dossiers_capex_kind_uq').on(t.capexId, t.kind)]);

/**
 * Versions of a dossier: a draft is edited; freezing copies the computed values in and fixes the SHA-256 of the canonical
 * content — a frozen version never changes (a change makes the next version).
 */
export const dossierVersions = arche.table('dossier_versions', {
  id: id(),
  dossierId: uuid('dossier_id').notNull().references(() => dossiers.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  state: text('state').$type<'draft' | 'frozen' | 'approved' | 'rejected' | 'superseded'>().notNull().default('draft'),
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
}, (t) => [unique('dossier_versions_number_uq').on(t.dossierId, t.number)]);

/** Steps of a gate session's circuit, instantiated from the model (src/domain/circuits.ts). */
export const circuitSteps = arche.table('circuit_steps', {
  id: id(),
  gateId: uuid('gate_id').notNull().references(() => gates.id),
  position: integer('position').notNull(),
  group: integer('group_no').notNull(),
  kind: text('kind').notNull(),
  /** Profile that acts, or `internal_client`. */
  actor: text('actor').notNull(),
  speciality: text('speciality'),
  label: text('label').notNull(),
  optional: boolean('optional').notNull().default(false),
  decides: boolean('decides').notNull().default(false),
  /** A person named on the step (an expert chosen by the project lead); null = whoever holds the profile. */
  assigneeUserId: uuid('assignee_user_id').references(() => users.id),
  status: text('status').$type<'waiting' | 'open' | 'done' | 'cancelled'>().notNull().default('waiting'),
  openedOn: date('opened_on', { mode: 'string' }),
  dueOn: date('due_on', { mode: 'string' }),
  outcome: text('outcome'),
  comment: text('comment'),
  actedByName: text('acted_by_name'),
  actedByUserId: uuid('acted_by_user_id').references(() => users.id),
  actedAt: timestamp('acted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [index('circuit_steps_gate_idx').on(t.gateId)]);

/** Proof of a simple signature (spec 05 §3). Append-only (database trigger). */
export const signatures = arche.table('signatures', {
  id: id(),
  circuitStepId: uuid('circuit_step_id').notNull().references(() => circuitSteps.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  level: text('level').$type<'simple' | 'advanced'>().notNull().default('simple'),
  /** SHA-256 of the frozen dossier version signed (null at K3, which has no dossier). */
  contentHash: text('content_hash'),
  /** The statement the signer confirmed. */
  statement: text('statement').notNull(),
  /** When the signer last entered their credentials (null in demo mode). */
  authTime: timestamp('auth_time', { withTimezone: true }),
  ipHash: text('ip_hash'),
  providerRef: text('provider_ref'),
});

/** Management of change after G2 (spec 05 §5): routed to the decider of the delegation matrix in force. */
export const changes = arche.table('changes', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  kind: text('kind').notNull(),
  amountKeur: keur('amount_keur').notNull().default(0),
  delayDays: integer('delay_days').notNull().default(0),
  status: text('status').$type<'submitted' | 'approved' | 'rejected'>().notNull().default('submitted'),
  requiredDecider: text('required_decider').notNull(),
  /** `valid_from` of the matrix the change was judged with. */
  matrixValidFrom: date('matrix_valid_from', { mode: 'string' }),
  decisionReason: text('decision_reason'),
  decidedByName: text('decided_by_name'),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('changes_number_uq').on(t.capexId, t.number)]);

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
});

/** Delegation matrices, dated: a change is judged with the matrix in force when it is submitted (C-4). */
export const delegationMatrices = arche.table('delegation_matrices', {
  validFrom: date('valid_from', { mode: 'string' }).primaryKey(),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  updatedByName: text('updated_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
