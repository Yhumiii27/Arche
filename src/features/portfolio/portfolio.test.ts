// Prioritisation and scenarios (AR-044, AR-043) on a fresh database with the demo data set: the demo's ranking, the group's
// scores of a CAPEX (who may give them), the weights of the grid (the group industrial director only), a scenario that leaves
// out a CAPEX and shifts another, compared with the portfolio as it stands, and the scenario retained for the COPIL GPI.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { eq } from 'drizzle-orm';
import { ranked } from '@/domain/scoring';
import { evaluate } from '@/domain/scenarios';
import { auditEntries, capex, portfolioScenarios } from '@/server/db/schema';
import { prioritiesOf, scenariosOf, weightsOf } from '@/server/dal/priority';
import { testDatabase, type TestDatabase } from '@/test/db';
import { createScenarioAction, retainScenarioAction, saveWeightsAction, scoreCapexAction, updateScenarioAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'dir_ig'));

const TODAY = '2026-10-22';
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const capexOf = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];
const priorityOf = async (code: string) => {
  const c = await capexOf(code);
  return (await prioritiesOf(t.db, [{ id: c.id, bacKeur: 1000 }])).get(c.id)!;
};

describe('prioritisation (AR-044)', () => {
  it('the demo: the tomato plant scored on every criterion it has data for, ranked first of the scored CAPEX', async () => {
    const codes = ['CPX-SAI-2026-01', 'CPX-APM-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03', 'CPX-APM-2026-02'];
    const rows = await Promise.all(codes.map(async (code) => ({ code, ...(await priorityOf(code)) })));
    const sai = rows[0];
    expect(sai.criteria.find((c) => c.code === 'strategy')).toMatchObject({ score: 5, note: 'Group priority: tomato processing in West Africa' });
    expect(sai.score).not.toBeNull();
    expect(rows.find((r) => r.code === 'CPX-APM-2026-02')!.criteria.filter((c) => c.kind === 'manual').every((c) => c.score == null)).toBe(true);
    expect(ranked(rows)[0]).toMatchObject({ code: 'CPX-SAI-2026-01', rank: 1 });
  });

  it('the scores: a COPIL member scores, a sponsor is refused; a score outside 0–5 is refused', async () => {
    jar.set('arche-role', 'sponsor');
    expect(await scoreCapexAction('CPX-APM-2026-01', null, form({ 'score:urgency': '5' }))).toMatchObject({ ok: false });
    jar.set('arche-role', 'copil_member');
    expect(await scoreCapexAction('CPX-APM-2026-01', null, form({ 'score:urgency': '7' }))).toEqual({ ok: false, error: 'Scores go from 0 to 5' });
    const before = (await priorityOf('CPX-APM-2026-01')).score!;
    expect(await scoreCapexAction('CPX-APM-2026-01', null, form({ 'score:urgency': '5', 'note:urgency': 'Line 1 saturated' }))).toEqual({ ok: true });
    const after = await priorityOf('CPX-APM-2026-01');
    expect(after.criteria.find((c) => c.code === 'urgency')).toMatchObject({ score: 5, note: 'Line 1 saturated' });
    expect(after.criteria.find((c) => c.code === 'strategy')).toMatchObject({ score: 4 });
    expect(after.score!).toBeGreaterThan(before);
  });

  it('the weights: the group industrial director only; a criterion at 0 no longer counts', async () => {
    jar.set('arche-role', 'group_cfo');
    expect(await saveWeightsAction(null, form({ 'weight:urgency': '0' }))).toEqual({ ok: false, error: 'This action is reserved to the group industrial director' });
    jar.set('arche-role', 'dir_ig');
    const w = await weightsOf(t.db);
    expect(await saveWeightsAction(null, form({ ...Object.fromEntries(Object.entries(w).map(([k, v]) => [`weight:${k}`, String(v)])), 'weight:urgency': '0' }))).toEqual({ ok: true });
    expect((await weightsOf(t.db)).urgency).toBe(0);
    const p = await priorityOf('CPX-APM-2026-01');
    expect(p.criteria.find((c) => c.code === 'urgency')!.weight).toBe(0);
    expect(p.coveragePct).toBeLessThanOrEqual(100);
    const audit = await t.db.select().from(auditEntries).where(eq(auditEntries.change, 'weights of the grid changed'));
    expect(audit).toHaveLength(1);
  });
});

