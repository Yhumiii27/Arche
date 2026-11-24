// Delivery and safety of a CAPEX (docs/spec/02 §3; delivery 5): the permits register, the subsidiary's part of the engineering
// pack, the safety milestones declared by the group HSE (N-13) and the monthly committed / spent / physical % of the lots
// (N-14). Documents stay in Codex: only their references are kept.
import { date, index, integer, jsonb, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { capex, capexLots } from './capex';
import {
  ACTUAL_SOURCES, CAPEX_STATUSES, CURRENCY_RE, HS_CODES, HS_SOURCES, HS_STATUSES, MONTH_RE, PACK_ITEM_STATUSES, PERMIT_KINDS, PERMIT_STATUSES,
  PHASES, REVIEW_KINDS, SYNC_SOURCES, filled, oneOf, rule, shaped, together, within, type OneOf,
} from './_checks';

export const authorizations = arche.table('authorizations', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  kind: text('kind').$type<OneOf<typeof PERMIT_KINDS>>().notNull(),
  title: text('title').notNull(),
  authority: text('authority'),
  status: text('status').$type<OneOf<typeof PERMIT_STATUSES>>().notNull().default('to_file'),
  filedOn: date('filed_on', { mode: 'string' }),
  dueOn: date('due_on', { mode: 'string' }),
  obtainedOn: date('obtained_on', { mode: 'string' }),
  /** Codex reference of the permit file. */
  codexRef: text('codex_ref'),
  note: text('note'),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('authorizations_number_uq').on(t.capexId, t.number),
  within('authorizations_number_positive', t.number, 1, null),
  oneOf('authorizations_kind_domain', t.kind, PERMIT_KINDS),
  filled('authorizations_title_filled', t.title),
  oneOf('authorizations_status_domain', t.status, PERMIT_STATUSES),
  filled('authorizations_updated_by_filled', t.updatedByName),
]);

/** Subsidiary's part of the engineering pack: one row per item of the standard list that has been touched. */
export const packItems = arche.table('pack_items', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  itemCode: text('item_code').notNull(),
  status: text('status').$type<OneOf<typeof PACK_ITEM_STATUSES>>().notNull().default('expected'),
  codexRef: text('codex_ref'),
  validatedOn: date('validated_on', { mode: 'string' }),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('pack_items_uq').on(t.capexId, t.itemCode),
  filled('pack_items_code_filled', t.itemCode),
  oneOf('pack_items_status_domain', t.status, PACK_ITEM_STATUSES),
  filled('pack_items_updated_by_filled', t.updatedByName),
]);

/**
 * Safety milestones: declared by the group HSE until Vigie publishes them (then mirrored, `source = vigie`). The PSSR discharge
 * (quitus) is a step of the G3 circuit (src/domain/circuits.ts), not a column here.
 */
export const hsStatuses = arche.table('hs_statuses', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  hsCode: text('hs_code').$type<OneOf<typeof HS_CODES>>().notNull(),
  status: text('status').$type<OneOf<typeof HS_STATUSES>>().notNull().default('not_started'),
  /** Vigie or Codex reference of the evidence. */
  evidenceRef: text('evidence_ref'),
  source: text('source').$type<OneOf<typeof HS_SOURCES>>().notNull().default('declared'),
  passedOn: date('passed_on', { mode: 'string' }),
  note: text('note'),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('hs_statuses_uq').on(t.capexId, t.hsCode),
  oneOf('hs_statuses_code_domain', t.hsCode, HS_CODES),
  oneOf('hs_statuses_status_domain', t.status, HS_STATUSES),
  oneOf('hs_statuses_source_domain', t.source, HS_SOURCES),
  filled('hs_statuses_updated_by_filled', t.updatedByName),
]);

/**
 * Mirror of vigie.pub_etudes_securite (AR-033): the process safety studies Vigie holds, one row per study as Vigie publishes it
 * (French column names, parsed by src/domain/process-safety.ts). Written only by src/server/integrations/vigie/sync.ts.
 */
