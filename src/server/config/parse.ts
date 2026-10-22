// Arche configuration: every environment variable the server reads, validated with zod in ONE place. Pure module (no I/O
// besides the `env` object it is given): src/server/config/index.ts applies it to process.env, the start-up check
// (src/server/startup.ts) and `npm run db:migrate` fail fast on its errors in production, and the tests feed it plain objects.
// .env.example documents every variable. Platform copied from Keystone (docs/SOCLE.md), Keystone's business variables removed.
//
// Rules
// - An empty value counts as unset (a blank line in a .env file must not switch a setting on).
// - A value that is set but invalid is an error. In production (NODE_ENV=production) errors stop the server at start-up; in
//   development and tests they are logged once and the variable falls back to its default.
// - Messages name the variable, never its value (values may be secrets).
// - NEXT_PUBLIC_* URLs are inlined in the bundles at build time (`next build`); they are only validated here.
import path from 'node:path';
import { z } from 'zod';
import { parseClockSetting, type ClockSetting } from '@/domain/clock';
import { normaliseEmail } from '@/domain/auth';
import { BACKUP_DEFAULTS } from '@/domain/backup';

export const SEED_MODES = ['demo', 'production'] as const;
/** What a NEW database is seeded with (ARCHE_SEED): the demonstration data set, or reference data only. */
export type SeedMode = (typeof SEED_MODES)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const LOG_FORMATS = ['json', 'pretty'] as const;
export type LogFormat = (typeof LOG_FORMATS)[number];
export type RuntimeEnv = 'development' | 'production' | 'test';

export const DEFAULT_POOL_MAX = 10;

/** The PostgreSQL database (Arche runs on PostgreSQL only), through a node-postgres pool, migrated and seeded by `npm run db:migrate`. */
export interface DatabaseConfig {
  url: string;
  poolMax: number;
}

export interface ArcheConfig {
  env: RuntimeEnv;
  production: boolean;
  /** Absolute data directory (local files of this instance). */
  dataDir: string;
  /** null when DATABASE_URL is unset: an error at start-up (Arche has no embedded database). */
  database: DatabaseConfig | null;
  /** Seed of a new database. An existing database keeps the seed it was created with (app_settings `arche.seed`). */
  seed: SeedMode;
  /** ARCHE_SEED was set explicitly (seeding an empty PostgreSQL database requires it). */
  seedExplicit: boolean;
  /** Business clock (ARCHE_CLOCK): null = the real clock; else the real clock or a pinned date (demonstrations, tests). */
  clock: ClockSetting | null;
  log: { level: LogLevel; format: LogFormat };
  /** Backups of the schema (ARCHE_BACKUP_DIR): off when null; every `everyMin` minutes, kept `retentionDays` days. */
  backup: { dir: string | null; everyMin: number; retentionDays: number };
  /** E-mails granted the administrator role at their first Entra sign-in (bootstrap of a new database, N-4). */
  adminEmails: string[];
  /** Secret values present in the environment: the logger masks them wherever they appear. */
  secrets: string[];
}

export interface ConfigIssue {
  variable: string;
  message: string;
}

export interface ConfigResult {
  config: ArcheConfig;
  errors: ConfigIssue[];
  warnings: ConfigIssue[];
}

const trimSlash = (u: string) => u.replace(/\/+$/, '');

