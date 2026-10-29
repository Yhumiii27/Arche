import { describe, expect, it } from 'vitest';
import { benefitRows, checkBenefit, checkPostAudit, postAuditsOf, realisedFlows, returnsOf } from './benefits';
import { canDecideIdea, checkIdea, checkIdeaDecision, decisionsOn, ideaRef } from './ideas';

describe('ideas backlog (AR-051)', () => {
  it('statuses, decisions and rights', () => {
    expect(ideaRef('APM', 7)).toBe('IDEA-APM-007');
    expect(decisionsOn('new')).toEqual(['qualify', 'retain', 'reject']);
    expect(decisionsOn('retained')).toEqual([]);
    const idea = { subsidiaryCode: 'APM', zoneCode: 'AFN' };
    expect(canDecideIdea('sponsor', [{ role: 'sponsor', scopeKind: 'subsidiary', scopeRef: 'APM' }], idea)).toBe(true);
    expect(canDecideIdea('sponsor', [{ role: 'sponsor', scopeKind: 'subsidiary', scopeRef: 'SAI' }], idea)).toBe(false);
    expect(canDecideIdea('zone_director', [{ role: 'zone_director', scopeKind: 'zone', scopeRef: 'AFN' }], idea)).toBe(true);
    expect(canDecideIdea('controller', [{ role: 'controller', scopeKind: 'subsidiary', scopeRef: 'APM' }], idea)).toBe(false);
  });
  it('checks', () => {
    expect(checkIdea({ subsidiaryCode: 'apm', title: 'Solar roof', stake: 'Cut the energy bill by 15 %', sizeKeur: '900' }, ['APM'])).toEqual({ ok: true, value: { subsidiaryCode: 'APM', title: 'Solar roof', stake: 'Cut the energy bill by 15 %', sizeKeur: 900, investmentType: null } });
    expect(checkIdea({ subsidiaryCode: 'SAI', title: 'Solar roof', stake: 'Cut the energy bill' }, ['APM'])).toMatchObject({ ok: false, error: 'Choose a subsidiary of your scope' });
    expect(checkIdeaDecision({ decision: 'reject' }, 'new')).toMatchObject({ ok: false, error: 'Say why the idea is set aside' });
    expect(checkIdeaDecision({ decision: 'qualify' }, 'qualified')).toMatchObject({ ok: false });
  });
});

describe('benefits and post-audits (AR-046)', () => {
  const plan = Array.from({ length: 4 }, (_, y) => ({ year: y, capexKeur: y === 0 ? 1000 : 0, opexKeur: y ? 100 : 0, revenueKeur: y ? 500 : 0 }));
  it('planned against realised, year by year', () => {
    const rows = benefitRows(plan, [{ year: 1, revenueKeur: 420, opexKeur: 120 }]);
    expect(rows[0]).toMatchObject({ year: 1, planned: 400, actual: 300, gap: -100, cumPlan: 400, cumActual: 300 });
    expect(rows[1]).toMatchObject({ year: 2, actual: null, gap: null, cumPlan: 800 });
  });
  it('NPV and IRR on the realised flows; the investment at its final cost', () => {
    const real = realisedFlows(plan, [{ year: 1, revenueKeur: 420, opexKeur: 120 }], 1100);
    expect(real[0].capexKeur).toBe(1100);
    expect(real[1]).toMatchObject({ revenueKeur: 420, opexKeur: 120 });
    const r = returnsOf(10, plan, real);
    expect(r.realNpv).toBeLessThan(r.planNpv);
    expect(r.realIrr!).toBeLessThan(r.planIrr!);
  });
  it('post-audits at 6, 12 and 24 months: upcoming, due, late, held', () => {
    expect(postAuditsOf(null, [], '2026-10-22')).toEqual([]);
    const a = postAuditsOf('2026-01-15', [{ milestone: 6, heldOn: '2026-07-20' }], '2027-02-20');
    expect(a.map((x) => [x.milestone, x.dueOn, x.state])).toEqual([[6, '2026-07-15', 'held'], [12, '2027-01-15', 'late'], [24, '2028-01-15', 'upcoming']]);
    expect(postAuditsOf('2026-01-15', [], '2027-01-20')[1].state).toBe('due');
  });
  it('checks', () => {
    expect(checkBenefit({ year: '1', revenueKeur: '420', opexKeur: '120' }, 3)).toEqual({ ok: true, value: { year: 1, revenueKeur: 420, opexKeur: 120, note: null } });
    expect(checkBenefit({ year: '4', revenueKeur: '420', opexKeur: '120' }, 3)).toMatchObject({ ok: false });
    expect(checkPostAudit({ milestone: '12', heldOn: '2027-01-20', conclusion: 'below', summary: 'Gains 20 % below the plan.' }, [12], '2027-02-01')).toMatchObject({ ok: true });
    expect(checkPostAudit({ milestone: '24', heldOn: '2027-01-20', conclusion: 'below', summary: 'Gains 20 % below the plan.' }, [12], '2027-02-01')).toMatchObject({ ok: false, error: 'This post-audit is not due or already held' });
  });
});
