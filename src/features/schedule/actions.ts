'use server';
// WBS Server Functions (owner's pilot feedback, 24 Oct 2026): add, edit or remove a task of the CAPEX (right `schedule`: the
// project lead, the sponsor and the Co-DIG). Each one reads the CAPEX through the viewer's visibility inside its transaction,
// validates its input with src/domain/schedule.ts and audits the change.
import { and, eq } from 'drizzle-orm';
import { nextNumber, refOf } from '@/domain/capex';
import { checkTask } from '@/domain/schedule';
import { writeAudit } from '@/server/db/helpers';
import { capexLots, wbsTasks } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, type ActionResult } from '@/server/capex/write';
import { actionPeople } from '@/server/dal/actions';

export async function saveTaskAction(code: string, taskId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'schedule', async (tx, c, v) => {
    const lots = new Set((await tx.select({ id: capexLots.id }).from(capexLots).where(eq(capexLots.capexId, c.id))).map((l) => l.id));
    const people = new Set((await actionPeople(tx, c)).map((p) => p.value));
    const ch = checkTask(fieldsOf(fd), { lots, people });
    if (!ch.ok) return ch;
    if (taskId) {
      const [x] = await tx.select().from(wbsTasks).where(and(eq(wbsTasks.id, taskId), eq(wbsTasks.capexId, c.id)));
      if (!x) return { ok: false, error: 'Unknown task' };
      await tx.update(wbsTasks).set({ ...ch.value, updatedByName: v.name, updatedAt: new Date() }).where(eq(wbsTasks.id, x.id));
      await writeAudit(tx, auditOf(v, c, `WBS task ${refOf('T', x.number)} updated`, { entityType: 'wbs_task', entityId: x.id, before: { startOn: x.startOn, endOn: x.endOn, progressPct: x.progressPct }, after: { ...ch.value } }));
      return { ok: true };
    }
    const number = nextNumber((await tx.select({ n: wbsTasks.number }).from(wbsTasks).where(eq(wbsTasks.capexId, c.id))).map((x) => x.n));
    const [x] = await tx.insert(wbsTasks).values({ capexId: c.id, number, ...ch.value, updatedByName: v.name }).returning({ id: wbsTasks.id });
    await writeAudit(tx, auditOf(v, c, `WBS task ${refOf('T', number)} added: ${ch.value.name}`, { entityType: 'wbs_task', entityId: x.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

export async function deleteTaskAction(code: string, taskId: string): Promise<ActionResult> {
  return onCapex(code, 'schedule', async (tx, c, v) => {
    const [x] = await tx.select().from(wbsTasks).where(and(eq(wbsTasks.id, taskId), eq(wbsTasks.capexId, c.id)));
    if (!x) return { ok: false, error: 'Unknown task' };
    await tx.delete(wbsTasks).where(eq(wbsTasks.id, x.id));
    await writeAudit(tx, auditOf(v, c, `WBS task ${refOf('T', x.number)} removed: ${x.name}`, { entityType: 'wbs_task', entityId: x.id, before: { name: x.name, startOn: x.startOn, endOn: x.endOn } }));
    return { ok: true };
  });
}
