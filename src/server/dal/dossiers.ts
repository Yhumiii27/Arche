import 'server-only';
// Reads of the living dossiers, gate circuits, business plan, changes and delegation matrix of one CAPEX (delivery 3). Like
// ./cycle.ts, these take the id of a CAPEX already read through the visibility filter or locked by a writer.
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, lte, ne } from 'drizzle-orm';
import { irr, npv, payback } from '@/domain/bp';
import { meetsClass } from '@/domain/budget';
import { canonicalJson, completeness, readContent, type ComputedFacts, type DossierKind } from '@/domain/dossiers';
import { readMatrix, type DelegationMatrix } from '@/domain/delegation';
import type { GateCode } from '@/domain/lifecycle';
import {
  businessPlans, changes, circuitSteps, delegationMatrices, dossiers, dossierVersions, gates, signatures, users,
} from '@/server/db/schema';
import { sectionsFor } from './designs';
import type { DB, Tx } from '@/server/db/types';
import { latestValidated, lotsOf, risksOf, teamOf, versionsOf } from './cycle';

type Q = DB | Tx;

/** The dossier of a kind, created on first use. */
export async function ensureDossier(q: Q, capexId: string, kind: DossierKind): Promise<string> {
  const [d] = await q.select({ id: dossiers.id }).from(dossiers).where(and(eq(dossiers.capexId, capexId), eq(dossiers.kind, kind)));
  if (d) return d.id;
  const [n] = await q.insert(dossiers).values({ capexId, kind }).returning({ id: dossiers.id });
  return n.id;
}

/** Versions of a dossier, newest first (none before the first edit). */
export async function dossierVersionsOf(q: Q, capexId: string, kind: DossierKind) {
  return q
    .select({ v: dossierVersions })
    .from(dossierVersions)
    .innerJoin(dossiers, eq(dossiers.id, dossierVersions.dossierId))
    .where(and(eq(dossiers.capexId, capexId), eq(dossiers.kind, kind)))
    .orderBy(desc(dossierVersions.number))
    .then((rows) => rows.map((r) => r.v));
}

export type DossierVersionRow = Awaited<ReturnType<typeof dossierVersionsOf>>[number];

export interface BusinessPlanView {
  horizonYears: number;
  discountRatePct: number;
  flows: { year: number; capexKeur: number; opexKeur: number; revenueKeur: number }[];
  npvKeur: number;
  irrPct: number | null;
  paybackYears: number | null;
  validatedByName: string | null;
  validatedAt: Date | null;
  updatedByName: string;
}

export async function businessPlanOf(q: Q, capexId: string): Promise<BusinessPlanView | null> {
  const [b] = await q.select().from(businessPlans).where(eq(businessPlans.capexId, capexId));
  if (!b) return null;
  return {
    horizonYears: b.horizonYears, discountRatePct: b.discountRatePct, flows: b.flows, npvKeur: npv(b.discountRatePct, b.flows), irrPct: irr(b.flows), paybackYears: payback(b.flows),
    validatedByName: b.validatedByName, validatedAt: b.validatedAt, updatedByName: b.updatedByName,
  };
}

/** Facts of the computed sections (docs/spec/04): validated budget class, business plan, risks, project lead. */
export async function computedFacts(q: Q, c: { id: string; leadUserId: string | null }): Promise<ComputedFacts> {
  const [vs, rs, bp] = await Promise.all([versionsOf(q, c.id), risksOf(q, c.id), businessPlanOf(q, c.id)]);
  const validated = latestValidated(vs);
  return {
    budget_e50: meetsClass(validated?.estimateClass, 'E50'),
    budget_e10: vs.some((v) => v.status === 'validated' && v.estimateClass === 'E10'),
    business_plan: !!bp,
    business_plan_validated: !!bp?.validatedAt,
    risks: rs.length > 0,
    team: !!c.leadUserId,
  };
}

