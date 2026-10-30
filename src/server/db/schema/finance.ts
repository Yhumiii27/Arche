// Finance of the CAPEX (delivery 7, lot 7b; DECISIONS.md §5): the phased disbursement forecast of each lot (AR-045), the
// envelopes voted by the group CFO per fiscal year and scope (AR-040) and their traced movements (carry-overs, reallocations).
import { boolean, date, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { capex, capexLots } from './capex';

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
}, (t) => [unique('lot_forecasts_uq').on(t.lotId, t.month)]);

/** An envelope voted for a fiscal year: the group (no zone, no subsidiary), a zone or a subsidiary; every CAPEX or one typology. */
export const envelopes = arche.table('envelopes', {
  id: id(),
  fiscalYear: integer('fiscal_year').notNull(),
  zoneCode: text('zone_code'),
  subsidiaryCode: text('subsidiary_code'),
  category: text('category').$type<'all' | 'light' | 'strategic'>().notNull().default('all'),
  amountKeur: keur('amount_keur').notNull(),
  note: text('note'),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('envelopes_uq').on(t.fiscalYear, t.zoneCode, t.subsidiaryCode, t.category).nullsNotDistinct()]);

/** A carry-over to the next fiscal year or a reallocation between envelopes (append-only: a movement is undone by another). */
export const envelopeMovements = arche.table('envelope_movements', {
  id: id(),
  kind: text('kind').$type<'carry_over' | 'reallocation'>().notNull(),
  fromEnvelopeId: uuid('from_envelope_id').references(() => envelopes.id),
  toEnvelopeId: uuid('to_envelope_id').references(() => envelopes.id),
  amountKeur: keur('amount_keur').notNull(),
  reason: text('reason').notNull(),
  byName: text('by_name').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('envelope_movements_from_idx').on(t.fromEnvelopeId), index('envelope_movements_to_idx').on(t.toEnvelopeId)]);

/** Asset classes of the group (AR-050), kept by the group CFO: useful life, method, the lot kinds they apply to by default. */
export const assetClasses = arche.table('asset_classes', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  lifeYears: integer('life_years').notNull(),
  method: text('method').$type<'linear' | 'declining'>().notNull().default('linear'),
  factor: keur('factor'),
  lotKinds: text('lot_kinds').array().notNull().default([]),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

/** A lot transferred into fixed assets at the accounting closure (AR-050): its final cost, class and date in service. */
export const fixedAssetTransfers = arche.table('fixed_asset_transfers', {
  lotId: uuid('lot_id').primaryKey().references(() => capexLots.id, { onDelete: 'cascade' }),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  assetClassCode: text('asset_class_code').notNull(),
  lifeYears: integer('life_years').notNull(),
  method: text('method').$type<'linear' | 'declining'>().notNull(),
  factor: keur('factor'),
  amountKeur: keur('amount_keur').notNull(),
  inServiceOn: date('in_service_on', { mode: 'string' }).notNull(),
  transferredByName: text('transferred_by_name').notNull(),
  transferredAt: timestamp('transferred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('fixed_asset_transfers_capex_idx').on(t.capexId)]);
