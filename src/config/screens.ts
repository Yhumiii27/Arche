// Screen registry (docs/spec/08-ecrans.md): id, route, title (EN source string), section of the sidebar, the profiles that
// see it, and whether it is built yet (a screen not built opens the "coming soon" page). Pure: no component, no server
// import, so server code, the proxy and scripts can load it. Icons are in ./screen-icons.ts.
import type { RoleKey } from './roles';

export type ScreenId =
  | 'home' | 'approvals' | 'capex-list' | 'map' | 'portfolio' | 'copil' | 'rex'
  | 'capex-overview' | 'capex-gates' | 'capex-dossiers' | 'capex-budget' | 'capex-execution' | 'capex-changes' | 'capex-machines'
  | 'capex-pack' | 'capex-permits' | 'capex-safety' | 'capex-risks' | 'capex-governance' | 'capex-rampup' | 'capex-journal'
  | 'admin-org' | 'admin-users' | 'admin-model' | 'admin-delegation' | 'admin-connectors';

export type Section = 'fixed' | 'steering' | 'capex' | 'admin';

export interface ScreenDef {
  id: ScreenId;
  /** Route pattern; `[code]` is the CAPEX code. */
  path: string;
  title: string;
  section: Section;
  /** Theme of the entry within its section (EN source string): the sidebar groups the entries by theme. */
  group?: string;
  /** Profiles that see it; the others get "outside my workspace" (read-only) or nothing (§2 of spec 08). */
  roles: readonly RoleKey[] | 'all';
  /** Delivery that builds it (docs/PLAN.md). */
  delivery: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
}

