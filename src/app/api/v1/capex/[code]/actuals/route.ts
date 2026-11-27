// /api/v1/capex/<code>/actuals (AR-048, docs/API.md): GET the monthly committed / spent / physical progress of the lots; POST
// one lot and month (signed request of a client with the write right; lots outside Keystone only), audited "API · <client>". Deprecated: frozen as published, see /api/v2/ (docs/API.md §8).
import { getActuals, postActual } from '@/server/api/handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/v1/capex/[code]/actuals'>): Promise<Response> {
  return getActuals(request, (await params).code);
}

export async function POST(request: Request, { params }: RouteContext<'/api/v1/capex/[code]/actuals'>): Promise<Response> {
  return postActual(request, (await params).code, 1);
}
