// Delivery 4 on a fresh PostgreSQL database with the demo data set ("View as"): the project lead enters and submits machine
// needs, a submitted need is published in pub_besoins_machines (drafts never), the simulated answer of EPC2i comes back with
// the synchronisation of the mirror, the G2 criterion counts the firm offers, the G2 Go orders the covered needs, K3 and G3
// read the EPC2i projects; a view Keystone shares is read instead of its simulation (mixed mode).
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
import pg from 'pg';
import { latestAnswer } from '@/domain/needs';
import { capex, gates, machineNeeds } from '@/server/db/schema';
import { applyGateDecision } from '@/server/cycle/gate-decision';
import { currentEvaluation } from '@/server/cycle/evaluation';
import { answersOf, catalogue, projectsOf, syncKeystone, syncState } from '@/server/integrations/keystone';
import { simulatedProjectCode } from '@/server/integrations/keystone/simulation';
import { testDatabase, type TestDatabase } from '@/test/db';
import { deleteNeedAction, saveNeedAction, submitNeedAction, withdrawNeedAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const APM = 'CPX-APM-2026-01';
const SAI = 'CPX-SAI-2026-01';
const as = (role: string) => jar.set('arche-role', role);
const form = (o: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) fd.append(k, x);
  return fd;
};
const capexOf = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];
const needOf = async (code: string, n: number) => (await t.db.select().from(machineNeeds).where(and(eq(machineNeeds.capexId, (await capexOf(code)).id), eq(machineNeeds.number, n))))[0];
const published = async () => (await t.handle.pool.query(`select besoin_ref, statut, quantite, options from arche.pub_besoins_machines order by besoin_ref`)).rows;

