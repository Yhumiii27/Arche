// COPIL GPI (docs/spec/06 §5, 08; N-6, N-7): the dossiers submitted to G1 whose circuit runs — the steps still open and the
// time left on the 2 working days of the decision (the president, the group industrial director, records it in the circuit) —
// and the G1 decisions of the last 90 days. Only the CAPEX the viewer sees.
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee, screenHref } from '@/config/screens';
import { TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { workingDaysBetween } from '@/domain/circuits';
import { DECISION_LABEL } from '@/domain/lifecycle';
import { dataText } from '@/i18n/data-text';
import { copilAgenda } from '@/server/dal/governance';
import { SCENARIO_KIND_LABEL } from '@/domain/scenarios';
import { fmtDate, fmtKeur, fmtNum } from '@/lib/format';
import { getDb } from '@/server/db/client';
import { scenariosOf } from '@/server/dal/priority';
import { getI18n, getViewer } from '@/server/session';

const STEP_STATUS: Record<string, string> = { waiting: 'Waiting', open: 'Open', done: 'Done', cancelled: 'Cancelled' };

export default async function CopilPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const a = await copilAgenda(viewer);
  const gatesHref = (code: string) => (canSee(viewer.role, 'capex-gates') ? screenHref('capex-gates', { code }) : null);
  const late = a.running.filter((r) => r.decision?.dueOn && r.decision.dueOn < a.today);
  // The portfolio scenario retained for the committee (AR-043), for the profiles that see the scenarios.
  const retained = canSee(viewer.role, 'scenarios') ? (await scenariosOf(await getDb(), a.today)).scenarios.find((s) => s.retained) ?? null : null;
  const thisYear = Number(a.today.slice(0, 4));
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
  return (
    <>
      <PageHeader screen="copil" crumbs={['Group portfolio']} />
      <KpiGrid>
        <KpiTile label={t('Dossiers submitted to G1')} value={a.running.length} />
        <KpiTile label={t('Decisions past the 2 working days')} value={late.length} tone={late.length ? 'alert' : 'default'} />
        <KpiTile label={t('G1 decisions in 90 days')} value={a.decided.length} />
      </KpiGrid>

      <SectionCard title={t('Agenda: G1 in progress')} hint={t('The president (group industrial director) records the decision of the committee in the circuit')} scroll>
        {a.running.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Submitted on')}</Th>
                <Th>{t('Steps')}</Th>
                <Th>{t('Decision due')}</Th>
                <Th>{t('Time left')}</Th>
              </tr>
            </thead>
            <tbody>
              {a.running.map((r) => {
                const due = r.decision?.dueOn ?? null;
                const left = due ? workingDaysBetween(a.today, due) : null;
                const h = gatesHref(r.capex.code);
                return (
                  <tr key={r.capex.id}>
                    <Td>
                      {h ? <Link href={h}>{r.capex.code}</Link> : r.capex.code} <span className="text-muted">{dataText(r.capex.title, lang)}</span>
                      <div className="text-muted">{`${dataText(r.capex.subsidiaryName, lang)}${r.capex.typology ? ` · ${t(labelOf(TYPOLOGY_LABEL, r.capex.typology))}` : ''} · ${t('session')} ${r.session}`}</div>
                    </Td>
                    <Td nowrap>{fmtDate(r.submittedOn, lang)}</Td>
                    <Td tone="secondary">{r.steps.map((s) => `${t(s.label)}: ${t(STEP_STATUS[s.status] ?? s.status)}`).join(' · ')}</Td>
                    <Td nowrap>{due ? fmtDate(due, lang) : t('After the opinions and the visa')}</Td>
                    <Td nowrap>{left == null ? '—' : left < 0 ? <Tag tone="accent" size="xs">{`${-left} ${t('working day(s) late')}`}</Tag> : `${left} ${t('working day(s)')}`}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No dossier submitted to G1.')}</EmptyState>
        )}
      </SectionCard>

      {retained && (
        <SectionCard title={t('Retained portfolio scenario')} hint={`${dataText(retained.name, lang)} · ${t(SCENARIO_KIND_LABEL[retained.kind])} · ${retained.retainedByName ?? ''}`} actions={<Link href="/scenarios">{t('Portfolio scenarios')}</Link>} scroll>
          <Table>
            <thead><tr><Th>{t('Fiscal year')}</Th>{years.map((y) => <Th key={y} align="right">{y}</Th>)}</tr></thead>
            <tbody>
              <tr><Td>{t('Spend (k€)')}</Td>{years.map((y) => <Td key={y} align="right" numeric>{(retained.result.overByYear[y] ?? 0) > 0 ? <Tag tone="accent" size="sm">{fmtKeur(retained.result.byYear[y] ?? 0, lang)}</Tag> : fmtKeur(retained.result.byYear[y] ?? 0, lang)}</Td>)}</tr>
              <tr><Td>{t('Envelope (k€)')}</Td>{years.map((y) => <Td key={y} align="right" numeric tone="secondary">{retained.envelopes[String(y)] != null ? fmtKeur(retained.envelopes[String(y)], lang) : '—'}</Td>)}</tr>
            </tbody>
          </Table>
          <p style={{ fontSize: 12.5, marginTop: 8 }}>
            {`${retained.result.kept} ${t('CAPEX kept')}, ${retained.result.left} ${t('left out')} · ${t('NPV (k€)')} ${fmtKeur(retained.result.npvKeur, lang)} · ${t('Major risks')} ${retained.result.majorRisks} · ${t('Mean score')} ${retained.result.meanScore == null ? '—' : fmtNum(retained.result.meanScore, lang)} · ${fmtDate(retained.updatedAt, lang)}`}
          </p>
        </SectionCard>
      )}

      <SectionCard title={t('Recent G1 decisions')} scroll>
        {a.decided.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Decision')}</Th>
                <Th>{t('Date')}</Th>
                <Th>{t('Recorded by')}</Th>
                <Th>{t('Reason')}</Th>
              </tr>
            </thead>
            <tbody>
              {a.decided.map((d) => {
                const h = gatesHref(d.capex.code);
                return (
                  <tr key={`${d.capex.id}-${d.session}`}>
                    <Td>{h ? <Link href={h}>{d.capex.code}</Link> : d.capex.code} <span className="text-muted">{dataText(d.capex.title, lang)}</span></Td>
                    <Td>{d.decision ? t(DECISION_LABEL[d.decision]) : '—'}</Td>
                    <Td nowrap>{fmtDate(d.decidedAt, lang)}</Td>
                    <Td tone="secondary">{d.decidedByName ?? '—'}</Td>
                    <Td tone="secondary">{dataText(d.reason, lang) ?? '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No G1 decision in the last 90 days.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