const isUrlWith = (v: string, protocols: string[]) => {
  try {
    return protocols.includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

const httpUrl = z.string().refine((v) => isUrlWith(v, ['http:', 'https:']), 'must be an http:// or https:// URL').transform(trimSlash);

/** One schema per variable (input: the trimmed string, undefined when unset or blank). */
const VARS = {
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  ARCHE_DATA_DIR: z.string().optional(),
  DATABASE_URL: z
    .string()
    .refine((v) => isUrlWith(v, ['postgres:', 'postgresql:']), 'must be a postgres:// or postgresql:// URL')
    .optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1, 'must be at least 1').max(200, 'must be at most 200').optional(),
  ARCHE_SEED: z.enum(SEED_MODES, { message: 'must be "demo" or "production"' }).optional(),
  // "real", or a pinned business date YYYY-MM-DD; unset = the real clock.
  ARCHE_CLOCK: z
    .string()
    .transform((v, ctx) => parseClockSetting(v) ?? (ctx.addIssue({ code: 'custom', message: 'must be "real" or a date YYYY-MM-DD' }), z.NEVER))
    .optional(),
  LOG_LEVEL: z.enum(LOG_LEVELS, { message: `must be one of ${LOG_LEVELS.join(', ')}` }).optional(),
  LOG_FORMAT: z.enum(LOG_FORMATS, { message: 'must be "json" or "pretty"' }).optional(),
  NEXT_PUBLIC_KEYSTONE_URL: httpUrl.optional(),
  NEXT_PUBLIC_CODEX_URL: httpUrl.optional(),
  NEXT_PUBLIC_VIGIE_URL: httpUrl.optional(),
  // Sign-in: src/server/auth/config.ts reads them at call time; validated here too so a production start fails on a bad value
  // instead of every sign-in, and the secrets are masked in the logs.
  ARCHE_AUTH: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(['demo', 'entra'], { message: 'must be "demo" or "entra"' }))
    .optional(),
  ARCHE_SESSION_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  ARCHE_SESSION_HOURS: z.coerce.number().int().min(1, 'must be at least 1').max(168, 'must be at most 168').optional(),
  ARCHE_ADMIN_EMAILS: z
    .string()
    .refine((v) => v.split(',').every((e) => normaliseEmail(e) != null), 'must be a comma-separated list of e-mail addresses')
    .transform((v) => [...new Set(v.split(',').map((e) => normaliseEmail(e)!))])
    .optional(),
  ENTRA_TENANT_ID: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'must be a GUID').optional(),
  ENTRA_ISSUER: httpUrl.optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),
  ENTRA_REDIRECT_URI: httpUrl.optional(),
  ENTRA_POST_LOGOUT_REDIRECT_URI: httpUrl.optional(),
  // Schema declaration to Matrix, the data catalogue (read by src/server/integrations/matrix after migrations and at start-up).
  MATRIX_URL: httpUrl.optional(),
  // Backups of the schema by the job worker (npm run worker): off unless the folder is set.
  ARCHE_BACKUP_DIR: z.string().optional(),
  ARCHE_BACKUP_EVERY_MIN: z.coerce.number().int().min(BACKUP_DEFAULTS.minEveryMin, `must be at least ${BACKUP_DEFAULTS.minEveryMin}`).max(10080, 'must be at most 10080').optional(),
  ARCHE_BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1, 'must be at least 1').max(3650, 'must be at most 3650').optional(),
  MATRIX_TOKEN: z.string().optional(),
  MATRIX_DECLARATIONS_DIR: z.string().optional(),
} as const;

export type ConfigVariable = keyof typeof VARS;
/** Every variable the configuration reads (the cache key of src/server/config/index.ts). */
export const CONFIG_VARIABLES = Object.keys(VARS) as ConfigVariable[];
/** Variables whose value is a secret (masked in logs, never echoed in messages). */
const SECRET_VARIABLES: ConfigVariable[] = ['ARCHE_SESSION_SECRET', 'ENTRA_CLIENT_SECRET', 'MATRIX_TOKEN'];

type Values = { [K in ConfigVariable]: z.output<(typeof VARS)[K]> };

const blank = (v: string | undefined) => {
  const s = v?.trim();
  return s ? s : undefined;
};

/** Password of a postgres:// URL (masked in logs). */
function urlPassword(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const p = new URL(url).password;
    return p ? decodeURIComponent(p) : null;
  } catch {
    return null;
  }
}

/** postgres://user:***@host:5432/db — a database URL safe to print. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '[invalid URL]';
  }
}

/**
 * Validates `env` and builds the configuration. Never throws: errors (invalid values, production requirements) and warnings
 * come back with a configuration where every invalid variable has its default.
 */
