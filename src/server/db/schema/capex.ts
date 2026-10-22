// CAPEX (docs/spec/02-objets.md §3) — delivery 1 holds the identity and status a CAPEX needs for subsidiary isolation; the
// cycle, budget, lots and dossiers come with deliveries 2 and 3 (new migrations).
import { text, unique, uuid } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { id, timestamps } from './_common';
import { sites, subsidiaries, users } from './organisation';

export type CapexStatus = 'draft' | 'active' | 'on_hold' | 'closed' | 'abandoned';
export type CapexPhase = 'cadrage' | 'avant_projet' | 'execution' | 'demarrage';
export type Typology = 'light' | 'strategic';
export type InvestmentType = 'new_plant' | 'new_line' | 'extension' | 'other';
export type CapexRole = 'lead' | 'controller' | 'co_dig' | 'epc2i_pmo' | 'internal_client' | 'member';

export const capex = arche.table('capex', {
  id: id(),
  /** "CPX-APM-2026-01" (N-9). */
  code: text('code').notNull().unique(),
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  siteId: uuid('site_id').references(() => sites.id),
  title: text('title').notNull(),
  description: text('description'),
  investmentType: text('investment_type').$type<InvestmentType>().notNull(),
  status: text('status').$type<CapexStatus>().notNull().default('draft'),
  phase: text('phase').$type<CapexPhase>().notNull().default('cadrage'),
  typology: text('typology').$type<Typology>(),
  sponsorUserId: uuid('sponsor_user_id').references(() => users.id),
  leadUserId: uuid('lead_user_id').references(() => users.id),
  ...timestamps,
});

/** Named CAPEX team (docs/spec/02 §3). */
export const capexMembers = arche.table('capex_members', {
  id: id(),
  capexId: uuid('capex_id').notNull().references(() => capex.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  capexRole: text('capex_role').$type<CapexRole>().notNull(),
  ...timestamps,
}, (t) => [unique('capex_members_uq').on(t.capexId, t.userId, t.capexRole)]);
