'use client';
// Sage connector forms (AR-047). The Server Functions check everything again.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input } from '@/components/ds/Field';
import { SAGE_HEADER } from '@/domain/sage';
import { useI18n } from '@/i18n/client';
import { importSageAction, loadDemoSageAction, setSageCodeAction } from './actions';

export function SageImportForm({ subsidiaryCode }: { subsidiaryCode: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Import a Sage extraction" variant="primary">
      <ActionForm action={(p, fd) => importSageAction(subsidiaryCode, p, fd)} submit="Import" done="Imported">
        <Field label={t('Extraction file (CSV)')} htmlFor="sg-file" required span="full" hint={`${t('First line')}: ${SAGE_HEADER}`}>
          <Input id="sg-file" name="file" type="file" accept=".csv,text/csv" required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function DemoSageButton({ subsidiaryCode }: { subsidiaryCode: string }) {
  return <ActionButton run={() => loadDemoSageAction(subsidiaryCode)} label="Load the demonstration extraction" done="Imported" />;
}

export function SageCodeForm({ code, lotId, value, label }: { code: string; lotId: string; value: string | null; label: string }) {
  const { t } = useI18n();
  return (
    <Folded summary={value ? 'Change the code' : 'Set the code'} title={label}>
      <ActionForm action={(p, fd) => setSageCodeAction(code, lotId, p, fd)} submit="Save the code" done="Saved">
        <Field label={t('Sage analytic code')} htmlFor={`sc-${lotId}`} hint={t('Empty: the lot takes no line of the extraction')}>
          <Input id={`sc-${lotId}`} name="sageCode" defaultValue={value ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
