// Demonstration data set (N-21): two fictitious subsidiaries — Atlas Process Maroc (APM, North Africa) and Sahel Agro
// Industries (SAI, West Africa) —, the group, one person per profile and three CAPEX (one Light, one Strategic, one draft).
// No real person or company. The e-mail domains are reserved example domains.
import { eq } from 'drizzle-orm';
import type { RoleKey, ScopeKind, ExpertSpeciality } from '@/config/roles';
import {
  authorizations, budgetLines, budgetVersions, capex, capexLots, capexSnapshots, hsStatuses, lotActuals, packItems, reviews, capexMembers, decisions, gateCriteriaResults, gates, phaseTransitions, referenceRevenues, risks,
  roleAssignments, sites, subsidiaries, users, zones, type CapexRole, type EstimateClass, type GateCode,
} from '../schema';
import { createHash } from 'node:crypto';
import { circuitTemplate } from '@/domain/circuits';
import { canonicalJson, emptyContent, SECTIONS, type DossierKind } from '@/domain/dossiers';
import { computedSnapshot } from '@/server/dal/dossiers';
import { businessPlans, changes, circuitSteps, dossiers, dossierVersions, machineNeeds, signatures } from '../schema';
import { and } from 'drizzle-orm';
import { syncKeystone } from '@/server/integrations/keystone/mirror';
import { PACK_TEMPLATE } from '@/domain/pack';
import { takeSnapshots, weekOf } from '@/server/dal/governance';
import type { Tx } from '../types';

export const DEMO_ZONES = [
  { code: 'AFN', name: 'North Africa', boundsWest: -18, boundsNorth: 38, boundsEast: 12, boundsSouth: 18 },
  { code: 'AFO', name: 'West Africa', boundsWest: -20, boundsNorth: 26, boundsEast: 16, boundsSouth: 2 },
  { code: 'EUR', name: 'Europe', boundsWest: -12, boundsNorth: 62, boundsEast: 34, boundsSouth: 34 },
] as const;

export const DEMO_SUBSIDIARIES = [
  { code: 'APM', name: 'Atlas Process Maroc', countryIso2: 'MA', zoneCode: 'AFN', currency: 'MAD' },
  { code: 'SAI', name: 'Sahel Agro Industries', countryIso2: 'SN', zoneCode: 'AFO', currency: 'XOF' },
] as const;

const DEMO_SITES = [
  { subsidiaryCode: 'APM', name: 'Kénitra plant', city: 'Kénitra', countryIso2: 'MA', latitude: 34.261, longitude: -6.58 },
  { subsidiaryCode: 'SAI', name: 'Thiès site', city: 'Thiès', countryIso2: 'SN', latitude: 14.791, longitude: -16.926 },
] as const;

interface DemoPerson {
  key: string;
  name: string;
  email: string;
  title: string;
  subsidiary: string | null;
  roles: { role: RoleKey; scope: ScopeKind; ref: string | null; speciality?: ExpertSpeciality }[];
}

const G = 'groupe.example';
const APM = 'atlas-process.example';
const SAI = 'sahel-agro.example';

