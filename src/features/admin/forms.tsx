'use client';
// Administration forms (client islands of the server pages): each submits to its Server Function and shows the translated
// result. The Server Functions do every check again.
import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ds/Button';
import { Field, Input, Select } from '@/components/ds/Field';
import { EXPERT_SPECIALITIES, ROLE_KEYS, ROLE_LABEL, ROLE_SCOPE, SPECIALITY_LABEL, type RoleKey } from '@/config/roles';
import { useI18n } from '@/i18n/client';
import {
  addRoleAction, createSiteAction, createSubsidiaryAction, createUserAction, createZoneAction, removeRoleAction, setRevenueAction, setUserActiveAction,
  type ActionResult,
} from './actions';
import s from './forms.module.css';

function Result({ state, done }: { state: ActionResult | null; done: string }) {
  const { t } = useI18n();
  if (!state) return null;
  return state.ok ? <span className={s.done} role="status">{t(done)}</span> : <span className={s.error} role="alert">{t(state.error)}</span>;
}

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** A form whose fields are reset after a successful submit (React resets uncontrolled fields of a form action). */
function ActionForm({ action, submit, done, children }: { action: Action; submit: string; done: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={s.form}>
      {children}
      <div className={s.actions}>
        <Button type="submit" variant="primary" disabled={pending}>
          {t(submit)}
        </Button>
        <Result state={state} done={done} />
      </div>
    </form>
  );
}

export function NewUserForm({ subsidiaries }: { subsidiaries: { code: string; name: string }[] }) {
  const { t } = useI18n();
  return (
    <ActionForm action={createUserAction} submit="Create the account" done="Account created">
      <Field label={t('E-mail')} htmlFor="nu-email" required>
        <Input id="nu-email" name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label={t('Name')} htmlFor="nu-name" required>
        <Input id="nu-name" name="displayName" required />
      </Field>
      <Field label={t('Job title')} htmlFor="nu-title">
        <Input id="nu-title" name="jobTitle" />
      </Field>
      <Field label={t('Subsidiary')} htmlFor="nu-sub">
        <Select id="nu-sub" name="subsidiaryCode" options={[{ value: '', label: t('Group') }, ...subsidiaries.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))]} />
      </Field>
    </ActionForm>
  );
}

export interface RefLists {
  zones: { code: string; name: string }[];
  subsidiaries: { code: string; name: string }[];
  capex: string[];
}

export function AddRoleForm({ userId, refs }: { userId: string; refs: RefLists }) {
  const { t } = useI18n();
  const [role, setRole] = useState<RoleKey>('project_lead');
  const [state, run, pending] = useActionState(addRoleAction, null);
  const scope = ROLE_SCOPE[role];
  const refOptions =
    scope === 'zone' ? refs.zones.map((z) => ({ value: z.code, label: z.code }))
      : scope === 'subsidiary' ? refs.subsidiaries.map((z) => ({ value: z.code, label: z.code }))
        : scope === 'capex' ? refs.capex.map((c) => ({ value: c, label: c })) : [];
  return (
    <details className={s.addDetails}>
      <summary>{t('Add a role')}</summary>
      <form action={run} className={s.addRole}>
        <input type="hidden" name="userId" value={userId} />
        <Select size="inline" name="role" aria-label={t('Role')} value={role} onChange={(e) => setRole(e.target.value as RoleKey)} options={ROLE_KEYS.map((r) => ({ value: r, label: t(ROLE_LABEL[r]) }))} />
        {scope !== 'group' && <Select size="inline" name="scopeRef" aria-label={t('Scope')} key={scope} options={refOptions} />}
        {role === 'expert' && <Select size="inline" name="speciality" aria-label={t('Speciality')} options={EXPERT_SPECIALITIES.map((x) => ({ value: x, label: t(SPECIALITY_LABEL[x]) }))} />}
        <Button type="submit" size="xs" variant="secondary" disabled={pending}>
          {t('Add the role')}
        </Button>
        <Result state={state} done="Role added" />
      </form>
    </details>
  );
}

