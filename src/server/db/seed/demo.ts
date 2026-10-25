// Demonstration data set (N-21): two fictitious subsidiaries — Atlas Process Maroc (APM, North Africa) and Sahel Agro
// Industries (SAI, West Africa) —, the group, one person per profile and three CAPEX (one Light, one Strategic, one draft).
// No real person or company. The e-mail domains are reserved example domains.
import { eq } from 'drizzle-orm';
import type { RoleKey, ScopeKind, ExpertSpeciality } from '@/config/roles';
import {
  authorizations, budgetLines, capexActions, wbsTasks, budgetVersions, capex, capexLots, capexSnapshots, hsStatuses, lotActuals, packItems, productionLines, rampupDays, reviews, rexEntries, capexMembers, decisions, gateCriteriaResults, gates, phaseTransitions, referenceRevenues, risks,
  roleAssignments, sites, subsidiaries, users, zones, type CapexRole, type EstimateClass, type GateCode,
} from '../schema';
import { createHash } from 'node:crypto';
import { circuitTemplate } from '@/domain/circuits';
import { canonicalJson, emptyContent, SECTIONS, type DossierKind } from '@/domain/dossiers';
import { computedSnapshot } from '@/server/dal/dossiers';
import { businessPlans, changes, circuitSteps, dossiers, dossierVersions, machineNeeds, signatures } from '../schema';
import { and, isNull } from 'drizzle-orm';
import { syncKeystone } from '@/server/integrations/keystone/mirror';
import { PACK_TEMPLATE } from '@/domain/pack';
import { addDaysIso } from '@/lib/dates';
import { takeSnapshots, weekOf } from '@/server/dal/governance';
import { recomputeLines } from '@/server/dal/rampup';
import { readValues } from '@/domain/lifecycle';
import { simulatedMachineNumber, simulatedProjectCode } from '@/server/integrations/keystone/simulation';
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

export const DEMO_SITES = [
  { subsidiaryCode: 'APM', name: 'Kénitra plant', city: 'Kénitra', countryIso2: 'MA', latitude: 34.261, longitude: -6.58 },
  { subsidiaryCode: 'SAI', name: 'Thiès site', city: 'Thiès', countryIso2: 'SN', latitude: 14.791, longitude: -16.926 },
  { subsidiaryCode: 'SAI', name: 'Kaolack plant', city: 'Kaolack', countryIso2: 'SN', latitude: 14.152, longitude: -16.073 },
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
  { key: 'project_lead', name: 'Leïla Haddad', email: `l.haddad@${APM}`, title: 'Project lead', subsidiary: 'APM', roles: [{ role: 'project_lead', scope: 'capex', ref: 'CPX-APM-2026-01' }, { role: 'project_lead', scope: 'capex', ref: 'CPX-APM-2026-02' }, { role: 'project_lead', scope: 'capex', ref: 'CPX-APM-2025-01' }] },
  { key: 'controller', name: 'Nadia Tazi', email: `n.tazi@${APM}`, title: 'Management controller', subsidiary: 'APM', roles: [{ role: 'controller', scope: 'subsidiary', ref: 'APM' }] },
  { key: 'co_dig', name: 'Thomas Girard', email: `t.girard@${G}`, title: 'Co-DIG', subsidiary: null, roles: [{ role: 'co_dig', scope: 'capex', ref: 'CPX-APM-2026-01' }] },
  { key: 'epc2i_pmo', name: 'Julien Roche', email: `j.roche@${G}`, title: 'EPC2i PMO', subsidiary: null, roles: [{ role: 'epc2i_pmo', scope: 'capex', ref: 'CPX-SAI-2026-01' }] },
  { key: 'expert', name: 'Aminata Diop', email: `a.diop@${SAI}`, title: 'HSE manager', subsidiary: 'SAI', roles: [{ role: 'expert', scope: 'capex', ref: 'CPX-SAI-2026-01', speciality: 'hse' }] },
  { key: 'admin', name: 'Arche administrator', email: `admin.arche@${G}`, title: 'Arche administrator', subsidiary: null, roles: [{ role: 'admin', scope: 'group', ref: null }] },
  { key: 'sai_sponsor', name: 'Moussa Ndiaye', email: `m.ndiaye@${SAI}`, title: 'Managing director', subsidiary: 'SAI', roles: [{ role: 'sponsor', scope: 'subsidiary', ref: 'SAI' }] },
  { key: 'sai_lead', name: 'Fatou Sarr', email: `f.sarr@${SAI}`, title: 'Dedicated project lead', subsidiary: 'SAI', roles: [{ role: 'project_lead', scope: 'capex', ref: 'CPX-SAI-2026-01' }, { role: 'project_lead', scope: 'capex', ref: 'CPX-SAI-2026-02' }, { role: 'project_lead', scope: 'capex', ref: 'CPX-SAI-2026-03' }] },
  { key: 'sai_controller', name: 'Ibrahima Fall', email: `i.fall@${SAI}`, title: 'Management controller', subsidiary: 'SAI', roles: [{ role: 'controller', scope: 'subsidiary', ref: 'SAI' }] },
];

