import { numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Primary key: a random UUID. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** Money in thousands of euros (k€), arbitrary-precision numeric read back as a JS number. */
export const keur = (name: string) => numeric(name, { mode: 'number' });

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
