// Currencies (AR-039) on a fresh database with the demo data set: APM keeps its books in dirhams and SAI in CFA francs; a budget
// version and a month's actuals are typed in them and read everywhere in k€ at the group's reference rate (the month's, else
// the fiscal year's); without a rate the entry is refused; the group CFO enters the rates.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { budgetLines, budgetVersions, capex, capexLots, exchangeRates, lotActuals } from '@/server/db/schema';
import { NO_RATE } from '@/server/dal/currency';
import { versionsOf } from '@/server/dal/cycle';
import { testDatabase, type TestDatabase } from '@/test/db';
import { setRateAction } from '../admin/actions';
import { saveBudgetVersionAction } from '../capex/actions';
import { saveActualAction } from './actions';

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

describe('currencies (AR-039)', () => {
  it('a budget version typed in dirhams is read in k€ at October’s rate; the draft shows the dirhams again', async () => {
    const c = await capexOf('CPX-APM-2026-01');
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id));
    // The demo version in progress is submitted: back to draft for the test.
    const [v] = (await t.db.select().from(budgetVersions).where(eq(budgetVersions.capexId, c.id))).filter((x) => x.status === 'submitted');
    await t.db.update(budgetVersions).set({ status: 'draft' }).where(eq(budgetVersions.id, v.id));
    const amounts = Object.fromEntries(lots.map((l) => [`lot:${l.id}`, '10950']));
    expect(await saveBudgetVersionAction('CPX-APM-2026-01', v.id, null, form({ estimateClass: 'E30', ...amounts }))).toEqual({ ok: true });
    const lines = await t.db.select().from(budgetLines).where(eq(budgetLines.budgetVersionId, v.id));
    // 10 950 kMAD at 10.95 MAD for 1 EUR (October 2026) = 1 000 k€.
    expect(lines.every((l) => l.amountKeur === 1000 && l.amountLocal === 10950 && l.currency === 'MAD' && l.rate === 10.95)).toBe(true);
    const view = (await versionsOf(t.db, c.id)).find((x) => x.id === v.id)!;
    expect(view.centralKeur).toBe(1000 * lots.length);
    expect(view.entry).toEqual({ currency: 'MAD', lines: Object.fromEntries(lots.map((l) => [l.id, 10950])) });
    // Typed in euros: no local amount kept.
    expect(await saveBudgetVersionAction('CPX-APM-2026-01', v.id, null, form({ estimateClass: 'E30', currency: 'EUR', ...amounts }))).toEqual({ ok: true });
    expect((await versionsOf(t.db, c.id)).find((x) => x.id === v.id)!.entry).toBeNull();
    expect(await saveBudgetVersionAction('CPX-APM-2026-01', v.id, null, form({ estimateClass: 'E30', currency: 'USD', ...amounts }))).toEqual({ ok: false, error: 'Choose the currency of the amounts' });
  });

  it('a month’s actuals in dirhams at the fiscal year’s rate; without a rate, refused until the group CFO enters it', async () => {
    const c = await capexOf('CPX-APM-2026-01');
    const [lot] = (await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id))).filter((l) => !l.epc2i);
    const save = (o: Record<string, string>) => saveActualAction('CPX-APM-2026-01', lot.id, null, form(o));
    // September 2026 has no monthly rate: the 2026 reference rate, 10.9 MAD for 1 EUR.
    expect(await save({ month: '2026-09', spentKeur: '1090', committedKeur: '2180' })).toEqual({ ok: true });
    const [row] = await t.db.select().from(lotActuals).where(and(eq(lotActuals.lotId, lot.id), eq(lotActuals.month, '2026-09')));
    expect(row).toMatchObject({ spentKeur: 100, committedKeur: 200, spentLocal: 1090, committedLocal: 2180, currency: 'MAD', rate: 10.9 });
    await t.db.delete(exchangeRates).where(eq(exchangeRates.currency, 'MAD'));
    expect(await save({ month: '2026-09', spentKeur: '1' })).toEqual({ ok: false, error: NO_RATE });
    expect(await setRateAction(null, form({ currency: 'MAD', period: '2026', unitsPerEur: '10,9' }))).toEqual({ ok: false, error: 'This action is reserved to the group CFO' });
    jar.set('arche-role', 'group_cfo');
    expect(await setRateAction(null, form({ currency: 'MAD', period: '2026', unitsPerEur: '10,9' }))).toEqual({ ok: true });
    jar.set('arche-role', 'controller');
    expect(await save({ month: '2026-09', spentKeur: '1090' })).toEqual({ ok: true });
  });
});