export interface DemoCapex {
  code: string; subsidiary: string; site: string; title: string; investmentType: 'new_plant' | 'new_line' | 'extension' | 'other';
  status: 'draft' | 'active'; phase: 'cadrage' | 'avant_projet' | 'execution' | 'demarrage'; typology: 'light' | 'strategic' | null;
  sponsor: string; lead: string; team: [string, CapexRole][]; openedOn?: string; needDate?: string;
  /** Gates passed: code and decision date. */
  passed: [GateCode, string][];
  lots: [string, string][];
  /** Versions: class, status, amounts per lot (same order as `lots`), validated on. */
  versions: { cls: EstimateClass; status: 'draft' | 'submitted' | 'validated' | 'superseded'; amounts: number[]; on: string; basis: string; g2?: boolean }[];
  risks: { title: string; category: string; p: number; i: number; owner: string; response: string; status?: string; due?: string }[];
  decisions: [string, string, string][];
}

export const DEMO_CAPEX: DemoCapex[] = [
  {
    // Delivery 6: a CAPEX in its start-up phase — commissioning started on 1 July 2026, ramp-up of its line.
    code: 'CPX-APM-2025-01', subsidiary: 'APM', site: 'Kénitra plant', title: 'Ageing oven and finishing line', investmentType: 'new_line', status: 'active', phase: 'demarrage', typology: 'light',
    sponsor: 'sponsor', lead: 'project_lead', team: [['project_lead', 'lead'], ['controller', 'controller'], ['co_dig', 'co_dig']], openedOn: '2025-03-03', needDate: '2026-07-01',
    passed: [['G1', '2025-05-20'], ['G2', '2025-09-15'], ['K3', '2026-06-10']],
    lots: [['civil_works', 'Finishing hall slab'], ['utilities', 'Gas and effluent treatment'], ['machines', 'Ageing oven (EPC2i)']],
    versions: [
      { cls: 'E50', status: 'superseded', amounts: [280, 420, 600], on: '2025-05-05', basis: 'Ratios and EPC2i catalogue prices' },
      { cls: 'E10', status: 'validated', amounts: [300, 450, 680], on: '2025-09-05', basis: 'Firm EPC2i offer, quotes for the works', g2: true },
    ],
    risks: [{ title: 'Ageing cycle longer than planned', category: 'technical', p: 2, i: 2, owner: 'project_lead', response: 'Recipes tuned with EPC2i during the ramp-up' }],
    decisions: [['2025-09-15', 'ceo', 'G2 Go: ageing oven ordered'], ['2026-06-10', 'dir_ig', 'K3: ready to start']],
  },
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
  {
    // COPIL GPI demonstration: a CAPEX in phase 1 whose G1 waits for the committee (its circuit is seeded in seedCopil).
    code: 'CPX-SAI-2026-02', subsidiary: 'SAI', site: 'Kaolack plant', title: 'Aseptic packaging line', investmentType: 'new_line', status: 'active', phase: 'cadrage', typology: 'light',
    sponsor: 'sai_sponsor', lead: 'sai_lead', team: [['sai_lead', 'lead'], ['sai_controller', 'controller']], openedOn: '2026-08-17', needDate: '2027-11-01',
    passed: [], lots: [['civil_works', 'Hall adaptation'], ['machines', 'Aseptic filler (EPC2i)']],
    versions: [{ cls: 'E50', status: 'validated', amounts: [250, 1900], on: '2026-09-25', basis: 'Ratios and EPC2i catalogue prices' }],
    risks: [{ title: 'Sterile water quality not demonstrated', category: 'technical', p: 2, i: 3, owner: 'sai_lead', response: 'Water analysis campaign before the G2' }],
    decisions: [],
  },
  {
    // A G1 decided by the COPIL GPI less than 90 days ago.
    code: 'CPX-SAI-2026-03', subsidiary: 'SAI', site: 'Thiès site', title: 'Solar power plant for the Thiès site', investmentType: 'other', status: 'active', phase: 'avant_projet', typology: 'light',
    sponsor: 'sai_sponsor', lead: 'sai_lead', team: [['sai_lead', 'lead'], ['sai_controller', 'controller']], openedOn: '2026-07-06', needDate: '2027-06-01',
    passed: [['G1', '2026-09-24']], lots: [['civil_works', 'Ground-mounted structures'], ['utilities', 'Panels, inverters and grid connection']],
    versions: [{ cls: 'E50', status: 'validated', amounts: [400, 1300], on: '2026-09-10', basis: 'Two integrators’ budgetary quotes' }],
    risks: [{ title: 'Grid operator’s connection study late', category: 'schedule', p: 3, i: 2, owner: 'sai_lead', response: 'Study requested with the G1 dossier', due: '2026-12-01' }],
    decisions: [['2026-09-24', 'copil_gpi', 'G1 Go: grid connection study to deliver before the preliminary design']],
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
/** Calendar days between the submission of a demonstration gate and its decision (the C-10 delay indicator reads them). */
const DEMO_REVIEW_DAYS: Record<GateCode, number> = { G1: 6, G2: 16, K3: 7, G3: 14 };

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
  for (const c of DEMO_CAPEX) await seedCapex(tx, c, siteId, idOf, nameOf);
  await seedDemoExtras(tx, idOf, nameOf);
}

/** One CAPEX of the data set: lots, budget versions, opening, risks, gates passed with their circuits, decisions. */
export async function seedCapex(tx: Tx, c: DemoCapex, siteId: ReadonlyMap<string, string>, idOf: (k: string) => string, nameOf: (k: string) => string): Promise<string> {
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
    const [g] = await tx.insert(gates).values({ capexId, code, session: 1, status: 'decided', decision: 'go', createdAt: at(addDaysIso(on, -DEMO_REVIEW_DAYS[code])), decidedAt: at(on), decidedByName: nameOf(decider), decidedByUserId: idOf(decider), dossierVersionId: version?.id ?? null }).returning({ id: gates.id });
    await seedCircuit(tx, g.id, code, c.typology, on, version?.hash ?? null, (actor) => actor === 'sponsor' ? c.sponsor : actor, nameOf, idOf, c.code);
    await tx.insert(gateCriteriaResults).values({ gateId: g.id, criterionCode: code === 'G1' ? 'g1_budget_e50' : 'g2_budget_e10', state: 'met', value: code === 'G1' ? 'E50' : 'E10' });
    await tx.insert(phaseTransitions).values({ capexId, fromStatus: 'active', fromPhase: phase, toStatus: 'active', toPhase: PHASE_AFTER[code], gateCode: code, effectiveOn: on, byName: nameOf(decider), byUserId: idOf(decider), occurredAt: at(on) });
    phase = PHASE_AFTER[code];
  }
  if (c.decisions.length) {
    await tx.insert(decisions).values(c.decisions.map(([takenOn, body, text], i) => ({ capexId, number: i + 1, takenOn, body, text, recordedByName: nameOf(c.lead) })));
  }
  return capexId;
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

async function seedDossier(tx: Tx, capexId: string, code: string, kind: DossierKind, state: 'approved' | 'frozen' | 'draft', on: string, by: string, byId: string, facts: { typology: string | null } = { typology: null }) {
  const [d] = await tx.insert(dossiers).values({ capexId, kind }).returning({ id: dossiers.id });
  const content = emptyContent(kind);
  for (const sec of SECTIONS[kind]) if (sec.mode === 'text' && (state !== 'draft' || sec.key === 'baseline')) content.sections[sec.key].text = DEMO_SECTION_TEXT[sec.key] ?? 'Done.';
  if (kind === 'business_case' && code === 'CPX-APM-2026-01') {
    content.sections.strategy.refs.push({ id: 'NOT-CPX-APM-2026-01-001', revision: 'B', title: 'Market study — extruded profiles 2027–2031', verified: true });
    content.sections.safety.refs.push({ id: 'NOT-CPX-APM-2026-01-002', revision: 'A', title: 'HazID report — second extrusion line', verified: true });
  }
  if (kind === 'investment' && code === 'CPX-APM-2026-01') content.sections.pack.refs.push({ id: 'PID-CPX-APM-2026-01-001', revision: 'A', title: 'P&ID — extrusion line and cooling', verified: true });
  const frozen = state !== 'draft';
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
  const apm25 = await id('CPX-APM-2025-01');
  await seedNeeds(tx, { apm, sai, apm25 }, nameOf);
  await seedDelivery(tx, apm, sai, nameOf);
  await syncKeystone(tx, { now: at('2026-10-22'), mode: 'simulation' });
  await seedStartup(tx, apm25, nameOf);
  await seedGovernance(tx, apm, sai, nameOf);
  await seedCopil(tx, await id('CPX-SAI-2026-02'), sai, await id('CPX-SAI-2026-03'), idOf, nameOf);
  await seedActions(tx, apm, sai, idOf, nameOf);
  await seedWbs(tx, apm, sai, idOf, nameOf);
}

/**
 * Machine needs (delivery 4), aligned with Keystone's demo (owner, 25 Oct 2026): APM in phase 2 — a gantry answered with an
 * indicative price then a quote, a free need waiting —; SAI ordered at its G2 — a mobile unit delivered by Keystone's project
 * RCF-019, two gantries whose project is still to be created, a need withdrawn —; the ageing oven of CPX-APM-2025-01. The
 * answers and projects come from the Keystone simulation (keystone-demo.ts). `only`: the CAPEX to seed (all three by default).
 */
export async function seedNeeds(tx: Tx, ids: { apm: string; sai: string; apm25: string }, nameOf: (k: string) => string, only?: ReadonlySet<string>) {
  const { apm, sai, apm25 } = ids;
  const lot = async (capexId: string) => (await tx.select({ id: capexLots.id }).from(capexLots).where(and(eq(capexLots.capexId, capexId), eq(capexLots.kind, 'machines'))))[0]?.id ?? null;
  const [apmLot, saiLot, apm25Lot] = [await lot(apm), await lot(sai), await lot(apm25)];
  const all: (typeof machineNeeds.$inferInsert)[] = [
    // Keystone's demo expects exactly these needs (its simulation of Arche, R-187) and answers them (RB-001 to RB-005, RCF-019).
    { capexId: apm, number: 1, catalogueCode: 'EMP-40T', catalogueVersion: 1, quantity: 1, options: ['TELE'], targetCapacity: 40, capacityUnit: 't', needDate: '2027-09-01', status: 'submitted', submittedAt: at('2026-09-01'), lotId: apmLot, comment: 'Portique de manutention des filières, hall extrusion', createdByName: nameOf('project_lead') },
    { capexId: apm, number: 2, freeLabel: 'Ligne de refroidissement en ligne des profilés', quantity: 1, targetCapacity: 1.2, capacityUnit: 't/h', needDate: '2027-09-01', status: 'submitted', submittedAt: at('2026-09-20'), lotId: apmLot, comment: 'Variante B retenue au COPIL du 18 sept.', createdByName: nameOf('project_lead') },
    { capexId: sai, number: 1, catalogueCode: 'MEMU-16', catalogueVersion: 1, quantity: 1, options: ['GEN'], targetCapacity: 16, capacityUnit: 't/h', needDate: '2027-06-01', status: 'ordered', submittedAt: at('2026-06-29'), orderedOn: '2026-07-08', lotId: saiLot, createdByName: nameOf('sai_lead') },
    { capexId: sai, number: 2, catalogueCode: 'SPUR-2X', catalogueVersion: 1, quantity: 1, needDate: '2027-06-01', status: 'withdrawn', submittedAt: at('2026-03-10'), lotId: saiLot, comment: 'Remplacé par la station de traitement des eaux du lot utilités', createdByName: nameOf('sai_lead'), updatedAt: at('2026-07-30') },
    { capexId: sai, number: 3, catalogueCode: 'EMP-40T', catalogueVersion: 1, quantity: 2, options: ['TELE'], targetCapacity: 40, capacityUnit: 't', needDate: '2027-06-01', status: 'ordered', submittedAt: at('2026-06-01'), orderedOn: '2026-07-08', lotId: saiLot, comment: 'Portiques du hall de conditionnement', createdByName: nameOf('sai_lead') },
    // CPX-APM-2025-01 is not in Keystone's demo yet (DEMANDES-KEYSTONE K-14): its oven is a free need, answered by the simulation.
    { capexId: apm25, number: 1, freeLabel: 'Ageing oven 2 × 6 m', quantity: 1, targetCapacity: 2, capacityUnit: 't/h', needDate: '2026-07-01', status: 'ordered', submittedAt: at('2025-06-02'), orderedOn: '2025-09-15', lotId: apm25Lot, createdByName: nameOf('project_lead') },
  ];
  const rows = all.filter((r) => !only || only.has(r.capexId));
  if (rows.length) await tx.insert(machineNeeds).values(rows);
  return rows.length;
}

/**
 * Delivery 6 demonstration (CPX-APM-2025-01): safety milestones to the PSSR, commissioning started on 1 July 2026, one line
 * (the ageing oven delivered by EPC2i, its machine number from Keystone) ramping up to its nominal capacity — a planned stop
 * on 15 August, the run of conforming days reached in October —, the lessons of three phases (two published). The accounting
 * closure is still to enter: it is the next step of the CAPEX.
 */
export async function seedStartup(tx: Tx, capexId: string, nameOf: (k: string) => string) {
  const hse = nameOf('group_hse');
  await tx.insert(hsStatuses).values([
    { capexId, hsCode: 'HS2', status: 'passed', passedOn: '2025-05-02', evidenceRef: 'NOT-CPX-APM-2025-01-001', updatedByName: hse },
    { capexId, hsCode: 'HS3', status: 'passed', passedOn: '2025-08-28', evidenceRef: 'NOT-CPX-APM-2025-01-004', updatedByName: hse },
    { capexId, hsCode: 'HS4', status: 'passed', passedOn: '2026-06-02', evidenceRef: 'NOT-CPX-APM-2025-01-007', updatedByName: hse },
    { capexId, hsCode: 'PSSR', status: 'passed', passedOn: '2026-06-26', evidenceRef: 'NOT-CPX-APM-2025-01-009', updatedByName: hse },
  ]);
  await tx.update(capex).set({ mesStartedOn: '2026-07-01' }).where(eq(capex.id, capexId));
  const lead = nameOf('project_lead');
  const [line] = await tx.insert(productionLines).values({
    capexId, number: 1, name: 'Ageing oven', nominalPerDay: 48, unit: 't', scrapTargetPct: 2,
    machineNumbers: [simulatedMachineNumber(simulatedProjectCode('CPX-APM-2025-01/B01'), 0)], updatedByName: lead,
  }).returning({ id: productionLines.id });
  const start = Date.parse('2026-07-01T12:00:00Z');
  const days = Array.from({ length: 114 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  await tx.insert(rampupDays).values(days.map((day, i) => {
    if (day === '2026-08-15') return { lineId: line.id, day, plannedStop: true, enteredByName: lead, source: 'import' as const };
    // Output from 55 % of the nominal to above 100 % by mid-September; scrap from 5 % down to 1.5 %; one bad day on 18 September.
    const k = Math.min(1, i / 78);
    const bad = day === '2026-09-18';
    const share = bad ? 0.82 : 0.55 + 0.5 * k;
    const scrap = Math.round((5 - 3.5 * k) * 10) / 10;
    const a = Math.round((80 + 15 * k) * 10) / 10, p = Math.round((75 + 20 * k) * 10) / 10, q = Math.round((100 - scrap) * 10) / 10;
    return { lineId: line.id, day, output: Math.round(48 * share * 10) / 10, availabilityPct: a, performancePct: p, qualityPct: q, oeePct: Math.round((a * p * q) / 1000) / 10, scrapPct: scrap, plannedStop: false, enteredByName: lead, source: 'import' as const };
  }));
  await recomputeLines(tx, { id: capexId, mesStartedOn: '2026-07-01' }, readValues(null), '2026-10-22');
  // Delivery and governance of the CAPEX: works lots complete, pack complete, quarterly project reviews.
  for (const [n, plannedStart, plannedEnd] of [[1, '2025-10', '2026-03'], [2, '2025-11', '2026-04'], [3, '2025-09', '2026-06']] as const) {
    await tx.update(capexLots).set({ plannedStart, plannedEnd }).where(and(eq(capexLots.capexId, capexId), eq(capexLots.number, n)));
  }
  const lotIds = new Map((await tx.select({ id: capexLots.id, number: capexLots.number }).from(capexLots).where(eq(capexLots.capexId, capexId))).map((l) => [l.number, l.id]));
  const ctl = nameOf('controller');
  await tx.insert(lotActuals).values([
    { lotId: lotIds.get(1)!, month: '2026-03', committedKeur: 296, spentKeur: 296, physicalPct: 100, source: 'import' as const, enteredByName: ctl },
    { lotId: lotIds.get(2)!, month: '2026-04', committedKeur: 462, spentKeur: 455, physicalPct: 100, source: 'import' as const, enteredByName: ctl },
  ]);
  await tx.insert(packItems).values(PACK_TEMPLATE.map((i) => ({ capexId, itemCode: i.code, status: 'validated' as const, codexRef: `PLN-${i.code.replace('.', '-').toUpperCase()}`, validatedOn: '2025-09-01', updatedByName: lead })));
  await tx.insert(reviews).values([
    { capexId, number: 1, kind: 'copil_projet' as const, heldOn: '2026-06-18', phase: 'demarrage', attendees: 'Sponsor, project lead, controller, Co-DIG', summary: 'K3 passed; commissioning planned on 1 July after the PSSR.', recordedByName: lead },
    { capexId, number: 2, kind: 'copil_projet' as const, heldOn: '2026-09-17', phase: 'demarrage', attendees: 'Sponsor, project lead, controller, Co-DIG', summary: 'Ramp-up at 95 % of the nominal; scrap under target since early September.', recordedByName: lead },
  ]);
  const rex = (number: number, phase: string, category: string, title: string, text: string, published: string | null) => ({ capexId, number, phase, category, title, text, authorName: lead, publishedAt: published ? at(published) : null });
  await tx.insert(rexEntries).values([
    rex(1, 'cadrage', 'organisation', 'Involve the plant manager from the framing', 'The capacity target changed twice because production was not in the framing workshop.', '2025-06-10'),
    rex(2, 'avant_projet', 'supplier', 'Ask EPC2i for the firm offer before the G2 dossier freezes', 'The firm offer arrived after the dossier was frozen: one more version was needed.', '2025-10-01'),
    rex(3, 'execution', 'hse', 'Plan the gas connection inspection early', 'The gas utility inspection slot was four weeks out; book it at the order.', null),
  ]);
}

/**
 * Lot 5b demonstration: project reviews (APM, Light, quarterly: its last review is more than 15 days late; SAI, Strategic,
 * monthly, with the audit of phase 1 — the audit of phase 2 is missing), and twelve weeks of snapshots for the trends.
 */
export async function seedGovernance(tx: Tx, apm: string, sai: string, nameOf: (k: string) => string) {
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
  ])).onConflictDoNothing();
  await takeSnapshots(tx, '2026-10-22');
}

