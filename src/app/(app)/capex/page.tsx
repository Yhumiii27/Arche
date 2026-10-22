// CAPEX register (docs/spec/08): the CAPEX of the viewer's scope only (subsidiary isolation in the data layer); a sponsor or a
// project lead creates a draft in their subsidiary.
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { screenHref } from '@/config/screens';
import { creatableSubsidiaries } from '@/domain/capex';
import { NewCapexForm } from '@/features/capex/forms';
import { PHASE_LABEL, STATUS_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { dataText } from '@/i18n/data-text';
import { siteOptions, visibleCapex } from '@/server/dal/capex';
import { getI18n, getViewer } from '@/server/session';

export default async function CapexRegisterPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const rows = await visibleCapex(viewer);
  const creatable = creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode);
  const sites = (await Promise.all(creatable.map(async (sub) => (await siteOptions(sub)).map((o) => ({ ...o, label: creatable.length > 1 ? `${sub} · ${dataText(o.label, lang)}` : dataText(o.label, lang), subsidiary: sub }))))).flat();
  return (
    <>
      <PageHeader screen="capex-list" crumbs={['Steering']} />
      {creatable.length > 0 && (
        <SectionCard title={t('New CAPEX')} subtitle={t('The draft stays inside the subsidiary until the sponsor opens it.')}>
          <NewCapexForm subsidiaries={creatable.map((c) => ({ value: c, label: c }))} sites={sites} />
        </SectionCard>
      )}
      <SectionCard title={t('CAPEX')} hint={t(`${rows.length} CAPEX`)} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Code')}</Th>
                <Th>{t('Title')}</Th>
                <Th>{t('Subsidiary')}</Th>
                <Th>{t('Site')}</Th>
                <Th>{t('Phase')}</Th>
                <Th>{t('Typology')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('Project lead')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.code}>
                  <Td nowrap>
                    <Link href={screenHref('capex-overview', { code: c.code })}>{c.code}</Link>
                  </Td>
                  <Td>{dataText(c.title, lang)}</Td>
                  <Td>{dataText(c.subsidiaryName, lang)}</Td>
                  <Td tone="secondary">{dataText(c.siteName, lang) ?? '—'}</Td>
                  <Td nowrap>{t(labelOf(PHASE_LABEL, c.phase))}</Td>
                  <Td>{c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : t('To be determined')}</Td>
                  <Td>{t(labelOf(STATUS_LABEL, c.status))}</Td>
                  <Td tone="secondary">{c.leadName ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No CAPEX in your scope.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
