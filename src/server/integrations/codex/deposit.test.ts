// Deposit in Codex (CX-03): what Arche sends to POST /api/documents and how it reads Codex's answers.
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { codexCapexEnabled, codexDepositEnabled, depositMetaOf, depositToCodex, ownerField, type CodexDepositMeta } from './deposit';

const meta: CodexDepositMeta = { sourceRef: 'arche:dossier/CPX-APM-2026-01/business_case/v2', title: 'Business case v2', typeCode: 'NOT', department: 'DIR', owner: 'emp-0042', conf: 'interne' };
const bytes = new TextEncoder().encode('%PDF-1.7 test');
const file = { name: 'business-case-v2.pdf', type: 'application/pdf', bytes };
const sha = createHash('sha256').update(bytes).digest('hex');

function codex(status: number, body: unknown) {
  return vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => Response.json(body, { status }));
}
const call = (f: ReturnType<typeof codex>) => f.mock.calls[0] as [URL, RequestInit & { headers: Record<string, string>; body: Uint8Array }];

/** The multipart body as Codex reads it. */
async function received(init: RequestInit & { headers: Record<string, string>; body: Uint8Array }) {
  const fd = await new Request('http://codex/api/documents', { method: 'POST', headers: { 'content-type': init.headers['content-type'] }, body: init.body as BlobPart }).formData();
  const f = fd.get('file') as File;
  return { meta: JSON.parse(String(fd.get('meta'))), file: { name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) } };
}