/** One persona per profile (the "View as" list) first, then the other people of the data set. */
export const DEMO_PEOPLE: DemoPerson[] = [
  { key: 'ceo', name: 'Henri Valette', email: `h.valette@${G}`, title: 'Chief executive officer', subsidiary: null, roles: [{ role: 'ceo', scope: 'group', ref: null }] },
  { key: 'dir_ig', name: 'Claire Morel', email: `c.morel@${G}`, title: 'Group industrial director', subsidiary: null, roles: [{ role: 'dir_ig', scope: 'group', ref: null }] },
  { key: 'group_cfo', name: 'Paul Renaud', email: `p.renaud@${G}`, title: 'Group CFO', subsidiary: null, roles: [{ role: 'group_cfo', scope: 'group', ref: null }] },
  { key: 'group_hse', name: 'Sophie Lambert', email: `s.lambert@${G}`, title: 'Group HSE director', subsidiary: null, roles: [{ role: 'group_hse', scope: 'group', ref: null }] },
  { key: 'copil_member', name: 'Marc Dufour', email: `m.dufour@${G}`, title: 'COPIL GPI member', subsidiary: null, roles: [{ role: 'copil_member', scope: 'group', ref: null }] },
  { key: 'zone_director', name: 'Youssef El Amrani', email: `y.elamrani@${G}`, title: 'Zone director — North Africa', subsidiary: null, roles: [{ role: 'zone_director', scope: 'zone', ref: 'AFN' }] },
  { key: 'sponsor', name: 'Karim Benali', email: `k.benali@${APM}`, title: 'Managing director', subsidiary: 'APM', roles: [{ role: 'sponsor', scope: 'subsidiary', ref: 'APM' }] },
  { key: 'project_lead', name: 'Leïla Haddad', email: `l.haddad@${APM}`, title: 'Project lead', subsidiary: 'APM', roles: [{ role: 'project_lead', scope: 'capex', ref: 'CPX-APM-2026-01' }, { role: 'project_lead', scope: 'capex', ref: 'CPX-APM-2026-02' }] },
  { key: 'controller', name: 'Nadia Tazi', email: `n.tazi@${APM}`, title: 'Management controller', subsidiary: 'APM', roles: [{ role: 'controller', scope: 'subsidiary', ref: 'APM' }] },
  { key: 'co_dig', name: 'Thomas Girard', email: `t.girard@${G}`, title: 'Co-DIG', subsidiary: null, roles: [{ role: 'co_dig', scope: 'capex', ref: 'CPX-APM-2026-01' }] },
  { key: 'epc2i_pmo', name: 'Julien Roche', email: `j.roche@${G}`, title: 'EPC2i PMO', subsidiary: null, roles: [{ role: 'epc2i_pmo', scope: 'capex', ref: 'CPX-SAI-2026-01' }] },
  { key: 'expert', name: 'Aminata Diop', email: `a.diop@${SAI}`, title: 'HSE manager', subsidiary: 'SAI', roles: [{ role: 'expert', scope: 'capex', ref: 'CPX-SAI-2026-01', speciality: 'hse' }] },
  { key: 'admin', name: 'Arche administrator', email: `admin.arche@${G}`, title: 'Arche administrator', subsidiary: null, roles: [{ role: 'admin', scope: 'group', ref: null }] },
  { key: 'sai_sponsor', name: 'Moussa Ndiaye', email: `m.ndiaye@${SAI}`, title: 'Managing director', subsidiary: 'SAI', roles: [{ role: 'sponsor', scope: 'subsidiary', ref: 'SAI' }] },
  { key: 'sai_lead', name: 'Fatou Sarr', email: `f.sarr@${SAI}`, title: 'Dedicated project lead', subsidiary: 'SAI', roles: [{ role: 'project_lead', scope: 'capex', ref: 'CPX-SAI-2026-01' }] },
  { key: 'sai_controller', name: 'Ibrahima Fall', email: `i.fall@${SAI}`, title: 'Management controller', subsidiary: 'SAI', roles: [{ role: 'controller', scope: 'subsidiary', ref: 'SAI' }] },
];

interface DemoCapex {
  code: string; subsidiary: string; site: string; title: string; investmentType: 'new_plant' | 'new_line' | 'extension' | 'other';
  status: 'draft' | 'active'; phase: 'cadrage' | 'avant_projet' | 'execution'; typology: 'light' | 'strategic' | null;
  sponsor: string; lead: string; team: [string, CapexRole][]; openedOn?: string; needDate?: string;
  /** Gates passed: code and decision date. */
  passed: [GateCode, string][];
  lots: [string, string][];
  /** Versions: class, status, amounts per lot (same order as `lots`), validated on. */
  versions: { cls: EstimateClass; status: 'draft' | 'submitted' | 'validated' | 'superseded'; amounts: number[]; on: string; basis: string; g2?: boolean }[];
  risks: { title: string; category: string; p: number; i: number; owner: string; response: string; status?: string; due?: string }[];
  decisions: [string, string, string][];
}

