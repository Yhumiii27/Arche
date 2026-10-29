// Exports (AR-042): the CSV for Excel in the viewer's language, the Excel workbook (a valid ZIP holding the sheet) and the PDF
// (valid cross-reference table, pages, text in WinAnsi).
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { textWidth, toPdf, winAnsi, wrap } from './pdf';
import { fileStem } from './table';
import { columnName, sheetName, toXlsx } from './xlsx';

const table = { title: 'Registre des CAPEX', head: ['Code', 'Intitulé', 'Budget (k€)'], rows: [['CPX-APM-2026-01', 'Ligne n° 3; « été »', 12900.5], ['CPX-SAI-2026-01', '=HYPERLINK("x")', -3], ['X', null, null]] };

describe('CSV', () => {
  it('French: ";" and a decimal comma; English: "," and a dot; formulas are neutralised', () => {
    expect(toCsv(table, 'fr')).toBe('﻿Code;Intitulé;Budget (k€)\r\nCPX-APM-2026-01;"Ligne n° 3; « été »";12900,5\r\nCPX-SAI-2026-01;"\'=HYPERLINK(""x"")";-3\r\nX;;\r\n');
    expect(toCsv(table, 'en').split('\r\n')[1]).toBe('CPX-APM-2026-01,Ligne n° 3; « été »,12900.5');
  });
});

describe('Excel workbook', () => {
  it('is a ZIP with the workbook, the sheet and its cells (text as inline strings, numbers as numbers)', () => {
    const z = Buffer.from(toXlsx(table, new Date('2026-10-29T10:00:00Z')));
    expect(z.subarray(0, 4).toString('hex')).toBe('504b0304');
    const s = z.toString('utf8');
    for (const name of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) expect(s).toContain(name);
    expect(s).toContain('<c r="C2"><v>12900.5</v></c>');
    expect(s).toContain('<c r="B3" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;x&quot;)</t></is></c>');
    expect(columnName(0)).toBe('A');
    expect(columnName(27)).toBe('AB');
    expect(sheetName('Portefeuille: groupe / zone [AFN]')).toBe('Portefeuille  groupe   zone  AF');
    expect(fileStem('Registre des CAPEX — Éclairage', '2026-10-29')).toBe('arche-registre-des-capex-eclairage-2026-10-29');
  });
});

describe('PDF', () => {
  it('has a valid cross-reference table and as many pages as the content needs', () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`G${i}`, 'Go avec conditions', '22/10/2026']);
    const pdf = Buffer.from(toPdf({ title: 'Rapport Copil', meta: ['CPX-APM-2026-01'], blocks: [{ kind: 'h2', text: 'Synthèse' }, { kind: 'table', head: ['Jalon', 'Décision', 'Date'], rows }] }, new Date('2026-10-29T10:00:00Z')));
    const s = pdf.toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    const start = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(start, start + 4)).toBe('xref');
    const offsets = [...s.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(s.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    const pages = Number(/\/Count (\d+)/.exec(s)![1]);
    expect(pages).toBeGreaterThan(2);
    // The first page's content stream holds the title.
    const m = /stream\n([\s\S]*?)\nendstream/.exec(s)!;
    expect(inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')).toContain('(Rapport Copil) Tj');
  });

  it('writes French and the usual signs, and wraps text to the width', () => {
    expect(winAnsi('Été — 12 900 k€ → ≥ 😀')).toBe('Été — 12 900 k€ -> >= ?');
    expect(textWidth('AV', 10)).toBeCloseTo(13.34, 2);
    const lines = wrap('un deux trois quatre cinq six sept huit neuf dix', 60, 10);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(textWidth(l, 10)).toBeLessThanOrEqual(60);
  });
});
