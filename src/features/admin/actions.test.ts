// Administration Server Functions on a fresh PostgreSQL database, demo mode ("View as"): who may act, what is written, what
// is audited, and the self-lockout guard.
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
import { auditEntries, referenceRevenues, roleAssignments, sites, subsidiaries, users, zones } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';
import {
  addRoleAction, createSiteAction, createSubsidiaryAction, createUserAction, createZoneAction, removeRoleAction, setRevenueAction, setUserActiveAction,
} from './actions';

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
const lastAudit = async () => (await t.db.select().from(auditEntries).orderBy(desc(auditEntries.occurredAt)).limit(1))[0];
const userId = async (email: string) => (await t.db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]?.id;

describe('administration actions', () => {
  it('are refused to every profile but the administrator', async () => {
    as('ceo');
    expect(await createUserAction(null, form({ email: 'x@y.example', displayName: 'X Y' }))).toEqual({ ok: false, error: 'This action is reserved to the administrator' });
    as('sponsor');
    expect((await createZoneAction(null, form({ code: 'AFE', name: 'East Africa' }))).ok).toBe(false);
    expect(await userId('x@y.example')).toBeUndefined();
  });

  it('create an account, give and remove a role, deactivate and reactivate it — every step audited', async () => {
    as('admin');
    expect(await createUserAction(null, form({ email: 'Ana.Ruiz@atlas-process.example', displayName: 'Ana Ruiz', subsidiaryCode: 'APM', jobTitle: 'HSE engineer' }))).toEqual({ ok: true });
    const id = (await userId('ana.ruiz@atlas-process.example'))!;
    expect(await lastAudit()).toMatchObject({ objectRef: 'User ana.ruiz@atlas-process.example', change: 'account created', area: 'Administration', actorRole: 'admin' });
    expect(await createUserAction(null, form({ email: 'ana.ruiz@atlas-process.example', displayName: 'Ana' }))).toEqual({ ok: false, error: 'An account already has this e-mail address' });

    expect(await addRoleAction(null, form({ userId: id, role: 'expert', scopeRef: 'CPX-APM-2026-01', speciality: 'hse' }))).toEqual({ ok: true });
    expect(await addRoleAction(null, form({ userId: id, role: 'sponsor', scopeRef: 'ZZZ' }))).toEqual({ ok: false, error: 'Choose a subsidiary' });
    const [a] = await t.db.select().from(roleAssignments).where(eq(roleAssignments.userId, id));
    expect(a).toMatchObject({ role: 'expert', scopeKind: 'capex', scopeRef: 'CPX-APM-2026-01', speciality: 'hse', createdByName: 'Arche administrator' });
    expect(await lastAudit()).toMatchObject({ change: 'role added: expert · CPX-APM-2026-01' });

    expect(await removeRoleAction(a.id)).toEqual({ ok: true });
    expect(await t.db.$count(roleAssignments, eq(roleAssignments.userId, id))).toBe(0);
    expect(await lastAudit()).toMatchObject({ change: 'role removed: expert · CPX-APM-2026-01' });

    expect(await setUserActiveAction(id, false)).toEqual({ ok: true });
    expect((await t.db.select({ a: users.active }).from(users).where(eq(users.id, id)))[0].a).toBe(false);
    expect(await setUserActiveAction(id, true)).toEqual({ ok: true });
    expect(await lastAudit()).toMatchObject({ change: 'account reactivated' });
  });

  it('an administrator cannot deactivate themselves nor remove their own last administrator role', async () => {
    as('admin');
    const me = (await userId('admin.arche@groupe.example'))!;
    expect(await setUserActiveAction(me, false)).toEqual({ ok: false, error: 'You cannot deactivate your own account' });
    const [mine] = await t.db.select().from(roleAssignments).where(and(eq(roleAssignments.userId, me), eq(roleAssignments.role, 'admin')));
    expect(await removeRoleAction(mine.id)).toEqual({ ok: false, error: 'You cannot remove your own last administrator role' });
  });

  it('organisation: zone, subsidiary, site; the reference revenue by the group CFO, updated in place', async () => {
    as('admin');
    expect(await createZoneAction(null, form({ code: 'AFE', name: 'East Africa' }))).toEqual({ ok: true });
    expect(await createSubsidiaryAction(null, form({ code: 'kel', name: 'Kilima East Ltd', countryIso2: 'KE', zoneCode: 'AFE', currency: 'KES' }))).toEqual({ ok: true });
    expect(await createSiteAction(null, form({ subsidiaryCode: 'KEL', name: 'Nakuru plant', city: 'Nakuru' }))).toEqual({ ok: true });
    expect(await createSiteAction(null, form({ subsidiaryCode: 'KEL', name: 'nakuru plant' }))).toMatchObject({ ok: false });
    expect(await t.db.$count(zones, eq(zones.code, 'AFE'))).toBe(1);
    expect((await t.db.select().from(subsidiaries).where(eq(subsidiaries.code, 'KEL')))[0]).toMatchObject({ zoneCode: 'AFE', currency: 'KES' });
    expect((await t.db.select().from(sites).where(eq(sites.subsidiaryCode, 'KEL')))[0]).toMatchObject({ name: 'Nakuru plant', countryIso2: 'KE' });

    as('sponsor');
    expect(await setRevenueAction(null, form({ subsidiaryCode: 'APM', fiscalYear: '2025', revenueKeur: '45000' }))).toEqual({ ok: false, error: 'This action is reserved to the group CFO' });
    as('group_cfo');
    expect(await setRevenueAction(null, form({ subsidiaryCode: 'APM', fiscalYear: '2025', revenueKeur: '45000' }))).toEqual({ ok: true });
    expect(await setRevenueAction(null, form({ subsidiaryCode: 'APM', fiscalYear: '2025', revenueKeur: '47 500' }))).toEqual({ ok: true });
    const rows = await t.db.select().from(referenceRevenues).where(eq(referenceRevenues.subsidiaryCode, 'APM'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fiscalYear: 2025, revenueKeur: 47500, enteredByName: 'Paul Renaud' });
    expect(await lastAudit()).toMatchObject({ change: 'revenue: 45000 → 47500 k€', actorRole: 'group_cfo' });
  });
});
