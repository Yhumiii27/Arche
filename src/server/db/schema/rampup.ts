// Start-up, ramp-up and transfer of a CAPEX (docs/spec/02 §6, 06 §6; delivery 6): production lines and their daily entries,
// the controller's accounting closure statement (N-15) and the lessons learned (REX, D22, published in pub_rex).
import { boolean, date, integer, jsonb, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
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
  rampupStatus: text('rampup_status').$type<'en_cours' | 'atteint' | 'hors_delai'>().notNull().default('en_cours'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('production_lines_number_uq').on(t.capexId, t.number)]);

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
  source: text('source').$type<'manual' | 'import'>().notNull().default('manual'),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('rampup_days_uq').on(t.lineId, t.day)]);

/** The controller's accounting closure statement (N-15): one per CAPEX, final costs by lot in lot_final_costs. */
export const closureStatements = arche.table('closure_statements', {
  capexId: uuid('capex_id').primaryKey().references(() => capex.id, { onDelete: 'cascade' }),
  afeBalanceKeur: keur('afe_balance_keur').notNull(),
  note: text('note'),
  enteredByName: text('entered_by_name').notNull(),
  ...timestamps,
});

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
}, (t) => [unique('rex_entries_number_uq').on(t.capexId, t.number)]);
