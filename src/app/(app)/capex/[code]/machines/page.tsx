// Machine needs and EPC2i projects (docs/spec/07): the needs of the CAPEX with the latest answer of EPC2i (the one that is
// authoritative), and the follow-up of the projects EPC2i opened for them — milestones, progress, amendments, reservations,
// acceptance reports — read in the Keystone mirror, with links to Keystone. Arche never writes to Keystone.
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { ANSWER_NATURE_LABEL, canSubmitNeeds, firmOffersFact, isValidFirmOffer, latestAnswer, MILESTONE_LABEL, NEED_STATUS_LABEL, QUALIFICATION_LABEL, type NeedStatus } from '@/domain/needs';
import { loadCapexPage } from '@/features/capex/page-data';
import { DeleteNeedButton, NeedForm, SubmitNeedButton, WithdrawNeedForm, type SheetChoice } from '@/features/needs/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtInstant, fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { capexLots } from '@/server/db/schema';
import { needsOf } from '@/server/dal/needs';
import { answersOf, catalogue, keystoneProjectUrl, projectsOf, syncState } from '@/server/integrations/keystone';
import { codexDocumentUrl } from '@/server/integrations/codex';
import { and, asc, eq } from 'drizzle-orm';

const STATUS_TONE: Record<NeedStatus, 'neutral' | 'accent' | 'outline'> = { draft: 'outline', submitted: 'accent', withdrawn: 'outline', ordered: 'neutral' };
const RESERVE_STATUS: Record<string, string> = { open: 'Open', in_progress: 'In progress', closed: 'Cleared' };
const AMENDMENT_STATUS: Record<string, string> = { propose: 'Proposed', signe: 'Signed', refuse: 'Refused' };
const DELIVERABLE_STATUS: Record<string, string> = { planned: 'Planned', accepted: 'Accepted', rejected: 'Rejected' };

