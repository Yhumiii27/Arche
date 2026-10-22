'use server';
// Safety milestones of a CAPEX (docs/spec/03 §4, N-13): the group HSE declares each milestone's status with the reference of
// its evidence. A milestone mirrored from Vigie is not declared in Arche. The PSSR discharge (quitus) is a step of the G3 circuit.
import { checkHs, emptyHs, HS_LABEL, isHsCode } from '@/domain/safety';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { hsStatuses } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, type ActionResult } from '@/server/capex/write';
import { hsOf } from '@/server/dal/execution';

export async function declareHsAction(code: string, hsCode: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'safety', async (tx, c, v, today) => {
    if (!isHsCode(hsCode)) return { ok: false, error: 'Unknown safety milestone' };
    const before = (await hsOf(tx, c.id)).find((s) => s.code === hsCode) ?? emptyHs(hsCode);
    if (before.source === 'vigie') return { ok: false, error: 'This milestone comes from Vigie' };
    const ch = checkHs(fieldsOf(fd), today);
    if (!ch.ok) return ch;
    const values = { ...ch.value, source: 'declared' as const, updatedByName: v.name, updatedAt: new Date() };
    await tx.insert(hsStatuses).values({ capexId: c.id, hsCode, ...values }).onConflictDoUpdate({ target: [hsStatuses.capexId, hsStatuses.hsCode], set: values });
    await writeAudit(tx, auditOf(v, c, `${HS_LABEL[hsCode]}: ${ch.value.status} (declared)`, {
      entityType: 'hs_status', before: { status: before.status, evidenceRef: before.evidenceRef, passedOn: before.passedOn }, after: { ...ch.value }, reason: ch.value.status === 'waived' ? ch.value.note : null,
    }));
    if (ch.value.status === 'passed') await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'hs.passed', text: `${c.code}: ${HS_LABEL[hsCode]} passed`, capexId: c.id });
    return { ok: true };
  });
}
