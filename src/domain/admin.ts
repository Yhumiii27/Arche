// Administration rules (docs/spec/01 §3, 08): the checks of the accounts, role assignments and organisation reference data,
// pure so the Server Functions and the tests share them. Messages are EN source strings (translated by the page).
import { EXPERT_SPECIALITIES, ROLE_SCOPE, isRoleKey, type ExpertSpeciality, type RoleKey, type ScopeKind } from '@/config/roles';
import { normaliseEmail } from './auth';

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export interface UserInput {
  email: string;
  displayName: string;
  jobTitle: string | null;
  subsidiaryCode: string | null;
}

/** A new account: a valid e-mail not taken yet, a name, an existing subsidiary when one is given. */
export function checkUser(raw: Record<string, unknown>, ctx: { takenEmails: ReadonlySet<string>; subsidiaries: ReadonlySet<string> }): Check<UserInput> {
  const email = normaliseEmail(raw.email);
  if (!email) return { ok: false, error: 'Enter a valid e-mail address' };
  if (ctx.takenEmails.has(email)) return { ok: false, error: 'An account already has this e-mail address' };
  const displayName = text(raw.displayName);
  if (displayName.length < 2 || displayName.length > 120) return { ok: false, error: 'Enter the person’s name' };
  const sub = text(raw.subsidiaryCode).toUpperCase() || null;
  if (sub && !ctx.subsidiaries.has(sub)) return { ok: false, error: 'Unknown subsidiary' };
  const jobTitle = text(raw.jobTitle).slice(0, 120) || null;
  return { ok: true, value: { email, displayName, jobTitle, subsidiaryCode: sub } };
}

export interface AssignmentInput {
  role: RoleKey;
  scopeKind: ScopeKind;
  scopeRef: string | null;
  speciality: ExpertSpeciality | null;
}

/** A role assignment: a known role, the scope its role takes, a reference that exists, a speciality for an expert. */
export function checkAssignment(
  raw: Record<string, unknown>,
  ctx: { zones: ReadonlySet<string>; subsidiaries: ReadonlySet<string>; capex: ReadonlySet<string>; held: readonly { role: string; scopeRef: string | null }[] },
): Check<AssignmentInput> {
  const role = text(raw.role);
  if (!isRoleKey(role)) return { ok: false, error: 'Choose a role' };
  const scopeKind = ROLE_SCOPE[role];
  let scopeRef: string | null = null;
  if (scopeKind !== 'group') {
    scopeRef = text(raw.scopeRef).toUpperCase() || null;
    const known = scopeKind === 'zone' ? ctx.zones : scopeKind === 'subsidiary' ? ctx.subsidiaries : ctx.capex;
    if (!scopeRef || !known.has(scopeRef))
      return { ok: false, error: scopeKind === 'zone' ? 'Choose a zone' : scopeKind === 'subsidiary' ? 'Choose a subsidiary' : 'Choose a CAPEX' };
  }
  const spec = text(raw.speciality);
  let speciality: ExpertSpeciality | null = null;
  if (role === 'expert') {
    if (!(EXPERT_SPECIALITIES as readonly string[]).includes(spec)) return { ok: false, error: 'Choose the expert’s speciality' };
    speciality = spec as ExpertSpeciality;
  }
  if (ctx.held.some((h) => h.role === role && h.scopeRef === scopeRef)) return { ok: false, error: 'The person already holds this role on this scope' };
  return { ok: true, value: { role, scopeKind, scopeRef, speciality } };
}

/** An administrator never removes their own last administrator role, nor deactivates their own account. */
export function selfLockout(op: { actorUserId: string; targetUserId: string; removingRole?: string; actorAdminRoles: number; deactivating?: boolean }): string | null {
  if (op.actorUserId !== op.targetUserId) return null;
  if (op.deactivating) return 'You cannot deactivate your own account';
  if (op.removingRole === 'admin' && op.actorAdminRoles <= 1) return 'You cannot remove your own last administrator role';
  return null;
}

export interface SubsidiaryInput {
  code: string;
  name: string;
  countryIso2: string;
  zoneCode: string;
  currency: string;
}

