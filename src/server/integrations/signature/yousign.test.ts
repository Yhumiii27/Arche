import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { isAdvancedStep, splitName, yousignStatus } from '@/domain/signature';
import { yousignClient } from './yousign';

describe('advanced signature (AR-037)', () => {
  it('only the deciding signature of the G2, once a provider is set', () => {
    expect(isAdvancedStep('yousign', 'G2', { kind: 'signature', decides: true })).toBe(true);
    expect(isAdvancedStep('none', 'G2', { kind: 'signature', decides: true })).toBe(false);
    expect(isAdvancedStep('yousign', 'G2', { kind: 'visa', decides: false })).toBe(false);
    expect(isAdvancedStep('simulation', 'G1', { kind: 'decision', decides: true })).toBe(false);
  });

  it('reads Yousign statuses and splits names', () => {
    expect(['ongoing', 'done', 'declined', 'expired', 'canceled', 'draft'].map(yousignStatus)).toEqual(['pending', 'signed', 'declined', 'expired', 'cancelled', 'pending']);
    expect(splitName('Henri Valette')).toEqual({ firstName: 'Henri', lastName: 'Valette' });
    expect(splitName('Marie-Claire de La Tour')).toEqual({ firstName: 'Marie-Claire de La', lastName: 'Tour' });
  });

  it('creates a request: document, advanced signer, activation; then its status', async () => {
    const calls: { method: string; url: string; body: unknown; auth: string | null }[] = [];
    const answers: Record<string, unknown> = {
      'POST /signature_requests': { id: 'req-1' },
      'POST /signature_requests/req-1/documents': { id: 'doc-1' },
      'POST /signature_requests/req-1/signers': { id: 'sig-1' },
      'POST /signature_requests/req-1/activate': { signers: [{ id: 'sig-1', signature_link: 'https://yousign.example/s/1' }] },
      'GET /signature_requests/req-1': { status: 'done' },
    };
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const path = url.replace('https://api.example/v3', '');
      calls.push({ method: init.method!, url: path, body: init.body instanceof FormData ? 'form' : init.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init.headers).get('authorization') });
      const a = answers[`${init.method} ${path}`];
      return a ? new Response(JSON.stringify(a), { status: 200 }) : new Response('no', { status: 404 });
    }) as unknown as typeof fetch;
    const c = yousignClient({ baseUrl: 'https://api.example/v3', apiKey: 'k', fetchImpl });
    const r = await c.create({ externalId: 'x', name: 'CPX — G2 / AFE', pdf: new Uint8Array([37, 80, 68, 70]), fileName: 'g2.pdf', signer: { name: 'Henri Valette', email: 'h@groupe.example' }, successUrl: 'https://arche.example/r', declineUrl: 'https://arche.example/r' });
    expect(r).toEqual({ ref: 'req-1', signerRef: 'sig-1', documentRef: 'doc-1', url: 'https://yousign.example/s/1' });
    expect(calls.map((x) => `${x.method} ${x.url}`)).toEqual(Object.keys(answers).slice(0, 4));
    expect(calls.every((x) => x.auth === 'Bearer k')).toBe(true);
    expect(calls[2].body).toMatchObject({ info: { first_name: 'Henri', last_name: 'Valette', email: 'h@groupe.example', locale: 'fr' }, signature_level: 'advanced_electronic_signature', fields: [{ document_id: 'doc-1', type: 'signature' }] });
    expect(await c.status('req-1')).toBe('signed');
    await expect(c.status('other')).rejects.toThrow('Yousign GET /signature_requests/other answered 404');
  });
});
