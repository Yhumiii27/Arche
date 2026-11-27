// Arche profiles (docs/spec/01-profils-droits.md §1) and the scopes a role assignment carries (§2). Pure registry: no
// component, no server import, so server code, the proxy and scripts can load it.

/** Role keys, from the broadest workspace to the narrowest (a user holding several starts in the first one held). */
export const ROLE_KEYS = [
  'ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director',
  'sponsor', 'project_lead', 'controller', 'co_dig', 'engineering_pmo', 'expert', 'admin',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const isRoleKey = (v: unknown): v is RoleKey => typeof v === 'string' && (ROLE_KEYS as readonly string[]).includes(v);

/** Role names (EN source strings, translated through t()). */
export const ROLE_LABEL: Record<RoleKey, string> = {
  ceo: 'CEO',
  dir_ig: 'Group industrial director',
  group_cfo: 'Group CFO',
  group_hse: 'Group HSE',
  copil_member: 'COPIL GPI member',
  zone_director: 'Zone director',
  sponsor: 'Sponsor',
  project_lead: 'Subsidiary project lead',
  controller: 'Subsidiary controller',
  co_dig: 'Co-DIG',
  engineering_pmo: 'Engineering PMO',
  expert: 'Expert',
  admin: 'Administrator',
};

/** What a role assignment is limited to (§2). */
export const SCOPE_KINDS = ['group', 'zone', 'subsidiary', 'capex'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

/** The scope each role is assigned at (an assignment at another scope is refused). */
export const ROLE_SCOPE: Record<RoleKey, ScopeKind> = {
  ceo: 'group',
  dir_ig: 'group',
  group_cfo: 'group',
  group_hse: 'group',
  copil_member: 'group',
  admin: 'group',
  zone_director: 'zone',
  sponsor: 'subsidiary',
  controller: 'subsidiary',
  project_lead: 'capex',
  co_dig: 'capex',
  engineering_pmo: 'capex',
  expert: 'capex',
};

/** Expert specialities (CDC §4: Quality, HSE, DAF, Operations). */
export const EXPERT_SPECIALITIES = ['quality', 'hse', 'finance', 'operations'] as const;
export type ExpertSpeciality = (typeof EXPERT_SPECIALITIES)[number];

/** Speciality names (EN source strings). */
export const SPECIALITY_LABEL: Record<ExpertSpeciality, string> = { quality: 'Quality', hse: 'HSE', finance: 'Finance', operations: 'Operations' };

/** Central functions with a cross view of every subsidiary (CDC §4), beyond drafts (N-5). The CEO sees everything. */
export const CROSS_VIEW_ROLES: readonly RoleKey[] = ['dir_ig', 'group_cfo', 'group_hse', 'copil_member'];

/**
 * Former role keys still accepted when read from outside Arche (Clavis's `pub_acces`, a sign-in token) during the transition
 * of the Atrium rename: Clavis and Arche may be deployed in either order. Arche itself only writes the new key.
 */
export const LEGACY_ROLE_KEYS: Readonly<Record<string, RoleKey>> = { epc2i_pmo: 'engineering_pmo' };

/** The role key of `v`: a known key as it is, a former key (LEGACY_ROLE_KEYS) as its new key, else null. */
export function canonicalRoleKey(v: unknown): RoleKey | null {
  if (isRoleKey(v)) return v;
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_ROLE_KEYS, v) ? LEGACY_ROLE_KEYS[v] : null;
}

/** Distinct known roles in priority order (a former key read as its new key, unknown values dropped). */
export function sortRoles(roles: Iterable<unknown>): RoleKey[] {
  const held = new Set<string>();
  for (const r of roles) {
    const k = canonicalRoleKey(r);
    if (k) held.add(k);
  }
  return ROLE_KEYS.filter((r) => held.has(r));
}

/** Active role: `preferred` when the user holds it, else the highest role held; null when the user holds none. */
export function activeRoleOf(roles: readonly string[], preferred?: string | null): RoleKey | null {
  const held = sortRoles(roles);
  const p = canonicalRoleKey(preferred);
  if (p && held.includes(p)) return p;
  return held[0] ?? null;
}
