// Group organisation (docs/spec/02-objets.md §1–2): zones, subsidiaries, their sites and reference revenue, users and their
// role assignments with a scope (docs/spec/01 §2).
import { boolean, check, date, doublePrecision, index, integer, numeric, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ExpertSpeciality, RoleKey, ScopeKind } from '@/config/roles';
import { arche } from './_schema';
import { id, keur, timestamps } from './_common';
import { COUNTRY_RE, CURRENCY_RE, EXPERT_SPECIALITIES, ROLE_KEYS, SCOPE_KINDS, filled, oneOf, rule, shaped, within } from './_checks';

export const zones = arche.table('zones', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  /** Geographic frame of the zone on the CAPEX map, degrees (Keystone's ZONE_BOUNDS; Matrix M-12 to come). */
  boundsWest: doublePrecision('bounds_west'),
  boundsNorth: doublePrecision('bounds_north'),
  boundsEast: doublePrecision('bounds_east'),
  boundsSouth: doublePrecision('bounds_south'),
  ...timestamps,
}, (t) => [
  shaped('zones_code_shape', t.code, '^[A-Z]{2,6}$'),
  filled('zones_name_filled', t.name),
  within('zones_bounds_west_range', t.boundsWest, -180, 180),
  within('zones_bounds_east_range', t.boundsEast, -180, 180),
  within('zones_bounds_north_range', t.boundsNorth, -90, 90),
  within('zones_bounds_south_range', t.boundsSouth, -90, 90),
]);

export const subsidiaries = arche.table('subsidiaries', {
  /** Three letters, e.g. "APM" (CAPEX codes CPX-<code>-…). */
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  countryIso2: text('country_iso2').notNull(),
  zoneCode: text('zone_code').notNull().references(() => zones.code),
  /** ISO 4217 code of the subsidiary's books: its amounts are typed in it and consolidated in k€ (AR-039). */
  currency: text('currency').notNull().default('EUR'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, (t) => [
  shaped('subsidiaries_code_shape', t.code, '^[A-Z]{3}$'),
  filled('subsidiaries_name_filled', t.name),
  shaped('subsidiaries_country_shape', t.countryIso2, COUNTRY_RE),
  shaped('subsidiaries_currency_shape', t.currency, CURRENCY_RE),
]);

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
}, (t) => [
  unique('sites_subsidiary_name_uq').on(t.subsidiaryCode, t.name),
  filled('sites_name_filled', t.name),
  shaped('sites_country_shape', t.countryIso2, COUNTRY_RE),
  within('sites_latitude_range', t.latitude, -90, 90),
  within('sites_longitude_range', t.longitude, -180, 180),
  rule('sites_coordinates_together', sql`(${t.latitude} is null) = (${t.longitude} is null)`),
]);

/** Reference exchange rates of the group (AR-039), entered by the group CFO: units of a currency for one euro, for a month or a fiscal year. */
export const exchangeRates = arche.table('exchange_rates', {
  currency: text('currency').notNull(),
  /** "2026-10" (a month) or "2026" (the fiscal year's reference rate). */
  period: text('period').notNull(),
  unitsPerEur: numeric('units_per_eur', { mode: 'number' }).notNull(),
  note: text('note'),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: 'exchange_rates_pk', columns: [t.currency, t.period] }),
  shaped('exchange_rates_currency_shape', t.currency, CURRENCY_RE),
  shaped('exchange_rates_period_shape', t.period, '^[0-9]{4}(-(0[1-9]|1[0-2]))?$'),
  rule('exchange_rates_units_positive', sql`${t.unitsPerEur} > 0`),
  filled('exchange_rates_entered_by_filled', t.enteredByName),
]);

/** Reference revenue of a subsidiary for one fiscal year (typology, C-5), entered by the group CFO. */
export const referenceRevenues = arche.table('reference_revenues', {
  subsidiaryCode: text('subsidiary_code').notNull().references(() => subsidiaries.code),
  fiscalYear: integer('fiscal_year').notNull(),
  revenueKeur: keur('revenue_keur').notNull(),
  enteredByName: text('entered_by_name').notNull(),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  sourceNote: text('source_note'),
}, (t) => [
  primaryKey({ name: 'reference_revenues_pk', columns: [t.subsidiaryCode, t.fiscalYear] }),
  within('reference_revenues_year_range', t.fiscalYear, 2000, 2100),
  rule('reference_revenues_revenue_positive', sql`${t.revenueKeur} > 0`),
  filled('reference_revenues_entered_by_filled', t.enteredByName),
]);

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
  /**
   * Roles granted by the central sign-in (Clavis, ARCHE_ROLES_FROM_TOKEN=on) at the last sign-in; null when Arche alone keeps
   * the roles (Entra ID). With them, group roles apply directly and scoped assignments only for these roles.
   */
  grantedRoles: text('granted_roles').array().$type<RoleKey[]>(),
  ...timestamps,
}, (t) => [
  rule('users_email_shape', sql`${t.email} = lower(${t.email}) and ${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`),
  filled('users_display_name_filled', t.displayName),
  check('users_granted_roles_known', sql`${t.grantedRoles} is null or ${t.grantedRoles} <@ array['ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'engineering_pmo', 'expert', 'admin']::text[]`),
]);

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
}, (t) => [
  index('role_assignments_user_idx').on(t.userId),
  oneOf('role_assignments_role_domain', t.role, ROLE_KEYS),
  oneOf('role_assignments_scope_kind_domain', t.scopeKind, SCOPE_KINDS),
  oneOf('role_assignments_speciality_domain', t.speciality, EXPERT_SPECIALITIES),
  rule('role_assignments_scope_ref_iff_scoped', sql`(${t.scopeKind} = 'group') = (${t.scopeRef} is null)`),
  rule('role_assignments_dates_order', sql`${t.toOn} is null or ${t.fromOn} is null or ${t.toOn} >= ${t.fromOn}`),
  filled('role_assignments_created_by_filled', t.createdByName),
]);
