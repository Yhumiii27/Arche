import 'server-only';
// The state of advanced signature requests at the provider (AR-037): the Yousign client of the configuration (replaced in
// tests), the status of a request, and the job `signature-status`. No Next.js request APIs here: the worker loads it.
import { and, eq, inArray } from 'drizzle-orm';
import { requestStatusOf, type ProviderStatus } from '@/domain/signature';
import { getConfig } from '@/server/config';
import { signatureRequests } from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { yousignClient, type YousignClient } from '@/server/integrations/signature/yousign';

type SignatureRequestRow = typeof signatureRequests.$inferSelect;

let testClient: YousignClient | null = null;
/** Tests replace the Yousign client. */
export function setYousignClientForTests(c: YousignClient | null) {
  testClient = c;
}

export function yousign(): YousignClient {
  if (testClient) return testClient;
  const s = getConfig().signature;
  if (!s.yousignKey) throw new Error('ARCHE_YOUSIGN_API_KEY is not set');
  return yousignClient({ baseUrl: s.yousignUrl, apiKey: s.yousignKey });
}

/** The provider's status of a request (the simulation keeps it on the row). */
export async function providerStatusOf(req: SignatureRequestRow): Promise<ProviderStatus> {
  // A simulated request counts only while the simulation is the provider set (never once a real provider is configured).
  if (req.provider === 'simulation') return getConfig().signature.provider === 'simulation' ? ((req.providerStatus as ProviderStatus | null) ?? 'pending') : 'cancelled';
  if (!req.providerRef) return 'pending';
  return yousign().status(req.providerRef);
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

