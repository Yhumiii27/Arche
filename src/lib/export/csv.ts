// CSV of an export table (AR-042), for Excel in the viewer's language: in French the separator is ";" and the decimal mark
// ",", in English "," and "."; UTF-8 with a byte order mark (Excel reads the accents), CRLF line ends, fields quoted when needed.
import type { ExportTable } from './table';

export function toCsv(t: ExportTable, lang: 'fr' | 'en'): string {
  const sep = lang === 'fr' ? ';' : ',';
  const cell = (v: unknown): string => {
    if (v == null) return '';
    if (typeof v === 'number') {
      const n = lang === 'fr' ? String(v).replace('.', ',') : String(v);
      return n.includes(sep) ? `"${n}"` : n;
    }
    // A text that a spreadsheet would read as a formula is written with a leading apostrophe (CSV injection).
    const s = /^[=+\-@\t\r]/.test(String(v)) ? `'${v}` : String(v);
    return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[t.head, ...t.rows].map((r) => r.map(cell).join(sep)).join('\r\n')}\r\n`;
}
