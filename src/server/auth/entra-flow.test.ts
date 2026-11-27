// Microsoft Entra ID sign-in end to end (derived from Keystone's R-038 test) against the in-process Entra double and a fresh
// PostgreSQL database — no network: the sign-in route (PKCE, state, nonce), the callback (session cookie, account linked to
// the Microsoft object id, audit), every refusal (unknown e-mail, no role, deactivated, other Microsoft account, forged
// state), the first administrator from ARCHE_ADMIN_EMAILS, getViewer() on the session, the role switch, sign-out, and the
// demo mode.
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { desc, eq } from 'drizzle-orm';
import pg from 'pg';
import { setViewAs, switchRole } from '@/server/actions/preferences';
import { auditEntries, roleAssignments, users } from '@/server/db/schema';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { ENTRA_ENV, ORIGIN, createMockEntra, setCookies, type MockEntra } from '@/test/mock-entra';
import { clearOidcCache } from './oidc';
import { handleCallback, handleSignIn, handleSignOut } from './routes';

const SESSION = '__Host-arche-session';
const TX = '__Host-arche-signin';
let idp: MockEntra;
let t: TestDatabase;

const useEntra = (extra: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries({ ...ENTRA_ENV, ...extra })) vi.stubEnv(k, v);
};

/** Sign-in route → Microsoft (the double) → callback, as the browser would. */
async function signIn(claims: Record<string, unknown>, returnTo = '/capex') {
  const start = await handleSignIn(new NextRequest(`${ORIGIN}/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`));
  const tx = setCookies(start)[TX].value;
  const { code, state } = idp.authorize(start.headers.get('location')!, claims);
  const res = await handleCallback(new NextRequest(`${ORIGIN}/api/auth/callback?code=${code}&state=${state}`, { headers: { cookie: `${TX}=${tx}` } }));
  return { start, res, cookies: setCookies(res), tx };
}

const useSession = (r: { cookies: ReturnType<typeof setCookies> }) => jar.set(SESSION, r.cookies[SESSION].value);
const lastAudit = async () => (await t.db.select().from(auditEntries).orderBy(desc(auditEntries.occurredAt)).limit(1))[0];
const userByEmail = async (email: string) => (await t.db.select().from(users).where(eq(users.email, email)))[0];

beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());