/**
 * Delivery 5 demonstration: safety milestones declared by the group HSE, permits, the subsidiary's part of the engineering
 * pack, the lots' planned windows and the monthly actuals of SAI's lots outside EPC2i (cumulative to the end of each month).
 */
export async function seedDelivery(tx: Tx, apm: string, sai: string, nameOf: (k: string) => string) {
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
    for (const [n, [plannedStart, plannedEnd]] of Object.entries(ws)) await tx.update(capexLots).set({ plannedStart, plannedEnd }).where(and(eq(capexLots.capexId, capexId), eq(capexLots.number, Number(n)), isNull(capexLots.plannedStart)));
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

/**
 * COPIL GPI demonstration: the G1 of CPX-SAI-2026-02 in review since 15 October (business case frozen, HSE opinion and sponsor
 * visa given, the COPIL members' review and the decision of its president open, past the 2 working days), and the lessons
 * learned of the SAI CAPEX for the library.
 */
export async function seedCopil(tx: Tx, packaging: string, plant: string, solar: string, idOf: (k: string) => string, nameOf: (k: string) => string) {
  await seedCopilGate(tx, packaging, idOf, nameOf);
  await tx.insert(rexEntries).values(saiRex(plant, solar, nameOf));
}

/** The G1 of CPX-SAI-2026-02 in front of the COPIL GPI. */
export async function seedCopilGate(tx: Tx, packaging: string, idOf: (k: string) => string, nameOf: (k: string) => string) {
  const on = '2026-10-15';
  const version = await seedDossier(tx, packaging, 'CPX-SAI-2026-02', 'business_case', 'frozen', on, nameOf('sai_lead'), idOf('sai_lead'), { typology: 'light' });
  const [g] = await tx.insert(gates).values({ capexId: packaging, code: 'G1', session: 1, status: 'in_review', dossierVersionId: version.id, createdAt: at(on) }).returning({ id: gates.id });
  const tpl = circuitTemplate('G1', 'light');
  for (const [i, x] of tpl.entries()) {
    const done = x.group < 3;
    const key = x.actor === 'expert' ? 'group_hse' : x.actor === 'sponsor' ? 'sai_sponsor' : null;
    const outcome = x.kind === 'opinion' ? 'favorable' : 'approved';
    const [st] = await tx.insert(circuitSteps).values({
      gateId: g.id, position: i + 1, group: x.group, kind: x.kind, actor: x.actor, speciality: x.speciality ?? null, label: x.label, optional: !!x.optional, decides: !!x.decides,
      status: done ? 'done' : 'open', openedOn: done ? on : '2026-10-16', dueOn: done ? on : '2026-10-20',
      outcome: done ? outcome : null, comment: x.kind === 'opinion' ? 'HazID done; sterile area to detail at the APS.' : null,
      actedByName: done && key ? nameOf(key) : null, actedByUserId: done && key ? idOf(key) : null, actedAt: done ? at('2026-10-16') : null,
    }).returning({ id: circuitSteps.id });
    if (done && key && x.kind !== 'opinion') {
      await tx.insert(signatures).values({ circuitStepId: st.id, userId: idOf(key), userName: nameOf(key), signedAt: at('2026-10-16'), contentHash: version.hash, statement: `${x.label} — CPX-SAI-2026-02, G1 session 1, dossier version 1, SHA-256 ${version.hash}: ${outcome}` });
    }
  }
}

/** The published lessons learned of the SAI CAPEX (library). */
export function saiRex(plant: string, solar: string, nameOf: (k: string) => string) {
  const lead = nameOf('sai_lead');
  const rex = (capexId: string, number: number, phase: string, category: string, title: string, text: string, published: string) => ({ capexId, number, phase, category, title, text, authorName: lead, publishedAt: at(published) });
  return [
    rex(plant, 1, 'cadrage', 'cost', 'Budget the servicing of the plot from the framing', 'Water and power servicing of the plot was missing from the E50: four more per cent at the E30.', '2026-02-05'),
    rex(plant, 2, 'avant_projet', 'regulatory', 'File the environmental permit with the preliminary design', 'Waiting for the detailed design cost six weeks on the environmental permit.', '2026-07-20'),
    rex(plant, 3, 'avant_projet', 'supplier', 'Align the validity of the EPC2i offer with the G2 date', 'The firm offer expired one week before the G2: EPC2i had to renew it.', '2026-07-20'),
    rex(plant, 4, 'execution', 'hse', 'Separate the site accesses of trucks and pedestrians', 'Two near misses between trucks and pedestrians in August; separate accesses since then.', '2026-09-05'),
    rex(solar, 1, 'cadrage', 'technical', 'Check the load capacity of roofs before the E50', 'The roof option was dropped at the G1: structure too weak, ground-mounted panels retained.', '2026-09-30'),
  ];
}

/** Action plans of the demonstration (owner's pilot feedback, 24 Oct 2026): open, late and done actions of APM and SAI. */
export async function seedActions(tx: Tx, apm: string, sai: string, idOf: (k: string) => string, nameOf: (k: string) => string) {
  const a = (capexId: string, number: number, title: string, source: string, sourceRef: string | null, owner: string, dueOn: string, status: 'open' | 'done' = 'open', closedOn: string | null = null) => ({
    capexId, number, title, source, sourceRef, ownerUserId: idOf(owner), dueOn, status, closedOn, createdByName: nameOf(owner === 'sai_lead' ? 'sai_lead' : 'project_lead'),
  });
  await tx.insert(capexActions).values([
    a(apm, 1, 'Order the soil survey of the extension', 'risk', 'R-02', 'project_lead', '2026-10-15'),
    a(apm, 2, 'Send the E30 version to the controller with the EPC2i quote', 'budget', 'v2', 'project_lead', '2026-11-05'),
    a(apm, 3, 'Hold the overdue project review', 'governance', null, 'sponsor', '2026-10-30'),
    a(apm, 4, 'Confirm the cooling variant with production', 'dossier', null, 'co_dig', '2026-09-30', 'done', '2026-09-18'),
    a(sai, 1, 'Book rental generators for the start-up', 'risk', 'R-01', 'sai_lead', '2026-12-15'),
    a(sai, 2, 'Prepare the decision file of MOC-02', 'change', 'MOC-02', 'sai_lead', '2026-10-20'),
  ]);
}

/** WBS of the demonstration (owner's pilot feedback, 24 Oct 2026): studies and lot tasks of APM, works and milestones of SAI. */
export async function seedWbs(tx: Tx, apm: string, sai: string, idOf: (k: string) => string, nameOf: (k: string) => string) {
  const lotOf = async (capexId: string, kind: string) => (await tx.select({ id: capexLots.id }).from(capexLots).where(and(eq(capexLots.capexId, capexId), eq(capexLots.kind, kind))))[0]?.id ?? null;
  const t = (capexId: string, number: number, lotId: string | null, name: string, startOn: string, endOn: string, progressPct: number, owner: string | null, milestone = false) => ({
    capexId, number, lotId, name, startOn, endOn, progressPct, ownerUserId: owner ? idOf(owner) : null, milestone, updatedByName: nameOf('project_lead'),
  });
  await tx.insert(wbsTasks).values([
    t(apm, 1, null, 'Preliminary design studies (APS)', '2026-05-18', '2026-09-30', 100, 'project_lead'),
    t(apm, 2, null, 'Detailed design (APD)', '2026-10-01', '2027-01-29', 20, 'project_lead'),
    t(apm, 3, null, 'G2 dossier ready', '2027-02-15', '2027-02-15', 0, 'project_lead', true),
    t(apm, 4, await lotOf(apm, 'civil_works'), 'Soil survey', '2026-10-05', '2026-11-13', 30, 'project_lead'),
    t(apm, 5, await lotOf(apm, 'machines'), 'EPC2i firm offer and negotiation', '2026-09-01', '2026-12-18', 50, 'co_dig'),
    t(sai, 1, await lotOf(sai, 'civil_works'), 'Earthworks', '2026-07-15', '2026-11-27', 80, 'sai_lead'),
    t(sai, 2, await lotOf(sai, 'buildings'), 'Process hall structure', '2026-10-01', '2027-02-26', 15, 'sai_lead'),
    t(sai, 3, await lotOf(sai, 'utilities'), 'Grid connection', '2026-11-02', '2027-03-31', 0, 'sai_lead'),
    t(sai, 4, null, 'Mechanical completion', '2027-04-30', '2027-04-30', 0, 'sai_lead', true),
  ]);
}
