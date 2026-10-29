import { describe, expect, it } from 'vitest';
import { byYear, cashflow, checkForecast } from './cashflow';

const lot = { id: 'l1', number: 1, kind: 'civil_works', title: 'Civil works', epc2i: false, budgetKeur: 1200, start: '2026-07', end: '2026-12' };

describe('phased cash-flow (AR-045)', () => {
  it('the baseline spread over the window, the actuals month by month, the rest spread over the window when not forecast', () => {
    const rows = [{ lotId: 'l1', month: '2026-08', committedKeur: null, spentKeur: 300, physicalPct: null }, { lotId: 'l1', month: '2026-09', committedKeur: null, spentKeur: 500, physicalPct: null }];
    const cf = cashflow([lot], rows, [], '2026-09');
    expect(cf.months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    expect(cf.months.map((m) => m.baseline)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(cf.months.map((m) => m.actual)).toEqual([0, 300, 200, null, null, null]);
    // 1 200 − 500 spent = 700 over October to December.
    expect(cf.months.slice(3).map((m) => m.forecast)).toEqual([233.3, 233.3, 233.3]);
    expect(cf).toMatchObject({ baselineKeur: 1200, spentKeur: 500, remainingKeur: 700, atCompletionKeur: 1200 });
  });

  it('an entered forecast replaces the spread, and may go beyond the window; consolidated by year', () => {
    const cf = cashflow([lot], [], [{ lotId: 'l1', month: '2026-11', amountKeur: 400 }, { lotId: 'l1', month: '2027-02', amountKeur: 1000 }], '2026-09');
    expect(cf.months.at(-1)).toMatchObject({ month: '2027-02', forecast: 1000, baseline: 0 });
    expect(cf.atCompletionKeur).toBe(1400);
    expect(byYear(cf.months)).toEqual({ 2026: 400, 2027: 1000 });
    expect(byYear(cf.months, (m) => m.baseline)).toEqual({ 2026: 1200, 2027: 0 });
  });

  it('the forecast form: months after the current one, positive amounts', () => {
    expect(checkForecast({ 'm:2026-10': '100', 'm:2026-11': '', 'm:2026-12': '50,5' }, '2026-09')).toEqual({ ok: true, value: [{ month: '2026-10', amount: 100 }, { month: '2026-12', amount: 50.5 }] });
    expect(checkForecast({ 'm:2026-09': '100' }, '2026-09').ok).toBe(false);
    expect(checkForecast({ 'm:2026-10': '-1' }, '2026-09').ok).toBe(false);
  });
});
