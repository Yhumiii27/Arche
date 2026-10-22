// CAPEX map logic (pure), ported from Keystone's projects map (src/domain/worldmap.ts, origin commit 6645cb6, owner's request
// of 22 Oct 2026 — DECISIONS.md §5): marker style of a CAPEX, greedy clustering by zoom level, view framing (World · zone ·
// CAPEX), the marker click and keyboard rules, the tooltip placement and texts, the KPI tiles. Geometry works in projected,
// unzoomed pixels; the projection is passed in (d3-geo in the component).

/** Single-marker style: execution or start-up (solid), scoping or front-end (dashed), suspended (ring), draft or closed (hollow). */
export type MarkerStyle = 'ontrack' | 'risk' | 'pipeline' | 'closed';
/** View control buttons: World · Europe (or the zone) · Projects. */
export type MapView = 'world' | 'europe' | 'fit';
/** Zoom transform (d3 ZoomTransform fields): screen = k × projected + (x, y). */
export interface MapTransform {
  k: number;
  x: number;
  y: number;
}
/** [x0, y0, x1, y1] in projected pixels. */
export type Box = [number, number, number, number];
/** [west, north, east, south] in degrees (ZONE_BOUNDS). */
export type GeoBounds = [number, number, number, number];
export type Projector = (lngLat: [number, number]) => [number, number] | null;

export const MAP_VIEWS: MapView[] = ['world', 'europe', 'fit'];
/** `d3.zoom().scaleExtent([1, 48])`. */
export const SCALE_EXTENT: [number, number] = [1, 48];
/** Inset of the sphere inside the frame (`fitExtent([[6,6],[W−6,H−6]])`). */
export const SPHERE_INSET = 6;
/** Animated view changes (`transition().duration(650)`). */
export const VIEW_MS = 650;
/** Default "Europe" frame when no zone is selected. */
export const EUROPE_BOUNDS: GeoBounds = [-12, 62, 34, 34];
/** Points closer than this many screen pixels merge into one marker. */
export const CLUSTER_PX = 18;
/** Fallback frame size when the container has no layout yet (`clientWidth || 800`, `clientHeight || 500`). */
export const DEFAULT_SIZE = { W: 800, H: 500 };

export const IDENTITY: MapTransform = { k: 1, x: 0, y: 0 };

// ── Styles ─────────────────────────────────────────────────────────────────────────────────────────────

/** Marker style of a CAPEX from its status and phase. */
export function capexMarkerStyle(status: string, phase: string): MarkerStyle {
  if (status === 'on_hold') return 'risk';
  if (status !== 'active') return 'closed';
  return phase === 'execution' || phase === 'demarrage' ? 'ontrack' : 'pipeline';
}

// ── Clustering ─────────────────────────────────────────────────────────────────────────────────────────

export interface Placed {
  code: string;
  x: number;
  y: number;
}

export interface Cluster<P extends Placed = Placed> {
  /** Mean of the members' projected positions. */
  x: number;
  y: number;
  items: P[];
}

const mean = (xs: number[]) => {
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
};

/**
 * Greedy clustering (`clusters`): in input order, a point joins the first cluster whose centre is closer than
 * `CLUSTER_PX / k` projected pixels (k = zoom scale), and the centre moves to the members' mean.
 */
export function clusterPoints<P extends Placed>(points: P[], k: number): Cluster<P>[] {
  const r = CLUSTER_PX / k;
  const out: Cluster<P>[] = [];
  for (const p of points) {
    const c = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < r);
    if (c) {
      c.items.push(p);
      c.x = mean(c.items.map((i) => i.x));
      c.y = mean(c.items.map((i) => i.y));
    } else out.push({ x: p.x, y: p.y, items: [p] });
  }
  return out;
}

/** Stable identity of a marker (the d3 data-join key): sorted member codes. */
export const clusterKey = (c: { items: { code: string }[] }) => c.items.map((i) => i.code).sort().join('|');

/** Labels show once zoomed in (k ≥ 2.4) or when few markers remain (≤ 4). */
export const showMarkerLabels = (k: number, markers: number) => k >= 2.4 || markers <= 4;

/** Distinct values in first-seen order (`[...new Set(…)]`). */
export const uniq = <T>(xs: T[]) => [...new Set(xs)];

// ── Framing ────────────────────────────────────────────────────────────────────────────────────────────