const DEMO_CAPEX: DemoCapex[] = [
  {
    code: 'CPX-APM-2026-01', subsidiary: 'APM', site: 'Kénitra plant', title: 'Second extrusion line', investmentType: 'new_line', status: 'active', phase: 'avant_projet', typology: 'light',
    sponsor: 'sponsor', lead: 'project_lead', team: [['project_lead', 'lead'], ['controller', 'controller'], ['co_dig', 'co_dig']], openedOn: '2026-03-02', needDate: '2027-09-01',
    passed: [['G1', '2026-05-12']],
    lots: [['civil_works', 'Foundations and slab'], ['utilities', 'Compressed air and cooling'], ['machines', 'Extrusion line (EPC2i)']],
    versions: [
      { cls: 'E50', status: 'validated', amounts: [600, 400, 3800], on: '2026-04-28', basis: 'Ratios and EPC2i catalogue prices' },
      { cls: 'E30', status: 'submitted', amounts: [650, 420, 4130], on: '2026-10-05', basis: 'Variant B retained, EPC2i budgetary quote (APS)' },
    ],
    risks: [
      { title: 'Late delivery of the extruder die', category: 'schedule', p: 3, i: 3, owner: 'project_lead', response: 'Order the die with the APS', due: '2026-12-15' },
      { title: 'Slab load capacity insufficient', category: 'technical', p: 2, i: 3, owner: 'project_lead', response: 'Soil survey ordered' },
    ],
    decisions: [['2026-05-12', 'copil_gpi', 'G1 Go: preliminary design studies released'], ['2026-09-18', 'copil_projet', 'Variant B (inline cooling) retained']],
  },
  {
    code: 'CPX-APM-2026-02', subsidiary: 'APM', site: 'Kénitra plant', title: 'Warehouse extension', investmentType: 'extension', status: 'draft', phase: 'cadrage', typology: null,
    sponsor: 'sponsor', lead: 'project_lead', team: [['project_lead', 'lead']], passed: [], lots: [['buildings', 'Warehouse building']], versions: [], risks: [], decisions: [],
  },
  {
    code: 'CPX-SAI-2026-01', subsidiary: 'SAI', site: 'Thiès site', title: 'New tomato processing plant', investmentType: 'new_plant', status: 'active', phase: 'execution', typology: 'strategic',
    sponsor: 'sai_sponsor', lead: 'sai_lead', team: [['sai_lead', 'lead'], ['sai_controller', 'controller'], ['epc2i_pmo', 'epc2i_pmo'], ['expert', 'member']], openedOn: '2025-11-03', needDate: '2027-06-01',
    passed: [['G1', '2026-01-20'], ['G2', '2026-07-08']],
    lots: [['land', 'Plot acquisition'], ['civil_works', 'Earthworks and civil works'], ['buildings', 'Process hall and offices'], ['utilities', 'Steam, water and power'], ['machines', 'Processing lines (EPC2i)'], ['recruitment', 'Recruitment and training']],
    versions: [
      { cls: 'E50', status: 'superseded', amounts: [900, 2000, 3200, 1500, 8000, 400], on: '2026-01-10', basis: 'Ratios from the Kaolack plant' },
      { cls: 'E30', status: 'superseded', amounts: [950, 2300, 3400, 1700, 8600, 450], on: '2026-04-15', basis: 'APS, EPC2i budgetary quotes' },
      { cls: 'E10', status: 'validated', amounts: [980, 2400, 3550, 1800, 9100, 470], on: '2026-06-30', basis: 'APD, firm EPC2i offers, CFO business plan', g2: true },
    ],
    risks: [
      { title: 'Grid connection later than planned', category: 'schedule', p: 3, i: 4, owner: 'sai_lead', response: 'Rental generators as a fallback', due: '2027-01-31' },
      { title: 'Tomato supply below the plan in year 1', category: 'market', p: 2, i: 4, owner: 'sai_sponsor', response: 'Contracts with three growers’ cooperatives' },
      { title: 'Building permit appeal', category: 'regulatory', p: 1, i: 4, owner: 'sai_lead', response: 'Appeal period expired', status: 'closed' },
    ],
    decisions: [['2026-01-20', 'copil_gpi', 'G1 Go: studies released'], ['2026-07-08', 'ceo', 'G2 Go: CAPEX in force, baseline E10']],
  },
];

/** Reference revenue of the demo subsidiaries (k€). */
const DEMO_REVENUES = [
  { subsidiaryCode: 'APM', fiscalYear: 2025, revenueKeur: 62000, enteredByName: 'Paul Renaud', sourceNote: '2025 audited accounts' },
  { subsidiaryCode: 'SAI', fiscalYear: 2025, revenueKeur: 24000, enteredByName: 'Paul Renaud', sourceNote: '2025 audited accounts' },
];

const GATE_DECIDER_KEY: Record<GateCode, string> = { G1: 'dir_ig', G2: 'ceo', K3: 'dir_ig', G3: 'dir_ig' };
const PHASE_AFTER: Record<GateCode, string> = { G1: 'avant_projet', G2: 'execution', K3: 'demarrage', G3: 'demarrage' };
const at = (day: string) => new Date(`${day}T10:00:00Z`);

