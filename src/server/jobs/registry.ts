import 'server-only';
// Arche's scheduled jobs: the schema backup (when ARCHE_BACKUP_DIR is set) and the daily schema declaration to Matrix (when
// MATRIX_URL or MATRIX_DECLARATIONS_DIR is set), the Keystone mirror (every ARCHE_KEYSTONE_SYNC_MIN minutes unless
// ARCHE_KEYSTONE=off), and the weekly snapshot of every active CAPEX (taken daily, one row per week: the dashboards' trends).
import path from 'node:path';
import { backupSchema } from '@/server/backup';
import { getConfig } from '@/server/config';
import { businessNow, businessToday } from '@/server/clock';
import { syncKeystone } from '@/server/integrations/keystone/mirror';
import { takeSnapshots } from '@/server/dal/governance';
import { declareArcheSchema } from '@/server/integrations/matrix';
import { matrixDeclarationEnabled } from '@/server/integrations/matrix/declare-schema';
import type { PostgresHandle } from '@/server/db/postgres';
import type { Job } from './runner';

export function archeJobs(h: PostgresHandle): Job[] {
  const cfg = getConfig();
  return [
    {
      name: 'backup',
      everyMin: cfg.backup.everyMin,
      enabled: !!cfg.backup.dir && !!cfg.database,
      async run() {
        const r = await backupSchema({ databaseUrl: cfg.database!.url, dir: cfg.backup.dir!, retentionDays: cfg.backup.retentionDays });
        return `${path.basename(r.file)}${r.deleted.length ? `, ${r.deleted.length} expired removed` : ''}`;
      },
    },
    {
      name: 'matrix-declare',
      everyMin: 1440,
      enabled: matrixDeclarationEnabled(process.env),
      async run() {
        await declareArcheSchema((q) => h.pool.query(q).then((r) => r.rows as Record<string, unknown>[]));
      },
    },
    {
      name: 'keystone-sync',
      everyMin: cfg.keystone.syncEveryMin,
      enabled: cfg.keystone.mode !== 'off' && !!cfg.database,
      async run() {
        const r = await syncKeystone(h.db, { now: await businessNow() });
        const failed = r.filter((x) => x.error);
        return `${r.reduce((a, x) => a + x.rows, 0)} rows${failed.length ? `, ${failed.length} view(s) not read` : ''}`;
      },
    },
    {
      name: 'weekly-snapshot',
      everyMin: 1440,
      enabled: !!cfg.database,
      async run() {
        return `${await takeSnapshots(h.db, await businessToday())} CAPEX`;
      },
    },
  ];
}
