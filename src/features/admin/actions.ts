'use server';
// Administration Server Functions (docs/spec/01 §3, 08): accounts, role assignments, zones, subsidiaries, sites — the
// administrator only; reference revenue — the group CFO or the administrator. Each one checks the viewer's active role
// server-side, validates its input with the pure rules of src/domain/admin.ts inside its transaction, writes, audits and
// revalidates the page.
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { RoleKey } from '@/config/roles';
import { checkMatrix } from '@/domain/delegation';
import { checkModelValues, MODEL_CODE, MODEL_VERSION } from '@/domain/lifecycle';
import { checkAssignment, checkRevenue, checkSite, checkSubsidiary, checkUser, checkZone, selfLockout } from '@/domain/admin';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { capex, delegationMatrices, lifecycleModels, referenceRevenues, roleAssignments, sites, subsidiaries, users, zones } from '@/server/db/schema';
import { getViewer, type Viewer } from '@/server/session';

export type ActionResult = { ok: true } | { ok: false; error: string };

const fieldsOf = (fd: FormData) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
const audit = (v: Viewer, objectRef: string, change: string, extra: { entityType?: string; entityId?: string; after?: Record<string, unknown>; before?: Record<string, unknown> } = {}) => ({
  actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef, change, area: 'Administration', ...extra,
});

async function asRole(allowed: readonly RoleKey[]): Promise<Viewer | null> {
  const v = await getViewer();
  return allowed.includes(v.role) ? v : null;
}
const REFUSED: ActionResult = { ok: false, error: 'This action is reserved to the administrator' };

