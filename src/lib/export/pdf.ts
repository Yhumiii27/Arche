// PDF of a printable document (AR-042), written by the server without a browser nor a dependency: A4, the standard Helvetica
// fonts (WinAnsi encoding: French and the usual signs; a character outside it is replaced), titles, paragraphs, lists and
// tables with wrapped cells and repeated headers, page numbers. Deflated content streams (node:zlib).
import { deflateSync } from 'node:zlib';
import type { PrintBlock, PrintDoc } from './print-doc';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 45;
const BODY_W = PAGE_W - 2 * MARGIN;

// Helvetica advance widths (1/1000 em) of the printable ASCII characters 32–126 (Adobe's standard metrics).
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667,
  611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};
const SUBSTITUTE: Record<string, string> = { ' ': ' ', ' ': ' ', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '−': '-', '✓': 'v', '✕': 'x', '≈': '~' };

/** The text in the fonts' encoding: characters outside WinAnsi are substituted, or replaced by "?". */
export function winAnsi(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const c = SUBSTITUTE[ch] ?? ch;
    for (const x of c) {
      const code = x.codePointAt(0)!;
      if (x === '\n' || x === '\t') out += ' ';
      else if (code >= 32 && code <= 126) out += x;
      else if (code >= 0xa0 && code <= 0xff) out += x;
      else if (CP1252[x] != null) out += x;
      else out += '?';
    }
  }
  return out;
}

function charWidth(ch: string): number {
  const code = ch.codePointAt(0)!;
  if (code >= 32 && code <= 126) return HELVETICA[code - 32];
  if (code === 0xa0) return 278;
  const base = ch.normalize('NFD')[0];
  const b = base.codePointAt(0)!;
  if (b >= 32 && b <= 126) return HELVETICA[b - 32];
  return 556;
}

/** Width of a text in points at `size` (bold is about 6 % wider than regular). */
export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return (w * size * (bold ? 1.06 : 1)) / 1000;
}

