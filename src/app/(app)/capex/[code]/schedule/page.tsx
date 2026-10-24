// WBS & Gantt of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): the Gantt of the whole CAPEX — summary, lots
// and their tasks, tasks of the CAPEX, one summary bar per EPC2i project (from Keystone, no detail), cycle milestones — and
// the WBS table where the project lead, the sponsor and the Co-DIG add and update tasks (right `schedule`).
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { CapexGantt } from '@/components/charts/capex-gantt';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { refOf } from '@/domain/capex';
import { loadCapexPage } from '@/features/capex/page-data';
import { capexGantt } from '@/features/schedule/gantt-rows';
import { DeleteTaskButton, TaskForm } from '@/features/schedule/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { actionPeople } from '@/server/dal/actions';
import { scheduleOf } from '@/server/dal/schedule';

export default async function SchedulePage({ params }: PageProps<'/capex/[code]/schedule'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const [sched, people, today] = await Promise.all([scheduleOf(db, c), actionPeople(db, c), businessToday(db)]);
  const edit = can('schedule');
  const lots = sched.lots.map((l) => ({ value: l.id, label: `${l.number}. ${dataText(l.title, lang)}` }));
  const g = capexGantt(sched, dataText(c.title, lang), today, lang, t);
  const tasks = [...sched.general, ...sched.lots.flatMap((l) => l.tasks)];
  const late = tasks.filter((x) => x.end < today && x.progressPct < 100);
  const lotOf = new Map(sched.lots.map((l) => [l.id, `${l.number}. ${dataText(l.title, lang)}`]));
  return (
    <>
      <PageHeader screen="capex-schedule" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} primary={edit ? <TaskForm code={c.code} lots={lots} people={people} primary /> : undefined} />
      <KpiGrid>
        <KpiTile label={t('Start')} value={sched.summary ? fmtDate(sched.summary.start, lang) : '—'} />
        <KpiTile label={t('Forecast end')} value={sched.summary ? fmtDate(sched.summary.end, lang) : '—'} />
        <KpiTile label={t('Progress')} value={sched.summary ? `${sched.summary.progressPct} %` : '—'} sub={t('weighted by duration')} />
        <KpiTile label={t('Tasks late')} value={late.length} sub={`${tasks.length} ${t('task(s)')}`} tone={late.length ? 'alert' : 'default'} />
      </KpiGrid>
      <SectionCard title={t('Gantt of the CAPEX')} hint={t('EPC2i projects: one summary bar each (detail in Keystone)')} scroll>
        <CapexGantt {...g} />
      </SectionCard>
      <SectionCard title={t('WBS')} hint={t('Lots of the CAPEX and their tasks; a lot without task keeps its planned months (Execution page)')} scroll>
        {tasks.length || sched.lots.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Task')}</Th>
                <Th>{t('Lot')}</Th>
                <Th>{t('Owner')}</Th>
                <Th>{t('Start')}</Th>
                <Th>{t('End')}</Th>
                <Th align="right">{t('Progress')}</Th>
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {sched.lots.map((l) => (
                <tr key={l.id}>
                  <Td nowrap><strong>{`L${l.number}`}</strong></Td>
                  <Td><strong>{dataText(l.title, lang)}</strong></Td>
                  <Td tone="secondary">{l.epc2i ? 'EPC2i' : '—'}</Td>
                  <Td />
                  <Td nowrap>{l.span ? fmtDate(l.span.start, lang) : '—'}</Td>
                  <Td nowrap>{l.span ? fmtDate(l.span.end, lang) : '—'}</Td>
                  <Td align="right">{l.span ? `${l.span.progressPct} %` : '—'}</Td>
                  {edit && <Td align="right"><TaskForm code={c.code} lots={lots} people={people} lotId={l.id} /></Td>}
                </tr>
              ))}
              {tasks.map((x) => (
                <tr key={x.id}>
                  <Td nowrap>{refOf('T', x.number)}</Td>
                  <Td>{dataText(x.name, lang)}{x.milestone && <> <Tag tone="outline" size="xs">{t('Milestone')}</Tag></>}</Td>
                  <Td tone="secondary">{x.lotId ? lotOf.get(x.lotId) : t('CAPEX (no lot)')}</Td>
                  <Td tone="secondary">{x.ownerName ?? '—'}</Td>
                  <Td nowrap>{fmtDate(x.start, lang)}</Td>
                  <Td nowrap>{fmtDate(x.end, lang)}{x.end < today && x.progressPct < 100 && <> <Tag tone="accent" size="xs">{t('Late')}</Tag></>}</Td>
                  <Td align="right">{`${x.progressPct} %`}</Td>
                  {edit && (
                    <Td align="right" nowrap>
                      <TaskForm code={c.code} lots={lots} people={people} task={{ id: x.id, lotId: x.lotId, name: x.name, startOn: x.start, endOn: x.end, progressPct: x.progressPct, ownerUserId: x.ownerUserId, milestone: x.milestone }} />{' '}
                      <DeleteTaskButton code={c.code} id={x.id} />
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No lot nor task yet.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
