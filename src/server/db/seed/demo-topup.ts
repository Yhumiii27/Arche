// Completes an existing demonstration database with what later lots added to the data set (owner's pilot feedback, 24 Oct
// 2026): a database is seeded only once, so one created earlier lacks them. Adds what is missing and changes nothing else —
// people and their roles, the sites and their coordinates, the CAPEX of the data set (with, for a CAPEX added now, its COPIL
// GPI circuit), the lessons learned of the SAI CAPEX, the action plans and the WBS. Refused on a database not seeded with
// the demonstration data set. `npm run db:demo-topup` (scripts/db-demo-topup.ts).
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { capex, capexActions, gates, rexEntries, roleAssignments, sites, users, wbsTasks } from '../schema';
import type { Tx } from '../types';
import { DEMO_CAPEX, DEMO_PEOPLE, DEMO_SITES, DEMO_SUBSIDIARIES, saiRex, seedActions, seedCapex, seedCopilGate, seedWbs } from './demo';
import { readSeedRecord } from './mode';

export interface TopUpReport {
  people: number;
  roles: number;
  sites: number;
  located: number;
  capex: string[];
  copil: boolean;
  rex: number;
  actions: string[];
  wbs: string[];
}

export async function topUpDemo(tx: Tx): Promise<TopUpReport> {
  // A database without seed record counts as a demonstration one (databaseSeedMode); the subsidiaries are checked next.
  if (((await readSeedRecord(tx))?.mode ?? 'demo') !== 'demo') throw new Error('This database was not seeded with the demonstration data set: nothing changed');
  const subs = await tx.select({ code: capex.subsidiaryCode }).from(capex).where(inArray(capex.subsidiaryCode, DEMO_SUBSIDIARIES.map((s) => s.code))).limit(1);
  if (!subs.length) throw new Error('The demonstration subsidiaries have no CAPEX in this database: nothing changed');
  const report: TopUpReport = { people: 0, roles: 0, sites: 0, located: 0, capex: [], copil: false, rex: 0, actions: [], wbs: [] };

  // People and their roles, by e-mail.
  const known = new Map((await tx.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, DEMO_PEOPLE.map((p) => p.email)))).map((u) => [u.email, u.id]));
  const missing = DEMO_PEOPLE.filter((p) => !known.has(p.email));
  if (missing.length) {
    const rows = await tx.insert(users).values(missing.map((p) => ({ email: p.email, displayName: p.name, jobTitle: p.title, subsidiaryCode: p.subsidiary }))).returning({ id: users.id, email: users.email });
    for (const u of rows) known.set(u.email, u.id);
    report.people = rows.length;
  }
  const idOf = (key: string) => known.get(DEMO_PEOPLE.find((p) => p.key === key)!.email)!;
  const nameOf = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.name;
  const held = await tx.select().from(roleAssignments).where(inArray(roleAssignments.userId, [...known.values()]));
  const newRoles = DEMO_PEOPLE.flatMap((p) => p.roles.map((r) => ({ userId: known.get(p.email)!, role: r.role, scopeKind: r.scope, scopeRef: r.ref, speciality: r.speciality ?? null, createdByName: 'System' })))
    .filter((r) => !held.some((h) => h.userId === r.userId && h.role === r.role && h.scopeKind === r.scopeKind && (h.scopeRef ?? null) === r.scopeRef));
  if (newRoles.length) await tx.insert(roleAssignments).values(newRoles);
  report.roles = newRoles.length;

  // Sites: added when missing, located when they have no coordinates.
  for (const s of DEMO_SITES) {
    const [row] = await tx.select().from(sites).where(and(eq(sites.subsidiaryCode, s.subsidiaryCode), eq(sites.name, s.name)));
    if (!row) {
      await tx.insert(sites).values({ ...s });
      report.sites++;
    } else if (row.latitude == null || row.longitude == null) {
      await tx.update(sites).set({ latitude: s.latitude, longitude: s.longitude }).where(eq(sites.id, row.id));
      report.located++;
    }
  }
  const siteId = new Map((await tx.select({ id: sites.id, name: sites.name }).from(sites).where(inArray(sites.subsidiaryCode, DEMO_SUBSIDIARIES.map((s) => s.code)))).map((s) => [s.name, s.id]));

  // CAPEX of the data set that the database lacks (a code already taken is left as it is).
  const codes = new Set((await tx.select({ code: capex.code }).from(capex).where(inArray(capex.code, DEMO_CAPEX.map((c) => c.code)))).map((c) => c.code));
  for (const c of DEMO_CAPEX) {
    if (codes.has(c.code)) continue;
    await seedCapex(tx, c, siteId, idOf, nameOf);
    report.capex.push(c.code);
  }
  const idOfCapex = new Map((await tx.select({ id: capex.id, code: capex.code }).from(capex).where(inArray(capex.code, DEMO_CAPEX.map((c) => c.code)))).map((c) => [c.code, c.id]));
  const packaging = idOfCapex.get('CPX-SAI-2026-02');
  if (packaging && report.capex.includes('CPX-SAI-2026-02') && !(await tx.select({ id: gates.id }).from(gates).where(eq(gates.capexId, packaging))).length) {
    await seedCopilGate(tx, packaging, idOf, nameOf);
    report.copil = true;
  }

  // Lessons learned of the SAI CAPEX, by CAPEX and title.
  const plant = idOfCapex.get('CPX-SAI-2026-01');
  const solar = idOfCapex.get('CPX-SAI-2026-03');
  if (plant && solar) {
    const rows = saiRex(plant, solar, nameOf);
    const have = await tx.select({ capexId: rexEntries.capexId, number: rexEntries.number, title: rexEntries.title }).from(rexEntries).where(inArray(rexEntries.capexId, [plant, solar]));
    const add = rows.filter((r) => !have.some((h) => h.capexId === r.capexId && h.title === r.title));
    // Numbers after the existing ones of each CAPEX.
    const next = new Map<string, number>();
    for (const h of have) next.set(h.capexId, Math.max(next.get(h.capexId) ?? 0, h.number));
    if (add.length) {
      await tx.insert(rexEntries).values(add.map((r) => {
        const n = (next.get(r.capexId) ?? 0) + 1;
        next.set(r.capexId, n);
        return { ...r, number: n };
      }));
    }
    report.rex = add.length;
  }

  // Action plans and WBS, only where the CAPEX has none yet.
  const apm = idOfCapex.get('CPX-APM-2026-01');
  const sai = plant;
  if (apm && sai) {
    const noAction = !(await tx.select({ id: capexActions.id }).from(capexActions).where(inArray(capexActions.capexId, [apm, sai])).limit(1)).length;
    const noTask = !(await tx.select({ id: wbsTasks.id }).from(wbsTasks).where(inArray(wbsTasks.capexId, [apm, sai])).limit(1)).length;
    if (noAction) {
      await seedActions(tx, apm, sai, idOf, nameOf);
      report.actions.push('CPX-APM-2026-01', 'CPX-SAI-2026-01');
    }
    if (noTask) {
      await seedWbs(tx, apm, sai, idOf, nameOf);
      report.wbs.push('CPX-APM-2026-01', 'CPX-SAI-2026-01');
    }
  }
  return report;
}

/** Sites still without coordinates (reported, not changed: they are not part of the data set). */
export async function unlocatedSites(tx: Tx): Promise<number> {
  return (await tx.select({ id: sites.id }).from(sites).where(or(isNull(sites.latitude), isNull(sites.longitude)))).length;
}
