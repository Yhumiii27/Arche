// CAPEX envelopes (AR-040, DECISIONS.md §5): the envelopes voted by the group CFO for a fiscal year and the next ones (the
// multi-year plan) — group, zone, subsidiary; every CAPEX or one typology — with their movements (carry-overs, reallocations)
// and their consumption by the phased disbursements of the CAPEX open or on hold (AR-045). The viewer sees the envelopes of
// their scope and, among the CAPEX that consume them, those they see; the group CFO votes, changes and moves them.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee } from '@/config/screens';
import { ENVELOPE_CATEGORY_LABEL, scopeOf } from '@/domain/envelopes';
import { EnvelopeAmountForm, MoveEnvelopeForm, NewEnvelopeForm } from '@/features/finance/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { subsidiaries, zones } from '@/server/db/schema';
import { visibleCapex } from '@/server/dal/capex';
import { envelopeOverview } from '@/server/dal/finance';
import { getI18n, getViewer } from '@/server/session';

const GROUP_ROLES = new Set(['admin', 'ceo', 'dir_ig', 'group_cfo', 'copil_member']);

export default async function EnvelopesPage({ searchParams }: PageProps<'/envelopes'>) {
  const [{ t, lang }, viewer, sp] = await Promise.all([getI18n(), getViewer(), searchParams]);
  if (!canSee(viewer.role, 'envelopes')) notFound();
  const db = await getDb();
  const today = await businessToday(db);
  const current = Number(today.slice(0, 4));
  const year = typeof sp.year === 'string' && /^\d{4}$/.test(sp.year) ? Number(sp.year) : current;
  const [o, seen, zs, ss] = await Promise.all([envelopeOverview(db, today), visibleCapex(viewer), db.select().from(zones), db.select().from(subsidiaries)]);
  // The envelopes of the viewer's scope: everything for the group's profiles; else their zones' and subsidiaries'.
  const subs = new Set([...seen.map((c) => c.subsidiaryCode), ...(viewer.subsidiaryCode ? [viewer.subsidiaryCode] : [])]);
  const zoneSet = new Set(viewer.assignments.filter((a) => a.scopeKind === 'zone' && a.scopeRef).map((a) => a.scopeRef!));
  const mine = (e: { zoneCode: string | null; subsidiaryCode: string | null }) => GROUP_ROLES.has(viewer.role) || (e.subsidiaryCode ? subs.has(e.subsidiaryCode) : !!e.zoneCode && zoneSet.has(e.zoneCode));
  const states = o.states.filter((s) => mine(s.envelope));
  const codeOf = new Map(seen.map((c) => [c.id, c.code]));
  const cfo = viewer.role === 'group_cfo';
  const ofYear = states.filter((s) => s.envelope.fiscalYear === year).sort((a, b) => scopeOf(a.envelope).localeCompare(scopeOf(b.envelope)));
  const years = [...new Set([current, current + 1, current + 2, ...states.map((s) => s.envelope.fiscalYear)])].sort();
  const label = (e: (typeof states)[number]['envelope']) => `${e.fiscalYear} · ${t(scopeOf(e).startsWith('Zone ') ? 'Zone' : scopeOf(e) === 'Group' ? 'Group' : 'Subsidiary')} ${e.subsidiaryCode ?? e.zoneCode ?? ''} · ${t(ENVELOPE_CATEGORY_LABEL[e.category])}`.replace(/ {2,}/g, ' ');
  const total = ofYear.reduce((s, x) => s + x.totalKeur, 0);
  const consumed = ofYear.reduce((s, x) => s + x.consumedKeur, 0);
  const scopes = [{ value: 'group', label: t('Group') }, ...zs.map((z) => ({ value: `zone:${z.code}`, label: `${t('Zone')} ${z.code} · ${dataText(z.name, lang)}` })), ...ss.map((s) => ({ value: `sub:${s.code}`, label: `${s.code} · ${dataText(s.name, lang)}` }))];
  const movements = o.movements.filter((m) => states.some((s) => s.envelope.id === m.fromId || s.envelope.id === m.toId)).reverse().slice(0, 30);
  const envLabel = new Map(o.envelopes.map((e) => [e.id, label(e)]));
  return (
    <>
      <PageHeader screen="envelopes" crumbs={['Group portfolio']} primary={cfo ? <NewEnvelopeForm scopes={scopes} year={year} /> : undefined} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {years.map((y) => <Link key={y} href={`/envelopes?year=${y}`}><Tag tone={y === year ? 'accent' : 'outline'} size="sm">{y}</Tag></Link>)}
      </div>
      <KpiGrid>
        <KpiTile label={`${t('Envelopes')} ${year}`} value={fmtKeur(total, lang)} sub={`${ofYear.length} ${t('envelope(s)')}`} />
        <KpiTile label={t('Consumed')} value={fmtKeur(consumed, lang)} sub={total > 0 ? `${fmtNum((consumed / total) * 100, lang)} %` : '—'} tone={consumed > total && total > 0 ? 'alert' : 'default'} />
        <KpiTile label={t('Available')} value={fmtKeur(total - consumed, lang)} sub={t('voted ± movements − phased disbursements')} />
      </KpiGrid>
      <SectionCard title={`${t('Envelopes')} ${year}`} hint={t('Each CAPEX consumes its most specific envelope: its subsidiary, else its zone, else the group')} scroll>
        {ofYear.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Scope')}</Th><Th>{t('Category')}</Th><Th align="right">{t('Voted')}</Th><Th align="right">{t('Total')}</Th>
                <Th align="right">{t('Consumed')}</Th><Th align="right">{t('Available')}</Th><Th align="right">%</Th><Th>CAPEX</Th>{cfo && <Th />}
              </tr>
            </thead>
            <tbody>
              {ofYear.map((s) => {
                const e = s.envelope;
                const others = s.capex.filter((x) => !codeOf.has(x.id));
                return (
                  <tr key={e.id}>
                    <Td nowrap>{e.subsidiaryCode ?? (e.zoneCode ? `${t('Zone')} ${e.zoneCode}` : t('Group'))}</Td>
                    <Td>{t(ENVELOPE_CATEGORY_LABEL[e.category])}</Td>
                    <Td align="right" numeric>{fmtKeur(e.amountKeur, lang)}</Td>
                    <Td align="right" numeric>{fmtKeur(s.totalKeur, lang)}</Td>
                    <Td align="right" numeric>{fmtKeur(s.consumedKeur, lang)}</Td>
                    <Td align="right" numeric>{s.availableKeur < 0 ? <Tag tone="accent" size="sm">{fmtKeur(s.availableKeur, lang)}</Tag> : fmtKeur(s.availableKeur, lang)}</Td>
                    <Td align="right" numeric>{s.usedPct == null ? '—' : `${fmtNum(s.usedPct, lang)} %`}</Td>
                    <Td tone="secondary">
                      {s.capex.filter((x) => codeOf.has(x.id)).map((x) => <div key={x.id}><Link href={`/capex/${encodeURIComponent(codeOf.get(x.id)!)}/budget`}>{codeOf.get(x.id)}</Link>{` · ${fmtKeur(x.keur, lang)}`}</div>)}
                      {others.length > 0 && <div>{`${others.length} ${t('other CAPEX')} · ${fmtKeur(others.reduce((a, x) => a + x.keur, 0), lang)}`}</div>}
                    </Td>
                    {cfo && (
                      <Td align="right" nowrap>
                        <EnvelopeAmountForm id={e.id} amount={e.amountKeur} label={label(e)} />
                        <MoveEnvelopeForm id={e.id} label={label(e)} targets={ofYear.filter((x) => x.envelope.id !== e.id).map((x) => ({ value: x.envelope.id, label: label(x.envelope) }))} />
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No envelope voted for this fiscal year.')}</EmptyState>
        )}
      </SectionCard>
      <SectionCard title={t('Multi-year plan')} hint={t('Total of the envelopes and consumption by fiscal year')} scroll>
        <Table>
          <thead><tr><Th>{t('Fiscal year')}</Th><Th align="right">{t('Total')}</Th><Th align="right">{t('Consumed')}</Th><Th align="right">{t('Available')}</Th></tr></thead>
          <tbody>
            {years.map((y) => {
              const of = states.filter((s) => s.envelope.fiscalYear === y);
              const tot = of.reduce((a, s) => a + s.totalKeur, 0);
              const con = of.reduce((a, s) => a + s.consumedKeur, 0);
              return <tr key={y}><Td>{y}</Td><Td align="right" numeric>{fmtKeur(tot, lang)}</Td><Td align="right" numeric>{fmtKeur(con, lang)}</Td><Td align="right" numeric>{fmtKeur(tot - con, lang)}</Td></tr>;
            })}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title={t('Movements')} scroll>
        {movements.length ? (
          <Table>
            <thead><tr><Th>{t('Date')}</Th><Th>{t('Kind')}</Th><Th>{t('From')}</Th><Th>{t('To')}</Th><Th align="right">{t('Amount')}</Th><Th>{t('Reason')}</Th><Th>{t('By')}</Th></tr></thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <Td nowrap>{fmtDate(m.occurredAt, lang)}</Td>
                  <Td>{t(m.kind === 'carry_over' ? 'Carry-over' : 'Reallocation')}</Td>
                  <Td>{m.fromId ? envLabel.get(m.fromId) : '—'}</Td>
                  <Td>{m.toId ? envLabel.get(m.toId) : '—'}</Td>
                  <Td align="right" numeric>{fmtKeur(m.amountKeur, lang)}</Td>
                  <Td tone="secondary">{dataText(m.reason, lang)}</Td>
                  <Td tone="secondary">{m.byName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No movement yet.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
