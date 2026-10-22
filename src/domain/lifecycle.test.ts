import { describe, expect, it } from 'vitest';
import { CRITERIA, GATES, checkModelValues, criteriaOf, currentGate, decideGate, evaluateGate, openCapex, readValues, resume, suspend, DEFAULT_VALUES, type CycleState, type GateCode } from './lifecycle';

const allMet = (gate: GateCode) => Object.fromEntries(criteriaOf(gate).map((c) => [c.code, { met: true }]));

describe('DIG-PRODI 4.0 model', () => {
  it('every gate has criteria; codes are unique', () => {
    for (const g of GATES) expect(criteriaOf(g).length).toBeGreaterThan(0);
    expect(new Set(CRITERIA.map((c) => c.code)).size).toBe(CRITERIA.length);
  });

  it('stored values fall back to the defaults when missing or out of bounds', () => {
    expect(readValues(null)).toEqual(DEFAULT_VALUES);
    expect(readValues({ strategicRatioPct: 25, gateDelayDays: { G1: 3, G2: -1 }, rampupDays: 'x' })).toMatchObject({ strategicRatioPct: 25, gateDelayDays: { G1: 3, G2: 10, K3: 5, G3: 10 }, rampupDays: 30 });
  });
});

describe('gate evaluation', () => {
  it('a criterion without data is not evaluated and does not block', () => {
    const ev = evaluateGate('G1', { g1_budget_e50: { met: true, value: 'E50' }, g1_typology: { met: true } });
    expect(ev.passable).toBe(true);
    expect(ev.results.find((r) => r.code === 'g1_dossier')!.state).toBe('not_evaluated');
  });

  it('an unmet blocking criterion blocks; forcing works only on a forcible one, with a reason', () => {
    const facts = { ...allMet('G1'), g1_budget_e50: { met: false, value: 'none' }, g1_staffing: { met: false } };
    expect(evaluateGate('G1', facts).blockers.map((b) => b.code)).toEqual(['g1_budget_e50']);
    expect(evaluateGate('G1', facts).alerts.map((b) => b.code)).toEqual(['g1_staffing']);
    expect(evaluateGate('G1', facts, { g1_budget_e50: '  ' }).passable).toBe(false);
    const forced = evaluateGate('G1', facts, { g1_budget_e50: 'Ratios validated by the CFO by e-mail' });
    expect(forced.passable).toBe(true);
    expect(forced.results.find((r) => r.code === 'g1_budget_e50')).toMatchObject({ state: 'forced', forcedReason: 'Ratios validated by the CFO by e-mail' });
    const notForcible = evaluateGate('G1', { ...allMet('G1'), g1_typology: { met: false } }, { g1_typology: 'please' });
    expect(notForcible.passable).toBe(false);
  });
});

describe('transitions', () => {
  const draft: CycleState = { status: 'draft', phase: 'cadrage' };
  it('opening needs a draft and a named lead', () => {
    expect(openCapex(draft, false).ok).toBe(false);
    expect(openCapex(draft, true)).toEqual({ ok: true, value: { status: 'active', phase: 'cadrage' } });
    expect(openCapex({ status: 'active', phase: 'cadrage' }, true).ok).toBe(false);
  });

  it('a CAPEX goes through the four phases to closure (criteria simulated)', () => {
    let s = (openCapex(draft, true) as { ok: true; value: CycleState }).value;
    const seen: string[] = [s.phase];
    for (const g of GATES) {
      expect(currentGate(s)).toBe(g);
      const r = decideGate(s, g, 'go', evaluateGate(g, allMet(g)));
      expect(r.ok).toBe(true);
      s = (r as { ok: true; value: CycleState }).value;
      seen.push(s.status === 'closed' ? 'closed' : s.phase);
    }
    expect(seen).toEqual(['cadrage', 'avant_projet', 'execution', 'demarrage', 'closed']);
    expect(currentGate(s)).toBeNull();
  });

  it('deferred stays, no-go abandons (reason required), conditions are required, K3 has no no-go', () => {
    const s: CycleState = { status: 'active', phase: 'cadrage' };
    const ev = evaluateGate('G1', allMet('G1'));
    expect(decideGate(s, 'G1', 'deferred', ev).ok).toBe(false);
    expect(decideGate(s, 'G1', 'deferred', ev, { reason: 'Market study missing' })).toEqual({ ok: true, value: s });
    expect(decideGate(s, 'G1', 'no_go', ev, { reason: 'Not aligned' })).toEqual({ ok: true, value: { status: 'abandoned', phase: 'cadrage' } });
    expect(decideGate(s, 'G1', 'go_with_conditions', ev, { conditions: [' '] }).ok).toBe(false);
    expect(decideGate(s, 'G1', 'go_with_conditions', ev, { conditions: ['Update the market study'] }).ok).toBe(true);
    expect(decideGate(s, 'G2', 'go', ev).ok).toBe(false);
    expect(decideGate({ status: 'active', phase: 'execution' }, 'K3', 'no_go', evaluateGate('K3', {}), { reason: 'x' }).ok).toBe(false);
    expect(decideGate(s, 'G1', 'go', evaluateGate('G1', { g1_budget_e50: { met: false } })).ok).toBe(false);
  });

  it('suspension and resumption keep the phase', () => {
    const s: CycleState = { status: 'active', phase: 'execution' };
    const held = (suspend(s) as { ok: true; value: CycleState }).value;
    expect(held).toEqual({ status: 'on_hold', phase: 'execution' });
    expect(currentGate(held)).toBeNull();
    expect(resume(held)).toEqual({ ok: true, value: s });
    expect(suspend(held).ok).toBe(false);
  });
});

describe('model values input', () => {
  it('whole numbers within their bounds', () => {
    const ok = { 'delay:G1': '3', 'delay:G2': '10', 'delay:K3': '5', 'delay:G3': '10', strategicRatioPct: '25', packThresholdPct: '80', worksThresholdPct: '95', rampupDays: '30', mesMaxMonths: '6' };
    expect(checkModelValues(ok)).toMatchObject({ ok: true, value: { gateDelayDays: { G1: 3 }, strategicRatioPct: 25 } });
    expect(checkModelValues({ ...ok, 'delay:G1': '0' }).ok).toBe(false);
    expect(checkModelValues({ ...ok, strategicRatioPct: '20.5' }).ok).toBe(false);
  });
});
