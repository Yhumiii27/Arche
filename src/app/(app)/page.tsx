// Home (docs/spec/08): who I am in Arche — profile, scope —, my approvals, the rule-based alerts and the next gates of the
// CAPEX I follow (mine: team, sponsor, lead; all of my scope for the central functions and the zone directors), and the CAPEX
// I see.
import Link from 'next/link';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { CROSS_VIEW_ROLES, ROLE_LABEL } from '@/config/roles';
import { canSee, screenHref } from '@/config/screens';
import { PHASE_LABEL, labelOf } from '@/domain/capex-labels';
import { GATE_LABEL } from '@/domain/lifecycle';
import { alertDetail } from '@/features/governance/alert-detail';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { approvalsOf } from '@/server/dal/approvals';
import { isMine, visibleCapex } from '@/server/dal/capex';
import { alertsForViewer } from '@/server/dal/governance';
import { getI18n, getViewer } from '@/server/session';

export default async function HomePage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const capex = await visibleCapex(viewer);
  const broad = viewer.role === 'ceo' || viewer.role === 'zone_director' || CROSS_VIEW_ROLES.includes(viewer.role);
  const followed = canSee(viewer.role, 'capex-overview') ? await alertsForViewer(viewer, (c) => broad || isMine(viewer, c)) : { alerts: [], rows: [] };
  const approvals = canSee(viewer.role, 'approvals') ? await approvalsOf(viewer) : [];
  const scopes = viewer.assignments.filter((a) => a.role === viewer.role).map((a) => a.scopeRef ?? t('Whole group'));
  const gates = followed.rows.filter((r) => r.dash.nextGate).sort((a, b) => Number(!!b.dash.running?.late) - Number(!!a.dash.running?.late));
  const alerts = followed.alerts.filter((a) => a.level === 'alert');
  return (
    <>
      <PageHeader screen="home" title={`${t('Hello')} ${viewer.name.split(' ')[0]}`} />
      <KpiGrid>
        <KpiTile label={t('Active profile')} value={t(ROLE_LABEL[viewer.role])} sub={scopes.join(' · ')} size="lg" />
        <KpiTile label={t('Visible CAPEX')} value={capex.length} sub={t(`${capex.length} visible CAPEX`)} size="lg" />
        {canSee(viewer.role, 'approvals') && <KpiTile label={t('My approvals')} value={approvals.length} sub={t('waiting for my decision')} tone={approvals.length ? 'alert' : 'default'} size="lg" />}
        {canSee(viewer.role, 'capex-overview') && <KpiTile label={t('Alerts')} value={alerts.length} sub={`${followed.alerts.length - alerts.length} ${t('to watch')}`} tone={alerts.length ? 'alert' : 'default'} size="lg" />}
      </KpiGrid>
      {followed.alerts.length > 0 && (
        <SectionCard title={t('Alerts')} hint={t(broad ? 'CAPEX of my scope' : 'CAPEX I follow')} scroll>
          <Table>
            <tbody>
              {followed.alerts.slice(0, 15).map((a, n) => (
                <tr key={n}>
                  <Td nowrap><Tag tone={a.level === 'alert' ? 'accent' : 'outline'} size="xs">{t(a.level === 'alert' ? 'Alert' : 'To watch')}</Tag></Td>
                  <Td nowrap>{canSee(viewer.role, a.screen) ? <Link href={screenHref(a.screen, { code: a.capexCode })}>{a.capexCode}</Link> : a.capexCode}</Td>
                  <Td>{t(a.text)}</Td>
                  <Td tone="secondary">{alertDetail(a.detail, t, lang)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      )}
      {gates.length > 0 && (
        <SectionCard title={t('Next gates')} scroll>
          <Table>
            <thead>
              <tr>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Gate')}</Th>
                <Th>{t('State')}</Th>
                <Th>{t('Target decision')}</Th>
              </tr>
            </thead>
            <tbody>
              {gates.map((r) => (
                <tr key={r.id}>
                  <Td>{canSee(viewer.role, 'capex-gates') ? <Link href={screenHref('capex-gates', { code: r.code })}>{r.code}</Link> : r.code} <span className="text-muted">{dataText(r.title, lang)}</span></Td>
                  <Td nowrap>{`${r.dash.nextGate} · ${t(GATE_LABEL[r.dash.nextGate!])}`}</Td>
                  <Td nowrap>{r.dash.running ? <Tag tone={r.dash.running.late ? 'accent' : 'outline'} size="xs">{t(r.dash.running.late ? 'Late' : 'In progress')}</Tag> : t('To submit')}</Td>
                  <Td nowrap>{r.dash.running?.targetOn ? fmtDate(r.dash.running.targetOn, lang) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      )}
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
