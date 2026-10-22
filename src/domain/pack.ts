// Engineering pack of a CAPEX (C-9, confirmed; docs/spec/03 §3, 06 §5): the subsidiary's part is a standard list of items by
// family, each with a weight; EPC2i's part is read in Keystone (pub_pack_ingenierie: expected / validated items by family and
// the family's weight). % = Σ weight of the validated items / Σ weight of the expected items (items "not applicable" left out).
// The standard list is to be provided by the owner (C-9): until then, the seed below — five families of equal weight.
// Pure: labels are EN source strings.

export type PackItemStatus = 'expected' | 'in_progress' | 'validated' | 'not_applicable';
export const PACK_ITEM_STATUSES: readonly PackItemStatus[] = ['expected', 'in_progress', 'validated', 'not_applicable'];
export const PACK_ITEM_STATUS_LABEL: Record<PackItemStatus, string> = { expected: 'Expected', in_progress: 'In progress', validated: 'Validated', not_applicable: 'Not applicable' };

export interface PackTemplateItem {
  code: string;
  family: string;
  /** EN source string. */
  label: string;
}

export interface PackFamily {
  code: string;
  label: string;
  weight: number;
}

/** Families of the subsidiary's part (C-9 seed: equal weights). */
export const PACK_FAMILIES: readonly PackFamily[] = [
  { code: 'site', label: 'Site and civil works', weight: 20 },
  { code: 'buildings', label: 'Buildings', weight: 20 },
  { code: 'utilities', label: 'Utilities and networks', weight: 20 },
  { code: 'process', label: 'Process and layout', weight: 20 },
  { code: 'hse', label: 'HSE and regulatory studies', weight: 20 },
];

/** Standard list of the subsidiary's items (C-9 seed, the same for every investment type until the owner's list arrives). */
export const PACK_TEMPLATE: readonly PackTemplateItem[] = [
  { code: 'site.survey', family: 'site', label: 'Topographic and geotechnical survey' },
  { code: 'site.plan', family: 'site', label: 'Site plan and earthworks' },
  { code: 'bld.apd', family: 'buildings', label: 'Building detailed design' },
  { code: 'bld.structure', family: 'buildings', label: 'Structural calculations' },
  { code: 'utl.balance', family: 'utilities', label: 'Utilities balance (power, water, gas, air)' },
  { code: 'utl.networks', family: 'utilities', label: 'Networks and connections design' },
  { code: 'prc.flow', family: 'process', label: 'Process flow diagram' },
  { code: 'prc.layout', family: 'process', label: 'General layout of the plant' },
  { code: 'hse.fire', family: 'hse', label: 'Fire safety study' },
  { code: 'hse.impact', family: 'hse', label: 'Environmental impact study' },
];

export const isPackItem = (code: string) => PACK_TEMPLATE.some((i) => i.code === code);

/** EPC2i families of pub_pack_ingenierie (docs/CONTRATS.md §2.2). */
export const EPC2I_FAMILY_LABEL: Record<string, string> = {
  pid: 'P&ID', bom: 'Bill of materials', layout: 'Machine layout', electrique: 'Electrical diagrams and power balance', analyse_fonctionnelle: 'Functional analysis',
};

export interface PackItemState {
  code: string;
  status: PackItemStatus;
  codexRef: string | null;
  validatedOn: string | null;
}

/** A row of the EPC2i part (one per project and family). */
export interface Epc2iPackRow {
  projectCode: string;
  family: string;
  expected: number;
  validated: number;
  weight: number;
}

export interface PackPart {
  /** Σ weight of the expected items (not applicable left out). */
  expectedWeight: number;
  validatedWeight: number;
  pct: number | null;
}

const pctOf = (validated: number, expected: number) => (expected > 0 ? Math.round((validated / expected) * 1000) / 10 : null);

/** The subsidiary's part: each family's weight shared equally among its items. */
export function subsidiaryPart(items: readonly PackItemState[]): PackPart & { families: (PackFamily & { expected: number; validated: number; pct: number | null })[] } {
  const families = PACK_FAMILIES.map((f) => {
    const all = PACK_TEMPLATE.filter((i) => i.family === f.code);
    const unit = all.length ? f.weight / all.length : 0;
    const st = all.map((i) => items.find((x) => x.code === i.code)?.status ?? 'expected');
    const expected = st.filter((s) => s !== 'not_applicable').length;
    const validated = st.filter((s) => s === 'validated').length;
    return { ...f, expected, validated, ew: expected * unit, vw: validated * unit, pct: pctOf(validated, expected) };
  });
  const expectedWeight = families.reduce((s, f) => s + f.ew, 0);
  const validatedWeight = families.reduce((s, f) => s + f.vw, 0);
  return { expectedWeight, validatedWeight, pct: pctOf(validatedWeight, expectedWeight), families: families.map((f) => ({ code: f.code, label: f.label, weight: f.weight, expected: f.expected, validated: f.validated, pct: f.pct })) };
}

/** EPC2i's part: Σ family weight × validated / expected over the projects' families. */
export function epc2iPart(rows: readonly Epc2iPackRow[]): PackPart {
  const live = rows.filter((r) => r.expected > 0 && r.weight > 0);
  const expectedWeight = live.reduce((s, r) => s + r.weight, 0);
  const validatedWeight = live.reduce((s, r) => s + r.weight * Math.min(1, r.validated / r.expected), 0);
  return { expectedWeight, validatedWeight, pct: pctOf(validatedWeight, expectedWeight) };
}

export interface PackSummary {
  subsidiary: ReturnType<typeof subsidiaryPart>;
  epc2i: PackPart;
  /** Weighted over both parts; null when nothing is expected. */
  pct: number | null;
  /** EPC2i's share of the expected weight, in %. */
  epc2iSharePct: number | null;
}

export function packSummary(items: readonly PackItemState[], rows: readonly Epc2iPackRow[]): PackSummary {
  const s = subsidiaryPart(items);
  const e = epc2iPart(rows);
  const expected = s.expectedWeight + e.expectedWeight;
  return { subsidiary: s, epc2i: e, pct: pctOf(s.validatedWeight + e.validatedWeight, expected), epc2iSharePct: expected > 0 ? Math.round((e.expectedWeight / expected) * 1000) / 10 : null };
}

/** G2 criterion: the weighted pack strictly above the threshold (spec 03 §3: "> 80 %"). */
export function packFact(p: PackSummary, thresholdPct: number): { met: boolean; value: string } {
  return { met: p.pct != null && p.pct > thresholdPct, value: p.pct == null ? '—' : `${p.pct} %` };
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** An item's status: validating needs the Codex reference of the document (Arche stores no file). */
export function checkPackItem(raw: Record<string, unknown>, today: string): { ok: true; value: { status: PackItemStatus; codexRef: string | null; validatedOn: string | null } } | { ok: false; error: string } {
  const status = text(raw.status) as PackItemStatus;
  if (!PACK_ITEM_STATUSES.includes(status)) return { ok: false, error: 'Choose a status' };
  const codexRef = text(raw.codexRef).slice(0, 120) || null;
  if (status === 'validated' && !codexRef) return { ok: false, error: 'Give the Codex reference of the validated document' };
  return { ok: true, value: { status, codexRef, validatedOn: status === 'validated' ? today : null } };
}
