import 'server-only';
// Arche's scheduled jobs: the schema backup (when ARCHE_BACKUP_DIR is set) and the daily schema declaration to Matrix (when
// MATRIX_URL or MATRIX_DECLARATIONS_DIR is set), the Keystone mirror (every ARCHE_KEYSTONE_SYNC_MIN minutes unless
// ARCHE_KEYSTONE=off), the weekly snapshot of every active CAPEX (taken daily, one row per week: the dashboards' trends), and
// the business API's webhooks (AR-048: deliveries every minute, new alerts every hour) and the circuits' e-mail notifications
// (AR-041: every 15 minutes), Sage's planned extractions (AR-047: every hour, when ARCHE_SAGE_DIR is set), the advanced
// signatures under way at Yousign (AR-037: every 10 minutes).
import path from 'node:path';
import { backupSchema } from '@/server/backup';
import { getConfig } from '@/server/config';
import { businessNow, businessToday } from '@/server/clock';
import { syncKeystone } from '@/server/integrations/keystone/mirror';
import { takeSnapshots } from '@/server/dal/governance';
import { deliverWebhooks, raiseAlerts } from '@/server/api/deliver';
import { deliverEmails } from '@/server/notify/deliver';
import { planNotices } from '@/server/notify/plan';
import { importSageFolder } from '@/server/integrations/sage/folder';
import { refreshSignatureRequests } from '@/server/signature/status';
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
      // Business API webhooks (AR-048): the due deliveries of the outbox, and the alerts newly raised (`alert.raised`).
      name: 'webhooks',
      everyMin: 1,
      enabled: !!cfg.database,
      async run() {
        const r = await deliverWebhooks(h.db, new Date());
        return r.sent || r.failed ? `${r.sent} sent, ${r.failed} failed` : 'nothing due';
      },
    },
    {
      name: 'alerts-raised',
      everyMin: 60,
      enabled: !!cfg.database,
      async run() {
        return `${await raiseAlerts(h.db, await businessToday(), new Date())} new alert(s)`;
      },
    },
    {
      // Circuit notifications (AR-041): the notices due today written to the outbox, then sent by ARCHE_MAIL_TRANSPORT.
      name: 'notifications',
      everyMin: 15,
      enabled: !!cfg.database,
      async run() {
        const queued = await planNotices(h.db, await businessToday());
        const r = await deliverEmails(h.db, cfg.mail, new Date());
        return `${queued} queued, ${r.sent} sent, ${r.held} held${r.failed ? `, ${r.failed} failed` : ''}`;
      },
    },
    {
      // Sage's planned extractions (AR-047), when ARCHE_SAGE_DIR is set.
      name: 'sage-import',
      everyMin: 60,
      enabled: !!cfg.database && !!cfg.sageDir,
      async run() {
        return importSageFolder(h.db, cfg.sageDir!, await businessToday());
      },
    },
    {
      // The advanced signatures under way at Yousign (AR-037): declined or expired ones closed.
      name: 'signature-status',
      everyMin: 10,
      enabled: !!cfg.database && cfg.signature.provider === 'yousign',
      async run() {
        return `${await refreshSignatureRequests(h.db)} request(s) changed`;
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
