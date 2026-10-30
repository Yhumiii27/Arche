'use client';
// Finance forms (delivery 7, lot 7b): a lot's disbursement forecast for the months to come (AR-045), and the envelopes of the
// group CFO — a new envelope, its amount, a carry-over or a reallocation (AR-040). The Server Functions check everything again.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select } from '@/components/ds/Field';
import { unitOf } from '@/domain/currency';
import { ENVELOPE_CATEGORIES, ENVELOPE_CATEGORY_LABEL } from '@/domain/envelopes';
import { useI18n } from '@/i18n/client';
import { createEnvelopeAction, moveEnvelopeAction, saveAssetClassAction, saveForecastAction, setLotClassAction, transferAssetsAction, updateEnvelopeAction } from './actions';

export function ForecastForm({ code, lotId, label, months, values, currencies, typedIn }: {
  code: string; lotId: string; label: string; months: string[]; values: Record<string, number>; currencies: string[]; typedIn: string;
}) {
  const { t } = useI18n();
  return (
    <Folded summary="Forecast the disbursements" title={label}>
      <ActionForm action={(p, fd) => saveForecastAction(code, lotId, p, fd)} submit="Save the forecast" done="Saved">
        <Field label={t('Amounts in')} htmlFor={`fc-cur-${lotId}`} hint={t('Disbursement of each month (not cumulative); empty = none. Converted to k€ at the month’s reference rate')} span="full">
          <Select id={`fc-cur-${lotId}`} name="currency" defaultValue={typedIn} options={currencies.map((c) => ({ value: c, label: unitOf(c) }))} />
        </Field>
        {months.map((m) => (
          <Field key={m} label={m} htmlFor={`fc-${lotId}-${m}`}>
            <Input id={`fc-${lotId}-${m}`} name={`m:${m}`} inputMode="decimal" defaultValue={values[m] != null ? String(values[m]) : ''} />
          </Field>
        ))}
      </ActionForm>
    </Folded>
  );
}

type Opt = { value: string; label: string };

