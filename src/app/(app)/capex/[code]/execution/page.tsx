// Execution of a CAPEX (docs/spec/06 §3, N-14): the lots with their budget (G2 baseline, else the latest validated version) and
// planned window, the committed, spent and physical % of each month — entered or imported by the controller for the lots outside
// EPC2i, read in Keystone for the machine lots (contract and signed amendments, invoiced, physical %) — the consolidated
// S-curve with SPI, CPI and EAC, and the uncertainty gap (CDC §4).
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { SCurve, SCurveLegend } from '@/components/charts/s-curve';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { LOT_KIND_LABEL, type LotKind } from '@/domain/capex';
import { labelOf } from '@/domain/capex-labels';
import { uncertaintyGap } from '@/domain/execution';
import { currentGate, type CycleState } from '@/domain/lifecycle';
import { loadCapexPage } from '@/features/capex/page-data';
import { ActualForm, ImportActualsForm, LotWindowForm } from '@/features/delivery/forms';
import { dataText } from '@/i18n/data-text';
import { fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { executionOf } from '@/server/dal/execution';
import { keystoneProjectUrl } from '@/server/integrations/keystone';

const SOURCE: Record<string, string> = { manual: 'Entered', import: 'Imported', keystone: 'Keystone' };

export default async function ExecutionPage({ params }: PageProps<'/capex/[code]/execution'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const today = await businessToday(db);
  const x = await executionOf(db, c, today);
  const edit = can('budget');
  const i = x.indicators;
  const afterG2 = c.phase === 'execution' || c.phase === 'demarrage';
  const gap = uncertaintyGap({ latestClass: x.latestClass, nextGate: currentGate(c as CycleState), afterG2, g2Keur: x.g2Keur, eacKeur: i.eacKeur });
  const k = (n: number) => fmtKeur(n, lang);
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const low = (r: number | null) => r != null && r < 0.9;
  return (
    <>
      <PageHeader screen="capex-execution" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} primary={edit ? <ImportActualsForm code={c.code} /> : undefined} />
      <KpiGrid>
        <KpiTile label={t('Budget at completion')} value={k(i.bacKeur)} sub={t(x.budgetSource === 'g2_baseline' ? 'G2 baseline' : x.budgetSource === 'latest_validated' ? 'Latest validated version (indicative)' : 'No validated budget')} />
        <KpiTile label={t('Earned value')} value={k(i.evKeur)} sub={`${t('Planned')} ${k(i.pvKeur)}`} />
        <KpiTile label={t('Actual cost')} value={k(i.acKeur)} sub={`${t('Committed')} ${k(i.committedKeur)}`} />
        <KpiTile label="SPI" value={fmtRatio(i.spi, lang)} tone={low(i.spi) ? 'alert' : 'default'} sub={t('earned / planned')} />
        <KpiTile label="CPI" value={fmtRatio(i.cpi, lang)} tone={low(i.cpi) ? 'alert' : 'default'} sub={t('earned / actual cost')} />
        <KpiTile label={t('EAC')} value={k(i.eacKeur)} sub={x.g2Keur ? `${t('G2 budget')} ${k(x.g2Keur)}` : undefined} tone={x.g2Keur && i.eacKeur > x.g2Keur * 1.05 ? 'alert' : 'default'} />
        <KpiTile
          label={t('Uncertainty gap')}
          value={!gap ? '—' : gap.kind === 'range' ? `${gap.gapPts} pts` : `${gap.deviationPct > 0 ? '+' : ''}${fmtNum(gap.deviationPct, lang)} %`}
          sub={!gap ? undefined : gap.kind === 'range' ? `${gap.widthPct} % → ${gap.targetClass} ${gap.targetWidthPct} %` : t(gap.within ? 'EAC within the E10 range' : 'EAC outside the E10 range')}
          tone={gap?.kind === 'eac' && !gap.within ? 'alert' : 'default'}
        />
      </KpiGrid>

      <SectionCard title={t('S-curve')} hint={i.unplanned ? `${i.unplanned} ${t('lot(s) without a planned window are left out of the planned value')}` : t('Cumulative by month')}>
        {x.curve.length > 1 ? (
          <>
            <SCurveLegend t={t} />
            <SCurve points={x.curve} bacKeur={i.bacKeur} eacKeur={i.eacKeur} current={x.month} fmt={k} monthLabel={monthLabel} t={t} />
            <details>
              <summary>{t('Table view')}</summary>
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Month')}</Th>
                    <Th align="right">{t('Planned')}</Th>
                    <Th align="right">{t('Earned value')}</Th>
                    <Th align="right">{t('Actual cost')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {x.curve.map((p) => (
                    <tr key={p.month}>
                      <Td nowrap>{monthLabel(p.month)}</Td>
                      <Td align="right" numeric>{k(p.planned)}</Td>
                      <Td align="right" numeric>{p.earned == null ? '—' : k(p.earned)}</Td>
                      <Td align="right" numeric>{p.actual == null ? '—' : k(p.actual)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </details>
          </>
        ) : (
          <EmptyState>{t('Plan the lots (start and end months) to draw the S-curve.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Lots')} hint={t('Values cumulative to the end of the month; EPC2i lots come from Keystone')} scroll>
        {x.lots.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('No.')}</Th>
                <Th>{t('Lot')}</Th>
                <Th align="right">{t('Budget')}</Th>
                <Th>{t('Planned window')}</Th>
                <Th align="right">{t('Committed')}</Th>
                <Th align="right">{t('Spent')}</Th>
                <Th align="right">{t('Physical')}</Th>
                <Th>{t('Source')}</Th>
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {x.lots.map((l) => (
                <tr key={l.id}>
                  <Td>{l.number}</Td>
                  <Td>
                    {dataText(l.title, lang)} {l.epc2i && <Tag size="xs">EPC2i</Tag>}
                    <div className="text-muted">{t(labelOf(LOT_KIND_LABEL, l.kind as LotKind))}</div>
                  </Td>
                  <Td align="right" numeric>{k(l.budgetKeur)}</Td>
                  <Td nowrap>{l.start && l.end ? `${monthLabel(l.start)} → ${monthLabel(l.end)}` : '—'}</Td>
                  <Td align="right" numeric>{k(l.actual.committedKeur)}</Td>
                  <Td align="right" numeric>{k(l.actual.spentKeur)}</Td>
                  <Td align="right" numeric>{`${fmtNum(l.actual.physicalPct, lang)} %`}</Td>
                  <Td tone="secondary" nowrap>
                    {l.source ? t(SOURCE[l.source]) : '—'}
                    {l.projects.length > 0 && <div className="text-muted">{l.projects.join(', ')}</div>}
                  </Td>
                  {edit && (
                    <Td align="right" nowrap>
                      <LotWindowForm code={c.code} lotId={l.id} start={l.start} end={l.end} label={dataText(l.title, lang)} />{' '}
                      {!l.epc2i && <ActualForm code={c.code} lotId={l.id} month={x.month} label={dataText(l.title, lang)} />}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No lot yet: lots are created on the budget page.')}</EmptyState>
        )}
      </SectionCard>

      {x.projects.length > 0 && (
        <SectionCard title={t('EPC2i projects')} hint={t('Selling side only: contract, signed amendments, invoiced, physical progress and SPI (AC-2)')} scroll>
          <Table>
            <thead>
              <tr>
                <Th>{t('Project')}</Th>
                <Th align="right">{t('Contract')}</Th>
                <Th align="right">{t('Signed amendments')}</Th>
                <Th align="right">{t('Invoiced')}</Th>
                <Th align="right">{t('Physical')}</Th>
                <Th align="right">SPI</Th>
              </tr>
            </thead>
            <tbody>
              {x.projects.map((p) => {
                const url = keystoneProjectUrl(p.code);
                return (
                  <tr key={p.code}>
                    <Td nowrap>
                      {url ? <a href={url} target="_blank" rel="noreferrer">{p.code}</a> : p.code} <span className="text-muted">{dataText(p.name, lang)}</span>
                      {x.unassigned.includes(p.code) && <div className="text-muted">{t('Linked to no lot')}</div>}
                    </Td>
                    <Td align="right" numeric>{fmtKeur(p.progress?.contractKeur, lang)}</Td>
                    <Td align="right" numeric>{fmtKeur(p.progress?.amendmentsKeur, lang)}</Td>
                    <Td align="right" numeric>{fmtKeur(p.progress?.invoicedKeur, lang)}</Td>
                    <Td align="right" numeric>{p.progress?.physicalPct == null ? '—' : `${fmtNum(p.progress.physicalPct, lang)} %`}</Td>
                    <Td align="right" numeric>{fmtRatio(p.progress?.spi, lang)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </SectionCard>
      )}
    </>
  );
}
