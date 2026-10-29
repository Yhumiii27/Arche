// Ideas backlog and benefits (AR-051, AR-046) on a fresh database with the demo data set: an idea proposed by a controller,
// retained by the sponsor, turned into a CAPEX draft by the guided opening; outside the scope, refused. The ageing oven, in
// start-up since 1 Jul 2026: its benefits entered by the controller, its 6-month post-audit held by the group industrial
// director once due (the business clock moved), shown in their inbox before.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { capex, ideas, postAudits } from '@/server/db/schema';
import { approvalsOf } from '@/server/dal/approvals';
import { benefitsOf } from '@/server/dal/benefits';
import { ideaSubsidiaries } from '@/server/dal/ideas';
import { getViewer } from '@/server/session';
import { setClockForTests } from '@/server/clock';
import { testDatabase, type TestDatabase } from '@/test/db';
import { openGuidedAction } from '@/features/capex/guided';
import { recordPostAuditAction, saveBenefitAction } from '@/features/benefits/actions';
import { decideIdeaAction, proposeIdeaAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => {
  setClockForTests(null);
  return t.close();
});
beforeEach(() => jar.set('arche-role', 'controller'));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const ideaNamed = async (title: string) => (await t.db.select().from(ideas).where(eq(ideas.title, title)))[0];

describe('ideas backlog (AR-051)', () => {
  it('the APM controller proposes for APM only; numbered in the subsidiary', async () => {
    expect(await ideaSubsidiaries(t.db, await getViewer())).toEqual(['APM']);
    expect(await proposeIdeaAction(null, form({ subsidiaryCode: 'SAI', title: 'Cold store', stake: 'Store the paste before shipping' }))).toMatchObject({ ok: false });
    expect(await proposeIdeaAction(null, form({ subsidiaryCode: 'APM', title: 'Heat recovery on the press', stake: 'Recover the heat of the extrusion press for the ageing oven', sizeKeur: '180' }))).toEqual({ ok: true });
    expect(await ideaNamed('Heat recovery on the press')).toMatchObject({ number: 4, status: 'new', sizeKeur: 180 });
  });

  it('the sponsor decides: qualify then retain; the controller may not; set aside needs a reason', async () => {
    const i = await ideaNamed('Heat recovery on the press');
    expect(await decideIdeaAction(i.id, null, form({ decision: 'qualify' }))).toMatchObject({ ok: false });
    jar.set('arche-role', 'sponsor');
    expect(await decideIdeaAction(i.id, null, form({ decision: 'reject' }))).toEqual({ ok: false, error: 'Say why the idea is set aside' });
    expect(await decideIdeaAction(i.id, null, form({ decision: 'qualify', note: 'Size it with EPC2i' }))).toEqual({ ok: true });
    expect(await decideIdeaAction(i.id, null, form({ decision: 'retain' }))).toEqual({ ok: true });
    expect(await ideaNamed('Heat recovery on the press')).toMatchObject({ status: 'retained', decidedByName: 'Karim Benali' });
  });

  it('a retained idea becomes a CAPEX draft by the guided opening, marked converted', async () => {
    jar.set('arche-role', 'sponsor');
    const i = await ideaNamed('Heat recovery on the press');
    const sheet = { title: 'Heat recovery on the extrusion press', investmentType: 'other', description: i.stake };
    expect(await openGuidedAction('APM', { sheet }, (await ideaNamed('Automatic packing of the profiles')).id)).toEqual({ ok: false, error: 'Only a retained idea of the subsidiary becomes a CAPEX' });
    const r = await openGuidedAction('APM', { sheet }, i.id);
    expect(r).toMatchObject({ ok: true });
    const code = r.ok ? r.code! : '';
    const [c] = await t.db.select().from(capex).where(eq(capex.code, code));
    expect(await ideaNamed('Heat recovery on the press')).toMatchObject({ status: 'converted', capexId: c.id });
  });
});

describe('benefits and post-audits (AR-046)', () => {
  it('the controller enters year 1 of the oven; NPV recomputed on the realised flows', async () => {
    expect(await saveBenefitAction('CPX-APM-2025-01', null, form({ year: '1', revenueKeur: '410', opexKeur: '150' }))).toEqual({ ok: true });
    const [c] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-APM-2025-01'));
    const b = await benefitsOf(t.db, c, '2026-10-22');
    expect(b.rows[0]).toMatchObject({ year: 1, planned: 380, actual: 260, gap: -120 });
    expect(b.returns!.realNpv).toBeLessThan(b.returns!.planNpv);
    jar.set('arche-role', 'project_lead');
    expect(await saveBenefitAction('CPX-APM-2025-01', null, form({ year: '1', revenueKeur: '1', opexKeur: '1' }))).toMatchObject({ ok: false });
  });

  it('the 6-month post-audit: not due yet; due on 1 Jan 2027, in the director’s inbox, then held', async () => {
    jar.set('arche-role', 'dir_ig');
    const held = { milestone: '6', heldOn: '2027-01-08', conclusion: 'below', summary: 'Year 1 gain 30 % below the plan: scrap rate still high.' };
    expect(await recordPostAuditAction('CPX-APM-2025-01', null, form(held))).toEqual({ ok: false, error: 'This post-audit is not due or already held' });
    setClockForTests({ kind: 'fixed', iso: '2027-01-11' });
    expect((await approvalsOf(await getViewer())).find((i) => i.kind === 'post_audit')).toMatchObject({ capexCode: 'CPX-APM-2025-01', detail: 'M+6', due: '2027-01-01' });
    expect(await recordPostAuditAction('CPX-APM-2025-01', null, form(held))).toEqual({ ok: true });
    const [c] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-APM-2025-01'));
    expect((await t.db.select().from(postAudits).where(and(eq(postAudits.capexId, c.id), eq(postAudits.milestone, 6))))[0]).toMatchObject({ conclusion: 'below', recordedByName: 'Claire Morel' });
    expect(await recordPostAuditAction('CPX-APM-2025-01', null, form(held))).toMatchObject({ ok: false });
  });
});