export default async function MachinesPage({ params }: PageProps<'/capex/[code]/machines'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const [needs, answers, sheets, projects, sync, today, lots] = await Promise.all([
    needsOf(db, c), answersOf(db, c.code), catalogue(db), projectsOf(db, c.code), syncState(db), businessToday(db),
    db.select({ id: capexLots.id, number: capexLots.number, title: capexLots.title }).from(capexLots).where(and(eq(capexLots.capexId, c.id), eq(capexLots.kind, 'machines'))).orderBy(asc(capexLots.number)),
  ]);
  const edit = can('needs') && canSubmitNeeds(c);
  const published = sheets.filter((s) => s.status === 'publie');
  const choices: SheetChoice[] = published.map((s) => ({
    value: `${s.code}@${s.version}`,
    label: `${s.code} v${s.version} — ${dataText(s.label, lang)}${s.priceKeur != null ? ` · ${fmtKeur(s.priceKeur, lang)}` : ''}`,
    options: s.options.map((o) => ({ code: o.code, label: `${dataText(o.label, lang)}${o.priceKeur != null ? ` (+${fmtKeur(o.priceKeur, lang)})` : ''}` })),
    unit: s.capacityUnit,
  }));
  const lotChoices = lots.map((l) => ({ value: l.id, label: `${l.number}. ${dataText(l.title, lang)}` }));
  const offers = firmOffersFact(needs, answers, today);
  const sources = [...new Set(sync.map((s) => s.source))];
  const lastSync = sync.reduce<Date | null>((m, s) => (!m || s.syncedAt > m ? s.syncedAt : m), null);
  const sheetOf = (code: string | null, version: number | null) => sheets.find((s) => s.code === code && s.version === version);
  return (
    <>
      <PageHeader screen="capex-machines" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <KpiGrid>
        <KpiTile label={t('Machine needs')} value={String(needs.filter((n) => n.status !== 'withdrawn').length)} sub={`${needs.filter((n) => n.status === 'draft').length} ${t('draft(s)')}`} />
        <KpiTile label={t('Firm offers')} value={offers.value} sub={t('valid E10 offers / submitted needs')} tone={offers.met ? 'default' : 'alert'} />
        <KpiTile label={t('EPC2i projects')} value={String(projects.length)} />
        <KpiTile
          label={t('Keystone')}
          value={sources.length ? sources.map((s) => t(s === 'views' ? 'Shared views' : s === 'simulation' ? 'Simulation' : 'Off')).join(' + ') : t('Not synchronised')}
          sub={lastSync ? `${t('Synchronised')} ${fmtInstant(lastSync, lang)}` : undefined}
        />
      </KpiGrid>

      <SectionCard title={t('Machine needs')} hint={t('Submitted to EPC2i in phases 1 and 2; ordered at the G2 Go when a valid firm offer covers them')} scroll>
        {needs.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Machine')}</Th>
                <Th align="right">{t('Qty')}</Th>
                <Th>{t('Need date')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('Latest answer of EPC2i')}</Th>
                <Th align="right">{t('Amount')}</Th>
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {needs.map((n) => {
                const a = latestAnswer(answers, n.ref);
                const sheet = sheetOf(n.catalogueCode, n.catalogueVersion);
                const doc = a?.documentRef ? codexDocumentUrl(a.documentRef) : null;
                return (
                  <tr key={n.id}>
                    <Td nowrap>{n.ref}</Td>
                    <Td>
                      {n.catalogueCode ? `${n.catalogueCode} v${n.catalogueVersion}${sheet ? ` — ${dataText(sheet.label, lang)}` : ''}` : dataText(n.freeLabel, lang)}
                      {n.options.length > 0 && <span className="text-muted">{` · ${n.options.map((o) => dataText(sheet?.options.find((x) => x.code === o)?.label ?? o, lang)).join(', ')}`}</span>}
                      {n.targetCapacity != null && <span className="text-muted">{` · ${fmtNum(n.targetCapacity, lang)} ${n.capacityUnit ?? ''}`}</span>}
                    </Td>
                    <Td align="right">{n.quantity}</Td>
                    <Td nowrap>{fmtDate(n.needDate, lang)}</Td>
                    <Td nowrap>
                      <Tag tone={STATUS_TONE[n.status]} size="sm">{t(NEED_STATUS_LABEL[n.status])}</Tag>
                      {n.orderedOn && <span className="text-muted">{` ${fmtDate(n.orderedOn, lang)}`}</span>}
                    </Td>
                    <Td>
                      {a ? (
                        <>
                          {t(ANSWER_NATURE_LABEL[a.nature])}
                          {a.estimateClass && ` ${a.estimateClass}`}
                          {a.qualification && ` · ${t(QUALIFICATION_LABEL[a.qualification] ?? a.qualification)}`}
                          {a.status === 'acceptee' && <span className="text-muted">{` · ${t('accepted')}`}</span>}
                          {a.validUntil && a.status !== 'acceptee' && <span className="text-muted">{` · ${t('valid until')} ${fmtDate(a.validUntil, lang)}`}</span>}
                          {n.status === 'submitted' && a.nature === 'offre_ferme' && !isValidFirmOffer(a, today) && <> <Tag tone="accent" size="xs">{t('Expired')}</Tag></>}
                          {a.reason && <div className="text-muted">{dataText(a.reason, lang)}</div>}
                          {a.documentRef && <div>{doc ? <a href={doc} target="_blank" rel="noreferrer">{a.documentRef}</a> : a.documentRef}</div>}
                        </>
                      ) : n.status === 'draft' ? '—' : <span className="text-muted">{t('Waiting for EPC2i')}</span>}
                    </Td>
                    <Td align="right" nowrap>{a?.centralKeur != null ? fmtKeur(a.centralKeur, lang) : '—'}</Td>
                    {edit && (
                      <Td align="right">
                        {n.status === 'draft' && (
                          <>
                            <SubmitNeedButton code={c.code} needId={n.id} /> <DeleteNeedButton code={c.code} needId={n.id} />
                            <NeedForm
                              code={c.code} sheets={choices} lots={lotChoices}
                              draft={{
                                id: n.id, catalogue: n.catalogueCode ? `${n.catalogueCode}@${n.catalogueVersion}` : '', freeLabel: n.freeLabel ?? '', quantity: n.quantity, options: n.options,
                                targetCapacity: n.targetCapacity != null ? String(n.targetCapacity) : '', capacityUnit: n.capacityUnit ?? '', needDate: n.needDate ?? '', lotId: n.lotId ?? '', comment: n.comment ?? '',
                              }}
                            />
                          </>
                        )}
                        {n.status === 'submitted' && <WithdrawNeedForm code={c.code} needId={n.id} />}
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No machine need yet.')}</EmptyState>
        )}
        {edit && <NeedForm code={c.code} sheets={choices} lots={lotChoices} />}
        {!edit && can('needs') && <span className="text-muted">{t('Machine needs are entered and submitted in phases 1 and 2.')}</span>}
      </SectionCard>

      {projects.map((p) => {
        const href = keystoneProjectUrl(p.code);
        return (
          <SectionCard
            key={p.code}
            title={`${t('EPC2i project')} ${p.code} — ${dataText(p.name, lang)}`}
            hint={[p.phase ? dataText(p.phase, lang) : null, p.leadName, p.needRef].filter(Boolean).join(' · ')}
            actions={href ? <a href={href} target="_blank" rel="noreferrer">{t('Open in Keystone')}</a> : undefined}
            scroll
          >
            {p.progress && (
              <KpiGrid>
                <KpiTile label={t('Physical progress')} value={p.progress.physicalPct != null ? `${fmtNum(p.progress.physicalPct, lang)} %` : '—'} sub={p.progress.spi != null ? `SPI ${fmtRatio(p.progress.spi, lang)}` : undefined} />
                <KpiTile label={t('Contract')} value={p.progress.contractKeur != null ? fmtKeur(p.progress.contractKeur, lang) : '—'} sub={p.progress.amendmentsKeur ? `+ ${fmtKeur(p.progress.amendmentsKeur, lang)} ${t('amendments')}` : undefined} />
                <KpiTile label={t('Invoiced')} value={p.progress.invoicedKeur != null ? fmtKeur(p.progress.invoicedKeur, lang) : '—'} />
                <KpiTile label={t('Planned end')} value={fmtDate(p.progress.endOn, lang)} sub={p.progress.on ? `${t('Situation of')} ${fmtDate(p.progress.on, lang)}` : undefined} />
              </KpiGrid>
            )}
            {p.milestones.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Milestone')}</Th>
                    <Th>{t('Baseline')}</Th>
                    <Th>{t('Planned')}</Th>
                    <Th>{t('Actual')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.milestones.map((m) => (
                    <tr key={m.code}>
                      <Td>{t(MILESTONE_LABEL[m.code] ?? m.code)}</Td>
                      <Td tone="secondary">{fmtDate(m.baselineOn, lang)}</Td>
                      <Td>{m.plannedOn && m.baselineOn && m.plannedOn > m.baselineOn ? <Tag tone="accent" size="sm">{fmtDate(m.plannedOn, lang)}</Tag> : fmtDate(m.plannedOn, lang)}</Td>
                      <Td>{fmtDate(m.actualOn, lang)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {p.amendments.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Amendment')}</Th>
                    <Th>{t('Subject')}</Th>
                    <Th align="right">{t('Amount')}</Th>
                    <Th align="right">{t('Delay (days)')}</Th>
                    <Th>{t('Status')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.amendments.map((a) => (
                    <tr key={a.number}>
                      <Td nowrap>{a.number}</Td>
                      <Td>{dataText(a.subject, lang) ?? '—'}</Td>
                      <Td align="right">{a.amountKeur != null ? fmtKeur(a.amountKeur, lang) : '—'}</Td>
                      <Td align="right">{a.delayDays ?? '—'}</Td>
                      <Td>{`${t(AMENDMENT_STATUS[a.status] ?? a.status)}${a.signedOn ? ` ${fmtDate(a.signedOn, lang)}` : ''}`}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {(p.reserves.length > 0 || p.deliverables.length > 0) && (
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Reservation or deliverable')}</Th>
                    <Th>{t('Kind')}</Th>
                    <Th>{t('Status')}</Th>
                    <Th>{t('Date')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {p.reserves.map((r) => (
                    <tr key={r.number}>
                      <Td nowrap>{r.number}</Td>
                      <Td>{`${t('Reservation')} ${r.category}${r.origin ? ` · ${r.origin.toUpperCase()}` : ''}`}</Td>
                      <Td>{r.status !== 'closed' && (r.category === 'A' || r.category === 'B') ? <Tag tone="accent" size="sm">{t(RESERVE_STATUS[r.status] ?? r.status)}</Tag> : t(RESERVE_STATUS[r.status] ?? r.status)}</Td>
                      <Td>{fmtDate(r.clearedOn ?? r.openedOn, lang)}</Td>
                    </tr>
                  ))}
                  {p.deliverables.map((d) => (
                    <tr key={d.number}>
                      <Td nowrap>{d.number}</Td>
                      <Td>{dataText(d.title, lang)}</Td>
                      <Td>{t(DELIVERABLE_STATUS[d.status] ?? d.status)}</Td>
                      <Td>{fmtDate(d.acceptedOn, lang)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>
        );
      })}
    </>
  );
}
