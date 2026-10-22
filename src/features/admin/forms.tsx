'use client';
// Administration forms (client islands of the server pages): each submits to its Server Function and shows the translated
// result. The Server Functions do every check again.
import { useActionState, useState, useTransition } from 'react';
import { ActionForm, Result } from '@/components/app/ActionForm';
import { Button } from '@/components/ds/Button';
import { Field, Input, Select } from '@/components/ds/Field';
import { EXPERT_SPECIALITIES, ROLE_KEYS, ROLE_LABEL, ROLE_SCOPE, SPECIALITY_LABEL, type RoleKey } from '@/config/roles';
import { LEVEL_LABEL, type DelegationMatrix } from '@/domain/delegation';
import { GATES, VALUE_BOUNDS, type ModelValues } from '@/domain/lifecycle';
import { useI18n } from '@/i18n/client';
import {
  addRoleAction, createSiteAction, createSubsidiaryAction, createUserAction, createZoneAction, removeRoleAction, setRevenueAction, setUserActiveAction, updateMatrixAction, updateModelValuesAction,
} from './actions';
import s from './forms.module.css';


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

export function ModelValuesForm({ values }: { values: ModelValues }) {
  const { t } = useI18n();
  const n = (name: string, label: string, value: number, [lo, hi]: readonly [number, number]) => (
    <Field key={name} label={t(label)} htmlFor={`mv-${name}`} hint={`${lo}–${hi}`}>
      <Input id={`mv-${name}`} name={name} type="number" min={lo} max={hi} step={1} defaultValue={value} required />
    </Field>
  );
  return (
    <ActionForm action={updateModelValuesAction} submit="Save the values" done="Values saved">
      {GATES.map((g) => n(`delay:${g}`, `${g} target delay (working days)`, values.gateDelayDays[g], VALUE_BOUNDS.gateDelayDays))}
      {n('strategicRatioPct', 'Strategic from (% of revenue)', values.strategicRatioPct, VALUE_BOUNDS.strategicRatioPct)}
      {n('packThresholdPct', 'Engineering pack at G2 (%)', values.packThresholdPct, VALUE_BOUNDS.packThresholdPct)}
      {n('worksThresholdPct', 'Works lots at K3 (%)', values.worksThresholdPct, VALUE_BOUNDS.worksThresholdPct)}
      {n('rampupDays', 'Days at nominal capacity for G3', values.rampupDays, VALUE_BOUNDS.rampupDays)}
      {n('mesMaxMonths', 'Months after commissioning for G3', values.mesMaxMonths, VALUE_BOUNDS.mesMaxMonths)}
    </ActionForm>
  );
}

export function DelegationMatrixForm({ matrix }: { matrix: DelegationMatrix }) {
  const { t } = useI18n();
  const n = (name: string, label: string, value: number) => (
    <Field key={name} label={label} htmlFor={`dm-${name}`}>
      <Input id={`dm-${name}`} name={name} inputMode="decimal" defaultValue={String(value)} required />
    </Field>
  );
  const fields: React.ReactNode[] = [];
  for (const typ of ['light', 'strategic'] as const)
    for (const l of ['copil_projet', 'dir_ig'] as const) {
      const head = `${t(typ === 'light' ? 'Light' : 'Strategic')} · ${t(LEVEL_LABEL[l])}`;
      fields.push(n(`${typ}.${l}.costPct`, `${head} — ${t('cost, % of G2')}`, matrix[typ][l].costPct));
      fields.push(n(`${typ}.${l}.costKeur`, `${head} — ${t('cost, k€')}`, matrix[typ][l].costKeur));
      fields.push(n(`${typ}.${l}.delayDays`, `${head} — ${t('delay, days')}`, matrix[typ][l].delayDays));
    }
  fields.push(n('cumulativePct.copil_projet', `${t(LEVEL_LABEL.copil_projet)} — ${t('cumulative cost, % of G2')}`, matrix.cumulativePct.copil_projet));
  fields.push(n('cumulativePct.dir_ig', `${t(LEVEL_LABEL.dir_ig)} — ${t('cumulative cost, % of G2')}`, matrix.cumulativePct.dir_ig));
  fields.push(n('contingencyPct', t('Contingency draw-down by the project steering committee, % of the provision'), matrix.contingencyPct));
  return (
    <ActionForm action={updateMatrixAction} submit="Put in force from today" done="Matrix in force">
      {fields}
    </ActionForm>
  );
}
