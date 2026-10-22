// My approvals (docs/spec/05 §6): what waits on the viewer — circuit steps, budget versions to validate, typologies to
// confirm, changes to decide — late first.
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { APPROVAL_KIND_LABEL, inboxFigures } from '@/domain/approvals';
import { dataText } from '@/i18n/data-text';
import { fmtDate } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { approvalsOf } from '@/server/dal/approvals';
import { getI18n, getViewer } from '@/server/session';

export default async function ApprovalsPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const items = await approvalsOf(viewer);
  const f = inboxFigures(items, today);
  return (
    <>
      <PageHeader screen="approvals" />
      <KpiGrid>
        <KpiTile label={t('Waiting on me')} value={String(f.pending)} />
        <KpiTile label={t('Late')} value={String(f.late)} tone={f.late ? 'alert' : 'default'} />
        <KpiTile label={t('Oldest')} value={fmtDate(f.oldest, lang)} />
      </KpiGrid>
      <SectionCard title={t('To do')} scroll>
        {items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Kind')}</Th>
                <Th>{t('What')}</Th>
                <Th>{t('CAPEX')}</Th>
                <Th>{t('Since')}</Th>
                <Th>{t('Due date')}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={n}>
                  <Td tone="secondary">{t(APPROVAL_KIND_LABEL[i.kind])}</Td>
                  <Td>
                    <Link href={i.href}>{t(i.title)}</Link> <span className="text-muted">{i.detail}</span>
                  </Td>
                  <Td>
                    <div>{i.capexCode}</div>
                    <div className="text-muted">{dataText(i.subject, lang)}</div>
                  </Td>
                  <Td nowrap>{fmtDate(i.since, lang)}</Td>
                  <Td nowrap>{i.due && i.due < today ? <Tag tone="accent" size="sm">{fmtDate(i.due, lang)}</Tag> : fmtDate(i.due, lang)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('Nothing waits on you.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
