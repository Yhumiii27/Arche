// Demonstration data set (N-21): two fictitious subsidiaries — Atlas Process Maroc (APM, North Africa) and Sahel Agro
// Industries (SAI, West Africa) —, the group, one person per profile and three CAPEX (one Light, one Strategic, one draft).
// No real person or company. The e-mail domains are reserved example domains.
import type { RoleKey, ScopeKind, ExpertSpeciality } from '@/config/roles';
import { capex, capexMembers, roleAssignments, sites, subsidiaries, users, zones, type CapexRole } from '../schema';
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

const DEMO_CAPEX = [
  {
    code: 'CPX-APM-2026-01', subsidiary: 'APM', site: 'Kénitra plant', title: 'Second extrusion line', investmentType: 'new_line', status: 'active', phase: 'avant_projet', typology: 'light',
    sponsor: 'sponsor', lead: 'project_lead', team: [['project_lead', 'lead'], ['controller', 'controller'], ['co_dig', 'co_dig']],
  },
  {
    code: 'CPX-APM-2026-02', subsidiary: 'APM', site: 'Kénitra plant', title: 'Warehouse extension', investmentType: 'extension', status: 'draft', phase: 'cadrage', typology: null,
    sponsor: 'sponsor', lead: 'project_lead', team: [['project_lead', 'lead']],
  },
  {
    code: 'CPX-SAI-2026-01', subsidiary: 'SAI', site: 'Thiès site', title: 'New tomato processing plant', investmentType: 'new_plant', status: 'active', phase: 'execution', typology: 'strategic',
    sponsor: 'sai_sponsor', lead: 'sai_lead', team: [['sai_lead', 'lead'], ['sai_controller', 'controller'], ['epc2i_pmo', 'epc2i_pmo'], ['expert', 'member']],
  },
] as const;

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
  for (const c of DEMO_CAPEX) {
    const [row] = await tx.insert(capex).values({
      code: c.code, subsidiaryCode: c.subsidiary, siteId: siteId.get(c.site) ?? null, title: c.title, investmentType: c.investmentType,
      status: c.status, phase: c.phase, typology: c.typology, sponsorUserId: idOf(c.sponsor), leadUserId: idOf(c.lead),
    }).returning({ id: capex.id });
    await tx.insert(capexMembers).values(c.team.map(([key, capexRole]) => ({ capexId: row.id, userId: idOf(key), capexRole: capexRole as CapexRole })));
  }
}
