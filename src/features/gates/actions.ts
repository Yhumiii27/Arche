'use server';
// Gate circuits Server Functions (docs/spec/05): the project lead submits the gate the CAPEX faces — on the frozen version of
// its dossier (none at K3) — which starts a session and instantiates its circuit (src/domain/circuits.ts); each actor then
// acts on the step that is theirs: opinion, review, visa, decision, signature, countersignature, discharge, attestation. A
// signed step needs a recent authentication (10 minutes, N-8) and leaves an append-only signature carrying the SHA-256 of the
// version. A refusal stops the circuit; when every required step is done, the deciding step's outcome is applied to the CAPEX
// (src/server/cycle/gate-decision.ts) with the criteria evaluated then, forced with a reason by the decider when forcible. The
// G2 decision is signed at the advanced level when a provider is configured (AR-037).
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { checkOutcome, isSigned, REAUTH_ERROR, type StepKind } from '@/domain/circuits';
import { DOSSIER_LABEL, DOSSIER_OF_GATE } from '@/domain/dossiers';
import { currentGate, type GateCode } from '@/domain/lifecycle';
import { isAdvancedStep } from '@/domain/signature';
import { isStale, ROW_VERSION_FIELD, STALE_MSG } from '@/domain/concurrency';
import { EXPERT_SPECIALITIES } from '@/config/roles';
import { getConfig } from '@/server/config';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { circuitSteps, gates } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { auditOf, fieldsOf, onCapex, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { applyStep, asState, planStep, stepForActor, syncStatuses, type StepInput } from '@/server/cycle/step';
import { nextSession, teamOf } from '@/server/dal/cycle';
import { circuitFor } from '@/server/dal/designs';
import { dossierVersionsOf, runningSession, stepsOf } from '@/server/dal/dossiers';
import { launchSignatureRequest, openSignatureRequest } from '@/server/signature/advanced';

/** A signature needs the credentials entered within the last 10 minutes (N-8). */
const REAUTH_MS = 10 * 60 * 1000;

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
    // The published circuit of the gate (AR-052), else the built-in one.
    const tpl = await circuitFor(tx, gate, c.typology as 'light' | 'strategic' | null);
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
 * conditions — one per line — and `force:<criterion>` reasons). The G2 decision, when an advanced signature provider is
 * configured (AR-037), is not written here: the choices wait in a signature request and the signer is sent to the provider;
 * the step is completed when they come back signed (src/features/gates/signature.ts).
 */
export async function actOnStepAction(code: string, stepId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ip = await clientIp();
  const provider = getConfig().signature.provider;
  const r = await onCapex(code, null, async (tx, c, v, today) => {
    const who = await stepForActor(tx, c, v, stepId, today);
    if (!who.ok) return who;
    const { row, g, onBehalfOf } = who;
    if (isStale(fd.get(ROW_VERSION_FIELD), row.rowVersion)) return { ok: false, error: STALE_MSG };
    const f = fieldsOf(fd);
    const comment = f.comment?.trim() || null;
    const ch = checkOutcome(asState({ ...row, assigneeName: null }), f.outcome, comment);
    if (!ch.ok) return ch;
    const input: StepInput = {
      outcome: ch.value, comment,
      conditions: (f.conditions ?? '').split('\n').map((x) => x.trim()).filter(Boolean),
      forced: Object.fromEntries(Object.entries(f).filter(([k, x]) => k.startsWith('force:') && x.trim()).map(([k, x]) => [k.slice(6), x.trim()])),
    };
    const signed = isSigned(row.kind as StepKind);
    if (signed) {
      if (f.confirm !== 'on') return { ok: false, error: 'Confirm the statement to sign' };
      if (!v.demo && (!v.authenticatedAt || Date.now() - v.authenticatedAt.getTime() > REAUTH_MS)) return { ok: false, error: REAUTH_ERROR };
    }
    const planned = await planStep(tx, c, row, g, input);
    if (!planned.ok) return planned;
    if (signed && provider !== 'none' && isAdvancedStep(provider, g.code, { kind: row.kind, decides: row.decides })) {
      return openSignatureRequest(tx, c, v, row, g, planned.plan, input, onBehalfOf, provider);
    }
    return applyStep(tx, c, v, today, row, g, planned.plan, input, { onBehalfOf, ipHash: ip, level: 'simple', providerRef: null });
  });
  if (r.ok && r.requestId) return launchSignatureRequest(r.requestId);
  return r;
}
