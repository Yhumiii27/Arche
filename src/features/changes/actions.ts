'use server';
// Management of change (docs/spec/05 §5): after G2, the project lead records a change; it goes to the decider the delegation
// matrix in force gives (cost against the G2 baseline and the cumulative cost of the changes approved, delay, kind). The
// project steering committee's decision is recorded by the sponsor; the group industrial director and the CEO record theirs.
import { and, eq } from 'drizzle-orm';
import { holdsOn, nextNumber, refOf } from '@/domain/capex';
import { checkChange, deciderOf, DECIDER_ROLE_OF, type DeciderLevel } from '@/domain/delegation';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { budgetLines, budgetVersions, changes } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, type ActionResult } from '@/server/capex/write';
import { centralOf } from '@/domain/budget';
import { approvedCostKeur, matrixInForce } from '@/server/dal/dossiers';
import type { Viewer } from '@/server/session';


const afterG2 = (c: { status: string; phase: string }) => c.status === 'active' && (c.phase === 'execution' || c.phase === 'demarrage');

export async function createChangeAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v, today) => {
    if (!afterG2(c)) return { ok: false, error: 'A change is recorded after G2' };
    if (!c.typology) return { ok: false, error: 'The typology of the CAPEX is not determined' };
    const ch = checkChange(fieldsOf(fd));
    if (!ch.ok) return ch;
    const [base] = await tx.select({ id: budgetVersions.id }).from(budgetVersions).where(and(eq(budgetVersions.capexId, c.id), eq(budgetVersions.isG2Baseline, true)));
    if (!base) return { ok: false, error: 'The CAPEX has no G2 baseline' };
    const g2 = centralOf(await tx.select({ amountKeur: budgetLines.amountKeur }).from(budgetLines).where(eq(budgetLines.budgetVersionId, base.id)));
    const { validFrom, matrix } = await matrixInForce(tx, today);
    const decider = deciderOf(ch.value, { typology: c.typology, g2BudgetKeur: g2, approvedCostKeur: await approvedCostKeur(tx, c.id), contingencyKeur: null }, matrix);
    const number = nextNumber((await tx.select({ n: changes.number }).from(changes).where(eq(changes.capexId, c.id))).map((x) => x.n));
    const [row] = await tx.insert(changes).values({
      capexId: c.id, number, title: ch.value.title, description: ch.value.description, kind: ch.value.kind, amountKeur: ch.value.amountKeur, delayDays: ch.value.delayDays,
      requiredDecider: decider, matrixValidFrom: validFrom, createdByName: v.name,
    }).returning({ id: changes.id });
    await writeAudit(tx, auditOf(v, c, `change ${refOf('MOC', number)} submitted → ${decider}`, { entityType: 'change', entityId: row.id, after: { ...ch.value, decider } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'change.submitted', text: `${c.code}: ${refOf('MOC', number)} submitted`, capexId: c.id });
    return { ok: true };
  });
}

/** True when the viewer records the decision of `level` on the CAPEX. */
function decidesLevel(v: Viewer, level: DeciderLevel, c: { code: string; subsidiaryCode: string; status: string }): boolean {
  const role = DECIDER_ROLE_OF[level];
  return v.role === role && holdsOn(v.assignments, role, c);
}

export async function decideChangeAction(code: string, changeId: string, outcome: 'approved' | 'rejected', reason: string): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v) => {
    const [ch] = await tx.select().from(changes).where(and(eq(changes.id, changeId), eq(changes.capexId, c.id)));
    if (!ch) return { ok: false, error: 'Unknown change' };
    if (ch.status !== 'submitted') return { ok: false, error: 'This change is already decided' };
    if (c.status !== 'active' || !decidesLevel(v, ch.requiredDecider as DeciderLevel, c)) return { ok: false, error: 'This change is decided by another level' };
    if (outcome === 'rejected' && !reason?.trim()) return { ok: false, error: 'Give the reason' };
    await tx.update(changes).set({ status: outcome, decisionReason: reason?.trim() || null, decidedByName: v.name, decidedByUserId: v.userId, decidedAt: new Date(), updatedAt: new Date() }).where(eq(changes.id, ch.id));
    await writeAudit(tx, auditOf(v, c, `change ${refOf('MOC', ch.number)}: ${outcome}`, { entityType: 'change', entityId: ch.id, reason }));
    return { ok: true };
  });
}
