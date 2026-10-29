// Load test of the portfolio views (AR-049, before a deployment to every subsidiary): with 200 more CAPEX, each with lots, a
// validated budget, actuals, a review, risks and a machine need, the register, the portfolio dashboard, the home alerts and the
// portfolio Gantt read in a fixed number of queries — the same as on the demo data set — and within a few seconds.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>([['arche-role', 'ceo']]);
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));

import { eq } from 'drizzle-orm';
import { budgetLines, budgetVersions, capex, capexLots, lotActuals, machineNeeds, reviews, risks } from '@/server/db/schema';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { alertsForViewer, portfolioDashboard } from './governance';
import { portfolioOf } from './portfolio';
import { portfolioSchedule } from './schedule';

let t: TestDatabase;
let queries = 0;
beforeAll(async () => {
  t = await testDatabase();
  const pool = t.handle.pool as unknown as { query: (...a: unknown[]) => unknown };
  const query = pool.query.bind(pool);
  pool.query = (...a: unknown[]) => {
    queries++;
    return query(...a);
  };
});
afterAll(() => t.close());

async function measure() {
  const viewer = await getViewer();
  const counts: Record<string, number> = {};
  const started = Date.now();
  for (const [name, run] of [
    ['register', () => portfolioOf(viewer, null)],
    ['portfolio', () => portfolioDashboard(viewer, null)],
    ['alerts', () => alertsForViewer(viewer)],
    ['gantt', async () => portfolioSchedule(t.db, (await portfolioOf(viewer, null)).rows)],
  ] as const) {
    const before = queries;
    await run();
    counts[name] = queries - before;
  }
  return { counts, ms: Date.now() - started };
}

async function addCapex(n: number) {
  const [model] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-SAI-2026-01'));
  for (let i = 0; i < n; i++) {
    const [c] = await t.db.insert(capex).values({
      code: `CPX-SAI-2099-${String(i + 1).padStart(3, '0')}`, subsidiaryCode: model.subsidiaryCode, siteId: model.siteId, title: `Load test ${i + 1}`,
      investmentType: model.investmentType, status: 'active', phase: i % 2 ? 'execution' : 'avant_projet', typology: 'strategic', openedAt: new Date('2026-01-05'),
    }).returning();
    const lots = await t.db.insert(capexLots).values([1, 2, 3].map((k) => ({ capexId: c.id, number: k, kind: 'works', title: `Lot ${k}`, plannedStart: '2026-03', plannedEnd: '2026-12' }))).returning();
    const [v] = await t.db.insert(budgetVersions).values({ capexId: c.id, number: 1, estimateClass: 'E10', status: 'validated', isG2Baseline: i % 2 === 1, createdByName: 'Test' }).returning();
    await t.db.insert(budgetLines).values(lots.map((l) => ({ budgetVersionId: v.id, lotId: l.id, amountKeur: 1000 })));
    await t.db.insert(lotActuals).values(lots.map((l) => ({ lotId: l.id, month: '2026-09', committedKeur: 500, spentKeur: 300, physicalPct: 30, enteredByName: 'Test' })));
    await t.db.insert(reviews).values({ capexId: c.id, number: 1, kind: 'copil_projet', heldOn: '2026-09-15', phase: 'execution', attendees: 'Test', summary: 'Test', recordedByName: 'Test' });
    await t.db.insert(risks).values({ capexId: c.id, number: 1, title: 'Risk', category: 'technical', probability: 3, impact: 4 });
    await t.db.insert(machineNeeds).values({ capexId: c.id, number: 1, freeLabel: 'Machine', status: 'draft', createdByName: 'Test' });
  }
}

describe('portfolio views under load (AR-049)', () => {
  it('read in the same number of queries with 200 more CAPEX, within a few seconds', async () => {
    const small = await measure();
    await addCapex(200);
    const large = await measure();
    expect(large.counts).toEqual(small.counts);
    for (const n of Object.values(large.counts)) {
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(60);
    }
    expect(large.ms).toBeLessThan(15_000);
  }, 120_000);
});
