// Investment ideas (AR-051, DECISIONS.md §5): the backlog of the subsidiaries the viewer covers — the subsidiary chosen in the
// sidebar first — before the formal request. Anyone of the business proposes; the sponsor, the zone director or the group
// industrial director qualifies, retains or sets aside; a retained idea becomes a CAPEX draft through "Open a CAPEX".
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee, screenHref } from '@/config/screens';
import { INVESTMENT_TYPE_LABEL } from '@/domain/capex-labels';
import { creatableSubsidiaries, type InvestmentType } from '@/domain/capex';
import { canDecideIdea, canPropose, decisionsOn, ideaRef, IDEA_STATUSES, IDEA_STATUS_LABEL, type IdeaStatus } from '@/domain/ideas';
import { DecideIdeaForm, ProposeIdeaForm } from '@/features/ideas/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur } from '@/lib/format';
import { getDb } from '@/server/db/client';
import { subsidiaries } from '@/server/db/schema';
import { ideaSubsidiaries, ideasOf } from '@/server/dal/ideas';
import { getI18n, getSubsidiaryCookie, getViewer } from '@/server/session';

export default async function IdeasPage({ searchParams }: PageProps<'/ideas'>) {
  const [{ t, lang }, viewer, cookie, sp] = await Promise.all([getI18n(), getViewer(), getSubsidiaryCookie(), searchParams]);
  if (!canSee(viewer.role, 'ideas')) notFound();
  const db = await getDb();
  const subs = await ideaSubsidiaries(db, viewer);
  const names = new Map((await db.select({ code: subsidiaries.code, name: subsidiaries.name }).from(subsidiaries)).map((s) => [s.code, s.name]));
  const all = await ideasOf(db, subs);
  const status = typeof sp.status === 'string' && (IDEA_STATUSES as readonly string[]).includes(sp.status) ? (sp.status as IdeaStatus) : null;
  const rows = status ? all.filter((i) => i.status === status) : all.filter((i) => i.status !== 'rejected' && i.status !== 'converted');
  const creatable = creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode);
  const count = (s: IdeaStatus) => all.filter((i) => i.status === s).length;
  const options = subs.map((c) => ({ value: c, label: `${c} · ${dataText(names.get(c) ?? c, lang)}` }));
  return (
    <>
      <PageHeader screen="ideas" crumbs={['Subsidiary portfolio']} primary={canPropose(viewer.role) && subs.length ? <ProposeIdeaForm subsidiaries={options} initial={cookie && subs.includes(cookie) ? cookie : null} /> : undefined} />
      <KpiGrid>
        <KpiTile label={t('To qualify')} value={count('new')} />
        <KpiTile label={t('Qualified')} value={count('qualified')} />
        <KpiTile label={t('Retained')} value={count('retained')} sub={t('to turn into a CAPEX')} />
        <KpiTile label={t('Became a CAPEX')} value={count('converted')} sub={`${count('rejected')} ${t('set aside')}`} />
      </KpiGrid>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/ideas"><Tag tone={!status ? 'accent' : 'outline'} size="sm">{t('Open ideas')}</Tag></Link>
        {IDEA_STATUSES.map((s) => <Link key={s} href={`/ideas?status=${s}`}><Tag tone={status === s ? 'accent' : 'outline'} size="sm">{`${t(IDEA_STATUS_LABEL[s])} (${count(s)})`}</Tag></Link>)}
      </div>
      <SectionCard title={t('Ideas')} hint={t('Proposed before the formal request; a retained idea becomes a CAPEX draft through “Open a CAPEX”')} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr><Th>{t('Reference')}</Th><Th>{t('Idea')}</Th><Th>{t('Subsidiary')}</Th><Th align="right">{t('Order of magnitude (k€)')}</Th><Th>{t('Proposed by')}</Th><Th>{t('Status')}</Th><Th /></tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const decisions = canDecideIdea(viewer.role, viewer.assignments, i) ? decisionsOn(i.status as IdeaStatus) : [];
                const ref = ideaRef(i.subsidiaryCode, i.number);
                return (
                  <tr key={i.id}>
                    <Td nowrap>{ref}</Td>
                    <Td>
                      <div>{dataText(i.title, lang)}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{dataText(i.stake, lang)}</div>
                      {i.investmentType && <Tag tone="outline" size="xs">{t(INVESTMENT_TYPE_LABEL[i.investmentType as InvestmentType])}</Tag>}
                    </Td>
                    <Td>{i.subsidiaryCode}</Td>
                    <Td align="right" numeric>{i.sizeKeur == null ? '—' : fmtKeur(i.sizeKeur, lang)}</Td>
                    <Td nowrap tone="secondary">{`${i.proposedByName} · ${fmtDate(i.createdAt, lang)}`}</Td>
                    <Td>
                      <Tag tone={i.status === 'retained' ? 'accent' : 'outline'} size="xs">{t(IDEA_STATUS_LABEL[i.status as IdeaStatus])}</Tag>
                      {i.decidedByName && <div className="text-muted" style={{ fontSize: 11.5 }}>{`${i.decidedByName}${i.decisionNote ? ` · ${dataText(i.decisionNote, lang)}` : ''}`}</div>}
                      {i.capexCode && canSee(viewer.role, 'capex-overview') && <div><Link href={screenHref('capex-overview', { code: i.capexCode })}>{i.capexCode}</Link></div>}
                    </Td>
                    <Td align="right" nowrap>
                      {decisions.length > 0 && <DecideIdeaForm id={i.id} label={`${ref} · ${i.title}`} decisions={decisions} />}
                      {i.status === 'retained' && creatable.includes(i.subsidiaryCode) && <Link href={`/open?idea=${i.id}`}>{t('Open the CAPEX')}</Link>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No idea here.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