describe('delivery 4: machine needs and the Keystone connector', () => {
  it('pub_besoins_machines: contract v1 columns, drafts not published', async () => {
    const cols = await t.handle.pool.query(`select column_name from information_schema.columns where table_schema = 'arche' and table_name = 'pub_besoins_machines' order by ordinal_position`);
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'besoin_ref', 'capex_code', 'ligne', 'catalogue_code', 'catalogue_version', 'libelle_libre', 'quantite', 'options', 'capacite_visee', 'unite_capacite', 'date_besoin', 'site', 'statut',
      'commentaire', 'soumis_le', 'commande_le', 'maj_le',
    ]);
    expect((await published()).map((r) => `${r.besoin_ref} ${r.statut}`)).toEqual(['CPX-APM-2025-01/B01 ordered', `${APM}/B01 submitted`, `${APM}/B02 submitted`, `${SAI}/B01 ordered`, `${SAI}/B02 ordered`]);
  });

  it('the demo mirror: simulated catalogue, answers and the EPC2i projects of SAI', async () => {
    const sheets = await catalogue(t.db);
    expect(sheets.filter((s) => s.status === 'publie').map((s) => `${s.code}@${s.version}`)).toEqual(['EXT-9MN@3', 'EXT-AGE@1', 'PRC-CAN@1', 'PRC-TOM@2']);
    const answers = await answersOf(t.db, APM);
    expect(latestAnswer(answers, `${APM}/B01`)).toMatchObject({ nature: 'devis', estimateClass: 'E30', documentRef: `DEV-${APM}-B01` });
    expect(latestAnswer(answers, `${APM}/B02`)).toMatchObject({ nature: 'offre_ferme', estimateClass: 'E10', centralKeur: 663 });
    const projects = await projectsOf(t.db, SAI);
    expect(projects.map((p) => p.code)).toEqual(['SAI-26011', 'SAI-26012']);
    expect(projects[0]).toMatchObject({ needRef: `${SAI}/B01`, phase: 'Manufacturing' });
    expect(projects[0].milestones.map((m) => m.code)).toEqual(['commande', 'fin_etudes', 'fat', 'expedition', 'arrivee_site', 'sat', 'pv_reception', 'fin_garantie']);
    expect(projects[0].amendments.map((a) => `${a.number} ${a.status}`)).toEqual(['AV-01 signe', 'AV-02 propose']);
    expect(simulatedProjectCode(`${SAI}/B01`)).toBe('SAI-26011');
  });

  it('the project lead enters a need: checks on the catalogue, the quantity, the right', async () => {
    as('project_lead');
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'CON-BLT@1' }))).toEqual({ ok: false, error: 'Choose a machine of the catalogue' });
    expect(await saveNeedAction(APM, null, null, form({ catalogue: '', freeLabel: 'ab' }))).toEqual({ ok: false, error: 'Choose a machine of the catalogue or describe the need' });
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'EXT-9MN@3', quantity: '0' }))).toEqual({ ok: false, error: 'The quantity goes from 1 to 99' });
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'EXT-9MN@3', quantity: '2', options: ['QUENCH', 'NOPE'], targetCapacity: '1,8' }))).toEqual({ ok: true });
    const n = await needOf(APM, 4);
    expect(n).toMatchObject({ status: 'draft', catalogueCode: 'EXT-9MN', catalogueVersion: 3, quantity: 2, options: ['QUENCH'], targetCapacity: 1.8, capacityUnit: 't/h' });
    expect((await published()).some((r) => r.besoin_ref === `${APM}/B04`)).toBe(false);
    as('sponsor');
    expect(await submitNeedAction(APM, n.id)).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('project_lead');
    expect(await saveNeedAction(SAI, null, null, form({ catalogue: 'PRC-CAN@1' }))).toEqual({ ok: false, error: 'CAPEX not found' });
  });

  it('a submitted need is published, and the answer of EPC2i comes back with the synchronisation', async () => {
    as('project_lead');
    const n = await needOf(APM, 4);
    expect(await submitNeedAction(APM, n.id)).toEqual({ ok: true });
    expect(await submitNeedAction(APM, n.id)).toEqual({ ok: false, error: 'This need is already submitted' });
    expect(await saveNeedAction(APM, n.id, null, form({ catalogue: 'EXT-9MN@3' }))).toEqual({ ok: false, error: 'A submitted need is no longer edited: withdraw it and enter a new one' });
    expect(await deleteNeedAction(APM, n.id)).toEqual({ ok: false, error: 'Only a draft is deleted; a submitted need is withdrawn' });
    expect((await published()).find((r) => r.besoin_ref === `${APM}/B04`)).toMatchObject({ statut: 'submitted', quantite: 2, options: ['QUENCH'] });
    const submitted = (await needOf(APM, 4)).submittedAt!;
    await syncKeystone(t.db, { now: new Date(submitted.getTime() + 5 * 60_000), mode: 'simulation' });
    expect(latestAnswer(await answersOf(t.db, APM), `${APM}/B04`)).toBeNull();
    await syncKeystone(t.db, { now: new Date(submitted.getTime() + 2 * 86_400_000), mode: 'simulation' });
    // (4200 + 120) × 2 = 8640 k€ at E50.
    expect(latestAnswer(await answersOf(t.db, APM), `${APM}/B04`)).toMatchObject({ nature: 'indicatif', estimateClass: 'E50', centralKeur: 8640, leadTimeWeeks: 40 });
    expect((await syncState(t.db)).every((s) => s.source === 'simulation' && !s.error)).toBe(true);
  });

  it('the G2 criterion counts the valid firm offers of the submitted needs', async () => {
    const ev = await currentEvaluation(t.db, await capexOf(APM));
    expect(ev?.gate).toBe('G2');
    expect(ev?.results.find((r) => r.code === 'g2_epc2i_offers')).toMatchObject({ state: 'unmet', value: '1 / 3' });
  });

  it('a need is withdrawn with a reason; a draft is deleted', async () => {
    as('project_lead');
    const n = await needOf(APM, 4);
    expect(await withdrawNeedAction(APM, n.id, ' ')).toEqual({ ok: false, error: 'Give the reason' });
    expect(await withdrawNeedAction(APM, n.id, 'Second press postponed')).toEqual({ ok: true });
    expect((await published()).find((r) => r.besoin_ref === `${APM}/B04`)?.statut).toBe('withdrawn');
    expect(await deleteNeedAction(APM, (await needOf(APM, 3)).id)).toEqual({ ok: true });
    expect(await needOf(APM, 3)).toBeUndefined();
  });

  it('the G2 Go orders the submitted needs covered by a valid firm offer, the others stay submitted', async () => {
    const c = await capexOf(APM);
    await t.db.transaction(async (tx) => {
      const [g] = await tx.insert(gates).values({ capexId: c.id, code: 'G2', session: 9, status: 'in_review' }).returning({ id: gates.id });
      const ev = (await currentEvaluation(tx, c))!;
      await applyGateDecision(tx, c, { name: 'Test CEO', userId: c.sponsorUserId!, role: 'ceo' }, { id: g.id, code: 'G2', session: 9 }, 'go', { status: 'active', phase: 'execution' }, ev, { reason: 'test', conditions: [], today: '2026-10-22' });
    });
    expect(await needOf(APM, 1)).toMatchObject({ status: 'submitted', orderedOn: null });
    expect(await needOf(APM, 2)).toMatchObject({ status: 'ordered', orderedOn: '2026-10-22' });
    await syncKeystone(t.db, { now: new Date('2026-10-23T09:00:00Z'), mode: 'simulation' });
    expect((await projectsOf(t.db, APM)).map((p) => p.code)).toEqual(['APM-26012']);
  });

  it('K3 and G3 read the EPC2i projects: SATs planned, reservations', async () => {
    const ev = await currentEvaluation(t.db, await capexOf(SAI));
    expect(ev?.gate).toBe('K3');
    expect(ev?.results.find((r) => r.code === 'k3_sat_planned')).toMatchObject({ state: 'met', value: '2 / 2' });
  });

  it('views mode: a view Keystone shares is read, the missing ones stay simulated on the demo data set', async () => {
    const admin = new pg.Client({ connectionString: t.url });
    await admin.connect();
    try {
      await admin.query(`create schema if not exists keystone`);
      await admin.query(`create view keystone.pub_catalogue_machines as select 'EMP-40T'::text as code, 1 as version, 'EMP'::text as type_code, 'EMP'::text as type_libelle, null::text as variante,
        'Real sheet'::text as libelle, null::text as description, '[]'::jsonb as options, 40::numeric as capacite_nominale, 't'::text as unite_capacite, 900::numeric as prix_indicatif_keur,
        30 as delai_type_semaines, 'publie'::text as statut, now() as maj_le`);
      await admin.query(`grant usage on schema keystone to ${t.role}; grant select on keystone.pub_catalogue_machines to ${t.role}`);
    } finally {
      await admin.end();
    }
    const r = await syncKeystone(t.db, { now: new Date('2026-10-23T09:00:00Z'), mode: 'views' });
    expect(r.find((x) => x.view === 'pub_catalogue_machines')).toMatchObject({ source: 'views', rows: 1, error: null });
    expect(r.find((x) => x.view === 'pub_reponses_besoins')?.source).toBe('simulation');
    expect((await catalogue(t.db)).map((s) => s.code)).toEqual(['EMP-40T']);
  });
});
