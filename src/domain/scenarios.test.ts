import { describe, expect, it } from 'vitest';
import { checkItems, checkScenario, evaluate, shiftedByYear } from './scenarios';

const months = (from: number, list: number[]) => list.map((v, i) => ({ month: `2026-${String(from + i).padStart(2, '0')}`, projected: v }));
const a = { id: 'a', code: 'CPX-A', months: months(9, [100, 100, 200, 200]), npvKeur: 1000, majorRisks: 1, score: 80 };
const b = { id: 'b', code: 'CPX-B', months: months(11, [500, 500]), npvKeur: 300, majorRisks: 0, score: 60 };

describe('portfolio scenarios (AR-043)', () => {
  it('a shift moves the disbursements still to come, never the past', () => {
    // Current month October: November and December move by 2 months, into 2027.
    expect(shiftedByYear(a.months, '2026-10', 2)).toEqual({ 2026: 200, 2027: 400 });
    expect(shiftedByYear(a.months, '2026-10', 0)).toEqual({ 2026: 600 });
  });

  it('a scenario keeps, leaves out or shifts CAPEX, compared with its envelopes', () => {
    const base = evaluate([], { 2026: 1200 }, [a, b], '2026-10');
    expect(base).toMatchObject({ byYear: { 2026: 1600 }, overByYear: { 2026: 400 }, npvKeur: 1300, majorRisks: 1, meanScore: 70, kept: 2, left: 0 });
    const constrained = evaluate([{ capexId: 'b', included: false, shiftMonths: 0 }, { capexId: 'a', included: true, shiftMonths: 3 }], { 2026: 1200 }, [a, b], '2026-10');
    expect(constrained).toMatchObject({ byYear: { 2026: 200, 2027: 400 }, overByYear: { 2026: 0 }, npvKeur: 1000, kept: 1, left: 1 });
  });

  it('the forms', () => {
    expect(checkScenario({ name: 'Constrained 2027', kind: 'constrained', 'env:2027': '30 000' })).toEqual({ ok: true, value: { name: 'Constrained 2027', kind: 'constrained', description: null, envelopes: { 2027: 30000 } } });
    expect(checkScenario({ name: 'X' }).ok).toBe(false);
    expect(checkItems({ 'keep:a': 'on', 'shift:a': '6', 'shift:b': '' }, ['a', 'b'])).toEqual({ ok: true, value: [{ capexId: 'a', included: true, shiftMonths: 6 }, { capexId: 'b', included: false, shiftMonths: 0 }] });
    expect(checkItems({ 'shift:a': '40' }, ['a']).ok).toBe(false);
  });
});
