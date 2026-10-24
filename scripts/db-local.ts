// npm run db:local — creates Arche's database on a developer's PostgreSQL server: database `epc2i` (ARCHE_LOCAL_DATABASE),
// role arche_app (password ARCHE_LOCAL_PASSWORD, default "arche-dev") and schema `arche`, the layout of the shared EPC2I
// server (Matrix). Connects with ARCHE_ADMIN_URL (a superuser; default postgres://postgres:postgres@127.0.0.1:5432/postgres)
// and prints the DATABASE_URL to put in .env.local. Then: npm run db:migrate. Never run it against the shared server: there,
// Matrix's base layer creates the role and the schema.
// npm run db:reset-demo (`--reset`) first drops the local schema `arche` with all its data, so that the next migration seeds
// the current demonstration data set (a database is seeded only once, when empty). Local servers only.
import pg from 'pg';
import { loadEnvFiles } from '@/server/config/env-files';
import { appUrlOf, provisionDatabase, provisionSchema, withDatabase } from '@/server/db/provision';

async function main(): Promise<void> {
  loadEnvFiles(process.cwd());
  const adminUrl = process.env.ARCHE_ADMIN_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  const reset = process.argv.includes('--reset');
  if (reset && !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(adminUrl).hostname)) throw new Error('--reset only runs against a local PostgreSQL server');
  const database = process.env.ARCHE_LOCAL_DATABASE || 'epc2i';
  const password = process.env.ARCHE_LOCAL_PASSWORD || 'arche-dev';
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await provisionDatabase(admin, { database, password });
  } finally {
    await admin.end();
  }
  const inDb = new pg.Client({ connectionString: withDatabase(adminUrl, database) });
  await inDb.connect();
  try {
    if (reset) {
      await inDb.query('DROP SCHEMA IF EXISTS arche CASCADE');
      console.log('Schema "arche" dropped (local reset).');
    }
    await provisionSchema(inDb);
  } finally {
    await inDb.end();
  }
  console.log(`Database "${database}" ready (role arche_app, schema arche).\nDATABASE_URL=${appUrlOf(adminUrl, database, password)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
