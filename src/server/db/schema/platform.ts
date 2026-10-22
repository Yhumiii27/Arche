// Platform tables copied from Keystone (docs/SOCLE.md): settings, the append-only audit trail (trigger in the initial
// migration) and the activity feed.
import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id } from './_common';
import { capex } from './capex';
import { users } from './organisation';

export const appSettings = arche.table('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByName: text('updated_by_name').notNull(),
});

/** Append-only (database trigger): never updated nor deleted, in code or tests. */
export const auditEntries = arche.table('audit_entries', {
  id: id(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  /** The user account that acted; null for systems (jobs, connectors). */
  actorUserId: uuid('actor_user_id').references(() => users.id),
  /** Display name of the actor (user or system). */
  actorName: text('actor_name').notNull(),
  /** Active role of the actor when they acted. */
  actorRole: text('actor_role'),
  /** Business reference of the object: "CPX-APM-2026-01", "User n.diallo@…", "Role assignment". */
  objectRef: text('object_ref').notNull(),
  /** "status: Draft → Active" (EN source text). */
  change: text('change').notNull(),
  /** "Sign-in", "Administration", "CAPEX"… */
  area: text('area').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  capexId: uuid('capex_id').references(() => capex.id),
  before: jsonb('before').$type<Record<string, unknown>>(),
  after: jsonb('after').$type<Record<string, unknown>>(),
  reason: text('reason'),
}, (t) => [
  /** pub_journal (Matrix) is read by period. */
  index('audit_entries_occurred_at_idx').on(t.occurredAt),
]);

export const activityEvents = arche.table('activity_events', {
  id: id(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorName: text('actor_name').notNull(),
  kind: text('kind').notNull(),
  /** EN source sentence. */
  text: text('text').notNull(),
  capexId: uuid('capex_id').references(() => capex.id),
}, (t) => [index('activity_events_occurred_at_idx').on(t.occurredAt)]);
