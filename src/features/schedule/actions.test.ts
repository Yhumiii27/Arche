// WBS and Gantt (owner's pilot feedback, 24 Oct 2026) on a fresh PostgreSQL database with the demo data set: the rules of the
// window, bars and roll-ups, the summary bar of an EPC2i project, the demo schedules, and the task Server Functions.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { barOf, checkTask, dayLeft, epc2iSpan, ganttWindow, lotSpan, rollup } from '@/domain/schedule';
import { capex, wbsTasks } from '@/server/db/schema';
import { portfolioSchedule, scheduleOf } from '@/server/dal/schedule';
import { testDatabase, type TestDatabase } from '@/test/db';
import { deleteTaskAction, saveTaskAction } from './actions';

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
const row = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];

describe('the rules of the schedule', () => {
  it('window, bars and positions', () => {
    const w = ganttWindow(['2026-01-10', '2026-12-20'], '2026-06-15');
    expect(w).toEqual({ first: '2026-01', months: 12 });
    expect(barOf('2026-01-01', '2026-12-31', w)).toEqual({ left: '0%', width: '100%', clipped: false });
    expect(barOf('2026-07-01', '2026-09-30', w)).toEqual({ left: '50%', width: '25%', clipped: false });
    expect(barOf('2027-02-01', '2027-03-31', w)).toBeNull();
    expect(dayLeft('2026-04-01', w)).toBe('25%');
    expect(ganttWindow(['2020-01-01'], '2026-01-01').months).toBe(36);
    expect(ganttWindow([], '2026-01-01').months).toBe(6);
  });

  it('roll-ups: tasks into a lot (duration-weighted), a lot without task from its months, an EPC2i project as one bar', () => {
    expect(rollup([{ start: '2026-01-01', end: '2026-01-10', progressPct: 100 }, { start: '2026-01-11', end: '2026-01-30', progressPct: 25 }])).toEqual({ start: '2026-01-01', end: '2026-01-30', progressPct: 50 });
    expect(lotSpan({ start: '2026-03', end: '2026-06', physicalPct: 40 }, [])).toEqual({ start: '2026-03-01', end: '2026-06-30', progressPct: 40 });
    expect(lotSpan({ start: null, end: null, physicalPct: null }, [])).toBeNull();
    expect(epc2iSpan({ milestones: [{ code: 'commande', plannedOn: '2026-07-08', actualOn: '2026-07-10' }, { code: 'sat', plannedOn: '2027-04-01', actualOn: null }], progress: { physicalPct: 35, endOn: '2027-05-15' } }))
      .toEqual({ start: '2026-07-10', end: '2027-05-15', progressPct: 35 });
  });

  it('checks a task', () => {
    const ctx = { lots: new Set(['L']), people: new Set(['P']) };
    expect(checkTask({ name: 'Survey', lotId: 'L', startOn: '2026-10-01', endOn: '2026-10-31', progressPct: '30', ownerUserId: 'P' }, ctx)).toMatchObject({ ok: true, value: { lotId: 'L', progressPct: 30, milestone: false } });
    expect(checkTask({ name: 'Ready', startOn: '2026-10-01', milestone: 'on' }, ctx)).toMatchObject({ ok: true, value: { endOn: '2026-10-01', milestone: true } });
    expect(checkTask({ name: 'Survey', startOn: '2026-10-31', endOn: '2026-10-01' }, ctx)).toEqual({ ok: false, error: 'The end comes before the start' });
    expect(checkTask({ name: 'Survey', lotId: 'X', startOn: '2026-10-01', endOn: '2026-10-02' }, ctx)).toEqual({ ok: false, error: 'Unknown lot' });
    expect(checkTask({ name: 'Survey', startOn: '2026-10-01', endOn: '2026-10-02', progressPct: '120' }, ctx)).toEqual({ ok: false, error: 'Progress goes from 0 to 100 %' });
  });
});

describe('the schedule of the demo CAPEX', () => {
  it('APM: tasks under lots and of the CAPEX; SAI: EPC2i projects as summary bars; one summary bar per CAPEX', async () => {
    const apm = await row('CPX-APM-2026-01');
    const s = await scheduleOf(t.db, apm);
    expect(s.general.map((x) => x.name)).toEqual(['Preliminary design studies (APS)', 'Detailed design (APD)', 'G2 dossier ready']);
    expect(s.lots.find((l) => l.tasks.length)?.tasks[0].name).toBeDefined();
    expect(s.milestones.map((m) => m.label)).toContain('G1');
    expect(s.summary?.start).toBe('2026-03-02');
    const sai = await row('CPX-SAI-2026-01');
    const ss = await scheduleOf(t.db, sai);
    expect(ss.epc2i.length).toBeGreaterThan(0);
    expect(ss.epc2i.every((p) => p.span)).toBe(true);
    const port = await portfolioSchedule(t.db, [apm, sai]);
    expect(port.map((x) => [x.code, !!x.summary])).toEqual([['CPX-APM-2026-01', true], ['CPX-SAI-2026-01', true]]);
  });

  it('the lead adds, edits and removes a task; a controller cannot', async () => {
    const apm = await row('CPX-APM-2026-01');
    as('controller');
    expect(await saveTaskAction('CPX-APM-2026-01', null, null, form({ name: 'Survey', startOn: '2026-11-01', endOn: '2026-11-30' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('project_lead');
    expect(await saveTaskAction('CPX-APM-2026-01', null, null, form({ name: 'Permit application', startOn: '2026-11-02', endOn: '2027-01-15', progressPct: '10' }))).toEqual({ ok: true });
    const [x] = await t.db.select().from(wbsTasks).where(and(eq(wbsTasks.capexId, apm.id), eq(wbsTasks.number, 6)));
    expect(x).toMatchObject({ name: 'Permit application', progressPct: 10, lotId: null });
    expect(await saveTaskAction('CPX-APM-2026-01', x.id, null, form({ name: 'Permit application', startOn: '2026-11-02', endOn: '2027-01-15', progressPct: '40' }))).toEqual({ ok: true });
    expect((await t.db.select().from(wbsTasks).where(eq(wbsTasks.id, x.id)))[0].progressPct).toBe(40);
    expect(await deleteTaskAction('CPX-APM-2026-01', x.id)).toEqual({ ok: true });
    expect(await t.db.$count(wbsTasks, eq(wbsTasks.id, x.id))).toBe(0);
  });
});
