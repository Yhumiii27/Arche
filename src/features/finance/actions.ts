'use server';
// Finance Server Functions (delivery 7, lot 7b): a lot's disbursement forecast for the months to come (AR-045; right `budget`:
// the controller, the project lead), the envelopes voted by the group CFO, their amount, carry-overs to the next fiscal year
// and reallocations between envelopes (AR-040; the group CFO only). Each one checks the rights server-side, validates its
// input with the pure rules (src/domain/cashflow.ts, src/domain/envelopes.ts), writes and audits.
import { and, eq, gt, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkForecast } from '@/domain/cashflow';
import { checkEnvelope, checkMovement, envelopeStates, scopeOf } from '@/domain/envelopes';
import { monthOf } from '@/domain/execution';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { assetClasses, capexLots, closureStatements, envelopeMovements, envelopes, fixedAssetTransfers, lotFinalCosts, lotForecasts, subsidiaries, zones } from '@/server/db/schema';
import { LOT_KINDS } from '@/domain/capex';
import { checkAssetClass, classOf } from '@/domain/depreciation';
import { auditOf, fieldsOf, onCapex, type ActionResult } from '@/server/capex/write';
import { converterFor } from '@/server/dal/currency';
import { assetClassesOf, envelopeData, phasedCapex, transfersOf } from '@/server/dal/finance';
import { getViewer, type Viewer } from '@/server/session';

/** Replaces the lot's forecast for the months after the current one (amounts in the chosen currency, each at its month's rate). */
export async function saveForecastAction(code: string, lotId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v, today) => {
    const [lot] = await tx.select().from(capexLots).where(and(eq(capexLots.id, lotId), eq(capexLots.capexId, c.id)));
    if (!lot) return { ok: false, error: 'Unknown lot' };
    const current = monthOf(today);
    const f = fieldsOf(fd);
    const ch = checkForecast(f, current);
    if (!ch.ok) return ch;
    const rows = [];
    for (const x of ch.value) {
      const conv = await converterFor(tx, c.subsidiaryCode, f.currency, x.month);
      if (!conv.ok) return conv;
      rows.push({ lotId: lot.id, month: x.month, amountKeur: conv.value.keur(x.amount), amountLocal: conv.value.local(x.amount), currency: conv.value.currency === 'EUR' ? null : conv.value.currency, rate: conv.value.currency === 'EUR' ? null : conv.value.rate, enteredByName: v.name });
    }
    await tx.delete(lotForecasts).where(and(eq(lotForecasts.lotId, lot.id), gt(lotForecasts.month, current)));
    if (rows.length) await tx.insert(lotForecasts).values(rows);
    const total = Math.round(rows.reduce((s, r) => s + r.amountKeur, 0) * 10) / 10;
    await writeAudit(tx, auditOf(v, c, `lot ${lot.number}: disbursement forecast ${rows.length ? `${rows[0].month} → ${rows[rows.length - 1].month}, ${total} k€` : 'cleared'}`, {
      entityType: 'lot_forecast', entityId: lot.id, after: { months: rows.map((r) => ({ month: r.month, amountKeur: r.amountKeur })) },
    }));
    return { ok: true };
  });
}

const REFUSED: ActionResult = { ok: false, error: 'This action is reserved to the group CFO' };

async function groupCfo(): Promise<Viewer | null> {
  const v = await getViewer();
  return v.role === 'group_cfo' ? v : null;
}

const audit = (v: Viewer, objectRef: string, change: string, extra: { entityId?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string } = {}) => ({
  actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef, change, area: 'Envelopes', entityType: 'envelope', ...extra,
});
const refOf = (e: { fiscalYear: number; zoneCode: string | null; subsidiaryCode: string | null; category: string }) => `Envelope ${e.fiscalYear} ${scopeOf(e)} ${e.category}`;

