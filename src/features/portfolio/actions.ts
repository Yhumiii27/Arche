'use server';
// Portfolio decisions Server Functions (delivery 7, lot 7c): the weights of the prioritisation grid (the group industrial
// director), the group's scores of a CAPEX on the manual criteria (the director, the group CFO, a COPIL GPI member) (AR-044); the
// portfolio scenarios — created and changed by the director or the group CFO, retained for the COPIL GPI by the director (AR-043).
// Each one checks the active role server-side, validates its input with the pure rules and audits.
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { RoleKey } from '@/config/roles';
import { checkItems, checkScenario } from '@/domain/scenarios';
import { checkScores, checkWeights, SCORERS, SCORING_CRITERIA } from '@/domain/scoring';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { capexScores, portfolioScenarios, scenarioItems, scoringWeights } from '@/server/db/schema';
import { auditOf, fieldsOf, onCapex, REFUSED, type ActionResult } from '@/server/capex/write';
import { scenarioCapex } from '@/server/dal/priority';
import { getViewer, type Viewer } from '@/server/session';

const SCENARIO_EDITORS: readonly RoleKey[] = ['dir_ig', 'group_cfo'];

async function as(roles: readonly RoleKey[]): Promise<Viewer | null> {
  const v = await getViewer();
  return roles.includes(v.role) ? v : null;
}
const audit = (v: Viewer, objectRef: string, change: string, extra: { entityType?: string; entityId?: string; before?: Record<string, unknown>; after?: Record<string, unknown> } = {}) => ({
  actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef, change, area: 'Portfolio', ...extra,
});

export async function saveWeightsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await as(['dir_ig']);
  if (!v) return { ok: false, error: 'This action is reserved to the group industrial director' };
  const ch = checkWeights(fieldsOf(fd));
  if (!ch.ok) return ch;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const before = Object.fromEntries((await tx.select().from(scoringWeights)).map((r) => [r.code, r.weight]));
    for (const c of SCORING_CRITERIA) {
      const row = { code: c.code, weight: ch.value[c.code], updatedByName: v.name, updatedAt: new Date() };
      await tx.insert(scoringWeights).values(row).onConflictDoUpdate({ target: scoringWeights.code, set: row });
    }
    await writeAudit(tx, audit(v, 'Prioritisation grid', 'weights of the grid changed', { before, after: ch.value }));
  });
  revalidatePath('/portfolio');
  return { ok: true };
}

/** The group's scores of a CAPEX on the manual criteria (a criterion left empty keeps its score). */
export async function scoreCapexAction(code: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, null, async (tx, c, v) => {
    if (!(SCORERS as readonly string[]).includes(v.role)) return REFUSED;
    const ch = checkScores(fieldsOf(fd));
    if (!ch.ok) return ch;
    if (!ch.value.length) return { ok: false, error: 'Score at least one criterion' };
    for (const s of ch.value) {
      const row = { capexId: c.id, criterionCode: s.code, score: s.score, note: s.note, scoredByName: v.name, scoredAt: new Date() };
      await tx.insert(capexScores).values(row).onConflictDoUpdate({ target: [capexScores.capexId, capexScores.criterionCode], set: row });
    }
    await writeAudit(tx, auditOf(v, c, `priority scores: ${ch.value.map((s) => `${s.code} ${s.score}`).join(', ')}`, { entityType: 'capex', entityId: c.id, after: { scores: ch.value } }));
    revalidatePath('/portfolio');
    return { ok: true };
  });
}

/** A new scenario (heading only): its CAPEX are all kept, not shifted, until changed. */
export async function createScenarioAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await as(SCENARIO_EDITORS);
  if (!v) return { ok: false, error: 'This action is reserved to the group industrial director and the group CFO' };
  const ch = checkScenario(fieldsOf(fd));
  if (!ch.ok) return ch;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [s] = await tx.insert(portfolioScenarios).values({ ...ch.value, createdByName: v.name }).returning({ id: portfolioScenarios.id });
    await writeAudit(tx, audit(v, `Scenario ${ch.value.name}`, `scenario created (${ch.value.kind})`, { entityType: 'scenario', entityId: s.id, after: { ...ch.value } }));
  });
  revalidatePath('/scenarios');
  return { ok: true };
}

/** A scenario's heading, envelopes and CAPEX (kept or left out, shifted). */
export async function updateScenarioAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await as(SCENARIO_EDITORS);
  if (!v) return { ok: false, error: 'This action is reserved to the group industrial director and the group CFO' };
  const f = fieldsOf(fd);
  const ch = checkScenario(f);
  if (!ch.ok) return ch;
  const db = await getDb();
  const today = await businessToday(db);
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [s] = await tx.select().from(portfolioScenarios).where(eq(portfolioScenarios.id, id));
    if (!s) return { ok: false, error: 'Unknown scenario' };
    const ids = (await scenarioCapex(tx, today)).map((c) => c.id);
    const items = checkItems(f, ids);
    if (!items.ok) return items;
    await tx.update(portfolioScenarios).set({ ...ch.value, updatedAt: new Date() }).where(eq(portfolioScenarios.id, s.id));
    await tx.delete(scenarioItems).where(eq(scenarioItems.scenarioId, s.id));
    const changed = items.value.filter((i) => !i.included || i.shiftMonths !== 0);
    if (changed.length) await tx.insert(scenarioItems).values(changed.map((i) => ({ scenarioId: s.id, ...i })));
    await writeAudit(tx, audit(v, `Scenario ${ch.value.name}`, `scenario changed: ${items.value.filter((i) => !i.included).length} CAPEX left out, ${items.value.filter((i) => i.included && i.shiftMonths).length} shifted`, {
      entityType: 'scenario', entityId: s.id, after: { ...ch.value, items: changed },
    }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/scenarios');
  return r;
}

/** Retains the scenario for the COPIL GPI (the one retained before is no longer). */
export async function retainScenarioAction(id: string): Promise<ActionResult> {
  const v = await as(['dir_ig']);
  if (!v) return { ok: false, error: 'This action is reserved to the group industrial director' };
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [s] = await tx.select().from(portfolioScenarios).where(eq(portfolioScenarios.id, id));
    if (!s) return { ok: false, error: 'Unknown scenario' };
    await tx.update(portfolioScenarios).set({ retained: false, updatedAt: new Date() }).where(eq(portfolioScenarios.retained, true));
    await tx.update(portfolioScenarios).set({ retained: true, retainedByName: v.name, updatedAt: new Date() }).where(eq(portfolioScenarios.id, s.id));
    await writeAudit(tx, audit(v, `Scenario ${s.name}`, 'scenario retained for the COPIL GPI', { entityType: 'scenario', entityId: s.id }));
    return { ok: true };
  });
  if (r.ok) {
    revalidatePath('/scenarios');
    revalidatePath('/copil');
  }
  return r;
}
