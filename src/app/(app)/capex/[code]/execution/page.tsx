// Execution of a CAPEX (docs/spec/06 §3, N-14): the lots with their budget (G2 baseline, else the latest validated version) and
// planned window, the committed, spent and physical % of each month — entered or imported by the controller for the lots outside
// EPC2i, read in Keystone for the machine lots (contract and signed amendments, invoiced, physical %) — the consolidated
// S-curve with SPI, CPI and EAC, the forecast by rules (AR-037), the uncertainty gap (CDC §4) and, in phase 4, the controller's accounting closure (N-15).
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
import { forecastOf } from '@/domain/forecast';
import { ForecastCard } from '@/features/decision/aid';
import { currentGate, type CycleState } from '@/domain/lifecycle';
import { loadCapexPage } from '@/features/capex/page-data';
import { ActionLink } from '@/components/app/ActionForm';
import { entryCurrencies } from '@/domain/currency';
import { subsidiaryCurrency } from '@/server/dal/currency';
import { forecastRowsOf, transfersOf } from '@/server/dal/finance';
import { byYear, cashflow } from '@/domain/cashflow';
import { addMonths, monthsBetween } from '@/domain/execution';
import { ForecastForm, TransferAssetsButton } from '@/features/finance/forms';
import { exportLinks } from '@/features/export/links';
import { ActualForm, ImportActualsForm, LotWindowForm } from '@/features/delivery/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { executionOf } from '@/server/dal/execution';
import { closureOf } from '@/server/dal/rampup';
import { ClosureForm } from '@/features/startup/forms';
import { keystoneProjectUrl } from '@/server/integrations/keystone';

const SOURCE: Record<string, string> = { manual: 'Entered', import: 'Imported', keystone: 'Keystone', sage: 'Sage' };

