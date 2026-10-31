'use client';
// Advanced signature forms (AR-037): the signer's buttons on the gate page (continue at the provider, check, cancel) and the
// simulated provider's page (sign or decline, then back to Arche as from the provider).
import { useActionState } from 'react';
import { Result, type ActionResult } from '@/components/app/ActionForm';
import s from '@/components/app/ActionForm.module.css';
import { Button } from '@/components/ds/Button';
import { useI18n } from '@/i18n/client';
import { cancelSignatureAction, finishSignatureAction, simulateSignatureAction } from './signature';

export function SignatureRequestActions({ requestId, signingUrl }: { requestId: string; signingUrl: string | null }) {
  const { t } = useI18n();
  const [checked, check, checking] = useActionState(() => finishSignatureAction(requestId), null as ActionResult | null);
  const [cancelled, cancel, cancelling] = useActionState(() => cancelSignatureAction(requestId), null as ActionResult | null);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {signingUrl && <a href={signingUrl}>{t('Continue at the provider')}</a>}
      <form action={check}><Button type="submit" size="sm" disabled={checking}>{t('Check the signature')}</Button></form>
      <form action={cancel}><Button type="submit" size="sm" variant="ghost" disabled={cancelling}>{t('Cancel')}</Button></form>
      <Result state={checked} done="Signed" />
      <Result state={cancelled} done="Cancelled" />
    </div>
  );
}

export function SimulatedSignForm({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const [state, run, pending] = useActionState(async (_p: ActionResult | null, fd: FormData) => {
    const r = await simulateSignatureAction(requestId, fd.get('outcome') === 'declined' ? 'declined' : 'signed');
    // The return route is a Route Handler (as from the provider): a full navigation.
    if (r.ok) window.location.assign(new URL(`/signature/${requestId}/return`, window.location.origin).href);
    return r;
  }, null);
  return (
    <form action={run} className={s.form}>
      <div className={s.actions}>
        <Button type="submit" name="outcome" value="signed" variant="primary" disabled={pending}>{t('Sign')}</Button>
        <Button type="submit" name="outcome" value="declined" variant="ghost" disabled={pending}>{t('Decline')}</Button>
        <Result state={state} done="Recorded" />
      </div>
    </form>
  );
}
