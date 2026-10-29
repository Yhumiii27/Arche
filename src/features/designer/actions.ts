'use server';
// No-code designer Server Functions (AR-052): the administrator and the group industrial director start a draft of a dossier's
// or a gate circuit's template (from the published version, else the built-in one), change it, discard it or publish it; the
// published version applies to the dossier versions and gate sessions started afterwards. Each one checks the role and the
// input server-side and audits.
import { and, eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { RoleKey } from '@/config/roles';
import { checkCircuitDesign, checkDossierDesign, readDossierDesign } from '@/domain/designer';
import { isDossierKind, type DossierKind } from '@/domain/dossiers';
import { GATES, type GateCode } from '@/domain/lifecycle';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { designs } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { fieldsOf, type ActionResult } from '@/server/capex/write';
import { baseDefinition } from '@/server/dal/designs';
import { getViewer, type Viewer } from '@/server/session';

const DESIGNERS: readonly RoleKey[] = ['admin', 'dir_ig'];
const REFUSED: ActionResult = { ok: false, error: 'This action is reserved to the administrator and the group industrial director' };
const isGate = (v: string): v is GateCode => (GATES as readonly string[]).includes(v);

async function designer(): Promise<Viewer | null> {
  const v = await getViewer();
  return DESIGNERS.includes(v.role) ? v : null;
}
const validTarget = (kind: string, target: string) => (kind === 'dossier' ? isDossierKind(target) : kind === 'circuit' && isGate(target));
const audit = (v: Viewer, kind: string, target: string, change: string, id: string, after?: Record<string, unknown>) => ({
  actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: `${kind === 'dossier' ? 'Dossier' : 'Circuit'} ${target}`, area: 'Designer', change, entityType: 'design', entityId: id, after,
});
const draftOf = async (tx: Tx, kind: 'dossier' | 'circuit', target: string) =>
  (await tx.select().from(designs).where(and(eq(designs.kind, kind), eq(designs.target, target), eq(designs.state, 'draft'))))[0] ?? null;

/** Starts the draft of a target (one at a time), copied from the published version or the built-in definition. */
export async function startDesignAction(kind: string, target: string): Promise<ActionResult> {
  const v = await designer();
  if (!v) return REFUSED;
  if (!validTarget(kind, target)) return { ok: false, error: 'Unknown template' };
  const k = kind as 'dossier' | 'circuit';
  const db = await getDb();
  return db.transaction(async (tx) => {
    if (await draftOf(tx, k, target)) return { ok: false, error: 'A draft of this template already exists' };
    const definition = await baseDefinition(tx, k, target);
    const [{ last }] = await tx.select({ last: max(designs.version) }).from(designs).where(and(eq(designs.kind, k), eq(designs.target, target)));
    const [d] = await tx.insert(designs).values({ kind: k, target, version: (last ?? 0) + 1, definition: definition as never, createdByName: v.name }).returning({ id: designs.id, version: designs.version });
    await writeAudit(tx, audit(v, k, target, `template draft v${d.version} started`, d.id));
    revalidatePath('/admin/designer');
    return { ok: true };
  });
}

/** Saves the draft from the designer's form (src/domain/designer.ts checks). */
export async function saveDesignAction(kind: string, target: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await designer();
  if (!v) return REFUSED;
  if (!validTarget(kind, target)) return { ok: false, error: 'Unknown template' };
  const k = kind as 'dossier' | 'circuit';
  const db = await getDb();
  return db.transaction(async (tx) => {
    const d = await draftOf(tx, k, target);
    if (!d) return { ok: false, error: 'There is no draft of this template' };
    const f = fieldsOf(fd);
    const ch = k === 'dossier' ? checkDossierDesign(target as DossierKind, readDossierDesign(target as DossierKind, d.definition), f) : checkCircuitDesign(target as GateCode, f);
    if (!ch.ok) return ch;
    const note = (f.note ?? '').trim().slice(0, 500) || null;
    await tx.update(designs).set({ definition: ch.value as never, note, updatedAt: new Date() }).where(eq(designs.id, d.id));
    await writeAudit(tx, audit(v, k, target, `template draft v${d.version} changed`, d.id, { ...ch.value }));
    revalidatePath('/admin/designer');
    return { ok: true };
  });
}

/** Publishes the draft: the published version before it is replaced (kept for the versions that follow it). */
export async function publishDesignAction(kind: string, target: string): Promise<ActionResult> {
  const v = await designer();
  if (!v) return REFUSED;
  if (!validTarget(kind, target)) return { ok: false, error: 'Unknown template' };
  const k = kind as 'dossier' | 'circuit';
  const db = await getDb();
  return db.transaction(async (tx) => {
    const d = await draftOf(tx, k, target);
    if (!d) return { ok: false, error: 'There is no draft of this template' };
    // A draft is a copy of a valid definition, changed only through the checks of saveDesignAction.
    await tx.update(designs).set({ state: 'retired', updatedAt: new Date() }).where(and(eq(designs.kind, k), eq(designs.target, target), eq(designs.state, 'published')));
    await tx.update(designs).set({ state: 'published', publishedByName: v.name, publishedAt: new Date(), updatedAt: new Date() }).where(eq(designs.id, d.id));
    await writeAudit(tx, audit(v, k, target, `template v${d.version} published`, d.id));
    revalidatePath('/admin/designer');
    return { ok: true };
  });
}

/** Discards the draft (removed: it never applied to anything). */
export async function discardDesignAction(kind: string, target: string): Promise<ActionResult> {
  const v = await designer();
  if (!v) return REFUSED;
  if (!validTarget(kind, target)) return { ok: false, error: 'Unknown template' };
  const k = kind as 'dossier' | 'circuit';
  const db = await getDb();
  return db.transaction(async (tx) => {
    const d = await draftOf(tx, k, target);
    if (!d) return { ok: false, error: 'There is no draft of this template' };
    await tx.delete(designs).where(eq(designs.id, d.id));
    await writeAudit(tx, audit(v, k, target, `template draft v${d.version} discarded`, d.id));
    revalidatePath('/admin/designer');
    return { ok: true };
  });
}
