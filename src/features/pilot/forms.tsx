'use client';
// Pilot forms (C-10): the reference of an indicator measured on the existing process. The Server Function checks it again.
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Textarea } from '@/components/ds/Field';
import { KPI_LABEL, KPI_UNIT, type KpiKey } from '@/domain/kpi';
import { useI18n } from '@/i18n/client';
import { saveBaselineAction } from './actions';

export function BaselineForm({ kpi, baseline, today }: { kpi: KpiKey; baseline: { value: number; source: string | null; measuredOn: string | null } | null; today: string }) {
  const { t } = useI18n();
  const p = kpi.replace(':', '-');
  return (
    <Folded summary={baseline ? 'Edit the reference' : 'Enter the reference'} title={KPI_LABEL[kpi]}>
      <ActionForm action={(prev, fd) => saveBaselineAction(kpi, prev, fd)} submit="Save" done="Saved">
        <Field label={`${t('Reference')} (${t(KPI_UNIT[kpi])})`} htmlFor={`kb-v-${p}`} required>
          <Input id={`kb-v-${p}`} name="value" inputMode="decimal" defaultValue={baseline ? String(baseline.value) : ''} required />
        </Field>
        <Field label={t('Measured on')} htmlFor={`kb-on-${p}`}>
          <Input id={`kb-on-${p}`} name="measuredOn" type="date" max={today} defaultValue={baseline?.measuredOn ?? ''} />
        </Field>
        <Field label={t('Source')} htmlFor={`kb-src-${p}`} span="full" hint={t('The survey of the existing process: period, CAPEX covered, how it was counted')}>
          <Textarea id={`kb-src-${p}`} name="source" rows={2} defaultValue={baseline?.source ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
