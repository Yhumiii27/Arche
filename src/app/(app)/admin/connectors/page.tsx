// Connectors (docs/spec/07 §2): the state of the Keystone mirror view by view — source (Keystone's shared view or the
// simulation), rows, last synchronisation, reason when a view is not read — with a "synchronise now" button, and the Codex
// connector. The worker synchronises every ARCHE_KEYSTONE_SYNC_MIN minutes.
import { sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/app/ActionForm';
import { KeyValueList } from '@/components/app/KeyValueList';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee } from '@/config/screens';
import { syncKeystoneAction } from '@/features/admin/actions';
import { fmtInstant } from '@/lib/format';
import { getConfig } from '@/server/config';
import { getDb } from '@/server/db/client';
import { databaseSeedMode } from '@/server/db/seed/mode';
import { syncState } from '@/server/integrations/keystone';
import { KEYSTONE_VIEW_NAMES } from '@/server/integrations/keystone/views';
import { getI18n, getViewer } from '@/server/session';

const SOURCE: Record<string, string> = { views: 'Shared view', simulation: 'Simulation', off: 'Off' };
const MODE: Record<string, string> = { off: 'Off', simulation: 'Simulation', views: 'Shared views (simulation of the missing ones on the demonstration data set)' };

export default async function ConnectorsPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-connectors')) notFound();
  const db = await getDb();
  const cfg = getConfig().keystone;
  const [state, seed, codex] = await Promise.all([
    syncState(db), databaseSeedMode(db),
    db.execute(sql`select to_regclass('codex.pub_documents') is not null and has_table_privilege(current_user, 'codex.pub_documents', 'select') as ok`),
  ]);
  const codexShared = !!(codex.rows[0] as { ok?: boolean } | undefined)?.ok;
  return (
    <>
      <PageHeader screen="admin-connectors" crumbs={['Administration']} />
      <SectionCard title="Keystone" subtitle={`${t('Mode')}: ${t(MODE[cfg.mode])} · ${t('every')} ${cfg.syncEveryMin} min`} actions={viewer.role === 'admin' ? <ActionButton run={syncKeystoneAction} label="Synchronise now" done="Synchronised" /> : undefined} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('View')}</Th>
              <Th>{t('Source')}</Th>
              <Th align="right">{t('Rows')}</Th>
              <Th>{t('Synchronised')}</Th>
              <Th>{t('Note')}</Th>
            </tr>
          </thead>
          <tbody>
            {KEYSTONE_VIEW_NAMES.map((v) => {
              const s = state.find((x) => x.view === v);
              return (
                <tr key={v}>
                  <Td nowrap>{`keystone.${v}`}</Td>
                  <Td>{s ? <Tag tone={s.source === 'views' ? 'neutral' : 'outline'} size="sm">{t(SOURCE[s.source])}</Tag> : '—'}</Td>
                  <Td align="right">{s?.rows ?? '—'}</Td>
                  <Td nowrap>{s ? fmtInstant(s.syncedAt, lang) : t('Never')}</Td>
                  <Td tone="secondary">{s?.error ? t(s.error) : '—'}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title="Codex">
        <KeyValueList
          items={[
            { k: 'codex.pub_documents', v: codexShared ? t('Shared: references are checked in Codex') : seed === 'demo' ? t('Not shared: simulated catalogue of the demonstration data set') : t('Not shared: references stay not verified') },
            { k: t('Deep links'), v: process.env.NEXT_PUBLIC_CODEX_URL ?? t('NEXT_PUBLIC_CODEX_URL is not set') },
          ]}
        />
      </SectionCard>
    </>
  );
}
