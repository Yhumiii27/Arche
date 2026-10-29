// Delivery 3 end to end on a fresh PostgreSQL database with the demo data set ("View as"): a new CAPEX goes through the four
// gates by their circuits — dossiers typed, Codex references, frozen with their SHA-256, expert opinions, visas, signatures,
// decisions — G1 decided in the same day (within the 2 working days of N-7), a refusal and a resubmission at G2, a change
// routed by the delegation matrix, K3 and G3 to closure. Also "My approvals" and the append-only signatures.
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

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { addWorkingDays } from '@/domain/circuits';
import { SECTIONS, type DossierKind } from '@/domain/dossiers';
import type { GateCode } from '@/domain/lifecycle';
import {
  auditEntries, budgetVersions, capex, capexLots, changes, circuitSteps, dossierVersions, gateCriteriaResults, gates, roleAssignments, signatures, users, envelopeMovements, envelopes,
} from '@/server/db/schema';
import { approvalsOf } from '@/server/dal/approvals';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { addLotAction, addMemberAction, createCapexAction, openCapexAction, reviewVersionAction, saveBudgetVersionAction, saveBusinessPlanAction, saveRiskAction, submitVersionAction, validateBusinessPlanAction } from '../capex/actions';
import { createChangeAction, decideChangeAction } from '../changes/actions';
import { addReferenceAction, freezeVersionAction, saveSectionAction } from '../dossiers/actions';
import { saveActualAction, savePackItemAction, savePermitAction } from '../delivery/actions';
import { declareHsAction } from '../safety/actions';
import { importRampupAction, saveClosureAction, saveLineAction, saveRexAction, startMesAction } from '../startup/actions';
import { PACK_TEMPLATE } from '@/domain/pack';
import { actOnStepAction, submitGateAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
  // The CAPEX of this test is not in the demo's envelopes: they would block its G2 (the envelope criterion: finance.test.ts).
  await t.db.delete(envelopeMovements);
  await t.db.delete(envelopes);
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const TODAY = '2026-10-22';
const CODE = 'CPX-APM-2026-03';
const as = (role: string) => jar.set('arche-role', role);
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const row = async () => (await t.db.select().from(capex).where(eq(capex.code, CODE)))[0];
const userId = async (email: string) => (await t.db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0].id;
const session = async (gate: GateCode) => (await t.db.select().from(gates).where(and(eq(gates.capexId, (await row()).id), eq(gates.code, gate))).orderBy(desc(gates.session)))[0];
const steps = async (gateId: string) => t.db.select().from(circuitSteps).where(eq(circuitSteps.gateId, gateId)).orderBy(asc(circuitSteps.position));
const stepOf = async (gate: GateCode, label: string) => (await steps((await session(gate)).id)).find((s) => s.label === label)!;
const act = async (role: string, gate: GateCode, label: string, o: Record<string, string>) => {
  as(role);
  return actOnStepAction(CODE, (await stepOf(gate, label)).id, null, form(o));
};
const latestVersion = async (kind: DossierKind) =>
  (await t.db.execute(sql`select v.* from arche.dossier_versions v join arche.dossiers d on d.id = v.dossier_id join arche.capex c on c.id = d.capex_id where c.code = ${CODE} and d.kind = ${kind} order by v.number desc limit 1`)).rows[0] as { id: string; number: number; state: string; completeness_pct: number; content_hash: string | null };

/** The group HSE declares a safety milestone passed (N-13). */
async function hsPassed(code: string) {
  as('group_hse');
  expect(await declareHsAction(CODE, code, null, form({ status: 'passed', evidenceRef: `HSE-${CODE}-${code}`, passedOn: TODAY }))).toEqual({ ok: true });
}

async function fillTexts(kind: DossierKind) {
  as('project_lead');
  for (const s of SECTIONS[kind].filter((x) => x.mode === 'text')) expect(await saveSectionAction(CODE, kind, s.key, null, form({ text: `${s.title}: typed by the project lead` }))).toEqual({ ok: true });
}

async function validatedVersion(cls: string, amounts: string[], validator: string) {
  as('project_lead');
  const c = await row();
  const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, c.id)).orderBy(capexLots.number);
  expect(await saveBudgetVersionAction(CODE, null, null, form({ estimateClass: cls, currency: 'EUR', ...Object.fromEntries(lots.map((l, i) => [`lot:${l.id}`, amounts[i]])) }))).toEqual({ ok: true });
  const [bv] = await t.db.select().from(budgetVersions).where(eq(budgetVersions.capexId, c.id)).orderBy(desc(budgetVersions.number)).limit(1);
  expect(await submitVersionAction(CODE, bv.id)).toEqual({ ok: true });
  as(validator);
  expect(await reviewVersionAction(CODE, bv.id, 'validate')).toEqual({ ok: true });
}

