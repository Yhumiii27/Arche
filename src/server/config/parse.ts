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
  /** Keystone connector: mode and minutes between two synchronisations of its mirror (docs/spec/07 §2). */
  keystone: { mode: 'off' | 'simulation' | 'views'; syncEveryMin: number };
  /** E-mail notifications (AR-041): `none` keeps them in the outbox (default, N-35: SMTP or Microsoft Graph to choose), `file`
   * writes each one to `dir` (one .eml per message); `from` is the sender, `publicUrl` the origin of the links. */
  mail: { transport: 'none' | 'file'; dir: string | null; from: string; publicUrl: string | null };
  /** Folder of Sage's planned extractions (AR-047): `<SUBSIDIARY>*.csv`, imported by the job `sage-import`, then moved to
   * `done/`; null = no planned extraction (files uploaded on the Sage import page). */
  sageDir: string | null;
  /** Vigie connector (AR-033). */
  vigie: { mode: 'off' | 'simulation' | 'views' };
  /** Advanced signature of the G2 / AFE (AR-037). */
  signature: { provider: 'none' | 'simulation' | 'yousign'; yousignUrl: string; yousignKey: string | null };
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
  // Deposit of documents in Codex (CX-03, src/server/integrations/codex/deposit.ts): server URL (credentials = HTTP
  // authentication of the host), bearer token and/or HMAC secret of POST /api/documents; neither proof = deposit off.
  CODEX_API_URL: httpUrl.optional(),
  CODEX_DOCUMENTS_TOKEN: z.string().optional(),
  CODEX_DOCUMENTS_SECRET: z.string().min(16, 'must be at least 16 characters').optional(),
  // Schema declaration to Matrix, the data catalogue (read by src/server/integrations/matrix after migrations and at start-up).
  MATRIX_URL: httpUrl.optional(),
  // Backups of the schema by the job worker (npm run worker): off unless the folder is set.
  ARCHE_BACKUP_DIR: z.string().optional(),
  ARCHE_BACKUP_EVERY_MIN: z.coerce.number().int().min(BACKUP_DEFAULTS.minEveryMin, `must be at least ${BACKUP_DEFAULTS.minEveryMin}`).max(10080, 'must be at most 10080').optional(),
  ARCHE_BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1, 'must be at least 1').max(3650, 'must be at most 3650').optional(),
  MATRIX_TOKEN: z.string().optional(),
  MATRIX_DECLARATIONS_DIR: z.string().optional(),
  // Keystone connector (docs/spec/07 §2): off, simulation (default) or views (keystone.pub_*; a view not shared yet is simulated on the demonstration data set only).
  ARCHE_KEYSTONE: z.enum(['off', 'simulation', 'views'], { message: 'must be "off", "simulation" or "views"' }).optional(),
  // Minutes between two synchronisations of the Keystone mirror by the worker (default 15).
  ARCHE_KEYSTONE_SYNC_MIN: z.coerce.number().int().min(1, 'must be at least 1').max(1440, 'must be at most 1440').optional(),
  // E-mail notifications (AR-041): none (default: kept in the outbox), or file (one .eml per message in ARCHE_MAIL_DIR).
  ARCHE_MAIL_TRANSPORT: z.enum(['none', 'file'], { message: 'must be "none" or "file" (SMTP or Microsoft Graph: N-35)' }).optional(),
  ARCHE_MAIL_DIR: z.string().optional(),
  ARCHE_MAIL_FROM: z.string().email('must be an e-mail address').optional(),
  // Origin of the links in the e-mails (https://arche.example); relative links without it.
  ARCHE_PUBLIC_URL: z.string().optional(),
  // Folder of Sage's planned extractions (AR-047); unset: uploads only.
  ARCHE_SAGE_DIR: z.string().optional(),
  // Vigie connector (AR-033): off, simulation (default; the demonstration data set only) or views (vigie.pub_etudes_securite;
  // not shared yet: simulated on the demonstration data set only).
  ARCHE_VIGIE: z.enum(['off', 'simulation', 'views'], { message: 'must be "off", "simulation" or "views"' }).optional(),
  // Advanced electronic signature of the G2 / AFE (AR-037, C-7): none (default: simple signature as everywhere), simulation
  // (a page of Arche stands for the provider: demonstrations and tests) or yousign (ARCHE_YOUSIGN_API_KEY, ARCHE_PUBLIC_URL).
  ARCHE_SIGNATURE_PROVIDER: z.enum(['none', 'simulation', 'yousign'], { message: 'must be "none", "simulation" or "yousign"' }).optional(),
  ARCHE_YOUSIGN_API_URL: httpUrl.optional(),
  ARCHE_YOUSIGN_API_KEY: z.string().optional(),
} as const;