describe('portfolio scenarios (AR-043)', () => {
  it('the demo: the base plan retained, the constrained one leaves the solar plant out and spends less', async () => {
    const { capex: cs, scenarios } = await scenariosOf(t.db, TODAY);
    expect(cs.map((c) => c.code)).toContain('CPX-SAI-2026-03');
    const base = scenarios.find((s) => s.kind === 'base')!;
    const constrained = scenarios.find((s) => s.kind === 'constrained')!;
    expect(base.retained).toBe(true);
    expect(constrained.result.left).toBe(1);
    expect(base.result.left).toBe(0);
    const total = (r: { byYear: Record<number, number> }) => Object.values(r.byYear).reduce((a, b) => a + b, 0);
    expect(total(constrained.result)).toBeLessThan(total(base.result));
    expect(base.result).toEqual(evaluate(base.items, { 2027: 25_000, 2028: 25_000 }, cs, '2026-10'));
  });

  it('a new scenario by the group CFO; its CAPEX changed; retained by the director only', async () => {
    jar.set('arche-role', 'copil_member');
    expect(await createScenarioAction(null, form({ name: 'Growth', kind: 'growth' }))).toMatchObject({ ok: false });
    jar.set('arche-role', 'group_cfo');
    expect(await createScenarioAction(null, form({ name: 'x', kind: 'growth' }))).toEqual({ ok: false, error: 'Name the scenario' });
    expect(await createScenarioAction(null, form({ name: 'Growth 2027', kind: 'growth', 'env:2027': '30000' }))).toEqual({ ok: true });
    const [s] = await t.db.select().from(portfolioScenarios).where(eq(portfolioScenarios.name, 'Growth 2027'));
    expect(s.envelopes).toEqual({ '2027': 30000 });
    const { capex: cs } = await scenariosOf(t.db, TODAY);
    const apm = cs.find((c) => c.code === 'CPX-APM-2026-01')!;
    const keep = Object.fromEntries(cs.filter((c) => c.code !== 'CPX-SAI-2026-02').map((c) => [`keep:${c.id}`, 'on']));
    expect(await updateScenarioAction(s.id, null, form({ name: 'Growth 2027', kind: 'growth', 'env:2027': '30000', ...keep, [`shift:${apm.id}`]: '40' }))).toEqual({ ok: false, error: 'Shifts are whole months, from −36 to 36' });
    expect(await updateScenarioAction(s.id, null, form({ name: 'Growth 2027', kind: 'growth', 'env:2027': '30000', ...keep, [`shift:${apm.id}`]: '-3' }))).toEqual({ ok: true });
    const mine = (await scenariosOf(t.db, TODAY)).scenarios.find((x) => x.id === s.id)!;
    expect(mine.items.map((i) => ({ included: i.included, shiftMonths: i.shiftMonths })).sort((a, b) => a.shiftMonths - b.shiftMonths)).toEqual([{ included: true, shiftMonths: -3 }, { included: false, shiftMonths: 0 }]);
    expect(mine.result.left).toBe(1);
    expect(await retainScenarioAction(s.id)).toEqual({ ok: false, error: 'This action is reserved to the group industrial director' });
    jar.set('arche-role', 'dir_ig');
    expect(await retainScenarioAction(s.id)).toEqual({ ok: true });
    const retained = (await t.db.select().from(portfolioScenarios).where(eq(portfolioScenarios.retained, true))).map((x) => x.name);
    expect(retained).toEqual(['Growth 2027']);
  });
});
