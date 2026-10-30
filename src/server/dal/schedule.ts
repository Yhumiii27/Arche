import 'server-only';
// WBS and Gantt reads (owner's pilot feedback, 24 Oct 2026): the schedule of one CAPEX — its lots with their tasks, the tasks
// of the CAPEX itself, one summary bar per EPC2i project (Keystone, no detail), the cycle milestones — and its summary bar,
// used by the subsidiary and group Gantts. Callers pass a CAPEX already read through the visibility filter.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { epc2iSpan, lotSpan, rollup, type Span } from '@/domain/schedule';
import { capex, capexLots, gates, lotActuals, users, wbsTasks } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { projectsOfMany } from '@/server/integrations/keystone';

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
  return (await schedulesOf(q, [c]))[0];
}

/** scheduleOf for several CAPEX in a fixed number of queries (AR-049). */
export async function schedulesOf(q: Q, cs: readonly { id: string; code: string }[]): Promise<CapexSchedule[]> {
  if (!cs.length) return [];
  const ids = cs.map((c) => c.id);
  const [rows, lots, tasks, gs, projects] = await Promise.all([
    q.select({ id: capex.id, openedAt: capex.openedAt, needDate: capex.needDate, mes: capex.mesStartedOn }).from(capex).where(inArray(capex.id, ids)),
    q.select().from(capexLots).where(inArray(capexLots.capexId, ids)).orderBy(asc(capexLots.number)),
    q.select({ t: wbsTasks, ownerName: users.displayName }).from(wbsTasks).leftJoin(users, eq(users.id, wbsTasks.ownerUserId)).where(inArray(wbsTasks.capexId, ids)).orderBy(asc(wbsTasks.startOn), asc(wbsTasks.number)),
    q.select({ capexId: gates.capexId, code: gates.code, decidedAt: gates.decidedAt, decision: gates.decision }).from(gates).where(and(inArray(gates.capexId, ids), eq(gates.status, 'decided'))),
    projectsOfMany(q, cs.map((c) => c.code)),
  ]);
  const actuals = lots.length ? await q.select().from(lotActuals).where(inArray(lotActuals.lotId, lots.map((l) => l.id))).orderBy(asc(lotActuals.month)) : [];
  const physical = new Map<string, number | null>();
  for (const a of actuals) if (a.physicalPct != null) physical.set(a.lotId, a.physicalPct);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return cs.map((c) => {
    const row = rows.find((r) => r.id === c.id);
    const all: ScheduleTask[] = tasks.filter(({ t }) => t.capexId === c.id).map(({ t, ownerName }) => ({
      id: t.id, number: t.number, lotId: t.lotId, name: t.name, start: t.startOn, end: t.endOn, progressPct: t.progressPct, ownerUserId: t.ownerUserId, ownerName, milestone: t.milestone,
    }));
    const lotRows = lots.filter((l) => l.capexId === c.id).map((l) => {
      const mine = all.filter((x) => x.lotId === l.id);
      return { id: l.id, number: l.number, title: l.title, epc2i: l.epc2i, start: l.plannedStart, end: l.plannedEnd, span: lotSpan({ start: l.plannedStart, end: l.plannedEnd, physicalPct: physical.get(l.id) ?? null }, mine), tasks: mine };
    });
    const general = all.filter((x) => !x.lotId);
    const epc2i = (projects.get(c.code) ?? []).map((p) => ({ code: p.code, name: p.name, span: epc2iSpan(p) }));
    const milestones = [
      ...gs.filter((g) => g.capexId === c.id && g.decidedAt && g.decision !== 'deferred').map((g) => ({ label: g.code, on: day(g.decidedAt)!, done: true })),
      ...(row?.mes ? [{ label: 'MES', on: row.mes, done: true }] : []),
      ...(row?.needDate ? [{ label: 'Need date', on: row.needDate, done: false }] : []),
    ].sort((a, b) => a.on.localeCompare(b.on));
    const spans = [...lotRows.map((l) => l.span), ...general, ...epc2i.map((p) => p.span)].filter((s): s is Span => !!s);
    const r = rollup(spans);
    const opened = day(row?.openedAt ?? null);
    // Without any dated lot or task: from the opening to the need date, when both are known.
    const summary = r ? { ...r, start: opened && opened < r.start ? opened : r.start } : opened && row?.needDate && row.needDate > opened ? { start: opened, end: row.needDate, progressPct: 0 } : null;
    return { lots: lotRows, general, epc2i, milestones, summary };
  });
}

/** One summary bar per CAPEX (subsidiary and group Gantts), with its phase for the colour. */
export async function portfolioSchedule(q: Q, rows: readonly { id: string; code: string }[]) {
  const all = await schedulesOf(q, rows);
  return rows.map((r, i) => ({ id: r.id, code: r.code, summary: all[i].summary }));
}