const BUSINESS: readonly RoleKey[] = ['ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'epc2i_pmo', 'expert'];
const STEERING: readonly RoleKey[] = ['ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'epc2i_pmo'];

export const SCREENS: readonly ScreenDef[] = [
  { id: 'home', path: '/', title: 'Home', section: 'fixed', roles: 'all', delivery: 'L1' },
  { id: 'approvals', path: '/my/approvals', title: 'My approvals', section: 'fixed', roles: BUSINESS, delivery: 'L3' },
  { id: 'capex-list', path: '/capex', title: 'CAPEX register', section: 'steering', group: 'Portfolio', roles: STEERING, delivery: 'L1' },
  { id: 'map', path: '/map', title: 'CAPEX map', section: 'steering', group: 'Portfolio', roles: STEERING, delivery: 'L4' },
  { id: 'portfolio', path: '/portfolio', title: 'Portfolio', section: 'steering', group: 'Portfolio', roles: STEERING, delivery: 'L5' },
  { id: 'copil', path: '/copil', title: 'COPIL GPI', section: 'steering', group: 'Bodies and lessons learned', roles: ['ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'sponsor', 'project_lead'], delivery: 'L5' },
  { id: 'rex', path: '/rex', title: 'Lessons learned library', section: 'steering', group: 'Bodies and lessons learned', roles: BUSINESS, delivery: 'L6' },
  { id: 'capex-overview', path: '/capex/[code]', title: 'CAPEX overview', section: 'capex', group: 'DIG-PRODI cycle', roles: BUSINESS, delivery: 'L1' },
  { id: 'capex-gates', path: '/capex/[code]/gates', title: 'Gates & circuits', section: 'capex', group: 'DIG-PRODI cycle', roles: BUSINESS, delivery: 'L3' },
  { id: 'capex-dossiers', path: '/capex/[code]/dossiers', title: 'Living dossiers', section: 'capex', group: 'DIG-PRODI cycle', roles: BUSINESS, delivery: 'L3' },
  { id: 'capex-budget', path: '/capex/[code]/budget', title: 'Budget & business plan', section: 'capex', group: 'Budget and decisions', roles: BUSINESS, delivery: 'L2' },
  { id: 'capex-changes', path: '/capex/[code]/changes', title: 'Management of change', section: 'capex', group: 'Budget and decisions', roles: BUSINESS, delivery: 'L3' },
  { id: 'capex-governance', path: '/capex/[code]/governance', title: 'Governance', section: 'capex', group: 'Budget and decisions', roles: BUSINESS, delivery: 'L2' },
  { id: 'capex-machines', path: '/capex/[code]/machines', title: 'Machine needs', section: 'capex', group: 'Delivery', roles: BUSINESS, delivery: 'L4' },
  { id: 'capex-pack', path: '/capex/[code]/pack', title: 'Engineering pack', section: 'capex', group: 'Delivery', roles: BUSINESS, delivery: 'L5' },
  { id: 'capex-permits', path: '/capex/[code]/permits', title: 'Permits', section: 'capex', group: 'Delivery', roles: BUSINESS, delivery: 'L5' },
  { id: 'capex-execution', path: '/capex/[code]/execution', title: 'Execution', section: 'capex', group: 'Delivery', roles: BUSINESS, delivery: 'L5' },
  { id: 'capex-risks', path: '/capex/[code]/risks', title: 'Risks', section: 'capex', group: 'Risks and safety', roles: BUSINESS, delivery: 'L2' },
  { id: 'capex-safety', path: '/capex/[code]/safety', title: 'Safety milestones', section: 'capex', group: 'Risks and safety', roles: BUSINESS, delivery: 'L5' },
  { id: 'capex-rampup', path: '/capex/[code]/rampup', title: 'Ramp-up', section: 'capex', group: 'Start-up and traceability', roles: BUSINESS, delivery: 'L6' },
  { id: 'capex-journal', path: '/capex/[code]/journal', title: 'Journal', section: 'capex', group: 'Start-up and traceability', roles: BUSINESS, delivery: 'L2' },
  { id: 'admin-org', path: '/admin/organisation', title: 'Subsidiaries, sites, zones', section: 'admin', group: 'Reference data', roles: ['admin', 'group_cfo'], delivery: 'L1' },
  { id: 'admin-users', path: '/admin/users', title: 'Users & roles', section: 'admin', group: 'Access', roles: ['admin'], delivery: 'L1' },
  { id: 'admin-model', path: '/admin/model', title: 'DIG-PRODI model', section: 'admin', group: 'Method', roles: ['admin', 'group_hse'], delivery: 'L2' },
  { id: 'admin-delegation', path: '/admin/delegation', title: 'Delegation matrix', section: 'admin', group: 'Method', roles: ['admin'], delivery: 'L3' },
  { id: 'admin-connectors', path: '/admin/connectors', title: 'Connectors', section: 'admin', group: 'Integrations', roles: ['admin'], delivery: 'L4' },
];

export const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;

/** Section titles (EN source strings). */
export const SECTION_LABEL: Record<Exclude<Section, 'fixed'>, string> = {
  steering: 'Steering',
  capex: 'CAPEX',
  admin: 'Administration',
};

/** Screens built (deliveries 1 to 6: every screen of the registry). */
export const BUILT: ReadonlySet<ScreenId> = new Set(SCREENS.map((s) => s.id));

/** True when the profile has the screen in its workspace. */
export function canSee(role: RoleKey, id: ScreenId): boolean {
  const r = SCREEN_BY_ID[id].roles;
  return r === 'all' || r.includes(role);
}

/** The URL of a screen (`code` for the CAPEX screens). */
export function screenHref(id: ScreenId, params: { code?: string } = {}): string {
  const p = SCREEN_BY_ID[id].path;
  if (!p.includes('[code]')) return p;
  if (!params.code) throw new Error(`screenHref(${id}) needs a CAPEX code`);
  return p.replace('[code]', encodeURIComponent(params.code));
}

/** The screen a path shows (most specific pattern first), or null. */
export function matchScreen(pathname: string): ScreenDef | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const byLength = [...SCREENS].sort((a, b) => b.path.length - a.path.length);
  for (const s of byLength) {
    const re = new RegExp('^' + s.path.replace(/\[code\]/, '[^/]+').replace(/\//g, '\\/') + '(\\/.*)?$');
    if (s.path === '/' ? clean === '/' : re.test(clean)) return s;
  }
  return null;
}
