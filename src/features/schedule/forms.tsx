'use client';
// WBS forms (owner's pilot feedback, 24 Oct 2026): add or edit a task — lot, dates (one date for a milestone), progress,
// owner — and remove it. The Server Functions check everything again.
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select } from '@/components/ds/Field';
import { useI18n } from '@/i18n/client';
import { deleteTaskAction, saveTaskAction } from './actions';

type Opt = { value: string; label: string };

export interface TaskValues {
  id: string;
  lotId: string | null;
  name: string;
  startOn: string;
  endOn: string;
  progressPct: number;
  ownerUserId: string | null;
  milestone: boolean;
}

export function TaskForm({ code, lots, people, task, lotId, primary }: { code: string; lots: Opt[]; people: Opt[]; task?: TaskValues; lotId?: string | null; primary?: boolean }) {
  const { t } = useI18n();
  const p = task?.id ?? `new-${lotId ?? 'capex'}`;
  return (
    <Folded summary={task ? 'Edit' : 'Add a task'} title={task ? 'Edit the task' : 'Add a task'} variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'sm'}>
      <ActionForm action={(prev, fd) => saveTaskAction(code, task?.id ?? null, prev, fd)} submit={task ? 'Save' : 'Add the task'} done="Saved">
        <Field label={t('Task')} htmlFor={`wt-n-${p}`} required span="full">
          <Input id={`wt-n-${p}`} name="name" defaultValue={task?.name} required />
        </Field>
        <Field label={t('Lot')} htmlFor={`wt-l-${p}`}>
          <Select id={`wt-l-${p}`} name="lotId" defaultValue={task?.lotId ?? lotId ?? ''} options={[{ value: '', label: t('CAPEX (no lot)') }, ...lots]} />
        </Field>
        <Field label={t('Owner')} htmlFor={`wt-o-${p}`}>
          <Select id={`wt-o-${p}`} name="ownerUserId" defaultValue={task?.ownerUserId ?? ''} options={[{ value: '', label: '—' }, ...people]} />
        </Field>
        <Field label={t('Start')} htmlFor={`wt-s-${p}`} required>
          <Input id={`wt-s-${p}`} name="startOn" type="date" defaultValue={task?.startOn} required />
        </Field>
        <Field label={t('End')} htmlFor={`wt-e-${p}`} hint={t('Not needed for a milestone')}>
          <Input id={`wt-e-${p}`} name="endOn" type="date" defaultValue={task?.endOn} />
        </Field>
        <Field label={t('Progress (%)')} htmlFor={`wt-p-${p}`}>
          <Input id={`wt-p-${p}`} name="progressPct" inputMode="decimal" defaultValue={task ? String(task.progressPct) : '0'} />
        </Field>
        <Field label={t('Milestone')} htmlFor={`wt-m-${p}`}>
          <input id={`wt-m-${p}`} type="checkbox" name="milestone" defaultChecked={task?.milestone} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function DeleteTaskButton({ code, id }: { code: string; id: string }) {
  return <ActionButton run={() => deleteTaskAction(code, id)} label="Remove" done="Removed" variant="ghost" />;
}
