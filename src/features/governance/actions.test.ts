// Delivery 5 on a fresh PostgreSQL database with the demo data set ("View as"): delivery data entered with their rights
// (permits, pack, actuals and the CSV import, safety milestones), reviews and audits, the rule-based alerts of the demo
// CAPEX, the portfolio through the visibility filter, the COPIL GPI agenda and the weekly snapshots.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { capex, capexLots, capexSnapshots, decisions, lotActuals } from '@/server/db/schema';
import { capexDashboard, copilAgenda, portfolioDashboard, takeSnapshots, weekOf } from '@/server/dal/governance';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { importActualsAction, saveActualAction, savePackItemAction, savePermitAction } from '../delivery/actions';
import { declareHsAction } from '../safety/actions';
import { recordReviewAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const TODAY = '2026-10-22';
const APM = 'CPX-APM-2026-01';
const SAI = 'CPX-SAI-2026-01';
const as = (role: string) => jar.set('arche-role', role);
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const row = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];
const dash = async (code: string) => capexDashboard(t.db, await row(code), TODAY);
const lot = async (code: string, n: number) => (await t.db.select().from(capexLots).where(and(eq(capexLots.capexId, (await row(code)).id), eq(capexLots.number, n))))[0];

describe('delivery 5: dashboards and governance', () => {
  it('the demo dashboards: execution of SAI, pack of APM, reviews and the alerts', async () => {
    const sai = await dash(SAI);
    expect(sai.indicators).toMatchObject({ bacKeur: 18300 });
    expect(sai.indicators.cpi).toBeLessThan(0.9);
    expect(sai.missingAudits).toEqual(['avant_projet']);
    expect(sai.review).toMatchObject({ dueOn: '2026-10-24', state: 'ok' });
    expect(sai.alerts.map((a) => a.rule)).toEqual(expect.arrayContaining(['cpi_low', 'eac_over', 'audit_missing']));
    const apm = await dash(APM);
    expect(apm.pack).toMatchObject({ pct: 60 });
    expect(apm.review).toMatchObject({ dueOn: '2026-09-20', state: 'escalated' });
    expect(apm.gap).toEqual({ kind: 'range', widthPct: 100, targetClass: 'E10', targetWidthPct: 15, gapPts: 85 });
    expect(apm.alerts.map((a) => a.rule)).toEqual(expect.arrayContaining(['review_escalated', 'permit_due']));
  });

  it('delivery data are written with their rights; EPC2i lots are not entered', async () => {
    as('controller');
    expect(await savePermitAction(APM, null, null, form({ kind: 'plu', title: 'PLU', status: 'not_required', note: 'Industrial zone' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('project_lead');
    expect(await savePermitAction(APM, null, null, form({ kind: 'plu', title: 'PLU', status: 'not_required', note: 'Industrial zone' }))).toEqual({ ok: true });
    expect(await savePackItemAction(APM, 'nope', null, form({ status: 'expected' }))).toEqual({ ok: false, error: 'Unknown pack item' });
    expect(await declareHsAction(APM, 'HS3', null, form({ status: 'passed', evidenceRef: 'X', passedOn: TODAY }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('group_hse');
    expect(await declareHsAction(APM, 'HS3', null, form({ status: 'passed', evidenceRef: 'HAZOP-APM-01', passedOn: TODAY }))).toEqual({ ok: true });
    expect((await dash(APM)).hs).toMatchObject({ passed: 2 });

    const machines = await lot(SAI, 5);
    as('epc2i_pmo');
    expect(await saveActualAction(SAI, (await lot(SAI, 2)).id, null, form({ month: '2026-10', physicalPct: '45' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('dir_ig');
    expect(await saveActualAction(SAI, machines.id, null, form({ month: '2026-10', physicalPct: '45' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
  });

  it('the CSV import: one bad line refuses the file; a good file replaces the months it carries', async () => {
    jar.set('arche-role', 'project_lead');
    // The demo project lead persona leads the APM CAPEX.
    const civil = await lot(APM, 1);
    expect(await importActualsAction(APM, null, form({ csv: 'lot;month;committed_keur;spent_keur;physical_pct\n1;2026-10;300;50;5\n3;2026-10;1;1;1' }))).toEqual({ ok: false, error: 'Line 3 — EPC2i lots come from Keystone' });
    expect(await t.db.$count(lotActuals, eq(lotActuals.lotId, civil.id))).toBe(0);
    expect(await importActualsAction(APM, null, form({ csv: '1;2026-09;300;20;2\n1;2026-10;300;50;5' }))).toEqual({ ok: true });
    expect((await t.db.select().from(lotActuals).where(eq(lotActuals.lotId, civil.id))).map((r) => [r.month, r.spentKeur, r.source])).toEqual([['2026-09', 20, 'import'], ['2026-10', 50, 'import']]);
  });

  it('a project review and its decisions; an audit by the group industrial director on a Strategic CAPEX only', async () => {
    as('project_lead');
    expect(await recordReviewAction(APM, null, form({ kind: 'copil_projet', heldOn: '2026-10-21', attendees: 'Sponsor, lead', summary: 'Pack at 60 %.' }))).toEqual({ ok: true });
    expect(await recordReviewAction(APM, null, form({ kind: 'copil_projet', heldOn: '2026-11-21', attendees: 'x', summary: 'x' }))).toEqual({ ok: false, error: 'The date cannot be in the future' });
    expect(await recordReviewAction(APM, null, form({ kind: 'audit', heldOn: TODAY, attendees: 'x', summary: 'x' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    expect((await dash(APM)).review).toMatchObject({ dueOn: '2027-01-21', state: 'ok' });
    as('sponsor');
    expect(await recordReviewAction(APM, null, form({ kind: 'copil_projet', heldOn: TODAY, attendees: 'Sponsor, lead, controller', summary: 'Variant B confirmed.', decisions: 'Order the soil survey\nHazOp in November' }))).toEqual({ ok: true });
    const ds = await t.db.select().from(decisions).where(eq(decisions.capexId, (await row(APM)).id));
    expect(ds.filter((d) => d.reviewId).map((d) => [d.body, d.text])).toEqual([['copil_projet', 'Order the soil survey'], ['copil_projet', 'HazOp in November']]);
    as('dir_ig');
    expect(await recordReviewAction(APM, null, form({ kind: 'audit', heldOn: TODAY, attendees: 'x', summary: 'x' }))).toEqual({ ok: false, error: 'Cross-functional audits are for Strategic CAPEX' });
    expect(await recordReviewAction(SAI, null, form({ kind: 'audit', heldOn: TODAY, attendees: 'Group industrial director, EPC2i PMO', summary: 'Execution audit.' }))).toEqual({ ok: true });
    // Recorded during phase 3: the phase 2 audit is still missing.
    expect((await dash(SAI)).missingAudits).toEqual(['avant_projet']);
  });

  it('the portfolio through the visibility filter; the COPIL GPI agenda; the weekly snapshots', async () => {
    as('zone_director');
    expect((await portfolioDashboard(await getViewer(), null)).rows.map((r) => r.code)).toEqual(['CPX-APM-2025-01', APM]);
    as('dir_ig');
    const p = await portfolioDashboard(await getViewer(), null);
    expect(p.rows.map((r) => r.code)).toEqual(['CPX-APM-2025-01', APM, SAI]);
    expect(p.rows.find((r) => r.code === APM)!.trend.length).toBeGreaterThanOrEqual(12);
    const agenda = await copilAgenda(await getViewer());
    expect(agenda.running).toEqual([]);
    expect(await takeSnapshots(t.db, TODAY)).toBe(3);
    expect(await takeSnapshots(t.db, TODAY)).toBe(3);
    expect(await t.db.$count(capexSnapshots, eq(capexSnapshots.week, weekOf(TODAY)))).toBe(3);
  });
});
