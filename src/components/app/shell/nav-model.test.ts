import { describe, expect, it } from 'vitest';
import { buildNav, capexCodeOf } from './nav-model';

describe('sidebar model', () => {
  it('a subsidiary project lead: steering screens, the CAPEX section while a CAPEX is open, no administration', () => {
    const home = buildNav('project_lead', '/');
    expect(home.fixed.map((e) => e.id)).toEqual(['home', 'approvals']);
    expect(home.fixed[0].active).toBe(true);
    expect(home.sections.map((s) => s.key)).toEqual(['steering']);
    const inCapex = buildNav('project_lead', '/capex/CPX-APM-2026-01/budget');
    expect(inCapex.sections.map((s) => s.key)).toEqual(['steering', 'capex']);
    const capex = inCapex.sections[1];
    expect(capex.sub).toBe('CPX-APM-2026-01');
    expect(capex.entries.find((e) => e.active)?.id).toBe('capex-budget');
    expect(capex.entries[0].href).toBe('/capex/CPX-APM-2026-01');
  });

  it('the administrator: Home and the administration only', () => {
    const nav = buildNav('admin', '/admin/users');
    expect(nav.fixed.map((e) => e.id)).toEqual(['home']);
    expect(nav.sections.map((s) => s.key)).toEqual(['admin']);
    expect(nav.sections[0].entries.find((e) => e.active)?.id).toBe('admin-users');
  });

  it('reads the CAPEX code of a path', () => {
    expect(capexCodeOf('/capex/CPX-SAI-2026-01')).toBe('CPX-SAI-2026-01');
    expect(capexCodeOf('/capex')).toBeNull();
  });
});
