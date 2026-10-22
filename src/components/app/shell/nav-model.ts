// Sidebar model (pure): the entries a profile sees, by section, with the active one. A CAPEX's own pages are listed while a
// CAPEX is open (its code in the path). Screens not built yet are listed too — they open the "coming soon" page.
import type { RoleKey } from '@/config/roles';
import { SCREENS, SECTION_LABEL, canSee, matchScreen, screenHref, type ScreenId, type Section } from '@/config/screens';

export interface NavEntry {
  id: ScreenId;
  /** EN source string. */
  label: string;
  href: string;
  active: boolean;
}

export interface NavSection {
  key: Exclude<Section, 'fixed'>;
  /** EN source string. */
  label: string;
  /** Typed CAPEX code under the section title (CAPEX section). */
  sub: string | null;
  entries: NavEntry[];
}

/** The CAPEX code of a CAPEX path ("/capex/CPX-APM-2026-01/budget" → "CPX-APM-2026-01"), else null. */
export function capexCodeOf(pathname: string): string | null {
  const m = /^\/capex\/([^/]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

export function buildNav(role: RoleKey, pathname: string): { fixed: NavEntry[]; sections: NavSection[] } {
  const active = matchScreen(pathname)?.id ?? null;
  const code = capexCodeOf(pathname);
  const entry = (id: ScreenId, label: string): NavEntry => ({ id, label, href: screenHref(id, { code: code ?? undefined }), active: id === active });
  const visible = SCREENS.filter((s) => canSee(role, s.id));
  const fixed = visible.filter((s) => s.section === 'fixed').map((s) => entry(s.id, s.title));
  const sections: NavSection[] = [];
  for (const key of ['steering', 'capex', 'admin'] as const) {
    if (key === 'capex' && !code) continue;
    const entries = visible.filter((s) => s.section === key).map((s) => entry(s.id, s.title));
    if (entries.length) sections.push({ key, label: SECTION_LABEL[key], sub: key === 'capex' ? code : null, entries });
  }
  return { fixed, sections };
}