/** The values Arche copies into a version when it is frozen: budget, risks, team and typology, business plan. */
export async function computedSnapshot(q: Q, c: { id: string; typology: string | null; typologySource: string | null }) {
  const [vs, lots, rs, team, bp] = await Promise.all([versionsOf(q, c.id), lotsOf(q, c.id), risksOf(q, c.id), teamOf(q, c.id), businessPlanOf(q, c.id)]);
  const v = latestValidated(vs);
  return {
    budget: v ? { version: v.number, estimateClass: v.estimateClass, centralKeur: v.centralKeur, lots: lots.map((l) => ({ number: l.number, title: l.title, amountKeur: v.lines[l.id] ?? 0 })) } : null,
    risks: rs.filter((r) => r.status !== 'closed').map((r) => ({ number: r.number, title: r.title, probability: r.probability, impact: r.impact, owner: r.ownerName, response: r.response })),
    team: team.map((m) => ({ name: m.name, role: m.capexRole })),
    typology: { value: c.typology, source: c.typologySource },
    businessPlan: bp ? { discountRatePct: bp.discountRatePct, npvKeur: bp.npvKeur, irrPct: bp.irrPct, paybackYears: bp.paybackYears, validated: !!bp.validatedAt } : null,
  };
}

/** SHA-256 of the canonical content of a version (the fingerprint the signatures carry). */
export function versionHash(kind: DossierKind, number: number, content: unknown, computed: unknown): string {
  return createHash('sha256').update(canonicalJson({ kind, number, content, computed })).digest('hex');
}

/** Completeness of a version now (a draft: with today's computed facts; a frozen one: as frozen). */
export async function versionCompleteness(q: Q, c: { id: string; leadUserId: string | null }, kind: DossierKind, v: DossierVersionRow) {
  if (v.state !== 'draft') return v.completenessPct;
  const secs = await sectionsFor(q, kind, v.templateVersion);
  return completeness(kind, readContent(kind, v.content, secs), await computedFacts(q, c), secs).pct;
}

// ── Gates and circuits ────────────────────────────────────────────────────────────────────────────────────────────────

/** The session of a gate whose circuit runs (status in_review), if any. */
export async function runningSession(q: Q, capexId: string, code?: GateCode) {
  const rows = await q.select().from(gates).where(and(eq(gates.capexId, capexId), eq(gates.status, 'in_review')));
  return rows.find((g) => !code || g.code === code) ?? null;
}

export async function stepsOf(q: Q, gateIds: readonly string[]) {
  if (!gateIds.length) return [];
  const rows = await q
    .select({ s: circuitSteps, assigneeName: users.displayName })
    .from(circuitSteps)
    .leftJoin(users, eq(users.id, circuitSteps.assigneeUserId))
    .where(inArray(circuitSteps.gateId, [...gateIds]))
    .orderBy(asc(circuitSteps.position));
  return rows.map((r) => ({ ...r.s, assigneeName: r.assigneeName }));
}

export type StepRow = Awaited<ReturnType<typeof stepsOf>>[number];

export async function signaturesOf(q: Q, stepIds: readonly string[]) {
  if (!stepIds.length) return [];
  return q.select().from(signatures).where(inArray(signatures.circuitStepId, [...stepIds])).orderBy(asc(signatures.signedAt));
}

// ── Changes and delegation ────────────────────────────────────────────────────────────────────────────────────────────

export async function changesOf(q: Q, capexId: string) {
  return q.select().from(changes).where(eq(changes.capexId, capexId)).orderBy(desc(changes.number));
}

/** The delegation matrix in force on `day` (the latest dated on or before it), the seed values before any. */
export async function matrixInForce(q: Q, day: string): Promise<{ validFrom: string | null; matrix: DelegationMatrix }> {
  const [m] = await q.select().from(delegationMatrices).where(lte(delegationMatrices.validFrom, day)).orderBy(desc(delegationMatrices.validFrom)).limit(1);
  return { validFrom: m?.validFrom ?? null, matrix: readMatrix(m?.definition) };
}

export async function matrixHistory(q: Q) {
  return q.select().from(delegationMatrices).orderBy(desc(delegationMatrices.validFrom));
}

/** Cost of the changes approved so far (cumulative ceiling), other than `except`. */
export async function approvedCostKeur(q: Q, capexId: string, except?: string): Promise<number> {
  const rows = await q.select({ a: changes.amountKeur, id: changes.id }).from(changes).where(and(eq(changes.capexId, capexId), eq(changes.status, 'approved'), ...(except ? [ne(changes.id, except)] : [])));
  return rows.reduce((s, r) => s + r.a, 0);
}