describe('delivery 3: a CAPEX through its four gates by the circuits', () => {
  it('set-up: draft, opening, lots, team, E50 validated, a risk', async () => {
    as('project_lead');
    expect(await createCapexAction(null, form({ title: 'Recycling line', investmentType: 'new_line' }))).toEqual({ ok: true, code: CODE });
    as('sponsor');
    expect(await openCapexAction(CODE)).toEqual({ ok: true });
    as('project_lead');
    expect(await addLotAction(CODE, null, form({ kind: 'civil_works', title: 'Slab' }))).toEqual({ ok: true });
    expect(await addLotAction(CODE, null, form({ kind: 'machines', title: 'Shredder and extruder (EPC2i)' }))).toEqual({ ok: true });
    expect(await addMemberAction(CODE, null, form({ userId: await userId('t.girard@groupe.example'), capexRole: 'co_dig' }))).toEqual({ ok: true });
    expect(await addMemberAction(CODE, null, form({ userId: await userId('l.haddad@atlas-process.example'), capexRole: 'internal_client' }))).toEqual({ ok: true });
    expect(await saveRiskAction(CODE, null, null, form({ title: 'Recycled resin quality', category: 'technical', probability: '2', impact: '3' }))).toEqual({ ok: true });
    await validatedVersion('E50', ['500', '2 500'], 'controller');
    expect(await row()).toMatchObject({ typology: 'light', phase: 'cadrage' });
    as('project_lead');
    expect(await declareHsAction(CODE, 'HS2', null, form({ status: 'passed', evidenceRef: 'X', passedOn: TODAY }))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('group_hse');
    expect(await declareHsAction(CODE, 'HS2', null, form({ status: 'passed', passedOn: TODAY }))).toEqual({ ok: false, error: 'Give the reference of the evidence (Vigie or Codex)' });
    await hsPassed('HS2');
  });

  it('dossier 1: sections and Codex references, complete, frozen with its SHA-256; submission before freezing refused', async () => {
    await fillTexts('business_case');
    expect(await addReferenceAction(CODE, 'business_case', 'safety', null, form({ codexId: 'not-cpx-apm-2026-01-002' }))).toEqual({ ok: true });
    expect(await addReferenceAction(CODE, 'business_case', 'strategy', null, form({ codexId: 'NOT-CPX-APM-2026-03-001', revision: 'A' }))).toEqual({ ok: true });
    expect(await addReferenceAction(CODE, 'business_case', 'strategy', null, form({ codexId: 'hello' }))).toMatchObject({ ok: false });
    const v1 = await latestVersion('business_case');
    expect(v1).toMatchObject({ number: 1, state: 'draft', completeness_pct: 100 });
    const content = (await t.db.select().from(dossierVersions).where(eq(dossierVersions.id, v1.id)))[0].content as { sections: Record<string, { refs: { id: string; verified: boolean; revision: string | null }[] }> };
    expect(content.sections.safety.refs).toEqual([{ id: 'NOT-CPX-APM-2026-01-002', revision: 'A', title: 'HazID report — second extrusion line', verified: true }]);
    expect(content.sections.strategy.refs[0]).toMatchObject({ verified: false, title: null, revision: 'A' });
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: false, error: 'Freeze the dossier before submitting the gate' });
    expect(await freezeVersionAction(CODE, 'business_case')).toEqual({ ok: true });
    const frozen = await latestVersion('business_case');
    expect(frozen.state).toBe('frozen');
    expect(frozen.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('G1 dematerialised end to end the same day: opinion, sponsor visa with signature, decision of the COPIL GPI president', async () => {
    as('controller');
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    as('project_lead');
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: true });
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: false, error: 'A circuit is already running for this gate' });
    const g = await session('G1');
    expect(g).toMatchObject({ status: 'in_review', session: 1 });
    expect((await steps(g.id)).map((s) => [s.label, s.status, s.dueOn])).toEqual([
      ['HSE opinion', 'open', addWorkingDays(TODAY, 5)],
      ['Sponsor visa', 'waiting', null],
      ['COPIL GPI members’ review', 'waiting', null],
      ['COPIL GPI decision (president)', 'waiting', null],
    ]);

    // "My approvals": the HSE opinion waits on the group HSE, not on the CFO.
    as('group_hse');
    expect((await approvalsOf(await getViewer())).map((i) => [i.capexCode, i.title, i.detail])).toContainEqual([CODE, 'HSE opinion', 'G1 · session 1']);
    as('group_cfo');
    expect((await approvalsOf(await getViewer())).some((i) => i.capexCode === CODE && i.kind === 'step')).toBe(false);

    expect(await act('dir_ig', 'G1', 'COPIL GPI decision (president)', { outcome: 'go', confirm: 'on' })).toEqual({ ok: false, error: 'This step is not open' });
    expect(await act('group_hse', 'G1', 'HSE opinion', { outcome: 'favorable' })).toEqual({ ok: true });
    expect(await act('sponsor', 'G1', 'Sponsor visa', { outcome: 'approved' })).toEqual({ ok: false, error: 'Confirm the statement to sign' });
    expect(await act('sponsor', 'G1', 'Sponsor visa', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    const visa = await stepOf('G1', 'Sponsor visa');
    const [sig] = await t.db.select().from(signatures).where(eq(signatures.circuitStepId, visa.id));
    const v1 = await latestVersion('business_case');
    expect(sig).toMatchObject({ userName: 'Karim Benali', contentHash: v1.content_hash, level: 'simple' });
    expect(sig.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(sig.statement).toContain(`SHA-256 ${v1.content_hash}`);

    const decision = await stepOf('G1', 'COPIL GPI decision (president)');
    expect(decision).toMatchObject({ status: 'open', openedOn: TODAY, dueOn: addWorkingDays(TODAY, 2) });
    expect(await act('copil_member', 'G1', 'COPIL GPI members’ review', { outcome: 'noted', comment: 'Market study convincing' })).toEqual({ ok: true });
    expect(await act('dir_ig', 'G1', 'COPIL GPI decision (president)', { outcome: 'go', confirm: 'on' })).toEqual({ ok: true });

    expect(await row()).toMatchObject({ status: 'active', phase: 'avant_projet' });
    const decided = await session('G1');
    expect(decided).toMatchObject({ status: 'decided', decision: 'go', decidedByName: 'Claire Morel' });
    expect(decided.decidedAt!.toISOString().slice(0, 10) <= addWorkingDays(TODAY, 2)).toBe(true);
    const crit = Object.fromEntries((await t.db.select().from(gateCriteriaResults).where(eq(gateCriteriaResults.gateId, decided.id))).map((c) => [c.criterionCode, c.state]));
    expect(crit).toMatchObject({ g1_dossier: 'met', g1_sponsor_visa: 'met', g1_experts: 'met', g1_budget_e50: 'met', g1_typology: 'met', g1_hs2: 'met' });
    expect((await latestVersion('business_case')).state).toBe('approved');
  });

  it('editing an approved dossier starts the next version; the approved one stays', async () => {
    as('project_lead');
    expect(await saveSectionAction(CODE, 'business_case', 'need', null, form({ text: 'Updated after G1' }))).toEqual({ ok: true });
    const v = await t.db.execute(sql`select v.number, v.state from arche.dossier_versions v join arche.dossiers d on d.id = v.dossier_id join arche.capex c on c.id = d.capex_id where c.code = ${CODE} and d.kind = 'business_case' order by v.number`);
    expect(v.rows).toEqual([{ number: 1, state: 'approved' }, { number: 2, state: 'draft' }]);
  });

  it('G2: dossier 2 with the validated business plan and E10; a refused visa sends it back; resubmitted, signed by the CEO', async () => {
    // Experts of quality and operations named on the CAPEX (the administrator's role assignment).
    const expert = await userId('a.diop@sahel-agro.example');
    await t.db.insert(roleAssignments).values(['quality', 'operations'].map((speciality) => ({ userId: expert, role: 'expert' as const, scopeKind: 'capex' as const, scopeRef: CODE, speciality: speciality as 'quality', createdByName: 'Test' })));
    await validatedVersion('E10', ['600', '3 400'], 'group_cfo');
    as('controller');
    expect(await saveBusinessPlanAction(CODE, null, form({ discountRatePct: '9', 'capex:0': '4 000', 'revenue:1': '1 500', 'opex:1': '600', 'revenue:2': '1 800', 'opex:2': '650' }))).toEqual({ ok: true });
    as('controller');
    expect(await validateBusinessPlanAction(CODE)).toEqual({ ok: false, error: 'Only the group CFO validates the business plan' });
    as('group_cfo');
    expect(await validateBusinessPlanAction(CODE)).toEqual({ ok: true });
    // Delivery 5: HS 3, the ICPE and the building permit, the engineering pack above 80 %.
    await hsPassed('HS3');
    as('project_lead');
    expect(await savePermitAction(CODE, null, null, form({ kind: 'icpe', title: 'ICPE declaration', status: 'filed', filedOn: '2026-09-01', dueOn: '2026-12-15' }))).toEqual({ ok: true });
    expect(await savePermitAction(CODE, null, null, form({ kind: 'building_permit', title: 'Building permit', status: 'obtained', filedOn: '2026-06-01', obtainedOn: '2026-10-01' }))).toEqual({ ok: true });
    expect(await savePackItemAction(CODE, PACK_TEMPLATE[0].code, null, form({ status: 'validated' }))).toEqual({ ok: false, error: 'Give the Codex reference of the validated document' });
    for (const i of PACK_TEMPLATE.slice(0, 9)) expect(await savePackItemAction(CODE, i.code, null, form({ status: 'validated', codexRef: `PLN-${CODE}-${i.code}` }))).toEqual({ ok: true });
    await fillTexts('investment');
    expect((await latestVersion('investment')).completeness_pct).toBe(100);
    expect(await freezeVersionAction(CODE, 'investment')).toEqual({ ok: true });
    expect(await submitGateAction(CODE, null, form({ 'expert:quality': expert }))).toEqual({ ok: true });

    expect(await act('expert', 'G2', 'Quality opinion', { outcome: 'favorable' })).toEqual({ ok: true });
    expect(await act('expert', 'G2', 'Operations opinion', { outcome: 'favorable' })).toEqual({ ok: true });
    expect(await act('group_hse', 'G2', 'HSE opinion', { outcome: 'favorable' })).toEqual({ ok: true });
    expect(await act('group_cfo', 'G2', 'Finance opinion', { outcome: 'reserved' })).toEqual({ ok: false, error: 'Give the reason' });
    expect(await act('group_cfo', 'G2', 'Finance opinion', { outcome: 'reserved', comment: 'Working capital to detail' })).toEqual({ ok: true });
    expect(await act('dir_ig', 'G2', 'Technical compliance visa', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await act('group_cfo', 'G2', 'E10 business plan visa', { outcome: 'refused', confirm: 'on', comment: 'Payback inconsistent with the plan' })).toEqual({ ok: true });
    expect(await session('G2')).toMatchObject({ status: 'returned', session: 1 });
    expect((await latestVersion('investment')).state).toBe('rejected');
    expect((await stepOf('G2', 'CEO signature')).status).toBe('cancelled');

    // The project lead revises: version 2, frozen, session 2.
    as('project_lead');
    expect(await saveSectionAction(CODE, 'investment', 'baseline', null, form({ text: 'Variant B, payback recomputed with the CFO' }))).toEqual({ ok: true });
    expect(await freezeVersionAction(CODE, 'investment')).toEqual({ ok: true });
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: true });
    for (const [role, label] of [['expert', 'Quality opinion'], ['expert', 'Operations opinion'], ['group_hse', 'HSE opinion'], ['group_cfo', 'Finance opinion']]) expect(await act(role, 'G2', label, { outcome: 'favorable' })).toEqual({ ok: true });
    expect(await act('dir_ig', 'G2', 'Technical compliance visa', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await act('group_cfo', 'G2', 'E10 business plan visa', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await act('dir_ig', 'G2', 'CEO signature', { outcome: 'go', confirm: 'on' })).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    expect(await act('ceo', 'G2', 'CEO signature', { outcome: 'go_with_conditions', confirm: 'on' })).toEqual({ ok: false, error: 'Enter at least one condition' });
    expect(await act('ceo', 'G2', 'CEO signature', { outcome: 'go_with_conditions', confirm: 'on', conditions: 'Detail the working capital' })).toEqual({ ok: true });
    expect(await row()).toMatchObject({ phase: 'execution' });
    expect(await session('G2')).toMatchObject({ session: 2, decision: 'go_with_conditions' });
    const [base] = await t.db.select().from(budgetVersions).where(and(eq(budgetVersions.capexId, (await row()).id), eq(budgetVersions.isG2Baseline, true)));
    expect(base.estimateClass).toBe('E10');
  });

  it('a change after G2 goes to the decider of the delegation matrix', async () => {
    as('project_lead');
    expect(await createChangeAction(CODE, null, form({ title: 'Extra piles under the extruder', kind: 'cost', amountKeur: '100' }))).toEqual({ ok: true });
    expect(await createChangeAction(CODE, null, form({ title: 'Second shredder', kind: 'cost', amountKeur: '400' }))).toEqual({ ok: true });
    const cs = await t.db.select().from(changes).where(eq(changes.capexId, (await row()).id)).orderBy(changes.number);
    // 100 / 4 000 = 2.5 % ≤ 3 % and ≤ 250 k€ → project steering committee; 400 = 10 % → CEO.
    expect(cs.map((c) => c.requiredDecider)).toEqual(['copil_projet', 'ceo']);
    as('dir_ig');
    expect(await decideChangeAction(CODE, cs[0].id, 'approved', '')).toEqual({ ok: false, error: 'This change is decided by another level' });
    as('sponsor');
    expect((await approvalsOf(await getViewer())).map((i) => i.detail)).toContain('MOC-01');
    expect(await decideChangeAction(CODE, cs[0].id, 'approved', '')).toEqual({ ok: true });
    as('ceo');
    expect(await decideChangeAction(CODE, cs[1].id, 'rejected', '')).toEqual({ ok: false, error: 'Give the reason' });
    expect(await decideChangeAction(CODE, cs[1].id, 'rejected', 'Second shredder not justified')).toEqual({ ok: true });
  });

  it('K3 (no dossier) by the visa of the group industrial director; G3 by discharge, attestation and countersignatures', async () => {
    // Delivery 5: HS 4 and the works lot complete (the slab at 100 %), entered by the controller.
    await hsPassed('HS4');
    const slab = (await t.db.select().from(capexLots).where(and(eq(capexLots.capexId, (await row()).id), eq(capexLots.kind, 'civil_works'))))[0];
    as('controller');
    expect(await saveActualAction(CODE, slab.id, null, form({ month: '2026-10', currency: 'EUR', spentKeur: '590', physicalPct: '100' }))).toEqual({ ok: true });
    as('project_lead');
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: true });
    expect(await act('dir_ig', 'K3', 'Ready-to-start visa', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await row()).toMatchObject({ phase: 'demarrage' });

    // Delivery 6: commissioning after the PSSR, a line at its nominal capacity for 30 days, the accounting closure, the REX.
    as('project_lead');
    expect(await startMesAction(CODE, null, form({ day: '2026-09-01' }))).toEqual({ ok: false, error: 'The PSSR must be passed before the start of commissioning' });
    await hsPassed('PSSR');
    await hsPassed('HS6');
    as('project_lead');
    expect(await startMesAction(CODE, null, form({ day: '2026-09-01' }))).toEqual({ ok: true });
    expect(await saveLineAction(CODE, null, null, form({ name: 'Extrusion line', nominalPerDay: '10', unit: 't', scrapTargetPct: '2' }))).toEqual({ ok: true });
    const days = Array.from({ length: 30 }, (_, i) => `1;2026-09-${String(i + 1).padStart(2, '0')};10,5;;;;82;1,5;`).join('\n');
    expect(await importRampupAction(CODE, null, form({ csv: days }))).toEqual({ ok: true });
    as('controller');
    const lots = await t.db.select().from(capexLots).where(eq(capexLots.capexId, (await row()).id));
    expect(await saveClosureAction(CODE, null, form({ afeBalanceKeur: '-40', ...Object.fromEntries(lots.map((l) => [`lot:${l.id}`, l.kind === 'machines' ? '3 450' : '590'])) }))).toEqual({ ok: true });
    as('project_lead');
    for (const phase of ['cadrage', 'avant_projet', 'execution', 'demarrage']) expect(await saveRexAction(CODE, null, null, form({ phase, category: 'technical', title: `Lesson of ${phase}`, text: 'What we learned.' }))).toEqual({ ok: true });
    await fillTexts('transfer');
    expect(await freezeVersionAction(CODE, 'transfer')).toEqual({ ok: true });
    expect(await submitGateAction(CODE, null, form({}))).toEqual({ ok: true });
    expect(await act('group_hse', 'G3', 'PSSR discharge', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await act('controller', 'G3', 'Accounting closure attestation', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await act('dir_ig', 'G3', 'Group industrial director countersignature', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect((await row()).status).toBe('active');
    expect(await act('sponsor', 'G3', 'Internal client countersignature', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: false, error: 'You cannot do this on this CAPEX' });
    expect(await act('project_lead', 'G3', 'Internal client countersignature', { outcome: 'approved', confirm: 'on' })).toEqual({ ok: true });
    expect(await row()).toMatchObject({ status: 'closed' });
    expect(await session('G3')).toMatchObject({ status: 'decided', decision: 'go' });
    const g3 = Object.fromEntries((await t.db.select().from(gateCriteriaResults).where(eq(gateCriteriaResults.gateId, (await session('G3')).id))).map((c) => [c.criterionCode, c.state]));
    expect(g3).toMatchObject({ g3_pssr: 'met', g3_hs6: 'met', g3_rampup: 'met', g3_mes_delay: 'met', g3_accounts: 'met', g3_rex: 'met' });
  });

  it('signatures are append-only; the circuit is audited', async () => {
    await expect(t.db.execute(sql`update arche.signatures set user_name = 'x'`)).rejects.toThrow();
    await expect(t.db.execute(sql`delete from arche.signatures`)).rejects.toThrow();
    expect(await t.db.$count(signatures)).toBeGreaterThanOrEqual(12);
    const changesAudited = (await t.db.select({ c: auditEntries.change }).from(auditEntries).where(eq(auditEntries.objectRef, CODE))).map((a) => a.c);
    expect(changesAudited).toContain('G2 session 1: circuit stopped (refused), dossier sent back');
    expect(changesAudited).toContain('G3 session 1: go → closed');
  });
});