beforeEach(async () => {
  jar.clear();
  clearOidcCache();
  idp = await createMockEntra();
  vi.stubGlobal('fetch', idp.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('demo mode (default)', () => {
  it('"View as" picks the demonstration person of a profile; the sign-in routes answer 404', async () => {
    expect(await getViewer()).toMatchObject({ role: 'dir_ig', name: 'Claire Morel', demo: true });
    expect((await handleSignIn(new NextRequest(`${ORIGIN}/api/auth/sign-in`))).status).toBe(404);
    expect((await handleCallback(new NextRequest(`${ORIGIN}/api/auth/callback?code=x&state=y`))).status).toBe(404);
    expect((await handleSignOut(new NextRequest(`${ORIGIN}/api/auth/sign-out`, { method: 'POST' }))).status).toBe(404);
    expect(await setViewAs('sponsor')).toEqual({ ok: true });
    expect(jar.get('arche-role')).toBe('sponsor');
    expect(await setViewAs('boss')).toEqual({ ok: false, error: 'Unknown profile' });
    expect((await switchRole('ceo')).ok).toBe(false);
    expect(idp.calls).toEqual([]);
  });
});

describe('Entra ID sign-in', () => {
  beforeEach(() => useEntra());

  it('signs a registered account in by e-mail, links the Microsoft object id, audits, and returns to the page', async () => {
    const r = await signIn({ oid: 'oid-leila', preferred_username: 'L.Haddad@atlas-process.example', name: 'Leïla Haddad' });
    expect(r.res.status).toBe(302);
    expect(r.res.headers.get('location')).toBe(`${ORIGIN}/capex`);
    expect(r.cookies[SESSION].attrs).toMatch(/httponly/);
    expect(r.cookies[TX].value).toBe('');
    const u = await userByEmail('l.haddad@atlas-process.example');
    expect(u).toMatchObject({ entraObjectId: 'oid-leila', active: true });
    expect(u.lastSignInAt).toBeInstanceOf(Date);
    expect(await lastAudit()).toMatchObject({ actorName: 'Leïla Haddad', change: 'Signed in', area: 'Sign-in' });

    useSession(r);
    jar.set('arche-role', 'ceo'); // ignored with Entra ID
    expect(await getViewer()).toMatchObject({ role: 'project_lead', roles: ['project_lead'], name: 'Leïla Haddad', userId: u.id, demo: false });

    // Later sign-ins match the object id, whatever the e-mail claim says.
    jar.clear();
    const again = await signIn({ oid: 'oid-leila', preferred_username: 'leila@other.example' });
    expect(again.res.headers.get('location')).toBe(`${ORIGIN}/capex`);
  });

  it('refuses an unknown e-mail, an account without role, a deactivated account and another Microsoft account', async () => {
    const unknown = await signIn({ oid: 'oid-x', email: 'nobody@groupe.example' });
    expect(unknown.res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=unknown_user`);
    expect(await lastAudit()).toMatchObject({ change: 'Sign-in refused · Unknown e-mail' });

    const fatou = await userByEmail('f.sarr@sahel-agro.example');
    await t.db.update(users).set({ entraObjectId: 'oid-fatou-elsewhere' }).where(eq(users.id, fatou.id));
    expect((await signIn({ oid: 'oid-fatou', email: 'f.sarr@sahel-agro.example' })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=account_mismatch`);

    const moussa = await userByEmail('m.ndiaye@sahel-agro.example');
    await t.db.update(users).set({ active: false }).where(eq(users.id, moussa.id));
    expect((await signIn({ oid: 'oid-moussa', email: 'm.ndiaye@sahel-agro.example' })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=inactive`);

    const ibrahima = await userByEmail('i.fall@sahel-agro.example');
    await t.db.delete(roleAssignments).where(eq(roleAssignments.userId, ibrahima.id));
    expect((await signIn({ oid: 'oid-ibrahima', email: 'i.fall@sahel-agro.example' })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=no_role`);
  });

  it('creates the first administrator from ARCHE_ADMIN_EMAILS', async () => {
    useEntra({ ARCHE_ADMIN_EMAILS: 'it.admin@groupe.example' });
    const r = await signIn({ oid: 'oid-it', email: 'IT.Admin@groupe.example', name: 'IT Admin' });
    expect(r.res.headers.get('location')).toBe(`${ORIGIN}/capex`);
    const u = await userByEmail('it.admin@groupe.example');
    expect(u).toMatchObject({ displayName: 'IT Admin', entraObjectId: 'oid-it' });
    const roles = await t.db.select().from(roleAssignments).where(eq(roleAssignments.userId, u.id));
    expect(roles.map((x) => [x.role, x.scopeKind, x.scopeRef])).toEqual([['admin', 'group', null]]);
    useSession(r);
    expect(await getViewer()).toMatchObject({ role: 'admin', name: 'IT Admin' });
  });

  it('switches the active role among the roles held, refuses another one, and signs out', async () => {
    const karim = await userByEmail('k.benali@atlas-process.example');
    await t.db.insert(roleAssignments).values({ userId: karim.id, role: 'controller', scopeKind: 'subsidiary', scopeRef: 'APM', createdByName: 'Test' });
    const r = await signIn({ oid: 'oid-karim', email: 'k.benali@atlas-process.example', name: 'Karim Benali' });
    useSession(r);
    expect(await getViewer()).toMatchObject({ role: 'sponsor', roles: ['sponsor', 'controller'] });
    expect(await switchRole('ceo')).toEqual({ ok: false, error: 'You do not hold this role' });
    expect(await switchRole('controller')).toEqual({ ok: true });
    expect(await lastAudit()).toMatchObject({ change: 'active role: sponsor → controller', actorRole: 'controller' });

    const out = await handleSignOut(new NextRequest(`${ORIGIN}/api/auth/sign-out`, { method: 'POST', headers: { cookie: `${SESSION}=${jar.get(SESSION)}`, origin: ORIGIN } }));
    expect(out.status).toBe(303);
    expect(setCookies(out)[SESSION].value).toBe('');
    expect(await lastAudit()).toMatchObject({ change: 'Signed out', actorName: 'Karim Benali' });
    const cross = await handleSignOut(new NextRequest(`${ORIGIN}/api/auth/sign-out`, { method: 'POST', headers: { origin: 'https://evil.example' } }));
    expect(cross.status).toBe(403);
  });

  it('refuses a callback whose state does not match the sign-in cookie', async () => {
    const start = await handleSignIn(new NextRequest(`${ORIGIN}/api/auth/sign-in`));
    const tx = setCookies(start)[TX].value;
    const { code } = idp.authorize(start.headers.get('location')!, { oid: 'o', email: 'k.benali@atlas-process.example' });
    const res = await handleCallback(new NextRequest(`${ORIGIN}/api/auth/callback?code=${code}&state=forged`, { headers: { cookie: `${TX}=${tx}` } }));
    expect(res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=state`);
  });
});

describe('central sign-in of Clavis (ARCHE_ROLES_FROM_TOKEN=on)', () => {
  beforeEach(() => useEntra({ ARCHE_ROLES_FROM_TOKEN: 'on' }));

  it('takes the roles from the token: an unknown e-mail gets an account with its group role', async () => {
    const r = await signIn({ oid: 'oid-copil', email: 'copil.member@atrium.example', name: 'Copil Member', roles: ['copil_member'] });
    expect(r.res.headers.get('location')).toBe(`${ORIGIN}/capex`);
    const u = await userByEmail('copil.member@atrium.example');
    expect(u).toMatchObject({ displayName: 'Copil Member', entraObjectId: 'oid-copil', grantedRoles: ['copil_member'] });
    expect(await t.db.select().from(roleAssignments).where(eq(roleAssignments.userId, u.id))).toHaveLength(0);
    useSession(r);
    expect(await getViewer()).toMatchObject({ role: 'copil_member', roles: ['copil_member'] });
  });

  it('keeps a scoped role only while Clavis grants it; the scope still comes from the Arche assignment', async () => {
    const granted = await signIn({ oid: 'oid-leila', preferred_username: 'l.haddad@atlas-process.example', roles: ['Arche.Project_Lead'] });
    useSession(granted);
    const v = await getViewer();
    expect(v).toMatchObject({ role: 'project_lead' });
    expect(v.assignments.every((a) => a.scopeKind === 'capex' && a.scopeRef)).toBe(true);

    jar.clear();
    const withdrawn = await signIn({ oid: 'oid-leila', preferred_username: 'l.haddad@atlas-process.example', roles: ['copil_member'] });
    useSession(withdrawn);
    expect(await getViewer()).toMatchObject({ role: 'copil_member', roles: ['copil_member'] });
  });

  it('refuses a token without an Arche role, and a scoped role nobody gave a scope to yet', async () => {
    expect((await signIn({ oid: 'oid-none', email: 'none@atrium.example', roles: [] })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=no_role`);
    expect((await signIn({ oid: 'oid-lead', email: 'new.lead@atrium.example', roles: ['project_lead'] })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=no_scope`);
    expect(await userByEmail('new.lead@atrium.example')).toBeUndefined();
  });
});


describe('rights read in the database (ARCHE_ACCESS_FROM_CLAVIS=on)', () => {
  const OID = '2b9e4c1a-7d3f-4e8a-9b6c-5a4d3e2f1c0b';
  // Stand-in of the view Matrix publishes on the shared server (same columns Arche reads), made as the administrator and
  // readable by arche_app, as Matrix's link grants it.
  const admin = async (q: string, params: unknown[] = []) => {
    const c = new pg.Client({ connectionString: t.url });
    await c.connect();
    try {
      return await c.query(q, params);
    } finally {
      await c.end();
    }
  };
  beforeEach(async () => {
    useEntra({ ARCHE_ACCESS_FROM_CLAVIS: 'on' });
    await admin(`drop schema if exists clavis cascade; create schema clavis;
      create table clavis.pub_acces (personne_id uuid, application text, autorise boolean, niveau text, domaine text, role text, ouvert boolean, maj_le timestamptz);
      grant usage on schema clavis to ${t.role}; grant select on clavis.pub_acces to ${t.role};`);
    await admin(`insert into clavis.pub_acces values ($1, 'arche', true, 'direction', null, 'copil_member', true, now()), ($1, 'keystone', true, 'admin', null, 'director', true, now())`, [OID]);
  });
  afterAll(async () => {
    await admin('drop schema if exists clavis cascade');
  });

  it('takes the role set in Clavis, not the token, and applies a change or a withdrawal at the next page', async () => {
    const r = await signIn({ oid: OID, email: 'db.reader@atrium.example', name: 'Db Reader', roles: ['admin'] });
    expect(r.res.headers.get('location')).toBe(`${ORIGIN}/capex`);
    expect(await userByEmail('db.reader@atrium.example')).toMatchObject({ grantedRoles: ['copil_member'] });
    useSession(r);
    expect(await getViewer()).toMatchObject({ role: 'copil_member', roles: ['copil_member'] });
    await admin(`update clavis.pub_acces set role = 'admin' where application = 'arche'`);
    expect(await getViewer()).toMatchObject({ role: 'admin', roles: ['admin'] });
    await admin(`update clavis.pub_acces set ouvert = false where application = 'arche'`);
    await expect(getViewer()).rejects.toThrow(/REDIRECT:\/sign-in/);
    jar.clear();
    expect((await signIn({ oid: OID, email: 'db.reader@atrium.example', roles: ['admin'] })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=no_role`);
  });

  it('refuses when the view cannot be read, never falling back to the token', async () => {
    await admin('drop schema clavis cascade');
    expect((await signIn({ oid: OID, email: 'db.reader2@atrium.example', roles: ['admin'] })).res.headers.get('location')).toBe(`${ORIGIN}/sign-in?error=failed`);
  });
});
