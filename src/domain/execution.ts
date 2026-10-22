// Execution follow-up of a CAPEX (docs/spec/06 §3, N-14): budget of each lot (G2 baseline, else the latest validated version),
// planned over the lot's window (start and end months, spread evenly), the committed, spent and physical % of each month —
// entered or imported by the controller for the lots outside EPC2i, read in Keystone for the machine lots — and the consolidated
// S-curve with SPI, CPI and EAC; the works completion of K3 and the uncertainty gap (CDC §4). Values entered for a month are
// cumulative to the end of that month. Pure.
import { classWidthPct, parseKeur, round1, type EstimateClass } from './budget';
import type { GateCode } from './lifecycle';

export type Month = string; // "2026-10"

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const isMonth = (v: unknown): v is Month => typeof v === 'string' && MONTH_RE.test(v);
const idx = (m: Month) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const ofIdx = (i: number): Month => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const monthOf = (day: string): Month => day.slice(0, 7);
export const addMonths = (m: Month, n: number) => ofIdx(idx(m) + n);
export function monthsBetween(a: Month, b: Month): Month[] {
  const out: Month[] = [];
  for (let i = idx(a); i <= idx(b); i++) out.push(ofIdx(i));
  return out;
}

/** Lot kinds that make up the works of K3 (spec 03 §3: "lots de travaux"). */
export const WORKS_KINDS = ['civil_works', 'buildings', 'utilities', 'vrd'] as const;

export interface LotPlan {
  id: string;
  number: number;
  kind: string;
  title: string;
  epc2i: boolean;
  budgetKeur: number;
  start: Month | null;
  end: Month | null;
}

export interface LotActual {
  lotId: string;
  month: Month;
  committedKeur: number | null;
  spentKeur: number | null;
  physicalPct: number | null;
}

/** Planned cumulative amount of a lot at the end of `m` (0 before its window, its budget after); null without a window. */
export function plannedAt(l: LotPlan, m: Month): number | null {
  if (!l.start || !l.end) return null;
  const n = idx(l.end) - idx(l.start) + 1;
  const done = Math.min(Math.max(idx(m) - idx(l.start) + 1, 0), n);
  return (l.budgetKeur * done) / n;
}

/** The latest values of a lot at the end of `m` (each measure from the latest month that has it). */
export function actualAt(rows: readonly LotActual[], lotId: string, m: Month): { committedKeur: number; spentKeur: number; physicalPct: number } {
  const mine = rows.filter((r) => r.lotId === lotId && idx(r.month) <= idx(m)).sort((a, b) => idx(b.month) - idx(a.month));
  const last = <K extends 'committedKeur' | 'spentKeur' | 'physicalPct'>(k: K) => mine.find((r) => r[k] != null)?.[k] ?? 0;
  return { committedKeur: last('committedKeur')!, spentKeur: last('spentKeur')!, physicalPct: last('physicalPct')! };
}

export interface Indicators {
  /** Budget at completion: Σ lot budgets. */
  bacKeur: number;
  /** Planned value at the end of the month (lots without window left out). */
  pvKeur: number;
  /** Earned value: Σ budget × physical %. */
  evKeur: number;
  /** Actual cost: Σ spent. */
  acKeur: number;
  committedKeur: number;
  spi: number | null;
  cpi: number | null;
  /** EAC = AC + (BAC − EV) / CPI; BAC while nothing is spent. */
  eacKeur: number;
  /** Lots without a planned window (they do not count in the planned value). */
  unplanned: number;
}

const ratio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : null);

export function indicatorsAt(lots: readonly LotPlan[], rows: readonly LotActual[], m: Month): Indicators {
  let pv = 0, ev = 0, ac = 0, committed = 0, unplanned = 0;
  for (const l of lots) {
    const p = plannedAt(l, m);
    if (p == null) unplanned += 1;
    else pv += p;
    const a = actualAt(rows, l.id, m);
    ev += (l.budgetKeur * a.physicalPct) / 100;
    ac += a.spentKeur;
    committed += a.committedKeur;
  }
  const bac = lots.reduce((s, l) => s + l.budgetKeur, 0);
  const cpi = ratio(ev, ac);
  const eac = ac > 0 && cpi ? ac + (bac - ev) / cpi : bac;
  return { bacKeur: round1(bac), pvKeur: round1(pv), evKeur: round1(ev), acKeur: round1(ac), committedKeur: round1(committed), spi: ratio(ev, pv), cpi, eacKeur: round1(eac), unplanned };
}

