import 'server-only';
// The only writer of the Keystone mirror (arche.keystone_mirror, arche.keystone_sync). For each view of the contract:
// - `views` mode: keystone.<view> when the EPC2I server shares it with Arche; a view not shared yet is simulated on the
//   demonstration data set (mixed mode, spec 07 §2) and left empty elsewhere, with the reason recorded;
// - `simulation` mode: every view simulated (demonstration data set only: real needs never get simulated answers);
// - `off`: nothing is read, the mirror is kept as it is.
// A synchronisation replaces the rows of each view (full refresh: the views are small).
import { eq, sql } from 'drizzle-orm';
import { getConfig } from '@/server/config';
import { databaseSeedMode } from '@/server/db/seed/mode';
import { keystoneMirror, keystoneSync } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { simulateKeystone, type PublishedNeed } from './simulation';
import { KEYSTONE_VIEWS, type KeystoneRow, type KeystoneViewName } from './views';

type Q = DB | Tx;
export type KeystoneMode = 'off' | 'simulation' | 'views';

export interface SyncReport {
  view: KeystoneViewName;
  source: 'views' | 'simulation' | 'off';
  rows: number;
  error: string | null;
}

/** True when the server shares keystone.<view> with the current role. */
async function shared(q: Q, view: string): Promise<boolean> {
  const name = `keystone.${view}`;
  const r = await q.execute(sql`select to_regclass(${name}) is not null and has_table_privilege(current_user, ${name}, 'select') as ok`);
  return !!(r.rows[0] as { ok?: boolean } | undefined)?.ok;
}

async function readView(q: Q, view: string): Promise<KeystoneRow[]> {
  // to_jsonb gives dates as ISO strings, whatever the column types are; the view name comes from KEYSTONE_VIEWS only.
  const r = await q.execute(sql.raw(`select to_jsonb(v) as row from keystone.${view} v`));
  return (r.rows as { row: KeystoneRow }[]).map((x) => x.row);
}

async function publishedNeeds(q: Q): Promise<PublishedNeed[]> {
  const r = await q.execute(sql`select to_jsonb(v) as row from arche.pub_besoins_machines v`);
  return (r.rows as { row: PublishedNeed }[]).map((x) => ({ ...x.row, options: Array.isArray(x.row.options) ? x.row.options : [] }));
}

async function replace(q: Q, def: (typeof KEYSTONE_VIEWS)[number], rows: KeystoneRow[], at: Date) {
  await q.delete(keystoneMirror).where(eq(keystoneMirror.view, def.view));
  const seen = new Set<string>();
  const values = rows.flatMap((r) => {
    const key = def.key(r);
    if (seen.has(key)) return [];
    seen.add(key);
    const d = def as { capex?: (r: KeystoneRow) => string | null; project?: (r: KeystoneRow) => string | null; need?: (r: KeystoneRow) => string | null };
    const maj = typeof r.maj_le === 'string' ? new Date(r.maj_le) : null;
    return [{ view: def.view, key, capexCode: d.capex?.(r) ?? null, projectCode: d.project?.(r) ?? null, needRef: d.need?.(r) ?? null, data: r, updatedAtSource: maj && !Number.isNaN(maj.getTime()) ? maj : null, syncedAt: at }];
  });
  for (let i = 0; i < values.length; i += 500) await q.insert(keystoneMirror).values(values.slice(i, i + 500));
  return values.length;
}

async function record(q: Q, r: SyncReport, at: Date) {
  await q.insert(keystoneSync).values({ view: r.view, source: r.source, rows: r.rows, syncedAt: at, error: r.error })
    .onConflictDoUpdate({ target: keystoneSync.view, set: { source: r.source, rows: r.rows, syncedAt: at, error: r.error } });
}

/** Synchronises the mirror; returns one report per view. */
export async function syncKeystone(q: Q, opts: { now: Date; mode?: KeystoneMode }): Promise<SyncReport[]> {
  const mode = opts.mode ?? getConfig().keystone.mode;
  const at = new Date();
  if (mode === 'off') {
    const reports = KEYSTONE_VIEWS.map((d) => ({ view: d.view, source: 'off' as const, rows: 0, error: null }));
    for (const r of reports) await record(q, r, at);
    return reports;
  }
  const demo = (await databaseSeedMode(q)) === 'demo';
  let simulated: Record<KeystoneViewName, KeystoneRow[]> | null = null;
  const simulation = async () => (simulated ??= simulateKeystone(await publishedNeeds(q), opts.now));
  const reports: SyncReport[] = [];
  for (const def of KEYSTONE_VIEWS) {
    let report: SyncReport;
    try {
      // One savepoint per view: a view that fails leaves the others and its previous rows as they were.
      report = await q.transaction(async (tx) => {
        if (mode === 'views' && (await shared(tx, def.view))) return { view: def.view, source: 'views' as const, rows: await replace(tx, def, await readView(tx, def.view), at), error: null };
        if (demo) return { view: def.view, source: 'simulation' as const, rows: await replace(tx, def, (await simulation())[def.view], at), error: null };
        return { view: def.view, source: mode, rows: await replace(tx, def, [], at), error: mode === 'views' ? 'View not shared by Keystone yet' : 'Simulation is for the demonstration data set only' };
      });
    } catch (e) {
      report = { view: def.view, source: mode, rows: 0, error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
    }
    await record(q, report, at);
    reports.push(report);
  }
  return reports;
}
