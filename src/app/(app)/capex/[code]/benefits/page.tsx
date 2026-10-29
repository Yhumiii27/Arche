// Benefits realised and post-audits of a CAPEX (AR-046, DECISIONS.md §5): after the start of commissioning, the operating gain
// (revenue − operating costs) year by year against the validated business plan, NPV and IRR recomputed on the realised flows,
// and the post-audits 6, 12 and 24 months after the start of commissioning, held by the group industrial director.
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { POST_AUDIT_CONCLUSION_LABEL, type PostAuditState } from '@/domain/benefits';
import { BenefitForm, PostAuditForm } from '@/features/benefits/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { benefitsOf } from '@/server/dal/benefits';

const AUDIT_STATE: Record<PostAuditState, string> = { held: 'Held', upcoming: 'Upcoming', due: 'Due', late: 'Late' };

export default async function BenefitsPage({ params }: PageProps<'/capex/[code]/benefits'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const today = await businessToday(db);
  const b = await benefitsOf(db, c, today);
  const k = (n: number | null | undefined) => (n == null ? '—' : fmtKeur(n, lang));
  const pct = (n: number | null | undefined) => (n == null ? '—' : `${fmtNum(n, lang)} %`);
  const entered = b.rows.filter((r) => r.actual != null);
  const last = entered.at(-1) ?? null;
  const openAudits = b.audits.filter((a) => a.state === 'due' || a.state === 'late').map((a) => a.milestone);
  const actions = [
    ...(can('benefits') && c.mesStartedOn && b.bp ? [<BenefitForm key="b" code={c.code} years={b.rows.map((r) => ({ year: r.year, revenue: r.actualRevenue, opex: r.actualOpex }))} />] : []),
    ...(can('post_audit') && openAudits.length ? [<PostAuditForm key="p" code={c.code} milestones={openAudits} today={today} />] : []),
  ];
  return (
    <>
      <PageHeader screen="capex-benefits" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} actions={actions} />
      {!c.mesStartedOn ? (
        <SectionCard><EmptyState>{t('Benefits are followed from the start of commissioning.')}</EmptyState></SectionCard>
      ) : (
        <>
          <KpiGrid>
            <KpiTile label={t('Start of commissioning')} value={fmtDate(c.mesStartedOn, lang)} />
            <KpiTile label={t('Cumulative gain')} value={k(last?.cumActual)} sub={last ? `${t('plan')} ${k(b.rows.find((r) => r.year === last.year)?.cumPlan)}` : t('No year entered yet')} tone={last && last.cumActual! < last.cumPlan ? 'alert' : 'default'} />
            <KpiTile label={t('NPV')} value={k(b.returns?.realNpv)} sub={`${t('plan')} ${k(b.returns?.planNpv)}`} tone={b.returns && b.returns.realNpv < b.returns.planNpv ? 'alert' : 'default'} />
            <KpiTile label={t('IRR')} value={pct(b.returns?.realIrr)} sub={`${t('plan')} ${pct(b.returns?.planIrr)}`} />
            <KpiTile label={t('Final cost')} value={k(b.finalCostKeur)} sub={b.finalCostKeur == null ? t('Accounting closure not entered: the plan’s investment') : t('Accounting closure')} />
          </KpiGrid>
          <SectionCard title={t('Benefits by year')} hint={t('Operating gain = revenue − operating costs (k€); realised flows: actuals where entered, the plan elsewhere')} scroll>
            {b.bp ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Year')}</Th><Th align="right">{t('Planned revenue')}</Th><Th align="right">{t('Planned OPEX')}</Th><Th align="right">{t('Planned gain')}</Th>
                    <Th align="right">{t('Actual revenue')}</Th><Th align="right">{t('Actual OPEX')}</Th><Th align="right">{t('Actual gain')}</Th><Th align="right">{t('Gap')}</Th><Th>{t('Note')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r) => (
                    <tr key={r.year}>
                      <Td>{`${t('Year')} ${r.year}`}</Td>
                      <Td align="right" numeric>{k(r.plannedRevenue)}</Td>
                      <Td align="right" numeric>{k(r.plannedOpex)}</Td>
                      <Td align="right" numeric>{k(r.planned)}</Td>
                      <Td align="right" numeric>{k(r.actualRevenue)}</Td>
                      <Td align="right" numeric>{k(r.actualOpex)}</Td>
                      <Td align="right" numeric>{k(r.actual)}</Td>
                      <Td align="right" numeric>{r.gap == null ? '—' : r.gap < 0 ? <Tag tone="accent" size="sm">{k(r.gap)}</Tag> : k(r.gap)}</Td>
                      <Td tone="secondary">{b.actuals.find((a) => a.year === r.year)?.note ?? ''}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState>{t('The CAPEX has no business plan.')}</EmptyState>
            )}
          </SectionCard>
          <SectionCard title={t('Post-audits')} hint={t('6, 12 and 24 months after the start of commissioning; held by the group industrial director')} scroll>
            <Table>
              <thead><tr><Th>{t('Post-audit')}</Th><Th>{t('Due on')}</Th><Th>{t('Status')}</Th><Th>{t('Conclusion')}</Th><Th align="right">{t('NPV')}</Th><Th align="right">{t('IRR')}</Th><Th>{t('Report')}</Th></tr></thead>
              <tbody>
                {b.audits.map((a) => (
                  <tr key={a.milestone}>
                    <Td>{`M+${a.milestone}`}</Td>
                    <Td nowrap>{fmtDate(a.dueOn, lang)}</Td>
                    <Td><Tag tone={a.state === 'late' ? 'accent' : 'outline'} size="xs">{t(AUDIT_STATE[a.state])}</Tag>{a.heldOn && <div className="text-muted" style={{ fontSize: 11.5 }}>{fmtDate(a.heldOn, lang)}</div>}</Td>
                    <Td>{a.record ? t(POST_AUDIT_CONCLUSION_LABEL[a.record.conclusion]) : '—'}</Td>
                    <Td align="right" numeric>{k(a.record?.realNpvKeur)}</Td>
                    <Td align="right" numeric>{pct(a.record?.realIrrPct)}</Td>
                    <Td tone="secondary">{a.record ? `${a.record.summary}${a.record.codexRef ? ` · ${a.record.codexRef}` : ''} · ${a.record.recordedByName}` : ''}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </SectionCard>
        </>
      )}
    </>
  );
}
