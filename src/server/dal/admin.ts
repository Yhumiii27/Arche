import 'server-only';
// Administration reads (docs/spec/08): organisation reference data and user accounts with their role assignments. The pages
// check the screen access first (administrator; group CFO for the organisation).
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { referenceRevenues, roleAssignments, sites, subsidiaries, users, zones } from '@/server/db/schema';

export async function organisation() {
  const db = await getDb();
  const [z, s, si, rev] = await Promise.all([
    db.select().from(zones).orderBy(asc(zones.code)),
    db.select().from(subsidiaries).orderBy(asc(subsidiaries.code)),
    db.select().from(sites).orderBy(asc(sites.subsidiaryCode), asc(sites.name)),
    db.select().from(referenceRevenues).orderBy(asc(referenceRevenues.subsidiaryCode), asc(referenceRevenues.fiscalYear)),
  ]);
  return { zones: z, subsidiaries: s, sites: si, revenues: rev };
}

export async function usersWithAssignments() {
  const db = await getDb();
  const [u, a] = await Promise.all([
    db.select().from(users).orderBy(asc(users.displayName)),
    db.select({ userId: roleAssignments.userId, role: roleAssignments.role, scopeKind: roleAssignments.scopeKind, scopeRef: roleAssignments.scopeRef, speciality: roleAssignments.speciality })
      .from(roleAssignments).innerJoin(users, eq(users.id, roleAssignments.userId)).orderBy(asc(roleAssignments.role)),
  ]);
  return u.map((x) => ({ ...x, assignments: a.filter((y) => y.userId === x.id) }));
}
