// Demonstration data set (N-21): two fictitious subsidiaries — Atlas Process Maroc (APM, North Africa) and Sahel Agro
// Industries (SAI, West Africa) —, the group, one person per profile and three CAPEX (one Light, one Strategic, one draft).
// No real person or company. The e-mail domains are reserved example domains.
import type { RoleKey, ScopeKind, ExpertSpeciality } from '@/config/roles';
import {
  budgetLines, budgetVersions, capex, capexLots, capexMembers, decisions, gateCriteriaResults, gates, phaseTransitions, referenceRevenues, risks,
  roleAssignments, sites, subsidiaries, users, zones, type CapexRole, type EstimateClass, type GateCode,
} from '../schema';
import type { Tx } from '../types';

export const DEMO_ZONES = [
  { code: 'AFN', name: 'North Africa' },
  { code: 'AFO', name: 'West Africa' },
  { code: 'EUR', name: 'Europe' },
] as const;

export const DEMO_SUBSIDIARIES = [
  { code: 'APM', name: 'Atlas Process Maroc', countryIso2: 'MA', zoneCode: 'AFN', currency: 'MAD' },
  { code: 'SAI', name: 'Sahel Agro Industries', countryIso2: 'SN', zoneCode: 'AFO', currency: 'XOF' },
] as const;

const DEMO_SITES = [
  { subsidiaryCode: 'APM', name: 'Kénitra plant', city: 'Kénitra', countryIso2: 'MA' },
  { subsidiaryCode: 'SAI', name: 'Thiès site', city: 'Thiès', countryIso2: 'SN' },
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
    let phase = 'cadrage';
    for (const [code, on] of c.passed) {
      const decider = GATE_DECIDER_KEY[code];
      const [g] = await tx.insert(gates).values({ capexId, code, session: 1, status: 'decided', decision: 'go', decidedAt: at(on), decidedByName: nameOf(decider), decidedByUserId: idOf(decider) }).returning({ id: gates.id });
      await tx.insert(gateCriteriaResults).values({ gateId: g.id, criterionCode: code === 'G1' ? 'g1_budget_e50' : 'g2_budget_e10', state: 'met', value: code === 'G1' ? 'E50' : 'E10' });
      await tx.insert(phaseTransitions).values({ capexId, fromStatus: 'active', fromPhase: phase, toStatus: 'active', toPhase: PHASE_AFTER[code], gateCode: code, effectiveOn: on, byName: nameOf(decider), byUserId: idOf(decider), occurredAt: at(on) });
      phase = PHASE_AFTER[code];
    }
    if (c.risks.length) {
      await tx.insert(risks).values(c.risks.map((r, i) => ({
        capexId, number: i + 1, title: r.title, category: r.category, probability: r.p, impact: r.i, ownerUserId: idOf(r.owner), response: r.response, status: r.status ?? 'open', dueOn: r.due ?? null,
      })));
    }
    if (c.decisions.length) {
      await tx.insert(decisions).values(c.decisions.map(([takenOn, body, text], i) => ({ capexId, number: i + 1, takenOn, body, text, recordedByName: nameOf(c.lead) })));
    }
  }
}