export async function seedDemo(tx: Tx): Promise<void> {
  await tx.insert(zones).values([...DEMO_ZONES]);
  await tx.insert(subsidiaries).values([...DEMO_SUBSIDIARIES]);
  const siteRows = await tx.insert(sites).values([...DEMO_SITES]).returning({ id: sites.id, name: sites.name });
  const siteId = new Map(siteRows.map((s) => [s.name, s.id]));
  const userRows = await tx.insert(users).values(DEMO_PEOPLE.map((p) => ({ email: p.email, displayName: p.name, jobTitle: p.title, subsidiaryCode: p.subsidiary })))
    .returning({ id: users.id, email: users.email });
  const userId = new Map(userRows.map((u) => [u.email, u.id]));
  const idOf = (key: string) => userId.get(DEMO_PEOPLE.find((p) => p.key === key)!.email)!;
  await tx.insert(roleAssignments).values(DEMO_PEOPLE.flatMap((p) => p.roles.map((r) => ({
    userId: userId.get(p.email)!, role: r.role, scopeKind: r.scope, scopeRef: r.ref, speciality: r.speciality ?? null, createdByName: 'System',
  }))));
  await tx.insert(referenceRevenues).values(DEMO_REVENUES);
  const nameOf = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.name;
  for (const c of DEMO_CAPEX) {
    const [row] = await tx.insert(capex).values({
      code: c.code, subsidiaryCode: c.subsidiary, siteId: siteId.get(c.site) ?? null, title: c.title, investmentType: c.investmentType,
      status: c.status, phase: c.phase, typology: c.typology, typologySource: c.typology ? 'computed' : null, lifecycleModelVersion: c.openedOn ? '4.0' : null,
      needDate: c.needDate ?? null, openedAt: c.openedOn ? at(c.openedOn) : null, sponsorUserId: idOf(c.sponsor), leadUserId: idOf(c.lead),
    }).returning({ id: capex.id });
    const capexId = row.id;
    await tx.insert(capexMembers).values(c.team.map(([key, capexRole]) => ({ capexId, userId: idOf(key), capexRole })));
    const lotRows = await tx.insert(capexLots).values(c.lots.map(([kind, title], i) => ({ capexId, number: i + 1, kind, title, epc2i: kind === 'machines' })))
      .returning({ id: capexLots.id, number: capexLots.number });
    const lotIds = lotRows.sort((a, b) => a.number - b.number).map((l) => l.id);
    for (const [i, v] of c.versions.entries()) {
      const validated = v.status === 'validated' || v.status === 'superseded';
      const [bv] = await tx.insert(budgetVersions).values({
        capexId, number: i + 1, estimateClass: v.cls, status: v.status, basis: v.basis, createdByName: nameOf(c.lead), isG2Baseline: !!v.g2,
        submittedAt: at(v.on), validatedAt: validated ? at(v.on) : null, validatedByName: validated ? nameOf(v.cls === 'E10' ? 'group_cfo' : c.subsidiary === 'APM' ? 'controller' : 'sai_controller') : null,
        validatedByUserId: validated ? idOf(v.cls === 'E10' ? 'group_cfo' : c.subsidiary === 'APM' ? 'controller' : 'sai_controller') : null,
      }).returning({ id: budgetVersions.id });
      await tx.insert(budgetLines).values(v.amounts.map((amountKeur, j) => ({ budgetVersionId: bv.id, lotId: lotIds[j], amountKeur })));
    }
    if (c.openedOn) {
      await tx.insert(phaseTransitions).values({ capexId, fromStatus: 'draft', fromPhase: 'cadrage', toStatus: 'active', toPhase: 'cadrage', effectiveOn: c.openedOn, byName: nameOf(c.sponsor), byUserId: idOf(c.sponsor), occurredAt: at(c.openedOn) });
    }
    if (c.risks.length) {
      await tx.insert(risks).values(c.risks.map((r, i) => ({
        capexId, number: i + 1, title: r.title, category: r.category, probability: r.p, impact: r.i, ownerUserId: idOf(r.owner), response: r.response, status: r.status ?? 'open', dueOn: r.due ?? null,
      })));
    }
    let phase = 'cadrage';
    for (const [code, on] of c.passed) {
      const decider = GATE_DECIDER_KEY[code];
      const kind: DossierKind | null = code === 'G1' ? 'business_case' : code === 'G2' ? 'investment' : null;
      const version = kind ? await seedDossier(tx, capexId, c.code, kind, 'approved', on, nameOf(c.lead), idOf(c.lead), { typology: c.typology }) : null;
      const [g] = await tx.insert(gates).values({ capexId, code, session: 1, status: 'decided', decision: 'go', decidedAt: at(on), decidedByName: nameOf(decider), decidedByUserId: idOf(decider), dossierVersionId: version?.id ?? null }).returning({ id: gates.id });
      await seedCircuit(tx, g.id, code, c.typology, on, version?.hash ?? null, (actor) => actor === 'sponsor' ? c.sponsor : actor, nameOf, idOf, c.code);
      await tx.insert(gateCriteriaResults).values({ gateId: g.id, criterionCode: code === 'G1' ? 'g1_budget_e50' : 'g2_budget_e10', state: 'met', value: code === 'G1' ? 'E50' : 'E10' });
      await tx.insert(phaseTransitions).values({ capexId, fromStatus: 'active', fromPhase: phase, toStatus: 'active', toPhase: PHASE_AFTER[code], gateCode: code, effectiveOn: on, byName: nameOf(decider), byUserId: idOf(decider), occurredAt: at(on) });
      phase = PHASE_AFTER[code];
    }
    if (c.decisions.length) {
      await tx.insert(decisions).values(c.decisions.map(([takenOn, body, text], i) => ({ capexId, number: i + 1, takenOn, body, text, recordedByName: nameOf(c.lead) })));
    }
  }
  await seedDemoExtras(tx, idOf, nameOf);
}

