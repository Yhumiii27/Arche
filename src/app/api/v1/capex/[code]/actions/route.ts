// POST /api/v1/capex/<code>/actions — opens an action of the CAPEX's action plan (AR-048, docs/API.md): signed request of a
// client with the write right; the owner by e-mail, in the CAPEX's team; audited "API · <client>".
import { json, writeClient } from '@/server/api/auth';
import { writeAction } from '@/server/api/data';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: RouteContext<'/api/v1/capex/[code]/actions'>): Promise<Response> {
  const w = await writeClient(request);
  if (w instanceof Response) return w;
  let input: unknown;
  try {
    input = JSON.parse(w.body);
  } catch {
    return json(request, 400, { error: 'invalid_json' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json(request, 400, { error: 'invalid_json' });
  const r = await writeAction(w.client, decodeURIComponent((await params).code), input as Record<string, unknown>);
  return r.ok ? json(request, 201, { data: r.value }) : json(request, r.status, { error: r.error, ...(r.message ? { message: r.message } : {}) });
}
