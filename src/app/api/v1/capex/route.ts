// GET /api/v1/capex — the CAPEX of the client's scope (AR-048, docs/API.md): identity, status, phase, typology, people and the
// validated budget. Key in `Authorization: Bearer …`; drafts are never served.
import { json, readClient } from '@/server/api/auth';
import { capexList } from '@/server/api/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  return json(request, 200, { data: await capexList(client) });
}