export async function createEnvelopeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await groupCfo();
  if (!v) return REFUSED;
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [zs, ss] = await Promise.all([tx.select({ c: zones.code }).from(zones), tx.select({ c: subsidiaries.code }).from(subsidiaries)]);
    const ch = checkEnvelope(fieldsOf(fd), { zones: new Set(zs.map((x) => x.c)), subsidiaries: new Set(ss.map((x) => x.c)) });
    if (!ch.ok) return ch;
    const [row] = await tx.insert(envelopes).values({ ...ch.value, createdByName: v.name }).onConflictDoNothing().returning({ id: envelopes.id });
    if (!row) return { ok: false, error: 'This envelope already exists: change its amount' };
    await writeAudit(tx, audit(v, refOf(ch.value), `envelope voted: ${ch.value.amountKeur} k€`, { entityId: row.id, after: { ...ch.value } }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/envelopes');
  return r;
}

export async function updateEnvelopeAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await groupCfo();
  if (!v) return REFUSED;
  const f = fieldsOf(fd);
  const n = Number(String(f.amountKeur ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!String(f.amountKeur ?? '').trim() || !Number.isFinite(n) || n < 0) return { ok: false, error: 'Give the amount in k€' };
  const reason = String(f.reason ?? '').trim().slice(0, 1000);
  if (reason.length < 3) return { ok: false, error: 'Give the reason' };
  const db = await getDb();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [e] = await tx.select().from(envelopes).where(eq(envelopes.id, id));
    if (!e) return { ok: false, error: 'Unknown envelope' };
    const amountKeur = Math.round(n * 10) / 10;
    await tx.update(envelopes).set({ amountKeur, updatedAt: new Date() }).where(eq(envelopes.id, e.id));
    await writeAudit(tx, audit(v, refOf(e), `envelope amount: ${e.amountKeur} → ${amountKeur} k€`, { entityId: e.id, before: { amountKeur: e.amountKeur }, after: { amountKeur }, reason }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/envelopes');
  return r;
}

/**
 * A carry-over (`to` empty: the same scope and category next fiscal year, created at 0 when missing) or a reallocation to
 * another envelope of the same fiscal year; within what is available, with a reason.
 */
export async function moveEnvelopeAction(fromId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await groupCfo();
  if (!v) return REFUSED;
  const db = await getDb();
  const today = await businessToday();
  const r = await db.transaction(async (tx): Promise<ActionResult> => {
    const [{ envelopes: envs, movements }, phased] = await Promise.all([envelopeData(tx), phasedCapex(tx, today)]);
    const states = envelopeStates(envs, movements, phased);
    const from = states.find((s) => s.envelope.id === fromId) ?? null;
    const f = fieldsOf(fd);
    const ch = checkMovement(f, from);
    if (!ch.ok) return ch;
    const e = from!.envelope;
    let toId = String(f.toId ?? '');
    let kind: 'carry_over' | 'reallocation' = 'reallocation';
    if (!toId) {
      kind = 'carry_over';
      const next = envs.find((x) => x.fiscalYear === e.fiscalYear + 1 && x.zoneCode === e.zoneCode && x.subsidiaryCode === e.subsidiaryCode && x.category === e.category);
      if (next) toId = next.id;
      else {
        const [row] = await tx.insert(envelopes).values({ fiscalYear: e.fiscalYear + 1, zoneCode: e.zoneCode, subsidiaryCode: e.subsidiaryCode, category: e.category, amountKeur: 0, note: 'Created by a carry-over', createdByName: v.name }).returning({ id: envelopes.id });
        toId = row.id;
      }
    } else {
      const to = envs.find((x) => x.id === toId);
      if (!to || to.id === e.id || to.fiscalYear !== e.fiscalYear) return { ok: false, error: 'Choose another envelope of the same fiscal year' };
    }
    const [m] = await tx.insert(envelopeMovements).values({ kind, fromEnvelopeId: e.id, toEnvelopeId: toId, amountKeur: ch.value.amountKeur, reason: ch.value.reason, byName: v.name }).returning({ id: envelopeMovements.id });
    const to = envs.find((x) => x.id === toId) ?? { ...e, fiscalYear: e.fiscalYear + 1 };
    await writeAudit(tx, audit(v, refOf(e), `${kind === 'carry_over' ? 'carried over' : 'reallocated'}: ${ch.value.amountKeur} k€ → ${refOf(to)}`, { entityId: m.id, after: { amountKeur: ch.value.amountKeur, toId }, reason: ch.value.reason }));
    return { ok: true };
  });
  if (r.ok) revalidatePath('/envelopes');
  return r;
}

// ── Depreciation and fixed assets (AR-050) ────────────────────────────────────────────────────────────────────────────────

/** An asset class of the group (created or changed): the group CFO. */
export async function saveAssetClassAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await groupCfo();
  if (!v) return REFUSED;
  const ch = checkAssetClass(fieldsOf(fd), LOT_KINDS);
  if (!ch.ok) return ch;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(assetClasses).where(eq(assetClasses.code, ch.value.code));
    const row = { ...ch.value, active: true, updatedAt: new Date() };
    await tx.insert(assetClasses).values(row).onConflictDoUpdate({ target: assetClasses.code, set: row });
    await writeAudit(tx, { actorName: v.name, actorUserId: v.userId, actorRole: v.role, objectRef: `Asset class ${ch.value.code}`, area: 'Administration', change: `asset class ${before ? 'changed' : 'created'}: ${ch.value.lifeYears} years, ${ch.value.method}`, before: before ? { lifeYears: before.lifeYears, method: before.method, factor: before.factor } : undefined, after: { ...ch.value } });
  });
  revalidatePath('/admin/organisation');
  return { ok: true };
}

