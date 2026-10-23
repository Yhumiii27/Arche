// Indicators of the DIG-PRODI objectives (C-10, pilot) on a fresh PostgreSQL database with the demo data set: the delays,
// documents and traced decisions measured on the gates decided in Arche, the reference entered by the group industrial
// director only, the targets of the CDC; and the pure rules.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { desc } from 'drizzle-orm';
import { checkBaseline, kpiView, measureKpis } from '@/domain/kpi';
import { auditEntries } from '@/server/db/schema';
import { pilotIndicators } from '@/server/dal/kpi';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { saveBaselineAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const as = (role: string) => jar.set('arche-role', role);
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

describe('the rules of the indicators', () => {
  const s = (code: 'G1' | 'G2' | 'K3' | 'G3', delayDays: number, documents: number | null, signed = true) => ({ code, submittedOn: '2026-01-01', decidedOn: '2026-01-10', delayDays, documents, signed });

  it('averages the delays by gate and the documents by dossier; counts the traced decisions', () => {
    const m = measureKpis([s('G1', 4, 3), s('G1', 7, 1), s('G2', 12, 5), s('K3', 3, null, false)], { traced: 3, total: 3 });
    expect(m['delay:G1']).toEqual({ value: 5.5, count: 2 });
    expect(m['delay:G3']).toEqual({ value: null, count: 0 });
    expect(m.documents).toEqual({ value: 3, count: 3 });
    expect(m.traced).toEqual({ value: 85.7, count: 7 });
  });

  it('compares with the reference: −40 % delays, −50 % documents, 100 % traced', () => {
    expect(kpiView('delay:G1', { value: 5.5, count: 2 }, 10)).toMatchObject({ target: 6, changePct: -45, state: 'met' });
    expect(kpiView('delay:G2', { value: 12, count: 1 }, 15)).toMatchObject({ target: 9, changePct: -20, state: 'not_met' });
    expect(kpiView('documents', { value: 3, count: 3 }, 6)).toMatchObject({ target: 3, state: 'met' });
    expect(kpiView('traced', { value: 85.7, count: 7 }, null)).toMatchObject({ target: 100, state: 'not_met' });
    expect(kpiView('delay:K3', { value: 3, count: 1 }, null)).toMatchObject({ target: null, state: 'no_reference' });
    expect(kpiView('delay:G3', { value: null, count: 0 }, 10)).toMatchObject({ state: 'not_measured' });
  });

  it('checks a reference', () => {
    expect(checkBaseline('delay:G1', { value: '12,5', source: ' Survey of 2025 ', measuredOn: '2026-09-30' }, '2026-10-22')).toEqual({ ok: true, value: { value: 12.5, source: 'Survey of 2025', measuredOn: '2026-09-30' } });
    expect(checkBaseline('traced', { value: '120' }, '2026-10-22')).toEqual({ ok: false, error: 'A share is at most 100 %' });
    expect(checkBaseline('documents', { value: '-1' }, '2026-10-22')).toEqual({ ok: false, error: 'Enter the reference value' });
    expect(checkBaseline('documents', { value: '6', measuredOn: '2026-12-01' }, '2026-10-22')).toEqual({ ok: false, error: 'Enter the date of the survey (not in the future)' });
  });
});

describe('the indicators of the pilot', () => {
  it('are measured on the demonstration gates, without reference yet', async () => {
    as('dir_ig');
    const { kpis, sessions } = await pilotIndicators(await getViewer());
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((x) => x.delayDays >= 0 && x.signed)).toBe(true);
    const g1 = kpis.find((k) => k.key === 'delay:G1')!;
    expect(g1.measured.value).toBeGreaterThan(0);
    expect(g1.state).toBe('no_reference');
    expect(kpis.find((k) => k.key === 'traced')).toMatchObject({ measured: { value: 100 }, target: 100, state: 'met' });
    expect(kpis.find((k) => k.key === 'documents')!.measured.count).toBeGreaterThan(0);
  });

  it('only the group industrial director enters a reference; it is audited and gives the target', async () => {
    as('ceo');
    expect(await saveBaselineAction('delay:G1', null, form({ value: '10' }))).toEqual({ ok: false, error: 'Reserved to the group industrial director' });
    as('dir_ig');
    expect(await saveBaselineAction('delay:X9', null, form({ value: '10' }))).toEqual({ ok: false, error: 'Unknown indicator' });
    expect(await saveBaselineAction('delay:G1', null, form({ value: '10', source: 'Six G1 of 2025, from the minutes', measuredOn: '2026-09-30' }))).toEqual({ ok: true });
    expect(await saveBaselineAction('delay:G1', null, form({ value: '12' }))).toEqual({ ok: true });
    const [a] = await t.db.select().from(auditEntries).orderBy(desc(auditEntries.occurredAt)).limit(1);
    expect(a).toMatchObject({ objectRef: 'Indicator delay:G1', change: 'reference: 10 → 12', area: 'Administration', actorRole: 'dir_ig' });
    const g1 = (await pilotIndicators(await getViewer())).kpis.find((k) => k.key === 'delay:G1')!;
    expect(g1).toMatchObject({ reference: 12, target: 7.2 });
    expect(['met', 'not_met']).toContain(g1.state);
  });
});
