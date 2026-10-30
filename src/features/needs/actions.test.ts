// Delivery 4 on a fresh PostgreSQL database with the demo data set ("View as"), aligned with Keystone's demo (owner, 25 Oct
// 2026): the project lead enters and submits machine needs, a submitted need is published in pub_besoins_machines (drafts
// never), Keystone's own demo answers and project RCF-019 are mirrored, the simulated answer of EPC2i comes back with
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
    expect((await published()).map((r) => `${r.besoin_ref} ${r.statut}`)).toEqual([
      'CPX-APM-2025-01/B01 ordered', `${APM}/B01 submitted`, `${APM}/B02 submitted`, `${SAI}/B01 ordered`, `${SAI}/B02 withdrawn`, `${SAI}/B03 ordered`,
    ]);
  });

  it('the demo mirror: the demo of Keystone itself — its catalogue, its answers RB-001 to RB-005 and RCF-019 (owner, 25 Oct 2026)', async () => {
    const sheets = await catalogue(t.db);
    expect(sheets.map((s) => `${s.code}@${s.version} ${s.status}`)).toEqual(['EMP-40T@1 publie', 'MEMU-16@1 publie', 'SPUR-2X@1 retire']);
    const apm = await answersOf(t.db, APM);
    expect(latestAnswer(apm, `${APM}/B01`)).toMatchObject({ number: 'RB-005', nature: 'devis', estimateClass: 'E30', centralKeur: 4150, documentRef: 'DEV-CPX-APM-2026-01-001' });
    expect(latestAnswer(apm, `${APM}/B02`)).toBeNull();
    const sai = await answersOf(t.db, SAI);
    expect(latestAnswer(sai, `${SAI}/B01`)).toMatchObject({ number: 'RB-003', nature: 'offre_ferme', projectCode: 'RCF-019' });
    expect(latestAnswer(sai, `${SAI}/B03`)).toMatchObject({ number: 'RB-002', estimateClass: 'E10', centralKeur: 8436, projectCode: null });
    const projects = await projectsOf(t.db, SAI);
    expect(projects.map((p) => p.code)).toEqual(['RCF-019']);
    expect(projects[0]).toMatchObject({ needRef: `${SAI}/B01`, phase: 'Chantier' });
    expect(projects[0].milestones.map((m) => m.code)).toEqual(['commande', 'fin_etudes', 'fat', 'expedition', 'arrivee_site', 'sat', 'pv_reception', 'fin_garantie']);
    // The oven of CPX-APM-2025-01, unknown to Keystone's demo, keeps a generated project.
    expect((await projectsOf(t.db, 'CPX-APM-2025-01')).map((p) => p.code)).toEqual([simulatedProjectCode('CPX-APM-2025-01/B01')]);
  });

  it('the project lead enters a need: checks on the catalogue, the quantity, the right', async () => {
    as('project_lead');
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'SPUR-2X@1' }))).toEqual({ ok: false, error: 'Choose a machine of the catalogue' });
    expect(await saveNeedAction(APM, null, null, form({ catalogue: '', freeLabel: 'ab' }))).toEqual({ ok: false, error: 'Choose a machine of the catalogue or describe the need' });
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'EMP-40T@1', quantity: '0' }))).toEqual({ ok: false, error: 'The quantity goes from 1 to 99' });
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'EMP-40T@1', quantity: '2', options: ['TELE', 'NOPE'], targetCapacity: '40' }))).toEqual({ ok: true });
    const n = await needOf(APM, 3);
    expect(n).toMatchObject({ status: 'draft', catalogueCode: 'EMP-40T', catalogueVersion: 1, quantity: 2, options: ['TELE'], targetCapacity: 40, capacityUnit: 't' });
    expect((await published()).some((r) => r.besoin_ref === `${APM}/B03`)).toBe(false);
    as('sponsor');
    expect(await submitNeedAction(APM, n.id)).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('project_lead');
    expect(await saveNeedAction(SAI, null, null, form({ catalogue: 'MEMU-16@1' }))).toEqual({ ok: false, error: 'CAPEX not found' });
  });

  it('a submitted need is published, and the answer of EPC2i comes back with the synchronisation', async () => {
    as('project_lead');
    const n = await needOf(APM, 3);
    expect(await submitNeedAction(APM, n.id)).toEqual({ ok: true });
    expect(await submitNeedAction(APM, n.id)).toEqual({ ok: false, error: 'This need is already submitted' });
    expect(await saveNeedAction(APM, n.id, null, form({ catalogue: 'EMP-40T@1' }))).toEqual({ ok: false, error: 'A submitted need is no longer edited: withdraw it and enter a new one' });
    expect(await deleteNeedAction(APM, n.id)).toEqual({ ok: false, error: 'Only a draft is deleted; a submitted need is withdrawn' });
    expect((await published()).find((r) => r.besoin_ref === `${APM}/B03`)).toMatchObject({ statut: 'submitted', quantite: 2, options: ['TELE'] });
    const submitted = (await needOf(APM, 3)).submittedAt!;
    await syncKeystone(t.db, { now: new Date(submitted.getTime() + 5 * 60_000), mode: 'simulation' });
    expect(latestAnswer(await answersOf(t.db, APM), `${APM}/B03`)).toBeNull();
    await syncKeystone(t.db, { now: new Date(submitted.getTime() + 2 * 86_400_000), mode: 'simulation' });
    // A need Keystone's demo does not know is answered by the simulation: (4200 + 18) × 2 = 8436 k€ at E50.
    expect(latestAnswer(await answersOf(t.db, APM), `${APM}/B03`)).toMatchObject({ nature: 'indicatif', estimateClass: 'E50', centralKeur: 8436, leadTimeWeeks: 52 });
    // Keystone's own answers stay as they are.
    expect(latestAnswer(await answersOf(t.db, APM), `${APM}/B01`)).toMatchObject({ number: 'RB-005' });
    expect((await syncState(t.db)).every((s) => s.source === 'simulation' && !s.error)).toBe(true);
  });

  it('the G2 criterion counts the valid firm offers of the submitted needs', async () => {
    // Two months later, the simulation has made its firm offer on B03; Keystone's B01 is at the quote, B02 not answered yet.
    await syncKeystone(t.db, { now: new Date((await needOf(APM, 3)).submittedAt!.getTime() + 70 * 86_400_000), mode: 'simulation' });
    const ev = await currentEvaluation(t.db, await capexOf(APM));
    expect(ev?.gate).toBe('G2');
    expect(ev?.results.find((r) => r.code === 'g2_epc2i_offers')).toMatchObject({ state: 'unmet', value: '1 / 3' });
  });

  it('a need is withdrawn with a reason; a draft is deleted', async () => {
    as('project_lead');
    const n = await needOf(APM, 2);
    expect(await withdrawNeedAction(APM, n.id, ' ')).toEqual({ ok: false, error: 'Give the reason' });
    expect(await withdrawNeedAction(APM, n.id, 'Cooling kept in the extrusion line')).toEqual({ ok: true });
    expect((await published()).find((r) => r.besoin_ref === `${APM}/B02`)?.statut).toBe('withdrawn');
    expect(await saveNeedAction(APM, null, null, form({ catalogue: 'MEMU-16@1' }))).toEqual({ ok: true });
    expect(await deleteNeedAction(APM, (await needOf(APM, 4)).id)).toEqual({ ok: true });
    expect(await needOf(APM, 4)).toBeUndefined();
  });

  it('the G2 Go orders the submitted needs covered by a valid firm offer, the others stay submitted', async () => {
    const c = await capexOf(APM);
    await t.db.transaction(async (tx) => {
      const [g] = await tx.insert(gates).values({ capexId: c.id, code: 'G2', session: 9, status: 'in_review' }).returning({ id: gates.id });
      const ev = (await currentEvaluation(tx, c))!;
      await applyGateDecision(tx, c, { name: 'Test CEO', userId: c.sponsorUserId!, role: 'ceo' }, { id: g.id, code: 'G2', session: 9 }, 'go', { status: 'active', phase: 'execution' }, ev, { reason: 'test', conditions: [], today: '2026-10-22' });
    });
    expect(await needOf(APM, 1)).toMatchObject({ status: 'submitted', orderedOn: null });
    expect(await needOf(APM, 3)).toMatchObject({ status: 'ordered', orderedOn: '2026-10-22' });
    await syncKeystone(t.db, { now: new Date('2026-10-23T09:00:00Z'), mode: 'simulation' });
    expect((await projectsOf(t.db, APM)).map((p) => p.code)).toEqual([simulatedProjectCode(`${APM}/B03`)]);
  });

  it('K3 and G3 read the EPC2i projects: SATs planned, reservations', async () => {
    const ev = await currentEvaluation(t.db, await capexOf(SAI));
    expect(ev?.gate).toBe('K3');
    // Keystone's demo: RCF-019 has no SAT date yet (its project for B03 is still to be created).
    expect(ev?.results.find((r) => r.code === 'k3_sat_planned')).toMatchObject({ state: 'unmet', value: '0 / 1' });
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