describe('Deposit in Codex', () => {
  it('is off without a URL or without a proof', async () => {
    expect(codexDepositEnabled({})).toBe(false);
    expect(codexDepositEnabled({ NEXT_PUBLIC_CODEX_URL: 'https://codex.example' })).toBe(false);
    expect(codexDepositEnabled({ NEXT_PUBLIC_CODEX_URL: 'https://codex.example', CODEX_DOCUMENTS_TOKEN: 't' })).toBe(true);
    expect(codexDepositEnabled({ CODEX_API_URL: 'https://codex.example', CODEX_DOCUMENTS_SECRET: 's' })).toBe(true);
    const f = codex(201, {});
    expect(await depositToCodex({ meta, file, env: { NEXT_PUBLIC_CODEX_URL: 'https://codex.example' }, fetchImpl: f as unknown as typeof fetch })).toMatchObject({ ok: false, reason: 'off' });
    expect(f).not.toHaveBeenCalled();
  });

  it('names the owner as Codex does: matricule (EMP-…) or Codex identifier', () => {
    expect(ownerField(' emp-0042 ')).toEqual({ ownerMatricule: 'EMP-0042' });
    expect(ownerField('USR-12')).toEqual({ ownerId: 'USR-12' });
  });

  it('posts the metadata, the file and its SHA-256 with the bearer token', async () => {
    const f = codex(201, { id: 'NOT-DIR-0004', revision: 'A', version: 'A.1', status: 'draft', file: true, href: '/documents/NOT-DIR-0004', warnings: [] });
    const r = await depositToCodex({ meta, file, env: { NEXT_PUBLIC_CODEX_URL: 'https://codex.example/', CODEX_DOCUMENTS_TOKEN: 'tok' }, fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: true, id: 'NOT-DIR-0004', replayed: false });
    const [url, init] = call(f);
    expect(String(url)).toBe('https://codex.example/api/documents');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer tok');
    expect(init.headers['x-codex-signature']).toBeUndefined();
    const got = await received(init);
    expect(got.meta).toEqual({ sourceRef: meta.sourceRef, title: 'Business case v2', typeCode: 'NOT', department: 'DIR', ownerMatricule: 'EMP-0042', conf: 'interne', sha256: sha });
    expect(got.file).toEqual({ name: 'business-case-v2.pdf', type: 'application/pdf', bytes });
  });

  it('signs the exact body with the secret, and sends URL credentials as Basic (HTTP authentication of the host)', async () => {
    const f = codex(200, { id: 'NOT-DIR-0004', href: '/documents/NOT-DIR-0004', replayed: true });
    const env = { CODEX_API_URL: 'https://bot:p%40ss@codex.example', NEXT_PUBLIC_CODEX_URL: 'https://other.example', CODEX_DOCUMENTS_SECRET: 'a-long-enough-secret' };
    const r = await depositToCodex({ meta, file, env, fetchImpl: f as unknown as typeof fetch, now: () => 1_790_000_000_500 });
    expect(r).toEqual({ ok: true, id: 'NOT-DIR-0004', replayed: true });
    const [url, init] = call(f);
    expect(String(url)).toBe('https://codex.example/api/documents');
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from('bot:p@ss').toString('base64')}`);
    expect(init.headers['x-codex-timestamp']).toBe('1790000000');
    const expected = createHmac('sha256', 'a-long-enough-secret').update('1790000000.').update(init.body).digest('hex');
    expect(init.headers['x-codex-signature']).toBe(`v1=${expected}`);
  });

  it('refuses a token with credentials in the URL (both need the Authorization header)', async () => {
    const f = codex(201, {});
    const env = { CODEX_API_URL: 'https://bot:pass@codex.example', CODEX_DOCUMENTS_TOKEN: 'tok' };
    expect(await depositToCodex({ meta, file, env, fetchImpl: f as unknown as typeof fetch })).toMatchObject({ ok: false, reason: 'misconfigured' });
    expect(f).not.toHaveBeenCalled();
  });

  it('reads the refusals of Codex', async () => {
    const env = { NEXT_PUBLIC_CODEX_URL: 'https://codex.example', CODEX_DOCUMENTS_TOKEN: 'tok' };
    const run = (status: number, body: unknown) => depositToCodex({ meta, file, env, fetchImpl: codex(status, body) as unknown as typeof fetch });
    expect(await run(400, { error: 'validation', issues: [{ field: 'typeCode', message: 'Type inconnu' }] })).toEqual({ ok: false, reason: 'invalid', message: 'Codex refused the deposit: typeCode: Type inconnu' });
    expect(await run(409, { error: 'source_ref_reused', id: 'NOT-DIR-0004' })).toMatchObject({ ok: false, reason: 'conflict', message: 'Another file was already deposited in Codex under this reference (NOT-DIR-0004)' });
    expect(await run(401, { error: 'unauthorized' })).toMatchObject({ ok: false, reason: 'refused' });
    expect(await run(503, { error: 'disabled' })).toMatchObject({ ok: false, reason: 'off' });
    expect(await run(503, { error: 'scan_unavailable' })).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await run(422, { error: 'sha256_mismatch', expected: 'a', actual: 'b' })).toMatchObject({ ok: false, reason: 'invalid', message: 'Codex refused the deposit: sha256_mismatch' });
  });

  it('never throws: an unreachable Codex is a result', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const r = await depositToCodex({ meta, file, env: { NEXT_PUBLIC_CODEX_URL: 'http://localhost:1', CODEX_DOCUMENTS_TOKEN: 'tok' }, fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, reason: 'unavailable', message: 'Codex could not be reached (fetch failed)' });
  });

  it('sends the sub-type; the CAPEX attachment and the legal hold only once Codex accepts them (CX-01, CX-02, CX-07)', async () => {
    const m = { ...meta, subtype: 'Dossier de jalon G1', capexCode: 'CPX-APM-2026-01', legalHold: true };
    expect(codexCapexEnabled({})).toBe(false);
    const off = depositMetaOf(m, 'abc', {});
    expect(off).toMatchObject({ subtype: 'Dossier de jalon G1', ownerMatricule: 'EMP-0042', sha256: 'abc' });
    expect(off).not.toHaveProperty('attachment');
    expect(off).not.toHaveProperty('capexCode');
    expect(off).not.toHaveProperty('legalHold');
    expect(depositMetaOf({ ...meta, subtype: null }, 'abc', {})).not.toHaveProperty('subtype');
    expect(depositMetaOf(m, 'abc', { CODEX_CAPEX: 'on' })).toMatchObject({ attachment: 'capex', capexCode: 'CPX-APM-2026-01', legalHold: true });
    const f = codex(201, { id: 'DEF-CPX-APM-2026-01-001' });
    expect(await depositToCodex({ meta: m, file, env: { CODEX_API_URL: 'https://codex.example', CODEX_DOCUMENTS_TOKEN: 't', CODEX_CAPEX: 'on' }, fetchImpl: f as unknown as typeof fetch })).toEqual({ ok: true, id: 'DEF-CPX-APM-2026-01-001', replayed: false });
    expect((await received(call(f)[1])).meta).toMatchObject({ typeCode: 'NOT', subtype: 'Dossier de jalon G1', attachment: 'capex', capexCode: 'CPX-APM-2026-01', legalHold: true, sha256: sha });
  });
});
