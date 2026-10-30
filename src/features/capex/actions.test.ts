// CAPEX Server Functions on a fresh PostgreSQL database with the demo data set ("View as"): a new CAPEX goes through the
// four DIG-PRODI phases to closure, with the rights, the isolation, the budget funnel, the typology and the audit trail.
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
import { auditEntries, budgetVersions, capex, capexLots, capexMembers, roleAssignments, users } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';
import {
  addDecisionAction, addLotAction, addMemberAction, confirmTypologyAction, createCapexAction, forceTypologyAction, openCapexAction,
  removeMemberAction, reviewVersionAction, saveBudgetVersionAction, saveRiskAction, submitVersionAction, suspendAction, updateSheetAction,
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
const row = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];
const lastAudit = async () => (await t.db.select().from(auditEntries).orderBy(desc(auditEntries.occurredAt)).limit(1))[0];
const userId = async (email: string) => (await t.db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0].id;
const versionOf = async (capexId: string, n: number) => (await t.db.select().from(budgetVersions).where(and(eq(budgetVersions.capexId, capexId), eq(budgetVersions.number, n))))[0];

async function newVersion(code: string, cls: string, amounts: string[]) {
  const c = await row(code);
  const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id)).orderBy(capexLots.number);
  return saveBudgetVersionAction(code, null, null, form({ estimateClass: cls, currency: 'EUR', basis: `${cls} basis`, ...Object.fromEntries(lots.map((l, i) => [`lot:${l.id}`, amounts[i] ?? '0'])) }));
}

describe('a CAPEX through the DIG-PRODI cycle', () => {
  const CODE = 'CPX-APM-2026-03';

  it('a project lead creates a draft in their subsidiary; it stays inside the subsidiary', async () => {
    as('dir_ig');
    expect(await createCapexAction(null, form({ title: 'Recycling line', investmentType: 'new_line' }))).toEqual({ ok: false, error: 'You cannot create a CAPEX in this subsidiary' });
    as('project_lead');
    expect(await createCapexAction(null, form({ title: 'x', investmentType: 'new_line' }))).toMatchObject({ ok: false });
    expect(await createCapexAction(null, form({ title: 'Recycling line', investmentType: 'new_line', needDate: '2027-12-01' }))).toEqual({ ok: true, code: CODE });
    const c = await row(CODE);
    expect(c).toMatchObject({ status: 'draft', phase: 'cadrage', subsidiaryCode: 'APM', needDate: '2027-12-01' });
    const lead = await userId('l.haddad@atlas-process.example');
    expect(c.leadUserId).toBe(lead);
    expect(await t.db.$count(roleAssignments, and(eq(roleAssignments.userId, lead), eq(roleAssignments.scopeRef, CODE)))).toBe(1);
    expect(await lastAudit()).toMatchObject({ objectRef: CODE, change: 'CAPEX created (draft)', area: 'CAPEX', capexId: c.id });
    // Central functions do not see drafts (N-5); another subsidiary never sees it.
    as('dir_ig');
    expect(await updateSheetAction(CODE, null, form({ title: 'Changed', investmentType: 'other' }))).toEqual({ ok: false, error: 'CAPEX not found' });
    as('sponsor');
    expect((await updateSheetAction(CODE, null, form({ title: 'Recycling line 2', investmentType: 'new_line' }))).ok).toBe(true);
    expect(await lastAudit()).toMatchObject({ change: 'identity sheet updated: title, needDate' });
  });

  it('only the sponsor opens it; then lots, team and an E50 version validated by the controller', async () => {
    as('project_lead');
    expect(await openCapexAction(CODE)).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('sponsor');
    expect(await openCapexAction(CODE)).toEqual({ ok: true });
    expect(await row(CODE)).toMatchObject({ status: 'active', phase: 'cadrage', lifecycleModelVersion: '4.0' });

    as('project_lead');
    expect(await newVersion(CODE, 'E50', [])).toEqual({ ok: false, error: 'Add the lots of the CAPEX first' });
    expect(await addLotAction(CODE, null, form({ kind: 'civil_works', title: 'Slab' }))).toEqual({ ok: true });
    expect(await addLotAction(CODE, null, form({ kind: 'machines', title: 'Shredder and extruder (EPC2i)' }))).toEqual({ ok: true });
    const coDig = await userId('t.girard@groupe.example');
    const saiPerson = await userId('f.sarr@sahel-agro.example');
    expect(await addMemberAction(CODE, null, form({ userId: saiPerson, capexRole: 'member' }))).toEqual({ ok: false, error: 'Choose a person of the subsidiary or of the group' });
    expect(await addMemberAction(CODE, null, form({ userId: coDig, capexRole: 'co_dig' }))).toEqual({ ok: true });
    expect(await t.db.$count(roleAssignments, and(eq(roleAssignments.userId, coDig), eq(roleAssignments.role, 'co_dig'), eq(roleAssignments.scopeRef, CODE)))).toBe(1);

    expect(await newVersion(CODE, 'E50', ['500', '2 500'])).toEqual({ ok: true });
    expect(await newVersion(CODE, 'E30', ['1', '1'])).toEqual({ ok: false, error: 'Finish the version in progress first' });
    const c = await row(CODE);
    const v1 = await versionOf(c.id, 1);
    expect(await submitVersionAction(CODE, v1.id)).toEqual({ ok: true });
    expect(await reviewVersionAction(CODE, v1.id, 'validate')).toMatchObject({ ok: false });
    as('controller');
    expect(await reviewVersionAction(CODE, v1.id, 'return')).toEqual({ ok: false, error: 'Give the reason for the return' });
    expect(await reviewVersionAction(CODE, v1.id, 'validate')).toEqual({ ok: true });
    // 3 000 k€ / 62 000 k€ = 4.8 % → Light, set directly the first time.
    expect(await row(CODE)).toMatchObject({ typology: 'light', typologySource: 'computed', typologyProposed: null });
  });

  it('an E10 version is validated by the group CFO only; the typology change waits for the group industrial director', async () => {
    as('project_lead');
    expect(await newVersion(CODE, 'E10', ['900', '12 000'])).toEqual({ ok: true });
    const c = await row(CODE);
    const v2 = await versionOf(c.id, 2);
    expect(await submitVersionAction(CODE, v2.id)).toEqual({ ok: true });
    as('controller');
    expect(await reviewVersionAction(CODE, v2.id, 'validate')).toEqual({ ok: false, error: 'Only the group CFO validates an E10 version' });
    as('group_cfo');
    expect(await reviewVersionAction(CODE, v2.id, 'validate')).toEqual({ ok: true });
    expect((await versionOf(c.id, 1)).status).toBe('superseded');
    // 12 900 / 62 000 = 20.8 % → Strategic: proposed, not applied.
    expect(await row(CODE)).toMatchObject({ typology: 'light', typologyProposed: 'strategic' });
    expect(await lastAudit()).toMatchObject({ change: 'typology to confirm: light → strategic (ratio 20.8 %)' });
    as('dir_ig');
    expect(await confirmTypologyAction(CODE)).toEqual({ ok: true });
    expect(await row(CODE)).toMatchObject({ typology: 'strategic', typologyProposed: null });
  });
});

