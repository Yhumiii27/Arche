// Import of the commitments and actuals from the ERP (Sage, AR-047, DECISIONS.md §5): an extraction file of the subsidiary —
// orders (commitments) and invoices (actuals), one line per document and analytic code — read line by line. A line whose
// analytic code is a lot's Sage code goes to that lot; a line already imported (same type, number and analytic code) is
// skipped; any other line is rejected with its reason, never the whole file. The lot's cumulative committed and spent amounts at
// the end of each month are computed from every line kept. The manual CSV template (N-14) stays. Pure.
import { round1 } from './budget';
import { isMonth, monthOf, type Month } from './execution';

/** The extraction format agreed for the pilot (the DSI confirms it: N-14). */
export const SAGE_HEADER = 'company;date;type;number;analytic;amount;currency;supplier;label';
export const SAGE_TYPES = { CMD: 'order', FAC: 'invoice', AVO: 'credit' } as const;
export type SageKind = (typeof SAGE_TYPES)[keyof typeof SAGE_TYPES];

export interface SageLine {
  lineNo: number;
  company: string;
  date: string;
  kind: SageKind;
  number: string;
  analytic: string;
  /** In the currency of the line, units (not thousands); a credit note is negative. */
  amount: number;
  currency: string;
  supplier: string | null;
  label: string | null;
}

export interface SageReject {
  lineNo: number;
  raw: string;
  reason: string;
}

/** The unique key of a document line: its type, number and analytic code. */
export const sageKey = (l: Pick<SageLine, 'kind' | 'number' | 'analytic'>) => `${l.kind}:${l.number}:${l.analytic}`;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Reads an extraction file: the lines read and the lines rejected (header required; `;` separated; dates ISO or dd/mm/yyyy). */
export function parseSageCsv(csv: string, company: string): { ok: true; lines: SageLine[]; rejects: SageReject[] } | { ok: false; error: string } {
  const rows = csv.replace(/^﻿/, '').split(/\r?\n/);
  const header = rows[0]?.trim().toLowerCase();
  if (header !== SAGE_HEADER) return { ok: false, error: `The first line must be: ${SAGE_HEADER}` };
  const lines: SageLine[] = [];
  const rejects: SageReject[] = [];
  rows.slice(1).forEach((raw, i) => {
    const lineNo = i + 2;
    if (!raw.trim()) return;
    const reject = (reason: string) => rejects.push({ lineNo, raw: raw.slice(0, 500), reason });
    const f = raw.split(';').map((x) => x.trim());
    if (f.length < 7) return reject('Missing fields');
    const [co, d, type, number, analytic, amountRaw, currency, supplier, ...label] = f;
    if (co.toUpperCase() !== company) return reject('Another company');
    const fr = FR_DATE.exec(d);
    const date = ISO.test(d) ? d : fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : null;
    if (!date || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return reject('Unreadable date');
    const kind = SAGE_TYPES[type.toUpperCase() as keyof typeof SAGE_TYPES];
    if (!kind) return reject('Unknown document type (CMD, FAC or AVO)');
    if (!number) return reject('Missing document number');
    if (!analytic) return reject('Missing analytic code');
    const amount = Number(amountRaw.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(amount)) return reject('Unreadable amount');
    if (!/^[A-Z]{3}$/i.test(currency)) return reject('Unreadable currency');
    lines.push({ lineNo, company: co.toUpperCase(), date, kind, number, analytic: analytic.toUpperCase(), amount: kind === 'credit' ? -Math.abs(amount) : amount, currency: currency.toUpperCase(), supplier: supplier || null, label: label.join(';') || null });
  });
  return { ok: true, lines, rejects };
}

/**
 * The cumulative amounts of each lot at the end of each month from its first document to `current`, in the currency of the
 * lines (units): committed = orders; spent = invoices and credit notes.
 */
export function cumulativeByMonth(lines: readonly { lotId: string; date: string; kind: SageKind; amount: number }[], current: Month) {
  const out: { lotId: string; month: Month; committed: number; spent: number }[] = [];
  for (const lotId of [...new Set(lines.map((l) => l.lotId))]) {
    const mine = lines.filter((l) => l.lotId === lotId);
    const months = [...new Set(mine.map((l) => monthOf(l.date)))].filter((m) => isMonth(m) && m <= current).sort();
    for (const m of months) {
      const upTo = mine.filter((l) => monthOf(l.date) <= m);
      out.push({
        lotId, month: m,
        committed: round1(upTo.filter((l) => l.kind === 'order').reduce((s, l) => s + l.amount, 0)),
        spent: round1(upTo.filter((l) => l.kind !== 'order').reduce((s, l) => s + l.amount, 0)),
      });
    }
  }
  return out;
}

/** A lot's Sage analytic code as typed: letters, digits, dot, dash, underscore (empty: none). */
export function checkSageCode(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = String(raw ?? '').trim().toUpperCase();
  if (!v) return { ok: true, value: null };
  if (!/^[A-Z0-9._-]{2,30}$/.test(v)) return { ok: false, error: 'A Sage analytic code is 2 to 30 letters, digits, dots or dashes' };
  return { ok: true, value: v };
}

/**
 * The demonstration extraction of SAI (Sage simulated until the DSI gives access, N-14), for the month `current`: the utilities
 * order of the tomato plant as already entered, the recruitment firm's order and first invoice in CFA francs, a line on an
 * analytic code no lot has, and a line repeated.
 */
export function demoSageCsv(current: Month): string {
  const d = (day: number) => `${current}-${String(day).padStart(2, '0')}`;
  return [
    SAGE_HEADER,
    `SAI;${d(2)};CMD;BC-2026-0412;SAI-UT-01;900000;EUR;Energis;Steam, water and power package`,
    `SAI;${d(6)};CMD;BC-2026-0431;SAI-RH-01;52480000;XOF;Talents Sahel;Recruitment of the line operators`,
    `SAI;${d(14)};FAC;FA-88231;SAI-RH-01;19680000;XOF;Talents Sahel;First instalment`,
    `SAI;${d(15)};FAC;FA-88231;SAI-RH-01;19680000;XOF;Talents Sahel;First instalment`,
    `SAI;${d(16)};FAC;FA-90017;SAI-GEN-99;1250000;XOF;Bureau Ndiaye;Office supplies`,
  ].join('\n');
}
