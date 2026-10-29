'use client';
// Business API administration forms (AR-048): a new API client and a new webhook subscription, each showing its secret once —
// the key or the signing secret is not kept by Arche in a readable form (the key) or never shown again (the secret).
import { useActionState } from 'react';
import { Folded, Result } from '@/components/app/ActionForm';
import { Button } from '@/components/ds/Button';
import { Field, Input, Select } from '@/components/ds/Field';
import { useI18n } from '@/i18n/client';
import { WEBHOOK_EVENTS } from '@/domain/api-events';
import { createApiClientAction, createWebhookAction, type SecretResult } from './api-actions';
import s from '@/components/app/ActionForm.module.css';

function Secret({ state, note }: { state: SecretResult | null; note: string }) {
  const { t } = useI18n();
  if (!state) return null;
  if (!state.ok) return <Result state={state} done="" />;
  return (
    <div role="status" style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
      <span className={s.done}>{t(note)}</span>
      <code style={{ userSelect: 'all', wordBreak: 'break-all', padding: 8, border: '1px solid var(--border-2, #444)', borderRadius: 6 }}>{state.secret}</code>
    </div>
  );
}

export function NewApiClientForm({ subsidiaries }: { subsidiaries: { code: string; name: string }[] }) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(createApiClientAction, null);
  return (
    <Folded summary="New API client" variant="primary">
      <form action={run} className={s.form}>
        <Field label={t('Application')} htmlFor="ac-name" required span="full">
          <Input id="ac-name" name="name" required placeholder="Power BI groupe" />
        </Field>
        <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, fontSize: 12.5 }}>
          <input type="checkbox" name="canWrite" /> {t('May write (monthly actuals, actions)')}
        </label>
        <fieldset style={{ gridColumn: '1 / -1', border: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5 }}>
          <legend style={{ marginBottom: 4 }}>{t('Subsidiaries (none ticked: the whole group)')}</legend>
          {subsidiaries.map((x) => (
            <label key={x.code} style={{ display: 'flex', gap: 6 }}><input type="checkbox" name={`sub:${x.code}`} /> {`${x.code} · ${x.name}`}</label>
          ))}
        </fieldset>
        <div className={s.actions}>
          <Button type="submit" variant="primary" disabled={pending}>{t('Create the key')}</Button>
        </div>
        <Secret state={state} note="Copy the key now: Arche keeps only its fingerprint and will never show it again." />
      </form>
    </Folded>
  );
}

export function NewWebhookForm({ clients }: { clients: { value: string; label: string }[] }) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(createWebhookAction, null);
  return (
    <Folded summary="New webhook">
      <form action={run} className={s.form}>
        <Field label={t('Application')} htmlFor="wh-client" required>
          <Select id="wh-client" name="clientId" options={clients} />
        </Field>
        <Field label={t('Address')} htmlFor="wh-url" required span="full">
          <Input id="wh-url" name="url" type="url" required placeholder="https://…" />
        </Field>
        <fieldset style={{ gridColumn: '1 / -1', border: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5 }}>
          <legend style={{ marginBottom: 4 }}>{t('Events')}</legend>
          {WEBHOOK_EVENTS.map((e) => <label key={e} style={{ display: 'flex', gap: 6 }}><input type="checkbox" name={`event:${e}`} defaultChecked /> <code>{e}</code></label>)}
        </fieldset>
        <div className={s.actions}>
          <Button type="submit" variant="primary" disabled={pending}>{t('Subscribe')}</Button>
        </div>
        <Secret state={state} note="Copy the signing secret now: it will not be shown again." />
      </form>
    </Folded>
  );
}
