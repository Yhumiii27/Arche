import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

type Schema = typeof schema;

/** The part of a raw query result Arche reads. */
export interface QueryRows<T> {
  rows: T[];
}

/** Raw query results: node-postgres's `QueryResult` carries `rows`, which is all Arche reads from `db.execute()`. */
export interface ArcheQueryResultHKT extends PgQueryResultHKT {
  type: QueryRows<this['row']>;
}

/** Typed Drizzle handle over the Arche schema over a node-postgres pool. */
export type DB = PgDatabase<ArcheQueryResultHKT, Schema>;

/** Transaction handle (same query API as DB). */
export type Tx = PgTransaction<ArcheQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
