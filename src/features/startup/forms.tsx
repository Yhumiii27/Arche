'use client';
// Start-up forms (delivery 6): start of commissioning, production line, a day of ramp-up, the CSV import, the accounting
// closure statement, a lesson learned and its publication. The Server Functions check everything again.
import { useState } from 'react';
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { REX_CATEGORIES, REX_CATEGORY_LABEL, type RexCategory } from '@/domain/closure';
import { PHASES } from '@/domain/lifecycle';
import { PHASE_LABEL } from '@/domain/capex-labels';
import { RAMPUP_CSV_HEADER } from '@/domain/rampup';
import { useI18n } from '@/i18n/client';
import { importRampupAction, publishRexAction, saveClosureAction, saveLineAction, saveRampupDayAction, saveRexAction, startMesAction } from './actions';

export function StartMesForm({ code, today }: { code: string; today: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Start commissioning" variant="primary" size="md">
      <ActionForm action={(prev, fd) => startMesAction(code, prev, fd)} submit="Record the start" done="Commissioning started">
        <Field label={t('Start of commissioning')} htmlFor="mes-day" required hint={t('After the PSSR, before fluids or materials are introduced')}>
          <Input id="mes-day" name="day" type="date" defaultValue={today} max={today} required />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export interface LineValues {
  id: string;
  name: string;
  nominalPerDay: number;
  unit: string;
  scrapTargetPct: number;
  machineNumbers: string[];
}

export function LineForm({ code, line, machines }: { code: string; line?: LineValues; machines: string[] }) {
  const { t } = useI18n();
  const p = line?.id ?? 'new';
  return (
    <Folded summary={line ? 'Edit' : 'Add a production line'}>
      <ActionForm action={(prev, fd) => saveLineAction(code, line?.id ?? null, prev, fd)} submit={line ? 'Save' : 'Add the line'} done="Saved">
        <Field label={t('Production line')} htmlFor={`ln-name-${p}`} required span="full">
          <Input id={`ln-name-${p}`} name="name" defaultValue={line?.name} required />
        </Field>
        <Field label={t('Nominal capacity per day')} htmlFor={`ln-cap-${p}`} required>
          <Input id={`ln-cap-${p}`} name="nominalPerDay" inputMode="decimal" defaultValue={line ? String(line.nominalPerDay) : ''} required />
        </Field>
        <Field label={t('Unit')} htmlFor={`ln-unit-${p}`} required>
          <Input id={`ln-unit-${p}`} name="unit" defaultValue={line?.unit ?? 't'} required />
        </Field>
        <Field label={t('Scrap target (%)')} htmlFor={`ln-scrap-${p}`} required>
          <Input id={`ln-scrap-${p}`} name="scrapTargetPct" inputMode="decimal" defaultValue={line ? String(line.scrapTargetPct) : ''} required />
        </Field>
        <Field label={t('Machines (Keystone numbers)')} htmlFor={`ln-mch-${p}`} span="full" hint={machines.length ? `${t('Delivered by EPC2i')} — ${machines.join(', ')}` : t('Separated by commas')}>
          <Input id={`ln-mch-${p}`} name="machineNumbers" defaultValue={line?.machineNumbers.join(', ') ?? machines.join(', ')} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function DayForm({ code, lineId, label, today }: { code: string; lineId: string; label: string; today: string }) {
  const { t } = useI18n();
  const p = lineId;
  return (
    <Folded summary="Enter a day" title={label} variant="primary">
      <ActionForm action={(prev, fd) => saveRampupDayAction(code, lineId, prev, fd)} submit="Save" done="Saved">
        <Field label={t('Day')} htmlFor={`d-day-${p}`} required>
          <Input id={`d-day-${p}`} name="day" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label={t('Planned stop')} htmlFor={`d-stop-${p}`}>
          <input id={`d-stop-${p}`} type="checkbox" name="plannedStop" />
        </Field>
        <Field label={t('Output')} htmlFor={`d-out-${p}`}>
          <Input id={`d-out-${p}`} name="output" inputMode="decimal" />
        </Field>
        <Field label={t('Scrap (%)')} htmlFor={`d-scrap-${p}`}>
          <Input id={`d-scrap-${p}`} name="scrapPct" inputMode="decimal" />
        </Field>
        <Field label={t('OEE (%)')} htmlFor={`d-oee-${p}`} hint={t('Or availability, performance and quality: OEE = A × P × Q')}>
          <Input id={`d-oee-${p}`} name="oeePct" inputMode="decimal" />
        </Field>
        <Field label={t('Availability (%)')} htmlFor={`d-a-${p}`}>
          <Input id={`d-a-${p}`} name="availabilityPct" inputMode="decimal" />
        </Field>
        <Field label={t('Performance (%)')} htmlFor={`d-p-${p}`}>
          <Input id={`d-p-${p}`} name="performancePct" inputMode="decimal" />
        </Field>
        <Field label={t('Quality (%)')} htmlFor={`d-q-${p}`}>
          <Input id={`d-q-${p}`} name="qualityPct" inputMode="decimal" />
        </Field>
      </ActionForm>
    </Folded>
  );
}

/** Import: the file is read in the browser and sent as text (Arche stores no file). */
export function ImportRampupForm({ code }: { code: string }) {
  const { t } = useI18n();
  const [csv, setCsv] = useState('');
  return (
    <Folded summary="Import a CSV file" title="Import ramp-up days">
      <ActionForm action={(prev, fd) => importRampupAction(code, prev, fd)} submit="Import" done="Imported">
        <Field label={t('File')} htmlFor="ru-file" span="full" hint={`${t('Arche template, one line per production line and day')} — ${RAMPUP_CSV_HEADER}`}>
          <input id="ru-file" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        </Field>
        <Field label={t('Content')} htmlFor="ru-csv" span="full">
          <Textarea id="ru-csv" name="csv" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={`${RAMPUP_CSV_HEADER}\n1;2026-10-01;95;;;;78;1,2;`} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function ClosureForm({ code, lots, statement }: { code: string; lots: { id: string; label: string; finalKeur: number | null }[]; statement: { afeBalanceKeur: number; note: string | null } | null }) {
  const { t } = useI18n();
  return (
    <Folded summary={statement ? 'Edit the statement' : 'Enter the closure statement'} variant="primary">
      <ActionForm action={(prev, fd) => saveClosureAction(code, prev, fd)} submit="Save" done="Saved">
        {lots.map((l) => (
          <Field key={l.id} label={`${l.label} (k€)`} htmlFor={`cl-${l.id}`} required>
            <Input id={`cl-${l.id}`} name={`lot:${l.id}`} inputMode="decimal" defaultValue={l.finalKeur != null ? String(l.finalKeur) : ''} required />
          </Field>
        ))}
        <Field label={t('AFE balance (k€)')} htmlFor="cl-afe" required hint={t('Negative when the AFE is overrun')}>
          <Input id="cl-afe" name="afeBalanceKeur" inputMode="decimal" defaultValue={statement ? String(statement.afeBalanceKeur) : ''} required />
        </Field>
        <Field label={t('Note')} htmlFor="cl-note" span="full">
          <Textarea id="cl-note" name="note" rows={2} defaultValue={statement?.note ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export interface RexValues {
  id: string;
  phase: string;
  category: RexCategory;
  title: string;
  text: string;
  recommendation: string | null;
}

export function RexForm({ code, rex, phase }: { code: string; rex?: RexValues; phase: string }) {
  const { t } = useI18n();
  const p = rex?.id ?? 'new';
  return (
    <Folded summary={rex ? 'Edit' : 'Add a lesson'}>
      <ActionForm action={(prev, fd) => saveRexAction(code, rex?.id ?? null, prev, fd)} submit={rex ? 'Save' : 'Add the lesson'} done="Saved">
        <Field label={t('Phase')} htmlFor={`rx-ph-${p}`} required>
          <Select id={`rx-ph-${p}`} name="phase" defaultValue={rex?.phase ?? phase} options={PHASES.map((ph) => ({ value: ph, label: t(PHASE_LABEL[ph]) }))} />
        </Field>
        <Field label={t('Category')} htmlFor={`rx-cat-${p}`} required>
          <Select id={`rx-cat-${p}`} name="category" defaultValue={rex?.category} options={REX_CATEGORIES.map((c) => ({ value: c, label: t(REX_CATEGORY_LABEL[c]) }))} />
        </Field>
        <Field label={t('Title')} htmlFor={`rx-title-${p}`} required span="full">
          <Input id={`rx-title-${p}`} name="title" defaultValue={rex?.title} required />
        </Field>
        <Field label={t('Lesson')} htmlFor={`rx-text-${p}`} required span="full">
          <Textarea id={`rx-text-${p}`} name="text" rows={4} defaultValue={rex?.text} required />
        </Field>
        <Field label={t('Recommendation')} htmlFor={`rx-rec-${p}`} span="full" hint={t('What to do next time (optional)')}>
          <Textarea id={`rx-rec-${p}`} name="recommendation" rows={2} defaultValue={rex?.recommendation ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function PublishRexButton({ code, rexId }: { code: string; rexId: string }) {
  return <ActionButton run={() => publishRexAction(code, rexId)} label="Publish" done="Published" variant="ghost" />;
}
