'use server';
// Preferences: "View as" (demo mode), active role (Entra mode, among the roles held), language. Each one validates its input
// server-side; the role switch is audited.
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { activeRoleOf, isRoleKey } from '@/config/roles';
import { ROLE_SWITCH_DEMO, ROLE_SWITCH_REFUSED, VIEW_AS_REFUSED } from '@/domain/auth';
import { authMode, sessionConfig } from '@/server/auth/config';
import { cookieOptions, readSession, sealSession } from '@/server/auth/session-cookie';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { subsidiaries, zones } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { COOKIE, getViewer } from '@/server/session';

const YEAR = 60 * 60 * 24 * 365;

export async function setViewAs(role: string): Promise<{ ok: boolean; error?: string }> {
  if (authMode() !== 'demo') return { ok: false, error: VIEW_AS_REFUSED };
  if (!isRoleKey(role)) return { ok: false, error: 'Unknown profile' };
  (await cookies()).set(COOKIE.role, role, { path: '/', maxAge: YEAR, sameSite: 'lax', httpOnly: true });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function switchRole(role: string): Promise<{ ok: boolean; error?: string }> {
  if (authMode() !== 'entra') return { ok: false, error: ROLE_SWITCH_DEMO };
  const viewer = await getViewer();
  if (!isRoleKey(role) || activeRoleOf(viewer.roles, role) !== role) return { ok: false, error: ROLE_SWITCH_REFUSED };
  const cfg = sessionConfig();
  const jar = await cookies();
  const s = await readSession(cfg, jar.get(cfg.cookieName)?.value);
  if (!s) return { ok: false, error: ROLE_SWITCH_REFUSED };
  const { value } = await sealSession(cfg, { uid: s.uid, oid: s.oid, role, iat: s.iat });
  jar.set(cfg.cookieName, value, cookieOptions(cfg, Math.max(0, s.exp - Math.floor(Date.now() / 1000))));
  await writeAudit(await getDb(), { actorName: viewer.name, actorUserId: viewer.userId, actorRole: role, objectRef: `User ${viewer.email}`, change: `active role: ${viewer.role} → ${role}`, area: 'Sign-in' });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setLang(lang: string): Promise<void> {
  if (lang !== 'fr' && lang !== 'en') return;
  (await cookies()).set(COOKIE.lang, lang, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

/** The zone of the portfolio views (register, map); null = every zone. */
/** The subsidiary of the Subsidiary portfolio pages (register, subsidiary portfolio, opening a CAPEX). */
export async function setSubsidiary(code: string): Promise<void> {
  const [s] = await (await getDb()).select({ code: subsidiaries.code }).from(subsidiaries).where(eq(subsidiaries.code, String(code)));
  if (!s) return;
  (await cookies()).set(COOKIE.subsidiary, s.code, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

export async function setZone(zone: string | null): Promise<void> {
  const jar = await cookies();
  if (zone === null) jar.delete(COOKIE.zone);
  else {
    const [z] = await (await getDb()).select({ code: zones.code }).from(zones).where(eq(zones.code, String(zone)));
    if (!z) return;
    jar.set(COOKIE.zone, z.code, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  }
  revalidatePath('/', 'layout');
}
