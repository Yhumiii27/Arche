import 'server-only';
// Advanced signature of the G2 / AFE (AR-037, C-7). The signer's choices are checked (src/server/cycle/step.ts planStep) and
// kept in a signature request; the investment dossier's frozen version, as the PDF Arche writes, is sent to the provider
// (Yousign) with the signer, who signs there (code by e-mail) and comes back to Arche; the step is then completed with the
// choices kept, and the signature row carries the provider's reference. The simulation stands for the provider with a page of
// Arche (demonstrations and tests). Arche keeps no file: the signed PDF and its audit trail are read from the provider.
import { and, eq, inArray } from 'drizzle-orm';
import { isOpenRequest, requestStatusOf, type ProviderStatus, type RequestStatus } from '@/domain/signature';
import { dossierDoc, printCtxOf } from '@/features/print/documents';
import { toPdf } from '@/lib/export/pdf';
import { getConfig } from '@/server/config';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { capex, circuitSteps, gates, signatureRequests, users } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';
import { auditOf, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { statementOf, type GateRecord, type StepInput, type StepPlan, type StepRecord } from '@/server/cycle/step';
import { yousignClient, type YousignClient } from '@/server/integrations/signature/yousign';

export type SignatureRequestRow = typeof signatureRequests.$inferSelect;

let testClient: YousignClient | null = null;
/** Tests replace the Yousign client. */
export function setYousignClientForTests(c: YousignClient | null) {
  testClient = c;
}

function yousign(): YousignClient {
  if (testClient) return testClient;
  const s = getConfig().signature;
  if (!s.yousignKey) throw new Error('ARCHE_YOUSIGN_API_KEY is not set');
  return yousignClient({ baseUrl: s.yousignUrl, apiKey: s.yousignKey });
}

const origin = () => getConfig().mail.publicUrl ?? '';

/** Opens the request in the transaction of the step (nothing else is written): one under way per step. */
export async function openSignatureRequest(
  tx: Tx, c: CapexRowFull, v: Viewer, row: StepRecord, g: GateRecord, plan: StepPlan, input: StepInput, onBehalfOf: string | null, provider: 'simulation' | 'yousign',
): Promise<ActionResult> {
  const open = (await tx.select().from(signatureRequests).where(eq(signatureRequests.circuitStepId, row.id))).filter((r) => isOpenRequest(r.status as RequestStatus));
  if (open.some((r) => r.signerUserId !== v.userId)) return { ok: false, error: 'Another person is signing this step' };
  // Starting again replaces the request the signer left unfinished.
  for (const r of open) await tx.update(signatureRequests).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(signatureRequests.id, r.id));
  const statement = statementOf(row, c, g, plan.version, input.outcome, onBehalfOf);
  const [req] = await tx.insert(signatureRequests).values({
    circuitStepId: row.id, provider, input, statement, contentHash: plan.version?.contentHash ?? null, signerUserId: v.userId, signerName: v.name, onBehalfOfName: onBehalfOf,
  }).returning({ id: signatureRequests.id });
  await writeAudit(tx, auditOf(v, c, `${g.code} session ${g.session}: advanced signature asked (${provider}) — ${input.outcome}`, { entityType: 'signature_request', entityId: req.id, reason: input.comment }));
  return { ok: true, requestId: req.id };
}

