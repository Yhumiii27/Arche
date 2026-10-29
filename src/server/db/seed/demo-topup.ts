// Completes an existing demonstration database with what later lots added to the data set (owner's pilot feedback, 24 Oct
// 2026): a database is seeded only once, so one created earlier lacks them. Adds what is missing and changes nothing else —
// people and their roles, the sites and their coordinates, the CAPEX of the data set (with, for a CAPEX added now, its COPIL
// GPI circuit), the machine needs, the delivery data (safety milestones, permits, pack, actuals; delivery 5), the start-up of
// CPX-APM-2025-01 (delivery 6), the reviews and snapshots, the lessons learned of the SAI CAPEX, the action plans and the WBS
// — each part only where the database has none of it. Refused on a database not seeded with
// the demonstration data set. `npm run db:demo-topup` (scripts/db-demo-topup.ts).
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { assetClasses, authorizations, capex, capexScores, envelopes, portfolioScenarios, exchangeRates, capexActions, gates, hsStatuses, machineNeeds, packItems, productionLines, reviews, rexEntries, roleAssignments, sites, users, wbsTasks } from '../schema';
import { syncKeystone } from '@/server/integrations/keystone/mirror';
import type { Tx } from '../types';
import { DEMO_ASSET_CLASSES, DEMO_CAPEX, DEMO_PEOPLE, DEMO_RATES, DEMO_SITES, DEMO_SUBSIDIARIES, saiRex, seedActions, seedCapex, seedCopilGate, seedDelivery, seedEnvelopes, seedGovernance, seedPortfolio, seedNeeds, seedStartup, seedWbs } from './demo';
import { readSeedRecord } from './mode';

export interface TopUpReport {
  people: number;
  roles: number;
  sites: number;
  located: number;
  capex: string[];
  copil: boolean;
  /** CAPEX whose machine needs were added. */
  needs: string[];
  delivery: boolean;
  startup: boolean;
  governance: boolean;
  rex: number;
  actions: string[];
  wbs: string[];
  /** Reference exchange rates added (AR-039). */
  rates: number;
  /** The demo's envelopes (AR-040), when the database has none. */
  envelopes: boolean;
  portfolio: boolean;
}