export const vigieStudies = arche.table('vigie_studies', {
  ref: text('ref').primaryKey(),
  capexCode: text('capex_code'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
}, (t) => [index('vigie_studies_capex_idx').on(t.capexCode), filled('vigie_studies_ref_filled', t.ref)]);

/** The last synchronisation of the Vigie mirror (one row per view). */
export const vigieSync = arche.table('vigie_sync', {
  view: text('view').primaryKey(),
  source: text('source').$type<OneOf<typeof SYNC_SOURCES>>().notNull(),
  rows: integer('rows').notNull().default(0),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
  error: text('error'),
}, (t) => [oneOf('vigie_sync_source_domain', t.source, SYNC_SOURCES), within('vigie_sync_rows_non_negative', t.rows, 0, null)]);

/** Values of a lot at the end of a month, cumulative (committed, spent, physical %); `keystone` rows are the EPC2i lots'. */
export const lotActuals = arche.table('lot_actuals', {
  lotId: uuid('lot_id').notNull().references(() => capexLots.id, { onDelete: 'cascade' }),
  /** "2026-10". */
  month: text('month').notNull(),
  committedKeur: keur('committed_keur'),
  spentKeur: keur('spent_keur'),
  physicalPct: keur('physical_pct'),
  source: text('source').$type<OneOf<typeof ACTUAL_SOURCES>>().notNull().default('manual'),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  /** As typed in the subsidiary's currency (AR-039): the amounts in thousands, the currency and the month's rate; null when typed in k€. */
  committedLocal: keur('committed_local'),
  spentLocal: keur('spent_local'),
  currency: text('currency'),
  rate: keur('rate'),
}, (t) => [
  primaryKey({ name: 'lot_actuals_pk', columns: [t.lotId, t.month] }),
  shaped('lot_actuals_month_shape', t.month, MONTH_RE),
  within('lot_actuals_committed_non_negative', t.committedKeur, 0, null),
  within('lot_actuals_spent_non_negative', t.spentKeur, 0, null),
  within('lot_actuals_physical_range', t.physicalPct, 0, 100),
  oneOf('lot_actuals_source_domain', t.source, ACTUAL_SOURCES),
  filled('lot_actuals_entered_by_filled', t.enteredByName),
  within('lot_actuals_committed_local_non_negative', t.committedLocal, 0, null),
  within('lot_actuals_spent_local_non_negative', t.spentLocal, 0, null),
  shaped('lot_actuals_currency_shape', t.currency, CURRENCY_RE),
  rule('lot_actuals_rate_positive', sql`${t.rate} > 0`),
  together('lot_actuals_currency_rate_together', t.currency, t.rate),
  rule('lot_actuals_local_has_currency', sql`(${t.committedLocal} is null and ${t.spentLocal} is null) or ${t.currency} is not null`),
]);

/**
 * Reviews held (docs/spec/06 §2, N-19): the project steering committees (cadence by typology) and the cross-functional audits
 * of Strategic CAPEX (one per phase); their decisions go to the decisions register (`decisions.review_id`).
 */
export const reviews = arche.table('reviews', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  kind: text('kind').$type<OneOf<typeof REVIEW_KINDS>>().notNull(),
  heldOn: date('held_on', { mode: 'string' }).notNull(),
  /** Phase of the CAPEX when the review was held (the audit of that phase). */
  phase: text('phase').notNull(),
  attendees: text('attendees').notNull(),
  summary: text('summary').notNull(),
  recordedByName: text('recorded_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('reviews_number_uq').on(t.capexId, t.number),
  within('reviews_number_positive', t.number, 1, null),
  oneOf('reviews_kind_domain', t.kind, REVIEW_KINDS),
  oneOf('reviews_phase_domain', t.phase, PHASES),
  filled('reviews_attendees_filled', t.attendees),
  filled('reviews_summary_filled', t.summary),
  filled('reviews_recorded_by_filled', t.recordedByName),
]);

/** Weekly picture of a CAPEX (spec 06 §5): the trends of the dashboards; one row per CAPEX and week (Monday). */
export const capexSnapshots = arche.table('capex_snapshots', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  week: date('week', { mode: 'string' }).notNull(),
  status: text('status').notNull(),
  phase: text('phase').notNull(),
  packPct: keur('pack_pct'),
  subsidiaryPackPct: keur('subsidiary_pack_pct'),
  epc2iPackPct: keur('epc2i_pack_pct'),
  bacKeur: keur('bac_keur'),
  pvKeur: keur('pv_keur'),
  evKeur: keur('ev_keur'),
  acKeur: keur('ac_keur'),
  eacKeur: keur('eac_keur'),
  spi: keur('spi'),
  cpi: keur('cpi'),
  alerts: integer('alerts').notNull().default(0),
  takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('capex_snapshots_uq').on(t.capexId, t.week),
  rule('capex_snapshots_week_monday', sql`extract(isodow from ${t.week}) = 1`),
  oneOf('capex_snapshots_status_domain', t.status, CAPEX_STATUSES),
  oneOf('capex_snapshots_phase_domain', t.phase, PHASES),
  within('capex_snapshots_alerts_non_negative', t.alerts, 0, null),
]);