/** Sends the request to the provider (after the transaction): the signing link, or the request failed with its reason. */
export async function launchSignatureRequest(requestId: string): Promise<ActionResult> {
  const db = await getDb();
  const [req] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, requestId));
  if (!req) return { ok: false, error: 'Unknown signature request' };
  if (req.provider === 'simulation') {
    const url = `/signature/${req.id}/simulate`;
    await db.update(signatureRequests).set({ status: 'pending', providerStatus: 'pending', providerRef: `sim-${req.id.slice(0, 8)}`, signingUrl: url, updatedAt: new Date() }).where(eq(signatureRequests.id, req.id));
    return { ok: true, requestId, redirect: url };
  }
  try {
    const where = await whereOf(db, req);
    if (!where) throw new Error('The step of the request is gone');
    const ctx = await printCtxOf(where.code);
    const doc = ctx ? await dossierDoc(ctx, 'investment', where.versionNumber ?? undefined) : null;
    if (!doc) throw new Error('The investment dossier cannot be read');
    const [signer] = await db.select({ email: users.email }).from(users).where(eq(users.id, req.signerUserId));
    const back = `${origin()}/signature/${req.id}/return`;
    const r = await yousign().create({
      externalId: req.id, name: `${where.code} — G2 / AFE`, pdf: toPdf(doc), fileName: `${where.code}-G2.pdf`,
      signer: { name: req.signerName, email: signer.email }, successUrl: back, declineUrl: back,
    });
    await db.update(signatureRequests).set({ status: 'pending', providerStatus: 'pending', providerRef: r.ref, signerRef: r.signerRef, documentRef: r.documentRef, signingUrl: r.url, updatedAt: new Date() }).where(eq(signatureRequests.id, req.id));
    return { ok: true, requestId, redirect: r.url };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.update(signatureRequests).set({ status: 'failed', error: error.slice(0, 500), updatedAt: new Date() }).where(eq(signatureRequests.id, req.id));
    return { ok: false, error: 'The signature provider could not be reached; try again later' };
  }
}

/** The CAPEX code and dossier version of a request's step. */
export async function whereOf(q: DB | Tx, req: { circuitStepId: string }) {
  const [w] = await q.select({ code: capex.code, capexId: capex.id, gateId: gates.id, dossierVersionId: gates.dossierVersionId })
    .from(circuitSteps).innerJoin(gates, eq(gates.id, circuitSteps.gateId)).innerJoin(capex, eq(capex.id, gates.capexId)).where(eq(circuitSteps.id, req.circuitStepId));
  if (!w) return null;
  const { dossierVersions } = await import('@/server/db/schema');
  const [v] = w.dossierVersionId ? await q.select({ number: dossierVersions.number }).from(dossierVersions).where(eq(dossierVersions.id, w.dossierVersionId)) : [];
  return { ...w, versionNumber: v?.number ?? null };
}

/** The provider's status of a request (the simulation keeps it on the row). */
export async function providerStatusOf(req: SignatureRequestRow): Promise<ProviderStatus> {
  // A simulated request counts only while the simulation is the provider set (never once a real provider is configured).
  if (req.provider === 'simulation') return getConfig().signature.provider === 'simulation' ? ((req.providerStatus as ProviderStatus | null) ?? 'pending') : 'cancelled';
  if (!req.providerRef) return 'pending';
  return yousign().status(req.providerRef);
}

/** Cancels the request at the provider (best effort: a failure there leaves it to expire). */
export async function cancelAtProvider(req: SignatureRequestRow): Promise<void> {
  if (req.provider === 'yousign' && req.providerRef) await yousign().cancel(req.providerRef).catch(() => undefined);
}

/** The signed PDF or the audit trail of a completed Yousign request, read at the provider. */
export async function providerFile(req: SignatureRequestRow, kind: 'document' | 'proof'): Promise<Uint8Array | null> {
  if (req.provider !== 'yousign' || !req.providerRef || req.status !== 'completed') return null;
  return kind === 'document' ? yousign().signedDocument(req.providerRef) : req.signerRef ? yousign().auditTrail(req.providerRef, req.signerRef) : null;
}

/** Job `signature-status`: the requests under way at Yousign, their status refreshed (declined or expired ones closed). */
export async function refreshSignatureRequests(q: DB): Promise<number> {
  const rows = await q.select().from(signatureRequests).where(and(eq(signatureRequests.provider, 'yousign'), inArray(signatureRequests.status, ['pending'])));
  let changed = 0;
  for (const r of rows) {
    const p = await providerStatusOf(r).catch(() => null);
    if (!p || p === r.providerStatus) continue;
    await q.update(signatureRequests).set({ providerStatus: p, status: requestStatusOf(p), updatedAt: new Date() }).where(eq(signatureRequests.id, r.id));
    changed++;
  }
  return changed;
}

/** The requests of a gate session's steps (the gates page). */
export async function signatureRequestsOf(q: DB | Tx, stepIds: readonly string[]) {
  if (!stepIds.length) return [];
  return q.select().from(signatureRequests).where(inArray(signatureRequests.circuitStepId, [...stepIds]));
}
