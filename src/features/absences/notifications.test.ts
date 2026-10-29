// Circuit notifications and absences (AR-041) on a fresh database with the demo data set: the G1 circuit of the aseptic line
// (CPX-SAI-2026-02) waits on the COPIL member's review and the group industrial director's decision, both due on 20 Oct 2026.
// The notices due on a day are queued once per recipient; escalated after 3 working days late to the director and the sponsor;
// held by the transport `none`, written as .eml by `file`. An absent COPIL member's delegate — a project lead of another
// subsidiary — receives a copy, reads the CAPEX and acts on the step on their behalf.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { and, eq, like } from 'drizzle-orm';
import { auditEntries, circuitSteps, emailOutbox, gates, capex, users } from '@/server/db/schema';
import { deliverEmails } from '@/server/notify/deliver';
import { planNotices } from '@/server/notify/plan';
import { absencesOf } from '@/server/dal/absences';
import { approvalsOf } from '@/server/dal/approvals';
import { capexForViewer } from '@/server/dal/capex';
import { getViewer } from '@/server/session';
import { testDatabase, type TestDatabase } from '@/test/db';
import { actOnStepAction } from '@/features/gates/actions';
import { declareAbsenceAction, endAbsenceAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-lang', 'fr'));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const userId = async (email: string) => (await t.db.select({ id: users.id }).from(users).where(like(users.email, `${email}@%`)))[0].id;
const outboxOf = async (email: string) => t.db.select().from(emailOutbox).where(eq(emailOutbox.userId, await userId(email)));
const reviewStep = async () => {
  const [c] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-SAI-2026-02'));
  const [g] = await t.db.select().from(gates).where(and(eq(gates.capexId, c.id), eq(gates.status, 'in_review')));
  return (await t.db.select().from(circuitSteps).where(and(eq(circuitSteps.gateId, g.id), eq(circuitSteps.kind, 'review'))))[0];
};

describe('circuit notifications (AR-041)', () => {
  it('2 working days late: a reminder to the COPIL member and to the director, once', async () => {
    expect(await planNotices(t.db, '2026-10-22')).toBeGreaterThan(0);
    const marc = await outboxOf('m.dufour');
    expect(marc.map((m) => m.kind).sort()).toEqual(['step_late', 'step_open']);
    expect(marc.find((m) => m.kind === 'step_late')!.subject).toBe('[Arche] CPX-SAI-2026-02 · G1 · session 1 — Étape en retard · Examen par les membres du COPIL GPI');
    expect(marc[0].body).toContain('/capex/CPX-SAI-2026-02/gates');
    expect((await outboxOf('c.morel')).map((m) => m.kind).sort()).toEqual(['step_late', 'step_open']);
    // The sponsor is not an actor of these steps.
    expect(await outboxOf('m.ndiaye')).toEqual([]);
    expect(await planNotices(t.db, '2026-10-22')).toBe(0);
  });

  it('3 working days late: escalated to the director and the sponsor, journaled once', async () => {
    await planNotices(t.db, '2026-10-23');
    expect((await outboxOf('m.ndiaye')).map((m) => m.kind)).toEqual(['step_escalated', 'step_escalated']);
    expect((await outboxOf('m.ndiaye'))[0].body).toContain('escaladée');
    await planNotices(t.db, '2026-10-26');
    const journal = await t.db.select().from(auditEntries).where(like(auditEntries.change, '%escalated%'));
    expect(journal).toHaveLength(2); // the review and the decision, once each
  });

  it('sent: held by the transport none, written as .eml by file', async () => {
    expect(await deliverEmails(t.db, { transport: 'none', dir: null, from: 'arche@test.example' }, new Date())).toMatchObject({ sent: 0, failed: 0 });
    expect((await t.db.select().from(emailOutbox).where(eq(emailOutbox.status, 'pending'))).length).toBe(0);
    await t.db.update(emailOutbox).set({ status: 'pending' });
    const dir = await mkdtemp(path.join(os.tmpdir(), 'arche-mail-'));
    const r = await deliverEmails(t.db, { transport: 'file', dir, from: 'arche@test.example' }, new Date('2026-10-23T08:00:00Z'));
    expect(r.sent).toBeGreaterThan(0);
    const files = await readdir(dir);
    expect(files.length).toBe(r.sent);
    const eml = await readFile(path.join(dir, files[0]), 'utf8');
    expect(eml).toMatch(/^From: arche@test.example\r\nTo: [^\r]+@/);
    expect(eml).toContain('Subject: =?UTF-8?B?');
  });
});

describe('absences (AR-041)', () => {
  it('the COPIL member names a delegate; refused: oneself, an inactive person', async () => {
    jar.set('arche-role', 'copil_member');
    const leila = await userId('l.haddad');
    expect(await declareAbsenceAction(null, form({ fromOn: '2026-10-22', toOn: '2026-10-30', delegateUserId: await userId('m.dufour') }))).toEqual({ ok: false, error: 'Choose a delegate other than yourself' });
    expect(await declareAbsenceAction(null, form({ fromOn: '2026-10-22', toOn: '2026-10-30', delegateUserId: '00000000-0000-0000-0000-000000000000' }))).toEqual({ ok: false, error: 'Choose an active person of the business as delegate' });
    expect(await declareAbsenceAction(null, form({ fromOn: '2026-10-22', toOn: '2026-10-30', delegateUserId: leila, note: 'Leave' }))).toEqual({ ok: true });
  });

  it('the delegate, project lead at APM, reads the SAI CAPEX of the step, finds it in My approvals and acts on behalf', async () => {
    jar.set('arche-role', 'project_lead');
    const v = await getViewer();
    expect(await capexForViewer(v, 'CPX-SAI-2026-02')).not.toBeNull();
    expect(await capexForViewer(v, 'CPX-SAI-2026-01')).toBeNull();
    const inbox = await approvalsOf(v);
    expect(inbox.find((i) => i.capexCode === 'CPX-SAI-2026-02')).toMatchObject({ kind: 'step', onBehalfOf: 'Marc Dufour' });
    // Notices due go to the delegate too.
    await planNotices(t.db, '2026-10-28');
    expect((await outboxOf('l.haddad')).some((m) => m.body.includes('Marc Dufour'))).toBe(true);
    const step = await reviewStep();
    expect(await actOnStepAction('CPX-SAI-2026-02', step.id, null, form({ outcome: 'noted', comment: 'Seen for Marc' }))).toEqual({ ok: true });
    expect(await reviewStep()).toMatchObject({ status: 'done', actedByName: 'Leïla Haddad', onBehalfOfName: 'Marc Dufour' });
    // The step done, the CAPEX is no longer hers to read.
    expect(await capexForViewer(v, 'CPX-SAI-2026-02')).toBeNull();
  });

  it('someone who is no one’s delegate does not see the step; the absence ended early by its owner only', async () => {
    jar.set('arche-role', 'sponsor');
    expect(await capexForViewer(await getViewer(), 'CPX-SAI-2026-02')).toBeNull();
    jar.set('arche-role', 'copil_member');
    const [a] = await absencesOf(t.db, (await getViewer()).userId);
    jar.set('arche-role', 'project_lead');
    expect(await endAbsenceAction(a.id)).toEqual({ ok: false, error: 'Unknown absence' });
    jar.set('arche-role', 'copil_member');
    expect(await endAbsenceAction(a.id)).toEqual({ ok: true });
    expect(await endAbsenceAction(a.id)).toEqual({ ok: false, error: 'Unknown absence' });
  });
});
