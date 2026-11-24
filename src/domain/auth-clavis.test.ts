// Roles granted by the central sign-in of Clavis: read from the token, applied directly at group level, scoped roles only
// through an Arche assignment and only while granted.
import { describe, expect, it } from 'vitest';
import { decideSignIn, effectiveAssignments, grantedRolesFromClaims, grantedRolesFromClavisAccess } from './auth';

describe('roles from the token', () => {
  it('reads Arche role keys, case-insensitive, with an optional prefix, dropping the others', () => {
    expect(grantedRolesFromClaims({ roles: ['Arche.Project_Lead', 'admin', 'Matrix.Lecture', 42] })).toEqual(['project_lead', 'admin']);
    expect(grantedRolesFromClaims({})).toEqual([]);
  });

  it('applies group roles directly and scoped ones only through an assignment of a granted role', () => {
    const stored = [
      { role: 'project_lead' as const, scopeKind: 'capex' as const, scopeRef: 'CPX-1' },
      { role: 'controller' as const, scopeKind: 'subsidiary' as const, scopeRef: 'APM' },
      { role: 'ceo' as const, scopeKind: 'group' as const, scopeRef: null },
    ];
    expect(effectiveAssignments(['copil_member', 'project_lead'], stored)).toEqual([
      { role: 'copil_member', scopeKind: 'group', scopeRef: null },
      { role: 'project_lead', scopeKind: 'capex', scopeRef: 'CPX-1' },
    ]);
    expect(effectiveAssignments(null, stored)).toEqual(stored);
  });

  it('creates an account for an unknown e-mail with a group role; refuses no role and a scope missing', () => {
    const base = { oid: 'o', email: 'a@b.example', byObjectId: null, byEmail: null, adminEmails: [] };
    expect(decideSignIn({ ...base, granted: ['copil_member'] })).toMatchObject({ ok: true, createFromToken: true, roles: ['copil_member'] });
    expect(decideSignIn({ ...base, granted: [] })).toEqual({ ok: false, reason: 'no_role' });
    expect(decideSignIn({ ...base, granted: ['project_lead'] })).toEqual({ ok: false, reason: 'no_scope' });
    expect(decideSignIn({ ...base, granted: null })).toEqual({ ok: false, reason: 'unknown_user' });
  });
});

describe('roles read in clavis.pub_acces (ARCHE_ACCESS_FROM_CLAVIS)', () => {
  it('gives the role of the row only when the access opens now', () => {
    expect(grantedRolesFromClavisAccess({ role: 'copil_member', ouvert: true })).toEqual(['copil_member']);
    expect(grantedRolesFromClavisAccess({ role: 'project_lead', ouvert: false })).toEqual([]);
    expect(grantedRolesFromClavisAccess({ role: 'director', ouvert: true })).toEqual([]);
    expect(grantedRolesFromClavisAccess(null)).toEqual([]);
  });
});
