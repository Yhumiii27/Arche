'use client';
// Absences forms (AR-041): declare an absence with its delegate, end it. The Server Functions check everything again.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { useI18n } from '@/i18n/client';
import { declareAbsenceAction, endAbsenceAction } from './actions';

export function AbsenceForm({ delegates, today }: { delegates: { value: string; label: string }[]; today: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Declare an absence">
      <ActionForm action={declareAbsenceAction} submit="Declare the absence" done="Saved">
        <Field label={t('First day')} htmlFor="ab-from" required>
          <Input id="ab-from" name="fromOn" type="date" min={today} defaultValue={today} required />
        </Field>
        <Field label={t('Last day')} htmlFor="ab-to" required>
          <Input id="ab-to" name="toOn" type="date" min={today} required />
        </Field>
        <Field label={t('Delegate')} htmlFor="ab-delegate" required hint={t('Receives your notifications and may act on your circuit steps')} span="full">
          <Select id="ab-delegate" name="delegateUserId" options={[{ value: '', label: '—' }, ...delegates]} required />
        </Field>
        <Field label={t('Note')} htmlFor="ab-note" span="full">
          <Textarea id="ab-note" name="note" rows={2} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function EndAbsenceButton({ id }: { id: string }) {
  return <ActionButton run={() => endAbsenceAction(id)} label="End the absence" done="Ended" />;
}
