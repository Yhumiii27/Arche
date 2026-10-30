// GET /export/<dataset>?format=csv|xlsx — a page's table as a file for Excel (AR-042): the CAPEX register, the group or
// subsidiary portfolio, the alerts, a CAPEX's committed and spent (?capex=<code>). The viewer's session and visibility apply
// (src/server/export/datasets.ts); an unknown dataset or a CAPEX outside the scope is a 404. Never cached.
import { toCsv } from '@/lib/export/csv';
import { fileStem } from '@/lib/export/table';
import { toXlsx } from '@/lib/export/xlsx';
import { businessToday } from '@/server/clock';
import { exportTable, isDataset } from '@/server/export/datasets';
import { getI18n, getSubsidiaryCookie, getViewer, getZone } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/export/[dataset]'>): Promise<Response> {
  const { dataset } = await params;
  if (!isDataset(dataset)) return new Response('Not found', { status: 404 });
  const query = new URL(request.url).searchParams;
  const format = query.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const [{ t, lang }, viewer, subsidiaryCookie, zone] = await Promise.all([getI18n(), getViewer(), getSubsidiaryCookie(), getZone()]);
  const table = await exportTable(dataset, { viewer, t, lang, subsidiaryCookie, zone, query });
  if (!table) return new Response('Not found', { status: 404 });
  const stem = fileStem(table.title, await businessToday());
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (format === 'xlsx')
    return new Response(Buffer.from(toXlsx(table)), { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${stem}.xlsx"` } });
  return new Response(toCsv(table, lang), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${stem}.csv"` } });
}
