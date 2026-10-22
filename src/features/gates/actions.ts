'use server';
// Gate circuits Server Functions (docs/spec/05): the project lead submits the gate the CAPEX faces — on the frozen version of
// its dossier (none at K3) — which starts a session and instantiates its circuit (src/domain/circuits.ts); each actor then
// acts on the step that is theirs: opinion, review, visa, decision, signature, countersignature, discharge, attestation. A
// signed step needs a recent authentication (10 minutes, N-8) and leaves an append-only signature carrying the SHA-256 of the
// version. A refusal stops the circuit; when every required step is done, the deciding step's outcome is applied to the CAPEX
// (src/server/cycle/gate-decision.ts) with the criteria evaluated then, forced with a reason by the decider when forcible.
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import {
  canActOn, checkOutcome, REAUTH_ERROR, circuitFacts, circuitTemplate, decisionOf, dueOf, isRefusal, isSigned, openGroup, refreshStatuses, STEP_KIND_LABEL,
  type Outcome, type StepActor, type StepKind, type StepState,
} from '@/domain/circuits';
import { DOSSIER_LABEL, DOSSIER_OF_GATE } from '@/domain/dossiers';
import { CRITERIA, currentGate, decideGate, evaluateGate, type CycleState, type GateCode } from '@/domain/lifecycle';
import { withPssrDischarge } from '@/domain/safety';
import { EXPERT_SPECIALITIES } from '@/config/roles';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { circuitSteps, dossierVersions, gates, signatures } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { auditOf, fieldsOf, onCapex, REFUSED, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { applyGateDecision } from '@/server/cycle/gate-decision';
import { gateFacts, modelValues, nextSession, teamOf } from '@/server/dal/cycle';
import { dossierVersionsOf, runningSession, stepsOf, type StepRow } from '@/server/dal/dossiers';

/** A signature needs the credentials entered within the last 10 minutes (N-8). */
const REAUTH_MS = 10 * 60 * 1000;

const asState = (s: StepRow): StepState & { actor: StepActor } => ({
  id: s.id, group: s.group, kind: s.kind as StepKind, optional: s.optional, decides: s.decides, status: s.status, outcome: (s.outcome as Outcome | null) ?? null, actor: s.actor as StepActor,
});

/** Writes the statuses the engine computes; a step that opens gets its opening date and deadline. */
async function syncStatuses(tx: Tx, gate: GateCode, steps: StepRow[], today: string) {
  const values = await modelValues(tx);
  const next = refreshStatuses(steps.map(asState));
  for (const n of next) {
    const s = steps.find((x) => x.id === n.id)!;
    if (n.status === s.status) continue;
    const opening = n.status === 'open' && s.status === 'waiting';
    await tx.update(circuitSteps).set({ status: n.status, ...(opening ? { openedOn: today, dueOn: dueOf(s.kind as StepKind, gate, today, values) } : {}), updatedAt: new Date() }).where(eq(circuitSteps.id, s.id));
  }
}

/** The frozen version a gate session decides on: the latest version of the gate's dossier, frozen. */
async function frozenVersionFor(tx: Tx, c: CapexRowFull, gate: GateCode) {
  const kind = DOSSIER_OF_GATE[gate];
  if (!kind) return { kind: null, version: null };
  const [latest] = await dossierVersionsOf(tx, c.id, kind);
  return { kind, version: latest?.state === 'frozen' ? latest : null };
}

/** The project lead (or the sponsor) submits the gate the CAPEX faces; optional experts named per speciality (`expert:<speciality>`). */
export async function submitGateAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'edit', async (tx, c, v, today) => {
    const gate = currentGate(c);
    if (!gate) return { ok: false, error: 'The CAPEX faces no gate' };
    if (await runningSession(tx, c.id)) return { ok: false, error: 'A circuit is already running for this gate' };
    const { kind, version } = await frozenVersionFor(tx, c, gate);
    if (kind && !version) return { ok: false, error: 'Freeze the dossier before submitting the gate' };
    if (version && version.completenessPct < 100) return { ok: false, error: 'The dossier must be complete (100 %) to be submitted' };
    const f = fieldsOf(fd);
    const team = await teamOf(tx, c.id);
    const tpl = circuitTemplate(gate, c.typology as 'light' | 'strategic' | null);
    const session = await nextSession(tx, c.id, gate);
    const [g] = await tx.insert(gates).values({ capexId: c.id, code: gate, session, status: 'in_review', dossierVersionId: version?.id ?? null }).returning({ id: gates.id });
    await tx.insert(circuitSteps).values(tpl.map((s, i) => {
      const named = s.speciality && (EXPERT_SPECIALITIES as readonly string[]).includes(s.speciality) ? f[`expert:${s.speciality}`]?.trim() || null : null;
      const internalClient = s.actor === 'internal_client' ? team.find((m) => m.capexRole === 'internal_client')?.userId ?? null : null;
      return {
        gateId: g.id, position: i + 1, group: s.group, kind: s.kind, actor: s.actor, speciality: s.speciality ?? null, label: s.label, optional: !!s.optional, decides: !!s.decides,
        assigneeUserId: named ?? internalClient,
      };
    }));
    await syncStatuses(tx, gate, await stepsOf(tx, [g.id]), today);
    const what = version && kind ? ` on ${DOSSIER_LABEL[kind]} v${version.number}` : '';
    await writeAudit(tx, auditOf(v, c, `${gate} session ${session} submitted${what}`, { entityType: 'gate', entityId: g.id }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'gate.submitted', text: `${c.code}: ${gate} submitted`, capexId: c.id });
    return { ok: true };
  });
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || null;
  return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;
}

