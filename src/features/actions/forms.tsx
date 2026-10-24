'use client';
// Action plan forms (owner's pilot feedback, 24 Oct 2026): "New action" — in the header of every CAPEX page, its source set
// from the page —, edit an open action, close it (done, or cancelled with a reason). The Server Functions check everything
// again.
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { ACTION_SOURCES, ACTION_SOURCE_LABEL, type ActionSource } from '@/domain/actions';
import { useI18n } from '@/i18n/client';
import { closeActionAction, saveActionAction } from './actions';

type Opt = { value: string; label: string };

export interface ActionValues {
  id: string;
  title: string;
  description: string | null;
  source: ActionSource;
  sourceRef: string | null;
  ownerUserId: string | null;
  dueOn: string | null;
}

export function ActionFormPanel({ code, people, source = 'general', action, primary }: { code: string; people: Opt[]; source?: ActionSource; action?: ActionValues; primary?: boolean }) {
  const { t } = useI18n();
  const p = action?.id ?? `new-${source}`;
  return (
    <Folded summary={action ? 'Edit' : 'New action'} title={action ? 'Edit the action' : 'New action'} size={primary ? 'md' : 'sm'}>
      <ActionForm action={(prev, fd) => saveActionAction(code, action?.id ?? null, prev, fd)} submit={action ? 'Save' : 'Open the action'} done="Saved">
        <Field label={t('Action')} htmlFor={`ac-t-${p}`} required span="full">
          <Input id={`ac-t-${p}`} name="title" defaultValue={action?.title} required />
        </Field>
        <Field label={t('Owner')} htmlFor={`ac-o-${p}`}>
          <Select id={`ac-o-${p}`} name="ownerUserId" defaultValue={action?.ownerUserId ?? ''} options={[{ value: '', label: '—' }, ...people]} />
        </Field>
        <Field label={t('Due date')} htmlFor={`ac-d-${p}`}>
          <Input id={`ac-d-${p}`} name="dueOn" type="date" defaultValue={action?.dueOn ?? ''} />
        </Field>
        <Field label={t('Comes from')} htmlFor={`ac-s-${p}`}>
          <Select id={`ac-s-${p}`} name="source" defaultValue={action?.source ?? source} options={ACTION_SOURCES.map((x) => ({ value: x, label: t(ACTION_SOURCE_LABEL[x]) }))} />
        </Field>
        <Field label={t('Element')} htmlFor={`ac-r-${p}`} hint={t('A risk, a gate, a review… (e.g. R-02)')}>
          <Input id={`ac-r-${p}`} name="sourceRef" defaultValue={action?.sourceRef ?? ''} />
        </Field>
        <Field label={t('Description')} htmlFor={`ac-x-${p}`} span="full">
          <Textarea id={`ac-x-${p}`} name="description" rows={3} defaultValue={action?.description ?? ''} />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function CloseActionForm({ code, id }: { code: string; id: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Close the action">
      <ActionForm action={async (_p, fd) => closeActionAction(code, id, fd.get('outcome') === 'cancelled' ? 'cancelled' : 'done', String(fd.get('note') ?? ''))} submit="Close the action" done="Saved">
        <Field label={t('Outcome')} htmlFor={`cl-o-${id}`} required>
          <Select id={`cl-o-${id}`} name="outcome" defaultValue="done" options={[{ value: 'done', label: t('Done') }, { value: 'cancelled', label: t('Cancelled') }]} />
        </Field>
        <Field label={t('Note')} htmlFor={`cl-n-${id}`} span="full" hint={t('Required for a cancellation')}>
          <Textarea id={`cl-n-${id}`} name="note" rows={2} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
