'use server';
// Reviews of a CAPEX (docs/spec/06 §2, N-19): a project steering committee held, recorded by the project lead or the sponsor
// (right `edit`); a cross-functional audit of a Strategic CAPEX, recorded by the group industrial director or the EPC2i PMO
// (right `audit`). Attendees, summary and decisions are kept; the decisions go to the decisions register of the CAPEX.
import { eq } from 'drizzle-orm';
import { canDo, nextNumber, refOf } from '@/domain/capex';
import { checkReview } from '@/domain/governance';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { decisions, reviews } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, REFUSED, type ActionResult } from '@/server/capex/write';

export async function recordReviewAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v, today) => {
    const ch = checkReview(fieldsOf(fd), today);
    if (!ch.ok) return ch;
    const r = ch.value;
    if (!canDo(r.kind === 'audit' ? 'audit' : 'edit', v.role, v.assignments, c)) return REFUSED;
    if (c.status !== 'active') return { ok: false, error: 'A review is recorded on an active CAPEX' };
    if (r.kind === 'audit' && c.typology !== 'strategic') return { ok: false, error: 'Cross-functional audits are for Strategic CAPEX' };
    const number = nextNumber((await tx.select({ n: reviews.number }).from(reviews).where(eq(reviews.capexId, c.id))).map((x) => x.n));
    const [row] = await tx.insert(reviews).values({ capexId: c.id, number, kind: r.kind, heldOn: r.heldOn, phase: c.phase, attendees: r.attendees, summary: r.summary, recordedByName: v.name }).returning({ id: reviews.id });
    if (r.decisions.length) {
      let n = nextNumber((await tx.select({ n: decisions.number }).from(decisions).where(eq(decisions.capexId, c.id))).map((x) => x.n));
      for (const text of r.decisions) {
        await tx.insert(decisions).values({ capexId: c.id, number: n, takenOn: r.heldOn, body: r.kind === 'audit' ? 'dir_ig' : 'copil_projet', text, reviewId: row.id, recordedByName: v.name });
        n += 1;
      }
    }
    await writeAudit(tx, auditOf(v, c, `${r.kind === 'audit' ? 'audit' : 'project steering committee'} ${refOf('REV', number)} recorded (${r.heldOn}, ${r.decisions.length} decision(s))`, { entityType: 'review', entityId: row.id, after: { ...r } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'review.recorded', text: `${c.code}: ${refOf('REV', number)} recorded`, capexId: c.id });
    return { ok: true };
  });
}
