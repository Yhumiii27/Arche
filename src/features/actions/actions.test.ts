// Action plan (owner's pilot feedback, 24 Oct 2026) on a fresh PostgreSQL database with the demo data set: the rules, opening
// and editing an action (right `actions`), closing it (also its owner), my actions, and the demo plans.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, desc, eq } from 'drizzle-orm';
import { actionCounts, checkAction, checkClosing, isLate } from '@/domain/actions';
import { auditEntries, capex, capexActions, users } from '@/server/db/schema';
import { myActions } from '@/server/dal/actions';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { closeActionAction, saveActionAction } from './actions';

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
const APM = 'CPX-APM-2026-01';
const userId = async (email: string) => (await t.db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0].id;

describe('the rules of the action plan', () => {
  it('checks an action and its closing; late = open past its due date', () => {
    expect(checkAction({ title: 'Order the survey', source: 'risk', ownerUserId: 'X' }, { people: new Set(['X']) })).toMatchObject({ ok: true, value: { source: 'risk', ownerUserId: 'X' } });
    expect(checkAction({ title: 'x' }, { people: new Set() })).toEqual({ ok: false, error: 'Describe the action' });
    expect(checkAction({ title: 'Order the survey', ownerUserId: 'Y' }, { people: new Set(['X']) })).toEqual({ ok: false, error: 'Choose the owner in the team' });
    expect(checkClosing({ status: 'open' }, 'cancelled', ' ')).toEqual({ ok: false, error: 'Give the reason for the cancellation' });
    expect(checkClosing({ status: 'done' }, 'done', '')).toEqual({ ok: false, error: 'This action is already closed' });
    expect(isLate({ status: 'open', dueOn: '2026-10-01' }, '2026-10-22')).toBe(true);
    expect(actionCounts([{ status: 'open', dueOn: '2026-10-01' }, { status: 'open', dueOn: null }, { status: 'done', dueOn: '2026-01-01' }], '2026-10-22')).toEqual({ open: 2, late: 1, done: 1 });
  });
});

describe('the action plan of a CAPEX', () => {
  it('the demo plans; the lead opens and edits an action; an expert outside the CAPEX cannot', async () => {
    const id = (await t.db.select().from(capex).where(eq(capex.code, APM)))[0].id;
    expect(await t.db.$count(capexActions, eq(capexActions.capexId, id))).toBe(4);
    const lead = await userId('l.haddad@atlas-process.example');
    as('project_lead');
    expect(await saveActionAction(APM, null, null, form({ title: 'Ask EPC2i for the die lead time', source: 'machines', ownerUserId: lead, dueOn: '2026-11-15' }))).toEqual({ ok: true });
    const [a] = await t.db.select().from(capexActions).where(and(eq(capexActions.capexId, id), eq(capexActions.number, 5)));
    expect(a).toMatchObject({ title: 'Ask EPC2i for the die lead time', source: 'machines', status: 'open', ownerUserId: lead });
    expect(await saveActionAction(APM, a.id, null, form({ title: 'Ask EPC2i for the die lead time', source: 'machines', dueOn: '2026-11-20' }))).toEqual({ ok: true });
    const [audit] = await t.db.select().from(auditEntries).orderBy(desc(auditEntries.occurredAt)).limit(1);
    expect(audit).toMatchObject({ change: 'action A-05 updated', objectRef: APM });
    as('expert');
    expect(await saveActionAction(APM, null, null, form({ title: 'Anything' }))).toEqual({ ok: false, error: 'CAPEX not found' });
  });

  it('closing: done by the lead, cancelled with a reason; my actions on Home', async () => {
    const id = (await t.db.select().from(capex).where(eq(capex.code, APM)))[0].id;
    const [a1] = await t.db.select().from(capexActions).where(and(eq(capexActions.capexId, id), eq(capexActions.number, 1)));
    as('project_lead');
    const mine = await myActions(await getViewer());
    // Open actions owned by the lead, by due date (A-05 lost its owner when edited).
    expect(mine.filter((x) => x.capex.code === APM).map((x) => x.number)).toEqual([1, 2]);
    expect(await closeActionAction(APM, a1.id, 'cancelled', '')).toEqual({ ok: false, error: 'Give the reason for the cancellation' });
    expect(await closeActionAction(APM, a1.id, 'done', 'Survey ordered on 20 October')).toEqual({ ok: true });
    expect((await t.db.select().from(capexActions).where(eq(capexActions.id, a1.id)))[0]).toMatchObject({ status: 'done', closedOn: '2026-10-22', closingNote: 'Survey ordered on 20 October' });
    expect(await closeActionAction(APM, a1.id, 'done', '')).toEqual({ ok: false, error: 'This action is already closed' });
  });
});
