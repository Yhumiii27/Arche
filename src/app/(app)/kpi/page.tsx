// DIG-PRODI objectives (CDC §1, C-10; pilot): the indicators measured in Arche on the CAPEX the viewer sees — validation delay
// by gate, static documents per gate dossier, decisions traced — against the reference of the existing process and the
// targets of the CDC (−40 %, −50 %, 100 %). The group industrial director enters the references.
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { KPI_LABEL, KPI_UNIT, OBJECTIVE_LABEL, type KpiState } from '@/domain/kpi';
import { BaselineForm } from '@/features/pilot/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { pilotIndicators } from '@/server/dal/kpi';
import { getI18n, getViewer } from '@/server/session';

const STATE_LABEL: Record<KpiState, string> = { met: 'Objective met', not_met: 'Objective not met', no_reference: 'No reference yet', not_measured: 'Not measured yet' };
const STATE_TONE: Record<KpiState, 'neutral' | 'accent' | 'outline'> = { met: 'neutral', not_met: 'accent', no_reference: 'outline', not_measured: 'outline' };

export default async function KpiPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const { kpis, sessions, takenOver } = await pilotIndicators(viewer);
  const editor = viewer.role === 'dir_ig';
  const pct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${fmtNum(n, lang)} %`);
  return (
    <>
      <PageHeader screen="kpi" crumbs={['Steering']} />
      <SectionCard
        title={t('Indicators of the objectives')}
        hint={t('Measured on the gate sessions decided in Arche; gates taken over at a takeover are left out')}
        scroll
      >
        <Table>
          <thead>
            <tr>
              <Th>{t('Indicator')}</Th>
              <Th align="right">{t('Measured')}</Th>
              <Th align="right">{t('Measures')}</Th>
              <Th align="right">{t('Reference')}</Th>
              <Th>{t('Objective')}</Th>
              <Th align="right">{t('Target')}</Th>
              <Th align="right">{t('Change vs reference')}</Th>
              <Th>{t('State')}</Th>
              {editor && <Th />}
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <tr key={k.key}>
                <Td>
                  {t(KPI_LABEL[k.key])}
                  {k.baseline?.source && <div className="text-muted">{`${dataText(k.baseline.source, lang)}${k.baseline.measuredOn ? ` · ${fmtDate(k.baseline.measuredOn, lang)}` : ''}`}</div>}
                </Td>
                <Td align="right" nowrap>{k.measured.value == null ? '—' : `${fmtNum(k.measured.value, lang)} ${t(KPI_UNIT[k.key])}`}</Td>
                <Td align="right">{k.measured.count}</Td>
                <Td align="right" nowrap>{k.reference == null ? '—' : fmtNum(k.reference, lang)}</Td>
                <Td nowrap>{OBJECTIVE_LABEL[k.key]}</Td>
                <Td align="right" nowrap>{k.target == null ? '—' : fmtNum(k.target, lang)}</Td>
                <Td align="right" nowrap>{pct(k.changePct)}</Td>
                <Td><Tag tone={STATE_TONE[k.state]} size="xs">{t(STATE_LABEL[k.state])}</Tag></Td>
                {editor && <Td><BaselineForm kpi={k.key} today={today} baseline={k.baseline ? { value: k.baseline.value, source: k.baseline.source, measuredOn: k.baseline.measuredOn } : null} /></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard
        title={t('Gate sessions measured')}
        hint={takenOver ? `${t('Gates taken over, not measured')}: ${takenOver}` : undefined}
        scroll
      >
        {sessions.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Gate')}</Th>
                <Th>{t('Submitted')}</Th>
                <Th>{t('Decided')}</Th>
                <Th align="right">{t('Delay (working days)')}</Th>
                <Th align="right">{t('Static documents')}</Th>
                <Th>{t('Traced')}</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={`${s.capexCode}-${s.code}-${s.session}`}>
                  <Td nowrap>{s.capexCode}</Td>
                  <Td nowrap>{`${s.code} · ${t('session')} ${s.session}`}</Td>
                  <Td nowrap>{fmtDate(s.submittedOn, lang)}</Td>
                  <Td nowrap>{fmtDate(s.decidedOn, lang)}</Td>
                  <Td align="right">{s.delayDays}</Td>
                  <Td align="right">{s.documents ?? '—'}</Td>
                  <Td>{s.signed ? t('Yes') : t('No')}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No gate decided in Arche yet.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
