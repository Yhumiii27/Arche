'use server';
// Pilot Server Functions (C-10): the reference of an indicator measured on the existing process, entered by the group
// industrial director. Checked server-side (role, key, value), written, audited (area "Administration") and revalidated.
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkBaseline, isKpiKey } from '@/domain/kpi';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { kpiBaselines } from '@/server/db/schema';
import { getViewer } from '@/server/session';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveBaselineAction(key: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (v.role !== 'dir_ig') return { ok: false, error: 'Reserved to the group industrial director' };
  if (!isKpiKey(key)) return { ok: false, error: 'Unknown indicator' };
  const db = await getDb();
  const today = await businessToday(db);
  const ch = checkBaseline(key, Object.fromEntries([...fd.entries()].map(([k, x]) => [k, typeof x === 'string' ? x : ''])), today);
  if (!ch.ok) return ch;
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(kpiBaselines).where(eq(kpiBaselines.key, key));
    const values = { ...ch.value, enteredByName: v.name, updatedAt: new Date() };
    if (before) await tx.update(kpiBaselines).set(values).where(eq(kpiBaselines.key, key));
    else await tx.insert(kpiBaselines).values({ key, ...values });
    await writeAudit(tx, {
      actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: `Indicator ${key}`, change: `reference: ${before ? `${before.value} → ` : ''}${ch.value.value}`,
      area: 'Administration', entityType: 'kpi_baseline', before: before ? { value: before.value, source: before.source, measuredOn: before.measuredOn } : undefined, after: { ...ch.value },
    });
  });
  revalidatePath('/kpi');
  return { ok: true };
}
