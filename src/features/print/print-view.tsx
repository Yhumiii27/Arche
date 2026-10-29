// The HTML print page of a printable document (AR-042): A4, black on white, no application shell; the same document is
// written as a PDF by the server (src/lib/export/pdf.ts). Text is final: already translated or typed.
import type { PrintDoc } from '@/lib/export/print-doc';
import s from './print.module.css';

export function PrintDocView({ doc, pdfHref, pdfLabel }: { doc: PrintDoc; pdfHref?: string; pdfLabel?: string }) {
  return (
    <main className={s.page}>
      {pdfHref && <a className={s.download} href={pdfHref} download>{pdfLabel}</a>}
      <h1>{doc.title}</h1>
      <div className={s.meta}>{doc.meta.map((m, i) => <div key={i}>{m}</div>)}</div>
      {doc.blocks.map((b, i) => {
        switch (b.kind) {
          case 'h2':
            return <h2 key={i}>{b.text}</h2>;
          case 'p':
            return <p key={i} className={s.text}>{b.text}</p>;
          case 'list':
            return <ul key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
          case 'table':
            return (
              <table key={i}>
                {b.head && <thead><tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>}
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((x, n) => <td key={n}>{x}</td>)}</tr>)}</tbody>
              </table>
            );
        }
      })}
    </main>
  );
}
