// Ramp-up of a CAPEX (docs/spec/06 §6, N-16; CDC §2 phase 4): after the start of commissioning (MES, entered by the project
// lead once the PSSR is passed), a daily entry per production line — output, and either the OEE or availability /
// performance / quality (OEE = A × P × Q), scrap rate; planned stops declared neutral. A conforming day: output ≥ the share of
// the nominal daily capacity (100 %, N-16) and scrap ≤ the line's target. G3 needs every line at the required run of
// consecutive conforming days (30); the run's end date is published in pub_rampup. Alert at M+5 after the start of
// commissioning, overrun of the 6 months flagged to the group industrial director. Pure.
import { addMonths } from './governance';

export interface LineDef {
  id: string;
  number: number;
  name: string;
  /** Nominal capacity per day, in `unit`. */
  nominalPerDay: number;
  unit: string;
  /** Scrap target of the line, in %. */
  scrapTargetPct: number;
  machineNumbers: string[];
}

export interface RampupDay {
  lineId: string;
  day: string;
  output: number | null;
  availabilityPct: number | null;
  performancePct: number | null;
  qualityPct: number | null;
  /** OEE entered directly; else computed A × P × Q. */
  oeePct: number | null;
  scrapPct: number | null;
  /** A planned stop: neutral (it neither breaks nor extends the run). */
  plannedStop: boolean;
}

/** Thresholds of the model (N-16; adjustable values `rampupDays`, `mesMaxMonths`). */
export interface RampupRules {
  requiredDays: number;
  /** Share of the nominal daily capacity a conforming day reaches, in %. */
  capacityPct: number;
  maxMonths: number;
}

export const DEFAULT_CAPACITY_PCT = 100;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** OEE of a day: entered, else A × P × Q when the three are entered; null otherwise. */
export function oeeOf(d: Pick<RampupDay, 'oeePct' | 'availabilityPct' | 'performancePct' | 'qualityPct'>): number | null {
  if (d.oeePct != null) return d.oeePct;
  if (d.availabilityPct == null || d.performancePct == null || d.qualityPct == null) return null;
  return r1((d.availabilityPct * d.performancePct * d.qualityPct) / 10_000);
}

/** Output as a share of the nominal daily capacity, in %. */
export const capacityShare = (line: Pick<LineDef, 'nominalPerDay'>, output: number | null) => (output == null || line.nominalPerDay <= 0 ? null : r1((output / line.nominalPerDay) * 100));

/** A conforming day (N-16): output ≥ capacityPct of the nominal and scrap ≤ the line's target; a planned stop is neutral. */
export function dayState(line: LineDef, d: RampupDay, rules: Pick<RampupRules, 'capacityPct'>): 'conforming' | 'not_conforming' | 'neutral' {
  if (d.plannedStop) return 'neutral';
  const share = capacityShare(line, d.output);
  const ok = share != null && share >= rules.capacityPct && d.scrapPct != null && d.scrapPct <= line.scrapTargetPct;
  return ok ? 'conforming' : 'not_conforming';
}

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export interface LineRampup {
  lineId: string;
  /** Length of the current run of consecutive conforming days (planned stops neutral; a missing day breaks the run). */
  currentRun: number;
  bestRun: number;
  /** Last day of the first run that reached the required length; null when not reached. */
  reachedOn: string | null;
  days: number;
  /** Averages over the run that reached the target, else over the last `requiredDays` days entered. */
  avgCapacityPct: number | null;
  avgOeePct: number | null;
  avgScrapPct: number | null;
}

/** The run of a line from its days (any order). A calendar day without entry breaks the run, like a non-conforming day. */
export function lineRampup(line: LineDef, all: readonly RampupDay[], rules: Pick<RampupRules, 'capacityPct' | 'requiredDays'>): LineRampup {
  const days = all.filter((d) => d.lineId === line.id).sort((a, b) => a.day.localeCompare(b.day));
  let run = 0, best = 0, reachedOn: string | null = null, prev: string | null = null;
  let runDays: RampupDay[] = [];
  let reachedDays: RampupDay[] | null = null;
  for (const d of days) {
    if (prev && d.day !== nextDay(prev)) {
      run = 0;
      runDays = [];
    }
    prev = d.day;
    const s = dayState(line, d, rules);
    if (s === 'neutral') continue;
    if (s === 'conforming') {
      run += 1;
      runDays.push(d);
      best = Math.max(best, run);
      if (!reachedOn && run >= rules.requiredDays) {
        reachedOn = d.day;
        reachedDays = [...runDays];
      }
    } else {
      run = 0;
      runDays = [];
    }
  }
  const basis = (reachedDays ?? days.filter((d) => !d.plannedStop).slice(-rules.requiredDays));
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return {
    lineId: line.id, currentRun: run, bestRun: best, reachedOn, days: days.length,
    avgCapacityPct: avg(basis.map((d) => capacityShare(line, d.output))), avgOeePct: avg(basis.map(oeeOf)), avgScrapPct: avg(basis.map((d) => d.scrapPct)),
  };
}

