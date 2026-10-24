// Guided opening of a CAPEX (owner, 24 Oct 2026) on a fresh PostgreSQL database with the demo data set: a sponsor creates and
// opens a CAPEX with its lots, indicative E50 budget, team, risks and business case sections in one go; another one taken over
// in phase 3; a project lead creates a draft only; what is not answered stays for later.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { asc, eq } from 'drizzle-orm';
import { checkGuided, dossierOfPhase, guidedGaps } from '@/domain/guided';
import { budgetVersions, capex, capexLots, capexMembers, dossiers, dossierVersions, gates, risks, roleAssignments, users } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';
import { openGuidedAction } from './guided';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const as = (role: string) => jar.set('arche-role', role);
const userId = async (email: string) => (await t.db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0].id;
const row = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];

describe('the rules of the guided opening', () => {
  const ctx = { today: '2026-10-22', role: 'sponsor' as const, userId: 'S', sites: new Set<string>(), people: new Set(['L', 'C']), sponsorUserId: 'S' };
  it('only the title and the type are required; the rest is left for later', () => {
    const ch = checkGuided({ sheet: { title: 'Boiler house', investmentType: 'other' } }, ctx);
    expect(ch).toMatchObject({ ok: true, value: { mode: 'new', finish: 'draft', lots: [], budget: null, team: [], risks: [], sections: [], dossier: 'business_case' } });
    if (ch.ok) expect(guidedGaps(ch.value)).toEqual(['Project lead', 'Lots', 'Indicative E50 budget', 'Team', 'Initial risks', 'Dossier sections']);
    expect(checkGuided({ sheet: { title: 'x', investmentType: 'other' } }, ctx)).toMatchObject({ ok: false });
  });
  it('opening needs the lead; a project lead creates a draft only; a risk owner is in the team', () => {
    expect(checkGuided({ finish: 'open', sheet: { title: 'Boiler house', investmentType: 'other' } }, ctx)).toEqual({ ok: false, error: 'Name the project lead first' });
    expect(checkGuided({ finish: 'open', sheet: { title: 'Boiler house', investmentType: 'other' } }, { ...ctx, role: 'project_lead', userId: 'L' })).toEqual({ ok: false, error: 'Only the sponsor opens or takes over a CAPEX' });
    expect(checkGuided({ sheet: { title: 'Boiler house', investmentType: 'other', leadUserId: 'X' } }, ctx)).toEqual({ ok: false, error: 'Choose a person of the subsidiary or of the group' });
    expect(checkGuided({ sheet: { title: 'Boiler house', investmentType: 'other' }, risks: [{ title: 'Late boiler', category: 'schedule', probability: '2', impact: '3', ownerUserId: 'C' }] }, ctx)).toMatchObject({ ok: false });
    expect(checkGuided({ sheet: { title: 'Boiler house', investmentType: 'other' }, budget: { amounts: ['100'] } }, ctx)).toEqual({ ok: false, error: 'Add the lots of the CAPEX first' });
    expect(dossierOfPhase('avant_projet')).toBe('investment');
  });
});

