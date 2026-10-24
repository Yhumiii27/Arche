import { describe, expect, it } from 'vitest';
import { buildNav, capexCodeOf, swapCapexInPath } from './nav-model';

const ids = (s: { groups: { entries: { id: string }[] }[] }) => s.groups.flatMap((g) => g.entries.map((e) => e.id));

describe('sidebar model', () => {
  it('a subsidiary project lead: group portfolio, subsidiary portfolio and steering of the CAPEX, no administration', () => {
    const home = buildNav('project_lead', '/');
    expect(home.fixed.map((e) => e.id)).toEqual(['home', 'approvals']);
    expect(home.fixed[0].active).toBe(true);
    expect(home.sections.map((s) => s.key)).toEqual(['group', 'subsidiary', 'capex']);
    expect(ids(home.sections[0])).toEqual(['map', 'portfolio', 'copil', 'rex']);
    expect(ids(home.sections[1])).toEqual(['capex-list', 'subsidiary-portfolio', 'capex-open']);
    expect(home.sections[2].groups.map((g) => g.label)).toEqual(['DIG-PRODI cycle', 'Budget and decisions', 'Delivery', 'Risks and safety', 'Start-up and traceability']);
    // No CAPEX chosen yet: the CAPEX entries wait for one.
    expect(home.capex).toBeNull();
    expect(home.sections[2].groups[0].entries[0].href).toBeNull();
  });

  it('the CAPEX section follows the CAPEX of the URL, else the last one used', () => {
    const inCapex = buildNav('project_lead', '/capex/CPX-APM-2026-01/budget', 'CPX-SAI-2026-01');
    expect(inCapex.capex).toBe('CPX-APM-2026-01');
    const capex = inCapex.sections[2];
    expect(capex.active).toBe(true);
    expect(ids(capex)).toContain('capex-machines');
    expect(capex.groups.flatMap((g) => g.entries).find((e) => e.active)?.id).toBe('capex-budget');
    expect(capex.groups[0].entries[0].href).toBe('/capex/CPX-APM-2026-01');
    const elsewhere = buildNav('project_lead', '/map', 'CPX-SAI-2026-01');
    expect(elsewhere.sections[0].groups[0].entries.find((e) => e.active)?.id).toBe('map');
    expect(elsewhere.sections[2].groups[1].entries[0].href).toBe('/capex/CPX-SAI-2026-01/budget');
  });

  it('the administrator: every business section to read, and the administration by theme', () => {
    const nav = buildNav('admin', '/admin/users');
    expect(nav.fixed.map((e) => e.id)).toEqual(['home', 'approvals']);
    expect(nav.sections.map((s) => s.key)).toEqual(['group', 'subsidiary', 'capex', 'admin']);
    const admin = nav.sections.find((s) => s.key === 'admin')!;
    expect(admin.groups.map((g) => g.label)).toEqual(['Reference data', 'Access', 'Method', 'Integrations']);
    expect(admin.groups.flatMap((g) => g.entries).find((e) => e.active)?.id).toBe('admin-users');
  });

  it('reads and swaps the CAPEX code of a path', () => {
    expect(capexCodeOf('/capex/CPX-SAI-2026-01')).toBe('CPX-SAI-2026-01');
    expect(capexCodeOf('/capex')).toBeNull();
    expect(swapCapexInPath('/capex/CPX-APM-2026-01/budget', 'CPX-SAI-2026-01')).toBe('/capex/CPX-SAI-2026-01/budget');
    expect(swapCapexInPath('/map', 'CPX-SAI-2026-01')).toBe('/capex/CPX-SAI-2026-01');
  });
});
