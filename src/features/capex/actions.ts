'use server';
// CAPEX Server Functions (delivery 2; docs/spec/01 §3, 03, 06 §1–2): create and open a draft, the identity sheet, lots, budget
// versions, typology, team, risks, decisions, business plan and suspension. Each one reads the CAPEX through the viewer's
// visibility (outside it: "not found"), checks the right of the active role with the pure rules (src/domain/capex.ts), validates
// its input inside its transaction, writes, audits (area "CAPEX", linked to the CAPEX) and revalidates the CAPEX pages.
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { canMoveVersion, validatorsOf, ESTIMATE_CLASSES, type EstimateClass, type Typology } from '@/domain/budget';
import {
  checkBudgetLines, checkDecision, checkLot, checkRisk, checkSheet, creatableSubsidiaries, holdsOn, nextCapexCode, nextNumber, refOf,
  ROLE_OF_TEAM_ROLE, TEAM_ROLES,
} from '@/domain/capex';
import { BP_HORIZON, checkBusinessPlan } from '@/domain/bp';
import { MODEL_VERSION, openCapex, resume, suspend, type CycleState } from '@/domain/lifecycle';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import {
  budgetLines, budgetVersions, businessPlans, capex, capexLots, capexMembers, decisions, phaseTransitions, risks, roleAssignments, sites, users,
} from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { computedTypologyOf, lotsOf, teamOf, versionsOf } from '@/server/dal/cycle';
import { auditOf, fieldsOf, onCapex, REFUSED_MSG, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { getViewer, type Viewer } from '@/server/session';

type Row = CapexRowFull;

// ── Draft, opening, identity sheet ────────────────────────────────────────────────────────────────────────────────────

export async function createCapexAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  const allowed = creatableSubsidiaries(v.role, v.assignments, v.subsidiaryCode);
  const f = fieldsOf(fd);
  const sub = (f.subsidiaryCode || allowed[0] || '').toUpperCase();
  if (!allowed.includes(sub)) return { ok: false, error: 'You cannot create a CAPEX in this subsidiary' };
  const db = await getDb();
  const today = await businessToday();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const subSites = new Set((await tx.select({ id: sites.id }).from(sites).where(eq(sites.subsidiaryCode, sub))).map((x) => x.id));
    const c = checkSheet(f, { sites: subSites });
    if (!c.ok) return c;
    const taken = (await tx.select({ code: capex.code }).from(capex).where(eq(capex.subsidiaryCode, sub))).map((x) => x.code);
    const code = nextCapexCode(sub, Number(today.slice(0, 4)), taken);
    const lead = v.role === 'project_lead';
    const [row] = await tx.insert(capex).values({
      code, subsidiaryCode: sub, ...c.value, status: 'draft', phase: 'cadrage', sponsorUserId: v.role === 'sponsor' ? v.userId : null, leadUserId: lead ? v.userId : null,
    }).returning();
    if (lead) {
      await tx.insert(capexMembers).values({ capexId: row.id, userId: v.userId, capexRole: 'lead' });
      await tx.insert(roleAssignments).values({ userId: v.userId, role: 'project_lead', scopeKind: 'capex', scopeRef: code, createdByName: v.name });
    }
    await writeAudit(tx, auditOf(v, row, 'CAPEX created (draft)', { entityType: 'capex', entityId: row.id, after: { ...c.value, subsidiaryCode: sub } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'capex.created', text: `${code} created`, capexId: row.id });
    return { ok: true, code };
  });
  if (r.ok) revalidatePath('/capex');
  return r;
}