describe('a CAPEX opened with the guided opening', () => {
  it('a sponsor creates and opens a CAPEX with everything answered, in one transaction', async () => {
    const lead = await userId('l.haddad@atlas-process.example');
    const ctl = await userId('n.tazi@atlas-process.example');
    as('sponsor');
    const r = await openGuidedAction('APM', {
      finish: 'open',
      sheet: { title: 'Anodising line', investmentType: 'new_line', leadUserId: lead, description: 'Anodising of the extruded profiles' },
      lots: [{ kind: 'civil_works', title: 'Slab and pits' }, { kind: 'machines', title: 'Anodising line (EPC2i)' }, { kind: 'other', title: '' }],
      budget: { basis: 'Ratios', amounts: ['300', '2 100'] },
      team: [{ userId: ctl, capexRole: 'controller' }, { userId: '', capexRole: 'member' }],
      risks: [{ title: 'Effluent treatment permit', category: 'regulatory', probability: '3', impact: '3', ownerUserId: lead }],
      sections: { need: 'Anodise 3 000 t/year of profiles in house.', strategy: '' },
    });
    expect(r).toEqual({ ok: true, code: 'CPX-APM-2026-03' });
    const c = await row('CPX-APM-2026-03');
    expect(c).toMatchObject({ status: 'active', phase: 'cadrage', leadUserId: lead, lifecycleModelVersion: '4.0' });
    expect((await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id)).orderBy(asc(capexLots.number))).map((l) => [l.number, l.title, l.epc2i])).toEqual([[1, 'Slab and pits', false], [2, 'Anodising line (EPC2i)', true]]);
    const [bv] = await t.db.select().from(budgetVersions).where(eq(budgetVersions.capexId, c.id));
    expect(bv).toMatchObject({ number: 1, estimateClass: 'E50', status: 'draft', basis: 'Ratios' });
    expect((await t.db.select().from(capexMembers).where(eq(capexMembers.capexId, c.id))).map((m) => m.capexRole).sort()).toEqual(['controller', 'lead']);
    expect(await t.db.$count(roleAssignments, eq(roleAssignments.scopeRef, 'CPX-APM-2026-03'))).toBe(1);
    expect((await t.db.select().from(risks).where(eq(risks.capexId, c.id)))[0]).toMatchObject({ number: 1, title: 'Effluent treatment permit', ownerUserId: lead });
    const [v] = await t.db.select({ content: dossierVersions.content, state: dossierVersions.state, kind: dossiers.kind }).from(dossierVersions).innerJoin(dossiers, eq(dossiers.id, dossierVersions.dossierId)).where(eq(dossiers.capexId, c.id));
    expect(v.kind).toBe('business_case');
    expect(v.state).toBe('draft');
    expect((v.content as { sections: Record<string, { text: string }> }).sections.need.text).toBe('Anodise 3 000 t/year of profiles in house.');
  });

  it('a sponsor takes over a CAPEX in phase 3: gates taken over, E10 baseline on the lots created', async () => {
    const lead = await userId('l.haddad@atlas-process.example');
    as('sponsor');
    const r = await openGuidedAction('APM', {
      mode: 'takeover', finish: 'takeover',
      sheet: { title: 'Press line already ordered', investmentType: 'new_line', leadUserId: lead },
      lots: [{ kind: 'civil_works', title: 'Slab' }, { kind: 'machines', title: 'Press (EPC2i)' }],
      takeover: { phase: 'execution', openedOn: '2025-11-03', 'G1:on': '2026-01-15', 'G1:by': 'Marc Delorme', 'G2:on': '2026-06-10', 'G2:by': 'Anne Morel', estimateClass: 'E10', validatedOn: '2026-06-02', validatedByName: 'Sophie Laurent', amounts: ['400', '1800'] },
      sections: { baseline: 'Not used in phase 3' },
    });
    expect(r).toEqual({ ok: true, code: 'CPX-APM-2026-04' });
    const c = await row('CPX-APM-2026-04');
    expect(c).toMatchObject({ status: 'active', phase: 'execution' });
    expect((await t.db.select().from(gates).where(eq(gates.capexId, c.id))).map((g) => [g.code, g.takenOver])).toEqual([['G1', true], ['G2', true]]);
    const [bv] = await t.db.select().from(budgetVersions).where(eq(budgetVersions.capexId, c.id));
    expect(bv).toMatchObject({ estimateClass: 'E10', status: 'validated', isG2Baseline: true });
  });

  it('a project lead creates a draft only, as its lead; a central function creates nothing', async () => {
    as('project_lead');
    expect(await openGuidedAction('APM', { finish: 'open', sheet: { title: 'Paint shop', investmentType: 'extension' } })).toEqual({ ok: false, error: 'Only the sponsor opens or takes over a CAPEX' });
    expect(await openGuidedAction('APM', { sheet: { title: 'Paint shop', investmentType: 'extension' } })).toEqual({ ok: true, code: 'CPX-APM-2026-05' });
    expect(await row('CPX-APM-2026-05')).toMatchObject({ status: 'draft', leadUserId: await userId('l.haddad@atlas-process.example') });
    expect(await openGuidedAction('SAI', { sheet: { title: 'Paint shop', investmentType: 'extension' } })).toEqual({ ok: false, error: 'You cannot create a CAPEX in this subsidiary' });
    as('dir_ig');
    expect(await openGuidedAction('APM', { sheet: { title: 'Paint shop', investmentType: 'extension' } })).toEqual({ ok: false, error: 'You cannot create a CAPEX in this subsidiary' });
  });
});
