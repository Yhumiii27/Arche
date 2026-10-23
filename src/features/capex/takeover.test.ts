// Takeover of a CAPEX in progress (N-20, pilot) on a fresh PostgreSQL database with the demo data set: the sponsor opens a
// draft in phase 3 with G1 and G2 dated, the validated E10 budget as the G2 baseline; the gates are "taken over" (no circuit),
// the cycle history is dated, the typology is computed and the CAPEX then faces K3.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { asc, desc, eq } from 'drizzle-orm';
import { checkTakeover, gatesPassedBefore, takeoverClasses } from '@/domain/takeover';
import { auditEntries, budgetVersions, capex, capexLots, circuitSteps, gates, phaseTransitions } from '@/server/db/schema';
import { currentEvaluation } from '@/server/cycle/evaluation';
import { testDatabase, type TestDatabase } from '@/test/db';
import { addLotAction, createCapexAction, takeoverCapexAction } from './actions';

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
const CODE = 'CPX-APM-2026-03';
const row = async () => (await t.db.select().from(capex).where(eq(capex.code, CODE)))[0];

describe('the rules of a takeover', () => {
  const today = '2026-10-22';
  const base = { phase: 'execution', openedOn: '2025-11-03', 'G1:on': '2026-01-15', 'G1:by': 'Marc Delorme', 'G2:on': '2026-06-10', 'G2:by': 'Anne Morel', estimateClass: 'E10', validatedOn: '2026-06-02', validatedByName: 'Sophie Laurent', 'lot:a': '400', 'lot:b': '1 250,5' };

  it('the gates passed and the budget classes follow the phase', () => {
    expect(gatesPassedBefore('avant_projet')).toEqual(['G1']);
    expect(gatesPassedBefore('demarrage')).toEqual(['G1', 'G2', 'K3']);
    expect(takeoverClasses('avant_projet')).toEqual(['E50', 'E30']);
    expect(takeoverClasses('execution')).toEqual(['E10']);
  });

  it('accepts a coherent history and refuses dates out of order, in the future or a late E10', () => {
    const ok = checkTakeover(base, { today, lotIds: ['a', 'b'] });
    expect(ok).toMatchObject({ ok: true, value: { phase: 'execution', gates: [{ code: 'G1', decidedOn: '2026-01-15' }, { code: 'G2', decidedByName: 'Anne Morel' }], budget: { estimateClass: 'E10', lines: [{ lotId: 'a', amountKeur: 400 }, { lotId: 'b', amountKeur: 1250.5 }] } } });
    expect(checkTakeover({ ...base, phase: 'cadrage' }, { today, lotIds: ['a'] })).toEqual({ ok: false, error: 'Choose the current phase' });
    expect(checkTakeover(base, { today, lotIds: [] })).toEqual({ ok: false, error: 'Add the lots of the CAPEX first' });
    expect(checkTakeover({ ...base, 'G2:on': '2026-01-10' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'The date of G2 comes before the previous step' });
    expect(checkTakeover({ ...base, 'G1:on': '2026-11-01' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'Enter the date of G1 (not in the future)' });
    expect(checkTakeover({ ...base, 'G1:by': ' ' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'Name who decided G1' });
    expect(checkTakeover({ ...base, estimateClass: 'E30' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'Choose the class of the validated budget' });
    expect(checkTakeover({ ...base, validatedOn: '2026-07-01' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'The E10 budget is validated by G2 at the latest' });
    expect(checkTakeover({ ...base, 'lot:b': 'abc' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'Enter the amount of every lot (k€)' });
    expect(checkTakeover({ ...base, phase: 'demarrage', 'K3:on': '2026-09-01', 'K3:by': 'Marc Delorme', mesStartedOn: '2026-08-01' }, { today, lotIds: ['a', 'b'] })).toEqual({ ok: false, error: 'The start of commissioning comes before K3' });
  });
});

describe('a CAPEX taken over in phase 3', () => {
  it('only the sponsor takes over a draft, with its lots', async () => {
    as('project_lead');
    expect(await createCapexAction(null, form({ title: 'Press line already ordered', investmentType: 'new_line' }))).toEqual({ ok: true, code: CODE });
    as('sponsor');
    expect(await takeoverCapexAction(CODE, null, form({ phase: 'execution' }))).toEqual({ ok: false, error: 'Add the lots of the CAPEX first' });
    as('project_lead');
    expect(await addLotAction(CODE, null, form({ kind: 'civil_works', title: 'Slab' }))).toEqual({ ok: true });
    expect(await addLotAction(CODE, null, form({ kind: 'machines', title: 'Press (EPC2i)' }))).toEqual({ ok: true });
    expect(await takeoverCapexAction(CODE, null, form({ phase: 'execution' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
  });

  it('records the gates as taken over, the dated history, the E10 baseline and the audit trail', async () => {
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, (await row()).id)).orderBy(asc(capexLots.number));
    as('sponsor');
    expect(await takeoverCapexAction(CODE, null, form({
      phase: 'execution', openedOn: '2025-11-03', 'G1:on': '2026-01-15', 'G1:by': 'Marc Delorme', 'G2:on': '2026-06-10', 'G2:by': 'Anne Morel',
      estimateClass: 'E10', validatedOn: '2026-06-02', validatedByName: 'Sophie Laurent', [`lot:${lots[0].id}`]: '400', [`lot:${lots[1].id}`]: '1800',
    }))).toEqual({ ok: true });
    const c = await row();
    expect(c).toMatchObject({ status: 'active', phase: 'execution', lifecycleModelVersion: '4.0', takenOverByName: expect.any(String) });
    expect(c.openedAt?.toISOString().slice(0, 10)).toBe('2025-11-03');
    expect(c.typology).not.toBeNull();
    const gs = await t.db.select().from(gates).where(eq(gates.capexId, c.id)).orderBy(asc(gates.decidedAt));
    expect(gs.map((g) => [g.code, g.status, g.decision, g.takenOver, g.decidedByName, g.decidedAt?.toISOString().slice(0, 10)])).toEqual([
      ['G1', 'decided', 'go', true, 'Marc Delorme', '2026-01-15'], ['G2', 'decided', 'go', true, 'Anne Morel', '2026-06-10'],
    ]);
    expect(await t.db.$count(circuitSteps, eq(circuitSteps.gateId, gs[0].id))).toBe(0);
    const history = await t.db.select().from(phaseTransitions).where(eq(phaseTransitions.capexId, c.id)).orderBy(asc(phaseTransitions.effectiveOn));
    expect(history.map((h) => [h.effectiveOn, h.gateCode, h.toPhase, h.reason])).toEqual([
      ['2025-11-03', null, 'cadrage', 'Taken over in progress (N-20)'], ['2026-01-15', 'G1', 'avant_projet', 'Taken over in progress (N-20)'], ['2026-06-10', 'G2', 'execution', 'Taken over in progress (N-20)'],
    ]);
    const [bv] = await t.db.select().from(budgetVersions).where(eq(budgetVersions.capexId, c.id));
    expect(bv).toMatchObject({ estimateClass: 'E10', status: 'validated', isG2Baseline: true, validatedByName: 'Sophie Laurent', validatedByUserId: null });
    const audit = await t.db.select().from(auditEntries).where(eq(auditEntries.capexId, c.id)).orderBy(desc(auditEntries.occurredAt));
    expect(audit.map((a) => a.change)).toContainEqual(expect.stringMatching(/^taken over in progress \(N-20\): Draft → Active, phase execution; opened 2025-11-03; gates G1 2026-01-15 \(Marc Delorme\), G2 2026-06-10 \(Anne Morel\); budget version 1 \(E10\) validated 2026-06-02 by Sophie Laurent/));
    // The CAPEX now faces K3; the gate is evaluated on the current data.
    const ev = await currentEvaluation(t.db, c);
    expect(ev?.gate).toBe('K3');
  });

  it('cannot be taken over twice', async () => {
    as('sponsor');
    expect(await takeoverCapexAction(CODE, null, form({ phase: 'execution' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
  });
});
