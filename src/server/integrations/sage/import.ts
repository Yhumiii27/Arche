import 'server-only';
// Sage connector (AR-047, DECISIONS.md §5): the import of an extraction file of a subsidiary — uploaded by its controller or
// the group CFO, dropped by the planned extraction in ARCHE_SAGE_DIR, or the demonstration extraction. Every line is checked:
// kept when its analytic code is a lot's Sage code (a CAPEX of the subsidiary, a lot outside EPC2i) and its currency has a
// reference rate for its month, skipped when already imported, rejected otherwise (journal of the rejects). The lots touched
// get their cumulative committed and spent amounts at the end of each month, converted to k€ (AR-039); the physical progress
// typed by the controller is kept.
import { and, eq, inArray } from 'drizzle-orm';
import { cumulativeByMonth, parseSageCsv, sageKey, type SageLine } from '@/domain/sage';
import { monthOf } from '@/domain/execution';
import { writeAudit } from '@/server/db/helpers';
import { capex, capexLots, lotActuals, sageImports, sageLines, sageRejects } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { converterFor } from '@/server/dal/currency';

type Q = DB | Tx;

export interface SageImportResult {
  ok: true;
  importId: string;
  lines: number;
  accepted: number;
  duplicates: number;
  rejected: number;
  lots: number;
}

/** The lots of the subsidiary by Sage code (lots outside EPC2i: those come from Keystone). */
export async function sageCodesOf(q: Q, subsidiaryCode: string) {
  const rows = await q.select({ id: capexLots.id, sageCode: capexLots.sageCode, epc2i: capexLots.epc2i, capexCode: capex.code, number: capexLots.number })
    .from(capexLots).innerJoin(capex, eq(capex.id, capexLots.capexId)).where(eq(capex.subsidiaryCode, subsidiaryCode));
  return new Map(rows.filter((r) => r.sageCode && !r.epc2i).map((r) => [r.sageCode!, r]));
}

