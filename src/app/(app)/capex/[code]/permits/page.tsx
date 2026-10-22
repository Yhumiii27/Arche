// Permits register of a CAPEX (docs/spec/02 §3, 03 §3): ICPE, building permit, PLU, ATEX and others, with their filing, expected
// decision and obtained dates and the Codex reference of their file. G2 needs the ICPE and the building permit filed (obtained
// or with a known decision date); a filed permit whose decision is due within 30 days is flagged (spec 06 §7).
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { refOf } from '@/domain/capex';
import { PERMIT_KIND_LABEL, PERMIT_STATUS_LABEL, permitsDue, permitsFact } from '@/domain/permits';
import { loadCapexPage } from '@/features/capex/page-data';
import { PermitForm } from '@/features/delivery/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { permitsOf } from '@/server/dal/execution';
import { codexDocumentUrl } from '@/server/integrations/codex';

export default async function PermitsPage({ params }: PageProps<'/capex/[code]/permits'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const [rows, today] = await Promise.all([permitsOf(db, c.id), businessToday(db)]);
  const edit = can('edit');
  const fact = permitsFact(rows);
  const due = new Set(permitsDue(rows, today).map((p) => p.id));
  return (
    <>
      <PageHeader screen="capex-permits" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} primary={edit ? <PermitForm code={c.code} primary /> : undefined} />
      <KpiGrid>
        <KpiTile label={t('Permits')} value={String(rows.length)} sub={`${rows.filter((p) => p.status === 'obtained').length} ${t('obtained')}`} />
        <KpiTile label={t('ICPE and building permit')} value={fact.value} sub={t('filed with a known decision date, or obtained')} tone={fact.met ? 'default' : 'alert'} />
        <KpiTile label={t('Decisions due within 30 days')} value={String(due.size)} tone={due.size ? 'alert' : 'default'} />
      </KpiGrid>
      <SectionCard title={t('Permits register')} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Permit')}</Th>
                <Th>{t('Kind')}</Th>
                <Th>{t('Authority')}</Th>
                <Th>{t('Filed on')}</Th>
                <Th>{t('Expected decision')}</Th>
                <Th>{t('Obtained on')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('Codex reference')}</Th>
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const url = p.codexRef ? codexDocumentUrl(p.codexRef) : null;
                return (
                  <tr key={p.id}>
                    <Td nowrap>{refOf('AUT', p.number)}</Td>
                    <Td>
                      {dataText(p.title, lang)}
                      {p.note && <div className="text-muted">{dataText(p.note, lang)}</div>}
                    </Td>
                    <Td tone="secondary">{t(PERMIT_KIND_LABEL[p.kind])}</Td>
                    <Td tone="secondary">{dataText(p.authority, lang) ?? '—'}</Td>
                    <Td nowrap>{fmtDate(p.filedOn, lang)}</Td>
                    <Td nowrap>
                      {fmtDate(p.dueOn, lang)} {due.has(p.id) && <Tag tone="accent" size="xs">{t(p.dueOn! < today ? 'Overdue' : 'Due soon')}</Tag>}
                    </Td>
                    <Td nowrap>{fmtDate(p.obtainedOn, lang)}</Td>
                    <Td>{t(PERMIT_STATUS_LABEL[p.status])}</Td>
                    <Td nowrap>{p.codexRef ? (url ? <a href={url} target="_blank" rel="noreferrer">{p.codexRef}</a> : p.codexRef) : '—'}</Td>
                    {edit && <Td align="right"><PermitForm code={c.code} permit={p} /></Td>}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No permit recorded.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