/** Lines of `text` that fit in `width` (words wider than a line are cut). */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (textWidth(tryLine, size, bold) <= width) {
        line = tryLine;
        continue;
      }
      if (line) out.push(line);
      let w = word;
      while (textWidth(w, size, bold) > width && w.length > 1) {
        let n = w.length - 1;
        while (n > 1 && textWidth(w.slice(0, n), size, bold) > width) n--;
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

const pdfString = (s: string) => {
  let out = '(';
  for (const ch of winAnsi(s)) {
    const code = CP1252[ch] ?? ch.codePointAt(0)!;
    if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
    else if (code > 126) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += ch;
  }
  return `${out})`;
};

class Layout {
  pages: string[][] = [[]];
  y = PAGE_H - MARGIN;

  private get ops() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push([]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + 20) this.newPage();
  }

  text(s: string, x: number, size: number, bold = false, grey = false) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${grey ? '0.33 g' : '0 g'} ${x.toFixed(2)} ${this.y.toFixed(2)} Td ${pdfString(s)} Tj ET`);
  }

  rule(x1: number, y: number, x2: number, grey = 0.8) {
    this.ops.push(`${grey} G 0.5 w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
  }

  rect(x: number, y: number, w: number, h: number) {
    this.ops.push(`0.85 G 0.5 w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }

  paragraph(s: string, size = 10, bold = false, grey = false, indent = 0) {
    const lead = size * 1.35;
    for (const line of wrap(s, BODY_W - indent, size, bold)) {
      this.ensure(lead);
      this.y -= lead;
      this.text(line, MARGIN + indent, size, bold, grey);
    }
  }

  table(head: string[] | undefined, rows: string[][]) {
    const size = 9;
    const lead = size * 1.3;
    const pad = 3;
    const cols = Math.max(head?.length ?? 0, ...rows.map((r) => r.length));
    if (!cols) return;
    // Column widths in proportion to their longest text, each at least 12 % of an even share.
    const longest = Array.from({ length: cols }, (_, c) => Math.max(4, ...[head ?? [], ...rows].map((r) => Math.min(60, textWidth(r[c] ?? '', size)))));
    const total = longest.reduce((a, b) => a + b, 0);
    const widths = longest.map((l) => Math.max(BODY_W / cols * 0.12, (BODY_W * l) / total));
    const scale = BODY_W / widths.reduce((a, b) => a + b, 0);
    const w = widths.map((x) => x * scale);
    const drawRow = (cells: string[], bold: boolean) => {
      const lines = w.map((cw, c) => wrap(cells[c] ?? '', cw - 2 * pad, size, bold));
      const h = Math.max(...lines.map((l) => l.length)) * lead + 2 * pad;
      return { lines, h, bold };
    };
    const header = head ? drawRow(head, true) : null;
    const put = (r: ReturnType<typeof drawRow>) => {
      const top = this.y;
      let x = MARGIN;
      for (let c = 0; c < cols; c++) {
        this.rect(x, top - r.h, w[c], r.h);
        r.lines[c].forEach((line, i) => {
          this.y = top - pad - (i + 1) * lead + 2.5;
          this.text(line, x + pad, size, r.bold);
        });
        x += w[c];
      }
      this.y = top - r.h;
    };
    this.ensure((header?.h ?? 0) + lead * 2);
    this.y -= 4;
    if (header) put(header);
    for (const cells of rows) {
      const r = drawRow(cells, false);
      if (this.y - r.h < MARGIN + 20) {
        this.newPage();
        if (header) put(header);
      }
      put(r);
    }
    this.y -= 4;
  }

  block(b: PrintBlock) {
    switch (b.kind) {
      case 'h2':
        this.ensure(40);
        this.y -= 10;
        this.paragraph(b.text, 12, true);
        this.rule(MARGIN, this.y - 3, PAGE_W - MARGIN);
        this.y -= 4;
        return;
      case 'p':
        this.paragraph(b.text);
        this.y -= 2;
        return;
      case 'list':
        for (const item of b.items) {
          const lines = wrap(item, BODY_W - 12, 10);
          lines.forEach((line, i) => {
            this.ensure(13.5);
            this.y -= 13.5;
            if (i === 0) this.text('•', MARGIN + 2, 10);
            this.text(line, MARGIN + 12, 10);
          });
        }
        return;
      case 'table':
        this.table(b.head, b.rows);
        return;
    }
  }
}

export function toPdf(doc: PrintDoc, at: Date = new Date()): Uint8Array {
  const l = new Layout();
  l.paragraph(doc.title, 16, true);
  l.y -= 2;
  for (const m of doc.meta) l.paragraph(m, 9, false, true);
  l.y -= 4;
  for (const b of doc.blocks) l.block(b);
  const total = l.pages.length;
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) ;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // pages, filled below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const streams: Buffer[] = [];
  const kids: number[] = [];
  l.pages.forEach((ops, i) => {
    const footer = `BT /F1 8 Tf 0.45 g ${MARGIN} ${MARGIN - 18} Td ${pdfString(`${doc.title} — ${i + 1} / ${total}`)} Tj ET`;
    const content = deflateSync(Buffer.from([...ops, footer].join('\n'), 'latin1'));
    streams.push(content);
    const contentNo = objects.length + 2;
    kids.push(objects.length + 1);
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNo} 0 R >>`);
    add(`STREAM:${streams.length - 1}`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${total} >>`;
  const info = objects.length + 1;
  const d = at.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  add(`<< /Title ${pdfString(doc.title)} /Producer (Arche) /CreationDate (D:${d}Z) >>`);
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let size = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(size);
    let chunk: Buffer;
    if (body.startsWith('STREAM:')) {
      const data = streams[Number(body.slice(7))];
      chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    } else chunk = Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1');
    parts.push(chunk);
    size += chunk.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${size}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return new Uint8Array(Buffer.concat(parts));
}
