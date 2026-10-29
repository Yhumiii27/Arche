import 'server-only';
// What the business API reads and writes (AR-048, docs/API.md), within the client's scope (its subsidiaries; never a draft):
// the CAPEX list, one CAPEX in detail (lots, budget versions, gate sessions, machine needs, indicators and alerts), the monthly
// actuals of its lots; writes: the actuals of a lot outside EPC2i and an action of the plan, audited as "API · <client>".
import { and, asc, eq, inArray, ne, type SQL } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import { checkAction } from '@/domain/actions';
import { inClientScope } from '@/domain/api';
import { nextNumber, refOf } from '@/domain/capex';
import { checkActual, monthOf } from '@/domain/execution';
import { needRef } from '@/domain/needs';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { capex, capexActions, capexLots, gates, lotActuals, machineNeeds, sites, subsidiaries, users, zones } from '@/server/db/schema';
import { actionPeople } from '@/server/dal/actions';
import { convertActual, converterFor } from '@/server/dal/currency';
import { latestValidated, versionsOfMany } from '@/server/dal/cycle';
import { capexDashboard } from '@/server/dal/governance';
import type { ApiClient } from './auth';

const sponsor = aliasedTable(users, 'sponsor');

function scopeOf(client: ApiClient): SQL {
  const parts: SQL[] = [ne(capex.status, 'draft')];
  if (client.subsidiaries.length) parts.push(inArray(capex.subsidiaryCode, client.subsidiaries));
  return and(...parts)!;
}

async function rowsOf(client: ApiClient, extra?: SQL) {
  const db = await getDb();
  return db.select({
    id: capex.id, code: capex.code, subsidiaryCode: capex.subsidiaryCode, subsidiary: subsidiaries.name, zone: zones.name, site: sites.name, title: capex.title,
    investmentType: capex.investmentType, status: capex.status, phase: capex.phase, typology: capex.typology, sponsor: sponsor.displayName, projectLead: users.displayName,
    needDate: capex.needDate, openedAt: capex.openedAt, mesStartedOn: capex.mesStartedOn, updatedAt: capex.updatedAt, sponsorUserId: capex.sponsorUserId, leadUserId: capex.leadUserId,
    typologySource: capex.typologySource, typologyProposed: capex.typologyProposed,
  }).from(capex)
    .innerJoin(subsidiaries, eq(subsidiaries.code, capex.subsidiaryCode)).innerJoin(zones, eq(zones.code, subsidiaries.zoneCode))
    .leftJoin(sites, eq(sites.id, capex.siteId)).leftJoin(users, eq(users.id, capex.leadUserId)).leftJoin(sponsor, eq(sponsor.id, capex.sponsorUserId))
    .where(extra ? and(scopeOf(client), extra) : scopeOf(client)).orderBy(asc(capex.code));
}

type Row = Awaited<ReturnType<typeof rowsOf>>[number];

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const summary = (r: Row, validated: { centralKeur: number; estimateClass: string } | null) => ({
  code: r.code, title: r.title, subsidiary: r.subsidiaryCode, subsidiaryName: r.subsidiary, zone: r.zone, site: r.site, investmentType: r.investmentType,
  status: r.status, phase: r.phase, typology: r.typology, sponsor: r.sponsor, projectLead: r.projectLead, needDate: r.needDate, openedOn: day(r.openedAt),
  commissioningStartedOn: r.mesStartedOn, validatedBudgetKeur: validated?.centralKeur ?? null, estimateClass: validated?.estimateClass ?? null, updatedAt: r.updatedAt.toISOString(),
});

export async function capexList(client: ApiClient) {
  const rows = await rowsOf(client);
  const versions = await versionsOfMany(await getDb(), rows.map((r) => r.id));
  return rows.map((r) => summary(r, latestValidated(versions.get(r.id) ?? [])));
}

/** The CAPEX `code` within the client's scope, or null. */
export async function capexOf(client: ApiClient, code: string) {
  return (await rowsOf(client, eq(capex.code, code)))[0] ?? null;
}

