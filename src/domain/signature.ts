// Advanced electronic signature (AR-037, C-7): which signature is advanced, and the states of a request at the provider. The
// G2 decision (the AFE) is signed at the advanced level once a provider is configured; every other signature stays simple
// (spec 05 §3). Pure.
import type { StepKind } from './circuits';

export type SignatureProviderName = 'none' | 'simulation' | 'yousign';
export type ProviderStatus = 'pending' | 'signed' | 'declined' | 'expired' | 'cancelled';
export type RequestStatus = 'creating' | 'pending' | 'completed' | 'declined' | 'expired' | 'cancelled' | 'failed';

/** The deciding signature of the G2 (signed by the CEO: the AFE) is advanced when a provider is configured. */
export function isAdvancedStep(provider: SignatureProviderName, gate: string, step: { kind: StepKind | string; decides: boolean }): boolean {
  return provider !== 'none' && gate === 'G2' && step.kind === 'signature' && step.decides;
}

/** A request still under way: one at a time per step. */
export const isOpenRequest = (s: RequestStatus) => s === 'creating' || s === 'pending';

/** The status of a Yousign signature request (API v3) as Arche reads it. */
export function yousignStatus(status: string): ProviderStatus {
  switch (status) {
    case 'done': return 'signed';
    case 'declined': case 'rejected': return 'declined';
    case 'expired': return 'expired';
    case 'canceled': case 'deleted': return 'cancelled';
    default: return 'pending';
  }
}

/** The request once the provider's status is known: the step is completed by Arche on `signed`. */
export function requestStatusOf(p: ProviderStatus): RequestStatus {
  return p === 'signed' || p === 'pending' ? 'pending' : p;
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  creating: 'Being prepared', pending: 'Waiting for the signature', completed: 'Signed', declined: 'Declined', expired: 'Expired', cancelled: 'Cancelled', failed: 'Failed',
};

/** First and last name of a display name, for the provider ("Henri Valette" → Henri / Valette). */
export function splitName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1)! } : { firstName: parts[0] || '-', lastName: parts[0] || '-' };
}
