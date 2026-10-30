import { integer, numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Primary key: a random UUID. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** Money in thousands of euros (k€), arbitrary-precision numeric read back as a JS number. */
export const keur = (name: string) => numeric(name, { mode: 'number' });

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Optimistic lock (AR-049): raised by one at every UPDATE of the row (trigger `bump_row_version`, migration 0021); a form
 * sends the value it was shown and a Server Function refuses the write when the row has changed since (src/domain/concurrency.ts).
 */
export const rowVersion = () => integer('row_version').notNull().default(1);
