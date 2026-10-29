// A printable document (AR-042): the frozen dossier and the Copil report, built once from the data (src/features/print) and
// rendered either as the HTML print page or as a PDF by the server (./pdf.ts). Text is final (already translated or typed).

export type PrintBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'table'; head?: string[]; rows: string[][] }
  | { kind: 'list'; items: string[] };

export interface PrintDoc {
  title: string;
  meta: string[];
  blocks: PrintBlock[];
}
