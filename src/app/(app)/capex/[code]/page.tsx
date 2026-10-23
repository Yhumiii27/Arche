// CAPEX overview (docs/spec/08): identity sheet, the DIG-PRODI cycle — phases, the gate the CAPEX faces with its criteria
// evaluated now (the circuit runs on the Gates page) —, the dashboard of the CAPEX (spec 06 §5: execution figures, uncertainty
// gap, pack, HS, changes, risks, next review, rule-based alerts) and the cycle history.
// A CAPEX outside the viewer's scope does not exist (404).
import Link from 'next/link';
import { KeyValueList } from '@/components/app/KeyValueList';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { rangeOf } from '@/domain/budget';
import { INVESTMENT_TYPE_LABEL, PHASE_LABEL, STATUS_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { DECISION_LABEL, GATE_LABEL, GATE_OF_PHASE, PHASES, currentGate, type CriterionState } from '@/domain/lifecycle';
import { ButtonLink } from '@/components/ds/Button';
import { ArrowRight, Flag } from '@phosphor-icons/react/dist/ssr';
import { CRITERION_ACTION, nextCriterion } from '@/features/capex/next-step';
import hs from '@/components/app/shell/header.module.css';
import { screenHref } from '@/config/screens';
import { OpenCapexButton, SheetForm, SuspendForm, TakeoverForm } from '@/features/capex/forms';
import { currentEvaluation } from '@/server/cycle/evaluation';
import { loadCapexPage } from '@/features/capex/page-data';
import { alertDetail } from '@/features/governance/alert-detail';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum, fmtRatio } from '@/lib/format';
import { HS_LABEL } from '@/domain/safety';
import { businessToday } from '@/server/clock';
import { capexDashboard } from '@/server/dal/governance';
import { gatesOf, latestValidated, lotsOf, transitionsOf, versionsOf } from '@/server/dal/cycle';
import { siteOptions } from '@/server/dal/capex';
import { TAKEOVER_REASON } from '@/domain/takeover';

const STATE_LABEL: Record<CriterionState, string> = { met: 'Met', unmet: 'Not met', forced: 'Forced', not_evaluated: 'Not evaluated yet' };
const STATE_TONE: Record<CriterionState, 'neutral' | 'accent' | 'outline'> = { met: 'neutral', unmet: 'accent', forced: 'outline', not_evaluated: 'outline' };