export default async function ExecutionPage({ params }: PageProps<'/capex/[code]/execution'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const today = await businessToday(db);
  const x = await executionOf(db, c, today);
  const closure = await closureOf(db, c.id, x.g2Keur);
  const currencies = entryCurrencies(await subsidiaryCurrency(db, c.subsidiaryCode));
  // Phased cash-flow (AR-045): the G2 baseline, the actuals (EPC2i lots from Keystone) and the forecast of the months to come.
  const forecastRows = await forecastRowsOf(db, x.lots.map((l) => l.id));
  const transfers = await transfersOf(db, c.id);
  const cf = cashflow(x.lots, x.rows, forecastRows.map((r) => ({ lotId: r.lotId, month: r.month, amountKeur: r.amountKeur })), x.month);
  const years = byYear(cf.months);
  const baseYears = byYear(cf.months, (m) => m.baseline);
  const forecastMonths = (l: { end: string | null }) => monthsBetween(addMonths(x.month, 1), l.end && l.end > addMonths(x.month, 12) ? l.end : addMonths(x.month, 12));
  const typedOf = (lotId: string) => {
    const mine = forecastRows.filter((r) => r.lotId === lotId && r.month > x.month);
    const cur = mine.find((r) => r.currency)?.currency ?? (mine.length ? 'EUR' : currencies[0]);
    return { currency: cur, values: Object.fromEntries(mine.map((r) => [r.month, r.currency ? r.amountLocal! : r.amountKeur])) };
  };
  const edit = can('budget');
  const i = x.indicators;
  const afterG2 = c.phase === 'execution' || c.phase === 'demarrage';
  const gap = uncertaintyGap({ latestClass: x.latestClass, nextGate: currentGate(c as CycleState), afterG2, g2Keur: x.g2Keur, eacKeur: i.eacKeur });
  const k = (n: number) => fmtKeur(n, lang);
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const low = (r: number | null) => r != null && r < 0.9;
  // Forecast by rules (AR-037): once something is measured.
  const forecast = i.acKeur > 0 || i.evKeur > 0 ? forecastOf(x.curve, i.bacKeur, x.month) : null;
  return (
    <>
      <PageHeader screen="capex-execution" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} primary={edit ? <ImportActualsForm code={c.code} currencies={currencies} /> : undefined}
        actions={<>
          {can('closure') && c.phase === 'demarrage' && (
            <ClosureForm code={c.code} statement={closure.statement ? { afeBalanceKeur: closure.statement.afeBalanceKeur, note: closure.statement.note } : null} lots={closure.lots.map((l) => ({ id: l.id, label: `${l.number}. ${dataText(l.title, lang)}`, finalKeur: l.finalKeur }))} />
          )}
          {can('closure') && closure.statement && c.mesStartedOn && transfers.length < closure.lots.filter((l) => (l.finalKeur ?? 0) > 0).length && <TransferAssetsButton code={c.code} />}
          {exportLinks(t, 'execution', { capex: c.code })}
          {transfers.length > 0 && <ActionLink href={`/export/fixed-assets?capex=${encodeURIComponent(c.code)}&format=xlsx`} download icon="download" label={t('Fixed assets for Sage (Excel)')} />}
        </>}
      />
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
            <SCurve points={x.curve} bacKeur={i.bacKeur} eacKeur={i.eacKeur} current={x.month} fmt={k} monthLabel={monthLabel} t={t} projection={forecast?.projection} />
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

      <ForecastCard forecast={forecast} t={t} lang={lang} />

      <SectionCard title={t('Cash-flow forecast')} hint={t('Disbursements by month: G2 baseline, actuals to date, forecast of the months to come (a lot without a forecast spreads what is left over its window)')} scroll>
        {cf.months.length ? (
          <>
            <KpiGrid>
              <KpiTile label={t('Spent to date')} value={k(cf.spentKeur)} />
              <KpiTile label={t('Still to spend')} value={k(cf.remainingKeur)} sub={t('forecast of the months to come')} />
              <KpiTile label={t('Forecast at completion')} value={k(cf.atCompletionKeur)} sub={`${t('Baseline')} ${k(cf.baselineKeur)}`} tone={cf.atCompletionKeur > cf.baselineKeur * 1.05 && cf.baselineKeur > 0 ? 'alert' : 'default'} />
            </KpiGrid>
            <Table>
              <thead>
                <tr><Th>{t('Fiscal year')}</Th><Th align="right">{t('G2 baseline')}</Th><Th align="right">{t('Actuals and forecast')}</Th><Th align="right">{t('Gap')}</Th></tr>
              </thead>
              <tbody>
                {Object.keys(years).map((y) => (
                  <tr key={y}>
                    <Td>{y}</Td>
                    <Td align="right" numeric>{k(baseYears[+y] ?? 0)}</Td>
                    <Td align="right" numeric>{k(years[+y])}</Td>
                    <Td align="right" numeric>{`${years[+y] - (baseYears[+y] ?? 0) > 0 ? '+' : ''}${k(Math.round((years[+y] - (baseYears[+y] ?? 0)) * 10) / 10)}`}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <details>
              <summary>{t('By month')}</summary>
              <Table>
                <thead><tr><Th>{t('Month')}</Th><Th align="right">{t('G2 baseline')}</Th><Th align="right">{t('Actual')}</Th><Th align="right">{t('Forecast')}</Th></tr></thead>
                <tbody>
                  {cf.months.map((m) => (
                    <tr key={m.month}>
                      <Td nowrap>{monthLabel(m.month)}</Td>
                      <Td align="right" numeric>{k(m.baseline)}</Td>
                      <Td align="right" numeric>{m.actual == null ? '—' : k(m.actual)}</Td>
                      <Td align="right" numeric>{m.actual == null ? k(m.forecast) : '—'}</Td>
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
                      {!l.epc2i && <ActualForm code={c.code} lotId={l.id} month={x.month} label={dataText(l.title, lang)} currencies={currencies} />}{' '}
                      <ForecastForm code={c.code} lotId={l.id} label={dataText(l.title, lang)} months={forecastMonths(l)} values={typedOf(l.id).values} currencies={currencies} typedIn={typedOf(l.id).currency} />
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

      {(c.phase === 'demarrage' || closure.statement) && (
        <SectionCard title={t('Accounting closure')} hint={t('Final cost by lot, gap to the G2 budget, AFE balance; attested by the controller in the G3 circuit (N-15)')} scroll>
          <KpiGrid>
            <KpiTile label={t('Final cost')} value={closure.statement ? k(closure.summary.finalKeur) : '—'} sub={closure.fact.value === 'No statement' ? t('No statement') : `${closure.fact.value} ${t('lots')}`} />
            <KpiTile label={t('Gap to the G2 budget')} value={closure.statement && closure.summary.gapKeur != null ? `${closure.summary.gapKeur > 0 ? '+' : ''}${k(closure.summary.gapKeur)}` : '—'} sub={closure.summary.gapPct != null && closure.statement ? `${closure.summary.gapPct > 0 ? '+' : ''}${fmtNum(closure.summary.gapPct, lang)} %` : undefined} />
            <KpiTile label={t('AFE balance')} value={closure.statement ? k(closure.statement.afeBalanceKeur) : '—'} tone={closure.statement && closure.statement.afeBalanceKeur < 0 ? 'alert' : 'default'} sub={closure.statement ? `${closure.statement.enteredByName} · ${fmtDate(closure.statement.updatedAt, lang)}` : undefined} />
          </KpiGrid>
          {closure.statement && (
            <Table>
              <thead>
                <tr>
                  <Th>{t('No.')}</Th>
                  <Th>{t('Lot')}</Th>
                  <Th align="right">{t('Budget')}</Th>
                  <Th align="right">{t('Final cost')}</Th>
                </tr>
              </thead>
              <tbody>
                {closure.lots.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.number}</Td>
                    <Td>{dataText(l.title, lang)}</Td>
                    <Td align="right" numeric>{k(x.lots.find((y) => y.id === l.id)?.budgetKeur ?? 0)}</Td>
                    <Td align="right" numeric>{l.finalKeur == null ? '—' : k(l.finalKeur)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {closure.statement?.note && <span className="text-muted">{dataText(closure.statement.note, lang)}</span>}
          {transfers.length > 0 && (
            <Table>
              <thead>
                <tr><Th>{t('Fixed assets')}</Th><Th>{t('Asset class')}</Th><Th align="right">{t('Amount')}</Th><Th>{t('In service on')}</Th><Th>{t('Transferred by')}</Th></tr>
              </thead>
              <tbody>
                {transfers.map((f) => {
                  const lot = closure.lots.find((l) => l.id === f.lotId);
                  return (
                    <tr key={f.lotId}>
                      <Td>{lot ? `${c.code}-${lot.number} · ${dataText(lot.title, lang)}` : '—'}</Td>
                      <Td>{`${f.assetClassCode} · ${f.lifeYears} ${t('years')}`}</Td>
                      <Td align="right" numeric>{k(f.amountKeur)}</Td>
                      <Td nowrap>{fmtDate(f.inServiceOn, lang)}</Td>
                      <Td tone="secondary">{`${f.transferredByName} · ${fmtDate(f.transferredAt, lang)}`}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </SectionCard>
      )}

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
