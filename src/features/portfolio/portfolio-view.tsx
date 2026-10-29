// Portfolio dashboard (docs/spec/06 §5), shared by the Group portfolio (the viewer's CAPEX — the whole group for the central
// functions, the zone of a zone director, the subsidiary of a sponsor or a controller (visibility filter) — on the zone chosen)
// and the Subsidiary portfolio (the subsidiary chosen in the sidebar): CAPEX by subsidiary and phase, gates ahead and late,
// budget and EAC, SPI / CPI, maturity of the studies (weighted pack, subsidiary and EPC2i parts, weekly trend), changes
// waiting, reviews late and the rule-based alerts. Server Component.
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { ZoneSeg } from '@/components/app/ZoneSeg';
import { PageHeader } from '@/components/app/shell/page-header';
import { exportLinks } from '@/features/export/links';
import { Sparkline } from '@/components/charts/primitives/Sparkline';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee, screenHref } from '@/config/screens';
import { PHASE_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { PHASES } from '@/domain/lifecycle';
import { alertDetail } from '@/features/governance/alert-detail';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { portfolioDashboard } from '@/server/dal/governance';
import { subsidiaryChoice } from '@/server/dal/portfolio';
import { CapexGantt } from '@/components/charts/capex-gantt';
import { portfolioGantt } from '@/features/schedule/gantt-rows';
import { getDb } from '@/server/db/client';
import { portfolioSchedule } from '@/server/dal/schedule';
import { phasedCapex } from '@/server/dal/finance';
import { getI18n, getSubsidiaryCookie, getViewer, getZone } from '@/server/session';

const pct = (n: number | null | undefined, lang: 'fr' | 'en') => (n == null ? '—' : `${fmtNum(n, lang)} %`);

export async function PortfolioView({ level }: { level: 'group' | 'subsidiary' }) {
  const [{ t, lang }, viewer, zone] = await Promise.all([getI18n(), getViewer(), getZone()]);
  const choice = level === 'subsidiary' ? await subsidiaryChoice(viewer, await getSubsidiaryCookie()) : null;
  const p = await portfolioDashboard(viewer, level === 'group' ? zone : null, choice?.current ?? null);
  const subName = choice?.options.find((o) => o.code === choice.current)?.name ?? null;
  const ganttRows = p.rows.filter((r) => r.status !== 'draft');
  const summaries = new Map((await portfolioSchedule(await getDb(), ganttRows)).map((x) => [x.id, x.summary]));
  const gantt = portfolioGantt(ganttRows.map((r) => ({ code: r.code, title: dataText(r.title, lang), sub: [r.subsidiaryCode, t(labelOf(PHASE_LABEL, r.phase))].join(' · '), summary: summaries.get(r.id) ?? null })), p.today, lang, t);
  const k = (n: number | null | undefined) => fmtKeur(n, lang);
  // Cash-flow by fiscal year (AR-045): the phased disbursements of the CAPEX of the portfolio.
  const seenIds = new Set(p.rows.map((r) => r.id));
  const phased = (await phasedCapex(await getDb(), p.today)).filter((x) => seenIds.has(x.id));
  const thisYear = Number(p.today.slice(0, 4));
  const cashYears = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
  const cashSubs = [...new Set(phased.filter((x) => cashYears.some((y) => (x.byYear[y] ?? 0) > 0)).map((x) => x.subsidiaryCode))].sort();
  const open = p.rows.filter((r) => r.status === 'active' || r.status === 'on_hold');
  const afterG2 = open.filter((r) => r.phase === 'execution' || r.phase === 'demarrage');
  const alerts = p.rows.flatMap((r) => r.dash.alerts);
  const lateGates = open.filter((r) => r.dash.running?.late);
  const lateReviews = open.filter((r) => r.dash.review.state === 'late' || r.dash.review.state === 'escalated');
  const studies = open.filter((r) => r.phase === 'cadrage' || r.phase === 'avant_projet');
  const subs = [...new Map(p.rows.map((r) => [r.subsidiaryCode, r.subsidiaryName])).entries()];
  const scope = level === 'subsidiary' ? null : viewer.role === 'zone_director' ? 'Zone portfolio' : viewer.role === 'sponsor' || viewer.role === 'controller' ? 'My subsidiary' : 'Group portfolio';
  const href = (code: string) => (canSee(viewer.role, 'capex-overview') ? screenHref('capex-overview', { code }) : null);
  const link = (code: string) => (href(code) ? <Link href={href(code)!}>{code}</Link> : code);
  return (
    <>
      {level === 'group'
        ? <PageHeader screen="portfolio" crumbs={['Group portfolio']} actions={exportLinks(t, 'portfolio-group')} />
        : <PageHeader screen="subsidiary-portfolio" crumbs={['Subsidiary portfolio']} actions={exportLinks(t, 'portfolio-subsidiary')} />}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag tone="outline" size="sm">{scope ? t(scope) : `${choice?.current ?? '—'} · ${dataText(subName, lang) ?? ''}`}</Tag>
        {level === 'group' && <ZoneSeg zone={p.zone} options={p.zones.map((z) => ({ code: z.code, label: z.code ? dataText(z.name!, lang) : t('All zones'), count: z.count }))} />}
      </div>
      <KpiGrid>
        <KpiTile label={t('CAPEX in progress')} value={open.length} sub={`${p.rows.length} ${t('in the portfolio')}`} />
        <KpiTile label={t('Budget at completion')} value={k(open.reduce((a, r) => a + r.dash.indicators.bacKeur, 0))} sub={t('G2 baseline or latest validated version')} />
        <KpiTile label={t('EAC after G2')} value={k(afterG2.reduce((a, r) => a + r.dash.indicators.eacKeur, 0))} sub={`${t('G2 budgets')} ${k(afterG2.reduce((a, r) => a + (r.dash.g2Keur ?? 0), 0))}`} />
        <KpiTile label={t('Gates in progress')} value={open.filter((r) => r.dash.running).length} sub={`${lateGates.length} ${t('past their target delay')}`} tone={lateGates.length ? 'alert' : 'default'} />
        <KpiTile label={t('Changes waiting')} value={open.reduce((a, r) => a + r.dash.openChanges, 0)} />
        <KpiTile label={t('Reviews late')} value={lateReviews.length} tone={lateReviews.length ? 'alert' : 'default'} />
        <KpiTile label={t('Alerts')} value={alerts.filter((a) => a.level === 'alert').length} sub={`${alerts.filter((a) => a.level === 'watch').length} ${t('to watch')}`} tone={alerts.some((a) => a.level === 'alert') ? 'alert' : 'default'} />
      </KpiGrid>

      {ganttRows.length > 0 && (
        <SectionCard title={t('Schedule of the CAPEX')} hint={t('One summary bar per CAPEX: duration and progress (detail on its WBS & Gantt page)')} scroll>
          <CapexGantt {...gantt} />
        </SectionCard>
      )}

      <SectionCard title={t('CAPEX')} hint={t('Cumulative figures at the end of the current month')} scroll>
        {p.rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Phase')}</Th>
                <Th>{t('Next gate')}</Th>
                <Th align="right">{t('Budget')}</Th>
                <Th align="right">{t('EAC')}</Th>
                <Th align="right">SPI</Th>
                <Th align="right">CPI</Th>
                <Th>{t('Next review')}</Th>
                <Th align="right">{t('Alerts')}</Th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => {
                const d = r.dash;
                const after = r.phase === 'execution' || r.phase === 'demarrage';
                const al = d.alerts.filter((a) => a.level === 'alert').length;
                return (
                  <tr key={r.id}>
                    <Td>
                      {link(r.code)} <span className="text-muted">{dataText(r.title, lang)}</span>
                      <div className="text-muted">{`${dataText(r.subsidiaryName, lang)}${r.typology ? ` · ${t(labelOf(TYPOLOGY_LABEL, r.typology))}` : ''}`}</div>
                    </Td>
                    <Td tone="secondary">{r.status === 'draft' ? t('Draft') : t(labelOf(PHASE_LABEL, r.phase))}</Td>
                    <Td nowrap>
                      {d.nextGate ?? '—'} {d.running && <Tag tone={d.running.late ? 'accent' : 'outline'} size="xs">{t(d.running.late ? 'Late' : 'In progress')}</Tag>}
                    </Td>
                    <Td align="right" numeric>{k(d.indicators.bacKeur)}</Td>
                    <Td align="right" numeric>{after ? k(d.indicators.eacKeur) : '—'}</Td>
                    <Td align="right" numeric>{after ? fmtRatio(d.indicators.spi, lang) : '—'}</Td>
                    <Td align="right" numeric>{after ? fmtRatio(d.indicators.cpi, lang) : '—'}</Td>
                    <Td nowrap>
                      {d.review.dueOn ? fmtDate(d.review.dueOn, lang) : '—'} {d.review.state !== 'ok' && d.review.state !== 'none' && <Tag tone="accent" size="xs">{t('Late')}</Tag>}
                    </Td>
                    <Td align="right" numeric>{al ? <Tag tone="accent" size="xs">{al}</Tag> : d.alerts.length || '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No CAPEX in your scope.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Maturity of the studies')} hint={t('Weighted engineering pack of the CAPEX in phases 1 and 2; trend over 12 weeks')} scroll>
        {studies.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th align="right">{t('Weighted pack')}</Th>
                <Th align="right">{t('Subsidiary part')}</Th>
                <Th align="right">{t('EPC2i part')}</Th>
                <Th>{t('Trend')}</Th>
                <Th>{t('Uncertainty gap')}</Th>
              </tr>
            </thead>
            <tbody>
              {studies.map((r) => {
                const series = r.trend.map((x) => x.packPct ?? 0);
                const g = r.dash.gap;
                return (
                  <tr key={r.id}>
                    <Td>{link(r.code)} <span className="text-muted">{dataText(r.title, lang)}</span></Td>
                    <Td align="right" numeric>
                      {pct(r.dash.pack.pct, lang)} {r.dash.pack.pct != null && r.dash.pack.pct <= r.dash.packThresholdPct && r.phase === 'avant_projet' && <Tag tone="outline" size="xs">{`< ${r.dash.packThresholdPct} %`}</Tag>}
                    </Td>
                    <Td align="right" numeric>{pct(r.dash.pack.subsidiary.pct, lang)}</Td>
                    <Td align="right" numeric>{pct(r.dash.pack.epc2i.pct, lang)}</Td>
                    <Td>{series.length > 1 ? <Sparkline values={series} label={`${t('Trend')} ${r.code}`} /> : <span className="text-muted">{t('Not enough weeks yet')}</span>}</Td>
                    <Td nowrap>{g?.kind === 'range' ? `${g.gapPts} pts (${g.widthPct} % → ${g.targetClass} ${g.targetWidthPct} %)` : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No CAPEX in its studies.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('By subsidiary and phase')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Subsidiary')}</Th>
              <Th align="right">{t('Draft')}</Th>
              {PHASES.map((ph) => <Th key={ph} align="right">{t(labelOf(PHASE_LABEL, ph))}</Th>)}
              <Th align="right">{t('Budget')}</Th>
            </tr>
          </thead>
          <tbody>
            {subs.map(([code, name]) => {
              const mine = p.rows.filter((r) => r.subsidiaryCode === code);
              return (
                <tr key={code}>
                  <Td>{`${code} · `}{dataText(name, lang)}</Td>
                  <Td align="right" numeric>{mine.filter((r) => r.status === 'draft').length}</Td>
                  {PHASES.map((ph) => <Td key={ph} align="right" numeric>{mine.filter((r) => r.status !== 'draft' && r.phase === ph).length}</Td>)}
                  <Td align="right" numeric>{k(mine.reduce((a, r) => a + r.dash.indicators.bacKeur, 0))}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </SectionCard>

      <SectionCard title={t('Cash-flow by fiscal year')} hint={t('Phased disbursements of the CAPEX open or on hold: actuals to date, then forecasts (k€)')} scroll>
        {cashSubs.length ? (
          <Table>
            <thead><tr><Th>{t('Subsidiary')}</Th>{cashYears.map((y) => <Th key={y} align="right">{y}</Th>)}</tr></thead>
            <tbody>
              {cashSubs.map((sub) => (
                <tr key={sub}>
                  <Td>{sub}</Td>
                  {cashYears.map((y) => <Td key={y} align="right" numeric>{k(phased.filter((x) => x.subsidiaryCode === sub).reduce((a, x) => a + (x.byYear[y] ?? 0), 0))}</Td>)}
                </tr>
              ))}
              <tr>
                <Td><strong>{t('Total')}</strong></Td>
                {cashYears.map((y) => <Td key={y} align="right" numeric><strong>{k(phased.reduce((a, x) => a + (x.byYear[y] ?? 0), 0))}</strong></Td>)}
              </tr>
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No CAPEX with a phased budget yet.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Alerts')} hint={t('Rule-based alerts, always on')} scroll>
        {alerts.length ? (
          <Table>
            <tbody>
              {alerts.map((a, n) => (
                <tr key={n}>
                  <Td nowrap><Tag tone={a.level === 'alert' ? 'accent' : 'outline'} size="xs">{t(a.level === 'alert' ? 'Alert' : 'To watch')}</Tag></Td>
                  <Td nowrap>{canSee(viewer.role, a.screen) ? <Link href={screenHref(a.screen, { code: a.capexCode })}>{a.capexCode}</Link> : a.capexCode}</Td>
                  <Td>{t(a.text)}</Td>
                  <Td tone="secondary">{alertDetail(a.detail, t, lang)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No alert.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