/** Demonstration text of a dossier section (English; French in src/i18n/fr/demo.json). */
const DEMO_SECTION_TEXT: Record<string, string> = {
  need: 'Need, product, capacity and scope as presented to the committee.',
  strategy: 'Fit with the subsidiary’s plan and the group strategy; market study attached.',
  barriers: 'No technological barrier; two local competitors.',
  land: 'Site owned by the subsidiary; ICPE declaration regime.',
  safety: 'Safety review done; report in Codex.',
  baseline: 'Variant retained after the preliminary design; baseline frozen.',
  pack: 'Engineering pack above the threshold; documents in Codex.',
  regulatory: 'ICPE file and building permit filed.',
  schedule: 'Order, works, commissioning, ramp-up and G3 planned.',
};

async function seedDossier(tx: Tx, capexId: string, code: string, kind: DossierKind, state: 'approved' | 'draft', on: string, by: string, byId: string, facts: { typology: string | null } = { typology: null }) {
  const [d] = await tx.insert(dossiers).values({ capexId, kind }).returning({ id: dossiers.id });
  const content = emptyContent(kind);
  for (const sec of SECTIONS[kind]) if (sec.mode === 'text' && (state === 'approved' || sec.key === 'baseline')) content.sections[sec.key].text = DEMO_SECTION_TEXT[sec.key] ?? 'Done.';
  if (kind === 'business_case' && code === 'CPX-APM-2026-01') {
    content.sections.strategy.refs.push({ id: 'NOT-CPX-APM-2026-01-001', revision: 'B', title: 'Market study — extruded profiles 2027–2031', verified: true });
    content.sections.safety.refs.push({ id: 'NOT-CPX-APM-2026-01-002', revision: 'A', title: 'HazID report — second extrusion line', verified: true });
  }
  if (kind === 'investment' && code === 'CPX-APM-2026-01') content.sections.pack.refs.push({ id: 'PID-CPX-APM-2026-01-001', revision: 'A', title: 'P&ID — extrusion line and cooling', verified: true });
  const frozen = state === 'approved';
  const computed = frozen ? await computedSnapshot(tx, { id: capexId, typology: facts.typology, typologySource: facts.typology ? 'computed' : null }) : null;
  const hash = frozen ? createHash('sha256').update(canonicalJson({ kind, number: 1, content, computed })).digest('hex') : null;
  const [v] = await tx.insert(dossierVersions).values({
    dossierId: d.id, number: 1, state, content: content as never, computed: computed as never, completenessPct: frozen ? 100 : 20, contentHash: hash,
    frozenAt: frozen ? at(on) : null, frozenByName: frozen ? by : null, frozenByUserId: frozen ? byId : null, createdByName: by,
  }).returning({ id: dossierVersions.id });
  return { id: v.id, hash };
}

