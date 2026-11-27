import 'server-only';
// The handlers of the business API (AR-048, docs/API.md), shared by /api/v1/ (frozen, deprecated) and /api/v2/: the two
// versions differ only by the names of docs/API.md §8 (`ApiVersion`), so each route file is a thin wrapper.
import { json, readClient, writeClient } from '@/server/api/auth';
import { actualsOf, capexDetail, capexList, writeAction, writeActual, type ApiVersion } from '@/server/api/data';

/** GET …/capex — the CAPEX of the client's scope. */
export async function listCapex(request: Request): Promise<Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  return json(request, 200, { data: await capexList(client) });
}

/** GET …/capex/<code> — one CAPEX of the client's scope in detail; outside the scope, 404. */
export async function getCapex(request: Request, code: string, version: ApiVersion): Promise<Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  const d = await capexDetail(client, decodeURIComponent(code), version);
  return d ? json(request, 200, { data: d }) : json(request, 404, { error: 'not_found' });
}

/** GET …/capex/<code>/actuals — the monthly committed / spent / physical progress of the lots. */
export async function getActuals(request: Request, code: string): Promise<Response> {
  const client = await readClient(request);
  if (client instanceof Response) return client;
  const rows = await actualsOf(client, decodeURIComponent(code));
  return rows ? json(request, 200, { data: rows }) : json(request, 404, { error: 'not_found' });
}

/** The JSON object of a signed write, or the 400 answer. */
function objectBody(request: Request, body: string): Record<string, unknown> | Response {
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return json(request, 400, { error: 'invalid_json' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json(request, 400, { error: 'invalid_json' });
  return input as Record<string, unknown>;
}

/** POST …/capex/<code>/actuals — one lot and month (signed request of a client with the write right; lots outside Keystone). */
export async function postActual(request: Request, code: string, version: ApiVersion): Promise<Response> {
  const w = await writeClient(request);
  if (w instanceof Response) return w;
  const input = objectBody(request, w.body);
  if (input instanceof Response) return input;
  const r = await writeActual(w.client, decodeURIComponent(code), input, version);
  return r.ok ? json(request, 200, { data: r.value }) : json(request, r.status, { error: r.error, ...(r.message ? { message: r.message } : {}) });
}

/** POST …/capex/<code>/actions — opens an action of the CAPEX's action plan (signed request of a client with the write right). */
export async function postAction(request: Request, code: string): Promise<Response> {
  const w = await writeClient(request);
  if (w instanceof Response) return w;
  const input = objectBody(request, w.body);
  if (input instanceof Response) return input;
  const r = await writeAction(w.client, decodeURIComponent(code), input);
  return r.ok ? json(request, 201, { data: r.value }) : json(request, r.status, { error: r.error, ...(r.message ? { message: r.message } : {}) });
}
