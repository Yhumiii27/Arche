import 'server-only';
// Governance and dashboards (delivery 5, lot 5b; docs/spec/06 §2, §5, §7): reviews and their cadence, the dashboard of one
// CAPEX (phase, gate and its state, budget, EAC, SPI / CPI, pack, uncertainty gap, HS, changes, risks, next review, alerts),
// the portfolio of the viewer (through the visibility filter, on the zone of the session), the COPIL GPI agenda and the weekly
// snapshots. Every CAPEX read goes through visibleCapex / capexForViewer; the per-CAPEX functions take a row already read.
import { and, asc, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { alertsOf, sortAlerts, type Alert } from '@/domain/alerts';
import { missingStaff } from '@/domain/budget';
import { addWorkingDays } from '@/domain/circuits';
import { uncertaintyGap } from '@/domain/execution';
import { forecastOf } from '@/domain/forecast';
import { recommendationsOf } from '@/domain/process-safety';
import { studiesOf } from '@/server/integrations/vigie/sync';
import { needRef } from '@/domain/needs';
import { packSummary, type PackItemState } from '@/domain/pack';
import type { HsState } from '@/domain/safety';
import { missingAudits, nextReview } from '@/domain/governance';
import { CROSS_VIEW_ROLES } from '@/config/roles';
import { currentGate, type CycleState, type GateCode, type ModelValues } from '@/domain/lifecycle';
import { permitsDue } from '@/domain/permits';
import { hsBoard } from '@/domain/safety';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { authorizations, capex, capexLots, capexMembers, capexSnapshots, changes, circuitSteps, gateConditions, gates, hsStatuses, lotActuals, machineNeeds, packItems, productionLines, reviews, risks } from '@/server/db/schema';
import { projectsOfMany } from '@/server/integrations/keystone';
import type { DB, Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';
import { isMine, visibleCapex, type CapexRow } from './capex';
import { modelValues, versionsOfMany } from './cycle';
import { epc2iPackOf, executionFrom, lotPlansFrom } from './execution';
import { portfolioOf } from './portfolio';
import { daysOf, rampupFrom } from './rampup';
import { envelopeData, phasedCapex } from './finance';
import { envelopeCheck } from '@/domain/envelopes';

type Q = DB | Tx;

export async function reviewsOf(q: Q, capexId: string) {
  return q.select().from(reviews).where(eq(reviews.capexId, capexId)).orderBy(desc(reviews.heldOn), desc(reviews.number));
}

type CapexFull = { id: string; code: string; status: string; phase: string; typology: string | null; typologyProposed: string | null; openedAt: Date | null };

const groupBy = <T, K>(rows: readonly T[], key: (r: T) => K) => {
  const m = new Map<K, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
};

/**
 * Everything the dashboards of these CAPEX read, one query per table whatever their number (AR-049: the portfolio views
 * read in a fixed number of queries, not one batch per CAPEX).
 */
async function dashboardData(q: Q, cs: readonly { id: string; code: string }[], today: string) {
  const ids = cs.map((c) => c.id);
  const none = ids.length === 0;
  const [lots, versions, projects, needs, revs, team, permits, hs, running, conds, openChanges, openRisks, items, mes, lines] = await Promise.all([
    none ? [] : q.select().from(capexLots).where(inArray(capexLots.capexId, ids)).orderBy(asc(capexLots.number)),
    versionsOfMany(q, ids),
    projectsOfMany(q, cs.map((c) => c.code)),
    none ? [] : q.select().from(machineNeeds).where(inArray(machineNeeds.capexId, ids)).orderBy(asc(machineNeeds.number)),
    none ? [] : q.select().from(reviews).where(inArray(reviews.capexId, ids)).orderBy(desc(reviews.heldOn), desc(reviews.number)),
    none ? [] : q.select({ capexId: capexMembers.capexId, capexRole: capexMembers.capexRole }).from(capexMembers).where(inArray(capexMembers.capexId, ids)),
    none ? [] : q.select().from(authorizations).where(inArray(authorizations.capexId, ids)).orderBy(asc(authorizations.number)),
    none ? [] : q.select().from(hsStatuses).where(inArray(hsStatuses.capexId, ids)),
    none ? [] : q.select().from(gates).where(and(inArray(gates.capexId, ids), eq(gates.status, 'in_review'))),
    none ? [] : q.select({ capexId: gates.capexId }).from(gateConditions).innerJoin(gates, eq(gates.id, gateConditions.gateId))
      .where(and(inArray(gates.capexId, ids), isNull(gateConditions.closedOn), lt(gateConditions.dueOn, today))),
    none ? [] : q.select({ capexId: changes.capexId }).from(changes).where(and(inArray(changes.capexId, ids), eq(changes.status, 'submitted'))),
    none ? [] : q.select({ capexId: risks.capexId, p: risks.probability, i: risks.impact }).from(risks).where(and(inArray(risks.capexId, ids), inArray(risks.status, ['open', 'mitigated']))),
    none ? [] : q.select().from(packItems).where(inArray(packItems.capexId, ids)),
    none ? [] : q.select({ id: capex.id, on: capex.mesStartedOn }).from(capex).where(inArray(capex.id, ids)),
    none ? [] : q.select().from(productionLines).where(inArray(productionLines.capexId, ids)).orderBy(asc(productionLines.number)),
  ]);
  const lotIds = lots.map((l) => l.id);
  const sessionIds = running.map((g) => g.id);
  const [stored, days, steps, env, phased, studies] = await Promise.all([
    lotIds.length ? q.select().from(lotActuals).where(inArray(lotActuals.lotId, lotIds)).orderBy(asc(lotActuals.month)) : [],
    daysOf(q, lines.map((l) => l.id)),
    sessionIds.length ? q.select().from(circuitSteps).where(and(inArray(circuitSteps.gateId, sessionIds), eq(circuitSteps.status, 'open'))) : [],
    envelopeData(q),
    none ? Promise.resolve([]) : phasedCapex(q, today, ids),
    studiesOf(q, cs.map((c) => c.code)),
  ]);
  // Envelope control of each CAPEX (AR-040), against every CAPEX of the group.
  const envelopeOverOf = (id: string, tolerancePct: number) => {
    const mine = phased.find((p) => p.id === id);
    if (!mine || !env.envelopes.length) return [];
    return envelopeCheck(env.envelopes, env.movements, phased, mine, tolerancePct).over.map((r) => ({ year: r.year, overKeur: r.overKeur, blocked: !!r.state && (r.state.totalKeur <= 0 || (r.overKeur / r.state.totalKeur) * 100 > tolerancePct) }));
  };
  const lotCapex = new Map(lots.map((l) => [l.id, l.capexId]));
  const lineCapex = new Map(lines.map((l) => [l.id, l.capexId]));
  const by = {
    lots: groupBy(lots, (l) => l.capexId), needs: groupBy(needs, (n) => n.capexId), revs: groupBy(revs, (r) => r.capexId), team: groupBy(team, (m) => m.capexId),
    permits: groupBy(permits, (p) => p.capexId), hs: groupBy(hs, (h) => h.capexId), running: groupBy(running, (g) => g.capexId), conds: groupBy(conds, (c) => c.capexId),
    changes: groupBy(openChanges, (c) => c.capexId), risks: groupBy(openRisks, (r) => r.capexId), items: groupBy(items, (i) => i.capexId), lines: groupBy(lines, (l) => l.capexId),
    stored: groupBy(stored, (a) => lotCapex.get(a.lotId)), days: groupBy(days, (d) => lineCapex.get(d.lineId)), steps: groupBy(steps, (s) => s.gateId),
  };
  const mesOf = new Map(mes.map((m) => [m.id, m.on]));
  return (c: { id: string; code: string }) => ({
    plans: lotPlansFrom(by.lots.get(c.id) ?? [], versions.get(c.id) ?? []),
    projects: projects.get(c.code) ?? [],
    needs: (by.needs.get(c.id) ?? []).map((n) => ({ ...n, ref: needRef(c.code, n.number) })),
    stored: by.stored.get(c.id) ?? [],
    revs: by.revs.get(c.id) ?? [],
    team: by.team.get(c.id) ?? [],
    permits: by.permits.get(c.id) ?? [],
    hs: (by.hs.get(c.id) ?? []).map((r): HsState => ({ code: r.hsCode, status: r.status, evidenceRef: r.evidenceRef, passedOn: r.passedOn, note: r.note, source: r.source })),
    running: by.running.get(c.id) ?? [],
    lateConditions: (by.conds.get(c.id) ?? []).length,
    openChanges: (by.changes.get(c.id) ?? []).length,
    openRisks: by.risks.get(c.id) ?? [],
    items: (by.items.get(c.id) ?? []).map((r): PackItemState => ({ code: r.itemCode, status: r.status, codexRef: r.codexRef, validatedOn: r.validatedOn })),
    mesStartedOn: mesOf.get(c.id) ?? null,
    lines: by.lines.get(c.id) ?? [],
    days: by.days.get(c.id) ?? [],
    steps: (g: string) => by.steps.get(g) ?? [],
    envelopeOver: (tolerancePct: number) => envelopeOverOf(c.id, tolerancePct),
    // Vigie's process safety studies (AR-033): their late recommendations.
    safetyLate: recommendationsOf(studies.filter((x) => x.capexCode === c.code)).late,
  });
}

type DashboardData = ReturnType<Awaited<ReturnType<typeof dashboardData>>>;

/** The dashboard of one CAPEX at `today`. */
export async function capexDashboard(q: Q, c: CapexFull, today: string) {
  return (await capexDashboards(q, [c], today))[0];
}

/** The dashboards of several CAPEX at `today`, in a fixed number of queries (AR-049). */
export async function capexDashboards(q: Q, cs: readonly CapexFull[], today: string) {
  const [values, data] = await Promise.all([modelValues(q), dashboardData(q, cs, today)]);
  return cs.map((c) => dashboardFrom(c, data(c), values, today));
}

function dashboardFrom(c: CapexFull, d: DashboardData, values: ModelValues, today: string) {
  const exec = executionFrom(d, today);
  const pack = { summary: packSummary(d.items, epc2iPackOf(exec.projects)) };
  const startup = rampupFrom({ mesStartedOn: d.mesStartedOn }, d.lines, d.days, values, today);
  const revs = d.revs;
  const session = d.running[0] ?? null;
  const steps = session ? d.steps(session.id) : [];
  const submittedOn = session ? session.createdAt.toISOString().slice(0, 10) : null;
  const targetOn = session && submittedOn ? addWorkingDays(submittedOn, values.gateDelayDays[session.code as GateCode]) : null;
  const copil = revs.filter((r) => r.kind === 'copil_projet');
  const review = nextReview({ status: c.status, typology: c.typology, openedOn: c.openedAt ? c.openedAt.toISOString().slice(0, 10) : null, lastHeldOn: copil[0]?.heldOn ?? null }, today);
  const audits = missingAudits(c, revs.filter((r) => r.kind === 'audit'));
  const afterG2 = c.phase === 'execution' || c.phase === 'demarrage';
  const measured = exec.indicators.acKeur > 0 || exec.indicators.evKeur > 0;
  const drift = afterG2 && measured ? forecastOf(exec.curve, exec.indicators.bacKeur, exec.month) : null;
  const alerts = sortAlerts(alertsOf({
    code: c.code, status: c.status, typologyProposed: c.typologyProposed,
    running: session && submittedOn && targetOn ? { gate: session.code, submittedOn, targetOn } : null,
    openSteps: steps.map((s) => ({ label: s.label, kind: s.kind, dueOn: s.dueOn })),
    review, missingAudits: audits, permitsDue: permitsDue(d.permits, today),
    indicators: afterG2 && measured ? { spi: exec.indicators.spi, cpi: exec.indicators.cpi, eacKeur: exec.indicators.eacKeur } : null,
    g2Keur: exec.g2Keur, missingStaff: c.status === 'active' ? missingStaff(c.typology as 'light' | 'strategic' | null, d.team.map((m) => m.capexRole)) : [],
    lateConditions: d.lateConditions,
    rampup: c.phase === 'demarrage' && startup.result.mesStartedOn ? { alertOn: startup.result.alertOn, limitOn: startup.result.limitOn, reached: !!startup.result.reachedOn } : null,
    envelopeOver: d.envelopeOver(values.envelopeBlockPct),
    safetyLate: d.safetyLate,
    drift: drift ? { ...drift.drift, eacDeltaPct: drift.eacTrend?.deltaPct ?? null, delayMonths: drift.delayMonths } : null,
  }, today));
  const board = hsBoard(d.hs);
  return {
    nextGate: currentGate(c as CycleState),
    running: session ? { gate: session.code as GateCode, session: session.session, submittedOn, targetOn, late: !!targetOn && targetOn < today } : null,
    indicators: exec.indicators, g2Keur: exec.g2Keur, budgetSource: exec.budgetSource, curve: exec.curve, month: exec.month,
    gap: uncertaintyGap({ latestClass: exec.latestClass, nextGate: currentGate(c as CycleState), afterG2, g2Keur: exec.g2Keur, eacKeur: exec.indicators.eacKeur }),
    pack: pack.summary, packThresholdPct: values.packThresholdPct,
    hs: { passed: board.filter((s) => s.status === 'passed' || s.status === 'waived').length, total: board.length, next: board.find((s) => s.status !== 'passed' && s.status !== 'waived') ?? null },
    review, missingAudits: audits, lastReview: revs[0] ?? null,
    openChanges: d.openChanges, majorRisks: d.openRisks.filter((r) => r.p * r.i >= 9).length, openRisks: d.openRisks.length,
    rampup: startup.result,
    alerts,
  };
}

export type CapexDashboard = Awaited<ReturnType<typeof capexDashboard>>;

async function fullRows(q: Q, ids: string[]) {
  if (!ids.length) return [];
  return q.select({ id: capex.id, code: capex.code, status: capex.status, phase: capex.phase, typology: capex.typology, typologyProposed: capex.typologyProposed, openedAt: capex.openedAt }).from(capex).where(inArray(capex.id, ids));
}

/** Weekly trend of the snapshots of these CAPEX (oldest first). */
async function snapshotsOf(q: Q, ids: string[], since: string) {
  if (!ids.length) return [];
  return q.select().from(capexSnapshots).where(and(inArray(capexSnapshots.capexId, ids), gte(capexSnapshots.week, since))).orderBy(asc(capexSnapshots.week));
}

/** The portfolio dashboard (spec 06 §5): the viewer's CAPEX on the zone of the session, each with its dashboard and trend. */
export async function portfolioDashboard(viewer: Viewer, zone: string | null, subsidiary: string | null = null) {
  const db = await getDb();
  const today = await businessToday(db);
  const all = await portfolioOf(viewer, zone);
  const p = subsidiary ? { ...all, rows: all.rows.filter((r) => r.subsidiaryCode === subsidiary) } : all;
  const full = new Map((await fullRows(db, p.rows.map((r) => r.id))).map((r) => [r.id, r]));
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 12 * 7 * 86_400_000).toISOString().slice(0, 10);
  const snaps = await snapshotsOf(db, p.rows.map((r) => r.id), since);
  const dashes = await capexDashboards(db, p.rows.map((r) => full.get(r.id)!), today);
  const rows = p.rows.map((r, i) => ({ ...r, dash: dashes[i], trend: snaps.filter((s) => s.capexId === r.id) }));
  return { ...p, rows, today };
}

/**
 * The CAPEX the home page follows: every visible one for the profiles that oversee (CEO, zone director, the cross-cutting
 * profiles), else the viewer's own (named on it, sponsor or project lead).
 */
export function followedBy(viewer: Viewer): (c: CapexRow) => boolean {
  const broad = viewer.role === 'ceo' || viewer.role === 'zone_director' || CROSS_VIEW_ROLES.includes(viewer.role);
  return (c) => broad || isMine(viewer, c);
}

/** Alerts of the CAPEX the viewer sees (home page). */
export async function alertsForViewer(viewer: Viewer, only?: (c: CapexRow) => boolean): Promise<{ alerts: Alert[]; rows: (CapexRow & { dash: CapexDashboard })[] }> {
  const db = await getDb();
  const today = await businessToday(db);
  const seen = (await visibleCapex(viewer)).filter((c) => (c.status === 'active' || c.status === 'draft') && (!only || only(c)));
  const full = new Map((await fullRows(db, seen.map((c) => c.id))).map((r) => [r.id, r]));
  const dashes = await capexDashboards(db, seen.map((c) => full.get(c.id)!), today);
  const rows = seen.map((c, i) => ({ ...c, dash: dashes[i] }));
  return { alerts: sortAlerts(rows.flatMap((r) => r.dash.alerts)), rows };
}

/**
 * The COPIL GPI agenda (spec 06 §5, N-6, N-7): G1 sessions whose circuit runs, with the decision step's deadline (2 working
 * days) and the steps still open, and the G1 decisions of the last 90 days. Only the CAPEX the viewer sees.
 */
export async function copilAgenda(viewer: Viewer) {
  const db = await getDb();
  const today = await businessToday(db);
  const seen = await visibleCapex(viewer);
  if (!seen.length) return { today, running: [], decided: [] };
  const byId = new Map(seen.map((c) => [c.id, c]));
  const g1 = await db.select().from(gates).where(and(inArray(gates.capexId, seen.map((c) => c.id)), eq(gates.code, 'G1'))).orderBy(desc(gates.createdAt));
  const runningGates = g1.filter((g) => g.status === 'in_review');
  const steps = runningGates.length ? await db.select().from(circuitSteps).where(inArray(circuitSteps.gateId, runningGates.map((g) => g.id))).orderBy(asc(circuitSteps.position)) : [];
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 90 * 86_400_000);
  return {
    today,
    running: runningGates.map((g) => {
      const mine = steps.filter((s) => s.gateId === g.id);
      const decision = mine.find((s) => s.decides) ?? null;
      return { capex: byId.get(g.capexId)!, session: g.session, submittedOn: g.createdAt.toISOString().slice(0, 10), decision, steps: mine };
    }),
    decided: g1.filter((g) => g.status === 'decided' && g.decidedAt && g.decidedAt >= since).map((g) => ({ capex: byId.get(g.capexId)!, session: g.session, decision: g.decision, decidedAt: g.decidedAt!, decidedByName: g.decidedByName, reason: g.decisionReason })),
  };
}

