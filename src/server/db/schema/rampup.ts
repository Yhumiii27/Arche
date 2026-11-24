// Start-up, ramp-up and transfer of a CAPEX (docs/spec/02 §6, 06 §6; delivery 6): production lines and their daily entries,
// the controller's accounting closure statement (N-15) and the lessons learned (REX, D22, published in pub_rex).
import { boolean, date, integer, jsonb, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { PHASES, RAMPUP_SOURCES, RAMPUP_STATUSES, REX_CATEGORIES, filled, oneOf, rule, within, type OneOf } from './_checks';
import { capex, capexLots } from './capex';

export const productionLines = arche.table('production_lines', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  nominalPerDay: keur('nominal_per_day').notNull(),
  unit: text('unit').notNull(),
  scrapTargetPct: keur('scrap_target_pct').notNull(),
  /** Keystone machine numbers of the installed base (MCH-…). */
  machineNumbers: jsonb('machine_numbers').$type<string[]>().notNull().default([]),
  /**
   * Result of the ramp-up rules (src/domain/rampup.ts), recomputed by every write on the line, its days or the start of
   * commissioning; read by pub_rampup.
   */
  reachedOn: date('reached_on', { mode: 'string' }),
  avgCapacityPct: keur('avg_capacity_pct'),
  avgOeePct: keur('avg_oee_pct'),
  avgScrapPct: keur('avg_scrap_pct'),
  rampupStatus: text('rampup_status').$type<OneOf<typeof RAMPUP_STATUSES>>().notNull().default('en_cours'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('production_lines_number_uq').on(t.capexId, t.number),
  within('production_lines_number_positive', t.number, 1, null),
  filled('production_lines_name_filled', t.name),
  rule('production_lines_nominal_positive', sql`${t.nominalPerDay} > 0`),
  filled('production_lines_unit_filled', t.unit),
  within('production_lines_scrap_target_range', t.scrapTargetPct, 0, 100),
  oneOf('production_lines_rampup_status_domain', t.rampupStatus, RAMPUP_STATUSES),
  filled('production_lines_updated_by_filled', t.updatedByName),
]);

export const rampupDays = arche.table('rampup_days', {
  lineId: uuid('line_id').notNull().references(() => productionLines.id, { onDelete: 'cascade' }),
  day: date('day', { mode: 'string' }).notNull(),
  output: keur('output'),
  availabilityPct: keur('availability_pct'),
  performancePct: keur('performance_pct'),
  qualityPct: keur('quality_pct'),
  oeePct: keur('oee_pct'),
  scrapPct: keur('scrap_pct'),
  plannedStop: boolean('planned_stop').notNull().default(false),
  source: text('source').$type<OneOf<typeof RAMPUP_SOURCES>>().notNull().default('manual'),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'rampup_days_pk', columns: [t.lineId, t.day] }),
  within('rampup_days_output_non_negative', t.output, 0, null),
  within('rampup_days_availability_range', t.availabilityPct, 0, 100),
  within('rampup_days_performance_range', t.performancePct, 0, 100),
  within('rampup_days_quality_range', t.qualityPct, 0, 100),
  within('rampup_days_oee_range', t.oeePct, 0, 100),
  within('rampup_days_scrap_range', t.scrapPct, 0, 100),
  oneOf('rampup_days_source_domain', t.source, RAMPUP_SOURCES),
  filled('rampup_days_entered_by_filled', t.enteredByName),
]);

/** The controller's accounting closure statement (N-15): one per CAPEX, final costs by lot in lot_final_costs. */
export const closureStatements = arche.table('closure_statements', {
  capexId: uuid('capex_id').primaryKey().references(() => capex.id, { onDelete: 'cascade' }),
  afeBalanceKeur: keur('afe_balance_keur').notNull(),
  note: text('note'),
  enteredByName: text('entered_by_name').notNull(),
  ...timestamps,
}, (t) => [filled('closure_statements_entered_by_filled', t.enteredByName)]);

export const lotFinalCosts = arche.table('lot_final_costs', {
  lotId: uuid('lot_id').primaryKey().references(() => capexLots.id, { onDelete: 'cascade' }),
  finalKeur: keur('final_keur').notNull(),
});

export const rexEntries = arche.table('rex_entries', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  phase: text('phase').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  text: text('text').notNull(),
  authorName: text('author_name').notNull(),
  /** What to do next time (optional; `recommandation` of pub_rex_v2, the common REX contract of Matrix). */
  recommendation: text('recommendation'),
  /** Published to the library and to pub_rex (null: kept within the CAPEX team). */
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  unique('rex_entries_number_uq').on(t.capexId, t.number),
  within('rex_entries_number_positive', t.number, 1, null),
  oneOf('rex_entries_phase_domain', t.phase, PHASES),
  oneOf('rex_entries_category_domain', t.category, REX_CATEGORIES),
  filled('rex_entries_title_filled', t.title),
  filled('rex_entries_text_filled', t.text),
  filled('rex_entries_author_filled', t.authorName),
]);
