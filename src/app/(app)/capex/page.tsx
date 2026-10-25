// CAPEX register (docs/spec/08; "Subsidiary portfolio" section, owner 24 Oct 2026): the CAPEX of the subsidiary chosen in the
// sidebar, within the viewer's scope (subsidiary isolation in the data layer), searched and filtered by status and phase
// (URL), with their DIG-PRODI cycle, next gate and validated budget. Main action: "Open a CAPEX" (the guided opening, a sponsor
// or a project lead). A sponsor opens a draft from its row.
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { PhaseBar } from '@/components/app/PhaseBar';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { ButtonLink } from '@/components/ds/Button';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { screenHref } from '@/config/screens';
import { canDo } from '@/domain/capex';
import { PHASE_LABEL, STATUS_LABEL, labelOf } from '@/domain/capex-labels';
import { GATE_LABEL, PHASES, type GateCode } from '@/domain/lifecycle';
import { OpenCapexButton } from '@/features/capex/forms';
import { openGuidedLink } from '@/features/capex/open-link';
import { dataText } from '@/i18n/data-text';
import { fmtKeur } from '@/lib/format';
import { approvalsOf } from '@/server/dal/approvals';
import { portfolioOf, subsidiaryChoice } from '@/server/dal/portfolio';
import { getI18n, getSubsidiaryCookie, getViewer } from '@/server/session';
import s from './register.module.css';

const STATUS_TONE: Record<string, 'accent' | 'outline' | 'neutral'> = { active: 'accent', draft: 'outline', on_hold: 'neutral', closed: 'neutral', abandoned: 'neutral' };

export default async function CapexRegisterPage({ searchParams }: PageProps<'/capex'>) {
  const [{ t, lang }, viewer, sp] = await Promise.all([getI18n(), getViewer(), searchParams]);
  const [all, subs] = await Promise.all([portfolioOf(viewer, null), subsidiaryChoice(viewer, await getSubsidiaryCookie())]);
  const p = { all: all.all, rows: all.rows.filter((c) => !subs.current || c.subsidiaryCode === subs.current) };
  const subName = subs.options.find((o) => o.code === subs.current)?.name ?? null;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const status = typeof sp.status === 'string' ? sp.status : '';
  const phase = typeof sp.phase === 'string' ? sp.phase : '';
  const rows = p.rows.filter((c) => (!q || `${c.code} ${dataText(c.title, lang)} ${c.siteName ?? ''}`.toLowerCase().includes(q.toLowerCase())) && (!status || c.status === status) && (!phase || (c.status !== 'draft' && c.phase === phase)));

  const approvals = await approvalsOf(viewer);

  const active = p.rows.filter((c) => c.status === 'active').length;
  const drafts = p.rows.filter((c) => c.status === 'draft').length;
  const budget = p.rows.reduce((a, c) => a + (c.validatedKeur ?? 0), 0);
  const gates = p.rows.filter((c) => c.nextGate);
  return (
    <>
      <PageHeader
        screen="capex-list"
        crumbs={['Subsidiary portfolio']}
        primary={await openGuidedLink(viewer)}
      />
      <div className={s.toolbar}>
        {subs.current && <Tag tone="outline" size="sm">{`${subs.current} · ${dataText(subName, lang) ?? ''}`}</Tag>}
        <form className={s.filters} role="search">
          <input className="input" type="search" name="q" defaultValue={q} placeholder={t('Code, title, site…')} aria-label={t('Search')} />
          <select className="input" name="status" defaultValue={status} aria-label={t('Status')}>
            <option value="">{t('Every status')}</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{t(v)}</option>
            ))}
          </select>
          <select className="input" name="phase" defaultValue={phase} aria-label={t('Phase')}>
            <option value="">{t('Every phase')}</option>
            {PHASES.map((k) => (
              <option key={k} value={k}>{t(labelOf(PHASE_LABEL, k))}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">{t('Filter')}</button>
        </form>
      </div>
      <KpiGrid>
        <KpiTile label={t('Visible CAPEX')} value={p.rows.length} sub={`${active} ${t('active')} · ${drafts} ${t('draft(s)')}`} />
        <KpiTile label={t('Validated budget')} value={fmtKeur(budget, lang)} sub={t('latest validated versions')} />
        <KpiTile label={t('Gates ahead')} value={gates.length} sub={gates.map((c) => `${c.nextGate} · ${c.code}`).join(', ') || '—'} />
        <KpiTile label={t('My approvals')} value={approvals.length} sub={t('waiting for my decision')} tone={approvals.length ? 'alert' : 'default'} />
      </KpiGrid>
      <SectionCard title={t('CAPEX')} hint={t(`${rows.length} CAPEX`)} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Code')}</Th>
                <Th>{t('Title')}</Th>
                <Th>{t('Subsidiary · site')}</Th>
                <Th>{t('DIG-PRODI cycle')}</Th>
                <Th>{t('Next gate')}</Th>
                <Th align="right">{t('Validated budget')}</Th>
                <Th>{t('Status')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.code}>
                  <Td nowrap>
                    <Link href={screenHref('capex-overview', { code: c.code })}>{c.code}</Link>
                  </Td>
                  <Td>{dataText(c.title, lang)}</Td>
                  <Td tone="secondary">{[c.subsidiaryCode, dataText(c.siteName, lang)].filter(Boolean).join(' · ')}</Td>
                  <Td>
                    <PhaseBar status={c.status} phase={c.phase} label={c.status === 'draft' ? t('Draft') : t(labelOf(PHASE_LABEL, c.phase))} />
                  </Td>
                  <Td tone="secondary" nowrap>{c.nextGate ? `${c.nextGate} · ${t(GATE_LABEL[c.nextGate as GateCode])}` : '—'}</Td>
                  <Td align="right" nowrap>{c.validatedKeur != null ? `${fmtKeur(c.validatedKeur, lang)} · ${c.validatedClass}` : '—'}</Td>
                  <Td nowrap>
                    <Tag tone={STATUS_TONE[c.status] ?? 'neutral'} size="sm">{t(labelOf(STATUS_LABEL, c.status))}</Tag>
                  </Td>
                  <Td align="right" nowrap>
                    {canDo('open', viewer.role, viewer.assignments, c) && <OpenCapexButton code={c.code} />}{' '}
                    <ButtonLink href={screenHref('capex-overview', { code: c.code })} variant="ghost" size="row">{t('View')}</ButtonLink>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{p.all.length ? t('No CAPEX matches these filters.') : t('No CAPEX in your scope.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