export async function topUpDemo(tx: Tx): Promise<TopUpReport> {
  // A database without seed record counts as a demonstration one (databaseSeedMode); the subsidiaries are checked next.
  if (((await readSeedRecord(tx))?.mode ?? 'demo') !== 'demo') throw new Error('This database was not seeded with the demonstration data set: nothing changed');
  const subs = await tx.select({ code: capex.subsidiaryCode }).from(capex).where(inArray(capex.subsidiaryCode, DEMO_SUBSIDIARIES.map((s) => s.code))).limit(1);
  if (!subs.length) throw new Error('The demonstration subsidiaries have no CAPEX in this database: nothing changed');
  const report: TopUpReport = { people: 0, roles: 0, sites: 0, located: 0, capex: [], copil: false, needs: [], delivery: false, startup: false, governance: false, rex: 0, actions: [], wbs: [], rates: 0, envelopes: false, portfolio: false };

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
  // The group's reference exchange rates (AR-039), by currency and period.
  const haveRates = await tx.select({ currency: exchangeRates.currency, period: exchangeRates.period }).from(exchangeRates);
  const newRates = DEMO_RATES.filter((r) => !haveRates.some((h) => h.currency === r.currency && h.period === r.period));
  if (newRates.length) await tx.insert(exchangeRates).values(newRates.map((r) => ({ ...r, enteredByName: 'Paul Renaud', note: 'Group reference rate' })));
  report.rates = newRates.length;

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

  const apm = idOfCapex.get('CPX-APM-2026-01');
  const sai = plant;
  const apm25 = idOfCapex.get('CPX-APM-2025-01');
  const none = async (rows: Promise<unknown[]>) => !(await rows).length;
  if (apm && sai && apm25) {
    // Machine needs (delivery 4), per CAPEX without any, or still holding the needs of the earlier data set exactly (never
    // edited: replaced by the needs Keystone's demo knows, owner 25 Oct 2026); then the Keystone mirror (simulation).
    const ids = { apm, sai, apm25 };
    const without = new Set<string>();
    for (const capexId of [apm, sai, apm25]) {
      const rows = await tx.select({ number: machineNeeds.number, code: machineNeeds.catalogueCode, label: machineNeeds.freeLabel, status: machineNeeds.status }).from(machineNeeds).where(eq(machineNeeds.capexId, capexId));
      if (!rows.length) without.add(capexId);
      else if (isEarlierDemoSet(rows)) {
        await tx.delete(machineNeeds).where(eq(machineNeeds.capexId, capexId));
        without.add(capexId);
      }
    }
    if (without.size) {
      await seedNeeds(tx, ids, nameOf, without);
      report.needs = [...idOfCapex].filter(([, id]) => without.has(id)).map(([code]) => code);
    }
    // Delivery 5a: safety milestones, permits, pack, lot windows and actuals — when neither APM nor SAI has any.
    const pair = [apm, sai];
    if (await none(tx.select({ c: hsStatuses.capexId }).from(hsStatuses).where(inArray(hsStatuses.capexId, pair)).limit(1))
      && await none(tx.select({ id: authorizations.id }).from(authorizations).where(inArray(authorizations.capexId, pair)).limit(1))
      && await none(tx.select({ c: packItems.capexId }).from(packItems).where(inArray(packItems.capexId, pair)).limit(1))) {
      await seedDelivery(tx, apm, sai, nameOf);
      report.delivery = true;
    }
    if (report.needs.length) await syncKeystone(tx, { now: new Date('2026-10-22T10:00:00Z'), mode: 'simulation' });
    // Delivery 6: the start-up of CPX-APM-2025-01, when it has no production line, safety milestone, review nor lesson.
    if (await none(tx.select({ id: productionLines.id }).from(productionLines).where(eq(productionLines.capexId, apm25)).limit(1))
      && await none(tx.select({ c: hsStatuses.capexId }).from(hsStatuses).where(eq(hsStatuses.capexId, apm25)).limit(1))
      && await none(tx.select({ id: reviews.id }).from(reviews).where(eq(reviews.capexId, apm25)).limit(1))
      && await none(tx.select({ id: rexEntries.id }).from(rexEntries).where(eq(rexEntries.capexId, apm25)).limit(1))) {
      await seedStartup(tx, apm25, nameOf);
      report.startup = true;
    }
    // Delivery 5b: project reviews and audits, and the weeks of snapshots (existing weeks kept).
    if (await none(tx.select({ id: reviews.id }).from(reviews).where(inArray(reviews.capexId, pair)).limit(1))) {
      await seedGovernance(tx, apm, sai, nameOf);
      report.governance = true;
    }
  }

  // Action plans and WBS, only where the CAPEX has none yet.
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
  // Asset classes (AR-050), when the database has none.
  if (!(await tx.select({ code: assetClasses.code }).from(assetClasses).limit(1)).length) await tx.insert(assetClasses).values(DEMO_ASSET_CLASSES);
  // Envelopes (AR-040), when the database has none.
  if (!(await tx.select({ id: envelopes.id }).from(envelopes).limit(1)).length) {
    await seedEnvelopes(tx, nameOf);
    report.envelopes = true;
  }
  // Scores and scenarios (AR-044, AR-043), when the database has none and the CAPEX they name are there.
  const scored = ['CPX-APM-2026-01', 'CPX-SAI-2026-01', 'CPX-SAI-2026-02', 'CPX-SAI-2026-03'];
  const found = await tx.select({ id: capex.id, code: capex.code }).from(capex).where(inArray(capex.code, scored));
  if (found.length === scored.length && !(await tx.select({ id: portfolioScenarios.id }).from(portfolioScenarios).limit(1)).length && !(await tx.select({ id: capexScores.capexId }).from(capexScores).limit(1)).length) {
    const of = (code: string) => found.find((f) => f.code === code)!.id;
    await seedPortfolio(tx, { apm: of(scored[0]), sai: of(scored[1]), sai2: of(scored[2]), sai3: of(scored[3]) }, nameOf);
    report.portfolio = true;
  }
  return report;
}

/** The machine needs of a CAPEX in the data set before 25 Oct 2026, untouched (catalogue of Arche's former simulation). */
const EARLIER_NEEDS = ['1:EXT-9MN:submitted|2:EXT-AGE:submitted|3:Billet saw with automatic loader:draft', '1:PRC-TOM:ordered|2:PRC-CAN:ordered', '1:EXT-AGE:ordered'];

export function isEarlierDemoSet(rows: readonly { number: number; code: string | null; label: string | null; status: string }[]): boolean {
  const key = [...rows].sort((a, b) => a.number - b.number).map((r) => `${r.number}:${r.code ?? r.label}:${r.status}`).join('|');
  return EARLIER_NEEDS.includes(key);
}

/** Sites still without coordinates (reported, not changed: they are not part of the data set). */
export async function unlocatedSites(tx: Tx): Promise<number> {
  return (await tx.select({ id: sites.id }).from(sites).where(or(isNull(sites.latitude), isNull(sites.longitude)))).length;
}
