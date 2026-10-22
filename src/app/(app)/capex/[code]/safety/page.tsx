// Safety milestones of a CAPEX (docs/spec/03 §4, C-3, N-13): HS 2 → G1, HS 3 → G2, HS 4 → K3, PSSR before the start of
// commissioning (its discharge is a step of the G3 circuit), HS 6 → G3. Until Vigie publishes them (DEMANDES-VIGIE.md), the group HSE declares
// each status with the reference of its evidence; HS actions are Vigie's and appear once its connector exists.
import { Callout } from '@/components/app/Callout';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { PHASE_LABEL, labelOf } from '@/domain/capex-labels';
import { HS_LABEL, HS_MILESTONES, HS_STATUS_LABEL, hsBoard, type HsStatus } from '@/domain/safety';
import { loadCapexPage } from '@/features/capex/page-data';
import { HsForm } from '@/features/safety/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { hsOf } from '@/server/dal/execution';
import { codexDocumentUrl } from '@/server/integrations/codex';

const TONE: Record<HsStatus, 'accent' | 'outline' | 'neutral'> = { not_started: 'outline', in_progress: 'outline', passed: 'neutral', waived: 'neutral' };

export default async function SafetyPage({ params }: PageProps<'/capex/[code]/safety'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const board = hsBoard(await hsOf(db, c.id));
  const edit = can('safety');
  const done = board.filter((s) => s.status === 'passed' || s.status === 'waived').length;
  const pssr = board.find((s) => s.code === 'PSSR')!;
  return (
    <>
      <PageHeader screen="capex-safety" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <KpiGrid>
        <KpiTile label={t('Milestones passed')} value={`${done} / ${board.length}`} />
        <KpiTile label={t('PSSR')} value={t(HS_STATUS_LABEL[pssr.status])} sub={t('Discharge given by the group HSE in the G3 circuit')} />
        <KpiTile label={t('Source')} value={t('Declared by the group HSE')} sub={t('Vigie mirror when Vigie publishes the milestones')} />
      </KpiGrid>
      <SectionCard title={t('Safety milestones')} hint={t('A passed milestone carries the reference of its evidence (Vigie or Codex)')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Milestone')}</Th>
              <Th>{t('Phase')}</Th>
              <Th>{t('Content')}</Th>
              <Th>{t('Blocks')}</Th>
              <Th>{t('Status')}</Th>
              <Th>{t('Passed on')}</Th>
              <Th>{t('Evidence')}</Th>
              {edit && <Th />}
            </tr>
          </thead>
          <tbody>
            {board.map((s) => {
              const m = HS_MILESTONES.find((x) => x.code === s.code)!;
              const url = s.evidenceRef ? codexDocumentUrl(s.evidenceRef) : null;
              return (
                <tr key={s.code}>
                  <Td nowrap>{t(HS_LABEL[s.code])}</Td>
                  <Td tone="secondary">{t(labelOf(PHASE_LABEL, m.phase))}</Td>
                  <Td tone="secondary">{t(m.content)}</Td>
                  <Td nowrap>{m.blocks === 'mes' ? t('Start of commissioning') : m.blocks}</Td>
                  <Td>
                    <Tag tone={TONE[s.status]} size="sm">{t(HS_STATUS_LABEL[s.status])}</Tag>
                    {s.note && <div className="text-muted">{dataText(s.note, lang)}</div>}
                  </Td>
                  <Td nowrap>{fmtDate(s.passedOn, lang)}</Td>
                  <Td nowrap>{s.evidenceRef ? (url ? <a href={url} target="_blank" rel="noreferrer">{s.evidenceRef}</a> : s.evidenceRef) : '—'}</Td>
                  {edit && <Td align="right">{s.source === 'declared' && <HsForm code={c.code} hs={s} label={t(HS_LABEL[s.code])} />}</Td>}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </SectionCard>
      <Callout variant="outlined">{t('The HS actions are followed in Vigie; Arche shows them once Vigie publishes them.')}</Callout>
    </>
  );
}
