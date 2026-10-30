'use server';
// Action plan Server Functions (owner's pilot feedback, 24 Oct 2026): open or edit an action (right `actions`: the project
// lead, the sponsor, the controller, the Co-DIG, the EPC2i PMO and the group industrial director), close it as done or
// cancelled (the same, or the owner of the action). Each one reads the CAPEX through the viewer's visibility inside its
// transaction, validates its input with src/domain/actions.ts and audits the change.
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkAction, checkClosing, type ActionStatus } from '@/domain/actions';
import { canDo, nextNumber, refOf } from '@/domain/capex';
import { writeAudit } from '@/server/db/helpers';
import { capexActions } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, REFUSED, type ActionResult } from '@/server/capex/write';
import { actionPeople } from '@/server/dal/actions';

export async function saveActionAction(code: string, actionId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const r = await onCapex(code, 'actions', async (tx, c, v) => {
    const people = new Set((await actionPeople(tx, c)).map((p) => p.value));
    const ch = checkAction(fieldsOf(fd), { people });
    if (!ch.ok) return ch;
    if (actionId) {
      const [a] = await tx.select().from(capexActions).where(and(eq(capexActions.id, actionId), eq(capexActions.capexId, c.id)));
      if (!a) return { ok: false, error: 'Unknown action' };
      if (a.status !== 'open') return { ok: false, error: 'This action is already closed' };
      await tx.update(capexActions).set({ ...ch.value, updatedAt: new Date() }).where(eq(capexActions.id, a.id));
      await writeAudit(tx, auditOf(v, c, `action ${refOf('A', a.number)} updated`, { entityType: 'capex_action', entityId: a.id, before: { title: a.title, ownerUserId: a.ownerUserId, dueOn: a.dueOn }, after: { ...ch.value } }));
      return { ok: true };
    }
    const number = nextNumber((await tx.select({ n: capexActions.number }).from(capexActions).where(eq(capexActions.capexId, c.id))).map((x) => x.n));
    const [a] = await tx.insert(capexActions).values({ capexId: c.id, number, ...ch.value, createdByName: v.name }).returning({ id: capexActions.id });
    await writeAudit(tx, auditOf(v, c, `action ${refOf('A', number)} opened: ${ch.value.title}`, { entityType: 'capex_action', entityId: a.id, after: { ...ch.value } }));
    return { ok: true };
  });
  // "My actions" on Home.
  if (r.ok) revalidatePath('/');
  return r;
}

export async function closeActionAction(code: string, actionId: string, outcome: 'done' | 'cancelled', note: string): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v, today) => {
    const [a] = await tx.select().from(capexActions).where(and(eq(capexActions.id, actionId), eq(capexActions.capexId, c.id)));
    if (!a) return { ok: false, error: 'Unknown action' };
    if (!canDo('actions', v.role, v.assignments, c) && a.ownerUserId !== v.userId) return REFUSED;
    const ch = checkClosing({ status: a.status as ActionStatus }, outcome, note);
    if (!ch.ok) return ch;
    await tx.update(capexActions).set({ status: ch.value.status, closedOn: today, closingNote: ch.value.note, updatedAt: new Date() }).where(eq(capexActions.id, a.id));
    await writeAudit(tx, auditOf(v, c, `action ${refOf('A', a.number)}: Open → ${ch.value.status === 'done' ? 'Done' : 'Cancelled'}`, { entityType: 'capex_action', entityId: a.id, reason: ch.value.note }));
    return { ok: true };
  });
}
