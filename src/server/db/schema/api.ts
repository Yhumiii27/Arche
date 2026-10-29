// The business API and its webhooks (AR-048, docs/API.md): the applications allowed to call Arche (a key per client, only its
// SHA-256 kept; read, or read and write; a subsidiary scope), the signed requests already received (anti-replay), the webhook
// subscriptions of a client and the outbox of their deliveries, and the alerts already announced (`alert.raised`).
import { boolean, date, index, integer, jsonb, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, timestamps } from './_common';
import { capex } from './capex';

export const apiClients = arche.table('api_clients', {
  id: id(),
  name: text('name').notNull().unique(),
  /** First characters of the key, shown to tell the keys apart ("arche_k7Hq2"). */
  keyPrefix: text('key_prefix').notNull(),
  /** SHA-256 (hex) of the key; the key itself is shown once, at its creation. */
  keyHash: text('key_hash').notNull().unique(),
  canWrite: boolean('can_write').notNull().default(false),
  /** Subsidiary codes the client reads and writes; empty = the whole group. */
  subsidiaries: text('subsidiaries').array().notNull().default([]),
  createdByName: text('created_by_name').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByName: text('revoked_by_name'),
  ...timestamps,
});

/** Signed write requests already received, kept for the signature window (anti-replay). */
export const apiSignatures = arche.table('api_signatures', {
  clientId: uuid('client_id').notNull().references(() => apiClients.id, { onDelete: 'cascade' }),
  signature: text('signature').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ name: 'api_signatures_pk', columns: [t.clientId, t.signature] })]);

export const webhookSubscriptions = arche.table('webhook_subscriptions', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => apiClients.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  /** Events sent (src/domain/api.ts WEBHOOK_EVENTS). */
  events: text('events').array().notNull(),
  /** Secret of the HMAC signature of the deliveries, shown once at the creation; kept to sign. */
  secret: text('secret').notNull(),
  active: boolean('active').notNull().default(true),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
});

/** Outbox: one delivery per subscription and event, written in the transaction of the change, sent by the job `webhooks`. */
export const webhookDeliveries = arche.table('webhook_deliveries', {
  id: id(),
  subscriptionId: uuid('subscription_id').notNull().references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').$type<'pending' | 'sent' | 'failed'>().notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lastStatus: integer('last_status'),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('webhook_deliveries_due_idx').on(t.status, t.nextAttemptAt)]);

/** Alerts announced by `alert.raised`, so that an alert is announced once while it lasts (removed when it clears). */
export const raisedAlerts = arche.table('raised_alerts', {
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  rule: text('rule').notNull(),
  raisedOn: date('raised_on', { mode: 'string' }).notNull(),
}, (t) => [primaryKey({ name: 'raised_alerts_pk', columns: [t.capexId, t.rule] })]);
