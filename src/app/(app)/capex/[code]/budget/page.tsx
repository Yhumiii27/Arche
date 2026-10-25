// Budget & business plan (docs/spec/08; delivery 2: lots and budget versions — the precision funnel E50 → E30 → E10, spec 03
// §5). Commitments, actuals and the business plan come with deliveries 3 and 5.
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { holdsOn, LOT_KIND_LABEL, type LotKind } from '@/domain/capex';
import { canMoveVersion, rangeOf, validatorsOf } from '@/domain/budget';
import { labelOf } from '@/domain/capex-labels';
import { BusinessPlanForm, LotForm, RemoveLotButton, ValidateBusinessPlanButton, VersionActions, VersionForm } from '@/features/capex/forms';
import { loadCapexPage } from '@/features/capex/page-data';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur, fmtNum } from '@/lib/format';
import { lotsOf, versionsOf } from '@/server/dal/cycle';
import { businessPlanOf } from '@/server/dal/dossiers';
import { BP_HORIZON } from '@/domain/bp';
import { KeyValueList } from '@/components/app/KeyValueList';

const VERSION_STATUS: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', validated: 'Validated', superseded: 'Superseded' };

export default async function BudgetPage({ params }: PageProps<'/capex/[code]/budget'>) {
  const { t, lang, viewer, db, c, can } = await loadCapexPage(params);
  const [lots, versions, bp] = await Promise.all([lotsOf(db, c.id), versionsOf(db, c.id), businessPlanOf(db, c.id)]);
  const cfo = viewer.role === 'group_cfo' && holdsOn(viewer.assignments, 'group_cfo', c) && (c.status === 'active' || c.status === 'draft');
  const edit = can('edit');
  const budget = can('budget');
  const open = c.status === 'draft' || c.status === 'active';
  const mayValidate = (cls: 'E50' | 'E30' | 'E10') => open && validatorsOf(cls).some((r) => viewer.role === r && holdsOn(viewer.assignments, r, c));
  const inProgress = versions.some((v) => v.status === 'draft' || v.status === 'submitted');
  const shown = versions.slice(0, 4);
  const used = new Set(versions.flatMap((v) => Object.keys(v.lines)));
  return (
    <>
      <PageHeader
        screen="capex-budget"
        title={dataText(c.title, lang)}
        crumbs={['CAPEX register']}
        crumbData={c.code}
        actions={
          <>
            {budget && lots.length > 0 && !inProgress && <VersionForm code={c.code} lots={lots} />}
            {budget && lots.length > 0 && versions.filter((v) => v.status === 'draft').map((v) => <VersionForm key={v.id} code={c.code} lots={lots} version={v} />)}
            {edit && <LotForm code={c.code} />}
            {budget && <BusinessPlanForm code={c.code} horizon={BP_HORIZON} rate={bp?.discountRatePct ?? null} flows={bp?.flows ?? []} />}
            {bp && !bp.validatedAt && cfo && <ValidateBusinessPlanButton code={c.code} />}
          </>
        }
      />
      <SectionCard title={t('Lots')} hint={t(`${lots.length} lots`)} scroll>
        {lots.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('No.')}</Th>
                <Th>{t('Lot')}</Th>
                <Th>{t('Kind')}</Th>
                {shown.map((v) => (
                  <Th key={v.id} align="right">{`V${v.number} · ${v.estimateClass}`}</Th>
                ))}
                {edit && <Th />}
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <Td>{l.number}</Td>
                  <Td>
                    {dataText(l.title, lang)} {l.epc2i && <Tag size="xs">EPC2i</Tag>}
                  </Td>
                  <Td tone="secondary">{t(labelOf(LOT_KIND_LABEL, l.kind as LotKind))}</Td>
                  {shown.map((v) => (
                    <Td key={v.id} align="right" numeric>{fmtKeur(v.lines[l.id] ?? 0, lang)}</Td>
                  ))}
                  {edit && <Td align="right">{!used.has(l.id) && <RemoveLotButton code={c.code} lotId={l.id} />}</Td>}
                </tr>
              ))}
              <tr>
                <Td />
                <Td><strong>{t('Total (central)')}</strong></Td>
                <Td />
                {shown.map((v) => (
                  <Td key={v.id} align="right" numeric><strong>{fmtKeur(v.centralKeur, lang)}</strong></Td>
                ))}
                {edit && <Td />}
              </tr>
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No lot yet.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Budget versions')} hint={t('E50 at G1 · E30 mid preliminary design · E10 at G2 (validated by the group CFO)')} scroll>
        {versions.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Version')}</Th>
                <Th>{t('Class')}</Th>
                <Th align="right">{t('Central')}</Th>
                <Th align="right">{t('Range')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('Basis of the estimate')}</Th>
                <Th>{t('Validated by')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const r = rangeOf(v.centralKeur, v.estimateClass);
                return (
                  <tr key={v.id}>
                    <Td nowrap>
                      V{v.number} {v.isG2Baseline && <Tag tone="accent" size="xs">{t('G2 baseline')}</Tag>}
                    </Td>
                    <Td>{v.estimateClass}</Td>
                    <Td align="right" numeric>{fmtKeur(v.centralKeur, lang)}</Td>
                    <Td align="right" numeric nowrap>{`${fmtKeur(r.low, lang)} – ${fmtKeur(r.high, lang)}`}</Td>
                    <Td>{t(VERSION_STATUS[v.status])}</Td>
                    <Td tone="secondary">{dataText(v.basis, lang) ?? '—'}</Td>
                    <Td tone="secondary" nowrap>{v.validatedByName ? `${v.validatedByName} · ${fmtDate(v.validatedAt, lang)}` : '—'}</Td>
                    <Td nowrap>
                      <VersionActions
                        code={c.code}
                        id={v.id}
                        submit={budget && canMoveVersion(v.status, 'submitted')}
                        remove={budget && v.status === 'draft'}
                        review={v.status === 'submitted' && mayValidate(v.estimateClass)}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No budget version yet.')}</EmptyState>
        )}
      </SectionCard>

      <SectionCard title={t('Business plan')} hint={t('Prepared by the controller, validated by the group CFO')}>
        {bp ? (
          <KeyValueList
            items={[
              { id: 'r', k: t('Discount rate'), v: `${fmtNum(bp.discountRatePct, lang)} %` },
              { id: 'n', k: t('NPV'), v: fmtKeur(bp.npvKeur, lang) },
              { id: 'i', k: t('IRR'), v: bp.irrPct != null ? `${fmtNum(bp.irrPct, lang)} %` : '—' },
              { id: 'p', k: t('Payback (years)'), v: fmtNum(bp.paybackYears, lang) },
              { id: 'v', k: t('Validated by the group CFO'), v: bp.validatedByName ? `${bp.validatedByName} · ${fmtDate(bp.validatedAt, lang)}` : t('No') },
            ]}
          />
        ) : (
          <EmptyState>{t('No business plan yet')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
