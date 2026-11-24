// Sage connector (delivery 7, lot 7e; AR-047, DECISIONS.md §5): each import of an extraction file of a subsidiary, the document
// lines kept (one per type, number and analytic code) and the lines rejected with their reason.
import { date, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { id, keur } from './_common';
import { CURRENCY_RE, SAGE_LINE_KINDS, SAGE_SOURCES, filled, oneOf, rule, shaped, within, type OneOf } from './_checks';
import { capexLots } from './capex';
import { subsidiaries } from './organisation';

export const sageImports = arche.table('sage_imports', {
  id: id(),
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  /** upload (a person), folder (the planned extraction of ARCHE_SAGE_DIR), demo (the demonstration extraction). */
  source: text('source').$type<OneOf<typeof SAGE_SOURCES>>().notNull(),
  fileName: text('file_name'),
  lines: integer('lines').notNull(),
  accepted: integer('accepted').notNull(),
  duplicates: integer('duplicates').notNull(),
  rejected: integer('rejected').notNull(),
  importedByName: text('imported_by_name').notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sage_imports_sub_idx').on(t.subsidiaryCode),
  oneOf('sage_imports_source_domain', t.source, SAGE_SOURCES),
  rule('sage_imports_counts', sql`${t.accepted} >= 0 and ${t.duplicates} >= 0 and ${t.rejected} >= 0 and ${t.lines} >= 0`),
  filled('sage_imports_by_filled', t.importedByName),
]);

export const sageLines = arche.table('sage_lines', {
  id: id(),
  importId: uuid('import_id').notNull().references(() => sageImports.id, { onDelete: 'cascade' }),
  subsidiaryCode: text('subsidiary_code').notNull(),
  /** type:number:analytic (src/domain/sage.ts `sageKey`). */
  key: text('key').notNull(),
  lotId: uuid('lot_id').notNull().references(() => capexLots.id, { onDelete: 'cascade' }),
  docDate: date('doc_date', { mode: 'string' }).notNull(),
  kind: text('kind').$type<OneOf<typeof SAGE_LINE_KINDS>>().notNull(),
  amount: keur('amount').notNull(),
  currency: text('currency').notNull(),
  supplier: text('supplier'),
  label: text('label'),
}, (t) => [
  unique('sage_lines_key_uq').on(t.subsidiaryCode, t.key),
  index('sage_lines_lot_idx').on(t.lotId),
  filled('sage_lines_key_filled', t.key),
  oneOf('sage_lines_kind_domain', t.kind, SAGE_LINE_KINDS),
  shaped('sage_lines_currency_shape', t.currency, CURRENCY_RE),
]);

export const sageRejects = arche.table('sage_rejects', {
  id: id(),
  importId: uuid('import_id').notNull().references(() => sageImports.id, { onDelete: 'cascade' }),
  lineNo: integer('line_no').notNull(),
  raw: text('raw').notNull(),
  reason: text('reason').notNull(),
}, (t) => [within('sage_rejects_line_positive', t.lineNo, 1, null), filled('sage_rejects_reason_filled', t.reason)]);
