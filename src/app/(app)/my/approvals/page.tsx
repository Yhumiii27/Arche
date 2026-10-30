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
import { desc, eq } from 'drizzle-orm';
import { absentOn, MAIL_STATUS_LABEL, NOTICE_LABEL, type NoticeKind } from '@/domain/notify';
import { AbsenceForm, EndAbsenceButton } from '@/features/absences/forms';
import { getDb } from '@/server/db/client';
import { emailOutbox } from '@/server/db/schema';
import { absencesOf } from '@/server/dal/absences';
import { activeAccounts } from '@/server/dal/users';
import { getI18n, getViewer } from '@/server/session';

export default async function ApprovalsPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const items = await approvalsOf(viewer);
  const f = inboxFigures(items, today);
  // Absences (AR-041): the viewer's, and those they cover as delegate; a delegate is an active person of the business.
  const db = await getDb();
  const [abs, people, mail] = await Promise.all([
    absencesOf(db, viewer.userId),
    activeAccounts(db, today),
    db.select().from(emailOutbox).where(eq(emailOutbox.userId, viewer.userId)).orderBy(desc(emailOutbox.createdAt)).limit(20),
  ]);
  const delegates = people.filter((p) => p.userId !== viewer.userId && p.roles.some((r) => r !== 'admin')).map((p) => ({ value: p.userId, label: p.displayName })).sort((a, b) => a.label.localeCompare(b.label));
  const current = abs.filter((a) => !a.cancelledAt && a.toOn >= today);
  return (
    <>
      <PageHeader screen="approvals" actions={<AbsenceForm delegates={delegates} today={today} />} />
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
                    {i.onBehalfOf && <div><Tag tone="outline" size="xs">{`${t('on behalf of')} ${i.onBehalfOf}`}</Tag></div>}
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
      <SectionCard title={t('Absences')} hint={t('Your delegate receives your notifications and may act on your circuit steps over the days')} scroll>
        {current.length ? (
          <Table>
            <thead><tr><Th>{t('Absent')}</Th><Th>{t('From')}</Th><Th>{t('To')}</Th><Th>{t('Delegate')}</Th><Th>{t('Note')}</Th><Th /></tr></thead>
            <tbody>
              {current.map((a) => (
                <tr key={a.id}>
                  <Td>{a.userName} {absentOn(a, today) && <Tag tone="accent" size="xs">{t('In progress')}</Tag>}</Td>
                  <Td nowrap>{fmtDate(a.fromOn, lang)}</Td>
                  <Td nowrap>{fmtDate(a.toOn, lang)}</Td>
                  <Td>{a.delegateName}</Td>
                  <Td tone="secondary">{a.note ?? ''}</Td>
                  <Td align="right">{a.userId === viewer.userId && <EndAbsenceButton id={a.id} />}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No absence declared.')}</EmptyState>
        )}
      </SectionCard>
      <SectionCard title={t('My notifications')} hint={t('The e-mails of the circuits sent to you (the 20 latest)')} scroll>
        {mail.length ? (
          <Table>
            <thead><tr><Th>{t('Date')}</Th><Th>{t('Kind')}</Th><Th>{t('Subject')}</Th><Th>{t('Status')}</Th></tr></thead>
            <tbody>
              {mail.map((m) => (
                <tr key={m.id}>
                  <Td nowrap>{fmtDate(m.createdAt, lang)}</Td>
                  <Td>{t(NOTICE_LABEL[m.kind as NoticeKind] ?? m.kind)}</Td>
                  <Td>{m.subject}</Td>
                  <Td tone="secondary">{t(MAIL_STATUS_LABEL[m.status])}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{t('No notification yet.')}</EmptyState>
        )}
      </SectionCard>
    </>
  );
}
