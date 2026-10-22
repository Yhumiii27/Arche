import 'server-only';
// Reads of the machine needs of a CAPEX (docs/spec/07 §1). Callers have checked the CAPEX's visibility.
import { asc, eq } from 'drizzle-orm';
import { needRef } from '@/domain/needs';
import { machineNeeds } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

export async function needsOf(q: DB | Tx, c: { id: string; code: string }) {
  const rows = await q.select().from(machineNeeds).where(eq(machineNeeds.capexId, c.id)).orderBy(asc(machineNeeds.number));
  return rows.map((n) => ({ ...n, ref: needRef(c.code, n.number) }));
}

export type NeedRow = Awaited<ReturnType<typeof needsOf>>[number];
