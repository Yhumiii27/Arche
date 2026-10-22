// A fresh PostgreSQL database per test file (Arche runs on PostgreSQL only): created on the test server
// (ARCHE_TEST_ADMIN_URL, a superuser; default postgres://postgres:postgres@127.0.0.1:5432/postgres), provisioned like the
// shared server (role arche_app, schema arche), migrated, seeded (demo by default), and dropped by `close()`.
//   const t = await testDatabase();  …  await t.close();
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { SeedMode } from '@/server/config/parse';
import { setDb } from '@/server/db/client';
import { migrateAndSeedPostgres, openPostgres, type PostgresHandle } from '@/server/db/postgres';
import { appUrlOf, provisionDatabase, provisionSchema, withDatabase } from '@/server/db/provision';
import type { DB } from '@/server/db/types';

export const TEST_ADMIN_URL = process.env.ARCHE_TEST_ADMIN_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
const TEST_PASSWORD = 'arche-test';

export interface TestDatabase {
  db: DB;
  handle: PostgresHandle;
  /** DATABASE_URL of the test database (arche_app). */
  url: string;
  name: string;
  close(): Promise<void>;
}

async function withClient<T>(url: string, run: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await run(c);
  } finally {
    await c.end();
  }
}

/**
 * A new database: `migrate` (default true) applies the migrations and `seed` (default 'demo'; null = none) seeds it;
 * `useAsDefault` (default true) points getDb() at it.
 */
export async function testDatabase(opts: { migrate?: boolean; seed?: SeedMode | null; useAsDefault?: boolean } = {}): Promise<TestDatabase> {
  const name = `arche_test_${randomBytes(6).toString('hex')}`;
  await withClient(TEST_ADMIN_URL, (c) => provisionDatabase(c, { database: name, password: TEST_PASSWORD }));
  await withClient(withDatabase(TEST_ADMIN_URL, name), (c) => provisionSchema(c));
  const url = appUrlOf(TEST_ADMIN_URL, name, TEST_PASSWORD);
  const handle = await openPostgres({ url, poolMax: 4, applicationName: 'arche-test' });
  if (opts.migrate ?? true) {
    const seed = opts.seed === undefined ? 'demo' : opts.seed;
    if (seed) await migrateAndSeedPostgres(handle, seed);
    else {
      const { withMigrationLock } = await import('@/server/db/postgres');
      const { applyServerMigrations } = await import('@/server/db/migrations');
      await withMigrationLock(handle.pool, (client) => applyServerMigrations(client));
    }
  }
  if (opts.useAsDefault ?? true) setDb(handle.db);
  return {
    db: handle.db, handle, url, name,
    async close() {
      await handle.close().catch(() => null);
      await withClient(TEST_ADMIN_URL, (c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
    },
  };
}
