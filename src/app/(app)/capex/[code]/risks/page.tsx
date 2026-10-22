// Risks register of a CAPEX (docs/spec/08): probability × impact on a 1–4 scale, owner in the team, response.
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { isMajorRisk, refOf, riskScore, RISK_CATEGORY_LABEL, RISK_STATUS_LABEL, type RiskCategory, type RiskStatus } from '@/domain/capex';
import { labelOf } from '@/domain/capex-labels';
import { RiskForm } from '@/features/capex/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { risksOf, teamOf } from '@/server/dal/cycle';

export default async function RisksPage({ params }: PageProps<'/capex/[code]/risks'>) {
  const { t, lang, db, c, can } = await loadCapexPage(params);
  const [rows, team] = await Promise.all([risksOf(db, c.id), teamOf(db, c.id)]);
  const edit = can('edit');
  const people = [...new Map(team.map((m) => [m.userId, { value: m.userId, label: m.name }])).values()];
  const open = rows.filter((r) => r.status !== 'closed');
  return (
    <>
      <PageHeader screen="capex-risks" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} />
      <SectionCard title={t('Risks')} hint={`${open.length} ${t('open')} · ${open.filter((r) => isMajorRisk(r.probability, r.impact)).length} ${t('major')}`} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Risk')}</Th>
                <Th>{t('Category')}</Th>
                <Th align="right">{t('P × I')}</Th>
                <Th>{t('Owner')}</Th>
                <Th>{t('Response')}</Th>
                <Th>{t('Due date')}</Th>
                <Th>{t('Status')}</Th>
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td nowrap>{refOf('R', r.number)}</Td>
                  <Td>{dataText(r.title, lang)}</Td>
                  <Td tone="secondary">{t(labelOf(RISK_CATEGORY_LABEL, r.category as RiskCategory))}</Td>
                  <Td align="right" numeric nowrap>
                    {`${r.probability} × ${r.impact} = ${riskScore(r.probability, r.impact)}`} {isMajorRisk(r.probability, r.impact) && r.status !== 'closed' && <Tag tone="accent" size="xs">{t('Major')}</Tag>}
                  </Td>
                  <Td tone="secondary">{r.ownerName ?? '—'}</Td>
                  <Td tone="secondary">{dataText(r.response, lang) ?? '—'}</Td>
                  <Td nowrap>{fmtDate(r.dueOn, lang)}</Td>
                  <Td>{t(labelOf(RISK_STATUS_LABEL, r.status as RiskStatus))}</Td>
                  {edit && (
                    <Td>
                      <RiskForm code={c.code} people={people} risk={r} />
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No risk recorded.')}</EmptyState>
        )}
        {edit && <RiskForm code={c.code} people={people} />}
      </SectionCard>
    </>
  );
}
