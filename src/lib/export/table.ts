// The table of an export (AR-042): a title, column headers and rows of cells — text as typed, numbers as numbers (written
// as numbers in Excel), dates as ISO days. The same table is written as CSV (./csv.ts) or as an Excel workbook (./xlsx.ts).

export type Cell = string | number | null | undefined;

export interface ExportTable {
  /** Sheet name and file name stem ("Registre des CAPEX"). */
  title: string;
  head: string[];
  rows: Cell[][];
}

/** "arche-registre-des-capex-2026-10-29" (ASCII, lower case). */
export function fileStem(title: string, day: string): string {
  const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `arche-${slug || 'export'}-${day}`;
}
