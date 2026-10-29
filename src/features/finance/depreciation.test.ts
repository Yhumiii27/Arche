// Depreciation and fixed assets (AR-050) on a fresh database with the demo data set: the simulation from the reference budget
// in the asset classes of the lots, a lot's class chosen by the controller, the classes of the group CFO, and the transfer of the
// lots into fixed assets at the accounting closure, exported for Sage.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { eq } from 'drizzle-orm';
import { BP_HORIZON } from '@/domain/bp';
import { assetClasses, capex, capexLots } from '@/server/db/schema';
import { depreciationOf, transfersOf } from '@/server/dal/finance';
import { testDatabase, type TestDatabase } from '@/test/db';
import { GET as exportGet } from '@/app/export/[dataset]/route';
import { saveClosureAction } from '../startup/actions';
import { saveAssetClassAction, setLotClassAction, transferAssetsAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'controller'));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const capexOf = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];

describe('depreciation and fixed assets (AR-050)', () => {
  it('the simulation from the reference budget in the classes of the lots; a lot’s class chosen by the controller', async () => {
    const c = await capexOf('CPX-APM-2026-01');
    const before = await depreciationOf(t.db, c, BP_HORIZON);
    expect(before.month).not.toBeNull();
    expect(before.simulation!.years).toHaveLength(BP_HORIZON);
    expect(before.simulation!.years[1].charge).toBeGreaterThan(0);
    const lot = before.rows.find((r) => r.cls?.code === 'BUILD')!.lot;
    expect(await setLotClassAction(c.code, lot.id, null, form({ assetClassCode: 'EQUIP' }))).toEqual({ ok: true });
    const after = await depreciationOf(t.db, c, BP_HORIZON);
    expect(after.rows.find((r) => r.lot.id === lot.id)!.cls?.code).toBe('EQUIP');
    // Five years instead of twenty: more charge in the second year.
    expect(after.simulation!.years[1].charge).toBeGreaterThan(before.simulation!.years[1].charge);
    expect(await setLotClassAction(c.code, lot.id, null, form({ assetClassCode: 'NOPE' }))).toEqual({ ok: false, error: 'Unknown asset class' });
  });

  it('the group CFO keeps the classes', async () => {
    expect(await saveAssetClassAction(null, form({ code: 'LAND', label: 'Land', lifeYears: '1' }))).toEqual({ ok: false, error: 'This action is reserved to the group CFO' });
    jar.set('arche-role', 'group_cfo');
    expect(await saveAssetClassAction(null, form({ code: 'MACH', label: 'Industrial machinery', lifeYears: '8', method: 'declining', factor: '2,25', 'kind:machines': 'on' }))).toEqual({ ok: true });
    expect((await t.db.select().from(assetClasses).where(eq(assetClasses.code, 'MACH')))[0]).toMatchObject({ lifeYears: 8 });
  });

  it('the lots go into fixed assets at the accounting closure, exported for Sage', async () => {
    const code = 'CPX-APM-2025-01';
    const c = await capexOf(code);
    expect(await transferAssetsAction(code)).toEqual({ ok: false, error: 'Enter the closure statement first' });
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id));
    expect(await saveClosureAction(code, null, form({ afeBalanceKeur: '12', ...Object.fromEntries(lots.map((l) => [`lot:${l.id}`, '400'])) }))).toEqual({ ok: true });
    jar.set('arche-role', 'project_lead');
    expect(await transferAssetsAction(code)).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    jar.set('arche-role', 'controller');
    const r = await transferAssetsAction(code);
    const unclassed = (await depreciationOf(t.db, c, BP_HORIZON)).rows.filter((x) => !x.cls);
    if (unclassed.length) {
      expect(r).toEqual({ ok: false, error: 'Give an asset class to every lot with a final cost' });
      for (const x of unclassed) expect(await setLotClassAction(code, x.lot.id, null, form({ assetClassCode: 'EQUIP' }))).toEqual({ ok: true });
      expect(await transferAssetsAction(code)).toEqual({ ok: true });
    } else expect(r).toEqual({ ok: true });
    const done = await transfersOf(t.db, c.id);
    expect(done).toHaveLength(lots.length);
    expect(done.every((f) => f.inServiceOn === c.mesStartedOn && f.amountKeur === 400)).toBe(true);
    expect(await transferAssetsAction(code)).toEqual({ ok: false, error: 'Nothing left to transfer' });
    const x = await exportGet(new Request(`http://arche.test/export/fixed-assets?format=csv&capex=${code}`), { params: Promise.resolve({ dataset: 'fixed-assets' }) });
    const csv = await x.text();
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(lots.length + 1);
    expect(csv).toContain(`${code}-1`);
  });
});
