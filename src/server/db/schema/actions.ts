// Action plan of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): follow-up actions opened from any CAPEX
// page — owner, due date, the element they come from — and closed with a note. Rules: src/domain/actions.ts.
import { date, index, integer, text, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, timestamps } from './_common';
import { capex } from './capex';
import { users } from './organisation';

export const capexActions = arche.table('capex_actions', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  /** What the action comes from (src/domain/actions.ts ACTION_SOURCES) and the element, as typed ("R-02", "G2 session 1"). */
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  dueOn: date('due_on', { mode: 'string' }),
  status: text('status').$type<'open' | 'done' | 'cancelled'>().notNull().default('open'),
  closedOn: date('closed_on', { mode: 'string' }),
  closingNote: text('closing_note'),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('capex_actions_number_uq').on(t.capexId, t.number), index('capex_actions_owner_idx').on(t.ownerUserId)]);
