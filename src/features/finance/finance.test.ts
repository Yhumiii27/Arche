// Envelopes and phased cash-flow (AR-040, AR-045) on a fresh database with the demo data set: the demo's envelopes consumed by
// the phased disbursements of the CAPEX, the alert over an envelope, the G2 criterion within the tolerance of the model, the
// group CFO's amounts, carry-overs and reallocations, and a lot's forecast that moves disbursements to a later year.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { capex, capexLots, envelopes, lotForecasts } from '@/server/db/schema';
import { gateFacts } from '@/server/dal/cycle';
import { envelopeOverview } from '@/server/dal/finance';
import { capexDashboard } from '@/server/dal/governance';
import { testDatabase, type TestDatabase } from '@/test/db';
import { createEnvelopeAction, moveEnvelopeAction, saveForecastAction, updateEnvelopeAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'group_cfo'));

const TODAY = '2026-10-22';
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const capexOf = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];
const envelopeOf = async (year: number, sub: string | null, zone: string | null = null) =>
  (await t.db.select().from(envelopes).where(eq(envelopes.fiscalYear, year))).find((e) => e.subsidiaryCode === sub && e.zoneCode === zone)!;
const stateOf = async (id: string) => (await envelopeOverview(t.db, TODAY)).states.find((s) => s.envelope.id === id)!;

describe('envelopes and phased cash-flow (AR-040, AR-045)', () => {
  it('the demo: APM within its 2026 envelope; the tomato plant over its zone envelope (a watch alert)', async () => {
    const apm26 = await stateOf((await envelopeOf(2026, 'APM')).id);
    expect(apm26).toMatchObject({ totalKeur: 3000, consumedKeur: 2356, availableKeur: 644 });
    const afo = await stateOf((await envelopeOf(2026, null, 'AFO')).id);
    expect(afo).toMatchObject({ totalKeur: 7000, consumedKeur: 7531 });
    const d = await capexDashboard(t.db, await capexOf('CPX-SAI-2026-01'), TODAY);
    expect(d.alerts.find((a) => a.rule === 'envelope_over')).toMatchObject({ level: 'watch', detail: '2026 · +531 k€' });
  });

  it('G2: over the envelope within the tolerance is met; beyond it, unmet until the envelope is raised', async () => {
    const c = await capexOf('CPX-APM-2026-01');
    expect((await gateFacts(t.db, c)).g2_envelope).toEqual({ met: true, value: '2027: +179.5 k€' });
    const apm27 = await envelopeOf(2027, 'APM');
    jar.set('arche-role', 'controller');
    expect(await updateEnvelopeAction(apm27.id, null, form({ amountKeur: '3000', reason: 'Plan cut' }))).toEqual({ ok: false, error: 'This action is reserved to the group CFO' });
    jar.set('arche-role', 'group_cfo');
    expect(await updateEnvelopeAction(apm27.id, null, form({ amountKeur: '3000', reason: 'Plan cut' }))).toEqual({ ok: true });
    expect((await gateFacts(t.db, c)).g2_envelope).toEqual({ met: false, value: '2027: +879.5 k€' });
    expect(await createEnvelopeAction(null, form({ fiscalYear: '2027', scope: 'sub:APM', category: 'all', amountKeur: '1' }))).toEqual({ ok: false, error: 'This envelope already exists: change its amount' });
  });

  it('a carry-over to the next year within what is available, with a reason', async () => {
    const apm26 = await envelopeOf(2026, 'APM');
    expect(await moveEnvelopeAction(apm26.id, null, form({ amountKeur: '700', reason: 'Carry over' }))).toEqual({ ok: false, error: 'The amount exceeds what is available in the envelope' });
    expect(await moveEnvelopeAction(apm26.id, null, form({ amountKeur: '600', reason: 'Unspent 2026 to 2027' }))).toEqual({ ok: true });
    expect(await stateOf(apm26.id)).toMatchObject({ totalKeur: 2400, availableKeur: 44 });
    const c = await capexOf('CPX-APM-2026-01');
    // 2027: 3 000 + 600 carried over; 279.5 k€ over is within the 10 % tolerance.
    expect((await gateFacts(t.db, c)).g2_envelope).toEqual({ met: true, value: '2027: +279.5 k€' });
  });

  it('a lot’s forecast moves disbursements to 2028: the 2027 envelope is met again', async () => {
    jar.set('arche-role', 'controller');
    const c = await capexOf('CPX-APM-2026-01');
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id));
    const big = lots.filter((l) => !l.epc2i).sort((a, b) => b.number - a.number)[0];
    expect(await saveForecastAction(c.code, big.id, null, form({ currency: 'EUR', 'm:2026-09': '1' }))).toEqual({ ok: false, error: 'Forecast the months after the current one' });
    expect(await saveForecastAction(c.code, big.id, null, form({ currency: 'EUR', 'm:2028-03': '5000' }))).toEqual({ ok: true });
    expect(await t.db.select().from(lotForecasts).where(and(eq(lotForecasts.lotId, big.id)))).toHaveLength(1);
    const fact = (await gateFacts(t.db, c)).g2_envelope;
    expect(fact?.met).toBe(true);
  });
});
