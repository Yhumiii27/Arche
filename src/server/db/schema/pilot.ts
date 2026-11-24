// Pilot (docs/PLAN.md, C-10): the reference measured on the existing process before Arche — the "relevé de l'existant" —
// that the indicators of the DIG-PRODI objectives are compared with (−40 % validation delays, −50 % static documents, 100 %
// traceability). One row per indicator; entered by the group industrial director.
import { date, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { arche } from './_schema';
import { keur, timestamps } from './_common';
import { KPI_KEYS, filled, oneOf, rule, within, type OneOf } from './_checks';

export const kpiBaselines = arche.table('kpi_baselines', {
  /** Indicator key (src/domain/kpi.ts): `delay:G1` … `delay:G3`, `documents`, `traced`. */
  key: text('key').$type<OneOf<typeof KPI_KEYS>>().primaryKey(),
  value: keur('value').notNull(),
  /** Where the reference comes from (typed text: the survey, its period, the CAPEX it covers). */
  source: text('source'),
  measuredOn: date('measured_on', { mode: 'string' }),
  enteredByName: text('entered_by_name').notNull(),
  ...timestamps,
}, (t) => [
  oneOf('kpi_baselines_key_domain', t.key, KPI_KEYS),
  within('kpi_baselines_value_non_negative', t.value, 0, null),
  rule('kpi_baselines_share_at_most_100', sql`${t.key} <> 'traced' or ${t.value} <= 100`),
  filled('kpi_baselines_entered_by_filled', t.enteredByName),
]);