export async function capexDetail(client: ApiClient, code: string) {
  const r = await capexOf(client, code);
  if (!r) return null;
  const db = await getDb();
  const today = await businessToday(db);
  const [versions, lots, gs, needs, dash] = await Promise.all([
    versionsOfMany(db, [r.id]).then((m) => m.get(r.id) ?? []),
    db.select().from(capexLots).where(eq(capexLots.capexId, r.id)).orderBy(asc(capexLots.number)),
    db.select().from(gates).where(eq(gates.capexId, r.id)).orderBy(asc(gates.createdAt)),
    db.select().from(machineNeeds).where(eq(machineNeeds.capexId, r.id)).orderBy(asc(machineNeeds.number)),
    capexDashboard(db, { id: r.id, code: r.code, status: r.status, phase: r.phase, typology: r.typology, typologyProposed: r.typologyProposed, openedAt: r.openedAt }, today),
  ]);
  const validated = latestValidated(versions);
  return {
    ...summary(r, validated),
    lots: lots.map((l) => ({ number: l.number, kind: l.kind, title: l.title, epc2i: l.epc2i, plannedStart: l.plannedStart, plannedEnd: l.plannedEnd, validatedBudgetKeur: validated?.lines[l.id] ?? null })),
    budgetVersions: versions.map((v) => ({ number: v.number, estimateClass: v.estimateClass, status: v.status, centralKeur: v.centralKeur, validatedOn: day(v.validatedAt), g2Baseline: v.isG2Baseline })),
    gates: gs.map((g) => ({ gate: g.code, session: g.session, status: g.status, decision: g.decision, decidedOn: day(g.decidedAt), takenOver: g.takenOver })),
    machineNeeds: needs.map((n) => ({ ref: needRef(r.code, n.number), catalogueCode: n.catalogueCode, catalogueVersion: n.catalogueVersion, label: n.freeLabel, quantity: n.quantity, status: n.status, orderedOn: n.orderedOn })),
    indicators: { nextGate: dash.nextGate, ...dash.indicators, g2Keur: dash.g2Keur, packPct: dash.pack.pct, openRisks: dash.openRisks, majorRisks: dash.majorRisks },
    alerts: dash.alerts.map((a) => ({ rule: a.rule, level: a.level, text: a.text, detail: a.detail })),
  };
}

export async function actualsOf(client: ApiClient, code: string) {
  const r = await capexOf(client, code);
  if (!r) return null;
  const db = await getDb();
  const lots = await db.select().from(capexLots).where(eq(capexLots.capexId, r.id)).orderBy(asc(capexLots.number));
  const rows = lots.length ? await db.select().from(lotActuals).where(inArray(lotActuals.lotId, lots.map((l) => l.id))).orderBy(asc(lotActuals.month)) : [];
  const num = new Map(lots.map((l) => [l.id, l.number]));
  return rows.map((a) => ({ lot: num.get(a.lotId)!, month: a.month, committedKeur: a.committedKeur, spentKeur: a.spentKeur, physicalPct: a.physicalPct, source: a.source, enteredBy: a.enteredByName, enteredAt: a.enteredAt.toISOString() }))
    .sort((a, b) => a.lot - b.lot || a.month.localeCompare(b.month));
}

type WriteResult = { ok: true; value: Record<string, unknown> } | { ok: false; status: number; error: string; message?: string };

const actorOf = (client: ApiClient) => ({ actorName: `API · ${client.name}`, actorUserId: null, actorRole: 'api' });

