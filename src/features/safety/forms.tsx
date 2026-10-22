'use client';
// Safety milestone form (N-13): the group HSE's declaration of a milestone.
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { HS_STATUSES, HS_STATUS_LABEL, type HsCode, type HsStatus } from '@/domain/safety';
import { useI18n } from '@/i18n/client';
import { declareHsAction } from './actions';

export function HsForm({ code, hs, label }: { code: string; hs: { code: HsCode; status: HsStatus; evidenceRef: string | null; passedOn: string | null; note: string | null }; label: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Declare" title={label}>
      <ActionForm action={(prev, fd) => declareHsAction(code, hs.code, prev, fd)} submit="Save" done="Saved">
        <Field label={t('Status')} htmlFor={`hs-st-${hs.code}`} required>
          <Select id={`hs-st-${hs.code}`} name="status" defaultValue={hs.status} options={HS_STATUSES.map((s) => ({ value: s, label: t(HS_STATUS_LABEL[s]) }))} />
        </Field>
        <Field label={t('Passed on')} htmlFor={`hs-on-${hs.code}`}>
          <Input id={`hs-on-${hs.code}`} name="passedOn" type="date" defaultValue={hs.passedOn ?? ''} />
        </Field>
        <Field label={t('Evidence')} htmlFor={`hs-ev-${hs.code}`} span="full" hint={t('Vigie or Codex reference of the report')}>
          <Input id={`hs-ev-${hs.code}`} name="evidenceRef" defaultValue={hs.evidenceRef ?? ''} />
        </Field>
        <Field label={t('Note')} htmlFor={`hs-note-${hs.code}`} span="full" hint={t('Required when the milestone is waived')}>
          <Textarea id={`hs-note-${hs.code}`} name="note" rows={2} defaultValue={hs.note ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