export function checkSubsidiary(raw: Record<string, unknown>, ctx: { zones: ReadonlySet<string>; taken: ReadonlySet<string> }): Check<SubsidiaryInput> {
  const code = text(raw.code).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { ok: false, error: 'The code has three letters' };
  if (ctx.taken.has(code)) return { ok: false, error: 'This code is already used' };
  const name = text(raw.name);
  if (name.length < 2 || name.length > 120) return { ok: false, error: 'Enter the subsidiary’s name' };
  const countryIso2 = text(raw.countryIso2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryIso2)) return { ok: false, error: 'The country is a two-letter ISO code' };
  const zoneCode = text(raw.zoneCode).toUpperCase();
  if (!ctx.zones.has(zoneCode)) return { ok: false, error: 'Choose a zone' };
  const currency = text(raw.currency).toUpperCase() || 'EUR';
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'The currency is a three-letter ISO code' };
  return { ok: true, value: { code, name, countryIso2, zoneCode, currency } };
}

export function checkZone(raw: Record<string, unknown>, taken: ReadonlySet<string>): Check<{ code: string; name: string }> {
  const code = text(raw.code).toUpperCase();
  if (!/^[A-Z]{2,6}$/.test(code)) return { ok: false, error: 'The code has two to six letters' };
  if (taken.has(code)) return { ok: false, error: 'This code is already used' };
  const name = text(raw.name);
  if (name.length < 2 || name.length > 80) return { ok: false, error: 'Enter the zone’s name' };
  return { ok: true, value: { code, name } };
}

/** A coordinate in decimal degrees within ±max ("34,261" accepted); '' → null; NaN when invalid. */
function degrees(raw: unknown, max: number): number | null {
  const v = text(raw).replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : NaN;
}

export function checkSite(raw: Record<string, unknown>, ctx: { subsidiaries: ReadonlyMap<string, string>; takenNames: ReadonlySet<string> }): Check<{ subsidiaryCode: string; name: string; city: string | null; countryIso2: string; latitude: number | null; longitude: number | null }> {
  const subsidiaryCode = text(raw.subsidiaryCode).toUpperCase();
  const country = ctx.subsidiaries.get(subsidiaryCode);
  if (!country) return { ok: false, error: 'Choose a subsidiary' };
  const name = text(raw.name);
  if (name.length < 2 || name.length > 120) return { ok: false, error: 'Enter the site’s name' };
  if (ctx.takenNames.has(`${subsidiaryCode}|${name.toLowerCase()}`)) return { ok: false, error: 'This subsidiary already has a site with this name' };
  const latitude = degrees(raw.latitude, 90);
  const longitude = degrees(raw.longitude, 180);
  if (Number.isNaN(latitude) || Number.isNaN(longitude) || (latitude == null) !== (longitude == null)) return { ok: false, error: 'Enter the latitude (−90 to 90) and the longitude (−180 to 180), or neither' };
  return { ok: true, value: { subsidiaryCode, name, city: text(raw.city) || null, countryIso2: country, latitude, longitude } };
}

/** Reference revenue (C-5): a whole fiscal year between 2000 and next year, a positive amount in k€. */
export function checkRevenue(raw: Record<string, unknown>, ctx: { subsidiaries: ReadonlySet<string>; today: string }): Check<{ subsidiaryCode: string; fiscalYear: number; revenueKeur: number; sourceNote: string | null }> {
  const subsidiaryCode = text(raw.subsidiaryCode).toUpperCase();
  if (!ctx.subsidiaries.has(subsidiaryCode)) return { ok: false, error: 'Choose a subsidiary' };
  const fiscalYear = Number(text(raw.fiscalYear));
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > +ctx.today.slice(0, 4) + 1) return { ok: false, error: 'Enter a fiscal year' };
  const revenueKeur = Number(text(raw.revenueKeur).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(revenueKeur) || revenueKeur <= 0) return { ok: false, error: 'Enter the revenue in k€' };
  return { ok: true, value: { subsidiaryCode, fiscalYear, revenueKeur, sourceNote: text(raw.sourceNote).slice(0, 200) || null } };
}
