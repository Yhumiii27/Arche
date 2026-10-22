// Journal of a CAPEX (docs/spec/08): its audit trail (append-only) and activity, newest first.
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { ROLE_LABEL, isRoleKey } from '@/config/roles';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtInstant } from '@/lib/format';
import { journalOf } from '@/server/dal/cycle';

export default async function JournalPage({ params }: PageProps<'/capex/[code]/journal'>) {
  const { t, lang, db, c } = await loadCapexPage(params);
  const rows = await journalOf(db, c.id);
  return (
    <>
      <PageHeader screen="capex-journal" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <SectionCard title={t('Journal')} hint={t(`${rows.length} entries`)} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('When')}</Th>
                <Th>{t('Who')}</Th>
                <Th>{t('Role')}</Th>
                <Th>{t('What')}</Th>
                <Th>{t('Reason')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <Td nowrap>{fmtInstant(r.at, lang)}</Td>
                  <Td>{r.who}</Td>
                  <Td tone="secondary">{r.role && isRoleKey(r.role) ? t(ROLE_LABEL[r.role]) : '—'}</Td>
                  <Td>{r.what}</Td>
                  <Td tone="secondary">{r.reason ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('Nothing recorded yet.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
