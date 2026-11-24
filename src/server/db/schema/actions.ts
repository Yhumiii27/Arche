// Action plan of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): follow-up actions opened from any CAPEX
// page — owner, due date, the element they come from — and closed with a note. Rules: src/domain/actions.ts.
import { date, index, integer, text, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, timestamps } from './_common';
import { ACTION_SOURCES, ACTION_STATUSES, filled, oneOf, rule, within, type OneOf } from './_checks';
import { capex } from './capex';
import { users } from './organisation';

export const capexActions = arche.table('capex_actions', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  /** What the action comes from (src/domain/actions.ts ACTION_SOURCES) and the element, as typed ("R-02", "G2 session 1"). */
  source: text('source').$type<OneOf<typeof ACTION_SOURCES>>().notNull(),
  sourceRef: text('source_ref'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  dueOn: date('due_on', { mode: 'string' }),
  status: text('status').$type<OneOf<typeof ACTION_STATUSES>>().notNull().default('open'),
  closedOn: date('closed_on', { mode: 'string' }),
  closingNote: text('closing_note'),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [
  unique('capex_actions_number_uq').on(t.capexId, t.number),
  index('capex_actions_owner_idx').on(t.ownerUserId),
  within('capex_actions_number_positive', t.number, 1, null),
  filled('capex_actions_title_filled', t.title),
  oneOf('capex_actions_source_domain', t.source, ACTION_SOURCES),
  oneOf('capex_actions_status_domain', t.status, ACTION_STATUSES),
  rule('capex_actions_closed_dated', sql`(${t.status} = 'open') = (${t.closedOn} is null)`),
  rule('capex_actions_cancel_reason', sql`${t.status} <> 'cancelled' or length(btrim(${t.closingNote})) > 0`),
  filled('capex_actions_created_by_filled', t.createdByName),
]);
