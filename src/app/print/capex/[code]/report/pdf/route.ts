// GET — the Copil report as a PDF written by the server (AR-042). Same visibility as the CAPEX: outside the scope, 404.
import { copilReportDoc, pdfResponse, printCtxOf } from '@/features/print/documents';
import { toPdf } from '@/lib/export/pdf';
import { fileStem } from '@/lib/export/table';
import { businessToday } from '@/server/clock';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RouteContext<'/print/capex/[code]/report/pdf'>): Promise<Response> {
  const { code } = await params;
  const ctx = await printCtxOf(decodeURIComponent(code));
  if (!ctx) return new Response('Not found', { status: 404 });
  const doc = await copilReportDoc(ctx);
  return pdfResponse(toPdf(doc), fileStem(`${ctx.c.code} ${ctx.t('Copil report')}`, await businessToday(ctx.db)));
}
