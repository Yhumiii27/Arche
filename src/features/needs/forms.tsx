'use client';
// Machine needs forms: a need line (catalogue sheet with its options, or a free need), submit, delete a draft, withdraw. The
// labels of the catalogue are Keystone's typed text: the page passes them already displayed (dataText).
import { useState } from 'react';
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { useI18n } from '@/i18n/client';
import { deleteNeedAction, saveNeedAction, submitNeedAction, withdrawNeedAction } from './actions';

export interface SheetChoice {
  value: string;
  label: string;
  options: { code: string; label: string }[];
  unit: string | null;
}

export interface NeedDraft {
  id: string;
  catalogue: string;
  freeLabel: string;
  quantity: number;
  options: string[];
  targetCapacity: string;
  capacityUnit: string;
  needDate: string;
  lotId: string;
  comment: string;
}

export function NeedForm({ code, sheets, lots, draft, primary }: { code: string; sheets: SheetChoice[]; lots: { value: string; label: string }[]; draft?: NeedDraft; primary?: boolean }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(draft?.catalogue ?? sheets[0]?.value ?? '');
  const sheet = sheets.find((s) => s.value === sel);
  const p = draft?.id ?? 'new';
  return (
    <Folded summary={draft ? 'Edit' : 'Add a machine need'} variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'row'}>
      <ActionForm action={(prev, fd) => saveNeedAction(code, draft?.id ?? null, prev, fd)} submit={draft ? 'Save' : 'Add the need'} done="Saved">
        <Field label={t('Catalogue machine')} htmlFor={`nd-cat-${p}`} span="full">
          <Select id={`nd-cat-${p}`} name="catalogue" value={sel} onChange={(e) => setSel(e.target.value)} options={[...sheets.map((s) => ({ value: s.value, label: s.label })), { value: '', label: t('Free need (not in the catalogue)') }]} />
        </Field>
        {sel === '' && (
          <Field label={t('Need')} htmlFor={`nd-free-${p}`} required span="full">
            <Input id={`nd-free-${p}`} name="freeLabel" defaultValue={draft?.freeLabel} />
          </Field>
        )}
        {sheet && sheet.options.length > 0 && (
          <Field label={t('Options')} span="full">
            <span>
              {sheet.options.map((o) => (
                <label key={o.code} style={{ marginRight: 16 }}>
                  <input type="checkbox" name="options" value={o.code} defaultChecked={draft?.options.includes(o.code)} /> {o.label}
                </label>
              ))}
            </span>
          </Field>
        )}
        <Field label={t('Quantity')} htmlFor={`nd-qty-${p}`} required>
          <Input id={`nd-qty-${p}`} name="quantity" inputMode="numeric" defaultValue={String(draft?.quantity ?? 1)} />
        </Field>
        <Field label={t('Target capacity')} htmlFor={`nd-cap-${p}`}>
          <Input id={`nd-cap-${p}`} name="targetCapacity" inputMode="decimal" defaultValue={draft?.targetCapacity} />
        </Field>
        {!sheet && (
          <Field label={t('Unit')} htmlFor={`nd-unit-${p}`}>
            <Input id={`nd-unit-${p}`} name="capacityUnit" defaultValue={draft?.capacityUnit} />
          </Field>
        )}
        <Field label={t('Need date')} htmlFor={`nd-date-${p}`}>
          <Input id={`nd-date-${p}`} name="needDate" type="date" defaultValue={draft?.needDate} />
        </Field>
        {lots.length > 0 && (
          <Field label={t('Lot')} htmlFor={`nd-lot-${p}`}>
            <Select id={`nd-lot-${p}`} name="lotId" defaultValue={draft?.lotId} options={[{ value: '', label: '—' }, ...lots]} />
          </Field>
        )}
        <Field label={t('Comment')} htmlFor={`nd-com-${p}`} span="full">
          <Textarea id={`nd-com-${p}`} name="comment" rows={2} defaultValue={draft?.comment} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function SubmitNeedButton({ code, needId }: { code: string; needId: string }) {
  return <ActionButton run={() => submitNeedAction(code, needId)} label="Submit to EPC2i" done="Submitted" variant="primary" />;
}

export function DeleteNeedButton({ code, needId }: { code: string; needId: string }) {
  return <ActionButton run={() => deleteNeedAction(code, needId)} label="Delete" done="Deleted" variant="ghost" />;
}

/** "Withdraw…": a panel asking the reason (the withdrawal is traced, EPC2i sees it). */
export function WithdrawNeedForm({ code, needId }: { code: string; needId: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Withdraw…" title="Withdraw the need" size="row">
      <ActionForm action={(_p, fd) => withdrawNeedAction(code, needId, String(fd.get('reason') ?? ''))} submit="Withdraw" done="Withdrawn">
        <Field label={t('Reason')} htmlFor={`wd-${needId}`} required span="full">
          <Textarea id={`wd-${needId}`} name="reason" rows={3} required />
        </Field>
      </ActionForm>
    </Folded>
  );
}
