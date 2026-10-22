// Home (docs/spec/08): who I am in Arche — profile, scope — and the CAPEX I see. Later deliveries add my approvals, the alerts
// and the next gates.
import Link from 'next/link';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { PageHeader } from '@/components/app/shell/page-header';
import { ROLE_LABEL } from '@/config/roles';
import { canSee, screenHref } from '@/config/screens';
import { PHASE_LABEL, labelOf } from '@/domain/capex-labels';
import { dataText } from '@/i18n/data-text';
import { visibleCapex } from '@/server/dal/capex';
import { getI18n, getViewer } from '@/server/session';

export default async function HomePage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const capex = await visibleCapex(viewer);
  const scopes = viewer.assignments.filter((a) => a.role === viewer.role).map((a) => a.scopeRef ?? t('Whole group'));
  return (
    <>
      <PageHeader screen="home" title={`${t('Hello')} ${viewer.name.split(' ')[0]}`} />
      <KpiGrid>
        <KpiTile label={t('Active profile')} value={t(ROLE_LABEL[viewer.role])} sub={scopes.join(' · ')} size="lg" />
        <KpiTile label={t('Visible CAPEX')} value={capex.length} sub={t(`${capex.length} visible CAPEX`)} size="lg" />
      </KpiGrid>
      <SectionCard title={t('My CAPEX')}>
        {capex.length ? (
          capex.map((c) => (
            <div key={c.code} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              {canSee(viewer.role, 'capex-overview') ? <Link href={screenHref('capex-overview', { code: c.code })}>{c.code}</Link> : <span>{c.code}</span>}
              <span>{dataText(c.title, lang)}</span>
              <span className="text-muted">{t(labelOf(PHASE_LABEL, c.phase))}</span>
            </div>
          ))
        ) : (
          <EmptyState>{t('No CAPEX in your scope.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
