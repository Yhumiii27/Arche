'use client';
// Ideas backlog forms (AR-051): propose an idea, decide on it. The Server Functions check everything again.
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { INVESTMENT_TYPE_LABEL } from '@/domain/capex-labels';
import { INVESTMENT_TYPES } from '@/domain/capex';
import { IDEA_DECISION_LABEL, type IdeaDecision } from '@/domain/ideas';
import { useI18n } from '@/i18n/client';
import { decideIdeaAction, proposeIdeaAction } from './actions';

export function ProposeIdeaForm({ subsidiaries, initial }: { subsidiaries: { value: string; label: string }[]; initial: string | null }) {
  const { t } = useI18n();
  return (
    <Folded summary="Propose an idea" variant="primary">
      <ActionForm action={proposeIdeaAction} submit="Propose the idea" done="Proposed">
        <Field label={t('Subsidiary')} htmlFor="id-sub" required>
          <Select id="id-sub" name="subsidiaryCode" defaultValue={initial ?? subsidiaries[0]?.value} options={subsidiaries} />
        </Field>
        <Field label={t('Investment type')} htmlFor="id-type">
          <Select id="id-type" name="investmentType" options={[{ value: '', label: '—' }, ...INVESTMENT_TYPES.map((x) => ({ value: x, label: t(INVESTMENT_TYPE_LABEL[x]) }))]} />
        </Field>
        <Field label={t('Title')} htmlFor="id-title" required span="full">
          <Input id="id-title" name="title" required />
        </Field>
        <Field label={t('Stake')} htmlFor="id-stake" required span="full" hint={t('The need, what it brings, why now')}>
          <Textarea id="id-stake" name="stake" rows={4} required />
        </Field>
        <Field label={t('Order of magnitude (k€)')} htmlFor="id-size">
          <Input id="id-size" name="sizeKeur" inputMode="decimal" />
        </Field>
      </ActionForm>
    </Folded>
  );
}

export function DecideIdeaForm({ id, label, decisions }: { id: string; label: string; decisions: IdeaDecision[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Decide" title={label}>
      <ActionForm action={(p, fd) => decideIdeaAction(id, p, fd)} submit="Record the decision" done="Recorded">
        <Field label={t('Decision')} htmlFor={`idd-${id}`} required>
          <Select id={`idd-${id}`} name="decision" options={decisions.map((d) => ({ value: d, label: t(IDEA_DECISION_LABEL[d]) }))} />
        </Field>
        <Field label={t('Why')} htmlFor={`idn-${id}`} span="full" hint={t('Required to set an idea aside')}>
          <Textarea id={`idn-${id}`} name="note" rows={3} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
