import { describe, expect, it } from 'vitest';
import { checkAssignment, checkRevenue, checkSite, checkSubsidiary, checkUser, checkZone, selfLockout } from './admin';

const set = (...xs: string[]) => new Set(xs);
const ctx = { zones: set('AFN', 'AFO'), subsidiaries: set('APM', 'SAI'), capex: set('CPX-APM-2026-01'), held: [] as { role: string; scopeRef: string | null }[] };

describe('administration checks', () => {
  it('accounts: valid unique e-mail, a name, a known subsidiary', () => {
    const c = { takenEmails: set('a@b.example'), subsidiaries: set('APM') };
    expect(checkUser({ email: ' New@B.example ', displayName: 'Ana Ruiz', subsidiaryCode: 'apm' }, c)).toEqual({ ok: true, value: { email: 'new@b.example', displayName: 'Ana Ruiz', jobTitle: null, subsidiaryCode: 'APM' } });
    expect(checkUser({ email: 'A@b.example', displayName: 'X Y' }, c)).toEqual({ ok: false, error: 'An account already has this e-mail address' });
    expect(checkUser({ email: 'nope', displayName: 'X Y' }, c).ok).toBe(false);
    expect(checkUser({ email: 'z@b.example', displayName: 'X Y', subsidiaryCode: 'ZZZ' }, c)).toEqual({ ok: false, error: 'Unknown subsidiary' });
  });

  it('role assignments: the scope comes from the role; the reference must exist; an expert has a speciality', () => {
    expect(checkAssignment({ role: 'ceo', scopeRef: 'APM' }, ctx)).toEqual({ ok: true, value: { role: 'ceo', scopeKind: 'group', scopeRef: null, speciality: null } });
    expect(checkAssignment({ role: 'sponsor', scopeRef: 'apm' }, ctx)).toEqual({ ok: true, value: { role: 'sponsor', scopeKind: 'subsidiary', scopeRef: 'APM', speciality: null } });
    expect(checkAssignment({ role: 'sponsor', scopeRef: 'XXX' }, ctx)).toEqual({ ok: false, error: 'Choose a subsidiary' });
    expect(checkAssignment({ role: 'zone_director', scopeRef: 'AFO' }, ctx).ok).toBe(true);
    expect(checkAssignment({ role: 'project_lead', scopeRef: 'cpx-apm-2026-01' }, ctx).ok).toBe(true);
    expect(checkAssignment({ role: 'expert', scopeRef: 'CPX-APM-2026-01' }, ctx)).toEqual({ ok: false, error: 'Choose the expert’s speciality' });
    expect(checkAssignment({ role: 'expert', scopeRef: 'CPX-APM-2026-01', speciality: 'hse' }, ctx).ok).toBe(true);
    expect(checkAssignment({ role: 'boss' }, ctx)).toEqual({ ok: false, error: 'Choose a role' });
    expect(checkAssignment({ role: 'sponsor', scopeRef: 'APM' }, { ...ctx, held: [{ role: 'sponsor', scopeRef: 'APM' }] }).ok).toBe(false);
  });

  it('an administrator cannot lock themselves out', () => {
    const me = { actorUserId: 'u1', targetUserId: 'u1', actorAdminRoles: 1 };
    expect(selfLockout({ ...me, deactivating: true })).toBe('You cannot deactivate your own account');
    expect(selfLockout({ ...me, removingRole: 'admin' })).toBe('You cannot remove your own last administrator role');
    expect(selfLockout({ ...me, removingRole: 'admin', actorAdminRoles: 2 })).toBeNull();
    expect(selfLockout({ ...me, targetUserId: 'u2', deactivating: true })).toBeNull();
  });

  it('organisation reference data', () => {
    expect(checkZone({ code: 'afe', name: 'Afrique de l’Est' }, set('AFN')).ok).toBe(true);
    expect(checkZone({ code: 'AFN', name: 'x y' }, set('AFN')).ok).toBe(false);
    expect(checkSubsidiary({ code: 'kel', name: 'Kenya Ltd', countryIso2: 'ke', zoneCode: 'AFO', currency: 'kes' }, { zones: set('AFO'), taken: set('APM') })).toEqual({ ok: true, value: { code: 'KEL', name: 'Kenya Ltd', countryIso2: 'KE', zoneCode: 'AFO', currency: 'KES' } });
    expect(checkSubsidiary({ code: 'AP', name: 'x', countryIso2: 'MA', zoneCode: 'AFO' }, { zones: set('AFO'), taken: set() }).ok).toBe(false);
    const subs = new Map([['APM', 'MA']]);
    expect(checkSite({ subsidiaryCode: 'APM', name: 'Usine 2', city: 'Fès' }, { subsidiaries: subs, takenNames: set() })).toEqual({ ok: true, value: { subsidiaryCode: 'APM', name: 'Usine 2', city: 'Fès', countryIso2: 'MA' } });
    expect(checkSite({ subsidiaryCode: 'APM', name: 'Usine 2' }, { subsidiaries: subs, takenNames: set('APM|usine 2') }).ok).toBe(false);
    expect(checkRevenue({ subsidiaryCode: 'APM', fiscalYear: '2025', revenueKeur: '45 000,5' }, { subsidiaries: set('APM'), today: '2026-10-22' })).toEqual({ ok: true, value: { subsidiaryCode: 'APM', fiscalYear: 2025, revenueKeur: 45000.5, sourceNote: null } });
    expect(checkRevenue({ subsidiaryCode: 'APM', fiscalYear: '2031', revenueKeur: '1' }, { subsidiaries: set('APM'), today: '2026-10-22' }).ok).toBe(false);
    expect(checkRevenue({ subsidiaryCode: 'APM', fiscalYear: '2025', revenueKeur: '-3' }, { subsidiaries: set('APM'), today: '2026-10-22' }).ok).toBe(false);
  });
});
