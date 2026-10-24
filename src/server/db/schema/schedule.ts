// WBS of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): the tasks under each lot (or at the CAPEX level),
// with their dates, progress and owner. The lots keep their planned months (capex_lots); the EPC2i projects stay in Keystone
// and appear as one summary bar each. Rules: src/domain/schedule.ts.
import { boolean, date, integer, text, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, timestamps } from './_common';
import { capex, capexLots } from './capex';
import { users } from './organisation';

export const wbsTasks = arche.table('wbs_tasks', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  /** The lot the task belongs to; null = a task of the CAPEX itself (studies, steering…). */
  lotId: uuid('lot_id').references(() => capexLots.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  startOn: date('start_on', { mode: 'string' }).notNull(),
  endOn: date('end_on', { mode: 'string' }).notNull(),
  progressPct: integer('progress_pct').notNull().default(0),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  /** A milestone (start = end), drawn as a diamond. */
  milestone: boolean('milestone').notNull().default(false),
  updatedByName: text('updated_by_name').notNull(),
  ...timestamps,
}, (t) => [unique('wbs_tasks_number_uq').on(t.capexId, t.number)]);
