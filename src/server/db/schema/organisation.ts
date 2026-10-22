// Group organisation (docs/spec/02-objets.md §1–2): zones, subsidiaries, their sites and reference revenue, users and their
// role assignments with a scope (docs/spec/01 §2).
import { boolean, date, doublePrecision, index, integer, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { ExpertSpeciality, RoleKey, ScopeKind } from '@/config/roles';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';

export const zones = arche.table('zones', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  /** Geographic frame of the zone on the CAPEX map, degrees (Keystone's ZONE_BOUNDS; Matrix M-12 to come). */
  boundsWest: doublePrecision('bounds_west'),
  boundsNorth: doublePrecision('bounds_north'),
  boundsEast: doublePrecision('bounds_east'),
  boundsSouth: doublePrecision('bounds_south'),
  ...timestamps,
});

export const subsidiaries = arche.table('subsidiaries', {
  /** Three letters, e.g. "APM" (CAPEX codes CPX-<code>-…). */
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  countryIso2: text('country_iso2').notNull(),
  zoneCode: text('zone_code').notNull().references(() => zones.code),
  /** ISO 4217 code of the subsidiary's books (amounts are in k€ in v1, N-2). */
  currency: text('currency').notNull().default('EUR'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const sites = arche.table('sites', {
  id: id(),
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  name: text('name').notNull(),
  city: text('city'),
  countryIso2: text('country_iso2').notNull(),
  /** WGS 84 decimal degrees, for the CAPEX map (Matrix M-11 to come: then a copy of matrix.pub_sites). */
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  ...timestamps,
}, (t) => [unique('sites_subsidiary_name_uq').on(t.subsidiaryCode, t.name)]);

/** Reference revenue of a subsidiary for one fiscal year (typology, C-5), entered by the group CFO. */
export const referenceRevenues = arche.table('reference_revenues', {
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  fiscalYear: integer('fiscal_year').notNull(),
  revenueKeur: keur('revenue_keur').notNull(),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  sourceNote: text('source_note'),
}, (t) => [unique('reference_revenues_uq').on(t.subsidiaryCode, t.fiscalYear)]);

export const users = arche.table('users', {
  id: id(),
  /** Microsoft Entra object id, set at the first sign-in (null for demo users and accounts never used). */
  entraObjectId: text('entra_object_id').unique(),
  /** Sign-in e-mail, lower case. */
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  jobTitle: text('job_title'),
  /** Subsidiary the person belongs to (null for group staff). */
  subsidiaryCode: text('subsidiary_code').references(() => subsidiaries.code),
  active: boolean('active').notNull().default(true),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
  ...timestamps,
});

export const roleAssignments = arche.table('role_assignments', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<RoleKey>().notNull(),
  scopeKind: text('scope_kind').$type<ScopeKind>().notNull(),
  /** Zone code, subsidiary code or CAPEX code; null for a group-wide assignment. */
  scopeRef: text('scope_ref'),
  /** Expert speciality (role `expert`). */
  speciality: text('speciality').$type<ExpertSpeciality>(),
  fromOn: date('from_on', { mode: 'string' }),
  toOn: date('to_on', { mode: 'string' }),
  createdByName: text('created_by_name').notNull(),
  ...timestamps,
}, (t) => [index('role_assignments_user_idx').on(t.userId)]);
