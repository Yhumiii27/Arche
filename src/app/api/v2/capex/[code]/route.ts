// GET /api/v2/capex/<code> — one CAPEX of the client's scope in detail (AR-048, docs/API.md): lots, budget versions, gate
// sessions, machine needs, indicators and alerts; outside the scope, 404.
import { getCapex } from '@/server/api/handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/v2/capex/[code]'>): Promise<Response> {
  return getCapex(request, (await params).code, 2);
}
