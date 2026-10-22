import 'server-only';
// The portfolio views (register, map): the viewer's CAPEX with their validated budget and next gate, filtered on the zone
// of the session, and the zones with their number of CAPEX (the zone selector). Reads through the visibility filter only.
import { asc } from 'drizzle-orm';
import { currentGate, type CycleState } from '@/domain/lifecycle';
import { getDb } from '@/server/db/client';
import { zones } from '@/server/db/schema';
import type { Viewer } from '@/server/viewer';
import { visibleCapex, type CapexRow } from './capex';
import { latestValidated, versionsOf } from './cycle';

export interface PortfolioRow extends CapexRow {
  validatedKeur: number | null;
  validatedClass: string | null;
  nextGate: string | null;
}

export async function portfolioOf(viewer: Viewer, zone: string | null) {
  const db = await getDb();
  const [all, zoneRows] = await Promise.all([visibleCapex(viewer), db.select({ code: zones.code, name: zones.name, w: zones.boundsWest, n: zones.boundsNorth, e: zones.boundsEast, s: zones.boundsSouth }).from(zones).orderBy(asc(zones.code))]);
  const rows: PortfolioRow[] = await Promise.all(
    all.map(async (c) => {
      const v = latestValidated(await versionsOf(db, c.id));
      return { ...c, validatedKeur: v?.centralKeur ?? null, validatedClass: v?.estimateClass ?? null, nextGate: currentGate(c as CycleState) };
    }),
  );
  const inZone = zone ? rows.filter((r) => r.zoneCode === zone) : rows;
  const zoneOptions = [{ code: null as string | null, name: null as string | null, count: rows.length }, ...zoneRows.map((z) => ({ code: z.code, name: z.name, count: rows.filter((r) => r.zoneCode === z.code).length }))];
  const z = zone ? zoneRows.find((x) => x.code === zone) ?? null : null;
  const bounds = z && z.w != null && z.n != null && z.e != null && z.s != null ? ([z.w, z.n, z.e, z.s] as [number, number, number, number]) : null;
  return { all: rows, rows: inZone, zones: zoneOptions, zone: z ? z.code : null, zoneName: z?.name ?? null, zoneBounds: bounds };
}