export interface CapexRampup {
  mesStartedOn: string | null;
  /** Alert date (M+5) and limit (M+6) after the start of commissioning. */
  alertOn: string | null;
  limitOn: string | null;
  lines: LineRampup[];
  /** Every line reached; the CAPEX's date is the latest line's. */
  reachedOn: string | null;
  status: 'not_started' | 'in_progress' | 'reached' | 'overdue';
}

export function capexRampup(i: { mesStartedOn: string | null; lines: readonly LineDef[]; days: readonly RampupDay[] }, rules: RampupRules, today: string): CapexRampup {
  const lines = i.lines.map((l) => lineRampup(l, i.days, rules));
  const all = lines.length > 0 && lines.every((l) => l.reachedOn);
  const reachedOn = all ? lines.map((l) => l.reachedOn!).sort().at(-1)! : null;
  const limitOn = i.mesStartedOn ? addMonths(i.mesStartedOn, rules.maxMonths) : null;
  const alertOn = i.mesStartedOn ? addMonths(i.mesStartedOn, Math.max(0, rules.maxMonths - 1)) : null;
  const status = !i.mesStartedOn ? 'not_started' : all ? 'reached' : limitOn && today > limitOn ? 'overdue' : 'in_progress';
  return { mesStartedOn: i.mesStartedOn, alertOn, limitOn, lines, reachedOn, status };
}

/**
 * G3 criteria (spec 03 §3): the continuous days reached on every line (blocking); within the time limit after the start of
 * commissioning (an alert, not blocking: the reached date, or today, against M+6).
 */
export function rampupFacts(r: CapexRampup, requiredDays: number, today: string): Record<string, { met: boolean; value?: string }> {
  if (!r.mesStartedOn) return { g3_rampup: { met: false, value: 'Commissioning not started' }, g3_mes_delay: { met: false, value: 'Commissioning not started' } };
  const reached = r.lines.filter((l) => l.reachedOn).length;
  const on = r.reachedOn ?? today;
  return {
    g3_rampup: { met: !!r.reachedOn, value: r.lines.length ? `${reached} / ${r.lines.length} · ${Math.min(...r.lines.map((l) => l.currentRun))} / ${requiredDays}` : 'No production line' },
    g3_mes_delay: { met: !!r.limitOn && on <= r.limitOn, value: r.limitOn ?? undefined },
  };
}

// ── Input ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null | 'bad' => {
  const s = text(v).replace(/[\s  ]/g, '').replace(',', '.').replace(/%$/, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? r1(n) : 'bad';
};
const pct = (v: unknown): number | null | 'bad' => {
  const n = num(v);
  return n === 'bad' || n == null ? n : n <= 100 ? n : 'bad';
};

export interface LineInput {
  name: string;
  nominalPerDay: number;
  unit: string;
  scrapTargetPct: number;
  machineNumbers: string[];
}

/** A production line: name, nominal capacity per day (> 0) and unit, scrap target (%), Keystone machine numbers (MCH-…). */
export function checkLine(raw: Record<string, unknown>): { ok: true; value: LineInput } | { ok: false; error: string } {
  const name = text(raw.name).slice(0, 200);
  if (!name) return { ok: false, error: 'Name the production line' };
  const nominal = num(raw.nominalPerDay);
  if (nominal === 'bad' || !nominal) return { ok: false, error: 'The nominal capacity per day is a positive number' };
  const unit = text(raw.unit).slice(0, 40);
  if (!unit) return { ok: false, error: 'Give the unit of the capacity' };
  const scrap = pct(raw.scrapTargetPct);
  if (scrap === 'bad' || scrap == null) return { ok: false, error: 'The scrap target goes from 0 to 100 %' };
  const machineNumbers = [...new Set(text(raw.machineNumbers).split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))].slice(0, 50);
  if (machineNumbers.some((m) => !/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(m))) return { ok: false, error: 'Machine numbers are Keystone numbers (MCH-041)' };
  return { ok: true, value: { name, nominalPerDay: nominal, unit, scrapTargetPct: scrap, machineNumbers } };
}

export type DayInput = Omit<RampupDay, 'lineId'>;

/**
 * A day of a line: not before the start of commissioning nor after today; a planned stop needs nothing else; otherwise the
 * output and the scrap rate, and the OEE or its three factors (OEE computed then).
 */
