import { describe, expect, it } from 'vitest';
import { checkScores, checkWeights, computedScore, criteriaScores, ranked, totalScore } from './scoring';

const facts = { npvKeur: 2600, bacKeur: 5200, irrPct: 15.3, majorRisks: 1, openRisks: 4 };

describe('multi-criteria prioritisation (AR-044)', () => {
  it('the computed criteria from the business plan and the risks', () => {
    expect(computedScore('npv_ratio', facts)).toBe(4);
    expect(computedScore('irr', facts)).toBe(4);
    expect(computedScore('risk', facts)).toBe(3);
    expect(computedScore('npv_ratio', { ...facts, npvKeur: null })).toBeNull();
    expect(computedScore('risk', { ...facts, majorRisks: 0, openRisks: 2 })).toBe(5);
  });

  it('the score on 100 over the scored criteria, and the coverage of the grid', () => {
    const s = criteriaScores({}, facts, { strategy: { score: 5, note: 'Core of the group plan' } });
    // (30×4 + 10×4 + 15×3 + 25×5) / 80 = 4.125 → 82.5 / 100; 80 of the 100 points of weight scored.
    expect(totalScore(s)).toEqual({ score: 82.5, coveragePct: 80 });
    expect(totalScore(criteriaScores({ value: 0, return: 0, risk: 0 }, facts, {}))).toEqual({ score: null, coveragePct: 0 });
    // One criterion alone (15 % of the weight) does not rank a CAPEX.
    expect(totalScore(criteriaScores({}, { npvKeur: null, irrPct: null, bacKeur: 500, majorRisks: 0, openRisks: 0 }, {}))).toEqual({ score: null, coveragePct: 15 });
    expect(ranked([{ code: 'B', score: 50 }, { code: 'A', score: null }, { code: 'C', score: 80 }]).map((r) => [r.code, r.rank])).toEqual([['C', 1], ['B', 2], ['A', null]]);
  });

  it('the forms', () => {
    expect(checkScores({ 'score:strategy': '4', 'note:strategy': 'Plan', 'score:urgency': '' })).toEqual({ ok: true, value: [{ code: 'strategy', score: 4, note: 'Plan' }] });
    expect(checkScores({ 'score:safety': '6' }).ok).toBe(false);
    expect(checkWeights({ 'weight:value': '30', 'weight:return': '10', 'weight:risk': '15', 'weight:strategy': '25', 'weight:urgency': '10', 'weight:safety': '10' }).ok).toBe(true);
    expect(checkWeights({}).ok).toBe(false);
  });
});
