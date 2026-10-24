// Completing an existing demonstration database (npm run db:demo-topup): adds what is missing, changes nothing that is
// there, a second run adds nothing, refused on a production database.
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase, type TestDatabase } from '@/test/db';
import { capex, capexActions, rexEntries, sites, wbsTasks } from '../schema';
import { topUpDemo } from './demo-topup';

describe('topUpDemo', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await testDatabase({ seed: 'demo' });
  });
  afterAll(() => t.close());

  it('adds nothing to the current data set', async () => {
    const r = await t.db.transaction((tx) => topUpDemo(tx));
    expect(r).toMatchObject({ people: 0, roles: 0, sites: 0, located: 0, capex: [], copil: false, needs: [], delivery: false, startup: false, governance: false, rex: 0, actions: [], wbs: [] });
  });

  it('puts back what an older data set lacked, once', async () => {
    const ids = (await t.db.select({ id: capex.id }).from(capex).where(inArray(capex.code, ['CPX-APM-2026-01', 'CPX-SAI-2026-01']))).map((c) => c.id);
    await t.db.delete(capexActions).where(inArray(capexActions.capexId, ids));
    await t.db.delete(wbsTasks).where(inArray(wbsTasks.capexId, ids));
    const [plant] = await t.db.select({ id: capex.id }).from(capex).where(eq(capex.code, 'CPX-SAI-2026-01'));
    await t.db.delete(rexEntries).where(eq(rexEntries.capexId, plant.id));
    await t.db.update(sites).set({ latitude: null, longitude: null });

    const r = await t.db.transaction((tx) => topUpDemo(tx));
    expect(r.located).toBe(3);
    expect(r.rex).toBe(4);
    expect(r.actions).toEqual(['CPX-APM-2026-01', 'CPX-SAI-2026-01']);
    expect(r.wbs).toEqual(['CPX-APM-2026-01', 'CPX-SAI-2026-01']);
    expect(await t.db.$count(capexActions)).toBe(6);
    expect(await t.db.$count(wbsTasks)).toBe(9);

    const again = await t.db.transaction((tx) => topUpDemo(tx));
    expect(again).toMatchObject({ located: 0, rex: 0, actions: [], wbs: [], capex: [] });
  });
});

describe('topUpDemo on a production database', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await testDatabase({ seed: 'production' });
  });
  afterAll(() => t.close());

  it('is refused', async () => {
    await expect(t.db.transaction((tx) => topUpDemo(tx))).rejects.toThrow(/not seeded with the demonstration data set/);
  });
});