/** The circuit of a gate passed before Arche held it: every step done on the day of the decision. */
async function seedCircuit(
  tx: Tx, gateId: string, code: GateCode, typology: 'light' | 'strategic' | null, on: string, hash: string | null,
  personOf: (actor: string) => string, nameOf: (k: string) => string, idOf: (k: string) => string, capexCode: string,
) {
  const tpl = circuitTemplate(code, typology).filter((x) => !x.optional);
  const who = (actor: string, spec?: string) => (actor === 'expert' ? (spec === 'hse' ? 'group_hse' : spec === 'finance' ? 'group_cfo' : 'expert') : personOf(actor));
  for (const [i, x] of tpl.entries()) {
    const key = who(x.actor, x.speciality);
    const outcome = x.kind === 'opinion' ? 'favorable' : x.kind === 'decision' || x.kind === 'signature' ? 'go' : 'approved';
    const [st] = await tx.insert(circuitSteps).values({
      gateId, position: i + 1, group: x.group, kind: x.kind, actor: x.actor, speciality: x.speciality ?? null, label: x.label, decides: !!x.decides,
      status: 'done', openedOn: on, dueOn: on, outcome, actedByName: nameOf(key), actedByUserId: idOf(key), actedAt: at(on),
    }).returning({ id: circuitSteps.id });
    if (x.kind !== 'opinion') {
      await tx.insert(signatures).values({ circuitStepId: st.id, userId: idOf(key), userName: nameOf(key), signedAt: at(on), contentHash: hash, statement: `${x.label} — ${capexCode}, ${code} session 1${hash ? `, dossier version 1, SHA-256 ${hash}` : ''}: ${outcome}` });
    }
  }
}

/** Dossier in progress, business plans and changes of the demonstration CAPEX. */
async function seedDemoExtras(tx: Tx, idOf: (k: string) => string, nameOf: (k: string) => string) {
  const id = async (code: string) => (await tx.select({ id: capex.id }).from(capex).where(eq(capex.code, code)))[0].id;
  const apm = await id('CPX-APM-2026-01');
  const sai = await id('CPX-SAI-2026-01');
  await seedDossier(tx, apm, 'CPX-APM-2026-01', 'investment', 'draft', '2026-10-01', nameOf('project_lead'), idOf('project_lead'));
  const flows = (capexK: number, rev: number, opex: number) => Array.from({ length: 10 }, (_, y) => ({ year: y, capexKeur: y === 0 ? capexK : 0, opexKeur: y === 0 ? 0 : opex, revenueKeur: y === 0 ? 0 : rev }));
  await tx.insert(businessPlans).values([
    { capexId: apm, horizonYears: 10, discountRatePct: 9, flows: flows(5200, 2400, 1300), updatedByName: nameOf('controller') },
    { capexId: sai, horizonYears: 10, discountRatePct: 11, flows: flows(18300, 9800, 6200), updatedByName: nameOf('sai_controller'), validatedByName: nameOf('group_cfo'), validatedAt: at('2026-06-30') },
  ]);
  await tx.insert(changes).values([
    { capexId: sai, number: 1, title: 'Additional drainage of the plot', kind: 'cost', amountKeur: 150, requiredDecider: 'copil_projet', status: 'approved', createdByName: nameOf('sai_lead'), decidedByName: nameOf('sai_sponsor'), decidedByUserId: idOf('sai_sponsor'), decidedAt: at('2026-09-10') },
    { capexId: sai, number: 2, title: 'Second evaporator for the concentrate line', kind: 'cost', amountKeur: 600, delayDays: 20, requiredDecider: 'dir_ig', createdByName: nameOf('sai_lead') },
  ]);
  // Machine needs (delivery 4): APM in phase 2 — a quote, a firm offer, a draft —; SAI ordered at its G2 with two EPC2i
  // projects. The answers and the projects come from the simulation of Keystone (src/server/integrations/keystone).
  const lot = async (capexId: string) => (await tx.select({ id: capexLots.id }).from(capexLots).where(and(eq(capexLots.capexId, capexId), eq(capexLots.kind, 'machines'))))[0]?.id ?? null;
  const [apmLot, saiLot] = [await lot(apm), await lot(sai)];
  await tx.insert(machineNeeds).values([
    { capexId: apm, number: 1, catalogueCode: 'EXT-9MN', catalogueVersion: 3, quantity: 1, options: ['PULLER'], targetCapacity: 1.8, capacityUnit: 't/h', needDate: '2027-09-01', status: 'submitted', submittedAt: at('2026-09-10'), lotId: apmLot, createdByName: nameOf('project_lead') },
    { capexId: apm, number: 2, catalogueCode: 'EXT-AGE', catalogueVersion: 1, quantity: 1, needDate: '2027-09-01', status: 'submitted', submittedAt: at('2026-08-10'), lotId: apmLot, createdByName: nameOf('project_lead') },
    { capexId: apm, number: 3, freeLabel: 'Billet saw with automatic loader', quantity: 1, needDate: '2027-10-01', status: 'draft', lotId: apmLot, comment: 'To size with the process team', createdByName: nameOf('project_lead') },
    { capexId: sai, number: 1, catalogueCode: 'PRC-TOM', catalogueVersion: 2, quantity: 1, options: ['EVAP3'], targetCapacity: 40, capacityUnit: 't/h', needDate: '2027-06-01', status: 'ordered', submittedAt: at('2026-03-02'), orderedOn: '2026-07-08', lotId: saiLot, createdByName: nameOf('sai_lead') },
    { capexId: sai, number: 2, catalogueCode: 'PRC-CAN', catalogueVersion: 1, quantity: 1, needDate: '2027-06-01', status: 'ordered', submittedAt: at('2026-03-02'), orderedOn: '2026-07-08', lotId: saiLot, createdByName: nameOf('sai_lead') },
  ]);
  await seedDelivery(tx, apm, sai, nameOf);
  await syncKeystone(tx, { now: at('2026-10-22'), mode: 'simulation' });
  await seedGovernance(tx, apm, sai, nameOf);
}

