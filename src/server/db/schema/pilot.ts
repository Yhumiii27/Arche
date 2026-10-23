// Pilot (docs/PLAN.md, C-10): the reference measured on the existing process before Arche — the "relevé de l'existant" —
// that the indicators of the DIG-PRODI objectives are compared with (−40 % validation delays, −50 % static documents, 100 %
// traceability). One row per indicator; entered by the group industrial director.
import { date, text } from 'drizzle-orm/pg-core';
import { arche } from './_schema';
import { keur, timestamps } from './_common';

export const kpiBaselines = arche.table('kpi_baselines', {
  /** Indicator key (src/domain/kpi.ts): `delay:G1` … `delay:G3`, `documents`, `traced`. */
  key: text('key').primaryKey(),
  value: keur('value').notNull(),
  /** Where the reference comes from (typed text: the survey, its period, the CAPEX it covers). */
  source: text('source'),
  measuredOn: date('measured_on', { mode: 'string' }),
  enteredByName: text('entered_by_name').notNull(),
  ...timestamps,
});
