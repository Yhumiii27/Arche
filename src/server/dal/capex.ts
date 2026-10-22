import 'server-only';
// CAPEX reads under subsidiary isolation (docs/spec/01 §2): every read filters in SQL with the viewer's visibility
// (src/domain/rights.ts); a CAPEX outside it does not exist for the viewer (null, never "forbidden").
import { and, asc, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { capexVisibility, type CapexVisibility } from '@/domain/rights';
import { getDb } from '@/server/db/client';
import { capex, sites, subsidiaries, users, zones } from '@/server/db/schema';
import type { Viewer } from '@/server/viewer';

/** SQL condition of a visibility (null = no restriction; `false` = nothing). */
export function visibilityCondition(v: CapexVisibility): SQL | null {
  switch (v.kind) {
    case 'all':
      return null;
    case 'none':
      return sql`false`;
    case 'cross':
      return ne(capex.status, 'draft');
    case 'scoped': {
      const parts: SQL[] = [];
      if (v.subsidiaries.length) parts.push(inArray(capex.subsidiaryCode, v.subsidiaries));
      if (v.capex.length) parts.push(inArray(capex.code, v.capex));
      if (v.zones.length) parts.push(and(ne(capex.status, 'draft'), inArray(subsidiaries.zoneCode, v.zones))!);
      return parts.length ? or(...parts)! : sql`false`;
    }
  }
}

export interface CapexRow {
  id: string;
  code: string;
  title: string;
  subsidiaryCode: string;
  subsidiaryName: string;
  zoneCode: string;
  zoneName: string;
  siteName: string | null;
  status: string;
  phase: string;
  typology: string | null;
  leadName: string | null;
}

async function selectCapex(viewer: Viewer, extra?: SQL): Promise<CapexRow[]> {
  const db = await getDb();
  const cond = visibilityCondition(capexVisibility(viewer.role, viewer.assignments));
  const where = [cond, extra].filter((c): c is SQL => !!c);
  return db
    .select({
      id: capex.id, code: capex.code, title: capex.title, subsidiaryCode: capex.subsidiaryCode, subsidiaryName: subsidiaries.name,
      zoneCode: subsidiaries.zoneCode, zoneName: zones.name, siteName: sites.name, status: capex.status, phase: capex.phase,
      typology: capex.typology, leadName: users.displayName,
    })
    .from(capex)
    .innerJoin(subsidiaries, eq(subsidiaries.code, capex.subsidiaryCode))
    .innerJoin(zones, eq(zones.code, subsidiaries.zoneCode))
    .leftJoin(sites, eq(sites.id, capex.siteId))
    .leftJoin(users, eq(users.id, capex.leadUserId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(capex.code));
}

/** The CAPEX the viewer sees, by code. */
export function visibleCapex(viewer: Viewer): Promise<CapexRow[]> {
  return selectCapex(viewer);
}

/** One CAPEX, or null when it does not exist or is outside the viewer's visibility. */
export async function capexForViewer(viewer: Viewer, code: string): Promise<CapexRow | null> {
  return (await selectCapex(viewer, eq(capex.code, code)))[0] ?? null;
}