/** The asset class of a lot (empty: the class of its kind); right `budget`. */
export async function setLotClassAction(code: string, lotId: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return onCapex(code, 'budget', async (tx, c, v) => {
    const [lot] = await tx.select().from(capexLots).where(and(eq(capexLots.id, lotId), eq(capexLots.capexId, c.id)));
    if (!lot) return { ok: false, error: 'Unknown lot' };
    const raw = String(fd.get('assetClassCode') ?? '');
    const value = raw || null;
    if (value && !(await tx.select().from(assetClasses).where(eq(assetClasses.code, value))).length) return { ok: false, error: 'Unknown asset class' };
    await tx.update(capexLots).set({ assetClassCode: value, updatedAt: new Date() }).where(eq(capexLots.id, lot.id));
    await writeAudit(tx, auditOf(v, c, `lot ${lot.number}: asset class ${value ?? 'of its kind'}`, { entityType: 'capex_lot', entityId: lot.id, before: { assetClassCode: lot.assetClassCode }, after: { assetClassCode: value } }));
    return { ok: true };
  });
}

/**
 * The transfer of the lots into fixed assets at the accounting closure (right `closure`): every lot with a final cost and a
 * class, in service from the start of commissioning; a lot already transferred is left as it is.
 */
export async function transferAssetsAction(code: string): Promise<ActionResult> {
  return onCapex(code, 'closure', async (tx, c, v) => {
    if (!c.mesStartedOn) return { ok: false, error: 'Start the commissioning first' };
    const [statement] = await tx.select().from(closureStatements).where(eq(closureStatements.capexId, c.id));
    if (!statement) return { ok: false, error: 'Enter the closure statement first' };
    const [classes, lots, done] = await Promise.all([assetClassesOf(tx), tx.select().from(capexLots).where(eq(capexLots.capexId, c.id)), transfersOf(tx, c.id)]);
    const costs = lots.length ? await tx.select().from(lotFinalCosts).where(inArray(lotFinalCosts.lotId, lots.map((l) => l.id))) : [];
    const todo = lots.filter((l) => !done.some((d) => d.lotId === l.id) && costs.some((x) => x.lotId === l.id && x.finalKeur > 0));
    const missing = todo.filter((l) => !classOf(classes, l));
    if (missing.length) return { ok: false, error: 'Give an asset class to every lot with a final cost' };
    if (!todo.length) return { ok: false, error: 'Nothing left to transfer' };
    const rows = todo.map((l) => {
      const cls = classOf(classes, l)!;
      return { lotId: l.id, capexId: c.id, assetClassCode: cls.code, lifeYears: cls.lifeYears, method: cls.method, factor: cls.factor, amountKeur: costs.find((x) => x.lotId === l.id)!.finalKeur, inServiceOn: c.mesStartedOn!, transferredByName: v.name };
    });
    await tx.insert(fixedAssetTransfers).values(rows);
    await writeAudit(tx, auditOf(v, c, `transferred into fixed assets: ${rows.length} lot(s), ${Math.round(rows.reduce((s, r) => s + r.amountKeur, 0) * 10) / 10} k€`, { entityType: 'capex', entityId: c.id, after: { lots: rows.map((r) => ({ lotId: r.lotId, assetClassCode: r.assetClassCode, amountKeur: r.amountKeur })) } }));
    return { ok: true };
  });
}
