'use server';
// Absences (AR-041): a person declares an absence and names a delegate — an active person of the business — who receives their
// circuit notifications and may act on their steps over the days (reading the CAPEX of those steps while they wait); they may
// end it early (the row is kept). Each one validates its input server-side and audits.
import { and, eq, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkAbsence } from '@/domain/notify';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { absences } from '@/server/db/schema';
import { fieldsOf, type ActionResult } from '@/server/capex/write';
import { getUserAccount } from '@/server/dal/users';
import { getViewer } from '@/server/session';

export async function declareAbsenceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  const db = await getDb();
  const today = await businessToday(db);
  const f = fieldsOf(fd);
  const delegate = f.delegateUserId ? await getUserAccount(f.delegateUserId, today, db) : null;
  if (f.delegateUserId && (!delegate || !delegate.active || !delegate.roles.some((r) => r !== 'admin')))
    return { ok: false, error: 'Choose an active person of the business as delegate' };
  const others = await db.select().from(absences).where(or(eq(absences.userId, v.userId), eq(absences.userId, f.delegateUserId || v.userId)));
  const ch = checkAbsence(f, v.userId, today, others);
  if (!ch.ok) return ch;
  await db.transaction(async (tx) => {
    const [a] = await tx.insert(absences).values({ userId: v.userId, ...ch.value, createdByName: v.name }).returning({ id: absences.id });
    await writeAudit(tx, {
      actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: v.name, area: 'Absences', entityType: 'absence', entityId: a.id,
      change: `absence from ${ch.value.fromOn} to ${ch.value.toOn}, delegate ${delegate!.displayName}`, after: { ...ch.value },
    });
  });
  revalidatePath('/my/approvals');
  return { ok: true };
}

/** Ends one's own absence (now, or before it starts). */
export async function endAbsenceAction(id: string): Promise<ActionResult> {
  const v = await getViewer();
  const db = await getDb();
  const [a] = await db.select().from(absences).where(and(eq(absences.id, id), eq(absences.userId, v.userId)));
  if (!a || a.cancelledAt) return { ok: false, error: 'Unknown absence' };
  await db.transaction(async (tx) => {
    await tx.update(absences).set({ cancelledAt: new Date() }).where(eq(absences.id, a.id));
    await writeAudit(tx, { actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: v.name, area: 'Absences', entityType: 'absence', entityId: a.id, change: `absence from ${a.fromOn} to ${a.toOn} ended` });
  });
  revalidatePath('/my/approvals');
  return { ok: true };
}
