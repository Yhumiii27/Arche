// /api/v1/capex/<code>/actuals (AR-048, docs/API.md): GET the monthly committed / spent / physical progress of the lots; POST
// one lot and month (signed request of a client with the write right; lots outside EPC2i only), audited "API · <client>".
import { json, readClient, writeClient } from '@/server/api/auth';
import { actualsOf, writeActual } from '@/server/api/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/v1/capex/[code]/actuals'>): Promise<Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  const rows = await actualsOf(client, decodeURIComponent((await params).code));
  return rows ? json(request, 200, { data: rows }) : json(request, 404, { error: 'not_found' });
}

export async function POST(request: Request, { params }: RouteContext<'/api/v1/capex/[code]/actuals'>): Promise<Response> {
  const w = await writeClient(request);
  if (w instanceof Response) return w;
  let input: unknown;
  try {
    input = JSON.parse(w.body);
  } catch {
    return json(request, 400, { error: 'invalid_json' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json(request, 400, { error: 'invalid_json' });
  const r = await writeActual(w.client, decodeURIComponent((await params).code), input as Record<string, unknown>);
  return r.ok ? json(request, 200, { data: r.value }) : json(request, r.status, { error: r.error, ...(r.message ? { message: r.message } : {}) });
}
