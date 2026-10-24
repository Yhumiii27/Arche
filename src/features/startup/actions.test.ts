// Delivery 6 on a fresh PostgreSQL database with the demo data set ("View as"): the CAPEX in its start-up (CPX-APM-2025-01)
// — ramp-up reached on its line and published in pub_rampup with the machine of the installed base, rights of the ramp-up
// entries (project lead, operations expert of the CAPEX), the CSV import, the controller's closure, the lessons learned and
// their publication in the library and pub_rex; the G3 criteria and the next step.
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

import { eq } from 'drizzle-orm';
import { capex, capexLots, productionLines, rexEntries, roleAssignments, users } from '@/server/db/schema';
import { currentEvaluation } from '@/server/cycle/evaluation';
import { rexLibrary } from '@/server/dal/rampup';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { importRampupAction, publishRexAction, saveClosureAction, saveLineAction, saveRampupDayAction, saveRexAction, startMesAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const CODE = 'CPX-APM-2025-01';
const as = (role: string) => jar.set('arche-role', role);
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const row = async () => (await t.db.select().from(capex).where(eq(capex.code, CODE)))[0];
const line = async () => (await t.db.select().from(productionLines).where(eq(productionLines.capexId, (await row()).id)))[0];

describe('delivery 6: start-up, ramp-up and transfer', () => {
  it('the demo: commissioning started, the line reached its 30 days, published with its machine', async () => {
    expect(await row()).toMatchObject({ phase: 'demarrage', mesStartedOn: '2026-07-01' });
    const pub = await t.handle.pool.query('select machine_numero, capex_code, ligne_production, statut, trente_jours_le::text from arche.pub_rampup');
    expect(pub.rows).toHaveLength(1);
    expect(pub.rows[0]).toMatchObject({ capex_code: CODE, ligne_production: 'Ageing oven', statut: 'atteint', trente_jours_le: '2026-10-18' });
    expect(pub.rows[0].machine_numero).toMatch(/^MCH-\d{3}$/);
    const cols = await t.handle.pool.query(`select column_name from information_schema.columns where table_schema = 'arche' and table_name = 'pub_rex' order by ordinal_position`);
    expect(cols.rows.map((r) => r.column_name)).toEqual(['ref_source', 'capex_code', 'projet_code', 'categorie', 'titre', 'texte', 'phase', 'publie_le', 'auteur']);
    const ev = (await currentEvaluation(t.db, await row()))!;
    const state = Object.fromEntries(ev.results.map((r) => [r.code, r.state]));
    expect(state).toMatchObject({ g3_pssr: 'met', g3_rampup: 'met', g3_mes_delay: 'met', g3_accounts: 'unmet', g3_rex: 'unmet', g3_hs6: 'unmet' });
  });

  it('ramp-up entries: the project lead and the operations expert of the CAPEX; a day refused before the MES', async () => {
    const l = await line();
    as('controller');
    expect(await saveRampupDayAction(CODE, l.id, null, form({ day: '2026-10-22', output: '50', scrapPct: '1', oeePct: '90' }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('expert');
    expect(await saveRampupDayAction(CODE, l.id, null, form({ day: '2026-10-22', output: '50', scrapPct: '1', oeePct: '90' }))).toEqual({ ok: false, error: 'CAPEX not found' });
    const expert = (await t.db.select({ id: users.id }).from(users).where(eq(users.email, 'a.diop@sahel-agro.example')))[0].id;
    await t.db.insert(roleAssignments).values({ userId: expert, role: 'expert', scopeKind: 'capex', scopeRef: CODE, speciality: 'operations', createdByName: 'Test' });
    expect(await saveRampupDayAction(CODE, l.id, null, form({ day: '2026-10-22', output: '50', scrapPct: '1', oeePct: '90' }))).toEqual({ ok: true });
    as('project_lead');
    expect(await saveRampupDayAction(CODE, l.id, null, form({ day: '2026-06-30', output: '50', scrapPct: '1', oeePct: '90' }))).toEqual({ ok: false, error: 'The day is before the start of commissioning' });
    expect(await startMesAction(CODE, null, form({ day: '2026-07-02' }))).toEqual({ ok: false, error: 'Commissioning has already started' });
    expect(await importRampupAction(CODE, null, form({ csv: 'line;day;output\n1;2026-10-21;50;;;;90;1;\n9;2026-10-21;50;;;;90;1;' }))).toEqual({ ok: false, error: 'Line 3 — Unknown production line number' });
    expect(await saveLineAction(CODE, null, null, form({ name: 'Packing', nominalPerDay: '20', unit: 't', scrapTargetPct: '1', machineNumbers: 'MCH-900' }))).toEqual({ ok: true });
    // A new line without days: the CAPEX's run is no longer reached; pub_rampup gets its machine.
    const ev = (await currentEvaluation(t.db, await row()))!;
    expect(ev.results.find((r) => r.code === 'g3_rampup')).toMatchObject({ state: 'unmet', value: '1 / 2 · 0 / 30' });
    expect((await t.handle.pool.query('select machine_numero, statut from arche.pub_rampup order by machine_numero')).rows.map((r) => r.statut)).toEqual(['atteint', 'en_cours']);
  });

  it('the accounting closure by the controller; the lessons learned and their publication', async () => {
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, (await row()).id));
    const statement = { afeBalanceKeur: '-25', ...Object.fromEntries(lots.map((l) => [`lot:${l.id}`, '500'])) };
    as('project_lead');
    expect(await saveClosureAction(CODE, null, form(statement))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('controller');
    expect(await saveClosureAction(CODE, null, form({ afeBalanceKeur: '0' }))).toEqual({ ok: false, error: 'Give the final cost of every lot (k€)' });
    expect(await saveClosureAction(CODE, null, form(statement))).toEqual({ ok: true });
    as('project_lead');
    expect(await saveRexAction(CODE, null, null, form({ phase: 'demarrage', category: 'technical', title: 'Tune the recipes before the MES', text: 'Two weeks lost on the ageing recipes.', recommendation: 'Validate the recipes at the FAT.' }))).toEqual({ ok: true });
    const ev = (await currentEvaluation(t.db, await row()))!;
    expect(Object.fromEntries(ev.results.map((r) => [r.code, r.state]))).toMatchObject({ g3_accounts: 'met', g3_rex: 'met' });
    const [draft] = await t.db.select().from(rexEntries).where(eq(rexEntries.title, 'Tune the recipes before the MES'));
    as('controller');
    expect(await publishRexAction(CODE, draft.id)).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('sponsor');
    expect(await publishRexAction(CODE, draft.id)).toEqual({ ok: true });
    expect(await publishRexAction(CODE, draft.id)).toEqual({ ok: false, error: 'This lesson is already published' });
    as('project_lead');
    expect(await saveRexAction(CODE, draft.id, null, form({ phase: 'demarrage', category: 'technical', title: 'x', text: 'x' }))).toEqual({ ok: false, error: 'A published lesson is not changed' });
    expect((await t.handle.pool.query('select titre from arche.pub_rex order by publie_le')).rows.map((r) => r.titre)).toContain('Tune the recipes before the MES');
    // pub_rex_v2: the common REX contract of Matrix (same columns as keystone.pub_rex), phase at the end.
    const v2 = await t.handle.pool.query(`select column_name, data_type from information_schema.columns where table_schema = 'arche' and table_name = 'pub_rex_v2' order by ordinal_position`);
    expect(v2.rows.map((r) => r.column_name)).toEqual(['ref_source', 'outil', 'projet_code', 'capex_code', 'numero', 'categorie', 'titre', 'constat', 'impact', 'recommandation', 'portee', 'statut', 'auteur', 'cree_le', 'maj_le', 'phase']);
    expect(v2.rows.filter((r) => r.column_name === 'cree_le' || r.column_name === 'maj_le').map((r) => r.data_type)).toEqual(['timestamp with time zone', 'timestamp with time zone']);
    const pub = (await t.handle.pool.query(`select * from arche.pub_rex_v2 where titre = 'Tune the recipes before the MES'`)).rows[0];
    expect(pub).toMatchObject({ ref_source: `rex_entries:${draft.id}`, outil: 'arche', projet_code: null, capex_code: CODE, categorie: 'technical', constat: 'Two weeks lost on the ageing recipes.', recommandation: 'Validate the recipes at the FAT.', statut: 'publie', phase: 'demarrage' });
    expect(pub.numero).toMatch(/^REX-\d{2}$/);
    // The library shows the CAPEX the viewer sees only: a SAI sponsor does not see the lessons of APM.
    as('sponsor');
    expect((await rexLibrary(await getViewer())).length).toBe(3);
    as('epc2i_pmo');
    expect(new Set((await rexLibrary(await getViewer())).map((r) => r.capex.code))).toEqual(new Set(['CPX-SAI-2026-01']));
  });
});