/**
 * Acts on a step of the running circuit (fields: outcome, comment; confirm = "on" for a signed step; on the deciding step,
 * conditions — one per line — and `force:<criterion>` reasons).
 */
export async function actOnStepAction(code: string, stepId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ip = await clientIp();
  return onCapex(code, null, async (tx, c, v, today) => {
    const [row] = await tx.select().from(circuitSteps).where(eq(circuitSteps.id, stepId));
    if (!row) return { ok: false, error: 'Unknown step' };
    const [g] = await tx.select().from(gates).where(eq(gates.id, row.gateId));
    if (!g || g.capexId !== c.id || g.status !== 'in_review') return { ok: false, error: 'This circuit is not running' };
    const team = await teamOf(tx, c.id);
    const actor = { role: v.role, userId: v.userId, assignments: v.assignments, internalClient: team.some((m) => m.userId === v.userId && m.capexRole === 'internal_client') };
    if (!canActOn({ actor: row.actor as StepActor, speciality: row.speciality, assigneeUserId: row.assigneeUserId }, actor, c)) return REFUSED;
    // A suspended, closed or abandoned CAPEX is read-only.
    if (c.status !== 'active') return REFUSED;
    const f = fieldsOf(fd);
    const comment = f.comment?.trim() || null;
    const ch = checkOutcome(asState({ ...row, assigneeName: null }), f.outcome, comment);
    if (!ch.ok) return ch;
    const outcome = ch.value;
    const signed = isSigned(row.kind as StepKind);
    const version = g.dossierVersionId ? (await tx.select().from(dossierVersions).where(eq(dossierVersions.id, g.dossierVersionId)))[0] ?? null : null;
    if (signed) {
      if (f.confirm !== 'on') return { ok: false, error: 'Confirm the statement to sign' };
      if (!v.demo && (!v.authenticatedAt || Date.now() - v.authenticatedAt.getTime() > REAUTH_MS)) return { ok: false, error: REAUTH_ERROR };
    }

    // The steps once this one is done: the decision happens when no required step is left.
    const steps = await stepsOf(tx, [g.id]);
    const after = refreshStatuses(steps.map((s) => (s.id === row.id ? { ...asState(s), status: 'done' as const, outcome } : asState(s))));
    const refused = isRefusal(outcome);
    const complete = !refused && openGroup(after) == null;
    let decided: { decision: NonNullable<ReturnType<typeof decisionOf>>; next: CycleState; ev: ReturnType<typeof evaluateGate>; conditions: string[]; reason: string | null } | null = null;
    if (complete) {
      const deciding = after.find((s) => s.decides);
      const decision = deciding ? decisionOf(deciding) : null;
      if (!decision) return { ok: false, error: 'The circuit has no decision' };
      const forced = Object.fromEntries(CRITERIA.filter((x) => x.gate === g.code && f[`force:${x.code}`]?.trim()).map((x) => [x.code, f[`force:${x.code}`].trim()]));
      const dossierFact = version ? { [`${g.code.toLowerCase()}_dossier`]: { met: version.completenessPct === 100, value: `v${version.number} · ${version.completenessPct} %` } } : {};
      const facts = { ...(await gateFacts(tx, c)), ...circuitFacts(g.code, after), ...dossierFact };
      const ev = evaluateGate(g.code, withPssrDischarge(facts), forced);
      const conditions = (f.conditions ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
      const t = decideGate(c as CycleState, g.code, decision, ev, { reason: comment, conditions });
      if (!t.ok) return t;
      decided = { decision, next: t.value, ev, conditions, reason: comment };
    }

    await tx.update(circuitSteps).set({ status: 'done', outcome, comment, actedByName: v.name, actedByUserId: v.userId, actedAt: new Date(), updatedAt: new Date() }).where(eq(circuitSteps.id, row.id));
    if (signed) {
      const statement = `${row.label} — ${c.code}, ${g.code} session ${g.session}${version ? `, dossier version ${version.number}, SHA-256 ${version.contentHash}` : ''}: ${outcome}`;
      await tx.insert(signatures).values({ circuitStepId: row.id, userId: v.userId, userName: v.name, contentHash: version?.contentHash ?? null, statement, authTime: v.authenticatedAt ?? null, ipHash: ip });
    }
    await writeAudit(tx, auditOf(v, c, `${g.code} session ${g.session}: ${STEP_KIND_LABEL[row.kind as StepKind].toLowerCase()} "${row.label}" — ${outcome}`, { entityType: 'circuit_step', entityId: row.id, reason: comment }));

    if (refused) {
      // A refusal stops the circuit and sends the dossier back (spec 05 §1).
      await tx.update(gates).set({ status: 'returned', updatedAt: new Date() }).where(eq(gates.id, g.id));
      for (const s of steps.filter((x) => x.id !== row.id && (x.status === 'open' || x.status === 'waiting'))) await tx.update(circuitSteps).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(circuitSteps.id, s.id));
      if (version) await tx.update(dossierVersions).set({ state: 'rejected', updatedAt: new Date() }).where(eq(dossierVersions.id, version.id));
      await writeAudit(tx, auditOf(v, c, `${g.code} session ${g.session}: circuit stopped (refused), dossier sent back`, { entityType: 'gate', entityId: g.id, reason: comment }));
      return { ok: true };
    }
    if (decided) {
      for (const s of steps.filter((x) => x.id !== row.id && (x.status === 'open' || x.status === 'waiting'))) await tx.update(circuitSteps).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(circuitSteps.id, s.id));
      await applyGateDecision(tx, c, v, { id: g.id, code: g.code, session: g.session }, decided.decision, decided.next, decided.ev, { reason: decided.reason, conditions: decided.conditions, today });
      if (version) {
        const state = decided.decision === 'go' || decided.decision === 'go_with_conditions' ? 'approved' : decided.decision === 'no_go' ? 'rejected' : 'frozen';
        if (state !== 'frozen') await tx.update(dossierVersions).set({ state, updatedAt: new Date() }).where(eq(dossierVersions.id, version.id));
      }
      return { ok: true };
    }
    await syncStatuses(tx, g.code, await stepsOf(tx, [g.id]), today);
    return { ok: true };
  });
}
