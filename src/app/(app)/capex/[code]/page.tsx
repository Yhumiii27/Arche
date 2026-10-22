// CAPEX overview (docs/spec/08): delivery 1 shows its identity. A CAPEX outside the viewer's scope does not exist (404).
import { notFound } from 'next/navigation';
import { KeyValueList } from '@/components/app/KeyValueList';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { PHASE_LABEL, STATUS_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { dataText } from '@/i18n/data-text';
import { capexForViewer } from '@/server/dal/capex';
import { getI18n, getViewer } from '@/server/session';

export default async function CapexOverviewPage({ params }: PageProps<'/capex/[code]'>) {
  const { code } = await params;
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const c = await capexForViewer(viewer, decodeURIComponent(code));
  if (!c) notFound();
  return (
    <>
      <PageHeader screen="capex-overview" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <SectionCard title={t('Identity')}>
        <KeyValueList
          items={[
            { k: t('Code'), v: c.code },
            { k: t('Subsidiary'), v: dataText(c.subsidiaryName, lang) },
            { k: t('Zone'), v: dataText(c.zoneName, lang) },
            { k: t('Site'), v: dataText(c.siteName, lang) ?? '—' },
            { k: t('Phase'), v: t(labelOf(PHASE_LABEL, c.phase)) },
            { k: t('Typology'), v: c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : t('To be determined') },
            { k: t('Status'), v: t(labelOf(STATUS_LABEL, c.status)) },
            { k: t('Project lead'), v: c.leadName ?? '—' },
          ]}
        />
      </SectionCard>
    </>
  );
}
