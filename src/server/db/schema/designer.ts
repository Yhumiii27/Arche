// No-code designer (delivery 7, lot 7d; AR-052, DECISIONS.md §5): the versions of the dossier and circuit templates. A target —
// a dossier kind or a gate — has at most one draft and one published version; the published one applies to the dossier versions
// and gate sessions started afterwards. Version 0 is the built-in definition (src/domain/dossiers.ts, circuits.ts), never stored.
import { index, integer, jsonb, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id } from './_common';

export const designs = arche.table('designs', {
  id: id(),
  kind: text('kind').$type<'dossier' | 'circuit'>().notNull(),
  /** Dossier kind (business_case, investment, transfer) or gate (G1, G2, K3, G3). */
  target: text('target').notNull(),
  version: integer('version').notNull(),
  state: text('state').$type<'draft' | 'published' | 'retired'>().notNull().default('draft'),
  /** { sections: SectionDef[] } or { steps: StepTemplate[] }. */
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  note: text('note'),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedByName: text('published_by_name'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => [unique('designs_version_uq').on(t.kind, t.target, t.version), index('designs_target_idx').on(t.kind, t.target)]);
