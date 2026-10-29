import 'server-only';
// The portfolio views (register, map): the viewer's CAPEX with their validated budget and next gate, filtered on the zone
// of the session, and the zones with their number of CAPEX (the zone selector). Reads through the visibility filter only.
import { asc, inArray } from 'drizzle-orm';
import { currentGate, type CycleState } from '@/domain/lifecycle';
import { getDb } from '@/server/db/client';
import { subsidiaries, zones } from '@/server/db/schema';
import { creatableSubsidiaries } from '@/domain/capex';
import type { Viewer } from '@/server/viewer';
import { visibleCapex, type CapexRow } from './capex';
import { latestValidated, versionsOfMany } from './cycle';

export interface PortfolioRow extends CapexRow {
  validatedKeur: number | null;
  validatedClass: string | null;
  nextGate: string | null;
}

export async function portfolioOf(viewer: Viewer, zone: string | null) {
  const db = await getDb();
  const [all, zoneRows] = await Promise.all([visibleCapex(viewer), db.select({ code: zones.code, name: zones.name, w: zones.boundsWest, n: zones.boundsNorth, e: zones.boundsEast, s: zones.boundsSouth }).from(zones).orderBy(asc(zones.code))]);
  const versions = await versionsOfMany(db, all.map((c) => c.id));
  const rows: PortfolioRow[] = all.map((c) => {
    const v = latestValidated(versions.get(c.id) ?? []);
    return { ...c, validatedKeur: v?.centralKeur ?? null, validatedClass: v?.estimateClass ?? null, nextGate: currentGate(c as CycleState) };
  });
  const inZone = zone ? rows.filter((r) => r.zoneCode === zone) : rows;
  const zoneOptions = [{ code: null as string | null, name: null as string | null, count: rows.length }, ...zoneRows.map((z) => ({ code: z.code, name: z.name, count: rows.filter((r) => r.zoneCode === z.code).length }))];
  const z = zone ? zoneRows.find((x) => x.code === zone) ?? null : null;
  const bounds = z && z.w != null && z.n != null && z.e != null && z.s != null ? ([z.w, z.n, z.e, z.s] as [number, number, number, number]) : null;
  return { all: rows, rows: inZone, zones: zoneOptions, zone: z ? z.code : null, zoneName: z?.name ?? null, zoneBounds: bounds };
}

/**
 * The subsidiaries of the Subsidiary portfolio selector: those of the CAPEX the viewer sees, the ones they may create in and
 * their own; the current one is the cookie's when it is one of them, else their own subsidiary, else the first.
 */
export async function subsidiaryChoice(viewer: Viewer, cookie: string | null): Promise<{ options: { code: string; name: string }[]; current: string | null }> {
  const seen = await visibleCapex(viewer);
  const codes = new Set([...seen.map((c) => c.subsidiaryCode), ...creatableSubsidiaries(viewer.role, viewer.assignments, viewer.subsidiaryCode)]);
  if (viewer.subsidiaryCode && viewer.role !== 'admin') codes.add(viewer.subsidiaryCode);
  if (!codes.size) return { options: [], current: null };
  const rows = await (await getDb()).select({ code: subsidiaries.code, name: subsidiaries.name }).from(subsidiaries).where(inArray(subsidiaries.code, [...codes])).orderBy(asc(subsidiaries.code));
  const has = (c: string | null) => !!c && rows.some((r) => r.code === c);
  const current = has(cookie) ? cookie : has(viewer.subsidiaryCode) ? viewer.subsidiaryCode : rows[0]?.code ?? null;
  return { options: rows, current };
}