export async function updateSheetAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const subSites = new Set((await tx.select({ id: sites.id }).from(sites).where(eq(sites.subsidiaryCode, c.subsidiaryCode))).map((x) => x.id));
    const ch = checkSheet(fieldsOf(fd), { sites: subSites });
    if (!ch.ok) return ch;
    const before = { title: c.title, description: c.description, investmentType: c.investmentType, siteId: c.siteId, needDate: c.needDate };
    const changed = Object.keys(before).filter((k) => before[k as keyof typeof before] !== ch.value[k as keyof typeof ch.value]);
    if (!changed.length) return { ok: true };
    await tx.update(capex).set({ ...ch.value, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `identity sheet updated: ${changed.join(', ')}`, { entityType: 'capex', entityId: c.id, before, after: { ...ch.value } }));
    return { ok: true };
  });
}

export async function openCapexAction(code: string): Promise<ActionResult> {
  return onCapex(code, 'open', async (tx, c, v, today) => {
    const t = openCapex(c, !!c.leadUserId);
    if (!t.ok) return t;
    await tx.update(capex).set({ ...t.value, openedAt: new Date(), lifecycleModelVersion: MODEL_VERSION, sponsorUserId: c.sponsorUserId ?? v.userId, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await tx.insert(phaseTransitions).values({ capexId: c.id, fromStatus: c.status, fromPhase: c.phase, toStatus: t.value.status, toPhase: t.value.phase, effectiveOn: today, byName: v.name, byUserId: v.userId });
    await writeAudit(tx, auditOf(v, c, 'status: Draft → Active (phase 1)', { entityType: 'capex', entityId: c.id }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'capex.opened', text: `${c.code} opened: phase 1`, capexId: c.id });
    return { ok: true };
  });
}

// ── Lots ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function addLotAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const ch = checkLot(fieldsOf(fd));
    if (!ch.ok) return ch;
    const number = nextNumber((await lotsOf(tx, c.id)).map((l) => l.number));
    const [l] = await tx.insert(capexLots).values({ capexId: c.id, number, ...ch.value }).returning({ id: capexLots.id });
    await writeAudit(tx, auditOf(v, c, `lot ${number} added: ${ch.value.title}`, { entityType: 'lot', entityId: l.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

export async function removeLotAction(code: string, lotId: string): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const [l] = await tx.select().from(capexLots).where(and(eq(capexLots.id, lotId), eq(capexLots.capexId, c.id)));
    if (!l) return { ok: false, error: 'Unknown lot' };
    if (await tx.$count(budgetLines, eq(budgetLines.lotId, l.id))) return { ok: false, error: 'This lot is used by a budget version' };
    await tx.delete(capexLots).where(eq(capexLots.id, l.id));
    await writeAudit(tx, auditOf(v, c, `lot ${l.number} removed: ${l.title}`, { entityType: 'lot', entityId: l.id, before: { kind: l.kind, title: l.title } }));
    return { ok: true };
  });
}

// ── Budget versions (spec 03 §5) ──────────────────────────────────────────────────────────────────────────────────────

function readClass(raw: unknown): EstimateClass | null {
  return (ESTIMATE_CLASSES as readonly string[]).includes(String(raw)) ? (raw as EstimateClass) : null;
}

async function writeLines(tx: Tx, versionId: string, lines: { lotId: string; amountKeur: number }[]) {
  await tx.delete(budgetLines).where(eq(budgetLines.budgetVersionId, versionId));
  if (lines.length) await tx.insert(budgetLines).values(lines.map((l) => ({ budgetVersionId: versionId, ...l })));
}

/** Creates a draft version (one version in progress at a time), or updates the draft `versionId`. */
export async function saveBudgetVersionAction(code: string, versionId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v) => {
    const f = fieldsOf(fd);
    const cls = readClass(f.estimateClass);
    if (!cls) return { ok: false, error: 'Choose the estimate class' };
    const lots = await lotsOf(tx, c.id);
    if (!lots.length) return { ok: false, error: 'Add the lots of the CAPEX first' };
    const ch = checkBudgetLines(f, lots.map((l) => l.id));
    if (!ch.ok) return ch;
    const basis = (f.basis ?? '').trim().slice(0, 1000) || null;
    const versions = await versionsOf(tx, c.id);
    if (versionId) {
      const cur = versions.find((x) => x.id === versionId);
      if (!cur) return { ok: false, error: 'Unknown budget version' };
      if (cur.status !== 'draft') return { ok: false, error: 'Only a draft version can be changed' };
      await tx.update(budgetVersions).set({ estimateClass: cls, basis, updatedAt: new Date() }).where(eq(budgetVersions.id, cur.id));
      await writeLines(tx, cur.id, ch.value);
      await writeAudit(tx, auditOf(v, c, `budget version ${cur.number} updated (${cls})`, { entityType: 'budget_version', entityId: cur.id, after: { estimateClass: cls, lines: ch.value } }));
      return { ok: true };
    }
    if (versions.some((x) => x.status === 'draft' || x.status === 'submitted')) return { ok: false, error: 'Finish the version in progress first' };
    const number = nextNumber(versions.map((x) => x.number));
    const [bv] = await tx.insert(budgetVersions).values({ capexId: c.id, number, estimateClass: cls, basis, createdByName: v.name }).returning({ id: budgetVersions.id });
    await writeLines(tx, bv.id, ch.value);
    await writeAudit(tx, auditOf(v, c, `budget version ${number} created (${cls})`, { entityType: 'budget_version', entityId: bv.id, after: { estimateClass: cls, lines: ch.value } }));
    return { ok: true };
  });
}

