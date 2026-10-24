// Subsidiary isolation (docs/spec/01 §2): the visibility rule, profile by profile.
import { describe, expect, it } from 'vitest';
import { canSeeCapex, capexVisibility, isValidAssignment, type CapexScopeFacts, type RoleAssignment } from './rights';

const apm1: CapexScopeFacts = { code: 'CPX-APM-2026-01', subsidiaryCode: 'APM', zoneCode: 'AFN', status: 'active' };
const apmDraft: CapexScopeFacts = { code: 'CPX-APM-2026-02', subsidiaryCode: 'APM', zoneCode: 'AFN', status: 'draft' };
const sai1: CapexScopeFacts = { code: 'CPX-SAI-2026-01', subsidiaryCode: 'SAI', zoneCode: 'AFO', status: 'active' };
const all = [apm1, apmDraft, sai1];
const seen = (role: Parameters<typeof capexVisibility>[0], a: RoleAssignment[]) => all.filter((c) => canSeeCapex(capexVisibility(role, a), c)).map((c) => c.code);

describe('capex visibility', () => {
  it('the CEO sees everything, drafts included', () => {
    expect(seen('ceo', [{ role: 'ceo', scopeKind: 'group', scopeRef: null }])).toEqual([apm1.code, apmDraft.code, sai1.code]);
  });

  it('central functions see every subsidiary but no draft (N-5)', () => {
    for (const role of ['dir_ig', 'group_cfo', 'group_hse', 'copil_member'] as const)
      expect(seen(role, [{ role, scopeKind: 'group', scopeRef: null }])).toEqual([apm1.code, sai1.code]);
  });

  it('a subsidiary role sees its own subsidiary only, drafts included', () => {
    expect(seen('sponsor', [{ role: 'sponsor', scopeKind: 'subsidiary', scopeRef: 'APM' }])).toEqual([apm1.code, apmDraft.code]);
    expect(seen('controller', [{ role: 'controller', scopeKind: 'subsidiary', scopeRef: 'SAI' }])).toEqual([sai1.code]);
  });

  it('a CAPEX-scoped role sees the CAPEX it is named on, nothing else of the subsidiary', () => {
    expect(seen('project_lead', [{ role: 'project_lead', scopeKind: 'capex', scopeRef: apm1.code }])).toEqual([apm1.code]);
    expect(seen('expert', [{ role: 'expert', scopeKind: 'capex', scopeRef: sai1.code }])).toEqual([sai1.code]);
  });

  it('a zone director reads the non-draft CAPEX of their zones', () => {
    expect(seen('zone_director', [{ role: 'zone_director', scopeKind: 'zone', scopeRef: 'AFN' }])).toEqual([apm1.code]);
  });

  it('the administrator reads every CAPEX like the CEO (owner, 24 Oct 2026); no assignment means nothing', () => {
    expect(seen('admin', [{ role: 'admin', scopeKind: 'group', scopeRef: null }])).toEqual(seen('ceo', [{ role: 'ceo', scopeKind: 'group', scopeRef: null }]));
    expect(seen('sponsor', [])).toEqual([]);
  });

  it('only the active role counts, and invalid assignments are ignored', () => {
    const a: RoleAssignment[] = [
      { role: 'sponsor', scopeKind: 'subsidiary', scopeRef: 'APM' },
      { role: 'controller', scopeKind: 'subsidiary', scopeRef: 'SAI' },
      // a sponsor assigned group-wide is not a valid assignment: it must not widen the view
      { role: 'sponsor', scopeKind: 'group', scopeRef: null },
    ];
    expect(seen('sponsor', a)).toEqual([apm1.code, apmDraft.code]);
    expect(seen('controller', a)).toEqual([sai1.code]);
    expect(isValidAssignment({ role: 'ceo', scopeKind: 'subsidiary', scopeRef: 'APM' })).toBe(false);
    expect(isValidAssignment({ role: 'zone_director', scopeKind: 'zone', scopeRef: ' ' })).toBe(false);
  });
});
