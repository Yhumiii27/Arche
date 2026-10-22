'use client';
// Management of change forms: a new change (project lead), the decision of the level the delegation matrix names.
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { CHANGE_KINDS, CHANGE_KIND_LABEL } from '@/domain/delegation';
import { useI18n } from '@/i18n/client';
import { createChangeAction, decideChangeAction } from './actions';

export function NewChangeForm({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Record a change">
      <ActionForm action={(p, fd) => createChangeAction(code, p, fd)} submit="Submit the change" done="Submitted">
        <Field label={t('Change')} htmlFor="ch-title" required span="full">
          <Input id="ch-title" name="title" required />
        </Field>
        <Field label={t('Kind')} htmlFor="ch-kind" required>
          <Select id="ch-kind" name="kind" options={CHANGE_KINDS.map((k) => ({ value: k, label: t(CHANGE_KIND_LABEL[k]) }))} />
        </Field>
        <Field label={t('Extra cost (k€)')} htmlFor="ch-amount">
          <Input id="ch-amount" name="amountKeur" inputMode="decimal" />
        </Field>
        <Field label={t('Extra delay (days)')} htmlFor="ch-delay">
          <Input id="ch-delay" name="delayDays" inputMode="numeric" />
        </Field>
        <Field label={t('Description')} htmlFor="ch-desc" span="full">
          <Textarea id="ch-desc" name="description" rows={2} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function DecideChangeForm({ code, changeId }: { code: string; changeId: string }) {
  const { t } = useI18n();
  return (
    <ActionForm inline action={async (_p, fd) => decideChangeAction(code, changeId, fd.get('outcome') === 'approved' ? 'approved' : 'rejected', String(fd.get('reason') ?? ''))} submit="Decide" done="Decided">
      <Select size="inline" name="outcome" aria-label={t('Decision')} options={[{ value: 'approved', label: t('Approve') }, { value: 'rejected', label: t('Reject') }]} />
      <Input size="inline" name="reason" placeholder={t('Reason')} aria-label={t('Reason')} />
    </ActionForm>
  );
}