export async function createUserAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const taken = new Set((await tx.select({ e: users.email }).from(users)).map((x) => x.e));
    const subs = new Set((await tx.select({ c: subsidiaries.code }).from(subsidiaries)).map((x) => x.c));
    const c = checkUser(fieldsOf(fd), { takenEmails: taken, subsidiaries: subs });
    if (!c.ok) return c;
    const [u] = await tx.insert(users).values(c.value).returning({ id: users.id });
    await writeAudit(tx, audit(v, `User ${c.value.email}`, 'account created', { entityType: 'user', entityId: u.id, after: { ...c.value } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/users');
  return r;
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const lock = selfLockout({ actorUserId: v.userId, targetUserId: userId, actorAdminRoles: 0, deactivating: !active });
  if (lock) return { ok: false, error: lock };
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (!u) return { ok: false, error: 'Unknown account' };
    if (u.active === active) return { ok: true };
    await tx.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, userId));
    await writeAudit(tx, audit(v, `User ${u.email}`, active ? 'account reactivated' : 'account deactivated', { entityType: 'user', entityId: u.id }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/users');
  return r;
}

export async function addRoleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const userId = String(fd.get('userId') ?? '');
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (!u) return { ok: false, error: 'Unknown account' };
    const [z, s, cx, held] = await Promise.all([
      tx.select({ c: zones.code }).from(zones), tx.select({ c: subsidiaries.code }).from(subsidiaries), tx.select({ c: capex.code }).from(capex),
      tx.select({ role: roleAssignments.role, scopeRef: roleAssignments.scopeRef }).from(roleAssignments).where(eq(roleAssignments.userId, userId)),
    ]);
    const c = checkAssignment(fieldsOf(fd), { zones: new Set(z.map((x) => x.c)), subsidiaries: new Set(s.map((x) => x.c)), capex: new Set(cx.map((x) => x.c)), held });
    if (!c.ok) return c;
    const [a] = await tx.insert(roleAssignments).values({ userId, ...c.value, createdByName: v.name }).returning({ id: roleAssignments.id });
    await writeAudit(tx, audit(v, `User ${u.email}`, `role added: ${c.value.role}${c.value.scopeRef ? ` · ${c.value.scopeRef}` : ''}`, { entityType: 'role_assignment', entityId: a.id, after: { ...c.value } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/users');
  return r;
}

export async function removeRoleAction(assignmentId: string): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [a] = await tx.select().from(roleAssignments).where(eq(roleAssignments.id, assignmentId));
    if (!a) return { ok: false, error: 'Unknown role assignment' };
    const mine = await tx.select({ id: roleAssignments.id }).from(roleAssignments).where(and(eq(roleAssignments.userId, v.userId), eq(roleAssignments.role, 'admin')));
    const lock = selfLockout({ actorUserId: v.userId, targetUserId: a.userId, removingRole: a.role, actorAdminRoles: mine.length });
    if (lock) return { ok: false, error: lock };
    const [u] = await tx.select({ email: users.email }).from(users).where(eq(users.id, a.userId));
    await tx.delete(roleAssignments).where(eq(roleAssignments.id, assignmentId));
    await writeAudit(tx, audit(v, `User ${u.email}`, `role removed: ${a.role}${a.scopeRef ? ` · ${a.scopeRef}` : ''}`, { entityType: 'role_assignment', entityId: a.id, before: { role: a.role, scopeKind: a.scopeKind, scopeRef: a.scopeRef } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/users');
  return r;
}

export async function createZoneAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const c = checkZone(fieldsOf(fd), new Set((await tx.select({ c: zones.code }).from(zones)).map((x) => x.c)));
    if (!c.ok) return c;
    await tx.insert(zones).values(c.value);
    await writeAudit(tx, audit(v, `Zone ${c.value.code}`, 'zone created', { after: c.value }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/organisation');
  return r;
}

export async function createSubsidiaryAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const c = checkSubsidiary(fieldsOf(fd), {
      zones: new Set((await tx.select({ c: zones.code }).from(zones)).map((x) => x.c)),
      taken: new Set((await tx.select({ c: subsidiaries.code }).from(subsidiaries)).map((x) => x.c)),
    });
    if (!c.ok) return c;
    await tx.insert(subsidiaries).values(c.value);
    await writeAudit(tx, audit(v, `Subsidiary ${c.value.code}`, 'subsidiary created', { after: { ...c.value } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/organisation');
  return r;
}

export async function createSiteAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const subs = new Map((await tx.select({ c: subsidiaries.code, iso: subsidiaries.countryIso2 }).from(subsidiaries)).map((x) => [x.c, x.iso]));
    const names = new Set((await tx.select({ s: sites.subsidiaryCode, n: sites.name }).from(sites)).map((x) => `${x.s}|${x.n.toLowerCase()}`));
    const c = checkSite(fieldsOf(fd), { subsidiaries: subs, takenNames: names });
    if (!c.ok) return c;
    const [s] = await tx.insert(sites).values(c.value).returning({ id: sites.id });
    await writeAudit(tx, audit(v, `Site ${c.value.subsidiaryCode} · ${c.value.name}`, 'site created', { entityType: 'site', entityId: s.id, after: { ...c.value } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/organisation');
  return r;
}

export async function setRevenueAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['group_cfo', 'admin']);
  if (!v) return { ok: false, error: 'This action is reserved to the group CFO' };
  const db = await getDb();
  const today = await businessToday();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const c = checkRevenue(fieldsOf(fd), { subsidiaries: new Set((await tx.select({ c: subsidiaries.code }).from(subsidiaries)).map((x) => x.c)), today });
    if (!c.ok) return c;
    const [before] = await tx.select().from(referenceRevenues).where(and(eq(referenceRevenues.subsidiaryCode, c.value.subsidiaryCode), eq(referenceRevenues.fiscalYear, c.value.fiscalYear)));
    const row = { ...c.value, enteredByName: v.name, enteredAt: new Date() };
    await tx.insert(referenceRevenues).values(row).onConflictDoUpdate({ target: [referenceRevenues.subsidiaryCode, referenceRevenues.fiscalYear], set: row });
    await writeAudit(tx, audit(v, `Reference revenue ${c.value.subsidiaryCode} ${c.value.fiscalYear}`, before ? `revenue: ${before.revenueKeur} → ${c.value.revenueKeur} k€` : `revenue: ${c.value.revenueKeur} k€`, {
      before: before ? { revenueKeur: before.revenueKeur } : undefined, after: { revenueKeur: c.value.revenueKeur },
    }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/organisation');
  return r;
}

/** Values of the DIG-PRODI 4.0 model (spec 03 header): delays and thresholds, the administrator only; the structure is code. */
export async function updateModelValuesAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const c = checkModelValues(fieldsOf(fd));
  if (!c.ok) return c;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [before] = await tx.select().from(lifecycleModels).where(and(eq(lifecycleModels.code, MODEL_CODE), eq(lifecycleModels.version, MODEL_VERSION)));
    const definition = { ...(before?.definition ?? {}), ...c.value };
    await tx.insert(lifecycleModels).values({ code: MODEL_CODE, version: MODEL_VERSION, definition, updatedByName: v.name })
      .onConflictDoUpdate({ target: [lifecycleModels.code, lifecycleModels.version], set: { definition, updatedByName: v.name, updatedAt: new Date() } });
    await writeAudit(tx, audit(v, `Model ${MODEL_CODE} ${MODEL_VERSION}`, 'model values updated', { before: before?.definition, after: { ...c.value } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/model');
  return r;
}

/** A new delegation matrix in force from today (C-4): the administrator only; earlier matrices stay for the changes they judged. */
export async function updateMatrixAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await asRole(['admin']);
  if (!v) return REFUSED;
  const c = checkMatrix(fieldsOf(fd));
  if (!c.ok) return c;
  const today = await businessToday();
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const definition = { ...c.value } as Record<string, unknown>;
    await tx.insert(delegationMatrices).values({ validFrom: today, definition, updatedByName: v.name })
      .onConflictDoUpdate({ target: delegationMatrices.validFrom, set: { definition, updatedByName: v.name } });
    await writeAudit(tx, audit(v, `Delegation matrix ${today}`, 'delegation matrix in force from this day', { after: definition }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/admin/delegation');
  return r;
}
