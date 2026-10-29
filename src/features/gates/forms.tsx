'use client';
// Gate circuit forms (client islands of the Gates page): submitting the gate, acting on a step. A signed step asks the
// signer to confirm the statement; when the sign-in is too old, the form offers to sign in again (N-8).
import { useActionState } from 'react';
import { Result, type ActionResult } from '@/components/app/ActionForm';
import s from '@/components/app/ActionForm.module.css';
import { Button } from '@/components/ds/Button';
import { Field, Input, Select, Textarea } from '@/components/ds/Field';
import { OUTCOME_LABEL, REAUTH_ERROR, type Outcome } from '@/domain/circuits';
import { useI18n } from '@/i18n/client';
import { ROW_VERSION_FIELD } from '@/domain/concurrency';
import { actOnStepAction, submitGateAction } from './actions';

type Opt = { value: string; label: string };

export function SubmitGateForm({ code, gate, experts }: { code: string; gate: string; experts: { speciality: string; label: string; options: Opt[] }[] }) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState((p: ActionResult | null, fd: FormData) => submitGateAction(code, p, fd), null);
  return (
    <form action={run} className={s.form}>
      {experts.map((e) => (
        <Field key={e.speciality} label={`${t(e.label)} — ${t('expert named')}`} htmlFor={`ex-${e.speciality}`}>
          <Select id={`ex-${e.speciality}`} name={`expert:${e.speciality}`} options={[{ value: '', label: t('Any qualified person') }, ...e.options]} />
        </Field>
      ))}
      <div className={s.actions}>
        <Button type="submit" variant="primary" disabled={pending}>{`${t('Submit')} ${gate}`}</Button>
        <Result state={state} done="Submitted" />
      </div>
    </form>
  );
}

export interface StepFormProps {
  code: string;
  stepId: string;
  /** Optimistic lock (AR-049). */
  rowVersion: number;
  outcomes: readonly Outcome[];
  signed: boolean;
  /** The statement the signer confirms (typed data and codes, shown as is). */
  statement: string;
  decides: boolean;
  /** Blocking criteria not met that the decider may force with a reason. */
  forcible: { code: string; label: string }[];
  /** Reservations of the opinions, proposed as conditions. */
  proposed: string;
  returnTo: string;
}

export function StepForm({ code, stepId, rowVersion, outcomes, signed, statement, decides, forcible, proposed, returnTo }: StepFormProps) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState((p: ActionResult | null, fd: FormData) => actOnStepAction(code, stepId, p, fd), null);
  return (
    <form action={run} className={s.form}>
      <input type="hidden" name={ROW_VERSION_FIELD} value={rowVersion} readOnly />
      <Field label={t('Outcome')} htmlFor={`o-${stepId}`} required>
        <Select id={`o-${stepId}`} name="outcome" options={outcomes.map((o) => ({ value: o, label: t(OUTCOME_LABEL[o]) }))} />
      </Field>
      <Field label={t('Comment or reason')} htmlFor={`c-${stepId}`}>
        <Input id={`c-${stepId}`} name="comment" />
      </Field>
      {decides && outcomes.includes('go_with_conditions') && (
        <Field label={t('Conditions (one per line)')} htmlFor={`cd-${stepId}`} span="full">
          <Textarea id={`cd-${stepId}`} name="conditions" rows={2} defaultValue={proposed} />
        </Field>
      )}
      {decides && forcible.map((f) => (
        <Field key={f.code} label={`${t('Force')} — ${t(f.label)}`} htmlFor={`f-${stepId}-${f.code}`} span="full" hint={t('Reason, audited')}>
          <Input id={`f-${stepId}-${f.code}`} name={`force:${f.code}`} />
        </Field>
      ))}
      {signed && (
        <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5 }}>
          <input type="checkbox" name="confirm" required />
          <span>
            {t('I sign:')} <span className="text-muted">{statement}</span>
          </span>
        </label>
      )}
      <div className={s.actions}>
        <Button type="submit" variant="primary" disabled={pending}>{t(signed ? 'Sign' : 'Record')}</Button>
        <Result state={state} done="Recorded" />
        {state && !state.ok && state.error === REAUTH_ERROR && (
          <a href={`/api/auth/sign-in?reauth=1&returnTo=${encodeURIComponent(returnTo)}`}>{t('Sign in again')}</a>
        )}
      </div>
    </form>
  );
}
