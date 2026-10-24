// Action plan of a CAPEX (owner's pilot feedback, 24 Oct 2026; DECISIONS.md §5): the follow-up actions opened from its pages
// — owner, due date, the element they come from —, open first, late ones flagged; filtered by status (URL). "New action" is
// in the header of every CAPEX page.
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { screenHref } from '@/config/screens';
import { ACTION_SOURCE_LABEL, ACTION_STATUS_LABEL, actionCounts, isLate, SCREEN_OF_SOURCE, type ActionSource, type ActionStatus } from '@/domain/actions';
import { refOf } from '@/domain/capex';
import { ActionFormPanel, CloseActionForm } from '@/features/actions/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { actionPeople, actionsOf } from '@/server/dal/actions';

export default async function ActionPlanPage({ params, searchParams }: PageProps<'/capex/[code]/actions'>) {
  const [{ t, lang, db, c, can, viewer }, sp] = await Promise.all([loadCapexPage(params), searchParams]);
  const [rows, people, today] = await Promise.all([actionsOf(db, c.id), actionPeople(db, c), businessToday(db)]);
  const status = typeof sp.status === 'string' && ['open', 'done', 'cancelled', 'all'].includes(sp.status) ? sp.status : 'open';
  const shown = rows.filter((a) => status === 'all' || a.status === status).sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || a.number - b.number);
  const n = actionCounts(rows, today);
  const edit = can('actions');
  const tab = (k: string, label: string) => (
    <Link key={k} href={`?status=${k}`} className={`btn btn-${status === k ? 'secondary' : 'ghost'} btn-sm`} aria-current={status === k ? 'page' : undefined}>{t(label)}</Link>
  );
  return (
    <>
      <PageHeader screen="capex-actions" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <KpiGrid>
        <KpiTile label={t('Open actions')} value={n.open} />
        <KpiTile label={t('Late')} value={n.late} tone={n.late ? 'alert' : 'default'} sub={t('open past their due date')} />
        <KpiTile label={t('Done')} value={n.done} />
      </KpiGrid>
      <div style={{ display: 'flex', gap: 6 }}>{[tab('open', 'Open'), tab('done', 'Done'), tab('cancelled', 'Cancelled'), tab('all', 'All')]}</div>
      <SectionCard title={t('Action plan')} hint={`${shown.length}`} scroll>
        {shown.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Action')}</Th>
                <Th>{t('Comes from')}</Th>
                <Th>{t('Owner')}</Th>
                <Th>{t('Due date')}</Th>
                <Th>{t('Status')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const late = isLate(a, today);
                const mayClose = a.status === 'open' && (edit || a.ownerUserId === viewer.userId);
                return (
                  <tr key={a.id}>
                    <Td nowrap>{refOf('A', a.number)}</Td>
                    <Td>
                      {dataText(a.title, lang)}
                      {a.description && <div className="text-muted">{dataText(a.description, lang)}</div>}
                      {a.closingNote && <div className="text-muted">{`${t('Note')} — ${dataText(a.closingNote, lang)}`}</div>}
                    </Td>
                    <Td tone="secondary">
                      <Link href={screenHref(SCREEN_OF_SOURCE[a.source as ActionSource] ?? 'capex-overview', { code: c.code })}>{t(ACTION_SOURCE_LABEL[a.source as ActionSource] ?? a.source)}</Link>
                      {a.sourceRef && ` · ${a.sourceRef}`}
                    </Td>
                    <Td tone="secondary">{a.ownerName ?? '—'}</Td>
                    <Td nowrap>{fmtDate(a.dueOn, lang) || '—'}{late && <> <Tag tone="accent" size="xs">{t('Late')}</Tag></>}</Td>
                    <Td nowrap>
                      <Tag tone={a.status === 'open' ? 'outline' : 'neutral'} size="xs">{t(ACTION_STATUS_LABEL[a.status as ActionStatus])}</Tag>
                      {a.closedOn && <span className="text-muted">{` ${fmtDate(a.closedOn, lang)}`}</span>}
                    </Td>
                    <Td align="right" nowrap>
                      {edit && a.status === 'open' && (
                        <ActionFormPanel code={c.code} people={people} action={{ id: a.id, title: a.title, description: a.description, source: a.source as ActionSource, sourceRef: a.sourceRef, ownerUserId: a.ownerUserId, dueOn: a.dueOn }} />
                      )}{' '}
                      {mayClose && <CloseActionForm code={c.code} id={a.id} />}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t(status === 'open' ? 'No open action. Use “New action” at the top of any page of the CAPEX.' : 'No action.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
