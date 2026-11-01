import 'server-only';
// Vigie connector (AR-033, docs/CONTRATS.md §2.5): the only writer of the mirror of vigie.pub_etudes_securite and of the
// safety milestones Vigie holds. Modes as Keystone's (spec 07 §2): `views` reads the view when the EPC2I server shares it (not
// shared yet: simulated on the demonstration data set, left empty elsewhere), `simulation` simulates on the demonstration data
// set only, `off` reads nothing. Each synchronisation replaces the mirror, then each CAPEX's milestones with studies take their
// status from Vigie (`source = vigie`, audited when it changes); a milestone Vigie no longer holds goes back to the group HSE.
import { and, eq, inArray, sql } from 'drizzle-orm';
import { HS_LABEL, type HsCode } from '@/domain/safety';
import { milestonesFromStudies, studyOf, type Study } from '@/domain/process-safety';
import { getConfig } from '@/server/config';
import { writeAudit } from '@/server/db/helpers';
import { databaseSeedMode } from '@/server/db/seed/mode';
import { capex, hsStatuses, vigieStudies, vigieSync } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import { demoStudies } from './demo';

type Q = DB | Tx;
export type VigieMode = 'off' | 'simulation' | 'views';
const VIEW = 'pub_etudes_securite';
const ACTOR = 'Vigie (connector)';

export interface VigieSyncReport {
  source: 'views' | 'simulation' | 'off';
  rows: number;
  milestones: number;
  error: string | null;
}

async function shared(q: Q): Promise<boolean> {
  const r = await q.execute(sql`select to_regclass(${`vigie.${VIEW}`}) is not null and has_table_privilege(current_user, ${`vigie.${VIEW}`}, 'select') as ok`);
  return !!(r.rows[0] as { ok?: boolean } | undefined)?.ok;
}

async function readView(q: Q): Promise<Record<string, unknown>[]> {
  const r = await q.execute(sql.raw(`select to_jsonb(v) as row from vigie.${VIEW} v`));
  return (r.rows as { row: Record<string, unknown> }[]).map((x) => x.row);
}

/** Applies the studies to the milestones of every CAPEX: returns the number of milestones written. */
export async function applyStudies(q: Q, studies: readonly Study[]): Promise<number> {
  const codes = [...new Set(studies.map((s) => s.capexCode).filter((c): c is string => !!c))];
  const rows = await q.select({ id: capex.id, code: capex.code }).from(capex);
  const held = await q.select().from(hsStatuses).where(eq(hsStatuses.source, 'vigie'));
  let written = 0;
  for (const c of rows) {
    const fromVigie = codes.includes(c.code) ? milestonesFromStudies(studies.filter((s) => s.capexCode === c.code)) : new Map();
    const current = await q.select().from(hsStatuses).where(eq(hsStatuses.capexId, c.id));
    for (const [code, m] of fromVigie) {
      const before = current.find((r) => r.hsCode === code);
      if (before && before.source === 'vigie' && before.status === m.status && before.passedOn === m.passedOn && before.evidenceRef === m.evidenceRef) continue;
      const values = { status: m.status, passedOn: m.passedOn, evidenceRef: m.evidenceRef, note: null, source: 'vigie' as const, updatedByName: ACTOR, updatedAt: new Date() };
      await q.insert(hsStatuses).values({ capexId: c.id, hsCode: code, ...values }).onConflictDoUpdate({ target: [hsStatuses.capexId, hsStatuses.hsCode], set: values });
      await writeAudit(q, {
        actorName: ACTOR, actorUserId: null, objectRef: c.code, area: 'Connectors', entityType: 'hs_status', capexId: c.id,
        change: `${HS_LABEL[code as HsCode]}: ${m.status} (from Vigie)`, before: before ? { status: before.status, source: before.source, passedOn: before.passedOn } : null, after: { status: m.status, passedOn: m.passedOn, evidenceRef: m.evidenceRef },
      });
      written++;
    }
    // A milestone Vigie no longer holds goes back to the group HSE's declaration, with its last status.
    for (const r of held.filter((h) => h.capexId === c.id && !fromVigie.has(h.hsCode as HsCode))) {
      await q.update(hsStatuses).set({ source: 'declared', updatedByName: ACTOR, updatedAt: new Date() }).where(and(eq(hsStatuses.capexId, c.id), eq(hsStatuses.hsCode, r.hsCode)));
      await writeAudit(q, { actorName: ACTOR, actorUserId: null, objectRef: c.code, area: 'Connectors', entityType: 'hs_status', capexId: c.id, change: `${HS_LABEL[r.hsCode as HsCode]}: no longer in Vigie, declared by the group HSE again` });
      written++;
    }
  }
  return written;
}

/** Synchronises the mirror and the milestones Vigie holds. */
export async function syncVigie(q: Q, opts: { mode?: VigieMode } = {}): Promise<VigieSyncReport> {
  const mode = opts.mode ?? getConfig().vigie.mode;
  const at = new Date();
  let report: VigieSyncReport;
  if (mode === 'off') report = { source: 'off', rows: 0, milestones: 0, error: null };
  else {
    const demo = (await databaseSeedMode(q)) === 'demo';
    let raw: Record<string, unknown>[] = [];
    let source: 'views' | 'simulation' = 'simulation';
    let error: string | null = null;
    if (mode === 'views' && (await shared(q))) {
      raw = await readView(q);
      source = 'views';
    } else if (demo) raw = demoStudies();
    else if (mode === 'views') error = `vigie.${VIEW} is not shared with Arche yet`;
    const studies = raw.map(studyOf).filter((s): s is Study => !!s);
    await q.delete(vigieStudies);
    if (studies.length) await q.insert(vigieStudies).values(raw.filter((r) => studyOf(r)).map((r) => ({ ref: String(r.etude_ref), capexCode: (r.capex_code as string | null) ?? null, data: r, syncedAt: at })).filter((r, i, all) => all.findIndex((x) => x.ref === r.ref) === i));
    const milestones = await applyStudies(q, studies);
    report = { source, rows: studies.length, milestones, error: error ?? (raw.length > studies.length ? `${raw.length - studies.length} row(s) unreadable` : null) };
  }
  await q.insert(vigieSync).values({ view: VIEW, source: report.source, rows: report.rows, syncedAt: at, error: report.error })
    .onConflictDoUpdate({ target: vigieSync.view, set: { source: report.source, rows: report.rows, syncedAt: at, error: report.error } });
  return report;
}

/** The studies of some CAPEX, read from the mirror. */
export async function studiesOf(q: Q, capexCodes: readonly string[]): Promise<Study[]> {
  if (!capexCodes.length) return [];
  const rows = await q.select({ data: vigieStudies.data }).from(vigieStudies).where(inArray(vigieStudies.capexCode, [...capexCodes]));
  return rows.map((r) => studyOf(r.data)).filter((s): s is Study => !!s);
}

/** The last synchronisation (Administration › Connectors). */
export async function vigieSyncState(q: Q) {
  return (await q.select().from(vigieSync).where(eq(vigieSync.view, VIEW)))[0] ?? null;
}
