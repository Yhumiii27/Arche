import { describe, expect, it } from 'vitest';
import { checkAssetClass, classOf, inServiceMonth, scheduleOf, simulate } from './depreciation';

const BUILD = { code: 'BUILD', label: 'Buildings', lifeYears: 20, method: 'linear' as const, factor: null, lotKinds: ['buildings', 'civil_works'] };
const MACH = { code: 'MACH', label: 'Machinery', lifeYears: 10, method: 'declining' as const, factor: 2.25, lotKinds: ['machines'] };

describe('depreciation (AR-050)', () => {
  it('straight line, pro rata of the first year', () => {
    // 1 200 over 20 years from July: 30 the first year (6 months), then 60.
    expect(scheduleOf(1200, BUILD, '2027-07', 3)).toEqual([30, 60, 60]);
    const all = scheduleOf(1200, BUILD, '2027-07', 22);
    expect(Math.round(all.reduce((a, b) => a + b, 0))).toBe(1200);
  });

  it('declining balance at 22.5 % switching to straight line, fully depreciated', () => {
    const s = scheduleOf(1000, MACH, '2027-01', 12);
    expect(s[0]).toBe(225);
    expect(s[1]).toBeCloseTo(174.4, 1);
    expect(Math.round(s.reduce((a, b) => a + b, 0))).toBe(1000);
    expect(s.slice(10)).toEqual([0, 0]);
  });

  it('a lot’s class, the simulation by year, the month in service, the class form', () => {
    expect(classOf([BUILD, MACH], { kind: 'machines', assetClassCode: null })?.code).toBe('MACH');
    expect(classOf([BUILD, MACH], { kind: 'machines', assetClassCode: 'BUILD' })?.code).toBe('BUILD');
    expect(classOf([BUILD], { kind: 'land', assetClassCode: null })).toBeNull();
    const sim = simulate([{ amountKeur: 1200, cls: BUILD }, { amountKeur: 1000, cls: MACH }], '2027-01', 2);
    expect(sim.years).toEqual([{ year: 2027, charge: 285 }, { year: 2028, charge: 234.4 }]);
    expect(inServiceMonth({ mesStartedOn: null, needDate: '2027-06-01' }, ['2026-12', '2027-03'])).toBe('2027-04');
    expect(inServiceMonth({ mesStartedOn: '2026-11-03', needDate: null }, [])).toBe('2026-11');
    expect(checkAssetClass({ code: 'mach', label: 'Machinery', lifeYears: '10', method: 'declining', factor: '2,25', 'kind:machines': 'on' }, ['machines', 'buildings'])).toEqual({ ok: true, value: { code: 'MACH', label: 'Machinery', lifeYears: 10, method: 'declining', factor: 2.25, lotKinds: ['machines'] } });
    expect(checkAssetClass({ code: 'X', label: 'X', lifeYears: '0' }, []).ok).toBe(false);
  });
});
