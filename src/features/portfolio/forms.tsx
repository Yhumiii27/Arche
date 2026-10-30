'use client';
// Portfolio decisions forms (delivery 7, lot 7c): the weights of the prioritisation grid and a CAPEX's scores (AR-044), a new
// scenario and the CAPEX it keeps, leaves out or shifts (AR-043). The Server Functions check everything again.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { SCENARIO_KINDS, SCENARIO_KIND_LABEL } from '@/domain/scenarios';
import { MANUAL_CRITERIA, SCORING_CRITERIA } from '@/domain/scoring';
import { useI18n } from '@/i18n/client';
import { createScenarioAction, retainScenarioAction, saveWeightsAction, scoreCapexAction, updateScenarioAction } from './actions';

export function WeightsForm({ weights }: { weights: Record<string, number> }) {
  const { t } = useI18n();
  return (
    <Folded summary="Weights of the grid">
      <ActionForm action={saveWeightsAction} submit="Save the weights" done="Saved">
        {SCORING_CRITERIA.map((c) => (
          <Field key={c.code} label={t(c.label)} htmlFor={`w-${c.code}`} hint={t(c.kind === 'computed' ? 'Computed' : 'Scored by the group')}>
            <Input id={`w-${c.code}`} name={`weight:${c.code}`} type="number" min={0} max={100} step={1} defaultValue={weights[c.code]} required />
          </Field>
        ))}
      </ActionForm>
    </Folded>
  );
}

export function ScoreForm({ code, values }: { code: string; values: Record<string, { score: number | null; note: string | null }> }) {
  const { t } = useI18n();
  return (
    <Folded summary="Score the CAPEX">
      <ActionForm action={(p, fd) => scoreCapexAction(code, p, fd)} submit="Save the scores" done="Saved">
        {MANUAL_CRITERIA.map((c) => (
          <div key={c.code} style={{ display: 'contents' }}>
            <Field label={`${t(c.label)} (0–5)`} htmlFor={`sc-${c.code}`}>
              <Input id={`sc-${c.code}`} name={`score:${c.code}`} type="number" min={0} max={5} step={1} defaultValue={values[c.code]?.score ?? ''} />
            </Field>
            <Field label={t('Why')} htmlFor={`sn-${c.code}`}>
              <Input id={`sn-${c.code}`} name={`note:${c.code}`} defaultValue={values[c.code]?.note ?? ''} />
            </Field>
          </div>
        ))}
      </ActionForm>
    </Folded>
  );
}

type Heading = { name: string; kind: string; description: string | null; envelopes: Record<string, number> };

function HeadingFields({ prefix, value, years }: { prefix: string; value?: Heading; years: number[] }) {
  const { t } = useI18n();
  return (
    <>
      <Field label={t('Name')} htmlFor={`${prefix}-name`} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={value?.name} required />
      </Field>
      <Field label={t('Kind')} htmlFor={`${prefix}-kind`} required>
        <Select id={`${prefix}-kind`} name="kind" defaultValue={value?.kind ?? 'base'} options={SCENARIO_KINDS.map((k) => ({ value: k, label: t(SCENARIO_KIND_LABEL[k]) }))} />
      </Field>
      <Field label={t('Description')} htmlFor={`${prefix}-desc`} span="full">
        <Textarea id={`${prefix}-desc`} name="description" rows={2} defaultValue={value?.description ?? ''} />
      </Field>
      {years.map((y) => (
        <Field key={y} label={`${t('Group envelope')} ${y} (k€)`} htmlFor={`${prefix}-env-${y}`}>
          <Input id={`${prefix}-env-${y}`} name={`env:${y}`} inputMode="decimal" defaultValue={value?.envelopes[String(y)] != null ? String(value.envelopes[String(y)]) : ''} />
        </Field>
      ))}
    </>
  );
}

export function NewScenarioForm({ years }: { years: number[] }) {
  return (
    <Folded summary="New scenario" variant="primary">
      <ActionForm action={createScenarioAction} submit="Create the scenario" done="Saved">
        <HeadingFields prefix="ns" years={years} />
      </ActionForm>
    </Folded>
  );
}

export function EditScenarioForm({ id, value, years, capex }: {
  id: string; value: Heading; years: number[];
  capex: { id: string; label: string; included: boolean; shiftMonths: number }[];
}) {
  const { t } = useI18n();
  return (
    <Folded summary="Edit the scenario" title={value.name}>
      <ActionForm action={(p, fd) => updateScenarioAction(id, p, fd)} submit="Save the scenario" done="Saved">
        <HeadingFields prefix={`es-${id}`} value={value} years={years} />
        <fieldset style={{ gridColumn: '1 / -1', border: 0, padding: 0, display: 'grid', gap: 6, fontSize: 12.5 }}>
          <legend style={{ marginBottom: 4 }}>{t('CAPEX kept, and the shift of their disbursements to come (months)')}</legend>
          {capex.map((c) => (
            <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" name={`keep:${c.id}`} defaultChecked={c.included} />
              <span style={{ flex: 1 }}>{c.label}</span>
              <input className="input" style={{ width: 80 }} type="number" min={-36} max={36} step={1} name={`shift:${c.id}`} defaultValue={c.shiftMonths} aria-label={t('Shift (months)')} />
            </label>
          ))}
        </fieldset>
      </ActionForm>
    </Folded>
  );
}

export function RetainScenarioButton({ id }: { id: string }) {
  return <ActionButton run={() => retainScenarioAction(id)} label="Retain for the COPIL GPI" done="Retained" />;
}
