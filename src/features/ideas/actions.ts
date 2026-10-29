'use server';
// Ideas backlog Server Functions (AR-051): propose an idea for a subsidiary of one's scope; qualify, retain or set it aside (its
// sponsor, its zone director, the group industrial director). The conversion into a CAPEX draft is done by the guided opening
// (src/features/capex/guided.ts). Each one validates its input and rights server-side and audits.
import { and, eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { canDecideIdea, canPropose, checkIdea, checkIdeaDecision, ideaRef, IDEA_DECISION_LABEL, statusAfter, type IdeaStatus } from '@/domain/ideas';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { ideas } from '@/server/db/schema';
import { fieldsOf, type ActionResult } from '@/server/capex/write';
import { ideaById, ideaSubsidiaries } from '@/server/dal/ideas';
import { getViewer } from '@/server/session';

export async function proposeIdeaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!canPropose(v.role)) return { ok: false, error: 'The administrator proposes no idea' };
  const db = await getDb();
  const ch = checkIdea(fieldsOf(fd), await ideaSubsidiaries(db, v));
  if (!ch.ok) return ch;
  await db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(ideas.number) }).from(ideas).where(eq(ideas.subsidiaryCode, ch.value.subsidiaryCode));
    const number = (last ?? 0) + 1;
    const [row] = await tx.insert(ideas).values({ ...ch.value, number, proposedByName: v.name, proposedByUserId: v.userId }).returning({ id: ideas.id });
    await writeAudit(tx, {
      actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: ideaRef(ch.value.subsidiaryCode, number), area: 'Ideas', entityType: 'idea', entityId: row.id,
      change: `idea proposed: ${ch.value.title}`, after: { ...ch.value },
    });
  });
  revalidatePath('/ideas');
  return { ok: true };
}

export async function decideIdeaAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  const db = await getDb();
  return db.transaction(async (tx): Promise<ActionResult> => {
    const idea = await ideaById(tx, id);
    if (!idea || !(await ideaSubsidiaries(tx, v)).includes(idea.subsidiaryCode)) return { ok: false, error: 'Unknown idea' };
    if (!canDecideIdea(v.role, v.assignments, idea)) return { ok: false, error: 'Only the sponsor, the zone director or the group industrial director decides on an idea' };
    const ch = checkIdeaDecision(fieldsOf(fd), idea.status as IdeaStatus);
    if (!ch.ok) return ch;
    const status = statusAfter(ch.value.decision);
    // The status read is the one decided on: two decisions at once, the second finds the idea changed.
    const done = await tx.update(ideas).set({ status, decisionNote: ch.value.note, decidedByName: v.name, decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(ideas.id, idea.id), eq(ideas.status, idea.status))).returning({ id: ideas.id });
    if (!done.length) return { ok: false, error: 'The idea changed meanwhile: reload the page' };
    await writeAudit(tx, {
      actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: ideaRef(idea.subsidiaryCode, idea.number), area: 'Ideas', entityType: 'idea', entityId: idea.id,
      change: `idea ${IDEA_DECISION_LABEL[ch.value.decision].toLowerCase()}: ${idea.status} → ${status}`, reason: ch.value.note,
    });
    revalidatePath('/ideas');
    return { ok: true };
  });
}
