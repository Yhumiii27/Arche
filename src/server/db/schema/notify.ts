// Circuit notifications and absences (delivery 7, lot 7d; AR-041, DECISIONS.md §5): the e-mail outbox (one row per message and
// recipient, written by the `notifications` job, sent by the transport of ARCHE_MAIL_TRANSPORT) and the absences with their
// delegate.
import { date, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id } from './_common';
import { EMAIL_STATUSES, filled, oneOf, rule, within, type OneOf } from './_checks';
import { capex } from './capex';
import { users } from './organisation';

/** An absence declared by a person: their delegate receives their notifications and may act on their steps over the days. */
export const absences = arche.table('absences', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delegateUserId: uuid('delegate_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fromOn: date('from_on', { mode: 'string' }).notNull(),
  toOn: date('to_on', { mode: 'string' }).notNull(),
  note: text('note'),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** Ended early by the person (the row is kept). */
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, (t) => [
  index('absences_user_idx').on(t.userId),
  index('absences_delegate_idx').on(t.delegateUserId),
  rule('absences_dates_order', sql`${t.toOn} >= ${t.fromOn}`),
  rule('absences_delegate_other', sql`${t.delegateUserId} <> ${t.userId}`),
  filled('absences_created_by_filled', t.createdByName),
]);

/** A notification e-mail. `key` makes a notice sent once per recipient (src/domain/notify.ts `noticesOf`). */
export const emailOutbox = arche.table('email_outbox', {
  id: id(),
  key: text('key').notNull(),
  kind: text('kind').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toEmail: text('to_email').notNull(),
  capexId: uuid('capex_id').references(() => capex.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  /** pending → sent | held (transport `none`) | failed (after 5 attempts). */
  status: text('status').$type<OneOf<typeof EMAIL_STATUSES>>().notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => [
  index('email_outbox_status_idx').on(t.status),
  index('email_outbox_user_idx').on(t.userId),
  unique('email_outbox_key_user').on(t.key, t.userId),
  filled('email_outbox_key_filled', t.key),
  rule('email_outbox_to_shape', sql`${t.toEmail} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`),
  filled('email_outbox_subject_filled', t.subject),
  oneOf('email_outbox_status_domain', t.status, EMAIL_STATUSES),
  within('email_outbox_attempts_non_negative', t.attempts, 0, null),
  rule('email_outbox_sent_dated', sql`${t.status} <> 'sent' or ${t.sentAt} is not null`),
]);
