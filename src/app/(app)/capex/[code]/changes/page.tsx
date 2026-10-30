// Management of change (docs/spec/05 §5): the register of the changes after G2, the decider each one goes to under the
// delegation matrix in force, and the decision of that level.
import { EmptyState } from '@/components/app/EmptyState';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { holdsOn, refOf } from '@/domain/capex';
import { CHANGE_KIND_LABEL, DECIDER_ROLE_OF, LEVEL_LABEL, type ChangeKind, type DeciderLevel } from '@/domain/delegation';
import { loadCapexPage } from '@/features/capex/page-data';
import { DecideChangeForm, NewChangeForm } from '@/features/changes/forms';
import { dataText } from '@/i18n/data-text';
import { fmtDate, fmtKeur } from '@/lib/format';
import { changesOf } from '@/server/dal/dossiers';

const STATUS: Record<string, string> = { submitted: 'To decide', approved: 'Approved', rejected: 'Rejected' };

export default async function ChangesPage({ params }: PageProps<'/capex/[code]/changes'>) {
  const { t, lang, viewer, db, c, can } = await loadCapexPage(params);
  const rows = await changesOf(db, c.id);
  const afterG2 = c.status === 'active' && (c.phase === 'execution' || c.phase === 'demarrage');
  const decides = (level: DeciderLevel) => c.status === 'active' && viewer.role === DECIDER_ROLE_OF[level] && holdsOn(viewer.assignments, DECIDER_ROLE_OF[level], c);
  return (
    <>
      <PageHeader screen="capex-changes" title={dataText(c.title, lang)} crumbs={['CAPEX register']} crumbData={c.code} actions={afterG2 && can('edit') && <NewChangeForm code={c.code} />} />
      <SectionCard title={t('Changes')} hint={t('Routed by the delegation matrix in force when submitted')} scroll>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Ref.')}</Th>
                <Th>{t('Change')}</Th>
                <Th>{t('Kind')}</Th>
                <Th align="right">{t('Cost')}</Th>
                <Th align="right">{t('Delay')}</Th>
                <Th>{t('Decided by')}</Th>
                <Th>{t('Status')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td nowrap>{refOf('MOC', r.number)}</Td>
                  <Td>
                    <div>{dataText(r.title, lang)}</div>
                    {r.description && <div className="text-muted">{dataText(r.description, lang)}</div>}
                  </Td>
                  <Td tone="secondary">{t(CHANGE_KIND_LABEL[r.kind as ChangeKind])}</Td>
                  <Td align="right" numeric nowrap>{r.amountKeur ? fmtKeur(r.amountKeur, lang) : '—'}</Td>
                  <Td align="right" numeric nowrap>{r.delayDays ? `${r.delayDays} ${t('days')}` : '—'}</Td>
                  <Td>{t(LEVEL_LABEL[r.requiredDecider as DeciderLevel])}</Td>
                  <Td>
                    {r.status === 'submitted' && decides(r.requiredDecider as DeciderLevel) ? (
                      <DecideChangeForm code={c.code} changeId={r.id} />
                    ) : (
                      <>
                        {t(STATUS[r.status])}
                        {r.decidedByName && <span className="text-muted">{` — ${r.decidedByName} · ${fmtDate(r.decidedAt, lang)}${r.decisionReason ? ` · ${r.decisionReason}` : ''}`}</span>}
                      </>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{afterG2 ? t('No change recorded.') : t('Changes are recorded after G2.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
