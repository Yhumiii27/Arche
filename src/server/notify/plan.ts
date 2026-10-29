import 'server-only';
// The circuits' notifications (AR-041): the notices due today on every open step of a running circuit, written to the e-mail
// outbox for each person who may act on the step (and the delegate of an absent one), the escalations for the group industrial
// director and the CAPEX's sponsor; a notice is written once per recipient (unique key). Audited when a step is escalated.
import { and, eq, inArray } from 'drizzle-orm';
import { screenHref } from '@/config/screens';
import { absentOn, noticesOf, noticeText, personCanAct, type Absence } from '@/domain/notify';
import type { StepActor } from '@/domain/circuits';
import { holdsOn } from '@/domain/capex';
import { dataText } from '@/i18n/data-text';
import { makeT } from '@/i18n/translate';
import { getConfig } from '@/server/config';
import { writeAudit } from '@/server/db/helpers';
import { absences, capex, capexMembers, circuitSteps, emailOutbox, gates } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { modelValues } from '@/server/dal/cycle';
import { activeAccounts, type UserAccount } from '@/server/dal/users';

type Q = DB | Tx;

/** The absences in force on `today`, by absent user. */
export async function absencesOn(q: Q, today: string): Promise<Map<string, Absence & { id: string }>> {
  const rows = await q.select().from(absences);
  return new Map(rows.filter((a) => absentOn(a, today)).map((a) => [a.userId, a]));
}

/** Writes the notices due on `today`; returns how many e-mails were queued. */
export async function planNotices(q: Q, today: string): Promise<number> {
  const steps = await q.select({ s: circuitSteps, gate: gates.code, session: gates.session, capexId: gates.capexId })
    .from(circuitSteps).innerJoin(gates, eq(gates.id, circuitSteps.gateId))
    .where(and(eq(gates.status, 'in_review'), eq(circuitSteps.status, 'open')));
  if (!steps.length) return 0;
  const capexIds = [...new Set(steps.map((x) => x.capexId))];
  const [values, people, cs, clients, away] = await Promise.all([
    modelValues(q),
    activeAccounts(q, today),
    q.select({ id: capex.id, code: capex.code, title: capex.title, subsidiaryCode: capex.subsidiaryCode, status: capex.status }).from(capex).where(inArray(capex.id, capexIds)),
    q.select({ capexId: capexMembers.capexId, userId: capexMembers.userId }).from(capexMembers).where(and(inArray(capexMembers.capexId, capexIds), eq(capexMembers.capexRole, 'internal_client'))),
    absencesOn(q, today),
  ]);
  const byId = new Map(people.map((p) => [p.userId, p]));
  const t = makeT('fr');
  const origin = getConfig().mail.publicUrl ?? '';
  let queued = 0;
  for (const x of steps) {
    const c = cs.find((r) => r.id === x.capexId)!;
    if (c.status !== 'active') continue;
    const notices = noticesOf(x.s, today, values);
    if (!notices.length) continue;
    const step = { actor: x.s.actor as StepActor, speciality: x.s.speciality, assigneeUserId: x.s.assigneeUserId };
    const actors = people.filter((p) => personCanAct(step, p, c, clients.some((m) => m.capexId === c.id && m.userId === p.userId)));
    // Escalation: the group industrial director and the CAPEX's sponsor (those who hold the role on it).
    const escalation = people.filter((p) => (['dir_ig', 'sponsor'] as const).some((r) => p.roles.includes(r) && holdsOn(p.assignments, r, c)));
    const link = `${origin}${screenHref('capex-gates', { code: c.code })}`;
    for (const n of notices) {
      const first = n.kind === 'step_escalated' && !(await q.select({ id: emailOutbox.id }).from(emailOutbox).where(eq(emailOutbox.key, n.key)).limit(1)).length;
      const to = n.kind === 'step_escalated' ? [...actors, ...escalation.filter((e) => !actors.includes(e))] : actors;
      // The delegate of an absent recipient receives a copy.
      const recipients: { p: UserAccount; onBehalfOf: string | null }[] = to.map((p) => ({ p, onBehalfOf: null }));
      for (const p of to) {
        const a = away.get(p.userId);
        const d = a ? byId.get(a.delegateUserId) : null;
        if (d && !recipients.some((r) => r.p.userId === d.userId && !r.onBehalfOf)) recipients.push({ p: d, onBehalfOf: p.displayName });
      }
      for (const r of recipients) {
        const text = noticeText(t, n, { capexCode: c.code, capexTitle: dataText(c.title, 'fr'), gate: `${x.gate} · ${t('session')} ${x.session}`, stepLabel: t(x.s.label), dueOn: x.s.dueOn, link, onBehalfOf: r.onBehalfOf });
        const key = r.onBehalfOf ? `${n.key}:for:${r.onBehalfOf}` : n.key;
        const inserted = await q.insert(emailOutbox).values({ key, kind: n.kind, userId: r.p.userId, toEmail: r.p.email, capexId: c.id, ...text })
          .onConflictDoNothing().returning({ id: emailOutbox.id });
        queued += inserted.length;
      }
      if (first) {
        await writeAudit(q, {
          actorName: 'Arche', actorUserId: null, actorRole: null, objectRef: c.code, area: 'Circuits', entityType: 'circuit_step', entityId: x.s.id, capexId: c.id,
          change: `${x.gate} session ${x.session}: step "${x.s.label}" late by ${n.lateDays} working days, escalated to the group industrial director and the sponsor`,
        });
      }
    }
  }
  return queued;
}