export async function deleteDraftVersionAction(code: string, versionId: string): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v) => {
    const [bv] = await tx.select().from(budgetVersions).where(and(eq(budgetVersions.id, versionId), eq(budgetVersions.capexId, c.id)));
    if (!bv) return { ok: false, error: 'Unknown budget version' };
    if (bv.status !== 'draft') return { ok: false, error: 'Only a draft version can be deleted' };
    await tx.delete(budgetVersions).where(eq(budgetVersions.id, bv.id));
    await writeAudit(tx, auditOf(v, c, `budget version ${bv.number} deleted (draft)`, { entityType: 'budget_version', entityId: bv.id }));
    return { ok: true };
  });
}

export async function submitVersionAction(code: string, versionId: string): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v) => {
    const [bv] = await tx.select().from(budgetVersions).where(and(eq(budgetVersions.id, versionId), eq(budgetVersions.capexId, c.id)));
    if (!bv) return { ok: false, error: 'Unknown budget version' };
    if (!canMoveVersion(bv.status, 'submitted')) return { ok: false, error: 'Only a draft version can be submitted' };
    await tx.update(budgetVersions).set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() }).where(eq(budgetVersions.id, bv.id));
    await writeAudit(tx, auditOf(v, c, `budget version ${bv.number}: Draft → Submitted`, { entityType: 'budget_version', entityId: bv.id }));
    return { ok: true };
  });
}

/** The viewer may validate a version of this class on this CAPEX (E10: the group CFO; E50, E30: the controller or the CFO). */
function mayValidate(v: Viewer, c: Row, cls: EstimateClass): boolean {
  if (c.status !== 'active' && c.status !== 'draft') return false;
  return validatorsOf(cls).some((r) => v.role === r && holdsOn(v.assignments, r, c));
}

/**
 * Validation (validate) or return to draft (return, reason required) of a submitted version. A validated version freezes and
 * supersedes the previous validated one; the typology is recomputed (spec 06 §1): set directly the first time, otherwise a
 * different result waits for the group industrial director's confirmation; a forced typology is not recomputed.
 */
