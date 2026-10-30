import 'server-only';
// "My approvals" (docs/spec/05 §6): what waits on the viewer in the CAPEX they see — the open circuit steps that are theirs,
// the budget versions they validate, the typologies they confirm and the changes they decide. Built from the data, never
// stored; the visibility filter applies first (src/server/dal/capex.ts).
import { and, eq, inArray } from 'drizzle-orm';
import { screenHref } from '@/config/screens';
import { sortInbox, type ApprovalItem } from '@/domain/approvals';
import { validatorsOf } from '@/domain/budget';
import { holdsOn } from '@/domain/capex';
import { canActOn, type StepActor } from '@/domain/circuits';
import { DECIDER_ROLE_OF, type DeciderLevel } from '@/domain/delegation';
import { getDb } from '@/server/db/client';
import { budgetVersions, capex, capexMembers, changes, circuitSteps, gates, postAudits } from '@/server/db/schema';
import { postAuditsOf } from '@/domain/benefits';
import type { Viewer } from '@/server/viewer';
import { businessToday } from '@/server/clock';
import { standInFor, standInsOf } from './absences';
import { visibleCapex } from './capex';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function approvalsOf(v: Viewer): Promise<ApprovalItem[]> {
  const seen = await visibleCapex(v);
  if (!seen.length) return [];
  const db = await getDb();
  const ids = seen.map((c) => c.id);
  const byId = new Map(seen.map((c) => [c.id, c]));
  const [rows, steps, members, versions, chs] = await Promise.all([
    db.select({ id: capex.id, code: capex.code, subsidiaryCode: capex.subsidiaryCode, status: capex.status, typologyProposed: capex.typologyProposed, updatedAt: capex.updatedAt }).from(capex).where(inArray(capex.id, ids)),
    db.select({ s: circuitSteps, gateCode: gates.code, session: gates.session, capexId: gates.capexId })
      .from(circuitSteps).innerJoin(gates, eq(gates.id, circuitSteps.gateId))
      .where(and(inArray(gates.capexId, ids), eq(gates.status, 'in_review'), eq(circuitSteps.status, 'open'))),
    db.select({ capexId: capexMembers.capexId }).from(capexMembers).where(and(eq(capexMembers.userId, v.userId), eq(capexMembers.capexRole, 'internal_client'))),
    db.select().from(budgetVersions).where(and(inArray(budgetVersions.capexId, ids), eq(budgetVersions.status, 'submitted'))),
    db.select().from(changes).where(and(inArray(changes.capexId, ids), eq(changes.status, 'submitted'))),
  ]);
  const facts = new Map(rows.map((r) => [r.id, r]));
  const internalClientOf = new Set(members.map((m) => m.capexId));
  const standIns = await standInsOf(db, v.userId, await businessToday(db));
  const items: ApprovalItem[] = [];
  for (const x of steps) {
    const c = facts.get(x.capexId)!;
    const actor = { role: v.role, userId: v.userId, assignments: v.assignments, internalClient: internalClientOf.has(c.id) };
    const own = canActOn({ actor: x.s.actor as StepActor, speciality: x.s.speciality, assigneeUserId: x.s.assigneeUserId }, actor, c);
    const standIn = own ? null : standInFor(x.s, c, standIns);
    if (!own && !standIn) continue;
    items.push({
      ...(standIn ? { onBehalfOf: standIn.person.displayName } : {}),
      kind: 'step', capexCode: c.code, title: x.s.label, detail: `${x.gateCode} · session ${x.session}`, subject: byId.get(c.id)!.title, since: x.s.openedOn ?? iso(x.s.createdAt), due: x.s.dueOn,
      href: screenHref('capex-gates', { code: c.code }),
    });
  }
  for (const b of versions) {
    const c = facts.get(b.capexId)!;
    if (!validatorsOf(b.estimateClass).some((r) => v.role === r && holdsOn(v.assignments, r, c))) continue;
    items.push({ kind: 'budget', capexCode: c.code, title: 'Budget version to validate', detail: `V${b.number} · ${b.estimateClass}`, subject: byId.get(c.id)!.title, since: iso(b.submittedAt ?? b.updatedAt), due: null, href: screenHref('capex-budget', { code: c.code }) });
  }
  for (const c of rows) {
    if (c.typologyProposed && v.role === 'dir_ig' && holdsOn(v.assignments, 'dir_ig', c) && c.status === 'active')
      items.push({ kind: 'typology', capexCode: c.code, title: 'Typology to confirm', detail: `${c.typologyProposed}`, subject: byId.get(c.id)!.title, since: iso(c.updatedAt), due: null, href: screenHref('capex-governance', { code: c.code }) });
  }
  // Post-audits that fell due (AR-046), for the group industrial director.
  if (v.role === 'dir_ig') {
    const commissioned = await db.select({ id: capex.id, mesStartedOn: capex.mesStartedOn }).from(capex).where(inArray(capex.id, ids));
    const held = await db.select({ capexId: postAudits.capexId, milestone: postAudits.milestone, heldOn: postAudits.heldOn }).from(postAudits).where(inArray(postAudits.capexId, ids));
    const today = await businessToday(db);
    for (const x of commissioned) {
      const c = facts.get(x.id)!;
      if (!holdsOn(v.assignments, 'dir_ig', c) || (c.status !== 'active' && c.status !== 'closed')) continue;
      for (const a of postAuditsOf(x.mesStartedOn, held.filter((h) => h.capexId === x.id), today).filter((a) => a.state === 'due' || a.state === 'late'))
        items.push({ kind: 'post_audit', capexCode: c.code, title: 'Post-audit to hold', detail: `M+${a.milestone}`, subject: byId.get(c.id)!.title, since: a.dueOn, due: a.dueOn, href: screenHref('capex-benefits', { code: c.code }) });
    }
  }
  for (const ch of chs) {
    const c = facts.get(ch.capexId)!;
    const role = DECIDER_ROLE_OF[ch.requiredDecider as DeciderLevel];
    if (v.role !== role || !holdsOn(v.assignments, role, c)) continue;
    items.push({ kind: 'change', capexCode: c.code, title: 'Change to decide', detail: `MOC-${String(ch.number).padStart(2, '0')}`, subject: ch.title, since: iso(ch.createdAt), due: null, href: screenHref('capex-changes', { code: c.code }) });
  }
  return sortInbox(items);
}