export interface SCurvePoint {
  month: Month;
  planned: number;
  /** Earned value and actual cost, up to the current month only. */
  earned: number | null;
  actual: number | null;
}

/** The consolidated S-curve from the first planned or actual month to the last planned month (at least to `current`). */
export function sCurve(lots: readonly LotPlan[], rows: readonly LotActual[], current: Month): SCurvePoint[] {
  const starts = [...lots.map((l) => l.start), ...rows.map((r) => r.month)].filter(isMonth);
  const ends = [...lots.map((l) => l.end), current].filter(isMonth);
  if (!starts.length) return [];
  const from = starts.reduce((a, b) => (idx(b) < idx(a) ? b : a));
  const to = ends.reduce((a, b) => (idx(b) > idx(a) ? b : a));
  return monthsBetween(from, to).map((m) => {
    const i = indicatorsAt(lots, rows, m);
    const past = idx(m) <= idx(current);
    return { month: m, planned: i.pvKeur, earned: past ? i.evKeur : null, actual: past ? i.acKeur : null };
  });
}

/** K3 criterion: the works lots (outside EPC2i) weighted by budget, at the threshold (spec 03 §3: ≥ 95 %). */
export function worksFact(lots: readonly LotPlan[], rows: readonly LotActual[], m: Month, thresholdPct: number): { met: boolean; value: string } | undefined {
  const works = lots.filter((l) => !l.epc2i && (WORKS_KINDS as readonly string[]).includes(l.kind) && l.budgetKeur > 0);
  if (!works.length) return { met: true, value: 'No works lot' };
  const budget = works.reduce((s, l) => s + l.budgetKeur, 0);
  const pct = Math.round((works.reduce((s, l) => s + l.budgetKeur * actualAt(rows, l.id, m).physicalPct, 0) / budget) * 10) / 10;
  return { met: pct >= thresholdPct, value: `${pct} %` };
}

/** The class each gate expects (spec 03 §5): G1 → E50, G2 → E10. */
const TARGET_CLASS: Partial<Record<GateCode, EstimateClass>> = { G1: 'E50', G2: 'E10' };

export type UncertaintyGap =
  | { kind: 'range'; widthPct: number; targetClass: EstimateClass; targetWidthPct: number; gapPts: number }
  | { kind: 'eac'; deviationPct: number; lowPct: number; highPct: number; within: boolean }
  | null;

/**
 * Uncertainty gap (CDC §4, spec 06 §3): before G2, the relative width of the latest validated version's range against the class
 * the next gate expects (E30 = 60 % before G2's E10 = 15 % → 45 points); after G2, EAC against the G2 budget compared with the
 * E10 range (−5 % / +10 %).
 */
export function uncertaintyGap(i: { latestClass: EstimateClass | null; nextGate: GateCode | null; afterG2: boolean; g2Keur: number | null; eacKeur: number | null }): UncertaintyGap {
  if (i.afterG2) {
    if (!i.g2Keur || i.eacKeur == null) return null;
    const deviationPct = round1((i.eacKeur / i.g2Keur - 1) * 100);
    return { kind: 'eac', deviationPct, lowPct: -5, highPct: 10, within: deviationPct >= -5 && deviationPct <= 10 };
  }
  const target = i.nextGate ? TARGET_CLASS[i.nextGate] : undefined;
  if (!i.latestClass || !target) return null;
  const widthPct = classWidthPct(i.latestClass);
  const targetWidthPct = classWidthPct(target);
  return { kind: 'range', widthPct, targetClass: target, targetWidthPct, gapPts: Math.max(0, widthPct - targetWidthPct) };
}

// ── Input ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const pctOf = (v: unknown): number | null | 'bad' => {
  const s = text(v).replace(',', '.').replace(/\s*%$/, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? round1(n) : 'bad';
};
const keurOf = (v: unknown): number | null | 'bad' => (text(v) ? parseKeur(text(v)) ?? 'bad' : null);

export type ActualInput = Omit<LotActual, 'lotId'>;

