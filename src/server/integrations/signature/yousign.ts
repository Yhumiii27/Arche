import 'server-only';
// Yousign API v3 client (AR-037, C-7: Yousign by default, French provider): a signature request with one PDF and one signer at
// the advanced level (code by e-mail), activated to get the signing link; its status; the signed document and the signer's
// audit trail, downloaded on demand (Arche keeps no file). `fetchImpl` is replaced in tests.
import { splitName, yousignStatus, type ProviderStatus } from '@/domain/signature';

export interface YousignClient {
  create(i: { externalId: string; name: string; pdf: Uint8Array; fileName: string; signer: { name: string; email: string }; successUrl: string; declineUrl: string }): Promise<{ ref: string; signerRef: string; documentRef: string; url: string }>;
  status(ref: string): Promise<ProviderStatus>;
  cancel(ref: string): Promise<void>;
  signedDocument(ref: string): Promise<Uint8Array>;
  auditTrail(ref: string, signerRef: string): Promise<Uint8Array>;
}

export function yousignClient(o: { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch }): YousignClient {
  const f = o.fetchImpl ?? fetch;
  const call = async (method: string, path: string, body?: unknown): Promise<Response> => {
    const multipart = body instanceof FormData;
    const r = await f(`${o.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${o.apiKey}`, ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
      body: body == null ? undefined : multipart ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`Yousign ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} answered ${r.status}`);
    return r;
  };
  const json = async <T>(method: string, path: string, body?: unknown) => (await (await call(method, path, body)).json()) as T;
  return {
    async create(i) {
      const req = await json<{ id: string }>('POST', '/signature_requests', { name: i.name, delivery_mode: 'none', timezone: 'Europe/Paris', external_id: i.externalId });
      const form = new FormData();
      form.append('file', new Blob([Buffer.from(i.pdf)], { type: 'application/pdf' }), i.fileName);
      form.append('nature', 'signable_document');
      form.append('parse_anchors', 'false');
      const doc = await json<{ id: string }>('POST', `/signature_requests/${req.id}/documents`, form);
      const { firstName, lastName } = splitName(i.signer.name);
      const signer = await json<{ id: string }>('POST', `/signature_requests/${req.id}/signers`, {
        info: { first_name: firstName, last_name: lastName, email: i.signer.email, locale: 'fr' },
        signature_level: 'advanced_electronic_signature',
        signature_authentication_mode: 'otp_email',
        fields: [{ document_id: doc.id, type: 'signature', page: 1, x: 360, y: 700, width: 180, height: 60 }],
        redirect_urls: { success: i.successUrl, decline: i.declineUrl },
      });
      const active = await json<{ signers: { id: string; signature_link: string | null }[] }>('POST', `/signature_requests/${req.id}/activate`);
      const url = active.signers.find((s) => s.id === signer.id)?.signature_link;
      if (!url) throw new Error('Yousign gave no signing link');
      return { ref: req.id, signerRef: signer.id, documentRef: doc.id, url };
    },
    async status(ref) {
      return yousignStatus((await json<{ status: string }>('GET', `/signature_requests/${ref}`)).status);
    },
    async cancel(ref) {
      await call('POST', `/signature_requests/${ref}/cancel`, { reason: 'contractualization_aborted', custom_note: 'Cancelled in Arche' });
    },
    async signedDocument(ref) {
      return new Uint8Array(await (await call('GET', `/signature_requests/${ref}/documents/download`)).arrayBuffer());
    },
    async auditTrail(ref, signerRef) {
      return new Uint8Array(await (await call('GET', `/signature_requests/${ref}/signers/${signerRef}/audit_trails/download`)).arrayBuffer());
    },
  };
}
