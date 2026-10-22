// Creates Arche's place on a PostgreSQL server that Matrix does not manage — a developer machine, the CI, the tests: the
// database, the role `arche_app` (LOGIN, no other right) and the schema `arche` it owns, with search_path=arche. Same shape
// as the proposal for Matrix's base layer (docs/DEMANDES-MATRIX.md M-1, M-2); on the shared server Matrix does it instead.
// Needs a superuser connection to the maintenance database. Idempotent. No `server-only`: scripts and tests run it.
import type { Client } from 'pg';
import { SERVER_SCHEMA } from './server-schema';

export const APP_ROLE = 'arche_app';

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`Invalid identifier: ${s}`);
  return `"${s}"`;
};
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Creates the role (or resets its password) and the database when missing. `admin` is connected to another database. */
export async function provisionDatabase(admin: Client, opts: { database: string; password: string }): Promise<void> {
  // Test files provision in parallel: one at a time (concurrent ALTER ROLE fails with "tuple concurrently updated").
  await admin.query("select pg_advisory_lock(hashtext('arche.provision'))");
  try {
    await provisionLocked(admin, opts);
  } finally {
    await admin.query("select pg_advisory_unlock(hashtext('arche.provision'))").catch(() => null);
  }
}

async function provisionLocked(admin: Client, opts: { database: string; password: string }): Promise<void> {
  const { rows: role } = await admin.query('select 1 from pg_roles where rolname = $1', [APP_ROLE]);
  const attrs = `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${literal(opts.password)}`;
  await admin.query(role.length ? `ALTER ROLE ${ident(APP_ROLE)} ${attrs}` : `CREATE ROLE ${ident(APP_ROLE)} ${attrs}`);
  const { rows: db } = await admin.query('select 1 from pg_database where datname = $1', [opts.database]);
  if (!db.length) await admin.query(`CREATE DATABASE ${ident(opts.database)}`);
  await admin.query(`REVOKE CREATE ON DATABASE ${ident(opts.database)} FROM ${ident(APP_ROLE)}`);
  await admin.query(`GRANT CONNECT ON DATABASE ${ident(opts.database)} TO ${ident(APP_ROLE)}`);
  await admin.query(`ALTER ROLE ${ident(APP_ROLE)} IN DATABASE ${ident(opts.database)} SET search_path TO ${ident(SERVER_SCHEMA)}`);
}

/** Creates the schema owned by arche_app. `adminInDb` is a superuser connected to the target database. */
export async function provisionSchema(adminInDb: Client): Promise<void> {
  await adminInDb.query(`CREATE SCHEMA IF NOT EXISTS ${ident(SERVER_SCHEMA)} AUTHORIZATION ${ident(APP_ROLE)}`);
  await adminInDb.query(`ALTER SCHEMA ${ident(SERVER_SCHEMA)} OWNER TO ${ident(APP_ROLE)}`);
  await adminInDb.query(`REVOKE ALL ON SCHEMA ${ident(SERVER_SCHEMA)} FROM PUBLIC`);
  await adminInDb.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
}

/** postgres://arche_app:<password>@<host of the admin URL>/<database>. */
export function appUrlOf(adminUrl: string, database: string, password: string): string {
  const u = new URL(adminUrl);
  u.username = APP_ROLE;
  u.password = password;
  u.pathname = `/${database}`;
  return u.toString();
}

/** The admin URL pointed at another database. */
export function withDatabase(adminUrl: string, database: string): string {
  const u = new URL(adminUrl);
  u.pathname = `/${database}`;
  return u.toString();
}
