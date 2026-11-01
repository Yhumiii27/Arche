// Safety milestones of a CAPEX (docs/spec/03 §4, C-3, N-13): HS 2 → G1, HS 3 → G2, HS 4 → K3, PSSR before the start of
// commissioning (its discharge is a step of the G3 circuit), HS 6 → G3. A milestone with process safety studies in Vigie takes its
// status from them (AR-033: HazID, HazOp / FMEA, site inspection, PSSR with the RSPDI, ASPD, with their recommendations and links
// to Vigie); the others are declared by the group HSE with the reference of their evidence (N-13).
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
import { recommendationsOf, STUDY_CONCLUSION_LABEL, STUDY_STATUS_LABEL, STUDY_TYPE_LABEL } from '@/domain/process-safety';
import { studiesOf } from '@/server/integrations/vigie/sync';
import { hsOf } from '@/server/dal/execution';
import { codexDocumentUrl } from '@/server/integrations/codex';

const TONE: Record<HsStatus, 'accent' | 'outline' | 'neutral'> = { not_started: 'outline', in_progress: 'outline', passed: 'neutral', waived: 'neutral' };

export default async function SafetyPage({ params }: PageProps<'/capex/[code]/safety'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const [rows, studies] = await Promise.all([hsOf(db, c.id), studiesOf(db, [c.code])]);
  const board = hsBoard(rows);
  const recs = recommendationsOf(studies);
  const fromVigie = board.filter((s) => s.source === 'vigie').length;
  const edit = can('safety');
  const done = board.filter((s) => s.status === 'passed' || s.status === 'waived').length;
  const pssr = board.find((s) => s.code === 'PSSR')!;
  return (
    <>
      <PageHeader screen="capex-safety" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <KpiGrid>
        <KpiTile label={t('Milestones passed')} value={`${done} / ${board.length}`} />
        <KpiTile label={t('PSSR')} value={t(HS_STATUS_LABEL[pssr.status])} sub={t('Discharge given by the group HSE in the G3 circuit')} />
        <KpiTile label={t('Held in Vigie')} value={`${fromVigie} / ${board.length}`} sub={t('the other milestones are declared by the group HSE')} />
        <KpiTile label={t('Open recommendations')} value={recs.open} sub={`${recs.late} ${t('late')} · ${recs.total} ${t('in all')}`} tone={recs.late ? 'alert' : 'default'} />
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
                    <Tag tone={TONE[s.status]} size="sm">{t(HS_STATUS_LABEL[s.status])}</Tag>{' '}
                    <Tag tone="outline" size="xs">{t(s.source === 'vigie' ? 'Vigie' : 'Declared')}</Tag>
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
      <SectionCard title={t('Process safety studies (Vigie)')} hint={t('Held in Vigie; their recommendations are followed there as QSE actions')} scroll>
        {studies.length ? (
          <Table>
            <thead>
              <tr><Th>{t('Study')}</Th><Th>{t('Milestone')}</Th><Th>{t('Status')}</Th><Th>{t('Conclusion')}</Th><Th>{t('Concluded on')}</Th><Th align="right">{t('Recommendations')}</Th><Th align="right">{t('Open')}</Th><Th align="right">{t('Late')}</Th><Th>{t('Report')}</Th></tr>
            </thead>
            <tbody>
              {[...studies].sort((a, b) => HS_MILESTONES.findIndex((m) => m.code === a.milestone) - HS_MILESTONES.findIndex((m) => m.code === b.milestone) || a.ref.localeCompare(b.ref)).map((x) => (
                <tr key={x.ref}>
                  <Td nowrap>{x.link ? <a href={x.link} target="_blank" rel="noreferrer">{`${t(STUDY_TYPE_LABEL[x.type])} · ${x.ref}`}</a> : `${t(STUDY_TYPE_LABEL[x.type])} · ${x.ref}`}{x.leaderName && <div className="text-muted">{x.leaderName}</div>}</Td>
                  <Td nowrap>{t(HS_LABEL[x.milestone])}</Td>
                  <Td>{t(STUDY_STATUS_LABEL[x.status])}{!x.concludedOn && x.heldOn && <div className="text-muted">{fmtDate(x.heldOn, lang)}</div>}{x.blockingReservations > 0 && <div><Tag tone="accent" size="xs">{`${x.blockingReservations} ${t('blocking reservation(s)')}`}</Tag></div>}</Td>
                  <Td>{x.conclusion ? t(STUDY_CONCLUSION_LABEL[x.conclusion]) : '—'}</Td>
                  <Td nowrap>{fmtDate(x.concludedOn, lang)}</Td>
                  <Td align="right" numeric>{x.recommendations}</Td>
                  <Td align="right" numeric>{x.openRecommendations}</Td>
                  <Td align="right" numeric>{x.lateRecommendations ? <Tag tone="accent" size="sm">{String(x.lateRecommendations)}</Tag> : 0}</Td>
                  <Td nowrap>{x.reportRef ? (codexDocumentUrl(x.reportRef) ? <a href={codexDocumentUrl(x.reportRef)!} target="_blank" rel="noreferrer">{x.reportRef}</a> : x.reportRef) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Callout variant="outlined">{t('No study of this CAPEX in Vigie: the milestones are declared by the group HSE.')}</Callout>
        )}
      </SectionCard>
    </>
  );
}