/** Monday of the week of `day`. */
export function weekOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Takes (or refreshes) this week's snapshot of every active CAPEX (job `weekly-snapshot`; idempotent within a week). */
export async function takeSnapshots(q: Q, today: string): Promise<number> {
  const rows = await q.select({ id: capex.id, code: capex.code, status: capex.status, phase: capex.phase, typology: capex.typology, typologyProposed: capex.typologyProposed, openedAt: capex.openedAt })
    .from(capex).where(eq(capex.status, 'active'));
  const week = weekOf(today);
  const dashes = await capexDashboards(q, rows, today);
  for (const [i, c] of rows.entries()) {
    const d = dashes[i];
    const values = {
      status: c.status, phase: c.phase, packPct: d.pack.pct, subsidiaryPackPct: d.pack.subsidiary.pct, epc2iPackPct: d.pack.epc2i.pct,
      bacKeur: d.indicators.bacKeur, pvKeur: d.indicators.pvKeur, evKeur: d.indicators.evKeur, acKeur: d.indicators.acKeur, eacKeur: d.indicators.eacKeur,
      spi: d.indicators.spi, cpi: d.indicators.cpi, alerts: d.alerts.filter((a) => a.level === 'alert').length, takenAt: new Date(),
    };
    await q.insert(capexSnapshots).values({ capexId: c.id, week, ...values }).onConflictDoUpdate({ target: [capexSnapshots.capexId, capexSnapshots.week], set: values });
  }
  return rows.length;
}
