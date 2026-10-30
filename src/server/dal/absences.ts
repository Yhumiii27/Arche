import 'server-only';
// Absences and stand-ins (AR-041): the absences a person declared and those where they are the delegate; the absent people a
// viewer stands in for today, with their roles, so that the viewer may act on their circuit steps (signed in the viewer's own
// name, "on behalf of" the absent person).
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { StepActor } from '@/domain/circuits';
import { absentOn, personCanAct } from '@/domain/notify';
import { absences, capex, capexMembers, circuitSteps, gates, users } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { getUserAccount, type UserAccount } from './users';

type Q = DB | Tx;

/** A person's absences and the ones they cover as delegate, newest first, with the names. */
export async function absencesOf(q: Q, userId: string) {
  const rows = await q.select().from(absences).where(or(eq(absences.userId, userId), eq(absences.delegateUserId, userId))).orderBy(desc(absences.fromOn));
  const ids = [...new Set(rows.flatMap((r) => [r.userId, r.delegateUserId]))];
  const names = ids.length ? await q.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, ids)) : [];
  const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? '—';
  return rows.map((r) => ({ ...r, userName: nameOf(r.userId), delegateName: nameOf(r.delegateUserId) }));
}

export interface StandIn {
  absenceId: string;
  person: UserAccount;
  /** CAPEX where the absent person is the named internal client. */
  internalClientOf: Set<string>;
}

/** The absent people the user stands in for on `today`. */
export async function standInsOf(q: Q, userId: string, today: string): Promise<StandIn[]> {
  const rows = (await q.select().from(absences).where(eq(absences.delegateUserId, userId))).filter((a) => absentOn(a, today));
  const out: StandIn[] = [];
  for (const a of rows) {
    const person = await getUserAccount(a.userId, today, q);
    if (!person || !person.active) continue;
    const clientOf = await q.select({ capexId: capexMembers.capexId }).from(capexMembers).where(and(eq(capexMembers.userId, a.userId), eq(capexMembers.capexRole, 'internal_client')));
    out.push({ absenceId: a.id, person, internalClientOf: new Set(clientOf.map((m) => m.capexId)) });
  }
  return out;
}

/** The absent person, if any, the user may act for on this step (the user's own right is checked first by the caller). */
export function standInFor(
  step: { actor: string; speciality: string | null; assigneeUserId: string | null },
  c: { id: string; code: string; subsidiaryCode: string; status: string },
  standIns: readonly StandIn[],
): StandIn | null {
  const s = { actor: step.actor as StepActor, speciality: step.speciality, assigneeUserId: step.assigneeUserId };
  return standIns.find((x) => personCanAct(s, x.person, c, x.internalClientOf.has(c.id))) ?? null;
}

/** The CAPEX (ids) with an open step of a running circuit the user may act on for an absent person: the delegate reads them
 * while the step is open, whatever their own visibility (src/server/dal/capex.ts). */
export async function standInCapexIds(q: Q, userId: string, today: string): Promise<string[]> {
  const standIns = await standInsOf(q, userId, today);
  if (!standIns.length) return [];
  const rows = await q.select({ s: circuitSteps, c: { id: capex.id, code: capex.code, subsidiaryCode: capex.subsidiaryCode, status: capex.status } })
    .from(circuitSteps).innerJoin(gates, eq(gates.id, circuitSteps.gateId)).innerJoin(capex, eq(capex.id, gates.capexId))
    .where(and(eq(gates.status, 'in_review'), eq(circuitSteps.status, 'open')));
  return [...new Set(rows.filter((r) => standInFor(r.s, r.c, standIns)).map((r) => r.c.id))];
}
