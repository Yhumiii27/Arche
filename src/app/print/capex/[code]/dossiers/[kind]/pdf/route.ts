// GET — the dossier version as a PDF written by the server (AR-042; ?v=<number>, the latest by default). Same visibility as
// the dossier page: outside the viewer's scope, 404.
import { isDossierKind } from '@/domain/dossiers';
import { dossierDoc, pdfResponse, printCtxOf } from '@/features/print/documents';
import { toPdf } from '@/lib/export/pdf';
import { fileStem } from '@/lib/export/table';
import { businessToday } from '@/server/clock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/print/capex/[code]/dossiers/[kind]/pdf'>): Promise<Response> {
  const { code, kind } = await params;
  const ctx = isDossierKind(kind) ? await printCtxOf(decodeURIComponent(code)) : null;
  const v = new URL(request.url).searchParams.get('v');
  const doc = ctx && isDossierKind(kind) ? await dossierDoc(ctx, kind, v ? Number(v) : undefined) : null;
  if (!ctx || !doc) return new Response('Not found', { status: 404 });
  return pdfResponse(toPdf(doc), fileStem(`${ctx.c.code} ${doc.title.split(' — ')[0]}`, await businessToday(ctx.db)));
}