export async function reviewVersionAction(code: string, versionId: string, outcome: 'validate' | 'return', reason?: string): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v, today) => {
    const [bv] = await tx.select().from(budgetVersions).where(and(eq(budgetVersions.id, versionId), eq(budgetVersions.capexId, c.id)));
    if (!bv) return { ok: false, error: 'Unknown budget version' };
    if (!mayValidate(v, c, bv.estimateClass)) return { ok: false, error: bv.estimateClass === 'E10' ? 'Only the group CFO validates an E10 version' : REFUSED_MSG };
    if (bv.status !== 'submitted') return { ok: false, error: 'Only a submitted version can be reviewed' };
    if (outcome === 'return') {
      if (!reason?.trim()) return { ok: false, error: 'Give the reason for the return' };
      await tx.update(budgetVersions).set({ status: 'draft', updatedAt: new Date() }).where(eq(budgetVersions.id, bv.id));
      await writeAudit(tx, auditOf(v, c, `budget version ${bv.number}: Submitted → Draft (returned)`, { entityType: 'budget_version', entityId: bv.id, reason }));
      return { ok: true };
    }
    await tx.update(budgetVersions).set({ status: 'superseded', updatedAt: new Date() }).where(and(eq(budgetVersions.capexId, c.id), eq(budgetVersions.status, 'validated')));
    await tx.update(budgetVersions).set({ status: 'validated', validatedAt: new Date(), validatedByName: v.name, validatedByUserId: v.userId, updatedAt: new Date() }).where(eq(budgetVersions.id, bv.id));
    await writeAudit(tx, auditOf(v, c, `budget version ${bv.number}: Submitted → Validated (${bv.estimateClass})`, { entityType: 'budget_version', entityId: bv.id }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'budget.validated', text: `${c.code}: budget version ${bv.number} (${bv.estimateClass}) validated`, capexId: c.id });
    await recomputeTypology(tx, c, v, today);
    return { ok: true };
  });
}

async function recomputeTypology(tx: Tx, c: Row, v: Viewer, today: string) {
  if (c.typologySource === 'forced') return;
  const t = await computedTypologyOf(tx, c, today);
  if (!t.typology) return;
  if (!c.typology) {
    await tx.update(capex).set({ typology: t.typology, typologySource: 'computed', typologyProposed: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `typology: ${t.typology} (computed, ratio ${t.ratioPct ?? '—'} %)`, { entityType: 'capex', entityId: c.id }));
  } else if (t.typology !== c.typology) {
    await tx.update(capex).set({ typologyProposed: t.typology, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `typology to confirm: ${c.typology} → ${t.typology} (ratio ${t.ratioPct ?? '—'} %)`, { entityType: 'capex', entityId: c.id }));
  } else if (c.typologyProposed) {
    await tx.update(capex).set({ typologyProposed: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
  }
}

// ── Typology (C-5) ────────────────────────────────────────────────────────────────────────────────────────────────────

export async function forceTypologyAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'force_typology', async (tx, c, v) => {
    const f = fieldsOf(fd);
    const typology = f.typology as Typology;
    if (typology !== 'light' && typology !== 'strategic') return { ok: false, error: 'Choose the typology' };
    const reason = (f.reason ?? '').trim();
    if (reason.length < 3) return { ok: false, error: 'Give the reason for forcing the typology' };
    await tx.update(capex).set({ typology, typologySource: 'forced', typologyReason: reason, typologyProposed: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `typology forced: ${c.typology ?? '—'} → ${typology}`, { entityType: 'capex', entityId: c.id, reason }));
    return { ok: true };
  });
}

export async function confirmTypologyAction(code: string): Promise<ActionResult> {
  return onCapex(code, 'confirm_typology', async (tx, c, v) => {
    if (!c.typologyProposed) return { ok: false, error: 'No typology waits for confirmation' };
    await tx.update(capex).set({ typology: c.typologyProposed, typologySource: 'computed', typologyReason: null, typologyProposed: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `typology confirmed: ${c.typology ?? '—'} → ${c.typologyProposed}`, { entityType: 'capex', entityId: c.id }));
    return { ok: true };
  });
}

// ── Team (spec 06 §2) ─────────────────────────────────────────────────────────────────────────────────────────────────

