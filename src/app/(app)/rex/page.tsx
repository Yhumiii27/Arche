// Lessons learned library (docs/spec/06, 08; D22): the published lessons of the CAPEX the viewer sees (subsidiary isolation
// applies), searched and filtered by phase and category (URL). The same entries are published in pub_rex, where Matrix
// joins them with Keystone's lessons of the EPC2i projects (pub_rex_v2, the common contract of D22).
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { canSee, screenHref } from '@/config/screens';
import { REX_CATEGORIES, REX_CATEGORY_LABEL, type RexCategory } from '@/domain/closure';
import { PHASE_LABEL, labelOf } from '@/domain/capex-labels';
import { PHASES } from '@/domain/lifecycle';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { rexLibrary } from '@/server/dal/rampup';
import { getI18n, getViewer } from '@/server/session';

export default async function RexLibraryPage({ searchParams }: PageProps<'/rex'>) {
  const [{ t, lang }, viewer, sp] = await Promise.all([getI18n(), getViewer(), searchParams]);
  const all = await rexLibrary(viewer);
  const q = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';
  const phase = typeof sp.phase === 'string' ? sp.phase : '';
  const category = typeof sp.category === 'string' ? sp.category : '';
  const rows = all.filter((r) => (!phase || r.phase === phase) && (!category || r.category === category) && (!q || `${r.title} ${r.text} ${dataText(r.title, lang)} ${dataText(r.text, lang)} ${r.capex.code}`.toLowerCase().includes(q)));
  return (
    <>
      <PageHeader screen="rex" crumbs={['Group portfolio']} />
      <form role="search" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" type="search" name="q" defaultValue={q} placeholder={t('Search the lessons')} aria-label={t('Search')} />
        <select className="input" name="phase" defaultValue={phase} aria-label={t('Phase')}>
          <option value="">{t('Every phase')}</option>
          {PHASES.map((p) => <option key={p} value={p}>{t(labelOf(PHASE_LABEL, p))}</option>)}
        </select>
        <select className="input" name="category" defaultValue={category} aria-label={t('Category')}>
          <option value="">{t('Every category')}</option>
          {REX_CATEGORIES.map((c) => <option key={c} value={c}>{t(REX_CATEGORY_LABEL[c])}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary">{t('Filter')}</button>
      </form>
      <KpiGrid>
        <KpiTile label={t('Published lessons')} value={all.length} />
        <KpiTile label={t('CAPEX')} value={new Set(all.map((r) => r.capex.code)).size} />
      </KpiGrid>
      <SectionCard title={t('Lessons learned')} hint={t('Published by the CAPEX teams; entries kept within a team are not shown')} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Phase')}</Th>
                <Th>{t('Category')}</Th>
                <Th>{t('Lesson')}</Th>
                <Th>{t('Published')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td nowrap>
                    {canSee(viewer.role, 'capex-governance') ? <Link href={screenHref('capex-governance', { code: r.capex.code })}>{r.capex.code}</Link> : r.capex.code}
                    <div className="text-muted">{dataText(r.capex.subsidiaryName, lang)}</div>
                  </Td>
                  <Td tone="secondary">{t(labelOf(PHASE_LABEL, r.phase))}</Td>
                  <Td tone="secondary">{t(REX_CATEGORY_LABEL[r.category as RexCategory] ?? r.category)}</Td>
                  <Td>
                    <strong>{dataText(r.title, lang)}</strong>
                    <div className="text-muted">{dataText(r.text, lang)}</div>
                    {r.recommendation && <div>{`${t('Recommendation')} — `}{dataText(r.recommendation, lang)}</div>}
                  </Td>
                  <Td nowrap>{r.publishedAt ? fmtDate(r.publishedAt, lang) : '—'}<div className="text-muted">{r.authorName}</div></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No published lesson.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
