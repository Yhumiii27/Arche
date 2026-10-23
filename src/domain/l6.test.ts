// Delivery 6, pure rules: ramp-up (OEE, conforming day, the run of consecutive days with planned stops neutral, M+5 / M+6),
// input and CSV template (N-16), start of commissioning after the PSSR, accounting closure (N-15) and lessons learned.
import { describe, expect, it } from 'vitest';
import { accountsFact, checkClosure, checkRex, closureSummary, rexFact } from './closure';
import { capexRampup, checkDay, checkLine, checkMesStart, dayState, lineRampup, oeeOf, parseRampupCsv, rampupFacts, type LineDef, type RampupDay } from './rampup';

const line: LineDef = { id: 'L', number: 1, name: 'Oven', nominalPerDay: 40, unit: 't', scrapTargetPct: 2, machineNumbers: [] };
const rules = { requiredDays: 3, capacityPct: 100, maxMonths: 6 };
const d = (day: string, output: number | null, scrapPct: number | null, plannedStop = false): RampupDay => ({ lineId: 'L', day, output, scrapPct, plannedStop, availabilityPct: null, performancePct: null, qualityPct: null, oeePct: 80 });

describe('ramp-up', () => {
  it('OEE = A × P × Q unless entered; a conforming day: ≥ 100 % of the nominal and scrap ≤ target', () => {
    expect(oeeOf({ oeePct: null, availabilityPct: 90, performancePct: 90, qualityPct: 98 })).toBe(79.4);
    expect(oeeOf({ oeePct: 70, availabilityPct: 90, performancePct: 90, qualityPct: 98 })).toBe(70);
    expect(dayState(line, d('2026-09-01', 40, 2), rules)).toBe('conforming');
    expect(dayState(line, d('2026-09-01', 39.9, 1), rules)).toBe('not_conforming');
    expect(dayState(line, d('2026-09-01', 45, 2.1), rules)).toBe('not_conforming');
    expect(dayState(line, d('2026-09-01', null, null, true), rules)).toBe('neutral');
  });

  it('the run: planned stops neutral, a bad or a missing day breaks it; the first run at length gives the date', () => {
    const days = [d('2026-09-01', 41, 1), d('2026-09-02', 41, 1), d('2026-09-03', 30, 1), d('2026-09-04', 41, 1), d('2026-09-05', null, null, true), d('2026-09-06', 41, 1), d('2026-09-07', 41, 1), d('2026-09-08', 41, 1)];
    expect(lineRampup(line, days, rules)).toMatchObject({ reachedOn: '2026-09-07', currentRun: 4, bestRun: 4, avgCapacityPct: 102.5 });
    const gap = [d('2026-09-01', 41, 1), d('2026-09-02', 41, 1), d('2026-09-04', 41, 1)];
    expect(lineRampup(line, gap, rules)).toMatchObject({ reachedOn: null, currentRun: 1, bestRun: 2 });
  });

  it('the CAPEX: every line reached; M+5 alert and M+6 limit; G3 facts', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-03'].map((x) => d(x, 41, 1));
    const ok = capexRampup({ mesStartedOn: '2026-07-01', lines: [line], days }, rules, '2026-10-22');
    expect(ok).toMatchObject({ status: 'reached', reachedOn: '2026-09-03', alertOn: '2026-12-01', limitOn: '2027-01-01' });
    expect(rampupFacts(ok, 3, '2026-10-22')).toEqual({ g3_rampup: { met: true, value: '1 / 1 · 3 / 3' }, g3_mes_delay: { met: true, value: '2027-01-01' } });
    const late = capexRampup({ mesStartedOn: '2026-01-01', lines: [line], days: [] }, rules, '2026-10-22');
    expect(late.status).toBe('overdue');
    expect(rampupFacts(late, 3, '2026-10-22').g3_mes_delay.met).toBe(false);
    expect(rampupFacts(capexRampup({ mesStartedOn: null, lines: [], days: [] }, rules, '2026-10-22'), 3, '2026-10-22').g3_rampup).toEqual({ met: false, value: 'Commissioning not started' });
  });

  it('input: a line, a day (after the MES, not in the future), the CSV template, the start after the PSSR', () => {
    expect(checkLine({ name: 'Oven', nominalPerDay: '0', unit: 't', scrapTargetPct: '2' })).toEqual({ ok: false, error: 'The nominal capacity per day is a positive number' });
    expect(checkLine({ name: 'Oven', nominalPerDay: '48', unit: 't', scrapTargetPct: '2', machineNumbers: 'mch-041, MCH-042;MCH-041' })).toMatchObject({ ok: true, value: { machineNumbers: ['MCH-041', 'MCH-042'] } });
    const ctx = { mesStartedOn: '2026-07-01', today: '2026-10-22' };
    expect(checkDay({ day: '2026-06-30', output: '40', scrapPct: '1', oeePct: '80' }, ctx)).toEqual({ ok: false, error: 'The day is before the start of commissioning' });
    expect(checkDay({ day: '2026-10-01', output: '40', scrapPct: '1' }, ctx)).toEqual({ ok: false, error: 'Give the OEE, or availability, performance and quality' });
    expect(checkDay({ day: '2026-10-01', output: '40', scrapPct: '1', availabilityPct: '90', performancePct: '90', qualityPct: '99' }, ctx)).toMatchObject({ ok: true, value: { oeePct: 80.2 } });
    expect(checkDay({ day: '2026-10-01', plannedStop: 'on' }, ctx)).toMatchObject({ ok: true, value: { plannedStop: true, output: null } });
    expect(parseRampupCsv('line;day\n1;2026-10-01;40;;;;80;1;\n2;2026-10-01;40;;;;80;1;', [{ id: 'L', number: 1 }], ctx)).toEqual({ ok: false, error: 'Unknown production line number', line: 3 });
    expect(parseRampupCsv('1;2026-10-01;;;;;;;x', [{ id: 'L', number: 1 }], ctx)).toMatchObject({ ok: true, value: [{ plannedStop: true }] });
    expect(checkMesStart({ day: '2026-10-01' }, { phase: 'demarrage', status: 'active', pssrPassed: false, mesStartedOn: null, today: '2026-10-22' })).toEqual({ ok: false, error: 'The PSSR must be passed before the start of commissioning' });
    expect(checkMesStart({ day: '2026-10-01' }, { phase: 'execution', status: 'active', pssrPassed: true, mesStartedOn: null, today: '2026-10-22' })).toEqual({ ok: false, error: 'Commissioning starts in phase 4' });
  });
});

