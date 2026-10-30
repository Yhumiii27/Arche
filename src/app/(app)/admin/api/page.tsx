// API and webhooks (AR-048, docs/API.md), the administrator only: the applications that call Arche's business API (their key
// is shown once at its creation: only its fingerprint is kept), their webhook subscriptions and the latest deliveries of the
// outbox, sent by the worker's job `webhooks`.
import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/app/ActionForm';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/shell/page-header';
import { Table, Td, Th } from '@/components/ds/Table';
import { Tag } from '@/components/ds/Tag';
import { canSee } from '@/config/screens';
import { retryDeliveryAction, revokeApiClientAction, setWebhookActiveAction } from '@/features/admin/api-actions';
import { NewApiClientForm, NewWebhookForm } from '@/features/admin/api-forms';
import { fmtInstant } from '@/lib/format';
import { getDb } from '@/server/db/client';
import { apiClients, subsidiaries, webhookDeliveries, webhookSubscriptions } from '@/server/db/schema';
import { getI18n, getViewer } from '@/server/session';

const STATUS_TONE: Record<string, 'accent' | 'outline' | 'neutral'> = { sent: 'neutral', pending: 'outline', failed: 'accent' };
const STATUS: Record<string, string> = { sent: 'Sent', pending: 'Pending', failed: 'Failed' };

export default async function ApiAdminPage() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  if (!canSee(viewer.role, 'admin-api')) notFound();
  const db = await getDb();
  const [clients, subs, hooks, deliveries] = await Promise.all([
    db.select().from(apiClients).orderBy(desc(apiClients.createdAt)),
    db.select({ code: subsidiaries.code, name: subsidiaries.name }).from(subsidiaries).orderBy(subsidiaries.code),
    db.select({ w: webhookSubscriptions, client: apiClients.name }).from(webhookSubscriptions).innerJoin(apiClients, eq(apiClients.id, webhookSubscriptions.clientId)).orderBy(desc(webhookSubscriptions.createdAt)),
    db.select({ d: webhookDeliveries, url: webhookSubscriptions.url }).from(webhookDeliveries).innerJoin(webhookSubscriptions, eq(webhookSubscriptions.id, webhookDeliveries.subscriptionId)).orderBy(desc(webhookDeliveries.createdAt)).limit(50),
  ]);
  const active = clients.filter((c) => !c.revokedAt);
  const capexOf = (p: Record<string, unknown>) => ((p.capex as { code?: string } | undefined)?.code ?? '—');
  return (
    <>
      <PageHeader screen="admin-api" crumbs={['Administration']}
        primary={<NewApiClientForm subsidiaries={subs} />}
        actions={active.length > 0 && <NewWebhookForm clients={active.map((c) => ({ value: c.id, label: c.name }))} />}
      />
      <SectionCard title={t('Applications')} subtitle={t('Key in the Authorization header (Bearer); writes are signed — docs/API.md')} scroll>
        <Table>
          <thead><tr><Th>{t('Application')}</Th><Th>{t('Key')}</Th><Th>{t('Rights')}</Th><Th>{t('Subsidiaries')}</Th><Th>{t('Last use')}</Th><Th>{t('Status')}</Th><Th /></tr></thead>
          <tbody>
            {clients.length === 0 && <tr><Td tone="secondary">{t('No application yet.')}</Td></tr>}
            {clients.map((c) => (
              <tr key={c.id}>
                <Td>{c.name}</Td>
                <Td nowrap><code>{`${c.keyPrefix}_…`}</code></Td>
                <Td>{t(c.canWrite ? 'Read and write' : 'Read')}</Td>
                <Td>{c.subsidiaries.length ? c.subsidiaries.join(', ') : t('Whole group')}</Td>
                <Td nowrap>{c.lastUsedAt ? fmtInstant(c.lastUsedAt, lang) : t('Never')}</Td>
                <Td>{c.revokedAt ? <Tag tone="outline" size="sm">{`${t('Revoked')} · ${fmtInstant(c.revokedAt, lang)}`}</Tag> : <Tag tone="neutral" size="sm">{t('Active')}</Tag>}</Td>
                <Td align="right">{!c.revokedAt && <ActionButton run={revokeApiClientAction.bind(null, c.id)} label="Revoke the key" done="Revoked" variant="ghost" />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title={t('Webhooks')} subtitle={t('Signed deliveries (X-Arche-Signature), sent by the worker every minute')} scroll>
        <Table>
          <thead><tr><Th>{t('Application')}</Th><Th>{t('Address')}</Th><Th>{t('Events')}</Th><Th>{t('Status')}</Th><Th /></tr></thead>
          <tbody>
            {hooks.length === 0 && <tr><Td tone="secondary">{t('No webhook yet.')}</Td></tr>}
            {hooks.map(({ w, client }) => (
              <tr key={w.id}>
                <Td>{client}</Td>
                <Td><code>{w.url}</code></Td>
                <Td>{w.events.map((e) => <code key={e} style={{ marginRight: 6 }}>{e}</code>)}</Td>
                <Td><Tag tone={w.active ? 'neutral' : 'outline'} size="sm">{t(w.active ? 'Active' : 'Suspended')}</Tag></Td>
                <Td align="right"><ActionButton run={setWebhookActiveAction.bind(null, w.id, !w.active)} label={w.active ? 'Suspend' : 'Resume'} done="Saved" variant="ghost" /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
      <SectionCard title={t('Latest deliveries')} scroll>
        <Table>
          <thead><tr><Th>{t('Created')}</Th><Th>{t('Event')}</Th><Th>CAPEX</Th><Th>{t('Address')}</Th><Th>{t('Status')}</Th><Th align="right">{t('Attempts')}</Th><Th>{t('Last error')}</Th><Th /></tr></thead>
          <tbody>
            {deliveries.length === 0 && <tr><Td tone="secondary">{t('No delivery yet.')}</Td></tr>}
            {deliveries.map(({ d, url }) => (
              <tr key={d.id}>
                <Td nowrap>{fmtInstant(d.createdAt, lang)}</Td>
                <Td><code>{d.event}</code></Td>
                <Td nowrap>{capexOf(d.payload)}</Td>
                <Td><code>{url}</code></Td>
                <Td><Tag tone={STATUS_TONE[d.status]} size="sm">{t(STATUS[d.status])}</Tag></Td>
                <Td align="right">{d.attempts}</Td>
                <Td tone="secondary">{d.lastError ?? '—'}</Td>
                <Td align="right">{d.status === 'failed' && <ActionButton run={retryDeliveryAction.bind(null, d.id)} label="Send again" done="Queued" variant="ghost" />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </SectionCard>
    </>
  );
}
