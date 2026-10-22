// Living dossiers of a CAPEX (docs/spec/04): the three dossiers, their latest version, state and completeness.
import Link from 'next/link';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { DOSSIER_KINDS, DOSSIER_LABEL, VERSION_STATE_LABEL } from '@/domain/dossiers';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { dossierVersionsOf, versionCompleteness } from '@/server/dal/dossiers';

const GATE_OF: Record<string, string> = { business_case: 'G1', investment: 'G2', transfer: 'G3' };

export default async function DossiersPage({ params }: PageProps<'/capex/[code]/dossiers'>) {
  const { t, lang, db, c } = await loadCapexPage(params);
  const rows = await Promise.all(DOSSIER_KINDS.map(async (kind) => {
    const [v] = await dossierVersionsOf(db, c.id, kind);
    return { kind, v, pct: v ? await versionCompleteness(db, c, kind, v) : 0 };
  }));
  return (
    <>
      <PageHeader screen="capex-dossiers" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <SectionCard title={t('Living dossiers')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Dossier')}</Th>
              <Th>{t('Gate')}</Th>
              <Th>{t('Version')}</Th>
              <Th>{t('State')}</Th>
              <Th align="right">{t('Completeness')}</Th>
              <Th>{t('Frozen on')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ kind, v, pct }) => (
              <tr key={kind}>
                <Td><Link href={`/capex/${encodeURIComponent(c.code)}/dossiers/${kind}`}>{t(DOSSIER_LABEL[kind])}</Link></Td>
                <Td>{GATE_OF[kind]}</Td>
                <Td>{v ? `v${v.number}` : '—'}</Td>
                <Td>{v ? t(VERSION_STATE_LABEL[v.state]) : t('Not started')}</Td>
                <Td align="right" numeric>{v ? `${pct} %` : '—'}</Td>
                <Td nowrap>{fmtDate(v?.frozenAt, lang)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </>
  );
}
