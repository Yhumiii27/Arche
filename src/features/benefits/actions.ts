'use server';
// Benefits realised and post-audits Server Functions (AR-046): a year of benefits entered by the controller or the sponsor
// (after the start of commissioning), a post-audit held by the group industrial director with its conclusion and report, the
// realised NPV and IRR recorded with it. Each one checks the rights and the input server-side and audits.
import { revalidatePath } from 'next/cache';
import { checkBenefit, checkPostAudit, POST_AUDIT_CONCLUSION_LABEL } from '@/domain/benefits';
import { writeAudit } from '@/server/db/helpers';
import { benefitActuals, postAudits } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, type ActionResult } from '@/server/capex/write';
import { benefitsOf } from '@/server/dal/benefits';

const page = (code: string) => `/capex/${encodeURIComponent(code)}/benefits`;

export async function saveBenefitAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'benefits', async (tx, c, v, today) => {
    if (!c.mesStartedOn) return { ok: false, error: 'Benefits are entered after the start of commissioning' };
    const b = await benefitsOf(tx, c, today);
    if (!b.bp) return { ok: false, error: 'The CAPEX has no business plan' };
    const ch = checkBenefit(fieldsOf(fd), b.bp.horizonYears);
    if (!ch.ok) return ch;
    const before = b.actuals.find((a) => a.year === ch.value.year);
    const row = { capexId: c.id, ...ch.value, enteredByName: v.name, updatedAt: new Date() };
    await tx.insert(benefitActuals).values(row).onConflictDoUpdate({ target: [benefitActuals.capexId, benefitActuals.year], set: row });
    await writeAudit(tx, auditOf(v, c, `benefits of year ${ch.value.year}: revenue ${ch.value.revenueKeur} k€, OPEX ${ch.value.opexKeur} k€`, {
      entityType: 'benefit', before: before ? { revenueKeur: before.revenueKeur, opexKeur: before.opexKeur } : undefined, after: { revenueKeur: ch.value.revenueKeur, opexKeur: ch.value.opexKeur },
    }));
    revalidatePath(page(c.code));
    return { ok: true };
  });
}

export async function recordPostAuditAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'post_audit', async (tx, c, v, today) => {
    const b = await benefitsOf(tx, c, today);
    const open = b.audits.filter((a) => a.state === 'due' || a.state === 'late').map((a) => a.milestone);
    const ch = checkPostAudit(fieldsOf(fd), open, today);
    if (!ch.ok) return ch;
    const [row] = await tx.insert(postAudits).values({ capexId: c.id, ...ch.value, realNpvKeur: b.returns?.realNpv ?? null, realIrrPct: b.returns?.realIrr ?? null, recordedByName: v.name }).returning({ id: postAudits.id });
    await writeAudit(tx, auditOf(v, c, `post-audit M+${ch.value.milestone} held on ${ch.value.heldOn}: ${POST_AUDIT_CONCLUSION_LABEL[ch.value.conclusion].toLowerCase()}`, { entityType: 'post_audit', entityId: row.id }));
    revalidatePath(page(c.code));
    return { ok: true };
  });
}
