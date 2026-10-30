// Sidebar model (pure): the entries a profile sees, by section and theme, with the active one. The CAPEX section is always
// there: its entries point at the CAPEX open in the URL, else the last one used (`current`); without one they wait for a
// CAPEX to be chosen. Screens not built yet are listed too — they open the "coming soon" page.
import type { RoleKey } from '@/config/roles';
import { SCREENS, SECTION_LABEL, canSee, matchScreen, screenHref, type ScreenId, type Section } from '@/config/screens';

export interface NavEntry {
  id: ScreenId;
  /** EN source string. */
  label: string;
  /** Null: a CAPEX screen while no CAPEX is chosen. */
  href: string | null;
  active: boolean;
}

export interface NavGroup {
  /** EN source string; null for a section without themes. */
  label: string | null;
  entries: NavEntry[];
}

export interface NavSection {
  key: Exclude<Section, 'fixed'>;
  /** EN source string. */
  label: string;
  /** The section holds the active entry. */
  active: boolean;
  groups: NavGroup[];
}

/** The CAPEX code of a CAPEX path ("/capex/CPX-APM-2026-01/budget" → "CPX-APM-2026-01"), else null. */
export function capexCodeOf(pathname: string): string | null {
  const m = /^\/capex\/([^/]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Same page of another CAPEX ("/capex/A/budget" → "/capex/B/budget"); outside a CAPEX, its overview. */
export function swapCapexInPath(pathname: string, code: string): string {
  const c = encodeURIComponent(code);
  return capexCodeOf(pathname) ? pathname.replace(/^\/capex\/[^/]+/, `/capex/${c}`) : `/capex/${c}`;
}

export function buildNav(role: RoleKey, pathname: string, current: string | null = null): { fixed: NavEntry[]; sections: NavSection[]; capex: string | null } {
  const active = matchScreen(pathname)?.id ?? null;
  const code = capexCodeOf(pathname) ?? current;
  const entry = (id: ScreenId, label: string, section: Section): NavEntry => ({
    id, label, active: id === active, href: section === 'capex' ? (code ? screenHref(id, { code }) : null) : screenHref(id),
  });
  const visible = SCREENS.filter((s) => canSee(role, s.id));
  const fixed = visible.filter((s) => s.section === 'fixed').map((s) => entry(s.id, s.title, 'fixed'));
  const sections: NavSection[] = [];
  for (const key of ['group', 'subsidiary', 'capex', 'admin'] as const) {
    const screens = visible.filter((s) => s.section === key);
    if (!screens.length) continue;
    const groups: NavGroup[] = [];
    for (const s of screens) {
      const label = s.group ?? null;
      let g = groups.find((x) => x.label === label);
      if (!g) groups.push((g = { label, entries: [] }));
      g.entries.push(entry(s.id, s.title, key));
    }
    sections.push({ key, label: SECTION_LABEL[key], active: screens.some((s) => s.id === active), groups });
  }
  return { fixed, sections, capex: code };
}
