// GET — the signed G2 / AFE PDF (document) or the signer's audit trail (proof), read at Yousign on demand (AR-037: Arche keeps
// no file). Readers of the CAPEX only: outside the viewer's scope, 404.
import { eq } from 'drizzle-orm';
import { pdfResponse } from '@/features/print/documents';
import { getDb } from '@/server/db/client';
import { signatureRequests } from '@/server/db/schema';
import { capexForViewer } from '@/server/dal/capex';
import { getViewer } from '@/server/session';
import { providerFile, whereOf } from '@/server/signature/advanced';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RouteContext<'/signature/[id]/files/[kind]'>): Promise<Response> {
  const { id, kind } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || (kind !== 'document' && kind !== 'proof')) return new Response('Not found', { status: 404 });
  const db = await getDb();
  const [req] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, id));
  const where = req ? await whereOf(db, req) : null;
  if (!req || !where || !(await capexForViewer(await getViewer(), where.code))) return new Response('Not found', { status: 404 });
  try {
    const bytes = await providerFile(req, kind);
    if (!bytes) return new Response('Not found', { status: 404 });
    return pdfResponse(bytes, `${where.code}-G2-${kind === 'document' ? 'signed' : 'audit-trail'}`);
  } catch {
    return new Response('The signature provider could not be reached', { status: 502 });
  }
}