export function parseConfig(env: Record<string, string | undefined>, opts: { cwd: string }): ConfigResult {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];
  const values = {} as Record<ConfigVariable, unknown>;
  for (const name of CONFIG_VARIABLES) {
    const raw = blank(env[name]);
    const r = VARS[name].safeParse(raw);
    if (r.success) values[name] = r.data;
    else {
      values[name] = undefined;
      if (name === 'NODE_ENV') warnings.push({ variable: name, message: 'is not development, production or test; development is assumed' });
      else errors.push({ variable: name, message: r.error.issues[0]?.message ?? 'is invalid' });
    }
  }
  const v = values as Values;

  const runtime: RuntimeEnv = v.NODE_ENV ?? 'development';
  const production = runtime === 'production';
  const dataDir = v.ARCHE_DATA_DIR ? path.resolve(opts.cwd, v.ARCHE_DATA_DIR) : path.join(opts.cwd, '.data');
  const database: DatabaseConfig | null = v.DATABASE_URL ? { url: v.DATABASE_URL, poolMax: v.DATABASE_POOL_MAX ?? DEFAULT_POOL_MAX } : null;
  if (!v.DATABASE_URL && !errors.some((e) => e.variable === 'DATABASE_URL'))
    errors.push({ variable: 'DATABASE_URL', message: 'is required: Arche runs on PostgreSQL (on a developer machine, "npm run db:local" creates the database)' });

  if (production)
    for (const [name, app] of [['NEXT_PUBLIC_KEYSTONE_URL', 'Keystone'], ['NEXT_PUBLIC_CODEX_URL', 'Codex'], ['NEXT_PUBLIC_VIGIE_URL', 'Vigie']] as const)
      if (!v[name]) warnings.push({ variable: name, message: `is not set: links open ${app} on localhost` });

  // Demo mode in production: "View as" with no sign-in. Refused with the production data set (real people, no persona);
  // otherwise allowed (demonstrations behind HTTP authentication) with a warning when not chosen explicitly.
  if (production && v.ARCHE_AUTH !== 'entra') {
    if (v.ARCHE_SEED === 'production') errors.push({ variable: 'ARCHE_AUTH', message: 'must be "entra" with ARCHE_SEED=production (demo mode has no sign-in)' });
    else if (!v.ARCHE_AUTH) warnings.push({ variable: 'ARCHE_AUTH', message: 'is not set: demo mode ("View as", no sign-in) — set it to "entra" for real users, or "demo" explicitly' });
  }
  // Entra sign-in needs its secret and app registration; without them every page would answer the sign-in error.
  if (v.ARCHE_AUTH === 'entra') {
    const missing: [ConfigVariable, unknown][] = [
      ['ARCHE_SESSION_SECRET', v.ARCHE_SESSION_SECRET], ['ENTRA_CLIENT_ID', v.ENTRA_CLIENT_ID], ['ENTRA_CLIENT_SECRET', v.ENTRA_CLIENT_SECRET],
      ['ENTRA_REDIRECT_URI', v.ENTRA_REDIRECT_URI], ['ENTRA_TENANT_ID', v.ENTRA_TENANT_ID ?? v.ENTRA_ISSUER],
    ];
    for (const [name, value] of missing)
      if (!value && !errors.some((e) => e.variable === name)) errors.push({ variable: name, message: name === 'ENTRA_TENANT_ID' ? 'is required with ARCHE_AUTH=entra (or ENTRA_ISSUER)' : 'is required with ARCHE_AUTH=entra' });
  } else if (v.ARCHE_ADMIN_EMAILS?.length) warnings.push({ variable: 'ARCHE_ADMIN_EMAILS', message: 'is ignored outside ARCHE_AUTH=entra' });

  // A pinned date in production is a demonstration setting; real use needs the real clock.
  if (production && v.ARCHE_CLOCK?.kind === 'fixed')
    warnings.push({ variable: 'ARCHE_CLOCK', message: 'pins the business date in production: lateness, due dates and dated writes ignore the real date' });
  const secrets = [...SECRET_VARIABLES.map((n) => v[n] as string | undefined), urlPassword(v.DATABASE_URL), urlPassword(v.MATRIX_URL)].filter((s): s is string => !!s && s.length >= 4);

  return {
    errors,
    warnings,
    config: {
      env: runtime,
      production,
      dataDir,
      database,
      backup: {
        dir: v.ARCHE_BACKUP_DIR ? path.resolve(opts.cwd, v.ARCHE_BACKUP_DIR) : null,
        everyMin: v.ARCHE_BACKUP_EVERY_MIN ?? BACKUP_DEFAULTS.everyMin,
        retentionDays: v.ARCHE_BACKUP_RETENTION_DAYS ?? BACKUP_DEFAULTS.retentionDays,
      },
      seed: v.ARCHE_SEED ?? 'demo',
      seedExplicit: v.ARCHE_SEED != null,
      clock: v.ARCHE_CLOCK ?? null,
      log: { level: v.LOG_LEVEL ?? 'info', format: v.LOG_FORMAT ?? (production ? 'json' : 'pretty') },
      adminEmails: v.ARCHE_AUTH === 'entra' ? (v.ARCHE_ADMIN_EMAILS ?? []) : [],
      secrets: [...new Set(secrets)],
    },
  };
}

/** "DATABASE_URL must be a postgres:// URL; …" — one line per issue. */
export const formatIssues = (issues: ConfigIssue[]) => issues.map((i) => `${i.variable} ${i.message}`);
