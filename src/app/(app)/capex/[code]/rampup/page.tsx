// Ramp-up of a CAPEX (docs/spec/06 §6, N-16): the start of commissioning (after the PSSR), the production lines with their
// nominal capacity, scrap target and machines of the installed base (Keystone numbers), the daily entries — output, OEE (or
// A × P × Q), scrap, planned stops — with the run of consecutive conforming days that G3 needs, the M+5 alert and the M+6
// limit, and the figures published in pub_rampup.
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { RampupChart, RampupLegend } from '@/components/charts/rampup-chart';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { capacityShare, dayState, oeeOf } from '@/domain/rampup';
import { loadCapexPage } from '@/features/capex/page-data';
import { DayForm, ImportRampupForm, LineForm, StartMesForm } from '@/features/startup/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { modelValues } from '@/server/dal/cycle';
import { hsOf } from '@/server/dal/execution';
import { rampupOf } from '@/server/dal/rampup';
import { projectsOf } from '@/server/integrations/keystone';

const STATUS: Record<string, string> = { not_started: 'Commissioning not started', in_progress: 'In progress', reached: 'Reached', overdue: 'Beyond the time limit' };

export default async function RampupPage({ params }: PageProps<'/capex/[code]/rampup'>) {
  const { t, lang, db, c, can, viewer } = await loadCapexPage(params);
  const today = await businessToday(db);
  const values = await modelValues(db);
  const [r, projects, hs] = await Promise.all([rampupOf(db, c, values, today), projectsOf(db, c.code), hsOf(db, c.id)]);
  const res = r.result;
  const edit = can('rampup');
  const pssr = hs.find((s) => s.code === 'PSSR');
  const pssrPassed = pssr?.status === 'passed' || pssr?.status === 'waived';
  const machines = projects.flatMap((p) => p.machines.map((m) => m.number));
  const pct = (n: number | null) => (n == null ? '—' : `${fmtNum(n, lang)} %`);
  const dayLabel = (d: string) => fmtDate(d, lang).slice(0, 5);
  const canStart = edit && viewer.role === 'project_lead' && c.phase === 'demarrage' && !c.mesStartedOn;
  return (
    <>
      <PageHeader
        screen="capex-rampup"
        title={dataText(c.title, lang)}
        crumbs={['CAPEX register']}
        crumbData={c.code}
        primary={canStart && pssrPassed ? <StartMesForm code={c.code} today={today} /> : edit && c.mesStartedOn && r.lines.length ? <ImportRampupForm code={c.code} /> : undefined}
      />
      <KpiGrid>
        <KpiTile label={t('Start of commissioning')} value={c.mesStartedOn ? fmtDate(c.mesStartedOn, lang) : '—'} sub={c.phase !== 'demarrage' ? t('In phase 4, after the PSSR') : !pssrPassed ? t('PSSR not passed yet') : undefined} />
        <KpiTile label={t('Required run')} value={`${r.rules.requiredDays} ${t('days')}`} sub={`${t('output')} ≥ ${r.rules.capacityPct} % ${t('of nominal, scrap ≤ target')}`} />
        <KpiTile label={t('Lines reached')} value={`${res.lines.filter((l) => l.reachedOn).length} / ${res.lines.length}`} sub={res.reachedOn ? fmtDate(res.reachedOn, lang) : undefined} />
        <KpiTile label={t('Time limit')} value={res.limitOn ? fmtDate(res.limitOn, lang) : '—'} sub={res.alertOn ? `${t('alert on')} ${fmtDate(res.alertOn, lang)}` : `${values.mesMaxMonths} ${t('months after the start of commissioning')}`} tone={res.status === 'overdue' ? 'alert' : 'default'} />
        <KpiTile label={t('Status')} value={t(STATUS[res.status])} tone={res.status === 'overdue' ? 'alert' : 'default'} />
      </KpiGrid>

      {r.lines.length === 0 && (
        <SectionCard title={t('Production lines')}>
          <EmptyState>{c.phase === 'demarrage' ? t('No production line yet.') : t('Production lines are set up in phase 4.')}</EmptyState>
          {edit && c.phase === 'demarrage' && <LineForm code={c.code} machines={machines} />}
        </SectionCard>
      )}

      {r.lines.map((line) => {
        const lr = res.lines.find((x) => x.lineId === line.id)!;
        const mine = r.days.filter((d) => d.lineId === line.id);
        const bars = mine.map((d) => {
          const share = capacityShare(line, d.output);
          const st = dayState(line, d, r.rules);
          return {
            day: d.day, sharePct: share, state: st,
            title: d.plannedStop ? `${fmtDate(d.day, lang)} · ${t('Planned stop')}` : `${fmtDate(d.day, lang)} · ${pct(share)} · ${t('OEE')} ${pct(oeeOf(d))} · ${t('scrap')} ${pct(d.scrapPct)}`,
          };
        });
        const row = r.rows.find((x) => x.id === line.id)!;
        return (
          <SectionCard
            key={line.id}
            title={`${line.number}. ${dataText(line.name, lang)}`}
            hint={`${fmtNum(line.nominalPerDay, lang)} ${dataText(line.unit, lang)} / ${t('day')} · ${t('scrap target')} ${pct(line.scrapTargetPct)}${line.machineNumbers.length ? ` · ${line.machineNumbers.join(', ')}` : ''}`}
            scroll
          >
            <KpiGrid>
              <KpiTile label={t('Current run')} value={`${lr.currentRun} / ${r.rules.requiredDays}`} sub={`${t('best')} ${lr.bestRun}`} />
              <KpiTile label={t('Reached on')} value={lr.reachedOn ? fmtDate(lr.reachedOn, lang) : '—'} />
              <KpiTile label={t('Capacity reached')} value={pct(lr.avgCapacityPct)} sub={t(lr.reachedOn ? 'over the run reached' : 'over the last days entered')} />
              <KpiTile label={t('OEE')} value={pct(lr.avgOeePct)} />
              <KpiTile label={t('Scrap')} value={pct(lr.avgScrapPct)} tone={lr.avgScrapPct != null && lr.avgScrapPct > line.scrapTargetPct ? 'alert' : 'default'} />
            </KpiGrid>
            {bars.length ? (
              <>
                <RampupLegend t={t} />
                <RampupChart bars={bars} requiredPct={r.rules.capacityPct} dayLabel={dayLabel} label={`${t('Ramp-up')} ${line.name}`} />
                <details>
                  <summary>{t('Table view')}</summary>
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t('Day')}</Th>
                        <Th align="right">{t('Output')}</Th>
                        <Th align="right">{t('Capacity')}</Th>
                        <Th align="right">{t('OEE')}</Th>
                        <Th align="right">{t('Scrap')}</Th>
                        <Th>{t('State')}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...mine].reverse().slice(0, 60).map((d) => {
                        const st = dayState(line, d, r.rules);
                        return (
                          <tr key={d.day}>
                            <Td nowrap>{fmtDate(d.day, lang)}</Td>
                            <Td align="right" numeric>{d.output == null ? '—' : fmtNum(d.output, lang)}</Td>
                            <Td align="right" numeric>{pct(capacityShare(line, d.output))}</Td>
                            <Td align="right" numeric>{pct(oeeOf(d))}</Td>
                            <Td align="right" numeric>{pct(d.scrapPct)}</Td>
                            <Td>{st === 'neutral' ? t('Planned stop') : <Tag tone={st === 'conforming' ? 'neutral' : 'outline'} size="xs">{t(st === 'conforming' ? 'Conforming' : 'Not conforming')}</Tag>}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </details>
              </>
            ) : (
              <EmptyState>{c.mesStartedOn ? t('No day entered yet.') : t('Days are entered once commissioning has started.')}</EmptyState>
            )}
            {edit && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {c.mesStartedOn && <DayForm code={c.code} lineId={line.id} label={dataText(line.name, lang)} today={today} />}
                <LineForm code={c.code} machines={machines} line={{ id: row.id, name: row.name, nominalPerDay: row.nominalPerDay, unit: row.unit, scrapTargetPct: row.scrapTargetPct, machineNumbers: row.machineNumbers }} />
              </div>
            )}
          </SectionCard>
        );
      })}
      {edit && r.lines.length > 0 && <div><LineForm code={c.code} machines={machines} /></div>}
    </>
  );
}