export async function addMemberAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const f = fieldsOf(fd);
    const role = TEAM_ROLES.find((r) => r === f.capexRole);
    if (!role) return { ok: false, error: 'Choose the role in the team' };
    const [u] = await tx.select().from(users).where(eq(users.id, f.userId ?? ''));
    // Isolation: a person of another subsidiary is never named on this CAPEX (they would see it).
    if (!u || !u.active || (u.subsidiaryCode && u.subsidiaryCode !== c.subsidiaryCode)) return { ok: false, error: 'Choose a person of the subsidiary or of the group' };
    const team = await teamOf(tx, c.id);
    if (team.some((m) => m.userId === u.id && m.capexRole === role)) return { ok: false, error: 'The person already holds this role in the team' };
    if (role === 'lead' && team.some((m) => m.capexRole === 'lead')) return { ok: false, error: 'The CAPEX already has a project lead' };
    const [m] = await tx.insert(capexMembers).values({ capexId: c.id, userId: u.id, capexRole: role }).returning({ id: capexMembers.id });
    const scoped = ROLE_OF_TEAM_ROLE[role];
    if (scoped) {
      const held = await tx.select({ id: roleAssignments.id }).from(roleAssignments).where(and(eq(roleAssignments.userId, u.id), eq(roleAssignments.role, scoped), eq(roleAssignments.scopeRef, c.code)));
      if (!held.length) await tx.insert(roleAssignments).values({ userId: u.id, role: scoped, scopeKind: 'capex', scopeRef: c.code, createdByName: v.name });
    }
    if (role === 'lead') await tx.update(capex).set({ leadUserId: u.id, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `team: ${u.displayName} added as ${role}`, { entityType: 'capex_member', entityId: m.id }));
    return { ok: true };
  });
}

export async function removeMemberAction(code: string, memberId: string): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const [m] = await tx.select().from(capexMembers).where(and(eq(capexMembers.id, memberId), eq(capexMembers.capexId, c.id)));
    if (!m) return { ok: false, error: 'Unknown team member' };
    const [u] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, m.userId));
    await tx.delete(capexMembers).where(eq(capexMembers.id, m.id));
    const scoped = ROLE_OF_TEAM_ROLE[m.capexRole];
    if (scoped) await tx.delete(roleAssignments).where(and(eq(roleAssignments.userId, m.userId), eq(roleAssignments.role, scoped), eq(roleAssignments.scopeKind, 'capex'), eq(roleAssignments.scopeRef, c.code)));
    if (m.capexRole === 'lead') await tx.update(capex).set({ leadUserId: null, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await writeAudit(tx, auditOf(v, c, `team: ${u?.name ?? '—'} removed (${m.capexRole})`, { entityType: 'capex_member', entityId: m.id }));
    return { ok: true };
  });
}

// ── Risks and decisions ───────────────────────────────────────────────────────────────────────────────────────────────

