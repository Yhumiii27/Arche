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
import { missingAudits, nextReview } from '@/domain/governance';
import { currentGate, type CycleState, type GateCode } from '@/domain/lifecycle';
import { permitsDue } from '@/domain/permits';
import { hsBoard } from '@/domain/safety';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { capex, capexSnapshots, changes, circuitSteps, gateConditions, gates, reviews, risks } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';
import { visibleCapex, type CapexRow } from './capex';
import { modelValues, teamOf } from './cycle';
import { executionOf, hsOf, packOf, permitsOf } from './execution';
import { portfolioOf } from './portfolio';
import { rampupOf } from './rampup';

type Q = DB | Tx;

export async function reviewsOf(q: Q, capexId: string) {
  return q.select().from(reviews).where(eq(reviews.capexId, capexId)).orderBy(desc(reviews.heldOn), desc(reviews.number));
}

type CapexFull = { id: string; code: string; status: string; phase: string; typology: string | null; typologyProposed: string | null; openedAt: Date | null };

/** The dashboard of one CAPEX at `today`. */
export async function capexDashboard(q: Q, c: CapexFull, today: string) {
  const values = await modelValues(q);
  const [exec, revs, team, permits, hs, running, conds, openChanges, openRisks] = await Promise.all([
    executionOf(q, c, today), reviewsOf(q, c.id), teamOf(q, c.id), permitsOf(q, c.id), hsOf(q, c.id),
    q.select().from(gates).where(and(eq(gates.capexId, c.id), eq(gates.status, 'in_review'))),
    q.select({ id: gateConditions.id }).from(gateConditions).innerJoin(gates, eq(gates.id, gateConditions.gateId))
      .where(and(eq(gates.capexId, c.id), isNull(gateConditions.closedOn), lt(gateConditions.dueOn, today))),
    q.select({ id: changes.id }).from(changes).where(and(eq(changes.capexId, c.id), eq(changes.status, 'submitted'))),
    q.select({ p: risks.probability, i: risks.impact }).from(risks).where(and(eq(risks.capexId, c.id), inArray(risks.status, ['open', 'mitigated']))),
  ]);
  const pack = await packOf(q, c, exec.projects);
  const [mes] = await q.select({ on: capex.mesStartedOn }).from(capex).where(eq(capex.id, c.id));
  const startup = await rampupOf(q, { id: c.id, mesStartedOn: mes?.on ?? null }, values, today);
  const session = running[0] ?? null;
  const steps = session ? await q.select().from(circuitSteps).where(and(eq(circuitSteps.gateId, session.id), eq(circuitSteps.status, 'open'))) : [];
  const submittedOn = session ? session.createdAt.toISOString().slice(0, 10) : null;
  const targetOn = session && submittedOn ? addWorkingDays(submittedOn, values.gateDelayDays[session.code as GateCode]) : null;
  const copil = revs.filter((r) => r.kind === 'copil_projet');
  const review = nextReview({ status: c.status, typology: c.typology, openedOn: c.openedAt ? c.openedAt.toISOString().slice(0, 10) : null, lastHeldOn: copil[0]?.heldOn ?? null }, today);
  const audits = missingAudits(c, revs.filter((r) => r.kind === 'audit'));
  const afterG2 = c.phase === 'execution' || c.phase === 'demarrage';
  const measured = exec.indicators.acKeur > 0 || exec.indicators.evKeur > 0;
  const alerts = sortAlerts(alertsOf({
    code: c.code, status: c.status, typologyProposed: c.typologyProposed,
    running: session && submittedOn && targetOn ? { gate: session.code, submittedOn, targetOn } : null,
    openSteps: steps.map((s) => ({ label: s.label, kind: s.kind, dueOn: s.dueOn })),
    review, missingAudits: audits, permitsDue: permitsDue(permits, today),
    indicators: afterG2 && measured ? { spi: exec.indicators.spi, cpi: exec.indicators.cpi, eacKeur: exec.indicators.eacKeur } : null,
    g2Keur: exec.g2Keur, missingStaff: c.status === 'active' ? missingStaff(c.typology as 'light' | 'strategic' | null, team.map((m) => m.capexRole)) : [],
    lateConditions: conds.length,
    rampup: c.phase === 'demarrage' && startup.result.mesStartedOn ? { alertOn: startup.result.alertOn, limitOn: startup.result.limitOn, reached: !!startup.result.reachedOn } : null,
  }, today));
  const board = hsBoard(hs);
  return {
    nextGate: currentGate(c as CycleState),
    running: session ? { gate: session.code as GateCode, session: session.session, submittedOn, targetOn, late: !!targetOn && targetOn < today } : null,
    indicators: exec.indicators, g2Keur: exec.g2Keur, budgetSource: exec.budgetSource, curve: exec.curve, month: exec.month,
    gap: uncertaintyGap({ latestClass: exec.latestClass, nextGate: currentGate(c as CycleState), afterG2, g2Keur: exec.g2Keur, eacKeur: exec.indicators.eacKeur }),
    pack: pack.summary, packThresholdPct: values.packThresholdPct,
    hs: { passed: board.filter((s) => s.status === 'passed' || s.status === 'waived').length, total: board.length, next: board.find((s) => s.status !== 'passed' && s.status !== 'waived') ?? null },
    review, missingAudits: audits, lastReview: revs[0] ?? null,
    openChanges: openChanges.length, majorRisks: openRisks.filter((r) => r.p * r.i >= 9).length, openRisks: openRisks.length,
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
export async function portfolioDashboard(viewer: Viewer, zone: string | null) {
  const db = await getDb();
  const today = await businessToday(db);
  const p = await portfolioOf(viewer, zone);
  const full = new Map((await fullRows(db, p.rows.map((r) => r.id))).map((r) => [r.id, r]));
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 12 * 7 * 86_400_000).toISOString().slice(0, 10);
  const snaps = await snapshotsOf(db, p.rows.map((r) => r.id), since);
  const rows = await Promise.all(p.rows.map(async (r) => ({
    ...r,
    dash: await capexDashboard(db, full.get(r.id)!, today),
    trend: snaps.filter((s) => s.capexId === r.id),
  })));
  return { ...p, rows, today };
}

/** Alerts of the CAPEX the viewer sees (home page). */
export async function alertsForViewer(viewer: Viewer, only?: (c: CapexRow) => boolean): Promise<{ alerts: Alert[]; rows: (CapexRow & { dash: CapexDashboard })[] }> {
  const db = await getDb();
  const today = await businessToday(db);
  const seen = (await visibleCapex(viewer)).filter((c) => (c.status === 'active' || c.status === 'draft') && (!only || only(c)));
  const full = new Map((await fullRows(db, seen.map((c) => c.id))).map((r) => [r.id, r]));
  const rows = await Promise.all(seen.map(async (c) => ({ ...c, dash: await capexDashboard(db, full.get(c.id)!, today) })));
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
  for (const c of rows) {
    const d = await capexDashboard(q, c, today);
    const values = {
      status: c.status, phase: c.phase, packPct: d.pack.pct, subsidiaryPackPct: d.pack.subsidiary.pct, epc2iPackPct: d.pack.epc2i.pct,
      bacKeur: d.indicators.bacKeur, pvKeur: d.indicators.pvKeur, evKeur: d.indicators.evKeur, acKeur: d.indicators.acKeur, eacKeur: d.indicators.eacKeur,
      spi: d.indicators.spi, cpi: d.indicators.cpi, alerts: d.alerts.filter((a) => a.level === 'alert').length, takenAt: new Date(),
    };
    await q.insert(capexSnapshots).values({ capexId: c.id, week, ...values }).onConflictDoUpdate({ target: [capexSnapshots.capexId, capexSnapshots.week], set: values });
  }
  return rows.length;
}