describe('closure and lessons learned', () => {
  it('a final cost for every lot, the AFE balance (an overrun is negative); the gap to G2', () => {
    expect(checkClosure({ 'lot:a': '100' }, ['a', 'b'])).toEqual({ ok: false, error: 'Give the final cost of every lot (k€)' });
    expect(checkClosure({ 'lot:a': '1 100,5', afeBalanceKeur: '-12,5' }, ['a'])).toEqual({ ok: true, value: { costs: { a: 1100.5 }, afeBalanceKeur: -12.5, note: null } });
    expect(closureSummary([650, 3450], 4000)).toEqual({ finalKeur: 4100, g2Keur: 4000, gapKeur: 100, gapPct: 2.5 });
    expect(accountsFact({ lots: 2, costed: 2, statement: true })).toEqual({ met: true, value: '2 / 2' });
    expect(accountsFact({ lots: 2, costed: 0, statement: false }).met).toBe(false);
  });

  it('REX: phase and category from the lists; G3 needs a lesson for every phase', () => {
    expect(checkRex({ phase: 'x', category: 'cost', title: 'T', text: 'X' })).toEqual({ ok: false, error: 'Choose the phase' });
    expect(rexFact([{ phase: 'cadrage' }, { phase: 'cadrage' }, { phase: 'execution' }])).toEqual({ met: false, value: '2 / 4' });
    expect(rexFact(['cadrage', 'avant_projet', 'execution', 'demarrage'].map((phase) => ({ phase }))).met).toBe(true);
  });
});
