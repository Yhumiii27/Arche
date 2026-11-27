// GET /api/v1/capex — the CAPEX of the client's scope (AR-048, docs/API.md): identity, status, phase, typology, people and the
// validated budget. Key in `Authorization: Bearer …`; drafts are never served. Deprecated: frozen as published, see /api/v2/ (docs/API.md §8).
import { listCapex } from '@/server/api/handlers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return listCapex(request);
}
