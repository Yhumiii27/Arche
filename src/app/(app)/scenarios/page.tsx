// Portfolio scenarios (AR-043, DECISIONS.md §5): the named scenarios of the group's portfolio — base, constrained, growth —
// compared on the spend by fiscal year against their envelope, the expected return (NPV of the business plans), the major risks
// and the mean priority score (AR-044); the scenario retained for the COPIL GPI. The group industrial director and the group CFO
// create and change them; the director retains one.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee, screenHref } from '@/config/screens';
import { STATUS_LABEL, labelOf } from '@/domain/capex-labels';
import { monthOf } from '@/domain/execution';
import { evaluate, SCENARIO_KIND_LABEL, shiftedByYear } from '@/domain/scenarios';
import { EditScenarioForm, NewScenarioForm, RetainScenarioButton } from '@/features/portfolio/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { scenariosOf } from '@/server/dal/priority';
import { getI18n, getViewer } from '@/server/session';

export default async function ScenariosPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'scenarios')) notFound();
  const db = await getDb();
  const today = await businessToday(db);
  const { capex, scenarios } = await scenariosOf(db, today);
  const current = monthOf(today);
  const thisYear = Number(today.slice(0, 4));
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
  const editor = viewer.role === 'dir_ig' || viewer.role === 'group_cfo';
  const k = (n: number | null | undefined) => fmtKeur(n, lang);
  // The portfolio as it stands: every CAPEX kept, nothing shifted.
  const asIs = evaluate([], {}, capex, current);
  const retained = scenarios.find((s) => s.retained) ?? null;
  const href = (code: string) => (canSee(viewer.role, 'capex-overview') ? screenHref('capex-governance', { code }) : null);
  return (
    <>
      <PageHeader screen="scenarios" crumbs={['Group portfolio']} primary={editor ? <NewScenarioForm years={years} /> : undefined} />
      <KpiGrid>
        <KpiTile label={t('CAPEX in the scenarios')} value={capex.length} sub={t('open, on hold, or in draft with a phased budget')} />
        <KpiTile label={`${t('Spend')} ${thisYear + 1}`} value={k(asIs.byYear[thisYear + 1] ?? 0)} sub={t('portfolio as it stands')} />
        <KpiTile label={t('Scenarios')} value={scenarios.length} />
        <KpiTile label={t('Retained for the COPIL GPI')} value={retained ? dataText(retained.name, lang) : '—'} sub={retained?.retainedByName ?? undefined} />
      </KpiGrid>

      <SectionCard title={t('Comparison')} hint={t('Spend by fiscal year of the CAPEX kept (k€), against the scenario’s envelope')} scroll>
        <Table>
          <thead>
            <tr>
              <Th>{t('Scenario')}</Th><Th>{t('Kind')}</Th><Th align="right">{t('CAPEX kept')}</Th>
              {years.map((y) => <Th key={y} align="right">{y}</Th>)}
              <Th align="right">{t('NPV (k€)')}</Th><Th align="right">{t('Major risks')}</Th><Th align="right">{t('Mean score')}</Th>{editor && <Th />}
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td><em>{t('Portfolio as it stands')}</em></Td><Td tone="secondary">—</Td>
              <Td align="right" numeric>{asIs.kept}</Td>
              {years.map((y) => <Td key={y} align="right" numeric nowrap>{k(asIs.byYear[y] ?? 0)}</Td>)}
              <Td align="right" numeric nowrap>{k(asIs.npvKeur)}</Td><Td align="right" numeric>{asIs.majorRisks}</Td>
              <Td align="right" numeric>{asIs.meanScore == null ? '—' : fmtNum(asIs.meanScore, lang)}</Td>{editor && <Td />}
            </tr>
            {scenarios.map((s) => (
              <tr key={s.id}>
                <Td>
                  {dataText(s.name, lang)} {s.retained && <Tag tone="accent" size="xs">{t('Retained')}</Tag>}
                  {s.description && <div style={{ fontSize: 11.5, color: 'var(--neutral-400)' }}>{dataText(s.description, lang)}</div>}
                </Td>
                <Td>{t(SCENARIO_KIND_LABEL[s.kind])}</Td>
                <Td align="right" numeric>{`${s.result.kept}${s.result.left ? ` (−${s.result.left})` : ''}`}</Td>
                {years.map((y) => {
                  const env = s.envelopes[String(y)];
                  const over = s.result.overByYear[y] ?? 0;
                  return (
                    <Td key={y} align="right" numeric nowrap>
                      {over > 0 ? <Tag tone="accent" size="sm">{k(s.result.byYear[y] ?? 0)}</Tag> : k(s.result.byYear[y] ?? 0)}
                      {env != null && <div style={{ fontSize: 11, color: 'var(--neutral-400)' }}>{`${t('env.')} ${k(env)}`}</div>}
                    </Td>
                  );
                })}
                <Td align="right" numeric nowrap>{k(s.result.npvKeur)}</Td>
                <Td align="right" numeric>{s.result.majorRisks}</Td>
                <Td align="right" numeric>{s.result.meanScore == null ? '—' : fmtNum(s.result.meanScore, lang)}</Td>
                {editor && (
                  <Td align="right" nowrap>
                    <EditScenarioForm
                      id={s.id}
                      value={{ name: s.name, kind: s.kind, description: s.description, envelopes: s.envelopes }}
                      years={years}
                      capex={capex.map((c) => {
                        const it = s.items.find((i) => i.capexId === c.id);
                        return { id: c.id, label: `${c.code} · ${c.subsidiaryCode} · ${k(c.bacKeur)}`, included: it?.included ?? true, shiftMonths: it?.shiftMonths ?? 0 };
                      })}
                    />
                    {viewer.role === 'dir_ig' && !s.retained && <RetainScenarioButton id={s.id} />}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
        {!scenarios.length && <EmptyState>{t('No scenario yet.')}</EmptyState>}
      </SectionCard>

      <SectionCard title={t('CAPEX of the portfolio')} hint={t('Phased disbursements: actuals to date, then forecasts (k€); score on 100 of the grid')} scroll>
        {capex.length ? (
          <Table>
            <thead>
              <tr>
                <Th>CAPEX</Th><Th>{t('Subsidiary')}</Th><Th>{t('Status')}</Th><Th align="right">{t('Budget (k€)')}</Th>
                {years.map((y) => <Th key={y} align="right">{y}</Th>)}
                <Th align="right">{t('NPV (k€)')}</Th><Th align="right">{t('Major risks')}</Th><Th align="right">{t('Score')}</Th>
                {retained && <Th>{t('Retained scenario')}</Th>}
              </tr>
            </thead>
            <tbody>
              {capex.map((c) => {
                const by = shiftedByYear(c.months, current, 0);
                const it = retained?.items.find((i) => i.capexId === c.id);
                return (
                  <tr key={c.id}>
                    <Td nowrap>{href(c.code) ? <Link href={href(c.code)!}>{c.code}</Link> : c.code}</Td>
                    <Td>{c.subsidiaryCode}</Td>
                    <Td>{t(labelOf(STATUS_LABEL, c.status))}</Td>
                    <Td align="right" numeric>{k(c.bacKeur)}</Td>
                    {years.map((y) => <Td key={y} align="right" numeric nowrap>{k(by[y] ?? 0)}</Td>)}
                    <Td align="right" numeric>{c.npvKeur == null ? '—' : k(c.npvKeur)}</Td>
                    <Td align="right" numeric>{c.majorRisks}</Td>
                    <Td align="right" numeric>{c.score == null ? '—' : fmtNum(c.score, lang)}</Td>
                    {retained && <Td tone="secondary">{!it || it.included ? (it?.shiftMonths ? `${t('Kept')}, ${it.shiftMonths > 0 ? '+' : ''}${it.shiftMonths} ${t('month(s)')}` : t('Kept')) : t('Left out')}</Td>}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No CAPEX with a phased budget yet.')}</EmptyState>
        )}
        {retained && <p style={{ fontSize: 12, color: 'var(--neutral-400)', marginTop: 8 }}>{`${t('Retained on')} ${fmtDate(retained.updatedAt, lang)}`}</p>}
      </SectionCard>
    </>
  );
}
