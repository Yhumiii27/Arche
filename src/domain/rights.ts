// Who sees which CAPEX (docs/spec/01-profils-droits.md §2). Pure rules shared by the data layer, which turns the
// visibility into a SQL filter (src/server/dal/capex.ts), and the tests, which run every profile against the demo data set.
// Visibility follows the assignments of the viewer's ACTIVE role: switching role (several roles held) changes what is seen.
import { CROSS_VIEW_ROLES, ROLE_SCOPE, type RoleKey, type ScopeKind } from '@/config/roles';

export interface RoleAssignment {
  role: RoleKey;
  scopeKind: ScopeKind;
  /** Zone code, subsidiary code or CAPEX code; null for a group-wide assignment. */
  scopeRef: string | null;
  /** Expert speciality (role `expert`): the opinions the expert gives (docs/spec/05 §4). */
  speciality?: string | null;
}

/** The CAPEX facts the rule needs. */
export interface CapexScopeFacts {
  code: string;
  subsidiaryCode: string;
  zoneCode: string;
  /** `draft` stays inside its subsidiary (N-5). */
  status: string;
}

/**
 * What the viewer's active role sees:
 * - `all`: every CAPEX, drafts included (CEO);
 * - `cross`: every CAPEX except drafts (central functions);
 * - `scoped`: drafts and others of the listed subsidiaries and CAPEX, non-drafts of the listed zones;
 * - `none`: nothing (administrator: reference data only).
 */
export type CapexVisibility =
  | { kind: 'all' }
  | { kind: 'cross' }
  | { kind: 'scoped'; zones: string[]; subsidiaries: string[]; capex: string[] }
  | { kind: 'none' };

/** An assignment is valid when its scope is the one its role is given at, with a reference unless group-wide. */
export function isValidAssignment(a: RoleAssignment): boolean {
  if (ROLE_SCOPE[a.role] !== a.scopeKind) return false;
  return a.scopeKind === 'group' ? a.scopeRef == null : !!a.scopeRef?.trim();
}

/** Visibility of a viewer in `role`, from their assignments (invalid ones and other roles' are ignored). */
export function capexVisibility(role: RoleKey, assignments: readonly RoleAssignment[]): CapexVisibility {
  const mine = assignments.filter((a) => a.role === role && isValidAssignment(a));
  if (!mine.length) return { kind: 'none' };
  if (role === 'ceo') return { kind: 'all' };
  if (CROSS_VIEW_ROLES.includes(role)) return { kind: 'cross' };
  if (role === 'admin') return { kind: 'none' };
  const refs = (kind: ScopeKind) => [...new Set(mine.filter((a) => a.scopeKind === kind).map((a) => a.scopeRef!))].sort();
  return { kind: 'scoped', zones: refs('zone'), subsidiaries: refs('subsidiary'), capex: refs('capex') };
}

/** True when the visibility includes the CAPEX. */
export function canSeeCapex(v: CapexVisibility, c: CapexScopeFacts): boolean {
  switch (v.kind) {
    case 'all':
      return true;
    case 'cross':
      return c.status !== 'draft';
    case 'none':
      return false;
    case 'scoped':
      return v.subsidiaries.includes(c.subsidiaryCode) || v.capex.includes(c.code) || (c.status !== 'draft' && v.zones.includes(c.zoneCode));
  }
}
