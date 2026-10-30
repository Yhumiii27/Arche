import 'server-only';
// Action plan reads (owner's pilot feedback, 24 Oct 2026): the actions of a CAPEX with their owner, the people who may own one,
// and "my actions" across the CAPEX the viewer sees (Home). Every CAPEX read goes through the visibility filter.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { capexActions, users } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';
import { visibleCapex } from './capex';
import { teamOf } from './cycle';

type Q = DB | Tx;

export async function actionsOf(q: Q, capexId: string) {
  return q
    .select({ a: capexActions, ownerName: users.displayName })
    .from(capexActions)
    .leftJoin(users, eq(users.id, capexActions.ownerUserId))
    .where(eq(capexActions.capexId, capexId))
    .orderBy(asc(capexActions.number))
    .then((rows) => rows.map((r) => ({ ...r.a, ownerName: r.ownerName })));
}

/** People who may own an action: the named team, the sponsor and the project lead. */
export async function actionPeople(q: Q, c: { id: string; sponsorUserId: string | null; leadUserId: string | null }): Promise<{ value: string; label: string }[]> {
  const team = await teamOf(q, c.id);
  const ids = [...new Set([...team.map((m) => m.userId), c.sponsorUserId, c.leadUserId].filter((x): x is string => !!x))];
  if (!ids.length) return [];
  const rows = await q.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, ids)).orderBy(asc(users.displayName));
  return rows.map((u) => ({ value: u.id, label: u.name }));
}

/** The open actions the viewer owns, on the CAPEX they see. */
export async function myActions(viewer: Viewer) {
  const seen = await visibleCapex(viewer);
  if (!seen.length) return [];
  const byId = new Map(seen.map((c) => [c.id, c]));
  const rows = await (await getDb()).select().from(capexActions)
    .where(and(inArray(capexActions.capexId, seen.map((c) => c.id)), eq(capexActions.ownerUserId, viewer.userId), eq(capexActions.status, 'open')))
    .orderBy(asc(capexActions.dueOn), asc(capexActions.number));
  return rows.map((a) => ({ ...a, capex: byId.get(a.capexId)! }));
}
