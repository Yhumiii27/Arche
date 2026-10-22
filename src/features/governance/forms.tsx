'use client';
// Review form (docs/spec/06 §2): a project steering committee or, on a Strategic CAPEX, a cross-functional audit (N-19).
import { ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { REVIEW_KIND_LABEL, type ReviewKind } from '@/domain/governance';
import { useI18n } from '@/i18n/client';
import { recordReviewAction } from './actions';

export function ReviewForm({ code, kinds, today, primary }: { code: string; kinds: ReviewKind[]; today: string; primary?: boolean }) {
  const { t } = useI18n();
  return (
    <Folded summary="Record a review" variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'sm'}>
      <ActionForm action={(prev, fd) => recordReviewAction(code, prev, fd)} submit="Record" done="Review recorded">
        <Field label={t('Kind')} htmlFor="rv-kind" required>
          <Select id="rv-kind" name="kind" options={kinds.map((k) => ({ value: k, label: t(REVIEW_KIND_LABEL[k]) }))} />
        </Field>
        <Field label={t('Held on')} htmlFor="rv-on" required>
          <Input id="rv-on" name="heldOn" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label={t('Attendees')} htmlFor="rv-att" required span="full">
          <Input id="rv-att" name="attendees" required />
        </Field>
        <Field label={t('Summary')} htmlFor="rv-sum" required span="full">
          <Textarea id="rv-sum" name="summary" rows={4} required />
        </Field>
        <Field label={t('Decisions')} htmlFor="rv-dec" span="full" hint={t('One decision per line; each goes to the decisions register')}>
          <Textarea id="rv-dec" name="decisions" rows={3} />
        </Field>
      </ActionForm>
    </Folded>
  );
}
