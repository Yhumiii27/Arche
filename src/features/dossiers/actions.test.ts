// Deposit in Codex from a dossier (CX-03) on a fresh PostgreSQL database with the demo data set ("View as"): a file deposited
// from a section is attached to the draft, the PDF of the frozen version is recorded on it, Codex's refusals come back as
// they are, and nothing is sent without the right to write on the CAPEX.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, desc, eq } from 'drizzle-orm';
import { readContent } from '@/domain/dossiers';
import { auditEntries, capex, dossiers, dossierVersions } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';
import { depositFrozenVersionAction, depositReferenceAction } from './actions';

let t: TestDatabase;
const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();
beforeAll(async () => {
  t = await testDatabase();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_CODEX_URL', 'https://codex.example');
  vi.stubEnv('CODEX_DOCUMENTS_TOKEN', 'deposit-token');
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await t.close();
});
beforeEach(() => {
  jar.clear();
  fetchMock.mockReset();
});

const CODE = 'CPX-APM-2026-01';
const as = (role: string) => jar.set('arche-role', role);
function form(o: Record<string, string>, file?: File) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  if (file) fd.set('file', file);
  return fd;
}
const pdf = (name = 'pid-hall-2.pdf') => new File([new TextEncoder().encode(`%PDF-1.7 ${name}`)], name, { type: 'application/pdf' });
const META = { typeCode: 'PID', department: 'DIR', owner: 'EMP-0042', conf: 'interne' };

async function versions(kind: 'business_case' | 'investment') {
  return t.db.select({ v: dossierVersions }).from(dossierVersions).innerJoin(dossiers, eq(dossiers.id, dossierVersions.dossierId)).innerJoin(capex, eq(capex.id, dossiers.capexId))
    .where(and(eq(capex.code, CODE), eq(dossiers.kind, kind))).orderBy(desc(dossierVersions.number)).then((r) => r.map((x) => x.v));
}
async function sentMeta() {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  const fd = await new Request('http://codex/api/documents', { method: 'POST', headers: init.headers as Record<string, string>, body: init.body as BlobPart }).formData();
  return JSON.parse(String(fd.get('meta')));
}

describe('Deposit in Codex from a dossier', () => {
  it('a file deposited from a section is attached to the draft, verified; the same file again attaches nothing more', async () => {
    as('project_lead');
    fetchMock.mockResolvedValue(Response.json({ id: 'PID-DIR-0007', revision: 'A', version: 'A.1', status: 'draft', file: true, href: '/documents/PID-DIR-0007', warnings: [] }, { status: 201 }));
    expect(await depositReferenceAction(CODE, 'investment', 'pack', null, form({ ...META, title: 'P&ID hall 2' }, pdf()))).toEqual({ ok: true });
    const meta = await sentMeta();
    expect(meta).toMatchObject({ title: 'P&ID hall 2', typeCode: 'PID', department: 'DIR', ownerMatricule: 'EMP-0042', conf: 'interne' });
    expect(meta.sourceRef).toMatch(/^arche:dossier\/CPX-APM-2026-01\/investment\/pack\/[0-9a-f]{16}$/);
    const [draft] = await versions('investment');
    expect(draft.state).toBe('draft');
    expect(readContent('investment', draft.content).sections.pack.refs).toContainEqual({ id: 'PID-DIR-0007', revision: null, title: 'P&ID hall 2', verified: true });

    fetchMock.mockResolvedValue(Response.json({ id: 'PID-DIR-0007', href: '/documents/PID-DIR-0007', replayed: true }));
    expect(await depositReferenceAction(CODE, 'investment', 'pack', null, form({ ...META, title: 'P&ID hall 2' }, pdf()))).toEqual({ ok: true });
    expect((await sentMeta()).sourceRef).toBe(meta.sourceRef);
    const [again] = await versions('investment');
    expect(readContent('investment', again.content).sections.pack.refs.filter((r) => r.id === 'PID-DIR-0007')).toHaveLength(1);
  });

  it('Codex’s refusal comes back and nothing is attached', async () => {
    as('project_lead');
    fetchMock.mockResolvedValue(Response.json({ error: 'validation', issues: [{ field: 'typeCode', message: 'Type inconnu' }] }, { status: 400 }));
    const before = readContent('investment', (await versions('investment'))[0].content).sections.regulatory.refs.length;
    expect(await depositReferenceAction(CODE, 'investment', 'regulatory', null, form({ ...META, typeCode: 'ZZZ', title: 'ICPE' }, pdf('icpe.pdf')))).toEqual({ ok: false, error: 'Codex refused the deposit: typeCode: Type inconnu' });
    expect(readContent('investment', (await versions('investment'))[0].content).sections.regulatory.refs).toHaveLength(before);
  });

  it('checks the form and the right before calling Codex', async () => {
    as('project_lead');
    expect(await depositReferenceAction(CODE, 'investment', 'pack', null, form({ ...META, title: 'No file' }))).toEqual({ ok: false, error: 'Choose the file to deposit' });
    expect(await depositReferenceAction(CODE, 'investment', 'pack', null, form({ ...META, department: 'DIRECTION', title: 'x' }, pdf()))).toMatchObject({ ok: false });
    expect(await depositReferenceAction(CODE, 'investment', 'opinions', null, form({ ...META, title: 'x' }, pdf()))).toEqual({ ok: false, error: 'Unknown section' });
    as('auditor');
    expect((await depositReferenceAction(CODE, 'investment', 'pack', null, form({ ...META, title: 'x' }, pdf()))).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the PDF of the frozen version is recorded on it, once', async () => {
    as('project_lead');
    const [target] = (await versions('business_case')).filter((x) => x.state === 'frozen' || x.state === 'approved');
    expect(target).toBeDefined();
    expect(await depositFrozenVersionAction(CODE, 'business_case', null, form({ ...META, typeCode: 'NOT' }, new File(['x'], 'notes.txt', { type: 'text/plain' })))).toEqual({ ok: false, error: 'Deposit the PDF of the print view' });
    fetchMock.mockResolvedValue(Response.json({ id: 'NOT-DIR-0012', revision: 'A', version: 'A.1', status: 'draft', file: true, href: '/documents/NOT-DIR-0012', warnings: [] }, { status: 201 }));
    expect(await depositFrozenVersionAction(CODE, 'business_case', null, form({ ...META, typeCode: 'NOT' }, pdf('business-case.pdf')))).toEqual({ ok: true });
    const meta = await sentMeta();
    expect(meta.sourceRef).toBe(`arche:dossier/${CODE}/business_case/v${target.number}`);
    expect(meta.title).toBe(`${CODE} — Business case (scoping) v${target.number}`);
    const [after] = (await versions('business_case')).filter((x) => x.id === target.id);
    expect(after).toMatchObject({ codexDocumentId: 'NOT-DIR-0012', codexDepositedByName: 'Leïla Haddad', state: target.state, contentHash: target.contentHash });
    const audit = await t.db.select().from(auditEntries).where(eq(auditEntries.entityId, target.id));
    expect(audit.map((a) => a.change)).toContain(`Business case (scoping) v${target.number}: PDF deposited in Codex as NOT-DIR-0012`);
    fetchMock.mockClear();
    expect(await depositFrozenVersionAction(CODE, 'business_case', null, form({ ...META, typeCode: 'NOT' }, pdf('business-case.pdf')))).toEqual({ ok: false, error: 'This version is already deposited in Codex' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
