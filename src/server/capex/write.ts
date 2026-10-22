import 'server-only';
// What every CAPEX Server Function shares (src/features/*/actions.ts): the result shape, the audit row of a CAPEX change, the
// revalidation of the CAPEX pages, and `onCapex` — the CAPEX read through the viewer's visibility (outside it: "not found"),
// re-read inside the write transaction, with the right of the active role checked there (src/domain/capex.ts).
import { revalidatePath } from 'next/cache';
import { canDo, type CapexAction } from '@/domain/capex';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import type { Tx } from '@/server/db/types';
import { capexForViewer } from '@/server/dal/capex';
import { capexRow } from '@/server/dal/cycle';
import { getViewer, type Viewer } from '@/server/session';

export type ActionResult = { ok: true; code?: string } | { ok: false; error: string };
export type CapexRowFull = NonNullable<Awaited<ReturnType<typeof capexRow>>>;

export const fieldsOf = (fd: FormData) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
export const NOT_FOUND: ActionResult = { ok: false, error: 'CAPEX not found' };
export const REFUSED_MSG = 'You cannot do this on this CAPEX';
export const REFUSED: ActionResult = { ok: false, error: REFUSED_MSG };

export function auditOf(
  v: { name: string; userId: string; role: string }, c: { id: string; code: string }, change: string,
  extra: { entityType?: string; entityId?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string | null } = {},
) {
  return { actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: c.code, change, area: 'CAPEX', capexId: c.id, ...extra };
}

export const revalidateCapex = (code: string) => {
  revalidatePath('/capex');
  revalidatePath('/my/approvals');
  revalidatePath(`/capex/${code}`, 'layout');
};

/**
 * Runs `work` on the CAPEX `code` when the viewer sees it and may do `action` on it (null: the work checks its own right). The
 * CAPEX row is read again inside the transaction (behind the write lock), so the state the right was checked on is the one
 * written over.
 */
export async function onCapex(code: string, action: CapexAction | null, work: (tx: Tx, c: CapexRowFull, v: Viewer, today: string) => Promise<ActionResult>): Promise<ActionResult> {
  const v = await getViewer();
  const seen = await capexForViewer(v, code);
  if (!seen) return NOT_FOUND;
  const db = await getDb();
  const today = await businessToday();
  const r = await db.transaction(async (tx) => {
    const c = await capexRow(tx, seen.id);
    if (!c) return NOT_FOUND;
    if (action && !canDo(action, v.role, v.assignments, c)) return REFUSED;
    return work(tx, c, v, today);
  });
  if (r.ok) revalidateCapex(code);
  return r;
}
