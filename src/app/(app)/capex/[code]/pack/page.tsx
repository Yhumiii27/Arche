// Engineering pack of a CAPEX (C-9, docs/spec/03 §3): the subsidiary's items of the standard list (weighted by family, each
// validated item carrying its Codex reference) and EPC2i's part read in Keystone (pub_pack_ingenierie), with the weighted % that
// G2 needs above the threshold of the model.
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { EPC2I_FAMILY_LABEL, PACK_FAMILIES, PACK_ITEM_STATUS_LABEL, PACK_TEMPLATE, packFact } from '@/domain/pack';
import { loadCapexPage } from '@/features/capex/page-data';
import { PackItemForm } from '@/features/delivery/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtNum } from '@/lib/format';
import { modelValues } from '@/server/dal/cycle';
import { packOf } from '@/server/dal/execution';
import { codexDocumentUrl } from '@/server/integrations/codex';
import { keystoneProjectUrl } from '@/server/integrations/keystone';

const pct = (n: number | null, lang: 'fr' | 'en') => (n == null ? '—' : `${fmtNum(n, lang)} %`);

export default async function PackPage({ params }: PageProps<'/capex/[code]/pack'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const [{ items, projects, summary }, values] = await Promise.all([packOf(db, c), modelValues(db)]);
  const edit = can('edit');
  const fact = packFact(summary, values.packThresholdPct);
  return (
    <>
      <PageHeader screen="capex-pack" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <KpiGrid>
        <KpiTile label={t('Weighted pack')} value={pct(summary.pct, lang)} sub={`${t('G2 needs more than')} ${values.packThresholdPct} %`} tone={fact.met ? 'default' : 'alert'} />
        <KpiTile label={t('Subsidiary part')} value={pct(summary.subsidiary.pct, lang)} />
        <KpiTile label={t('EPC2i part')} value={pct(summary.epc2i.pct, lang)} sub={projects.length ? `${projects.length} ${t('EPC2i project(s)')}` : t('No EPC2i project yet')} />
        <KpiTile label={t('EPC2i share of the pack')} value={pct(summary.epc2iSharePct, lang)} />
      </KpiGrid>
      <SectionCard title={t('Subsidiary part')} hint={t('Standard list to be provided (C-9): five families of equal weight until then')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Family')}</Th>
              <Th>{t('Item')}</Th>
              <Th>{t('Status')}</Th>
              <Th>{t('Codex reference')}</Th>
              <Th>{t('Validated on')}</Th>
              {edit && <Th />}
            </tr>
          </thead>
          <tbody>
            {PACK_FAMILIES.flatMap((f) => {
              const fam = summary.subsidiary.families.find((x) => x.code === f.code)!;
              return PACK_TEMPLATE.filter((i) => i.family === f.code).map((i, k) => {
                const st = items.find((x) => x.code === i.code) ?? { code: i.code, status: 'expected' as const, codexRef: null, validatedOn: null };
                const url = st.codexRef ? codexDocumentUrl(st.codexRef) : null;
                return (
                  <tr key={i.code}>
                    <Td tone="secondary">{k === 0 ? `${t(f.label)} · ${fam.validated} / ${fam.expected}` : ''}</Td>
                    <Td>{t(i.label)}</Td>
                    <Td><Tag tone={st.status === 'validated' ? 'neutral' : 'outline'} size="sm">{t(PACK_ITEM_STATUS_LABEL[st.status])}</Tag></Td>
                    <Td nowrap>{st.codexRef ? (url ? <a href={url} target="_blank" rel="noreferrer">{st.codexRef}</a> : st.codexRef) : '—'}</Td>
                    <Td nowrap>{fmtDate(st.validatedOn, lang)}</Td>
                    {edit && <Td align="right"><PackItemForm code={c.code} item={st} label={t(i.label)} /></Td>}
                  </tr>
                );
              });
            })}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title={t('EPC2i part')} hint={t('Read in Keystone: items expected and validated by family of each EPC2i project')} scroll>
        {projects.some((p) => p.pack.length) ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('EPC2i project')}</Th>
                <Th>{t('Family')}</Th>
                <Th align="right">{t('Validated')}</Th>
                <Th align="right">{t('Expected')}</Th>
                <Th align="right">{t('Weight')}</Th>
              </tr>
            </thead>
            <tbody>
              {projects.flatMap((p) => p.pack.map((f, k) => {
                const url = keystoneProjectUrl(p.code);
                return (
                  <tr key={`${p.code}/${f.family}`}>
                    <Td nowrap>{k === 0 ? (url ? <a href={url} target="_blank" rel="noreferrer">{p.code}</a> : p.code) : ''}</Td>
                    <Td>{t(EPC2I_FAMILY_LABEL[f.family] ?? f.family)}</Td>
                    <Td align="right" numeric>{f.validated}</Td>
                    <Td align="right" numeric>{f.expected}</Td>
                    <Td align="right" numeric>{fmtNum(f.weight, lang)}</Td>
                  </tr>
                );
              }))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('EPC2i publishes its part of the pack for the projects of the CAPEX; none yet.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
