// Finance of the CAPEX (delivery 7, lot 7b; DECISIONS.md §5): the phased disbursement forecast of each lot (AR-045), the
// envelopes voted by the group CFO per fiscal year and scope (AR-040) and their traced movements (carry-overs, reallocations).
import { boolean, date, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { capex, capexLots } from './capex';
import {
  CURRENCY_RE, DEPRECIATION_METHODS, ENVELOPE_CATEGORIES, ENVELOPE_MOVEMENT_KINDS, MONTH_RE, filled, oneOf, rule, shaped, together, within, type OneOf,
} from './_checks';

/** A lot's forecast disbursement for a month to come (not cumulative), in k€; as typed in the subsidiary's currency beside it. */
export const lotForecasts = arche.table('lot_forecasts', {
  lotId: uuid('lot_id').notNull().references(() => capexLots.id, { onDelete: 'cascade' }),
  /** "2026-11". */
  month: text('month').notNull(),
  amountKeur: keur('amount_keur').notNull(),
  amountLocal: keur('amount_local'),
  currency: text('currency'),
  rate: keur('rate'),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('lot_forecasts_uq').on(t.lotId, t.month),
  shaped('lot_forecasts_month_shape', t.month, MONTH_RE),
  within('lot_forecasts_amount_non_negative', t.amountKeur, 0, null),
  within('lot_forecasts_local_non_negative', t.amountLocal, 0, null),
  shaped('lot_forecasts_currency_shape', t.currency, CURRENCY_RE),
  rule('lot_forecasts_rate_positive', sql`${t.rate} > 0`),
  together('lot_forecasts_currency_rate_together', t.currency, t.rate),
  rule('lot_forecasts_local_has_currency', sql`${t.amountLocal} is null or ${t.currency} is not null`),
  filled('lot_forecasts_entered_by_filled', t.enteredByName),
]);

/** An envelope voted for a fiscal year: the group (no zone, no subsidiary), a zone or a subsidiary; every CAPEX or one typology. */
export const envelopes = arche.table('envelopes', {
  id: id(),
  fiscalYear: integer('fiscal_year').notNull(),
  zoneCode: text('zone_code'),
  subsidiaryCode: text('subsidiary_code'),
  category: text('category').$type<OneOf<typeof ENVELOPE_CATEGORIES>>().notNull().default('all'),
  amountKeur: keur('amount_keur').notNull(),
  note: text('note'),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('envelopes_uq').on(t.fiscalYear, t.zoneCode, t.subsidiaryCode, t.category).nullsNotDistinct(),
  within('envelopes_year_range', t.fiscalYear, 2020, 2100),
  rule('envelopes_one_scope', sql`${t.zoneCode} is null or ${t.subsidiaryCode} is null`),
  oneOf('envelopes_category_domain', t.category, ENVELOPE_CATEGORIES),
  within('envelopes_amount_non_negative', t.amountKeur, 0, null),
  filled('envelopes_created_by_filled', t.createdByName),
]);

/** A carry-over to the next fiscal year or a reallocation between envelopes (append-only: a movement is undone by another). */
export const envelopeMovements = arche.table('envelope_movements', {
  id: id(),
  kind: text('kind').$type<OneOf<typeof ENVELOPE_MOVEMENT_KINDS>>().notNull(),
  fromEnvelopeId: uuid('from_envelope_id').references(() => envelopes.id),
  toEnvelopeId: uuid('to_envelope_id').references(() => envelopes.id),
  amountKeur: keur('amount_keur').notNull(),
  reason: text('reason').notNull(),
  byName: text('by_name').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('envelope_movements_from_idx').on(t.fromEnvelopeId),
  index('envelope_movements_to_idx').on(t.toEnvelopeId),
  oneOf('envelope_movements_kind_domain', t.kind, ENVELOPE_MOVEMENT_KINDS),
  rule('envelope_movements_amount_positive', sql`${t.amountKeur} > 0`),
  rule('envelope_movements_distinct', sql`${t.fromEnvelopeId} is distinct from ${t.toEnvelopeId}`),
  filled('envelope_movements_reason_filled', t.reason),
  filled('envelope_movements_by_filled', t.byName),
]);

/** Asset classes of the group (AR-050), kept by the group CFO: useful life, method, the lot kinds they apply to by default. */
export const assetClasses = arche.table('asset_classes', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  lifeYears: integer('life_years').notNull(),
  method: text('method').$type<OneOf<typeof DEPRECIATION_METHODS>>().notNull().default('linear'),
  factor: keur('factor'),
  lotKinds: text('lot_kinds').array().notNull().default([]),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, (t) => [
  shaped('asset_classes_code_shape', t.code, '^[A-Z0-9_-]{2,12}$'),
  filled('asset_classes_label_filled', t.label),
  within('asset_classes_life_range', t.lifeYears, 1, 60),
  oneOf('asset_classes_method_domain', t.method, DEPRECIATION_METHODS),
  rule('asset_classes_declining_factor', sql`${t.method} <> 'declining' or ${t.factor} between 1 and 3`),
]);

/** A lot transferred into fixed assets at the accounting closure (AR-050): its final cost, class and date in service. */
export const fixedAssetTransfers = arche.table('fixed_asset_transfers', {
  lotId: uuid('lot_id').primaryKey().references(() => capexLots.id, { onDelete: 'cascade' }),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  assetClassCode: text('asset_class_code').notNull(),
  lifeYears: integer('life_years').notNull(),
  method: text('method').$type<OneOf<typeof DEPRECIATION_METHODS>>().notNull(),
  factor: keur('factor'),
  amountKeur: keur('amount_keur').notNull(),
  inServiceOn: date('in_service_on', { mode: 'string' }).notNull(),
  transferredByName: text('transferred_by_name').notNull(),
  transferredAt: timestamp('transferred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('fixed_asset_transfers_capex_idx').on(t.capexId),
  within('fixed_asset_transfers_life_range', t.lifeYears, 1, 60),
  oneOf('fixed_asset_transfers_method_domain', t.method, DEPRECIATION_METHODS),
  rule('fixed_asset_transfers_declining_factor', sql`${t.method} <> 'declining' or ${t.factor} between 1 and 3`),
  within('fixed_asset_transfers_amount_non_negative', t.amountKeur, 0, null),
  filled('fixed_asset_transfers_by_filled', t.transferredByName),
]);
