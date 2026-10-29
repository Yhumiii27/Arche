import 'server-only';
// Ideas backlog reads (AR-051): the subsidiaries a person covers — every one for a group-wide assignment, those of their zones,
// their subsidiaries, the subsidiaries of the CAPEX they are named on, their own — and the ideas of those subsidiaries.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { capex, ideas, subsidiaries } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import type { Viewer } from '@/server/viewer';

type Q = DB | Tx;

/** The subsidiaries (codes) where the viewer sees and proposes ideas. */
export async function ideaSubsidiaries(q: Q, v: Viewer): Promise<string[]> {
  const subs = await q.select({ code: subsidiaries.code, zoneCode: subsidiaries.zoneCode }).from(subsidiaries).orderBy(asc(subsidiaries.code));
  if (v.assignments.some((a) => a.scopeKind === 'group')) return subs.map((s) => s.code);
  const out = new Set<string>(v.subsidiaryCode ? [v.subsidiaryCode] : []);
  for (const a of v.assignments) {
    if (a.scopeKind === 'subsidiary' && a.scopeRef) out.add(a.scopeRef);
    if (a.scopeKind === 'zone') subs.filter((s) => s.zoneCode === a.scopeRef).forEach((s) => out.add(s.code));
  }
  const codes = v.assignments.filter((a) => a.scopeKind === 'capex' && a.scopeRef).map((a) => a.scopeRef!);
  if (codes.length) (await q.select({ sub: capex.subsidiaryCode }).from(capex).where(inArray(capex.code, codes))).forEach((c) => out.add(c.sub));
  return subs.filter((s) => out.has(s.code)).map((s) => s.code);
}

/** The ideas of these subsidiaries (newest first), with the zone of their subsidiary and the code of the CAPEX they became. */
export async function ideasOf(q: Q, subs: readonly string[]) {
  if (!subs.length) return [];
  const rows = await q.select({ i: ideas, zoneCode: subsidiaries.zoneCode, capexCode: capex.code })
    .from(ideas).innerJoin(subsidiaries, eq(subsidiaries.code, ideas.subsidiaryCode)).leftJoin(capex, eq(capex.id, ideas.capexId))
    .where(inArray(ideas.subsidiaryCode, [...subs])).orderBy(desc(ideas.createdAt));
  return rows.map((r) => ({ ...r.i, zoneCode: r.zoneCode, capexCode: r.capexCode }));
}

/** One idea with the zone of its subsidiary. */
export async function ideaById(q: Q, id: string) {
  const [r] = await q.select({ i: ideas, zoneCode: subsidiaries.zoneCode }).from(ideas).innerJoin(subsidiaries, eq(subsidiaries.code, ideas.subsidiaryCode)).where(and(eq(ideas.id, id)));
  return r ? { ...r.i, zoneCode: r.zoneCode } : null;
}