export async function importSage(
  q: Q,
  o: { subsidiaryCode: string; csv: string; source: 'upload' | 'folder' | 'demo'; fileName: string | null; byName: string; byUserId: string | null; today: string },
): Promise<SageImportResult | { ok: false; error: string }> {
  if (o.csv.length > 5_000_000) return { ok: false, error: 'The file is too large' };
  const parsed = parseSageCsv(o.csv, o.subsidiaryCode);
  if (!parsed.ok) return parsed;
  const codes = await sageCodesOf(q, o.subsidiaryCode);
  const known = new Set((await q.select({ key: sageLines.key }).from(sageLines).where(eq(sageLines.subsidiaryCode, o.subsidiaryCode))).map((x) => x.key));
  const current = monthOf(o.today);
  const rejects = [...parsed.rejects];
  const kept: (SageLine & { lotId: string })[] = [];
  let duplicates = 0;
  const rateOk = new Map<string, string | null>();
  for (const l of parsed.lines) {
    const lot = codes.get(l.analytic);
    if (!lot) {
      rejects.push({ lineNo: l.lineNo, raw: `${l.kind} ${l.number} ${l.analytic} ${l.amount} ${l.currency}`, reason: 'No lot has this analytic code' });
      continue;
    }
    if (monthOf(l.date) > current) {
      rejects.push({ lineNo: l.lineNo, raw: `${l.kind} ${l.number} ${l.analytic}`, reason: 'Dated in the future' });
      continue;
    }
    const key = sageKey(l);
    if (known.has(key) || kept.some((k) => sageKey(k) === key)) {
      duplicates++;
      continue;
    }
    const rk = `${l.currency}:${monthOf(l.date)}`;
    if (!rateOk.has(rk)) {
      const conv = await converterFor(q, o.subsidiaryCode, l.currency, monthOf(l.date));
      rateOk.set(rk, conv.ok ? null : conv.error);
    }
    const err = rateOk.get(rk);
    if (err) {
      rejects.push({ lineNo: l.lineNo, raw: `${l.kind} ${l.number} ${l.analytic} ${l.amount} ${l.currency}`, reason: err });
      continue;
    }
    kept.push({ ...l, lotId: lot.id });
  }
  const [imp] = await q.insert(sageImports).values({
    subsidiaryCode: o.subsidiaryCode, source: o.source, fileName: o.fileName, lines: parsed.lines.length + parsed.rejects.length,
    accepted: kept.length, duplicates, rejected: rejects.length, importedByName: o.byName,
  }).returning({ id: sageImports.id });
  if (kept.length) {
    await q.insert(sageLines).values(kept.map((l) => ({
      importId: imp.id, subsidiaryCode: o.subsidiaryCode, key: sageKey(l), lotId: l.lotId, docDate: l.date, kind: l.kind, amount: l.amount, currency: l.currency, supplier: l.supplier, label: l.label,
    })));
  }
  if (rejects.length) await q.insert(sageRejects).values(rejects.map((r) => ({ importId: imp.id, ...r })));

  // The lots touched: their cumulative amounts from every line kept so far, month by month, converted at each month's rate.
  const lotIds = [...new Set(kept.map((l) => l.lotId))];
  if (lotIds.length) {
    const all = await q.select().from(sageLines).where(inArray(sageLines.lotId, lotIds));
    // One currency per lot and month is expected; the amounts in another one are converted separately and summed in k€.
    const byCurrency = new Map<string, typeof all>();
    for (const l of all) byCurrency.set(l.currency, [...(byCurrency.get(l.currency) ?? []), l]);
    // The amount in local currency is kept beside the k€ when all of a lot's lines are in one currency other than the euro.
    const single = (lotId: string) => new Set(all.filter((l) => l.lotId === lotId).map((l) => l.currency)).size === 1;
    const totals = new Map<string, { lotId: string; month: string; committedKeur: number; spentKeur: number; local: { committed: number; spent: number; currency: string; rate: number } | null }>();
    for (const [currency, ls] of byCurrency) {
      for (const cum of cumulativeByMonth(ls.map((l) => ({ lotId: l.lotId, date: l.docDate, kind: l.kind, amount: l.amount })), current)) {
        const conv = await converterFor(q, o.subsidiaryCode, currency, cum.month);
        if (!conv.ok) continue;
        const k = `${cum.lotId}:${cum.month}`;
        const t = totals.get(k) ?? { lotId: cum.lotId, month: cum.month, committedKeur: 0, spentKeur: 0, local: null };
        t.committedKeur += conv.value.keur(cum.committed / 1000);
        t.spentKeur += conv.value.keur(cum.spent / 1000);
        t.local = single(cum.lotId) && currency !== 'EUR' ? { committed: cum.committed / 1000, spent: cum.spent / 1000, currency, rate: conv.value.rate } : null;
        totals.set(k, t);
      }
    }
    const at = new Date();
    for (const t of totals.values()) {
      const values = {
        committedKeur: Math.round(t.committedKeur * 10) / 10, spentKeur: Math.round(t.spentKeur * 10) / 10, source: 'sage' as const, enteredByName: o.byName, enteredAt: at,
        committedLocal: t.local ? Math.round(t.local.committed * 10) / 10 : null, spentLocal: t.local ? Math.round(t.local.spent * 10) / 10 : null, currency: t.local?.currency ?? null, rate: t.local?.rate ?? null,
      };
      // The physical progress typed by the controller stays (not in the extraction).
      await q.insert(lotActuals).values({ lotId: t.lotId, month: t.month, physicalPct: null, ...values }).onConflictDoUpdate({ target: [lotActuals.lotId, lotActuals.month], set: values });
    }
  }
  const capexIds = lotIds.length ? [...new Set((await q.select({ capexId: capexLots.capexId }).from(capexLots).where(inArray(capexLots.id, lotIds))).map((x) => x.capexId))] : [];
  await writeAudit(q, {
    actorName: o.byName, actorUserId: o.byUserId, actorRole: null, objectRef: `Sage ${o.subsidiaryCode}`, area: 'Connectors', entityType: 'sage_import', entityId: imp.id,
    change: `Sage extraction imported (${o.source}${o.fileName ? `, ${o.fileName}` : ''}): ${kept.length} line(s) kept, ${duplicates} already imported, ${rejects.length} rejected; ${capexIds.length} CAPEX updated`,
  });
  return { ok: true, importId: imp.id, lines: parsed.lines.length + parsed.rejects.length, accepted: kept.length, duplicates, rejected: rejects.length, lots: lotIds.length };
}

/** The imports of a subsidiary, newest first, with the rejects of each. */
export async function sageImportsOf(q: Q, subsidiaryCode: string) {
  const imports = await q.select().from(sageImports).where(eq(sageImports.subsidiaryCode, subsidiaryCode));
  imports.sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
  const rejects = imports.length ? await q.select().from(sageRejects).where(inArray(sageRejects.importId, imports.slice(0, 5).map((i) => i.id))) : [];
  return imports.map((i) => ({ ...i, rejects: rejects.filter((r) => r.importId === i.id).sort((a, b) => a.lineNo - b.lineNo) }));
}

/** Sets a lot's Sage code (unique among the lots of the subsidiary). */
export async function setSageCode(q: Q, lotId: string, subsidiaryCode: string, code: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (code) {
    const taken = (await sageCodesOf(q, subsidiaryCode)).get(code);
    if (taken && taken.id !== lotId) return { ok: false, error: `This code is already the one of ${taken.capexCode} lot ${taken.number}` };
  }
  await q.update(capexLots).set({ sageCode: code, updatedAt: new Date() }).where(and(eq(capexLots.id, lotId)));
  return { ok: true };
}
