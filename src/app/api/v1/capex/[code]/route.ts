// GET /api/v1/capex/<code> — one CAPEX of the client's scope in detail (AR-048, docs/API.md): lots, budget versions, gate
// sessions, machine needs, indicators and alerts; outside the scope, 404. Deprecated: frozen as published, see /api/v2/ (docs/API.md §8).
import { getCapex } from '@/server/api/handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/v1/capex/[code]'>): Promise<Response> {
  return getCapex(request, (await params).code, 1);
}
