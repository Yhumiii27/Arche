// Decision aid by rules (AR-037): the forecast of the execution, the likely final cost from the reference class of the CAPEX
// already built and the brief of a gate. Server component; values are computed (src/server/dal/decision-aid.ts), typed text
// (risk titles) is shown as typed.
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { type Forecast, COST_DRIFT_PCT, MIN_REFERENCES, SCHEDULE_DRIFT_MONTHS, TREND_MONTHS } from '@/domain/forecast';
import { OUTCOME_LABEL } from '@/domain/circuits';
import { dataText } from '@/i18n/data-text';
import type { Lang } from '@/i18n/translate';
import { fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import type { DecisionAid } from '@/server/dal/decision-aid';

type T = (s: string) => string;

const monthLabelOf = (lang: Lang) => (m: string | null) => (m ? new Date(`${m}-15T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const signed = (n: number, lang: Lang) => `${n > 0 ? '+' : ''}${fmtNum(n, lang)}`;

/** The forecast of the execution by rules (execution page and gate brief). */
export function ForecastCard({ forecast: f, t, lang }: { forecast: Forecast | null; t: T; lang: Lang }) {
  if (!f) return null;
  const month = monthLabelOf(lang);
  return (
    <SectionCard title={t('Forecast by rules')} hint={`${t('From the months measured: the earned value goes on at its pace of the last')} ${TREND_MONTHS} ${t('months; no AI, no data sent')}`}>
      <KpiGrid>
        <KpiTile label={t('Projected finish')} value={month(f.projectedFinish)} sub={`${t('Planned')} ${month(f.plannedFinish)}`} tone={f.drift.schedule ? 'alert' : 'default'} />
        <KpiTile label={t('Delay')} value={f.delayMonths == null ? '—' : `${signed(f.delayMonths, lang)} ${t('month(s)')}`} sub={`${t('drift from')} +${SCHEDULE_DRIFT_MONTHS} ${t('month(s)')}`} tone={f.drift.schedule ? 'alert' : 'default'} />
        <KpiTile label={t('Pace')} value={`${fmtKeur(f.paceKeur, lang)} / ${t('month')}`} sub={t('earned value')} />
        <KpiTile label={t('EAC trend')} value={f.eacTrend ? `${signed(f.eacTrend.deltaPct, lang)} %` : '—'} sub={f.eacTrend ? `${fmtKeur(f.eacTrend.fromKeur, lang)} → ${fmtKeur(f.eacKeur, lang)} ` : t('not enough months yet')} tone={f.drift.cost ? 'alert' : 'default'} />
        <KpiTile label={t('EAC with the schedule')} value={fmtKeur(f.eacCompositeKeur, lang)} sub={t('AC + remaining / (CPI × SPI)')} />
      </KpiGrid>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {f.drift.cost && <Tag tone="accent" size="sm">{`${t('Cost drift')} (> ${COST_DRIFT_PCT} %)`}</Tag>}
        {f.drift.schedule && <Tag tone="accent" size="sm">{t('Schedule drift')}</Tag>}
        {!f.drift.cost && !f.drift.schedule && <Tag tone="outline" size="sm">{t('No drift detected')}</Tag>}
      </div>
    </SectionCard>
  );
}

/** The likely final cost from the CAPEX already built (reference class). */
export function ReferenceCard({ aid, t, lang }: { aid: DecisionAid; t: T; lang: Lang }) {
  const rc = aid.reference;
  return (
    <SectionCard title={t('Comparison with the CAPEX already built')} hint={t('Final cost (closed CAPEX) or EAC (half of the budget earned) against the G2 budget, among the CAPEX you can see')}>
      {rc && aid.range ? (
        <>
          <KpiGrid>
            <KpiTile label={t('Likely final cost')} value={fmtKeur(aid.range.medianKeur, lang)} sub={`${t('median')} · ${t('Budget')} ${fmtKeur(aid.range.budgetKeur, lang)}`} />
            <KpiTile label={t('Cautious final cost')} value={fmtKeur(aid.range.p80Keur, lang)} sub={t('80 % of the CAPEX ended below')} tone={aid.range.p80Keur > aid.range.budgetKeur * 1.1 ? 'alert' : 'default'} />
            <KpiTile label={t('Gap to the G2 budget')} value={`${signed(rc.medianPct, lang)} %`} sub={`${t('80th percentile')} ${signed(rc.p80Pct, lang)} %`} />
          </KpiGrid>
          <span className="text-muted">{`${rc.n} ${t('CAPEX')} ${t(rc.sameType ? 'of the same investment type' : 'of every investment type (fewer than three of the same type)')}: ${rc.codes.join(', ')}`}</span>
        </>
      ) : (
        <span className="text-muted">{`${t('Not enough CAPEX built to compare')} (${t('at least')} ${MIN_REFERENCES})${aid.range == null && aid.reference ? ` · ${t('no budget yet')}` : ''}`}</span>
      )}
    </SectionCard>
  );
}

/** The brief of what the decider looks at before the gate. */
export function GateBriefCard({ aid, t, lang }: { aid: DecisionAid; t: T; lang: Lang }) {
  const b = aid.brief;
  const rows: { label: string; value: string; alert?: boolean }[] = [];
  if (b.budget) rows.push({ label: t('Budget'), value: `${fmtKeur(b.budget.keur, lang)} · ${t('class')} ${b.budget.estimateClass} · v${b.budget.version}` });
  if (b.plan) rows.push({ label: t('Business plan'), value: `${t('NPV')} ${fmtKeur(b.plan.npvKeur, lang)} · ${t('IRR')} ${b.plan.irrPct == null ? '—' : `${fmtNum(b.plan.irrPct, lang)} %`} · ${t('payback')} ${b.plan.paybackYears == null ? '—' : `${fmtNum(b.plan.paybackYears, lang)} ${t('years')}`}${b.plan.validated ? '' : ` · ${t('not validated')}`}`, alert: b.plan.npvKeur < 0 });
  if (b.criteria) rows.push({ label: t('Criteria'), value: `${t('Met')} ${b.criteria.met} · ${t('Not met')} ${b.criteria.unmet.length} · ${t('Forced')} ${b.criteria.forced}${b.criteria.unmet.length ? ` — ${b.criteria.unmet.map((l) => t(l)).join(' · ')}` : ''}`, alert: b.criteria.unmet.length > 0 });
  if (b.opinions) rows.push({ label: t('Expert opinions'), value: `${t(OUTCOME_LABEL.favorable)} ${b.opinions.favourable} · ${t(OUTCOME_LABEL.reserved)} ${b.opinions.reserved} · ${t(OUTCOME_LABEL.unfavorable)} ${b.opinions.unfavourable} · ${t('awaited')} ${b.opinions.missing}`, alert: b.opinions.unfavourable > 0 });
  if (b.risks.length) rows.push({ label: t('Major risks'), value: b.risks.map((r) => `R${r.number} ${dataText(r.title, lang)} (${r.probability}×${r.impact})`).join(' · '), alert: true });
  if (aid.range) rows.push({ label: t('Likely final cost'), value: `${fmtKeur(aid.range.medianKeur, lang)} – ${fmtKeur(aid.range.p80Keur, lang)} (${aid.reference!.n} ${t('CAPEX')})`, alert: aid.range.p80Keur > aid.range.budgetKeur * 1.1 });
  if (aid.forecast) rows.push({ label: t('Execution'), value: `SPI ${fmtRatio(aid.exec.indicators.spi, lang)} · CPI ${fmtRatio(aid.exec.indicators.cpi, lang)}${aid.forecast.drift.cost ? ` · ${t('Cost drift')}` : ''}${aid.forecast.drift.schedule ? ` · ${t('Schedule drift')}` : ''}`, alert: aid.forecast.drift.cost || aid.forecast.drift.schedule });
  return (
    <SectionCard title={`${t('Brief for the decision')}${aid.gate ? ` · ${aid.gate}` : ''}`} hint={t('Computed by rules from the CAPEX’s data; no AI, no data sent')}>
      {rows.length ? (
        <Table>
          <thead><tr><Th>{t('Topic')}</Th><Th>{t('What to look at')}</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <Td nowrap>{r.alert ? <Tag tone="accent" size="sm">{r.label}</Tag> : r.label}</Td>
                <Td>{r.value}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <span className="text-muted">{t('Nothing to report yet.')}</span>
      )}
    </SectionCard>
  );
}