/**
 * Lot 5b demonstration: project reviews (APM, Light, quarterly: its last review is more than 15 days late; SAI, Strategic,
 * monthly, with the audit of phase 1 — the audit of phase 2 is missing), and twelve weeks of snapshots for the trends.
 */
async function seedGovernance(tx: Tx, apm: string, sai: string, nameOf: (k: string) => string) {
  const r = (capexId: string, number: number, kind: 'copil_projet' | 'audit', heldOn: string, phase: string, attendees: string, summary: string, by: string) =>
    ({ capexId, number, kind, heldOn, phase, attendees, summary, recordedByName: nameOf(by) });
  await tx.insert(reviews).values([
    r(apm, 1, 'copil_projet', '2026-03-20', 'cadrage', 'Sponsor, project lead, controller, Co-DIG', 'Scope and E50 estimate reviewed; G1 dossier on track.', 'project_lead'),
    r(apm, 2, 'copil_projet', '2026-06-20', 'avant_projet', 'Sponsor, project lead, controller, Co-DIG', 'Variants A and B compared; soil survey ordered.', 'project_lead'),
    r(sai, 1, 'audit', '2026-01-14', 'cadrage', 'Group industrial director, project lead, EPC2i PMO', 'Phase 1 audit: dossier complete, staffing template met.', 'dir_ig'),
    r(sai, 2, 'copil_projet', '2026-08-27', 'execution', 'Sponsor, project lead, controller, EPC2i PMO', 'Earthworks started; grid connection risk escalated.', 'sai_lead'),
    r(sai, 3, 'copil_projet', '2026-09-24', 'execution', 'Sponsor, project lead, controller, EPC2i PMO', 'Civil works at 25 %; second evaporator change submitted.', 'sai_lead'),
  ]);
  const weeks = Array.from({ length: 12 }, (_, i) => weekOf(new Date(Date.parse('2026-10-22T12:00:00Z') - (12 - i) * 7 * 86_400_000).toISOString().slice(0, 10)));
  await tx.insert(capexSnapshots).values(weeks.flatMap((week, i) => [
    { capexId: apm, week, status: 'active', phase: 'avant_projet', packPct: Math.round(20 + i * 3.5), subsidiaryPackPct: Math.round(20 + i * 3.5), alerts: 1, takenAt: at(week) },
    { capexId: sai, week, status: 'active', phase: 'execution', packPct: 100, subsidiaryPackPct: 100, epc2iPackPct: Math.min(100, 70 + i * 3), alerts: 1, takenAt: at(week) },
  ]));
  await takeSnapshots(tx, '2026-10-22');
}

/**
 * Delivery 5 demonstration: safety milestones declared by the group HSE, permits, the subsidiary's part of the engineering
 * pack, the lots' planned windows and the monthly actuals of SAI's lots outside EPC2i (cumulative to the end of each month).
 */
