import { describe, expect, it } from 'vitest';
import { canMoveVersion, centralOf, classWidthPct, computeTypology, meetsClass, missingStaff, parseKeur, rangeOf, referenceRevenueOf, validatorsOf } from './budget';

describe('estimate classes', () => {
  it('ranges, widths and precision', () => {
    expect(rangeOf(1000, 'E50')).toEqual({ low: 500, high: 1500 });
    expect(rangeOf(1000, 'E10')).toEqual({ low: 950, high: 1100 });
    expect(classWidthPct('E30')).toBe(60);
    expect(classWidthPct('E10')).toBe(15);
    expect(meetsClass('E30', 'E50')).toBe(true);
    expect(meetsClass('E30', 'E10')).toBe(false);
    expect(meetsClass(null, 'E50')).toBe(false);
  });

  it('only the group CFO validates E10; a validated version is frozen', () => {
    expect(validatorsOf('E10')).toEqual(['group_cfo']);
    expect(validatorsOf('E50')).toContain('controller');
    expect(canMoveVersion('draft', 'submitted')).toBe(true);
    expect(canMoveVersion('submitted', 'draft')).toBe(true);
    expect(canMoveVersion('validated', 'draft')).toBe(false);
    expect(canMoveVersion('draft', 'validated')).toBe(false);
  });

  it('amounts typed in French or English', () => {
    expect(parseKeur('1 250,5')).toBe(1250.5);
    expect(parseKeur('300')).toBe(300);
    expect(parseKeur('-3')).toBeNull();
    expect(parseKeur('abc')).toBeNull();
    expect(centralOf([{ amountKeur: 100.25 }, { amountKeur: 50 }])).toBe(150.3);
  });
});

describe('typology (C-5)', () => {
  const base = { investmentType: 'new_line', thresholdPct: 20 };
  it('ratio ≥ 20 % is Strategic, exactly 20 % included; a new plant is Strategic outright', () => {
    expect(computeTypology({ ...base, centralKeur: 2000, revenueKeur: 10000 })).toMatchObject({ typology: 'strategic', ratioPct: 20 });
    expect(computeTypology({ ...base, centralKeur: 1999, revenueKeur: 10000 })).toMatchObject({ typology: 'light', ratioPct: 20 });
    expect(computeTypology({ ...base, centralKeur: 1900, revenueKeur: 10000 })).toMatchObject({ typology: 'light', ratioPct: 19 });
    expect(computeTypology({ ...base, investmentType: 'new_plant', centralKeur: null, revenueKeur: null })).toMatchObject({ typology: 'strategic' });
  });
  it('to be determined without revenue or validated budget', () => {
    expect(computeTypology({ ...base, centralKeur: 100, revenueKeur: null }).typology).toBeNull();
    expect(computeTypology({ ...base, centralKeur: null, revenueKeur: 5000 }).typology).toBeNull();
  });
  it('reference revenue = latest closed fiscal year', () => {
    const rows = [{ fiscalYear: 2024, revenueKeur: 1 }, { fiscalYear: 2026, revenueKeur: 3 }, { fiscalYear: 2025, revenueKeur: 2 }];
    expect(referenceRevenueOf(rows, '2026-10-22')).toEqual({ fiscalYear: 2025, revenueKeur: 2 });
    expect(referenceRevenueOf([{ fiscalYear: 2026, revenueKeur: 3 }], '2026-10-22')).toEqual({ fiscalYear: 2026, revenueKeur: 3 });
    expect(referenceRevenueOf([], '2026-10-22')).toBeNull();
  });
});

describe('staffing template', () => {
  it('Light: lead + Co-DIG; Strategic: lead + controller + EPC2i PMO', () => {
    expect(missingStaff('light', ['lead'])).toEqual(['co_dig']);
    expect(missingStaff('strategic', ['lead', 'co_dig'])).toEqual(['controller', 'epc2i_pmo']);
    expect(missingStaff(null, ['lead', 'co_dig'])).toEqual([]);
  });
});
