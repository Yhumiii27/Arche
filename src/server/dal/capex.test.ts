// Subsidiary isolation in the data layer (docs/spec/01 §2): every demo persona, through the SQL filter, sees exactly what the
// pure rule allows — and a CAPEX outside its visibility does not exist for it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLE_KEYS } from '@/config/roles';
import { DEMO_TODAY_ISO } from '@/domain/clock';
import { canSeeCapex, capexVisibility } from '@/domain/rights';
import { DEMO_PEOPLE } from '@/server/db/seed/demo';
import { testDatabase, type TestDatabase } from '@/test/db';
import { accountByEmail, viewerOfAccount } from './users';
import { capexForViewer, visibleCapex } from './capex';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());

const viewerOf = async (key: string) => {
  const p = DEMO_PEOPLE.find((x) => x.key === key)!;
  const a = (await accountByEmail(p.email, DEMO_TODAY_ISO))!;
  return viewerOfAccount(a, a.roles[0], true);
};

describe('capex visibility in SQL', () => {
  it('every profile sees what the rule allows, nothing more', async () => {
    const ceo = await viewerOf('ceo');
    const everything = await visibleCapex(ceo);
    expect(everything.map((c) => c.code)).toEqual(['CPX-APM-2025-01', 'CPX-APM-2026-01', 'CPX-APM-2026-02', 'CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03']);
    for (const role of ROLE_KEYS) {
      const v = await viewerOf(role);
      const expected = everything
        .filter((c) => canSeeCapex(capexVisibility(v.role, v.assignments), { code: c.code, subsidiaryCode: c.subsidiaryCode, zoneCode: c.zoneCode, status: c.status }))
        .map((c) => c.code);
      expect((await visibleCapex(v)).map((c) => c.code), role).toEqual(expected);
    }
  });

  it('a subsidiary user never sees another subsidiary: the CAPEX does not exist for them', async () => {
    const apmSponsor = await viewerOf('sponsor');
    expect((await visibleCapex(apmSponsor)).map((c) => c.subsidiaryCode)).toEqual(['APM', 'APM', 'APM']);
    expect(await capexForViewer(apmSponsor, 'CPX-SAI-2026-01')).toBeNull();
    expect((await capexForViewer(apmSponsor, 'CPX-APM-2026-01'))?.title).toBe('Second extrusion line');
    const saiSponsor = await viewerOf('sai_sponsor');
    expect((await visibleCapex(saiSponsor)).map((c) => c.code)).toEqual(['CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03']);
  });

  it('central functions see no draft; the administrator reads every CAPEX, drafts included, like the CEO', async () => {
    expect((await visibleCapex(await viewerOf('group_cfo'))).map((c) => c.code)).toEqual(['CPX-APM-2025-01', 'CPX-APM-2026-01', 'CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03']);
    expect((await visibleCapex(await viewerOf('admin'))).map((c) => c.code)).toEqual((await visibleCapex(await viewerOf('ceo'))).map((c) => c.code));
    expect(await capexForViewer(await viewerOf('admin'), 'CPX-APM-2026-02')).not.toBeNull();
    expect(await capexForViewer(await viewerOf('dir_ig'), 'CPX-APM-2026-02')).toBeNull();
  });
});

describe('pub_capex', () => {
  it('publishes the open CAPEX only (drafts stay in their subsidiary), with the dates of the gates passed', async () => {
    const rows = (await t.handle.pool.query(`select code, statut, phase_code, typologie, g1_le::text, g2_le::text, g3_le from arche.pub_capex order by code`)).rows;
    expect(rows.map((r) => r.code)).toEqual(['CPX-APM-2025-01', 'CPX-APM-2026-01', 'CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03']);
    expect(rows[2]).toMatchObject({ statut: 'active', phase_code: 'execution', typologie: 'strategic', g1_le: '2026-01-20', g2_le: '2026-07-08', g3_le: null });
  });
});
