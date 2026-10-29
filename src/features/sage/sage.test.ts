// Sage connector (AR-047) on a fresh database with the demo data set: the group CFO imports SAI's demonstration extraction —
// the utilities order kept as entered, the recruitment order and invoice in CFA francs converted to k€ at the reference rate,
// a line repeated and a line on an unknown analytic code; imported again, everything is already there. The APM controller may
// not import for SAI; a lot's code is unique in the subsidiary; the planned extraction folder is read by the job.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { capex, capexLots, lotActuals, sageImports } from '@/server/db/schema';
import { importSageFolder } from '@/server/integrations/sage/folder';
import { sageImportsOf } from '@/server/integrations/sage/import';
import { testDatabase, type TestDatabase } from '@/test/db';
import { importSageAction, loadDemoSageAction, setSageCodeAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'controller'));

const form = (o: Record<string, string | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const lot = async (n: number) => {
  const [c] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-SAI-2026-01'));
  return (await t.db.select().from(capexLots).where(and(eq(capexLots.capexId, c.id), eq(capexLots.number, n))))[0];
};
const actual = async (n: number, month = '2026-10') => (await t.db.select().from(lotActuals).where(and(eq(lotActuals.lotId, (await lot(n)).id), eq(lotActuals.month, month))))[0];

describe('Sage import (AR-047)', () => {
  it('the APM controller may not import for SAI', async () => {
    expect(await loadDemoSageAction('SAI')).toEqual({ ok: false, error: 'Reserved to the controller of the subsidiary and the group CFO' });
  });

  it('the demonstration extraction: 3 lines kept, 1 already in the file, 1 rejected; amounts in k€', async () => {
    jar.set('arche-role', 'group_cfo');
    expect(await loadDemoSageAction('SAI')).toEqual({ ok: true });
    const [imp] = await sageImportsOf(t.db, 'SAI');
    expect(imp).toMatchObject({ source: 'demo', lines: 5, accepted: 3, duplicates: 1, rejected: 1 });
    expect(imp.rejects.map((r) => r.reason)).toEqual(['No lot has this analytic code']);
    // The utilities order, as entered (900 k€), its physical progress untouched; the recruitment order and invoice in XOF.
    expect(await actual(4)).toMatchObject({ committedKeur: 900, spentKeur: 0, source: 'sage' });
    expect(await actual(6)).toMatchObject({ committedKeur: 80, spentKeur: 30, committedLocal: 52480, currency: 'XOF', source: 'sage' });
    // Imported again: everything already there.
    expect(await loadDemoSageAction('SAI')).toEqual({ ok: true });
    expect((await sageImportsOf(t.db, 'SAI'))[0]).toMatchObject({ accepted: 0, duplicates: 4, rejected: 1 });
  });

  it('an uploaded file; a lot’s code is unique in the subsidiary', async () => {
    jar.set('arche-role', 'group_cfo');
    const csv = 'company;date;type;number;analytic;amount;currency;supplier;label\nSAI;2026-10-21;FAC;FA-99001;SAI-UT-01;150000;EUR;Energis;Advance';
    expect(await importSageAction('SAI', null, form({ file: new File([csv], 'SAI_2026-10.csv', { type: 'text/csv' }) }))).toEqual({ ok: true });
    expect(await actual(4)).toMatchObject({ committedKeur: 900, spentKeur: 150 });
    expect(await setSageCodeAction('CPX-SAI-2026-01', (await lot(3)).id, null, form({ sageCode: 'SAI-UT-01' }))).toEqual({ ok: false, error: 'This code is already the one of CPX-SAI-2026-01 lot 4' });
    expect(await setSageCodeAction('CPX-SAI-2026-01', (await lot(5)).id, null, form({ sageCode: 'SAI-X' }))).toEqual({ ok: false, error: 'EPC2i lots come from Keystone' });
    expect(await setSageCodeAction('CPX-SAI-2026-01', (await lot(3)).id, null, form({ sageCode: 'sai-bt-02' }))).toEqual({ ok: true });
    expect((await lot(3)).sageCode).toBe('SAI-BT-02');
  });

  it('the planned extraction folder: imported, then moved to done/', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'arche-sage-'));
    await writeFile(path.join(dir, 'SAI_2026-10-28.csv'), 'company;date;type;number;analytic;amount;currency;supplier;label\nSAI;2026-10-22;CMD;BC-2026-0500;SAI-BT-02;100000;EUR;Batir;Extension');
    await writeFile(path.join(dir, 'unknown.csv'), 'x');
    const r = await importSageFolder(t.db, dir, '2026-10-22');
    expect(r).toContain('SAI_2026-10-28.csv: 1 kept');
    expect(await readdir(path.join(dir, 'done'))).toEqual(['SAI_2026-10-28.csv']);
    expect(await readdir(path.join(dir, 'rejected'))).toEqual(['unknown.csv']);
    expect((await t.db.select().from(sageImports).where(eq(sageImports.source, 'folder'))).length).toBe(1);
  });
});
