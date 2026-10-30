// Governance of a CAPEX (docs/spec/06 §1–2): the named team against the staffing template of its typology, the typology
// (computed from the latest validated budget and the reference revenue, forced or confirmed by the group industrial director)
// the project reviews (cadence by typology, next one due, Strategic audits by phase — delivery 5), the Copil report and the
// decisions register and the lessons learned of the CAPEX (delivery 6, published to the library and pub_rex).
import { EmptyState } from '@/components/app/EmptyState';
import { KeyValueList } from '@/components/app/KeyValueList';
import { SectionCard } from '@/components/app/SectionCard';
import { ActionLink } from '@/components/app/ActionForm';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { missingStaff, STAFFING } from '@/domain/budget';
import { DECISION_BODY_LABEL, refOf, TEAM_ROLE_LABEL, type DecisionBody } from '@/domain/capex';
import { PHASE_LABEL, TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { CADENCE_LABEL, missingAudits, nextReview, REVIEW_KIND_LABEL, type ReviewKind } from '@/domain/governance';
import { ReviewForm } from '@/features/governance/forms';
import { reviewsOf } from '@/server/dal/governance';
import { rexOf } from '@/server/dal/rampup';
import { REX_CATEGORY_LABEL, rexFact, type RexCategory } from '@/domain/closure';
import { PublishRexButton, RexForm } from '@/features/startup/forms';
import { ConfirmTypologyButton, DecisionForm, ForceTypologyForm, MemberForm, RemoveMemberButton } from '@/features/capex/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { computedTypologyOf, decisionsOf, teamCandidates, teamOf } from '@/server/dal/cycle';
import { capexDashboard } from '@/server/dal/governance';
import { prioritiesOf, scoresOf } from '@/server/dal/priority';
import { SCORERS } from '@/domain/scoring';
import { ScoreForm } from '@/features/portfolio/forms';
import { fmtNum } from '@/lib/format';

export default async function GovernancePage({ params }: PageProps<'/capex/[code]/governance'>) {
  const { t, lang, db, c, can, viewer } = await loadCapexPage(params);
  const today = await businessToday();
  const [team, decisions, computed, candidates] = await Promise.all([teamOf(db, c.id), decisionsOf(db, c.id), computedTypologyOf(db, c, today), teamCandidates(db, c.subsidiaryCode)]);
  const edit = can('edit');
  const [revs, rex] = await Promise.all([reviewsOf(db, c.id), rexOf(db, c.id)]);
  const rexCover = rexFact(rex);
  // Priority score on the group's grid (AR-044): computed criteria, the group's scores of the others.
  const dash = await capexDashboard(db, c, today);
  const [prio, given] = await Promise.all([prioritiesOf(db, [{ id: c.id, bacKeur: dash.indicators.bacKeur }]).then((m) => m.get(c.id)!), scoresOf(db, c.id)]);
  const scorer = (SCORERS as readonly string[]).includes(viewer.role) && c.status !== 'closed' && c.status !== 'abandoned';
  const review = nextReview({ status: c.status, typology: c.typology, openedOn: c.openedAt ? c.openedAt.toISOString().slice(0, 10) : null, lastHeldOn: revs.find((r) => r.kind === 'copil_projet')?.heldOn ?? null }, today);
  const audits = missingAudits(c, revs.filter((r) => r.kind === 'audit'));
  const reviewKinds: ReviewKind[] = c.status === 'active' ? [...(edit ? ['copil_projet' as const] : []), ...(can('audit') && c.typology === 'strategic' ? ['audit' as const] : [])] : [];
  const template = STAFFING[c.typology ?? 'light'];
  const missing = missingStaff(c.typology, team.map((m) => m.capexRole));
  return (
    <>
      <PageHeader
        screen="capex-governance"
        title={dataText(c.title, lang)}
        crumbs={['CAPEX register']}
        crumbData={c.code}
        actions={
          <>
            {reviewKinds.length > 0 && <ReviewForm code={c.code} kinds={reviewKinds} today={today} />}
            {edit && <DecisionForm code={c.code} today={today} />}
            {edit && <MemberForm code={c.code} candidates={candidates.map((p) => ({ value: p.id, label: p.name }))} />}
            {can('rex') && <RexForm code={c.code} phase={c.phase} />}
            {c.typologyProposed && can('confirm_typology') && <ConfirmTypologyButton code={c.code} />}
            {can('force_typology') && <ForceTypologyForm code={c.code} />}
            <ActionLink href={`/print/capex/${encodeURIComponent(c.code)}/report`} newTab icon="print" label={t('Copil report')} />
            <ActionLink href={`/print/capex/${encodeURIComponent(c.code)}/report/pdf`} download icon="download" label={t('Copil report (PDF)')} />
          </>
        }
      />
      <SectionCard
        title={t('Team')}
        hint={`${t('Staffing template')} (${c.typology ? t(labelOf(TYPOLOGY_LABEL, c.typology)) : t('Light')})${lang === 'fr' ? ' : ' : ': '}${template.map((r) => t(TEAM_ROLE_LABEL[r])).join(', ')}`}
        scroll
      >
        {missing.length > 0 && (
          <span>
            <Tag tone="accent" size="sm">{t('Team incomplete')}</Tag> <span className="text-muted">{missing.map((r) => t(TEAM_ROLE_LABEL[r])).join(', ')}</span>
          </span>
        )}
        {team.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Name')}</Th>
                <Th>{t('Role in the team')}</Th>
                <Th>{t('Job title')}</Th>
                <Th>{t('Subsidiary')}</Th>
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <Td>{m.name}</Td>
                  <Td>{t(TEAM_ROLE_LABEL[m.capexRole])}</Td>
                  <Td tone="secondary">{dataText(m.jobTitle, lang) ?? '—'}</Td>
                  <Td tone="secondary">{m.subsidiaryCode ?? t('Group')}</Td>
                  {edit && <Td align="right"><RemoveMemberButton code={c.code} memberId={m.id} /></Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('Nobody is named yet.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Typology')}>
        <KeyValueList
          items={[
            { k: t('Current typology'), v: c.typology ? `${t(labelOf(TYPOLOGY_LABEL, c.typology))}${c.typologySource === 'forced' ? ` (${t('forced')})` : ''}` : t('To be determined') },
            ...(c.typologySource === 'forced' && c.typologyReason ? [{ k: t('Reason for forcing'), v: c.typologyReason }] : []),
            { k: t('Computed typology'), v: computed.typology ? t(labelOf(TYPOLOGY_LABEL, computed.typology)) : t('To be determined') },
            { k: t('Basis'), v: t(computed.basis) },
            { k: t('Ratio budget / reference revenue'), v: computed.ratioPct != null ? `${computed.ratioPct.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} %` : '—' },
            { k: t('Reference revenue'), v: computed.revenueKeur != null ? `${fmtKeur(computed.revenueKeur, lang)} (${computed.revenueYear})` : t('Not entered') },
          ]}
        />
        {c.typologyProposed && (
          <span>
            <Tag tone="accent" size="sm">{t('New typology to confirm')}</Tag> {t(labelOf(TYPOLOGY_LABEL, c.typologyProposed))}
          </span>
        )}
      </SectionCard>

      <SectionCard
        title={t('Reviews')}
        hint={c.typology === 'light' || c.typology === 'strategic' ? `${t('Project steering committee')} · ${t(CADENCE_LABEL[c.typology])}` : t('Cadence set by the typology')}
        scroll
      >
        <KeyValueList
          items={[
            { k: t('Next project review'), v: review.dueOn ? `${fmtDate(review.dueOn, lang)}${review.state === 'ok' ? '' : ` · ${review.daysLate} ${t('day(s) late')}`}` : '—' },
            ...(c.typology === 'strategic' ? [{ k: t('Phase audits missing'), v: audits.length ? audits.map((ph) => t(labelOf(PHASE_LABEL, ph))).join(' · ') : t('None') }] : []),
          ]}
        />
        {review.state === 'escalated' && <Tag tone="accent" size="sm">{t('Flagged to the group industrial director')}</Tag>}
        {revs.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Held on')}</Th>
                <Th>{t('Kind')}</Th>
                <Th>{t('Phase')}</Th>
                <Th>{t('Attendees')}</Th>
                <Th>{t('Summary')}</Th>
                <Th>{t('Recorded by')}</Th>
              </tr>
            </thead>
            <tbody>
              {revs.map((r) => (
                <tr key={r.id}>
                  <Td nowrap>{refOf('REV', r.number)}</Td>
                  <Td nowrap>{fmtDate(r.heldOn, lang)}</Td>
                  <Td>{t(REVIEW_KIND_LABEL[r.kind])}</Td>
                  <Td tone="secondary">{t(labelOf(PHASE_LABEL, r.phase))}</Td>
                  <Td tone="secondary">{dataText(r.attendees, lang)}</Td>
                  <Td>{dataText(r.summary, lang)}</Td>
                  <Td tone="secondary">{r.recordedByName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No review recorded.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard
        title={t('Priority score')}
        hint={`${prio.score == null ? t('Not ranked: less than 80 % of the weight scored') : `${fmtNum(prio.score, lang)} / 100`} · ${t('Coverage')} ${prio.coveragePct} %`}
        actions={scorer ? <ScoreForm code={c.code} values={Object.fromEntries(given.map((g) => [g.criterionCode, { score: g.score, note: g.note }]))} /> : undefined}
        scroll
      >
        <Table>
          <thead><tr><Th>{t('Criterion')}</Th><Th align="right">{t('Weight')}</Th><Th align="right">{t('Score')}</Th><Th>{t('Why')}</Th><Th>{t('By')}</Th></tr></thead>
          <tbody>
            {prio.criteria.map((x) => {
              const g = given.find((s) => s.criterionCode === x.code);
              return (
                <tr key={x.code}>
                  <Td>{t(x.label)} <Tag tone="outline" size="xs">{t(x.kind === 'computed' ? 'Computed' : 'Scored by the group')}</Tag></Td>
                  <Td align="right" numeric>{x.weight}</Td>
                  <Td align="right" numeric>{x.score == null ? '—' : `${fmtNum(x.score, lang)}/5`}</Td>
                  <Td tone="secondary">{x.kind === 'manual' ? dataText(x.note, lang) ?? '' : ''}</Td>
                  <Td tone="secondary">{g ? `${g.scoredByName} · ${fmtDate(g.scoredAt, lang)}` : ''}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </SectionCard>

      <SectionCard title={t('Lessons learned')} hint={`${t('Phases covered')} ${rexCover.value} · ${t('G3 needs a lesson for every phase')}`} scroll>
        {rex.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Phase')}</Th>
                <Th>{t('Category')}</Th>
                <Th>{t('Lesson')}</Th>
                <Th>{t('Author')}</Th>
                <Th>{t('Published')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rex.map((r) => (
                <tr key={r.id}>
                  <Td nowrap>{refOf('REX', r.number)}</Td>
                  <Td tone="secondary">{t(labelOf(PHASE_LABEL, r.phase))}</Td>
                  <Td tone="secondary">{t(REX_CATEGORY_LABEL[r.category as RexCategory] ?? r.category)}</Td>
                  <Td>
                    <strong>{dataText(r.title, lang)}</strong>
                    <div className="text-muted">{dataText(r.text, lang)}</div>
                    {r.recommendation && <div>{`${t('Recommendation')} — `}{dataText(r.recommendation, lang)}</div>}
                  </Td>
                  <Td tone="secondary">{r.authorName}</Td>
                  <Td nowrap>{r.publishedAt ? fmtDate(r.publishedAt, lang) : '—'}</Td>
                  <Td align="right" nowrap>
                    {!r.publishedAt && can('rex') && <RexForm code={c.code} phase={c.phase} rex={{ id: r.id, phase: r.phase, category: r.category as RexCategory, title: r.title, text: r.text, recommendation: r.recommendation }} />}{' '}
                    {!r.publishedAt && edit && <PublishRexButton code={c.code} rexId={r.id} />}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No lesson recorded.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Decisions')} hint={t(`${decisions.length} decisions`)} scroll>
        {decisions.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Date')}</Th>
                <Th>{t('Decided by')}</Th>
                <Th>{t('Decision')}</Th>
                <Th>{t('Recorded by')}</Th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id}>
                  <Td nowrap>{refOf('D', d.number)}</Td>
                  <Td nowrap>{fmtDate(d.takenOn, lang)}</Td>
                  <Td tone="secondary">{t(labelOf(DECISION_BODY_LABEL, d.body as DecisionBody))}</Td>
                  <Td>{dataText(d.text, lang)}</Td>
                  <Td tone="secondary">{d.recordedByName}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No decision recorded.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
