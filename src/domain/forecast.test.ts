import { describe, expect, it } from 'vitest';
import { alertsOf } from './alerts';
import type { SCurvePoint } from './execution';
import { forecastOf, historyOf, likelyRange, referenceClass, type Reference } from './forecast';

// A 1 000 k€ CAPEX planned evenly over Jan–Oct 2026 (100 k€ a month); measured to the end of June.
const planned = (i: number) => Math.min(1000, (i + 1) * 100);
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const curveOf = (earned: number[], actual: number[]): SCurvePoint[] =>
  months.map((m, i) => ({ month: m, planned: planned(i), earned: earned[i] ?? null, actual: actual[i] ?? null }));

describe('forecast by rules (AR-037)', () => {
  it('on plan and on budget: no drift, finish as planned', () => {
    const c = curveOf([100, 200, 300, 400, 500, 600], [100, 200, 300, 400, 500, 600]);
    const f = forecastOf(c, 1000, '2026-06');
    expect(f.paceKeur).toBe(100);
    expect(f.plannedFinish).toBe('2026-10');
    expect(f.projectedFinish).toBe('2026-10');
    expect(f.delayMonths).toBe(0);
    expect(f.eacKeur).toBe(1000);
    expect(f.eacTrend).toEqual({ fromKeur: 1000, deltaKeur: 0, deltaPct: 0 });
    expect(f.drift).toEqual({ cost: false, schedule: false });
    expect(f.projection.map((p) => p.earned)).toEqual([700, 800, 900, 1000]);
  });

  it('slower and dearer: schedule and cost drift', () => {
    // Earned 60 k€ a month from April; the cost per earned k€ grows.
    const c = curveOf([100, 200, 300, 360, 420, 480], [100, 210, 330, 420, 520, 620]);
    const f = forecastOf(c, 1000, '2026-06');
    expect(f.paceKeur).toBe(60);
    // 520 k€ left at 60 a month: 9 months → March 2027, five months after October.
    expect(f.projectedFinish).toBe('2027-03');
    expect(f.delayMonths).toBe(5);
    expect(f.drift.schedule).toBe(true);
    const h = historyOf(c, 1000);
    expect(h.at(-1)!.cpi).toBe(0.77);
    expect(f.eacTrend!.deltaPct).toBeGreaterThan(3);
    expect(f.drift.cost).toBe(true);
    expect(f.eacCompositeKeur).toBeGreaterThan(f.eacKeur);
  });

  it('nothing spent: no drift, no trend', () => {
    const f = forecastOf(curveOf([0], [0]), 1000, '2026-01');
    expect(f.drift).toEqual({ cost: false, schedule: false });
    expect(f.projectedFinish).toBeNull();
    expect(f.eacKeur).toBe(1000);
  });

  it('drift raises watch alerts', () => {
    const base = { code: 'CPX', status: 'active', typologyProposed: null, running: null, openSteps: [], review: { state: 'ok', dueOn: null } as never, missingAudits: [], permitsDue: [], indicators: null, g2Keur: null, missingStaff: [], lateConditions: 0 };
    const rules = alertsOf({ ...base, drift: { cost: true, schedule: true, eacDeltaPct: 6.2, delayMonths: 5 } }, '2026-06-30').map((a) => [a.rule, a.level, a.detail]);
    expect(rules).toEqual([['cost_drift', 'watch', '+6.2 %'], ['schedule_drift', 'watch', '+5']]);
  });
});

describe('reference class (AR-037)', () => {
  const ref = (code: string, type: string, g2: number, out: number): Reference => ({ code, investmentType: type, g2Keur: g2, outcomeKeur: out, final: true });
  const refs = [ref('A', 'capacity', 1000, 1100), ref('B', 'capacity', 500, 500), ref('C', 'capacity', 2000, 2400), ref('D', 'capacity', 800, 760), ref('E', 'regulatory', 300, 330)];

  it('same investment type when there are at least three', () => {
    const rc = referenceClass(refs, 'capacity', 'X')!;
    expect(rc.sameType).toBe(true);
    expect(rc.n).toBe(4);
    // Gaps sorted: −5, 0, +10, +20 → median (rank 2) 0 %, 80th percentile (rank 4) +20 %.
    expect([rc.medianPct, rc.p80Pct]).toEqual([0, 20]);
    expect(likelyRange(1500, rc)).toEqual({ medianKeur: 1500, p80Keur: 1800 });
  });

  it('every type when the same type has too few; itself left out; none under three', () => {
    const rc = referenceClass(refs, 'regulatory', 'X')!;
    expect(rc.sameType).toBe(false);
    expect(rc.n).toBe(5);
    expect(referenceClass(refs.slice(0, 3), 'capacity', 'A')).toBeNull();
  });
});