export function NewEnvelopeForm({ scopes, year }: { scopes: Opt[]; year: number }) {
  const { t } = useI18n();
  return (
    <Folded summary="New envelope" variant="primary">
      <ActionForm action={createEnvelopeAction} submit="Vote the envelope" done="Saved">
        <Field label={t('Fiscal year')} htmlFor="ev-year" required>
          <Input id="ev-year" name="fiscalYear" inputMode="numeric" defaultValue={String(year)} required />
        </Field>
        <Field label={t('Scope')} htmlFor="ev-scope" required>
          <Select id="ev-scope" name="scope" options={scopes} />
        </Field>
        <Field label={t('Category')} htmlFor="ev-cat" required>
          <Select id="ev-cat" name="category" options={ENVELOPE_CATEGORIES.map((c) => ({ value: c, label: t(ENVELOPE_CATEGORY_LABEL[c]) }))} />
        </Field>
        <Field label={t('Amount (k€)')} htmlFor="ev-amount" required>
          <Input id="ev-amount" name="amountKeur" inputMode="decimal" required />
        </Field>
        <Field label={t('Note')} htmlFor="ev-note" span="full">
          <Input id="ev-note" name="note" />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function EnvelopeAmountForm({ id, amount, label }: { id: string; amount: number; label: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Change the amount" title={label}>
      <ActionForm action={(p, fd) => updateEnvelopeAction(id, p, fd)} submit="Save" done="Saved">
        <Field label={t('Amount (k€)')} htmlFor={`ea-${id}`} required>
          <Input id={`ea-${id}`} name="amountKeur" inputMode="decimal" defaultValue={String(amount)} required />
        </Field>
        <Field label={t('Reason')} htmlFor={`ea-r-${id}`} required span="full">
          <Input id={`ea-r-${id}`} name="reason" required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

/** A carry-over to the next fiscal year (no target) or a reallocation to another envelope of the year. */
export function MoveEnvelopeForm({ id, label, targets }: { id: string; label: string; targets: Opt[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Carry over or reallocate" title={label}>
      <ActionForm action={(p, fd) => moveEnvelopeAction(id, p, fd)} submit="Record the movement" done="Saved">
        <Field label={t('To')} htmlFor={`em-to-${id}`} required span="full">
          <Select id={`em-to-${id}`} name="toId" options={[{ value: '', label: t('Next fiscal year (carry-over)') }, ...targets]} />
        </Field>
        <Field label={t('Amount (k€)')} htmlFor={`em-a-${id}`} required>
          <Input id={`em-a-${id}`} name="amountKeur" inputMode="decimal" required />
        </Field>
        <Field label={t('Reason')} htmlFor={`em-r-${id}`} required span="full">
          <Input id={`em-r-${id}`} name="reason" required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

/** An asset class of the group (AR-050), created or changed by the group CFO. */
export function AssetClassForm({ kinds, value }: { kinds: { value: string; label: string }[]; value?: { code: string; label: string; lifeYears: number; method: string; factor: number | null; lotKinds: readonly string[] } }) {
  const { t } = useI18n();
  const id = value?.code ?? 'new';
  return (
    <Folded summary={value ? 'Edit' : 'New asset class'} title={value ? value.label : undefined}>
      <ActionForm action={saveAssetClassAction} submit="Save the class" done="Saved">
        <Field label={t('Code')} htmlFor={`ac-code-${id}`} required>
          <Input id={`ac-code-${id}`} name="code" defaultValue={value?.code} readOnly={!!value} required />
        </Field>
        <Field label={t('Label')} htmlFor={`ac-label-${id}`} required>
          <Input id={`ac-label-${id}`} name="label" defaultValue={value?.label} required />
        </Field>
        <Field label={t('Useful life (years)')} htmlFor={`ac-life-${id}`} required>
          <Input id={`ac-life-${id}`} name="lifeYears" inputMode="numeric" defaultValue={value ? String(value.lifeYears) : ''} required />
        </Field>
        <Field label={t('Method')} htmlFor={`ac-method-${id}`} required>
          <Select id={`ac-method-${id}`} name="method" defaultValue={value?.method ?? 'linear'} options={[{ value: 'linear', label: t('Straight line') }, { value: 'declining', label: t('Declining balance') }]} />
        </Field>
        <Field label={t('Declining-balance coefficient')} htmlFor={`ac-f-${id}`} hint="1,25 · 1,75 · 2,25">
          <Input id={`ac-f-${id}`} name="factor" inputMode="decimal" defaultValue={value?.factor != null ? String(value.factor) : ''} />
        </Field>
        <fieldset style={{ gridColumn: '1 / -1', border: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5 }}>
          <legend style={{ marginBottom: 4 }}>{t('Default class of the lots of kind')}</legend>
          {kinds.map((k) => <label key={k.value} style={{ display: 'flex', gap: 6 }}><input type="checkbox" name={`kind:${k.value}`} defaultChecked={value?.lotKinds.includes(k.value)} /> {k.label}</label>)}
        </fieldset>
      </ActionForm>
    </Folded>
  );
}

export function LotClassForm({ code, lotId, label, value, classes }: { code: string; lotId: string; label: string; value: string | null; classes: { value: string; label: string }[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Asset class" title={label}>
      <ActionForm action={(p, fd) => setLotClassAction(code, lotId, p, fd)} submit="Save" done="Saved">
        <Field label={t('Asset class')} htmlFor={`lc-${lotId}`} span="full">
          <Select id={`lc-${lotId}`} name="assetClassCode" defaultValue={value ?? ''} options={[{ value: '', label: t('The class of its kind') }, ...classes]} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function TransferAssetsButton({ code }: { code: string }) {
  return <ActionButton run={() => transferAssetsAction(code)} label="Transfer into fixed assets" done="Transferred" />;
}
