import { describe, expect, it } from 'vitest';
import { ROLE_KEYS } from './roles';
import { BUILT, SCREENS, canSee, matchScreen, screenHref } from './screens';

describe('screen registry', () => {
  it('ids and paths are unique; every profile has at least Home', () => {
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length);
    expect(new Set(SCREENS.map((s) => s.path)).size).toBe(SCREENS.length);
    for (const r of ROLE_KEYS) expect(canSee(r, 'home')).toBe(true);
  });

  it('builds hrefs and matches paths', () => {
    expect(screenHref('capex-budget', { code: 'CPX-APM-2026-01' })).toBe('/capex/CPX-APM-2026-01/budget');
    expect(() => screenHref('capex-budget')).toThrow();
    expect(matchScreen('/capex/CPX-APM-2026-01/budget')?.id).toBe('capex-budget');
    expect(matchScreen('/capex/CPX-APM-2026-01')?.id).toBe('capex-overview');
    expect(matchScreen('/capex')?.id).toBe('capex-list');
    expect(matchScreen('/')?.id).toBe('home');
    expect(matchScreen('/nowhere')).toBeNull();
  });

  it('administration stays with the administrator; business screens never show it', () => {
    expect(canSee('admin', 'admin-users')).toBe(true);
    expect(canSee('admin', 'capex-list')).toBe(false);
    expect(canSee('ceo', 'admin-users')).toBe(false);
    expect([...BUILT].sort()).toEqual(['admin-connectors', 'admin-delegation', 'admin-model', 'admin-org', 'admin-users', 'approvals', 'capex-actions', 'capex-budget', 'capex-changes', 'capex-dossiers', 'capex-execution', 'capex-gates', 'capex-governance', 'capex-journal', 'capex-list', 'capex-machines', 'capex-open', 'capex-overview', 'capex-pack', 'capex-permits', 'capex-rampup', 'capex-risks', 'capex-safety', 'copil', 'home', 'kpi', 'map', 'portfolio', 'rex', 'subsidiary-portfolio']);
  });
});
