import 'server-only';
// Indicators of the DIG-PRODI objectives (C-10, pilot): measured on the CAPEX the viewer sees (visibleCapex), compared with
// the reference of the existing process (kpi_baselines). The rules are in src/domain/kpi.ts.
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { workingDaysBetween } from '@/domain/circuits';
import { KPI_KEYS, kpiView, measureKpis, type KpiKey, type SessionFact } from '@/domain/kpi';
import type { GateCode } from '@/domain/lifecycle';
import { getDb } from '@/server/db/client';
import { budgetVersions, capex, circuitSteps, dossiers, dossierVersions, gates, kpiBaselines, signatures } from '@/server/db/schema';
import type { Viewer } from '@/server/viewer';
import { visibleCapex } from './capex';

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export async function pilotIndicators(viewer: Viewer) {
  const db = await getDb();
  const seen = await visibleCapex(viewer);
  const ids = seen.map((c) => c.id);
  const codeOf = new Map(seen.map((c) => [c.id, c.code]));
  const baselines = await db.select().from(kpiBaselines);
  const sessions = ids.length
    ? await db.select().from(gates).where(and(inArray(gates.capexId, ids), eq(gates.status, 'decided'), eq(gates.takenOver, false), isNotNull(gates.decidedAt)))
    : [];
  const gateIds = sessions.map((g) => g.id);
  const deciding = gateIds.length
    ? await db.select({ id: circuitSteps.id, gateId: circuitSteps.gateId }).from(circuitSteps).where(and(inArray(circuitSteps.gateId, gateIds), eq(circuitSteps.decides, true), eq(circuitSteps.status, 'done')))
    : [];
  const signed = deciding.length
    ? new Set((await db.select({ stepId: signatures.circuitStepId }).from(signatures).where(inArray(signatures.circuitStepId, deciding.map((s) => s.id)))).map((s) => s.stepId))
    : new Set<string>();
  const signedGates = new Set(deciding.filter((s) => signed.has(s.id)).map((s) => s.gateId));
  const versionIds = sessions.map((g) => g.dossierVersionId).filter((x): x is string => !!x);
  const versions = versionIds.length ? await db.select({ id: dossierVersions.id, content: dossierVersions.content, kind: dossiers.kind }).from(dossierVersions).innerJoin(dossiers, eq(dossiers.id, dossierVersions.dossierId)).where(inArray(dossierVersions.id, versionIds)) : [];
  // Every section stored, whatever the template of the version (AR-052).
  const refsOf = new Map(versions.map((v) => [v.id, Object.values(((v.content as { sections?: Record<string, { refs?: unknown[] }> }).sections) ?? {}).reduce((n, s) => n + (Array.isArray(s?.refs) ? s.refs.length : 0), 0)]));
  const facts: (SessionFact & { capexCode: string; session: number })[] = sessions.map((g) => {
    const submittedOn = dayOf(g.createdAt);
    const decidedOn = dayOf(g.decidedAt!);
    return {
      capexCode: codeOf.get(g.capexId) ?? '', session: g.session, code: g.code as GateCode, submittedOn, decidedOn,
      delayDays: Math.max(0, workingDaysBetween(submittedOn, decidedOn)),
      documents: g.dossierVersionId ? (refsOf.get(g.dossierVersionId) ?? 0) : null,
      signed: signedGates.has(g.id),
    };
  }).sort((a, b) => b.decidedOn.localeCompare(a.decidedOn) || a.capexCode.localeCompare(b.capexCode));
  // Budget validations: traced when validated by a named account; those typed at a takeover (before Arche) are left out.
  const budgets = ids.length
    ? await db.select({ by: budgetVersions.validatedByUserId, at: budgetVersions.validatedAt, takenOverAt: capex.takenOverAt }).from(budgetVersions)
      .innerJoin(capex, eq(capex.id, budgetVersions.capexId)).where(and(inArray(budgetVersions.capexId, ids), isNotNull(budgetVersions.validatedAt)))
    : [];
  const counted = budgets.filter((b) => b.by || !b.takenOverAt || (b.at && b.at > b.takenOverAt));
  const measures = measureKpis(facts, { traced: counted.filter((b) => !!b.by).length, total: counted.length });
  const ref = new Map(baselines.map((b) => [b.key, b]));
  return {
    kpis: KPI_KEYS.map((k: KpiKey) => ({ ...kpiView(k, measures[k], ref.get(k)?.value ?? null), baseline: ref.get(k) ?? null })),
    sessions: facts,
    takenOver: (ids.length ? await db.$count(gates, and(inArray(gates.capexId, ids), eq(gates.takenOver, true))) : 0),
  };
}