export async function saveRiskAction(code: string, riskId: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v) => {
    const people = new Set((await teamOf(tx, c.id)).map((m) => m.userId).concat(c.sponsorUserId ? [c.sponsorUserId] : []));
    const ch = checkRisk(fieldsOf(fd), { people });
    if (!ch.ok) return ch;
    if (riskId) {
      const [r] = await tx.select().from(risks).where(and(eq(risks.id, riskId), eq(risks.capexId, c.id)));
      if (!r) return { ok: false, error: 'Unknown risk' };
      await tx.update(risks).set({ ...ch.value, updatedAt: new Date() }).where(eq(risks.id, r.id));
      await writeAudit(tx, auditOf(v, c, `risk ${refOf('R', r.number)} updated`, { entityType: 'risk', entityId: r.id, before: { status: r.status, probability: r.probability, impact: r.impact }, after: { ...ch.value } }));
      return { ok: true };
    }
    const number = nextNumber((await tx.select({ n: risks.number }).from(risks).where(eq(risks.capexId, c.id))).map((x) => x.n));
    const [r] = await tx.insert(risks).values({ capexId: c.id, number, ...ch.value }).returning({ id: risks.id });
    await writeAudit(tx, auditOf(v, c, `risk ${refOf('R', number)} added: ${ch.value.title}`, { entityType: 'risk', entityId: r.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

export async function addDecisionAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v, today) => {
    const ch = checkDecision(fieldsOf(fd), today);
    if (!ch.ok) return ch;
    const number = nextNumber((await tx.select({ n: decisions.number }).from(decisions).where(eq(decisions.capexId, c.id))).map((x) => x.n));
    const [d] = await tx.insert(decisions).values({ capexId: c.id, number, ...ch.value, recordedByName: v.name }).returning({ id: decisions.id });
    await writeAudit(tx, auditOf(v, c, `decision ${refOf('D', number)} recorded`, { entityType: 'decision', entityId: d.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

// ── Suspension (spec 03 §1); gate decisions go through the circuits (src/features/gates/actions.ts) ──────────────────

export async function suspendAction(code: string, outcome: 'suspend' | 'resume', reason: string): Promise<ActionResult> {
  return onCapex(code, 'suspend', async (tx, c, v, today) => {
    if (!reason?.trim()) return { ok: false, error: 'Give the reason for the decision' };
    const t = outcome === 'suspend' ? suspend(c as CycleState) : resume(c as CycleState);
    if (!t.ok) return t;
    await tx.update(capex).set({ status: t.value.status, updatedAt: new Date() }).where(eq(capex.id, c.id));
    await tx.insert(phaseTransitions).values({ capexId: c.id, fromStatus: c.status, fromPhase: c.phase, toStatus: t.value.status, toPhase: t.value.phase, effectiveOn: today, reason: reason.trim(), byName: v.name, byUserId: v.userId });
    await writeAudit(tx, auditOf(v, c, outcome === 'suspend' ? 'status: Active → On hold' : 'status: On hold → Active', { entityType: 'capex', entityId: c.id, reason }));
    return { ok: true };
  });
}

// ── Business plan (spec 06 §4; N-11) ─────────────────────────────────────────────────────────────────────────────────

/** The controller or the project lead types the business plan; a change after the CFO's validation clears it. */
export async function saveBusinessPlanAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v) => {
    const ch = checkBusinessPlan(fieldsOf(fd), BP_HORIZON);
    if (!ch.ok) return ch;
    const row = { horizonYears: BP_HORIZON, discountRatePct: ch.value.discountRatePct, flows: ch.value.years, updatedByName: v.name, validatedByName: null, validatedAt: null, updatedAt: new Date() };
    await tx.insert(businessPlans).values({ capexId: c.id, ...row }).onConflictDoUpdate({ target: businessPlans.capexId, set: row });
    await writeAudit(tx, auditOf(v, c, `business plan updated (rate ${ch.value.discountRatePct} %)`, { entityType: 'business_plan', entityId: c.id, after: { ...ch.value } }));
    return { ok: true };
  });
}

/** The group CFO validates the business plan (Dossier 2, spec 01 §3). */
export async function validateBusinessPlanAction(code: string): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v) => {
    if (v.role !== 'group_cfo' || !holdsOn(v.assignments, 'group_cfo', c) || (c.status !== 'active' && c.status !== 'draft')) return { ok: false, error: 'Only the group CFO validates the business plan' };
    const [b] = await tx.select().from(businessPlans).where(eq(businessPlans.capexId, c.id));
    if (!b) return { ok: false, error: 'There is no business plan yet' };
    if (b.validatedAt) return { ok: true };
    await tx.update(businessPlans).set({ validatedByName: v.name, validatedAt: new Date(), updatedAt: new Date() }).where(eq(businessPlans.capexId, c.id));
    await writeAudit(tx, auditOf(v, c, 'business plan validated by the group CFO', { entityType: 'business_plan', entityId: c.id }));
    return { ok: true };
  });
}
