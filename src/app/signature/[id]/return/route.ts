// GET — where the provider sends the signer back (AR-037): the step is completed when the signature is done, then the gate page.
// Same rights as the step: only the signer completes it; anyone else lands on the page (or a 404 outside their scope).
import { NextResponse } from 'next/server';
import { finishSignatureAction } from '@/features/gates/signature';
import { getDb } from '@/server/db/client';
import { signatureRequests } from '@/server/db/schema';
import { whereOf } from '@/server/signature/advanced';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/signature/[id]/return'>): Promise<Response> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const db = await getDb();
  const [req] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, id));
  const where = req ? await whereOf(db, req) : null;
  if (!where) return new Response('Not found', { status: 404 });
  const r = await finishSignatureAction(id);
  const to = new URL(`/capex/${encodeURIComponent(where.code)}/gates`, request.url);
  to.searchParams.set('signature', r.ok ? 'signed' : 'open');
  return NextResponse.redirect(to, 303);
}