async function seedDelivery(tx: Tx, apm: string, sai: string, nameOf: (k: string) => string) {
  const hse = nameOf('group_hse');
  await tx.insert(hsStatuses).values([
    { capexId: apm, hsCode: 'HS2', status: 'passed', passedOn: '2026-05-05', evidenceRef: 'NOT-CPX-APM-2026-01-002', updatedByName: hse },
    { capexId: apm, hsCode: 'HS3', status: 'in_progress', note: 'HazOp sessions planned in November', updatedByName: hse },
    { capexId: sai, hsCode: 'HS2', status: 'passed', passedOn: '2026-01-12', evidenceRef: 'NOT-CPX-SAI-2026-01-004', updatedByName: hse },
    { capexId: sai, hsCode: 'HS3', status: 'passed', passedOn: '2026-06-20', evidenceRef: 'NOT-CPX-SAI-2026-01-009', updatedByName: hse },
    { capexId: sai, hsCode: 'HS4', status: 'in_progress', note: 'Monthly site inspections since September', updatedByName: hse },
  ]);
  const lead = nameOf('project_lead');
  const saiLead = nameOf('sai_lead');
  await tx.insert(authorizations).values([
    { capexId: apm, number: 1, kind: 'icpe', title: 'ICPE declaration — extrusion and ageing', authority: 'Prefecture of Kénitra', status: 'filed', filedOn: '2026-09-15', dueOn: '2026-11-10', codexRef: 'REG-CPX-APM-2026-01-001', updatedByName: lead },
    { capexId: apm, number: 2, kind: 'building_permit', title: 'Building permit — hall extension', authority: 'Municipality of Kénitra', status: 'to_file', updatedByName: lead },
    { capexId: sai, number: 1, kind: 'icpe', title: 'ICPE authorisation — processing plant', authority: 'Regional environment directorate', status: 'obtained', filedOn: '2026-02-10', obtainedOn: '2026-06-02', codexRef: 'REG-CPX-SAI-2026-01-001', updatedByName: saiLead },
    { capexId: sai, number: 2, kind: 'building_permit', title: 'Building permit — process hall and offices', authority: 'Municipality of Thiès', status: 'obtained', filedOn: '2026-02-24', obtainedOn: '2026-05-18', codexRef: 'REG-CPX-SAI-2026-01-002', updatedByName: saiLead },
    { capexId: sai, number: 3, kind: 'atex', title: 'ATEX zoning of the boiler room', status: 'filed', filedOn: '2026-09-30', dueOn: '2027-01-15', updatedByName: saiLead },
  ]);
  const pack = (capexId: string, validated: string[], inProgress: string[], by: string) => [
    ...validated.map((itemCode) => ({ capexId, itemCode, status: 'validated' as const, codexRef: `PLN-${itemCode.replace('.', '-').toUpperCase()}`, validatedOn: '2026-09-30', updatedByName: by })),
    ...inProgress.map((itemCode) => ({ capexId, itemCode, status: 'in_progress' as const, updatedByName: by })),
  ];
  await tx.insert(packItems).values([
    ...pack(apm, ['site.survey', 'site.plan', 'bld.apd', 'utl.balance', 'prc.flow', 'prc.layout'], ['bld.structure', 'hse.fire'], lead),
    ...pack(sai, PACK_TEMPLATE.map((i) => i.code), [], saiLead),
  ]);
  const windows: Record<string, Record<number, [string, string]>> = {
    [apm]: { 1: ['2027-01', '2027-06'], 2: ['2027-03', '2027-08'], 3: ['2026-12', '2027-09'] },
    [sai]: { 1: ['2026-07', '2026-08'], 2: ['2026-08', '2027-01'], 3: ['2026-10', '2027-04'], 4: ['2026-11', '2027-04'], 5: ['2026-07', '2027-05'], 6: ['2027-01', '2027-05'] },
  };
  for (const [capexId, ws] of Object.entries(windows)) {
    for (const [n, [plannedStart, plannedEnd]] of Object.entries(ws)) await tx.update(capexLots).set({ plannedStart, plannedEnd }).where(and(eq(capexLots.capexId, capexId), eq(capexLots.number, Number(n))));
  }
  const lots = new Map((await tx.select({ id: capexLots.id, number: capexLots.number }).from(capexLots).where(eq(capexLots.capexId, sai))).map((l) => [l.number, l.id]));
  const ctl = nameOf('sai_controller');
  const row = (n: number, month: string, committedKeur: number | null, spentKeur: number | null, physicalPct: number | null) => ({ lotId: lots.get(n)!, month, committedKeur, spentKeur, physicalPct, source: 'import' as const, enteredByName: ctl, enteredAt: at(`${month}-28`) });
  await tx.insert(lotActuals).values([
    row(1, '2026-07', 980, 490, 50), row(1, '2026-08', 980, 980, 100),
    row(2, '2026-08', 2400, 240, 10), row(2, '2026-09', 2450, 620, 25), row(2, '2026-10', 2450, 1000, 40),
    row(3, '2026-09', 3200, 0, 0), row(3, '2026-10', 3250, 150, 5),
    row(4, '2026-10', 900, 0, 0),
  ]);
}