export default async function CapexOverviewPage({ params }: PageProps<'/capex/[code]'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const today = await businessToday(db);
  const [versions, history, gateRows, ev, sites, d, lots] = await Promise.all([
    versionsOf(db, c.id), transitionsOf(db, c.id), gatesOf(db, c.id), currentEvaluation(db, c), siteOptions(c.subsidiaryCode), capexDashboard(db, c, today), lotsOf(db, c.id),
  ]);
  const validated = latestValidated(versions);
  const gate = currentGate(c);
  const phaseNo = PHASES.indexOf(c.phase) + 1;
  const next = ev ? nextCriterion(ev.results) : null;
  const r0Value = next?.value ? `${t('now')} ${t(next.value)}` : t('not met');
  return (
    <>
      <PageHeader
        screen="capex-overview"
        title={dataText(c.title, lang)}
        crumbs={['CAPEX register']}
        crumbData={c.code}
        primary={
          <div className={hs.actions}>
            {can('edit') && <SheetForm code={c.code} sheet={c} sites={sites} />}
            {can('suspend') && <SuspendForm code={c.code} outcome={c.status === 'on_hold' ? 'resume' : 'suspend'} />}
            {can('open') && <TakeoverForm code={c.code} today={today} lots={lots.map((l) => ({ id: l.id, label: `${l.number}. ${dataText(l.title, lang)}` }))} />}
            {can('open') && <OpenCapexButton code={c.code} />}
            {gate && can('edit') && (
              <ButtonLink href={screenHref('capex-gates', { code: c.code })} variant="primary" icon={Flag}>{t(`Submit to gate ${gate}`)}</ButtonLink>
            )}
          </div>
        }
      />
      {next && (
        <div className={hs.nextStep}>
          <ArrowRight size={18} className={hs.accentIcon} />
          <span className={hs.nextText}>
            <strong>{t('Next step:')}</strong> {`${t(next.label)} — ${r0Value}`}
          </span>
          <ButtonLink href={screenHref(CRITERION_ACTION[next.code].screen, { code: c.code })} variant="primary" size="sm">{t(CRITERION_ACTION[next.code].label)}</ButtonLink>
        </div>
      )}
      {ev && !next && gate && ev.results.every((r) => !r.blocking || r.state !== 'unmet') && (
        <div className={hs.nextStep}>
          <ArrowRight size={18} className={hs.accentIcon} />
          <span className={hs.nextText}>{t(`Every blocking criterion of ${gate} is met or not evaluated yet: the gate can be submitted.`)}</span>
        </div>
      )}
      <KpiGrid>
        <KpiTile label={t('Status')} value={t(labelOf(STATUS_LABEL, c.status))} />
        <KpiTile label={t('Phase')} value={c.status === 'draft' ? '—' : `${phaseNo} / 4`} sub={t(labelOf(PHASE_LABEL, c.phase))} />
        <KpiTile label={t('Typology')} value={c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : t('To be determined')} sub={c.typologyProposed ? t('New typology to confirm') : c.typologySource === 'forced' ? t('Forced') : undefined} tone={c.typologyProposed ? 'alert' : 'default'} />
        <KpiTile
          label={t('Validated budget')}
          value={validated ? fmtKeur(validated.centralKeur, lang) : '—'}
          sub={validated ? `${validated.estimateClass} · ${fmtKeur(rangeOf(validated.centralKeur, validated.estimateClass).low, lang)} – ${fmtKeur(rangeOf(validated.centralKeur, validated.estimateClass).high, lang)}` : t('No validated version')}
        />
      </KpiGrid>
      {c.status !== 'draft' && (
        <KpiGrid>
          <KpiTile label={t('Earned value')} value={fmtKeur(d.indicators.evKeur, lang)} sub={`${t('Actual cost')} ${fmtKeur(d.indicators.acKeur, lang)}`} />
          <KpiTile label="SPI / CPI" value={`${fmtRatio(d.indicators.spi, lang)} / ${fmtRatio(d.indicators.cpi, lang)}`} tone={(d.indicators.spi ?? 1) < 0.9 || (d.indicators.cpi ?? 1) < 0.9 ? 'alert' : 'default'} sub={`${t('EAC')} ${fmtKeur(d.indicators.eacKeur, lang)}`} />
          <KpiTile
            label={t('Uncertainty gap')}
            value={!d.gap ? '—' : d.gap.kind === 'range' ? `${d.gap.gapPts} pts` : `${d.gap.deviationPct > 0 ? '+' : ''}${fmtNum(d.gap.deviationPct, lang)} %`}
            sub={!d.gap ? undefined : d.gap.kind === 'range' ? `${d.gap.widthPct} % → ${d.gap.targetClass} ${d.gap.targetWidthPct} %` : t(d.gap.within ? 'EAC within the E10 range' : 'EAC outside the E10 range')}
          />
          <KpiTile label={t('Weighted pack')} value={d.pack.pct == null ? '—' : `${fmtNum(d.pack.pct, lang)} %`} sub={`${t('EPC2i part')} ${d.pack.epc2i.pct == null ? '—' : `${fmtNum(d.pack.epc2i.pct, lang)} %`}`} />
          <KpiTile label={t('Safety milestones')} value={`${d.hs.passed} / ${d.hs.total}`} sub={d.hs.next ? `${t('next')} ${t(HS_LABEL[d.hs.next.code])}` : undefined} />
          <KpiTile label={t('Changes waiting')} value={d.openChanges} sub={`${d.majorRisks} ${t('major risk(s)')}`} />
          <KpiTile label={t('Next project review')} value={d.review.dueOn ? fmtDate(d.review.dueOn, lang) : '—'} tone={d.review.state === 'late' || d.review.state === 'escalated' ? 'alert' : 'default'} sub={d.review.state === 'ok' || d.review.state === 'none' ? undefined : `${d.review.daysLate} ${t('day(s) late')}`} />
        </KpiGrid>
      )}
      {d.alerts.length > 0 && (
        <SectionCard title={t('Alerts')} hint={t('Rule-based alerts, always on')}>
          <Table>
            <tbody>
              {d.alerts.map((a, n) => (
                <tr key={n}>
                  <Td nowrap><Tag tone={a.level === 'alert' ? 'accent' : 'outline'} size="xs">{t(a.level === 'alert' ? 'Alert' : 'To watch')}</Tag></Td>
                  <Td><Link href={screenHref(a.screen, { code: c.code })}>{t(a.text)}</Link></Td>
                  <Td tone="secondary">{alertDetail(a.detail, t, lang)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      )}

      <SectionCard title={t('Identity')}>
        <KeyValueList
          items={[
            { k: t('Code'), v: c.code },
            { k: t('Subsidiary'), v: dataText(c.subsidiaryName, lang) },
            { k: t('Zone'), v: dataText(c.zoneName, lang) },
            { k: t('Site'), v: dataText(c.siteName, lang) ?? '—' },
            { k: t('Investment type'), v: t(labelOf(INVESTMENT_TYPE_LABEL, c.investmentType)) },
            { k: t('Need date'), v: fmtDate(c.needDate, lang) },
            { k: t('Project lead'), v: c.leadName ?? '—' },
            { k: t('DIG-PRODI model'), v: c.lifecycleModelVersion ? `v${c.lifecycleModelVersion}` : '—' },
            ...(c.description ? [{ k: t('Description'), v: c.description }] : []),
          ]}
        />
      </SectionCard>

      <SectionCard title={t('DIG-PRODI cycle')} hint={gate ? `${t(`Next gate: ${gate}`)} · ${t(GATE_LABEL[gate])}` : undefined}>
        <KeyValueList
          layout="inline"
          items={PHASES.map((p, i) => ({
            id: p,
            k: `${t('Phase')} ${i + 1} → ${GATE_OF_PHASE[p]}`,
            v: c.status === 'draft' || i + 1 > phaseNo ? t('To come') : i + 1 < phaseNo || c.status === 'closed' ? t('Passed') : t(labelOf(STATUS_LABEL, c.status)),
          }))}
        />
        {c.status === 'draft' && <span className="text-muted">{t('The CAPEX is a draft: the sponsor opens it once the project lead is named.')}</span>}
        {ev && (
          <Table>
            <thead>
              <tr>
                <Th>{`${t('Criteria')} ${ev.gate}`}</Th>
                <Th>{t('Blocking')}</Th>
                <Th>{t('State')}</Th>
                <Th>{t('Value')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {ev.results.map((r) => (
                <tr key={r.code}>
                  <Td>{t(r.label)}</Td>
                  <Td tone="secondary">{r.blocking ? (r.forcible ? t('Yes') : t('Yes, cannot be forced')) : t('Alert')}</Td>
                  <Td nowrap>
                    <Tag tone={STATE_TONE[r.state]} size="sm">{t(STATE_LABEL[r.state])}</Tag>
                    {r.state === 'not_evaluated' && <span className="text-muted"> {t(`delivery ${r.from.slice(1)}`)}</span>}
                  </Td>
                  <Td tone="secondary">{r.value ? t(r.value) : '—'}</Td>
                  <Td align="right" nowrap>
                    {r.state === 'unmet' && CRITERION_ACTION[r.code] && (
                      <Link href={screenHref(CRITERION_ACTION[r.code].screen, { code: c.code })}>{t(CRITERION_ACTION[r.code].label)}</Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {gate && (
          <div>
            <ButtonLink href={screenHref('capex-gates', { code: c.code })} variant="secondary" size="sm">{t('Open the gate circuit')}</ButtonLink>
          </div>
        )}
      </SectionCard>

      {(history.length > 0 || gateRows.length > 0) && (
        <SectionCard title={t('Cycle history')} scroll>
          <Table>
            <thead>
              <tr>
                <Th>{t('Date')}</Th>
                <Th>{t('Event')}</Th>
                <Th>{t('By')}</Th>
                <Th>{t('Reason')}</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <Td nowrap>{fmtDate(h.effectiveOn, lang)}</Td>
                  <Td>
                    {h.gateCode ? `${h.gateCode} · ` : ''}
                    {h.toStatus === 'active' ? t(labelOf(PHASE_LABEL, h.toPhase)) : t(labelOf(STATUS_LABEL, h.toStatus))}
                    {h.forced && <> <Tag tone="outline" size="xs">{t('Forced')}</Tag></>}
                  </Td>
                  <Td tone="secondary">{h.byName}</Td>
                  <Td tone="secondary">{h.reason === TAKEOVER_REASON ? t(TAKEOVER_REASON) : (h.reason ?? '—')}</Td>
                </tr>
              ))}
              {gateRows.filter((g) => g.decision === 'deferred').map((g) => (
                <tr key={g.id}>
                  <Td nowrap>{fmtDate(g.decidedAt, lang)}</Td>
                  <Td>{`${g.code} · ${t(DECISION_LABEL.deferred)} (${t('session')} ${g.session})`}</Td>
                  <Td tone="secondary">{g.decidedByName ?? '—'}</Td>
                  <Td tone="secondary">{g.decisionReason ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {gateRows.some((g) => g.conditions.length) && (
            <KeyValueList
              title={t('Conditions of the gates')}
              items={gateRows.flatMap((g) => g.conditions.map((x) => ({ id: x.id, k: `${g.code} · ${x.number}`, v: x.text })))}
            />
          )}
        </SectionCard>
      )}
    </>
  );
}