describe('other rules', () => {
  it('another subsidiary never sees nor writes an APM CAPEX', async () => {
    // The expert of SAI and the EPC2i PMO are scoped to the SAI CAPEX only.
    as('expert');
    expect(await saveRiskAction('CPX-APM-2026-01', null, null, form({ title: 'Some risk', category: 'cost', probability: '2', impact: '2' }))).toEqual({ ok: false, error: 'CAPEX not found' });
    as('epc2i_pmo');
    expect(await addDecisionAction('CPX-APM-2026-01', null, form({ takenOn: '2026-10-01', body: 'copil_projet', text: 'Something' }))).toEqual({ ok: false, error: 'CAPEX not found' });
  });

  it('risks and decisions by the lead; typology forced by the group industrial director with a reason', async () => {
    as('project_lead');
    expect(await saveRiskAction('CPX-APM-2026-01', null, null, form({ title: 'Customs delay on the die', category: 'schedule', probability: '3', impact: '2' }))).toEqual({ ok: true });
    expect(await lastAudit()).toMatchObject({ change: 'risk R-03 added: Customs delay on the die' });
    expect(await addDecisionAction('CPX-APM-2026-01', null, form({ takenOn: '2026-10-20', body: 'copil_projet', text: 'Die ordered early' }))).toEqual({ ok: true });
    as('dir_ig');
    expect(await forceTypologyAction('CPX-APM-2026-01', null, form({ typology: 'strategic', reason: '' }))).toEqual({ ok: false, error: 'Give the reason for forcing the typology' });
    expect(await forceTypologyAction('CPX-APM-2026-01', null, form({ typology: 'strategic', reason: 'First line of a new product family' }))).toEqual({ ok: true });
    expect(await row('CPX-APM-2026-01')).toMatchObject({ typology: 'strategic', typologySource: 'forced', typologyReason: 'First line of a new product family' });
  });

  it('suspension and resumption by the group industrial director; a suspended CAPEX faces no gate', async () => {
    as('dir_ig');
    expect(await suspendAction('CPX-SAI-2026-01', 'suspend', ' ')).toEqual({ ok: false, error: 'Give the reason for the decision' });
    expect(await suspendAction('CPX-SAI-2026-01', 'suspend', 'Financing under review')).toEqual({ ok: true });
    expect((await row('CPX-SAI-2026-01')).status).toBe('on_hold');
    expect(await suspendAction('CPX-SAI-2026-01', 'resume', 'Financing confirmed')).toEqual({ ok: true });
    expect(await row('CPX-SAI-2026-01')).toMatchObject({ status: 'active', phase: 'execution' });
  });

  it('removing the lead clears it and its CAPEX role; a draft without lead cannot be opened', async () => {
    as('sponsor');
    const c = await row('CPX-APM-2026-02');
    const [m] = await t.db.select().from(capexMembers).where(and(eq(capexMembers.capexId, c.id), eq(capexMembers.capexRole, 'lead')));
    expect(await removeMemberAction('CPX-APM-2026-02', m.id)).toEqual({ ok: true });
    expect((await row('CPX-APM-2026-02')).leadUserId).toBeNull();
    expect(await openCapexAction('CPX-APM-2026-02')).toEqual({ ok: false, error: 'Name the project lead before opening the CAPEX' });
  });
});