export function RemoveRoleButton({ id, label }: { id: string; label: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={s.remove} aria-label={`${t('Remove the role')} ${label}`} disabled={pending}
        onClick={() => start(async () => { const r = await removeRoleAction(id); setError(r.ok ? null : r.error); })}>
        ×
      </button>
      {error && <span className={s.error} role="alert">{t(error)}</span>}
    </>
  );
}

export function ActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={s.actions}>
      <Button size="xs" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await setUserActiveAction(userId, !active); setError(r.ok ? null : r.error); })}>
        {active ? t('Deactivate') : t('Reactivate')}
      </Button>
      {error && <span className={s.error} role="alert">{t(error)}</span>}
    </span>
  );
}

export function NewZoneForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={createZoneAction} submit="Add the zone" done="Zone added">
      <Field label={t('Code')} htmlFor="nz-code" required>
        <Input id="nz-code" name="code" required maxLength={6} />
      </Field>
      <Field label={t('Name')} htmlFor="nz-name" required>
        <Input id="nz-name" name="name" required />
      </Field>
    </ActionForm>
  );
}

export function NewSubsidiaryForm({ zones }: { zones: { code: string; name: string }[] }) {
  const { t } = useI18n();
  return (
    <ActionForm action={createSubsidiaryAction} submit="Add the subsidiary" done="Subsidiary added">
      <Field label={t('Code')} htmlFor="ns-code" required hint={t('Three letters')}>
        <Input id="ns-code" name="code" required maxLength={3} />
      </Field>
      <Field label={t('Name')} htmlFor="ns-name" required>
        <Input id="ns-name" name="name" required />
      </Field>
      <Field label={t('Country')} htmlFor="ns-country" required hint={t('ISO code, e.g. MA')}>
        <Input id="ns-country" name="countryIso2" required maxLength={2} />
      </Field>
      <Field label={t('Zone')} htmlFor="ns-zone" required>
        <Select id="ns-zone" name="zoneCode" options={zones.map((z) => ({ value: z.code, label: z.code }))} />
      </Field>
      <Field label={t('Currency')} htmlFor="ns-cur" hint={t('ISO code, e.g. MAD')}>
        <Input id="ns-cur" name="currency" maxLength={3} defaultValue="EUR" />
      </Field>
    </ActionForm>
  );
}

export function NewSiteForm({ subsidiaries }: { subsidiaries: { code: string; name: string }[] }) {
  const { t } = useI18n();
  return (
    <ActionForm action={createSiteAction} submit="Add the site" done="Site added">
      <Field label={t('Subsidiary')} htmlFor="nsi-sub" required>
        <Select id="nsi-sub" name="subsidiaryCode" options={subsidiaries.map((x) => ({ value: x.code, label: x.code }))} />
      </Field>
      <Field label={t('Name')} htmlFor="nsi-name" required>
        <Input id="nsi-name" name="name" required />
      </Field>
      <Field label={t('City')} htmlFor="nsi-city">
        <Input id="nsi-city" name="city" />
      </Field>
    </ActionForm>
  );
}

export function RevenueForm({ subsidiaries, year }: { subsidiaries: { code: string; name: string }[]; year: number }) {
  const { t } = useI18n();
  return (
    <ActionForm action={setRevenueAction} submit="Save the revenue" done="Revenue saved">
      <Field label={t('Subsidiary')} htmlFor="rv-sub" required>
        <Select id="rv-sub" name="subsidiaryCode" options={subsidiaries.map((x) => ({ value: x.code, label: x.code }))} />
      </Field>
      <Field label={t('Fiscal year')} htmlFor="rv-year" required>
        <Input id="rv-year" name="fiscalYear" required inputMode="numeric" defaultValue={String(year - 1)} />
      </Field>
      <Field label={t('Revenue (k€)')} htmlFor="rv-amount" required>
        <Input id="rv-amount" name="revenueKeur" required inputMode="decimal" />
      </Field>
      <Field label={t('Source')} htmlFor="rv-src">
        <Input id="rv-src" name="sourceNote" />
      </Field>
    </ActionForm>
  );
}
