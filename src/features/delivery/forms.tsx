'use client';
// Delivery forms (delivery 5): a permit, an item of the engineering pack, a lot's planned window, a month's actuals of a lot and
// the import of Arche's CSV template. The Server Functions check everything again.
import { useState } from 'react';
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { unitOf } from '@/domain/currency';
import { ACTUALS_CSV_HEADER } from '@/domain/execution';
import { PACK_ITEM_STATUSES, PACK_ITEM_STATUS_LABEL, type PackItemStatus } from '@/domain/pack';
import { PERMIT_KINDS, PERMIT_KIND_LABEL, PERMIT_STATUSES, PERMIT_STATUS_LABEL, type PermitKind, type PermitStatus } from '@/domain/permits';
import { useI18n } from '@/i18n/client';
import { importActualsAction, saveActualAction, saveLotWindowAction, savePackItemAction, savePermitAction } from './actions';

export interface PermitValues {
  id: string;
  kind: PermitKind;
  title: string;
  authority: string | null;
  status: PermitStatus;
  filedOn: string | null;
  dueOn: string | null;
  obtainedOn: string | null;
  codexRef: string | null;
  note: string | null;
}

export function PermitForm({ code, permit, primary }: { code: string; permit?: PermitValues; primary?: boolean }) {
  const { t } = useI18n();
  const p = permit?.id ?? 'new';
  return (
    <Folded summary={permit ? 'Edit' : 'Add a permit'} variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'sm'}>
      <ActionForm action={(prev, fd) => savePermitAction(code, permit?.id ?? null, prev, fd)} submit={permit ? 'Save' : 'Add the permit'} done="Saved">
        <Field label={t('Kind')} htmlFor={`pm-kind-${p}`} required>
          <Select id={`pm-kind-${p}`} name="kind" defaultValue={permit?.kind} options={PERMIT_KINDS.map((k) => ({ value: k, label: t(PERMIT_KIND_LABEL[k]) }))} />
        </Field>
        <Field label={t('Status')} htmlFor={`pm-st-${p}`} required>
          <Select id={`pm-st-${p}`} name="status" defaultValue={permit?.status ?? 'to_file'} options={PERMIT_STATUSES.map((s) => ({ value: s, label: t(PERMIT_STATUS_LABEL[s]) }))} />
        </Field>
        <Field label={t('Permit')} htmlFor={`pm-title-${p}`} required span="full">
          <Input id={`pm-title-${p}`} name="title" defaultValue={permit?.title} required />
        </Field>
        <Field label={t('Authority')} htmlFor={`pm-auth-${p}`} span="full">
          <Input id={`pm-auth-${p}`} name="authority" defaultValue={permit?.authority ?? ''} />
        </Field>
        <Field label={t('Filed on')} htmlFor={`pm-filed-${p}`}>
          <Input id={`pm-filed-${p}`} name="filedOn" type="date" defaultValue={permit?.filedOn ?? ''} />
        </Field>
        <Field label={t('Expected decision')} htmlFor={`pm-due-${p}`}>
          <Input id={`pm-due-${p}`} name="dueOn" type="date" defaultValue={permit?.dueOn ?? ''} />
        </Field>
        <Field label={t('Obtained on')} htmlFor={`pm-obt-${p}`}>
          <Input id={`pm-obt-${p}`} name="obtainedOn" type="date" defaultValue={permit?.obtainedOn ?? ''} />
        </Field>
        <Field label={t('Codex reference')} htmlFor={`pm-codex-${p}`} hint={t('Identifier of the file in Codex (TYPE-CONTEXT-SEQ)')}>
          <Input id={`pm-codex-${p}`} name="codexRef" defaultValue={permit?.codexRef ?? ''} />
        </Field>
        <Field label={t('Note')} htmlFor={`pm-note-${p}`} span="full">
          <Textarea id={`pm-note-${p}`} name="note" rows={2} defaultValue={permit?.note ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function PackItemForm({ code, item, label }: { code: string; item: { code: string; status: PackItemStatus; codexRef: string | null }; label: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Edit" title={label}>
      <ActionForm action={(prev, fd) => savePackItemAction(code, item.code, prev, fd)} submit="Save" done="Saved">
        <Field label={t('Status')} htmlFor={`pk-st-${item.code}`} required>
          <Select id={`pk-st-${item.code}`} name="status" defaultValue={item.status} options={PACK_ITEM_STATUSES.map((s) => ({ value: s, label: t(PACK_ITEM_STATUS_LABEL[s]) }))} />
        </Field>
        <Field label={t('Codex reference')} htmlFor={`pk-codex-${item.code}`} hint={t('Required to validate the item')}>
          <Input id={`pk-codex-${item.code}`} name="codexRef" defaultValue={item.codexRef ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function LotWindowForm({ code, lotId, start, end, label }: { code: string; lotId: string; start: string | null; end: string | null; label: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Plan" title={label}>
      <ActionForm action={(prev, fd) => saveLotWindowAction(code, lotId, prev, fd)} submit="Save" done="Saved">
        <Field label={t('Start month')} htmlFor={`lw-s-${lotId}`}>
          <Input id={`lw-s-${lotId}`} name="start" type="month" defaultValue={start ?? ''} />
        </Field>
        <Field label={t('End month')} htmlFor={`lw-e-${lotId}`}>
          <Input id={`lw-e-${lotId}`} name="end" type="month" defaultValue={end ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function ActualForm({ code, lotId, month, label, currencies }: { code: string; lotId: string; month: string; label: string; currencies: string[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Enter the month" title={label}>
      <ActionForm action={(prev, fd) => saveActualAction(code, lotId, prev, fd)} submit="Save" done="Saved">
        <Field label={t('Month')} htmlFor={`ac-m-${lotId}`} required>
          <Input id={`ac-m-${lotId}`} name="month" type="month" defaultValue={month} max={month} required />
        </Field>
        <Field label={t('Amounts in')} htmlFor={`ac-cur-${lotId}`} hint={t('Converted to k€ at the month’s reference rate')}>
          <Select id={`ac-cur-${lotId}`} name="currency" defaultValue={currencies[0]} options={currencies.map((c) => ({ value: c, label: unitOf(c) }))} />
        </Field>
        <Field label={t('Committed to date')} htmlFor={`ac-c-${lotId}`}>
          <Input id={`ac-c-${lotId}`} name="committedKeur" inputMode="decimal" />
        </Field>
        <Field label={t('Spent to date')} htmlFor={`ac-s-${lotId}`}>
          <Input id={`ac-s-${lotId}`} name="spentKeur" inputMode="decimal" />
        </Field>
        <Field label={t('Physical progress (%)')} htmlFor={`ac-p-${lotId}`}>
          <Input id={`ac-p-${lotId}`} name="physicalPct" inputMode="decimal" />
        </Field>
      </ActionForm>
    </Folded>
  );
}

/** Import: the CSV file is read in the browser and sent as text (Arche stores no file). */
export function ImportActualsForm({ code, currencies }: { code: string; currencies: string[] }) {
  const { t } = useI18n();
  const [csv, setCsv] = useState('');
  return (
    <Folded summary="Import a CSV file" title="Import actuals">
      <ActionForm action={(prev, fd) => importActualsAction(code, prev, fd)} submit="Import" done="Imported">
        <Field label={t('Amounts in')} htmlFor="ac-imp-cur" hint={t('Converted to k€ at each month’s reference rate')}>
          <Select id="ac-imp-cur" name="currency" defaultValue={currencies[0]} options={currencies.map((c) => ({ value: c, label: unitOf(c) }))} />
        </Field>
        <Field label={t('File')} htmlFor="ac-file" span="full" hint={`${t('Arche template, one line per lot and month')} — ${ACTUALS_CSV_HEADER}`}>
          <input
            id="ac-file"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
          />
        </Field>
        <Field label={t('Content')} htmlFor="ac-csv" span="full">
          <Textarea id="ac-csv" name="csv" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`${ACTUALS_CSV_HEADER}\n1;2026-10;1200;850;40`} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
