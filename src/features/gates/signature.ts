'use server';
// Advanced signature of the G2 / AFE, Server Functions (AR-037): the signer comes back from the provider and the step is
// completed with the choices kept in the request (checked again: the circuit, the signer's right and the decision); the
// signer cancels a request under way; in the simulation, the page standing for the provider signs or declines.
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { ProviderStatus } from '@/domain/signature';
import { getConfig } from '@/server/config';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { signatureRequests } from '@/server/db/schema';
import { auditOf, onCapex, REFUSED, type ActionResult } from '@/server/capex/write';
import { applyStep, planStep, stepForActor, type StepInput } from '@/server/cycle/step';
import { cancelAtProvider, providerStatusOf, whereOf } from '@/server/signature/advanced';

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || null;
  return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;
}

async function requestOf(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = await getDb();
  const [req] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, id));
  const where = req ? await whereOf(db, req) : null;
  return req && where ? { req, where } : null;
}

/** Completes the step once the provider says signed; otherwise records what the provider says. */
export async function finishSignatureAction(requestId: string): Promise<ActionResult> {
  const found = await requestOf(requestId);
  if (!found) return { ok: false, error: 'Unknown signature request' };
  let provider: ProviderStatus;
  try {
    provider = await providerStatusOf(found.req);
  } catch {
    return { ok: false, error: 'The signature provider could not be reached; try again later' };
  }
  const ip = await clientIp();
  return onCapex(found.where.code, null, async (tx, c, v, today) => {
    const [r] = await tx.select().from(signatureRequests).where(eq(signatureRequests.id, requestId));
    if (!r || r.signerUserId !== v.userId) return REFUSED;
    if (r.status === 'completed') return { ok: true };
    if (r.status !== 'pending') return { ok: false, error: 'This signature request is closed' };
    if (provider !== 'signed') {
      if (provider !== 'pending') await tx.update(signatureRequests).set({ status: provider, providerStatus: provider, updatedAt: new Date() }).where(eq(signatureRequests.id, r.id));
      return { ok: false, error: provider === 'pending' ? 'The signature is not finished at the provider yet' : 'The signature was declined, cancelled or expired at the provider' };
    }
    const who = await stepForActor(tx, c, v, r.circuitStepId, today);
    if (!who.ok) return who;
    if (who.row.status !== 'open') return { ok: false, error: 'This step is not open' };
    const input = r.input as StepInput;
    const planned = await planStep(tx, c, who.row, who.g, input);
    if (!planned.ok) return planned;
    const done = await applyStep(tx, c, v, today, who.row, who.g, planned.plan, input, { onBehalfOf: who.onBehalfOf, ipHash: ip, level: 'advanced', providerRef: `${r.provider}:${r.providerRef}` });
    if (!done.ok) return done;
    await tx.update(signatureRequests).set({ status: 'completed', providerStatus: 'signed', completedAt: new Date(), updatedAt: new Date() }).where(eq(signatureRequests.id, r.id));
    return { ok: true, code: c.code };
  });
}

/** The signer cancels a request under way (at the provider too, when it can be reached). */
export async function cancelSignatureAction(requestId: string): Promise<ActionResult> {
  const found = await requestOf(requestId);
  if (!found) return { ok: false, error: 'Unknown signature request' };
  const r = await onCapex(found.where.code, null, async (tx, c, v) => {
    const [x] = await tx.select().from(signatureRequests).where(eq(signatureRequests.id, requestId));
    if (!x || x.signerUserId !== v.userId) return REFUSED;
    if (x.status !== 'pending' && x.status !== 'creating') return { ok: false, error: 'This signature request is closed' };
    await tx.update(signatureRequests).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(signatureRequests.id, x.id));
    await writeAudit(tx, auditOf(v, c, 'Advanced signature cancelled by the signer', { entityType: 'signature_request', entityId: x.id }));
    return { ok: true };
  });
  if (r.ok) await cancelAtProvider(found.req);
  return r;
}

/** Simulation of the provider (ARCHE_SIGNATURE_PROVIDER=simulation): the signer signs or declines on Arche's page. */
export async function simulateSignatureAction(requestId: string, outcome: 'signed' | 'declined'): Promise<ActionResult> {
  const found = await requestOf(requestId);
  if (!found || found.req.provider !== 'simulation' || getConfig().signature.provider !== 'simulation') return { ok: false, error: 'Unknown signature request' };
  if (outcome !== 'signed' && outcome !== 'declined') return { ok: false, error: 'Unknown outcome' };
  return onCapex(found.where.code, null, async (tx, _c, v) => {
    const [x] = await tx.select().from(signatureRequests).where(eq(signatureRequests.id, requestId));
    if (!x || x.signerUserId !== v.userId) return REFUSED;
    if (x.status !== 'pending') return { ok: false, error: 'This signature request is closed' };
    await tx.update(signatureRequests).set({ providerStatus: outcome, updatedAt: new Date() }).where(eq(signatureRequests.id, x.id));
    return { ok: true };
  });
}
