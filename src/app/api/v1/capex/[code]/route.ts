// GET /api/v1/capex/<code> — one CAPEX of the client's scope in detail (AR-048, docs/API.md): lots, budget versions, gate
// sessions, machine needs, indicators and alerts; outside the scope, 404.
import { json, readClient } from '@/server/api/auth';
import { capexDetail } from '@/server/api/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/v1/capex/[code]'>): Promise<Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  const d = await capexDetail(client, decodeURIComponent((await params).code));
  return d ? json(request, 200, { data: d }) : json(request, 404, { error: 'not_found' });
}
