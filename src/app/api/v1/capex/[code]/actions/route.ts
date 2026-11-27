// POST /api/v1/capex/<code>/actions — opens an action of the CAPEX's action plan (AR-048, docs/API.md): signed request of a
// client with the write right; the owner by e-mail, in the CAPEX's team; audited "API · <client>". Deprecated: frozen as published, see /api/v2/ (docs/API.md §8).
import { postAction } from '@/server/api/handlers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: RouteContext<'/api/v1/capex/[code]/actions'>): Promise<Response> {
  return postAction(request, (await params).code);
}
