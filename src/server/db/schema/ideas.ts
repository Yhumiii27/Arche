// Upstream and downstream of the cycle (delivery 7, lot 7e; DECISIONS.md §5): the backlog of investment ideas (AR-051) —
// proposed for a subsidiary, decided by its sponsor, its zone director or the group industrial director, converted into a
// CAPEX draft by the guided opening — and the benefits realised against the business plan with the post-audits (AR-046).
import { date, index, integer, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { IDEA_STATUSES, INVESTMENT_TYPES, POST_AUDIT_CONCLUSIONS, POST_AUDIT_MONTHS, filled, oneOf, rule, within, type OneOf } from './_checks';
import { capex } from './capex';
import { subsidiaries, users } from './organisation';

export const ideas = arche.table('ideas', {
  id: id(),
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  /** Number within the subsidiary (IDEA-APM-007). */
  number: integer('number').notNull(),
  title: text('title').notNull(),
  stake: text('stake').notNull(),
  /** Order of magnitude, k€. */
  sizeKeur: keur('size_keur'),
  investmentType: text('investment_type').$type<OneOf<typeof INVESTMENT_TYPES>>(),
  status: text('status').$type<OneOf<typeof IDEA_STATUSES>>().notNull().default('new'),
  proposedByName: text('proposed_by_name').notNull(),
  proposedByUserId: uuid('proposed_by_user_id').references(() => users.id),
  decisionNote: text('decision_note'),
  decidedByName: text('decided_by_name'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  /** The CAPEX draft it became. */
  capexId: uuid('capex_id').references(() => capex.id),
  ...timestamps,
}, (t) => [
  unique('ideas_number_uq').on(t.subsidiaryCode, t.number),
  index('ideas_subsidiary_idx').on(t.subsidiaryCode),
  within('ideas_number_positive', t.number, 1, null),
  filled('ideas_title_filled', t.title),
  filled('ideas_stake_filled', t.stake),
  within('ideas_size_non_negative', t.sizeKeur, 0, null),
  oneOf('ideas_investment_type_domain', t.investmentType, INVESTMENT_TYPES),
  oneOf('ideas_status_domain', t.status, IDEA_STATUSES),
  rule('ideas_converted_has_capex', sql`${t.status} <> 'converted' or ${t.capexId} is not null`),
  filled('ideas_proposed_by_filled', t.proposedByName),
]);

/** Benefits realised (AR-046): one row per CAPEX and year of its business plan, entered by the controller or the sponsor. */
export const benefitActuals = arche.table('benefit_actuals', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  revenueKeur: keur('revenue_keur').notNull(),
  opexKeur: keur('opex_keur').notNull(),
  note: text('note'),
  enteredByName: text('entered_by_name').notNull(),
  ...timestamps,
}, (t) => [
  primaryKey({ name: 'benefit_actuals_pk', columns: [t.capexId, t.year] }),
  within('benefit_actuals_year_positive', t.year, 1, null),
  within('benefit_actuals_revenue_non_negative', t.revenueKeur, 0, null),
  within('benefit_actuals_opex_non_negative', t.opexKeur, 0, null),
  filled('benefit_actuals_entered_by_filled', t.enteredByName),
]);

/** Post-audits held (AR-046): 6, 12 and 24 months after the start of commissioning. */
export const postAudits = arche.table('post_audits', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  milestone: integer('milestone').notNull(),
  heldOn: date('held_on', { mode: 'string' }).notNull(),
  conclusion: text('conclusion').$type<OneOf<typeof POST_AUDIT_CONCLUSIONS>>().notNull(),
  summary: text('summary').notNull(),
  /** Codex reference of the report, as typed. */
  codexRef: text('codex_ref'),
  /** NPV and IRR recomputed on the realised flows when it was held. */
  realNpvKeur: keur('real_npv_keur'),
  realIrrPct: keur('real_irr_pct'),
  recordedByName: text('recorded_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('post_audits_milestone_uq').on(t.capexId, t.milestone),
  oneOf('post_audits_milestone_domain', t.milestone, POST_AUDIT_MONTHS),
  oneOf('post_audits_conclusion_domain', t.conclusion, POST_AUDIT_CONCLUSIONS),
  filled('post_audits_summary_filled', t.summary),
  filled('post_audits_recorded_by_filled', t.recordedByName),
]);