/** A month's values of a lot (cumulative to the end of the month): at least one measure; the month not after the current one. */
export function checkActual(raw: Record<string, unknown>, current: Month): { ok: true; value: ActualInput } | { ok: false; error: string } {
  const month = text(raw.month);
  if (!isMonth(month)) return { ok: false, error: 'Give the month (YYYY-MM)' };
  if (idx(month) > idx(current)) return { ok: false, error: 'The month cannot be in the future' };
  const committedKeur = keurOf(raw.committedKeur);
  const spentKeur = keurOf(raw.spentKeur);
  const physicalPct = pctOf(raw.physicalPct);
  if (committedKeur === 'bad' || spentKeur === 'bad') return { ok: false, error: 'Amounts are positive numbers in k€' };
  if (physicalPct === 'bad') return { ok: false, error: 'The physical progress goes from 0 to 100 %' };
  if (committedKeur == null && spentKeur == null && physicalPct == null) return { ok: false, error: 'Enter at least one value' };
  return { ok: true, value: { month, committedKeur, spentKeur, physicalPct } };
}

/** A lot's planned window: both months or neither, the end not before the start. */
export function checkWindow(raw: Record<string, unknown>): { ok: true; value: { start: Month | null; end: Month | null } } | { ok: false; error: string } {
  const start = text(raw.start) || null;
  const end = text(raw.end) || null;
  if (!start && !end) return { ok: true, value: { start: null, end: null } };
  if (!isMonth(start) || !isMonth(end)) return { ok: false, error: 'Give the start and end months (YYYY-MM)' };
  if (idx(end) < idx(start)) return { ok: false, error: 'The end month is before the start month' };
  return { ok: true, value: { start, end } };
}

/** Header of Arche's import template (N-14). */
export const ACTUALS_CSV_HEADER = 'lot;month;committed_keur;spent_keur;physical_pct';

/**
 * Parses Arche's import template: one line per lot and month, `;`-separated (decimal comma accepted), the lot by its number.
 * Lines of EPC2i lots are refused (they come from Keystone). Every line is checked; one error refuses the whole file.
 */
export function parseActualsCsv(csv: string, lots: readonly { id: string; number: number; epc2i: boolean }[], current: Month): { ok: true; value: LotActual[] } | { ok: false; error: string; line?: number } {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, error: 'The file is empty' };
  const body = /^lot\s*;/i.test(lines[0]) ? lines.slice(1) : lines;
  if (!body.length) return { ok: false, error: 'The file is empty' };
  if (body.length > 2000) return { ok: false, error: 'At most 2,000 lines per import' };
  const seen = new Set<string>();
  const out: LotActual[] = [];
  for (const [i, l] of body.entries()) {
    const line = i + (body === lines ? 1 : 2);
    const [lot, month, committedKeur, spentKeur, physicalPct, ...rest] = l.split(';');
    if (rest.some((x) => x.trim())) return { ok: false, error: 'Too many columns', line };
    const n = Number(text(lot));
    const target = lots.find((x) => x.number === n);
    if (!target) return { ok: false, error: 'Unknown lot number', line };
    if (target.epc2i) return { ok: false, error: 'EPC2i lots come from Keystone', line };
    const ch = checkActual({ month, committedKeur, spentKeur, physicalPct }, current);
    if (!ch.ok) return { ok: false, error: ch.error, line };
    const key = `${target.id}@${ch.value.month}`;
    if (seen.has(key)) return { ok: false, error: 'The same lot and month appear twice', line };
    seen.add(key);
    out.push({ lotId: target.id, ...ch.value });
  }
  return { ok: true, value: out };
}

/** Values of an EPC2i lot from its projects (Keystone, AC-2): committed = contract + signed amendments, spent = invoiced. */
export function epc2iLotValues(projects: readonly { contractKeur: number | null; amendmentsKeur: number | null; invoicedKeur: number | null; physicalPct: number | null }[]): { committedKeur: number; spentKeur: number; physicalPct: number } | null {
  if (!projects.length) return null;
  const committed = projects.reduce((s, p) => s + (p.contractKeur ?? 0) + (p.amendmentsKeur ?? 0), 0);
  const spent = projects.reduce((s, p) => s + (p.invoicedKeur ?? 0), 0);
  const weight = projects.reduce((s, p) => s + (p.contractKeur ?? 0), 0);
  const physical = weight > 0 ? projects.reduce((s, p) => s + (p.contractKeur ?? 0) * (p.physicalPct ?? 0), 0) / weight : projects.reduce((s, p) => s + (p.physicalPct ?? 0), 0) / projects.length;
  return { committedKeur: round1(committed), spentKeur: round1(spent), physicalPct: round1(physical) };
}