export function checkDay(raw: Record<string, unknown>, ctx: { mesStartedOn: string | null; today: string }): { ok: true; value: DayInput } | { ok: false; error: string } {
  const day = text(raw.day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Give the day' };
  if (!ctx.mesStartedOn) return { ok: false, error: 'Commissioning has not started' };
  if (day < ctx.mesStartedOn) return { ok: false, error: 'The day is before the start of commissioning' };
  if (day > ctx.today) return { ok: false, error: 'The day cannot be in the future' };
  const plannedStop = raw.plannedStop === 'on' || raw.plannedStop === 'true' || raw.plannedStop === true;
  if (plannedStop) return { ok: true, value: { day, plannedStop, output: null, availabilityPct: null, performancePct: null, qualityPct: null, oeePct: null, scrapPct: null } };
  const output = num(raw.output);
  const vals = { availabilityPct: pct(raw.availabilityPct), performancePct: pct(raw.performancePct), qualityPct: pct(raw.qualityPct), oeePct: pct(raw.oeePct), scrapPct: pct(raw.scrapPct) };
  if (output === 'bad' || output == null) return { ok: false, error: 'Give the output of the day' };
  if (Object.values(vals).includes('bad')) return { ok: false, error: 'Rates go from 0 to 100 %' };
  const v = vals as Record<keyof typeof vals, number | null>;
  if (v.scrapPct == null) return { ok: false, error: 'Give the scrap rate' };
  const factors = [v.availabilityPct, v.performancePct, v.qualityPct];
  if (v.oeePct == null && factors.some((f) => f == null)) return { ok: false, error: 'Give the OEE, or availability, performance and quality' };
  return { ok: true, value: { day, plannedStop, output, ...v, oeePct: v.oeePct ?? oeeOf({ ...v, oeePct: null }) } };
}

/** Header of Arche's ramp-up import template (N-16). */
export const RAMPUP_CSV_HEADER = 'line;day;output;availability_pct;performance_pct;quality_pct;oee_pct;scrap_pct;planned_stop';

/** Parses the template: the line by its number; every line checked; one error refuses the file. */
export function parseRampupCsv(csv: string, lines: readonly { id: string; number: number }[], ctx: { mesStartedOn: string | null; today: string }): { ok: true; value: RampupDay[] } | { ok: false; error: string; line?: number } {
  const rows = csv.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const body = rows.length && /^line\s*;/i.test(rows[0]) ? rows.slice(1) : rows;
  if (!body.length) return { ok: false, error: 'The file is empty' };
  if (body.length > 5000) return { ok: false, error: 'At most 5,000 lines per import' };
  const seen = new Set<string>();
  const out: RampupDay[] = [];
  for (const [i, l] of body.entries()) {
    const line = i + (body === rows ? 1 : 2);
    const [n, day, output, availabilityPct, performancePct, qualityPct, oeePct, scrapPct, stop, ...rest] = l.split(';');
    if (rest.some((x) => x.trim())) return { ok: false, error: 'Too many columns', line };
    const target = lines.find((x) => x.number === Number(text(n)));
    if (!target) return { ok: false, error: 'Unknown production line number', line };
    const ch = checkDay({ day, output, availabilityPct, performancePct, qualityPct, oeePct, scrapPct, plannedStop: /^(1|yes|oui|true|x)$/i.test(text(stop)) ? 'on' : '' }, ctx);
    if (!ch.ok) return { ok: false, error: ch.error, line };
    const key = `${target.id}@${ch.value.day}`;
    if (seen.has(key)) return { ok: false, error: 'The same line and day appear twice', line };
    seen.add(key);
    out.push({ lineId: target.id, ...ch.value });
  }
  return { ok: true, value: out };
}

/** Start of commissioning (spec 06 §6): in phase 4, after the PSSR is passed, not in the future, once. */
export function checkMesStart(raw: Record<string, unknown>, ctx: { phase: string; status: string; pssrPassed: boolean; mesStartedOn: string | null; today: string }): { ok: true; value: string } | { ok: false; error: string } {
  if (ctx.status !== 'active' || ctx.phase !== 'demarrage') return { ok: false, error: 'Commissioning starts in phase 4' };
  if (ctx.mesStartedOn) return { ok: false, error: 'Commissioning has already started' };
  if (!ctx.pssrPassed) return { ok: false, error: 'The PSSR must be passed before the start of commissioning' };
  const day = text(raw.day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Give the day' };
  if (day > ctx.today) return { ok: false, error: 'The day cannot be in the future' };
  return { ok: true, value: day };
}