export type ConfigVariable = keyof typeof VARS;
/** Every variable the configuration reads (the cache key of src/server/config/index.ts). */
export const CONFIG_VARIABLES = Object.keys(VARS) as ConfigVariable[];
/** Variables whose value is a secret (masked in logs, never echoed in messages). */
const SECRET_VARIABLES: ConfigVariable[] = ['ARCHE_SESSION_SECRET', 'ENTRA_CLIENT_SECRET', 'MATRIX_TOKEN', 'ARCHE_YOUSIGN_API_KEY', 'CODEX_DOCUMENTS_TOKEN', 'CODEX_DOCUMENTS_SECRET'];

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

  // The deposit token goes in the Authorization header, which credentials in the Codex URL (HTTP authentication) use already.
  if (v.CODEX_DOCUMENTS_TOKEN && v.CODEX_API_URL && new URL(v.CODEX_API_URL).username)
    errors.push({ variable: 'CODEX_DOCUMENTS_TOKEN', message: 'cannot go with credentials in CODEX_API_URL (both use the Authorization header): use CODEX_DOCUMENTS_SECRET' });
  // A pinned date in production is a demonstration setting; real use needs the real clock.
  if (v.ARCHE_MAIL_TRANSPORT === 'file' && !v.ARCHE_MAIL_DIR) errors.push({ variable: 'ARCHE_MAIL_DIR', message: 'is required with ARCHE_MAIL_TRANSPORT=file' });
  if (v.ARCHE_PUBLIC_URL && !isUrlWith(v.ARCHE_PUBLIC_URL, ['http:', 'https:'])) errors.push({ variable: 'ARCHE_PUBLIC_URL', message: 'must be an http(s) URL' });
  // Yousign needs its key and Arche's public address (the signer comes back to it).
  if (v.ARCHE_SIGNATURE_PROVIDER === 'yousign') {
    if (!v.ARCHE_YOUSIGN_API_KEY) errors.push({ variable: 'ARCHE_YOUSIGN_API_KEY', message: 'is required with ARCHE_SIGNATURE_PROVIDER=yousign' });
    if (!v.ARCHE_PUBLIC_URL) errors.push({ variable: 'ARCHE_PUBLIC_URL', message: 'is required with ARCHE_SIGNATURE_PROVIDER=yousign (the signer comes back to Arche)' });
  }
  if (production && v.ARCHE_SIGNATURE_PROVIDER === 'simulation' && v.ARCHE_AUTH === 'entra')
    warnings.push({ variable: 'ARCHE_SIGNATURE_PROVIDER', message: 'is "simulation" with real users: the G2 signature is not an advanced electronic signature' });
  if (production && v.ARCHE_CLOCK?.kind === 'fixed')
    warnings.push({ variable: 'ARCHE_CLOCK', message: 'pins the business date in production: lateness, due dates and dated writes ignore the real date' });
  const secrets = [...SECRET_VARIABLES.map((n) => v[n] as string | undefined), urlPassword(v.DATABASE_URL), urlPassword(v.MATRIX_URL), urlPassword(v.CODEX_API_URL)].filter((s): s is string => !!s && s.length >= 4);

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
      keystone: { mode: v.ARCHE_KEYSTONE ?? 'simulation', syncEveryMin: v.ARCHE_KEYSTONE_SYNC_MIN ?? 15 },
      mail: {
        transport: v.ARCHE_MAIL_TRANSPORT ?? 'none',
        dir: v.ARCHE_MAIL_DIR ? path.resolve(opts.cwd, v.ARCHE_MAIL_DIR) : null,
        from: v.ARCHE_MAIL_FROM ?? 'arche@groupe.example',
        publicUrl: v.ARCHE_PUBLIC_URL ? trimSlash(v.ARCHE_PUBLIC_URL) : null,
      },
      sageDir: v.ARCHE_SAGE_DIR ? path.resolve(opts.cwd, v.ARCHE_SAGE_DIR) : null,
      vigie: { mode: v.ARCHE_VIGIE ?? 'simulation' },
      signature: {
        provider: v.ARCHE_SIGNATURE_PROVIDER ?? 'none',
        yousignUrl: trimSlash(v.ARCHE_YOUSIGN_API_URL ?? 'https://api-sandbox.yousign.app/v3'),
        yousignKey: v.ARCHE_YOUSIGN_API_KEY ?? null,
      },
      secrets: [...new Set(secrets)],
    },
  };
}

/** "DATABASE_URL must be a postgres:// URL; …" — one line per issue. */
export const formatIssues = (issues: ConfigIssue[]) => issues.map((i) => `${i.variable} ${i.message}`);
