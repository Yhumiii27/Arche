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
  siteCity: string | null;
  siteCountry: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  phase: string;
  typology: string | null;
  leadName: string | null;
  leadUserId: string | null;
  sponsorUserId: string | null;
  /** Country of the subsidiary (the CAPEX map's last fallback). */
  subsidiaryCountry: string;
}

async function selectCapex(viewer: Viewer, extra?: SQL): Promise<CapexRow[]> {
  const db = await getDb();
  const cond = visibilityCondition(capexVisibility(viewer.role, viewer.assignments));
  const where = [cond, extra].filter((c): c is SQL => !!c);
  return db
    .select({
      id: capex.id, code: capex.code, title: capex.title, subsidiaryCode: capex.subsidiaryCode, subsidiaryName: subsidiaries.name,
      zoneCode: subsidiaries.zoneCode, zoneName: zones.name, siteName: sites.name, siteCity: sites.city, siteCountry: sites.countryIso2, latitude: sites.latitude, longitude: sites.longitude, status: capex.status, phase: capex.phase,
      typology: capex.typology, leadName: users.displayName, leadUserId: capex.leadUserId, sponsorUserId: capex.sponsorUserId,
      subsidiaryCountry: subsidiaries.countryIso2,
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

/** Sites of a subsidiary, for the identity sheet. */
export async function siteOptions(subsidiaryCode: string): Promise<{ value: string; label: string }[]> {
  const db = await getDb();
  const rows = await db.select({ id: sites.id, name: sites.name }).from(sites).where(eq(sites.subsidiaryCode, subsidiaryCode)).orderBy(asc(sites.name));
  return rows.map((s) => ({ value: s.id, label: s.name }));
}

/** The first located site of each subsidiary (the CAPEX map places a CAPEX without a located site there, marked approximate). */
export async function locatedSitesOf(subsidiaryCodes: readonly string[]): Promise<Map<string, { name: string; city: string | null; countryIso2: string; latitude: number; longitude: number }>> {
  if (!subsidiaryCodes.length) return new Map();
  const db = await getDb();
  const rows = await db.select().from(sites).where(inArray(sites.subsidiaryCode, [...subsidiaryCodes])).orderBy(asc(sites.name));
  const out = new Map<string, { name: string; city: string | null; countryIso2: string; latitude: number; longitude: number }>();
  for (const s of rows) if (s.latitude != null && s.longitude != null && !out.has(s.subsidiaryCode)) out.set(s.subsidiaryCode, { name: s.name, city: s.city, countryIso2: s.countryIso2, latitude: s.latitude, longitude: s.longitude });
  return out;
}

/** True when the CAPEX is one of the viewer's own: named on it, its sponsor or its project lead. */
export function isMine(viewer: Viewer, c: { code: string; leadUserId: string | null; sponsorUserId: string | null }): boolean {
  return c.leadUserId === viewer.userId || c.sponsorUserId === viewer.userId || viewer.assignments.some((a) => a.scopeKind === 'capex' && a.scopeRef === c.code);
}
