// Portfolio decisions of the group (delivery 7, lot 7c; DECISIONS.md §5): the weights of the prioritisation grid and the scores
// the group gives the CAPEX on its manual criteria (AR-044), the portfolio scenarios and the CAPEX they keep or shift (AR-043).
import { boolean, integer, jsonb, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, timestamps } from './_common';
import { MANUAL_SCORING_CODES, SCENARIO_KINDS, SCORING_CODES, filled, oneOf, within, type OneOf } from './_checks';
import { capex } from './capex';

/** The weight of a criterion of the grid (src/domain/scoring.ts SCORING_CRITERIA); absent: its default weight. */
export const scoringWeights = arche.table('scoring_weights', {
  code: text('code').primaryKey(),
  weight: integer('weight').notNull(),
  updatedByName: text('updated_by_name').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  oneOf('scoring_weights_code_domain', t.code, SCORING_CODES),
  within('scoring_weights_weight_range', t.weight, 0, 100),
  filled('scoring_weights_updated_by_filled', t.updatedByName),
]);

/** The group's score (0 to 5) of a CAPEX on a manual criterion. */
export const capexScores = arche.table('capex_scores', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  criterionCode: text('criterion_code').notNull(),
  score: integer('score').notNull(),
  note: text('note'),
  scoredByName: text('scored_by_name').notNull(),
  scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'capex_scores_pk', columns: [t.capexId, t.criterionCode] }),
  oneOf('capex_scores_criterion_domain', t.criterionCode, MANUAL_SCORING_CODES),
  within('capex_scores_score_range', t.score, 0, 5),
  filled('capex_scores_scored_by_filled', t.scoredByName),
]);

export const portfolioScenarios = arche.table('portfolio_scenarios', {
  id: id(),
  name: text('name').notNull(),
  kind: text('kind').$type<OneOf<typeof SCENARIO_KINDS>>().notNull(),
  description: text('description'),
  /** The group's envelope by fiscal year, k€ ({"2027": 30000}). */
  envelopes: jsonb('envelopes').$type<Record<string, number>>().notNull().default({}),
  /** The scenario retained for the COPIL GPI (one at most). */
  retained: boolean('retained').notNull().default(false),
  retainedByName: text('retained_by_name'),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [
  filled('portfolio_scenarios_name_filled', t.name),
  oneOf('portfolio_scenarios_kind_domain', t.kind, SCENARIO_KINDS),
  filled('portfolio_scenarios_created_by_filled', t.createdByName),
]);

/** A CAPEX of a scenario: kept or left out, its disbursements to come shifted by whole months; absent: kept, not shifted. */
export const scenarioItems = arche.table('scenario_items', {
  scenarioId: uuid('scenario_id').notNull().references(() => portfolioScenarios.id, { onDelete: 'cascade' }),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  included: boolean('included').notNull().default(true),
  shiftMonths: integer('shift_months').notNull().default(0),
}, (t) => [primaryKey({ name: 'scenario_items_pk', columns: [t.scenarioId, t.capexId] })]);
