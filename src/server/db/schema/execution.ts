// Delivery and safety of a CAPEX (docs/spec/02 §3; delivery 5): the permits register, the subsidiary's part of the engineering
// pack, the safety milestones declared by the group HSE (N-13) and the monthly committed / spent / physical % of the lots
// (N-14). Documents stay in Codex: only their references are kept.
import { date, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { capex, capexLots } from './capex';

export const authorizations = arche.table('authorizations', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  kind: text('kind').$type<'icpe' | 'building_permit' | 'plu' | 'atex' | 'other'>().notNull(),
  title: text('title').notNull(),
  authority: text('authority'),
  status: text('status').$type<'to_file' | 'filed' | 'obtained' | 'refused' | 'not_required'>().notNull().default('to_file'),
  filedOn: date('filed_on', { mode: 'string' }),
  dueOn: date('due_on', { mode: 'string' }),
  obtainedOn: date('obtained_on', { mode: 'string' }),
  /** Codex reference of the permit file. */
  codexRef: text('codex_ref'),
  note: text('note'),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('authorizations_number_uq').on(t.capexId, t.number)]);

/** Subsidiary's part of the engineering pack: one row per item of the standard list that has been touched. */
export const packItems = arche.table('pack_items', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  itemCode: text('item_code').notNull(),
  status: text('status').$type<'expected' | 'in_progress' | 'validated' | 'not_applicable'>().notNull().default('expected'),
  codexRef: text('codex_ref'),
  validatedOn: date('validated_on', { mode: 'string' }),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('pack_items_uq').on(t.capexId, t.itemCode)]);

/**
 * Safety milestones: declared by the group HSE until Vigie publishes them (then mirrored, `source = vigie`). The PSSR discharge
 * (quitus) is a step of the G3 circuit (src/domain/circuits.ts), not a column here.
 */
export const hsStatuses = arche.table('hs_statuses', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  hsCode: text('hs_code').$type<'HS2' | 'HS3' | 'HS4' | 'PSSR' | 'HS6'>().notNull(),
  status: text('status').$type<'not_started' | 'in_progress' | 'passed' | 'waived'>().notNull().default('not_started'),
  /** Vigie or Codex reference of the evidence. */
  evidenceRef: text('evidence_ref'),
  source: text('source').$type<'declared' | 'vigie'>().notNull().default('declared'),
  passedOn: date('passed_on', { mode: 'string' }),
  note: text('note'),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('hs_statuses_uq').on(t.capexId, t.hsCode)]);

/** Values of a lot at the end of a month, cumulative (committed, spent, physical %); `keystone` rows are the EPC2i lots'. */
export const lotActuals = arche.table('lot_actuals', {
  lotId: uuid('lot_id').notNull().references(() => capexLots.id, { onDelete: 'cascade' }),
  /** "2026-10". */
  month: text('month').notNull(),
  committedKeur: keur('committed_keur'),
  spentKeur: keur('spent_keur'),
  physicalPct: keur('physical_pct'),
  source: text('source').$type<'manual' | 'import' | 'keystone'>().notNull().default('manual'),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('lot_actuals_uq').on(t.lotId, t.month)]);
