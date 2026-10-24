import 'server-only';
// WBS and Gantt reads (owner's pilot feedback, 24 Oct 2026): the schedule of one CAPEX — its lots with their tasks, the tasks
// of the CAPEX itself, one summary bar per EPC2i project (Keystone, no detail), the cycle milestones — and its summary bar,
// used by the subsidiary and group Gantts. Callers pass a CAPEX already read through the visibility filter.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { epc2iSpan, lotSpan, rollup, type Span } from '@/domain/schedule';
import { capex, capexLots, gates, lotActuals, users, wbsTasks } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { projectsOf } from '@/server/integrations/keystone';

type Q = DB | Tx;

export interface ScheduleTask extends Span {
  id: string;
  number: number;
  lotId: string | null;
  name: string;
  ownerUserId: string | null;
  ownerName: string | null;
  milestone: boolean;
}

export interface CapexSchedule {
  lots: { id: string; number: number; title: string; epc2i: boolean; start: string | null; end: string | null; span: Span | null; tasks: ScheduleTask[] }[];
  /** Tasks of the CAPEX itself (no lot). */
  general: ScheduleTask[];
  epc2i: { code: string; name: string; span: Span | null }[];
  /** Cycle milestones: gates decided, start of commissioning, need date. */
  milestones: { label: string; on: string; done: boolean }[];
  /** The CAPEX as one bar (subsidiary and group Gantts). */
  summary: Span | null;
}

export async function scheduleOf(q: Q, c: { id: string; code: string }): Promise<CapexSchedule> {
  const [row] = await q.select({ openedAt: capex.openedAt, needDate: capex.needDate, mes: capex.mesStartedOn }).from(capex).where(eq(capex.id, c.id));
  const [lots, tasks, gs, projects] = await Promise.all([
    q.select().from(capexLots).where(eq(capexLots.capexId, c.id)).orderBy(asc(capexLots.number)),
    q.select({ t: wbsTasks, ownerName: users.displayName }).from(wbsTasks).leftJoin(users, eq(users.id, wbsTasks.ownerUserId)).where(eq(wbsTasks.capexId, c.id)).orderBy(asc(wbsTasks.startOn), asc(wbsTasks.number)),
    q.select({ code: gates.code, decidedAt: gates.decidedAt, decision: gates.decision }).from(gates).where(and(eq(gates.capexId, c.id), eq(gates.status, 'decided'))),
    projectsOf(q, c.code),
  ]);
  const actuals = lots.length ? await q.select().from(lotActuals).where(inArray(lotActuals.lotId, lots.map((l) => l.id))).orderBy(asc(lotActuals.month)) : [];
  const physical = new Map<string, number | null>();
  for (const a of actuals) if (a.physicalPct != null) physical.set(a.lotId, a.physicalPct);
  const all: ScheduleTask[] = tasks.map(({ t, ownerName }) => ({
    id: t.id, number: t.number, lotId: t.lotId, name: t.name, start: t.startOn, end: t.endOn, progressPct: t.progressPct, ownerUserId: t.ownerUserId, ownerName, milestone: t.milestone,
  }));
  const lotRows = lots.map((l) => {
    const mine = all.filter((x) => x.lotId === l.id);
    return { id: l.id, number: l.number, title: l.title, epc2i: l.epc2i, start: l.plannedStart, end: l.plannedEnd, span: lotSpan({ start: l.plannedStart, end: l.plannedEnd, physicalPct: physical.get(l.id) ?? null }, mine), tasks: mine };
  });
  const general = all.filter((x) => !x.lotId);
  const epc2i = projects.map((p) => ({ code: p.code, name: p.name, span: epc2iSpan(p) }));
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const milestones = [
    ...gs.filter((g) => g.decidedAt && g.decision !== 'deferred').map((g) => ({ label: g.code, on: day(g.decidedAt)!, done: true })),
    ...(row?.mes ? [{ label: 'MES', on: row.mes, done: true }] : []),
    ...(row?.needDate ? [{ label: 'Need date', on: row.needDate, done: false }] : []),
  ].sort((a, b) => a.on.localeCompare(b.on));
  const spans = [...lotRows.map((l) => l.span), ...general, ...epc2i.map((p) => p.span)].filter((s): s is Span => !!s);
  const r = rollup(spans);
  const opened = day(row?.openedAt ?? null);
  // Without any dated lot or task: from the opening to the need date, when both are known.
  const summary = r ? { ...r, start: opened && opened < r.start ? opened : r.start } : opened && row?.needDate && row.needDate > opened ? { start: opened, end: row.needDate, progressPct: 0 } : null;
  return { lots: lotRows, general, epc2i, milestones, summary };
}

/** One summary bar per CAPEX (subsidiary and group Gantts), with its phase for the colour. */
export async function portfolioSchedule(q: Q, rows: readonly { id: string; code: string }[]) {
  return Promise.all(rows.map(async (r) => ({ id: r.id, code: r.code, summary: (await scheduleOf(q, r)).summary })));
}
