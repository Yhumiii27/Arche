// Optimistic lock (AR-049) on a fresh database with the demo data set: two people edit the same object from the same page; the
// second write, made on the version both were shown, is refused instead of overwriting the first.
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

import { eq } from 'drizzle-orm';
import { STALE_MSG } from '@/domain/concurrency';
import { readContent } from '@/domain/dossiers';
import { dossierVersionsOf } from '@/server/dal/dossiers';
import { budgetVersions, capex, capexLots } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';
import { saveSectionAction } from '../dossiers/actions';
import { saveBudgetVersionAction, updateSheetAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'project_lead'));

const CODE = 'CPX-APM-2026-01';
const form = (o: Record<string, string | number>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, String(v));
  return fd;
};
const row = async () => (await t.db.select().from(capex).where(eq(capex.code, CODE)))[0];

describe('optimistic lock (AR-049)', () => {
  it('the identity sheet: the second save on the same version is refused', async () => {
    const shown = (await row()).rowVersion;
    expect(await updateSheetAction(CODE, null, form({ title: 'Extrusion line 3 — A', investmentType: 'new_line', rowVersion: shown }))).toEqual({ ok: true });
    expect((await row()).rowVersion).toBe(shown + 1);
    expect(await updateSheetAction(CODE, null, form({ title: 'Extrusion line 3 — B', investmentType: 'new_line', rowVersion: shown }))).toEqual({ ok: false, error: STALE_MSG });
    expect((await row()).title).toBe('Extrusion line 3 — A');
    // Reloaded: the current version is accepted.
    expect(await updateSheetAction(CODE, null, form({ title: 'Extrusion line 3 — B', investmentType: 'new_line', rowVersion: shown + 1 }))).toEqual({ ok: true });
  });

  it('a draft budget version: the second save on the same version is refused', async () => {
    jar.set('arche-role', 'controller');
    const c = await row();
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id));
    // The demo version in progress is submitted: back to draft for the test.
    const [inProgress] = (await t.db.select().from(budgetVersions).where(eq(budgetVersions.capexId, c.id))).filter((v) => v.status === 'submitted');
    const [draft] = await t.db.update(budgetVersions).set({ status: 'draft' }).where(eq(budgetVersions.id, inProgress.id)).returning();
    const lines = (n: number) => Object.fromEntries(lots.map((l) => [`lot:${l.id}`, n]));
    expect(await saveBudgetVersionAction(CODE, draft.id, null, form({ estimateClass: 'E30', ...lines(200), rowVersion: draft.rowVersion }))).toEqual({ ok: true });
    expect(await saveBudgetVersionAction(CODE, draft.id, null, form({ estimateClass: 'E30', ...lines(300), rowVersion: draft.rowVersion }))).toEqual({ ok: false, error: STALE_MSG });
  });

  it('a dossier: two sections are saved at once; the same section changed meanwhile is refused', async () => {
    const save = (key: string, text: string, base: string) => saveSectionAction(CODE, 'business_case', key, null, form({ text, base }));
    const shown = (key: string) => readContent('business_case', latest.content).sections[key].text;
    const [latest] = await dossierVersionsOf(t.db, (await row()).id, 'business_case');
    // A and B open the dossier: A saves "barriers", B saves "land", then B saves "barriers" over the text it was shown.
    expect(await save('barriers', 'Barriers: typed by A', shown('barriers'))).toEqual({ ok: true });
    expect(await save('land', 'Land: typed by B', shown('land'))).toEqual({ ok: true });
    expect(await save('barriers', 'Barriers: typed by B', shown('barriers'))).toEqual({ ok: false, error: STALE_MSG });
    expect(await save('barriers', 'Barriers: typed by B', 'Barriers: typed by A')).toEqual({ ok: true });
  });
});
