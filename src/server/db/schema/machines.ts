// Machine needs and the Keystone mirror (docs/spec/02 §6, 07; delivery 4). Arche owns the demand (machine_needs, published in
// pub_besoins_machines); the catalogue, the answers and the EPC2i projects are Keystone's, copied read-only into the mirror.
import { date, index, integer, jsonb, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { NEED_STATUSES, SYNC_SOURCES, filled, oneOf, rule, within, type OneOf } from './_checks';
import { capex, capexLots } from './capex';

export const machineNeeds = arche.table('machine_needs', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  /** 1 → "B01" (N-9). */
  number: integer('number').notNull(),
  catalogueCode: text('catalogue_code'),
  catalogueVersion: integer('catalogue_version'),
  freeLabel: text('free_label'),
  quantity: integer('quantity').notNull().default(1),
  /** Codes of the catalogue options chosen. */
  options: jsonb('options').$type<string[]>().notNull().default([]),
  targetCapacity: keur('target_capacity'),
  capacityUnit: text('capacity_unit'),
  needDate: date('need_date', { mode: 'string' }),
  status: text('status').$type<OneOf<typeof NEED_STATUSES>>().notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  orderedOn: date('ordered_on', { mode: 'string' }),
  /** The machines lot the need belongs to. */
  lotId: uuid('lot_id').references(() => capexLots.id),
  comment: text('comment'),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('machine_needs_number_uq').on(t.capexId, t.number),
  within('machine_needs_number_positive', t.number, 1, null),
  rule('machine_needs_machine_named', sql`${t.catalogueCode} is not null or length(btrim(${t.freeLabel})) > 0`),
  rule('machine_needs_catalogue_version', sql`(${t.catalogueCode} is null) = (${t.catalogueVersion} is null)`),
  within('machine_needs_quantity_range', t.quantity, 1, 99),
  within('machine_needs_capacity_non_negative', t.targetCapacity, 0, null),
  oneOf('machine_needs_status_domain', t.status, NEED_STATUSES),
  filled('machine_needs_created_by_filled', t.createdByName),
]);

/**
 * Read-only copy of Keystone's share views (or of the simulation): one row per view and key, the row as Keystone publishes
 * it in `data`. Written by the connector's mirror only (src/server/integrations/keystone/mirror.ts).
 */
export const keystoneMirror = arche.table('keystone_mirror', {
  view: text('view').notNull(),
  key: text('key').notNull(),
  capexCode: text('capex_code'),
  projectCode: text('project_code'),
  needRef: text('need_ref'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  updatedAtSource: timestamp('maj_le', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ name: 'keystone_mirror_pk', columns: [t.view, t.key] }), index('keystone_mirror_capex_idx').on(t.capexCode), index('keystone_mirror_project_idx').on(t.projectCode)]);

/** State of the last synchronisation of each view: its source (views or simulation), when, how many rows, the error. */
export const keystoneSync = arche.table('keystone_sync', {
  view: text('view').primaryKey(),
  source: text('source').$type<OneOf<typeof SYNC_SOURCES>>().notNull(),
  rows: integer('rows').notNull().default(0),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
  error: text('error'),
}, (t) => [oneOf('keystone_sync_source_domain', t.source, SYNC_SOURCES), within('keystone_sync_rows_non_negative', t.rows, 0, null)]);
