import { describe, expect, it } from 'vitest';
import type { RoleAssignment } from './rights';
import { canDo, checkBudgetLines, checkDecision, checkLot, checkRisk, checkSheet, creatableSubsidiaries, isMajorRisk, nextCapexCode, nextNumber, refOf } from './capex';

const a = (role: RoleAssignment['role'], scopeKind: RoleAssignment['scopeKind'], scopeRef: string | null): RoleAssignment => ({ role, scopeKind, scopeRef });
const C = { code: 'CPX-APM-2026-01', subsidiaryCode: 'APM', status: 'active' };

describe('codes', () => {
  it('next CAPEX code of the subsidiary in the year (N-9)', () => {
    expect(nextCapexCode('APM', 2026, ['CPX-APM-2026-01', 'CPX-APM-2026-02', 'CPX-SAI-2026-07', 'CPX-APM-2025-09'])).toBe('CPX-APM-2026-03');
    expect(nextCapexCode('SAI', 2027, [])).toBe('CPX-SAI-2027-01');
    expect(refOf('R', nextNumber([1, 4]))).toBe('R-05');
  });
});

describe('checks', () => {
  it('identity sheet', () => {
    expect(checkSheet({ title: ' New line ', investmentType: 'new_line', siteId: 's1', needDate: '2027-03-01' }, { sites: new Set(['s1']) })).toEqual({ ok: true, value: { title: 'New line', description: null, investmentType: 'new_line', siteId: 's1', needDate: '2027-03-01' } });
    expect(checkSheet({ title: 'New line', investmentType: 'castle' }, { sites: new Set() }).ok).toBe(false);
    expect(checkSheet({ title: 'New line', investmentType: 'other', siteId: 'zz' }, { sites: new Set() })).toEqual({ ok: false, error: 'Choose a site of the subsidiary' });
    expect(checkSheet({ title: 'New line', investmentType: 'other', needDate: '2027-02-30' }, { sites: new Set() }).ok).toBe(false);
  });
  it('lots, budget lines, risks, decisions', () => {
    expect(checkLot({ kind: 'machines', title: 'Extruders' })).toEqual({ ok: true, value: { kind: 'machines', title: 'Extruders', epc2i: true } });
    expect(checkLot({ kind: 'castle', title: 'x y' }).ok).toBe(false);
    expect(checkBudgetLines({ 'lot:a': '1 200', 'lot:b': '' }, ['a', 'b'])).toEqual({ ok: true, value: [{ lotId: 'a', amountKeur: 1200 }, { lotId: 'b', amountKeur: 0 }] });
    expect(checkBudgetLines({ 'lot:a': '-1' }, ['a']).ok).toBe(false);
    expect(checkRisk({ title: 'Late permit', category: 'regulatory', probability: '3', impact: '4', ownerUserId: 'u1' }, { people: new Set(['u1']) })).toMatchObject({ ok: true, value: { status: 'open', probability: 3, impact: 4 } });
    expect(checkRisk({ title: 'Late permit', category: 'regulatory', probability: '5', impact: '1' }, { people: new Set() }).ok).toBe(false);
    expect(checkRisk({ title: 'Late permit', category: 'regulatory', probability: '1', impact: '1', ownerUserId: 'zz' }, { people: new Set() }).ok).toBe(false);
    expect(isMajorRisk(3, 3)).toBe(true);
    expect(isMajorRisk(2, 4)).toBe(false);
    expect(checkDecision({ takenOn: '2026-10-01', body: 'copil_projet', text: 'Variant B retained' }, '2026-10-22').ok).toBe(true);
    expect(checkDecision({ takenOn: '2026-11-01', body: 'copil_projet', text: 'Variant B retained' }, '2026-10-22').ok).toBe(false);
  });
});

describe('write rights (spec 01 §3)', () => {
  const lead = [a('project_lead', 'capex', C.code)];
  const sponsor = [a('sponsor', 'subsidiary', 'APM')];
  const otherSponsor = [a('sponsor', 'subsidiary', 'SAI')];
  const controller = [a('controller', 'subsidiary', 'APM')];
  const dirIg = [a('dir_ig', 'group', null)];

  it('the lead and the sponsor of the CAPEX edit it; another subsidiary never does', () => {
    expect(canDo('edit', 'project_lead', lead, C)).toBe(true);
    expect(canDo('edit', 'sponsor', sponsor, C)).toBe(true);
    expect(canDo('edit', 'sponsor', otherSponsor, C)).toBe(false);
    expect(canDo('edit', 'project_lead', [a('project_lead', 'capex', 'CPX-APM-2026-02')], C)).toBe(false);
    expect(canDo('edit', 'controller', controller, C)).toBe(false);
    expect(canDo('edit', 'dir_ig', dirIg, C)).toBe(false);
  });
  it('a closed or abandoned CAPEX is read-only; only the sponsor opens a draft', () => {
    for (const status of ['closed', 'abandoned', 'on_hold']) expect(canDo('edit', 'project_lead', lead, { ...C, status })).toBe(false);
    expect(canDo('open', 'sponsor', sponsor, { ...C, status: 'draft' })).toBe(true);
    expect(canDo('open', 'project_lead', lead, { ...C, status: 'draft' })).toBe(false);
    expect(canDo('open', 'sponsor', sponsor, C)).toBe(false);
  });
  it('budget: lead and controller; typology and gates: the group industrial director (the CEO for gates too)', () => {
    expect(canDo('budget', 'controller', controller, C)).toBe(true);
    expect(canDo('budget', 'sponsor', sponsor, C)).toBe(false);
    expect(canDo('force_typology', 'dir_ig', dirIg, C)).toBe(true);
    expect(canDo('force_typology', 'ceo', [a('ceo', 'group', null)], C)).toBe(false);
    expect(canDo('decide_gate', 'ceo', [a('ceo', 'group', null)], C)).toBe(true);
    expect(canDo('decide_gate', 'dir_ig', dirIg, { ...C, status: 'draft' })).toBe(false);
  });
  it('who creates a draft, and where', () => {
    expect(creatableSubsidiaries('sponsor', [...sponsor, a('sponsor', 'subsidiary', 'SAI')], null)).toEqual(['APM', 'SAI']);
    expect(creatableSubsidiaries('project_lead', lead, 'APM')).toEqual(['APM']);
    expect(creatableSubsidiaries('project_lead', lead, null)).toEqual([]);
    expect(creatableSubsidiaries('dir_ig', dirIg, null)).toEqual([]);
  });
});