/** Writes the actuals of one lot and month (fields of src/domain/execution.ts checkActual; `lot` is the lot's number). */
export async function writeActual(client: ApiClient, code: string, input: Record<string, unknown>): Promise<WriteResult> {
  const r = await capexOf(client, code);
  if (!r) return { ok: false, status: 404, error: 'not_found' };
  const db = await getDb();
  const today = await businessToday(db);
  return db.transaction(async (tx): Promise<WriteResult> => {
    const [c] = await tx.select().from(capex).where(eq(capex.id, r.id));
    if (!c || !inClientScope(client.subsidiaries, c)) return { ok: false, status: 404, error: 'not_found' };
    if (c.status !== 'active') return { ok: false, status: 409, error: 'capex_not_active' };
    const [lot] = await tx.select().from(capexLots).where(and(eq(capexLots.capexId, c.id), eq(capexLots.number, Number(input.lot))));
    if (!lot) return { ok: false, status: 422, error: 'unknown_lot' };
    if (lot.epc2i) return { ok: false, status: 422, error: 'epc2i_lot', message: 'EPC2i lots come from Keystone' };
    // JSON numbers are read like the typed values of the form.
    const ch = checkActual(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])), monthOf(today));
    if (!ch.ok) return { ok: false, status: 422, error: 'invalid', message: ch.error };
    const conv = await converterFor(tx, c.subsidiaryCode, input.currency, ch.value.month);
    if (!conv.ok) return { ok: false, status: 422, error: 'invalid', message: conv.error };
    const values = { month: ch.value.month, ...convertActual(ch.value, conv.value), source: 'import' as const, enteredByName: `API · ${client.name}`, enteredAt: new Date() };
    const [before] = await tx.select().from(lotActuals).where(and(eq(lotActuals.lotId, lot.id), eq(lotActuals.month, ch.value.month)));
    await tx.insert(lotActuals).values({ lotId: lot.id, ...values }).onConflictDoUpdate({ target: [lotActuals.lotId, lotActuals.month], set: values });
    await writeAudit(tx, {
      ...actorOf(client), objectRef: c.code, area: 'CAPEX', capexId: c.id, change: `lot ${lot.number}, ${ch.value.month}: actuals entered (API)`, entityType: 'lot_actual', entityId: lot.id,
      before: before ? { committedKeur: before.committedKeur, spentKeur: before.spentKeur, physicalPct: before.physicalPct } : undefined,
      after: { committedKeur: values.committedKeur, spentKeur: values.spentKeur, physicalPct: values.physicalPct, ...(values.currency ? { currency: values.currency, rate: values.rate } : {}) },
    });
    return { ok: true, value: { lot: lot.number, month: ch.value.month, committedKeur: values.committedKeur, spentKeur: values.spentKeur, physicalPct: values.physicalPct, currency: conv.value.currency, rate: conv.value.rate } };
  });
}

/** Opens an action of the plan (fields of src/domain/actions.ts checkAction; the owner by e-mail, in the CAPEX's team). */
export async function writeAction(client: ApiClient, code: string, input: Record<string, unknown>): Promise<WriteResult> {
  const r = await capexOf(client, code);
  if (!r) return { ok: false, status: 404, error: 'not_found' };
  const db = await getDb();
  return db.transaction(async (tx): Promise<WriteResult> => {
    const [c] = await tx.select().from(capex).where(eq(capex.id, r.id));
    if (!c || !inClientScope(client.subsidiaries, c)) return { ok: false, status: 404, error: 'not_found' };
    if (c.status !== 'active' && c.status !== 'on_hold') return { ok: false, status: 409, error: 'capex_not_active' };
    const people = await actionPeople(tx, c);
    let ownerUserId = '';
    if (typeof input.ownerEmail === 'string' && input.ownerEmail) {
      const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.ownerEmail.trim().toLowerCase()));
      if (!u || !people.some((p) => p.value === u.id)) return { ok: false, status: 422, error: 'invalid', message: 'Choose the owner in the team' };
      ownerUserId = u.id;
    }
    const ch = checkAction({ ...input, ownerUserId }, { people: new Set(people.map((p) => p.value)) });
    if (!ch.ok) return { ok: false, status: 422, error: 'invalid', message: ch.error };
    const number = nextNumber((await tx.select({ n: capexActions.number }).from(capexActions).where(eq(capexActions.capexId, c.id))).map((x) => x.n));
    const [a] = await tx.insert(capexActions).values({ capexId: c.id, number, ...ch.value, createdByName: `API · ${client.name}` }).returning({ id: capexActions.id });
    await writeAudit(tx, { ...actorOf(client), objectRef: c.code, area: 'CAPEX', capexId: c.id, change: `action ${refOf('A', number)} opened (API): ${ch.value.title}`, entityType: 'capex_action', entityId: a.id, after: { ...ch.value } });
    return { ok: true, value: { number: refOf('A', number), ...ch.value } };
  });
}

