// Governance of a CAPEX (docs/spec/06 §1–2): the named team against the staffing template of its typology, the typology
// (computed from the latest validated budget and the reference revenue, forced or confirmed by the group industrial director)
// and the decisions register. Reviews and the Copil report come with delivery 5.
import { EmptyState } from '@/components/app/EmptyState';
import { KeyValueList } from '@/components/app/KeyValueList';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { missingStaff, STAFFING } from '@/domain/budget';
import { DECISION_BODY_LABEL, refOf, TEAM_ROLE_LABEL, type DecisionBody } from '@/domain/capex';
import { TYPOLOGY_LABEL, labelOf } from '@/domain/capex-labels';
import { ConfirmTypologyButton, DecisionForm, ForceTypologyForm, MemberForm, RemoveMemberButton } from '@/features/capex/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { computedTypologyOf, decisionsOf, teamCandidates, teamOf } from '@/server/dal/cycle';

export default async function GovernancePage({ params }: PageProps<'/capex/[code]/governance'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const today = await businessToday();
  const [team, decisions, computed, candidates] = await Promise.all([teamOf(db, c.id), decisionsOf(db, c.id), computedTypologyOf(db, c, today), teamCandidates(db, c.subsidiaryCode)]);
  const edit = can('edit');
  const template = STAFFING[c.typology ?? 'light'];
  const missing = missingStaff(c.typology, team.map((m) => m.capexRole));
  return (
    <>
      <PageHeader screen="capex-governance" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
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
        {edit && <MemberForm code={c.code} candidates={candidates.map((p) => ({ value: p.id, label: p.name }))} />}
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
        {c.typologyProposed && can('confirm_typology') && <ConfirmTypologyButton code={c.code} />}
        {can('force_typology') && <ForceTypologyForm code={c.code} />}
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
        {edit && <DecisionForm code={c.code} today={today} />}
      </SectionCard>
    </>
  );
}