/** Bounding box of placed items (`spread`). */
export function spread(items: { x: number; y: number }[]): Box {
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Transform that centres box `b` and fills 72 % of the frame, k clamped to [1, maxK] (`fitBox`). */
export function fitBox(b: Box, maxK: number, W: number, H: number): MapTransform {
  const dw = Math.max(1e-6, b[2] - b[0]);
  const dh = Math.max(1e-6, b[3] - b[1]);
  const k = Math.max(1, Math.min(maxK, 0.72 / Math.max(dw / W, dh / H)));
  return { k, x: W / 2 - (k * (b[0] + b[2])) / 2, y: H / 2 - (k * (b[1] + b[3])) / 2 };
}

/** Projected box of geographic bounds, from its corners and edge midpoints (`boxOf`). */
export function boxOf(bounds: GeoBounds, project: Projector): Box {
  const [w, n, e, s] = bounds;
  const pts = ([[w, n], [e, n], [w, s], [e, s], [w, (n + s) / 2], [e, (n + s) / 2], [(w + e) / 2, n], [(w + e) / 2, s]] as [number, number][])
    .map((p) => project(p))
    .filter((p): p is [number, number] => !!p);
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

/** Whole world when the points span more than 90° of longitude or 60° of latitude, else fit them (`defaultView`). */
export function defaultView(points: { lat: number; lng: number }[]): MapView {
  if (!points.length) return 'world';
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return Math.max(...lngs) - Math.min(...lngs) > 90 || Math.max(...lats) - Math.min(...lats) > 60 ? 'world' : 'fit';
}

/** Initial view: the zone frame when a zone is selected, else `defaultView` (`homeView`). */
export const homeView = (zoneSelected: boolean, points: { lat: number; lng: number }[]): MapView => (zoneSelected ? 'europe' : defaultView(points));

export interface FrameInput {
  W: number;
  H: number;
  project: Projector;
  /** Selected zone's bounds; null → the default Europe frame. */
  zoneBounds: GeoBounds | null;
  /** Projected points (unzoomed). */
  points: Placed[];
}

/**
 * Transform of a view button (`applyView`): World = identity; Europe/zone = the bounds framed with k ≤ 8;
 * Projects = all points ±2 px with k ≤ 10 for a single point, else ≤ 14 (identity without points).
 */
export function viewTransform(view: MapView, f: FrameInput): MapTransform {
  if (view === 'world') return IDENTITY;
  if (view === 'europe') return fitBox(boxOf(f.zoneBounds ?? EUROPE_BOUNDS, f.project), 8, f.W, f.H);
  if (!f.points.length) return IDENTITY;
  const b = spread(f.points);
  return fitBox([b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2], f.points.length === 1 ? 10 : 14, f.W, f.H);
}

/** Site focus from the list (`focusCode`): the point and those within 0.5 px, ±1 px, k ≤ 12. Null if unknown. */
export function focusTransform(code: string, points: Placed[], W: number, H: number): MapTransform | null {
  const p = points.find((i) => i.code === code);
  if (!p) return null;
  const near = points.filter((i) => Math.hypot(i.x - p.x, i.y - p.y) < 0.5);
  const b = spread(near.length ? near : [p]);
  return fitBox([b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1], 12, W, H);
}

/**
 * Marker click (`onClick`): a cluster whose members are spread enough to separate at full zoom (max extent × 48
 * > 22 px) zooms to them (k ≤ 48); anything else pins the tooltip.
 */
export function clusterClick(c: Cluster, W: number, H: number): { kind: 'zoom'; transform: MapTransform } | { kind: 'pin' } {
  if (c.items.length > 1) {
    const b = spread(c.items);
    const maxD = Math.max(b[2] - b[0], b[3] - b[1]);
    if (maxD * SCALE_EXTENT[1] > 22) return { kind: 'zoom', transform: fitBox(b, SCALE_EXTENT[1], W, H) };
  }
  return { kind: 'pin' };
}

// ── Keyboard (Delivery 8, L-7 = a, R-135) ──────────────────────────────────────────────────────────────

/**
 * A marker is a tab stop (0) while its screen position (k × projected + translation) lies inside the frame; a marker
 * panned out of view is skipped (−1). No arrow-key navigation: markers are tabbed in cluster order.
 */
export function markerTabIndex(c: { x: number; y: number }, tr: MapTransform, W: number, H: number): 0 | -1 {
  const sx = tr.k * c.x + tr.x;
  const sy = tr.k * c.y + tr.y;
  return sx >= 0 && sx <= W && sy >= 0 && sy <= H ? 0 : -1;
}

/**
 * Key on a focused marker: Enter or Space applies the click rule (`clusterClick`) — a spread cluster zooms and focus
 * moves to the map, anything else pins the tooltip and focus moves to its first link. Any other key is left alone (Esc
 * is handled once, by the tooltip's document listener, which returns focus to the marker that opened it).
 */
export function markerKeyAction(
  key: string, c: Cluster, W: number, H: number,
): { kind: 'zoom'; transform: MapTransform; focus: 'map' } | { kind: 'pin'; focus: 'tooltip' } | null {
  if (key !== 'Enter' && key !== ' ') return null;
  const r = clusterClick(c, W, H);
  return r.kind === 'zoom' ? { ...r, focus: 'map' } : { kind: 'pin', focus: 'tooltip' };
}

// ── Tooltip ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tooltip position (`placeTip`): 16 px right of and 12 px above the marker, flipped to the left when it would
 * overflow, then kept 8 px inside the frame.
 */
export function placeTooltip(sx: number, sy: number, tw: number, th: number, W: number, H: number): { x: number; y: number } {
  let x = sx + 16;
  let y = sy - 12;
  if (x + tw > W - 8) x = sx - tw - 16;
  if (y + th > H - 8) y = H - 8 - th;
  if (y < 8) y = 8;
  if (x < 8) x = 8;
  return { x, y };
}

/** Tooltip header parts (`showTip`): the single "City · Country" or the number of sites, and the CAPEX count. */
export function tooltipHeader(items: { city: string; country: string }[]): { place: string | null; sites: number; projects: number } {
  const places = uniq(items.map((i) => `${i.city} · ${i.country}`));
  return { place: places.length === 1 ? places[0] : null, sites: places.length, projects: items.length };
}

/** Marker label (`renderMarkers`): the city, or "{n} sites" for a cluster spanning several cities. */
export function markerLabel(items: { city: string }[]): { city: string | null; sites: number } {
  const cities = uniq(items.map((i) => i.city));
  return { city: cities.length === 1 ? cities[0] : null, sites: cities.length };
}

/** Translator of English source strings (`t()`). */
type Tr = (s: string) => string;

/**
 * Tooltip header text: "{City · Country} · {n} CAPEX", or "{n} sites · {n} CAPEX" for a cluster over several places.
 * Countries arrive translated; the counts go through `t`.
 */
export function tooltipTitle(items: { city: string; country: string }[], t: Tr): string {
  const h = tooltipHeader(items);
  return `${h.place ?? t(`${h.sites} sites`)} · ${t(`${h.projects} CAPEX`)}`;
}

/** Accessible name of a marker (L-7, R-135): the tooltip title, plus the CAPEX's name for a single marker. */
export function markerAriaLabel(items: { city: string; country: string; name: string }[], t: Tr): string {
  const title = tooltipTitle(items, t);
  return items.length === 1 ? `${title} · ${items[0].name}` : title;
}

/** Marker label text: the city, or "{n} sites". */
export function markerLabelText(items: { city: string }[], t: Tr): string {
  const l = markerLabel(items);
  return l.city ?? t(`${l.sites} sites`);
}

// ── Host screen KPI tiles ─────────────────────────────────────────────────────────────────────────────

export interface MapKpiView {
  key: 'located' | 'countries' | 'execution' | 'budget';
  /** English source strings (render through t()). */
  label: string;
  value: string;
  sub: string;
}

/** "CAPEX located" (sub: "{n} without location"), "Countries", "In execution" (phases 3–4, "{n} in phases 1–2"). */
export function capexMapKpis(points: { style: MarkerStyle; country: string }[], unlocated: number): Omit<MapKpiView, 'key'>[] {
  const countries = uniq(points.map((p) => p.country));
  return [
    { label: 'CAPEX located', value: String(points.length), sub: unlocated ? `${unlocated} without location` : 'every CAPEX located' },
    { label: 'Countries', value: String(countries.length), sub: countries.join(' · ') || '—' },
    { label: 'In execution', value: String(points.filter((p) => p.style === 'ontrack').length), sub: `${points.filter((p) => p.style === 'pipeline').length} in phases 1–2` },
  ];
}
