// Formats in the database (Norma §4): every value list of a CHECK (src/server/db/schema/_checks.ts) is the domain's own list,
// and a migrated database holds exactly these CHECKs. A state added in the code without a migration, or a migration that
// drifts from the code, breaks this test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase, type TestDatabase } from '@/test/db';
import { EXPERT_SPECIALITIES, ROLE_KEYS, SCOPE_KINDS } from '@/config/roles';
import { ACTION_SOURCE_LABEL, ACTION_SOURCES, ACTION_STATUS_LABEL } from '@/domain/actions';
import { WEBHOOK_EVENTS } from '@/domain/api-events';
import { POST_AUDIT_CONCLUSIONS, POST_AUDIT_MONTHS } from '@/domain/benefits';
import { ESTIMATE_CLASSES } from '@/domain/budget';
import { INVESTMENT_TYPE_LABEL, PHASE_LABEL, STATUS_LABEL, TYPOLOGY_LABEL } from '@/domain/capex-labels';
import { DECISION_BODIES, INVESTMENT_TYPES, LOT_KINDS, RISK_CATEGORIES, RISK_STATUSES, TEAM_ROLES } from '@/domain/capex';
import { OUTCOME_LABEL, OUTCOMES_OF, STEP_KIND_LABEL } from '@/domain/circuits';
import { REX_CATEGORIES } from '@/domain/closure';
import { CHANGE_KINDS, LEVELS } from '@/domain/delegation';
import { DESIGN_STATE_LABEL } from '@/domain/designer';
import { DOSSIER_KINDS, VERSION_STATE_LABEL } from '@/domain/dossiers';
import { ENVELOPE_CATEGORIES } from '@/domain/envelopes';
import { REVIEW_KINDS } from '@/domain/governance';
import { IDEA_STATUSES } from '@/domain/ideas';
import { KPI_KEYS } from '@/domain/kpi';
import { DECISION_LABEL, GATES, PHASES } from '@/domain/lifecycle';
import { NEED_STATUS_LABEL } from '@/domain/needs';
import { PACK_ITEM_STATUSES } from '@/domain/pack';
import { PERMIT_KINDS, PERMIT_STATUSES } from '@/domain/permits';
import { HS_LABEL, HS_STATUSES } from '@/domain/safety';
import { SCENARIO_KINDS } from '@/domain/scenarios';
import { MANUAL_CRITERIA, SCORING_CRITERIA } from '@/domain/scoring';
import { REQUEST_STATUS_LABEL } from '@/domain/signature';
import * as C from './schema/_checks';
import './schema';

const keys = (r: Record<string, unknown>) => Object.keys(r);

/** [list of the CHECK, the domain's list] — same values, same order. */
const SAME: [string, readonly unknown[], readonly unknown[]][] = [
  ['ROLE_KEYS', C.ROLE_KEYS, ROLE_KEYS],
  ['SCOPE_KINDS', C.SCOPE_KINDS, SCOPE_KINDS],
  ['EXPERT_SPECIALITIES', C.EXPERT_SPECIALITIES, EXPERT_SPECIALITIES],
  ['CAPEX_STATUSES', C.CAPEX_STATUSES, keys(STATUS_LABEL)],
  ['PHASES', C.PHASES, PHASES],
  ['PHASES (labels)', C.PHASES, keys(PHASE_LABEL)],
  ['TYPOLOGIES', C.TYPOLOGIES, keys(TYPOLOGY_LABEL)],
  ['INVESTMENT_TYPES', C.INVESTMENT_TYPES, INVESTMENT_TYPES],
  ['INVESTMENT_TYPES (labels)', C.INVESTMENT_TYPES, keys(INVESTMENT_TYPE_LABEL)],
  ['TEAM_ROLES', C.TEAM_ROLES, TEAM_ROLES],
  ['GATES', C.GATES, GATES],
  ['GATE_DECISIONS', C.GATE_DECISIONS, keys(DECISION_LABEL)],
  ['ESTIMATE_CLASSES', C.ESTIMATE_CLASSES, ESTIMATE_CLASSES],
  ['LOT_KINDS', C.LOT_KINDS, LOT_KINDS],
  ['RISK_CATEGORIES', C.RISK_CATEGORIES, RISK_CATEGORIES],
  ['RISK_STATUSES', C.RISK_STATUSES, RISK_STATUSES],
  ['DECISION_BODIES', C.DECISION_BODIES, DECISION_BODIES],
  ['DOSSIER_KINDS', C.DOSSIER_KINDS, DOSSIER_KINDS],
  ['DOSSIER_STATES', C.DOSSIER_STATES, keys(VERSION_STATE_LABEL)],
  ['STEP_KINDS', C.STEP_KINDS, keys(STEP_KIND_LABEL)],
  ['STEP_KINDS (outcomes)', [...C.STEP_KINDS].sort(), keys(OUTCOMES_OF).sort()],
  ['STEP_ACTORS', C.STEP_ACTORS, [...ROLE_KEYS, 'internal_client']],
  ['STEP_OUTCOMES', C.STEP_OUTCOMES, keys(OUTCOME_LABEL)],
  ['CHANGE_KINDS', C.CHANGE_KINDS, CHANGE_KINDS],
  ['DECIDER_LEVELS', C.DECIDER_LEVELS, LEVELS],
  ['SIGNATURE_REQUEST_STATUSES', C.SIGNATURE_REQUEST_STATUSES, keys(REQUEST_STATUS_LABEL)],
  ['PERMIT_KINDS', C.PERMIT_KINDS, PERMIT_KINDS],
  ['PERMIT_STATUSES', C.PERMIT_STATUSES, PERMIT_STATUSES],
  ['PACK_ITEM_STATUSES', C.PACK_ITEM_STATUSES, PACK_ITEM_STATUSES],
  ['HS_CODES', C.HS_CODES, keys(HS_LABEL)],
  ['HS_STATUSES', C.HS_STATUSES, HS_STATUSES],
  ['REVIEW_KINDS', C.REVIEW_KINDS, REVIEW_KINDS],
  ['ENVELOPE_CATEGORIES', C.ENVELOPE_CATEGORIES, ENVELOPE_CATEGORIES],
  ['ACTION_SOURCES', C.ACTION_SOURCES, ACTION_SOURCES],
  ['ACTION_SOURCES (labels)', C.ACTION_SOURCES, keys(ACTION_SOURCE_LABEL)],
  ['ACTION_STATUSES', C.ACTION_STATUSES, keys(ACTION_STATUS_LABEL)],
  ['WEBHOOK_EVENTS', C.WEBHOOK_EVENTS, WEBHOOK_EVENTS],
  ['DESIGN_STATES', C.DESIGN_STATES, keys(DESIGN_STATE_LABEL)],
  ['IDEA_STATUSES', C.IDEA_STATUSES, IDEA_STATUSES],
  ['POST_AUDIT_MONTHS', C.POST_AUDIT_MONTHS, POST_AUDIT_MONTHS],
  ['POST_AUDIT_CONCLUSIONS', C.POST_AUDIT_CONCLUSIONS, POST_AUDIT_CONCLUSIONS],
  ['NEED_STATUSES', C.NEED_STATUSES, keys(NEED_STATUS_LABEL)],
  ['KPI_KEYS', C.KPI_KEYS, KPI_KEYS],
  ['SCORING_CODES', C.SCORING_CODES, SCORING_CRITERIA.map((c) => c.code)],
  ['MANUAL_SCORING_CODES', C.MANUAL_SCORING_CODES, MANUAL_CRITERIA.map((c) => c.code)],
  ['SCENARIO_KINDS', C.SCENARIO_KINDS, SCENARIO_KINDS],
  ['REX_CATEGORIES', C.REX_CATEGORIES, REX_CATEGORIES],
];

describe('value lists of the CHECKs', () => {
  it.each(SAME)('%s is the list of the domain', (_name, check, domain) => {
    expect([...check]).toEqual([...domain]);
  });
});

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase({ seed: null });
});
afterAll(() => t.close());

/** The values of `col = ANY (ARRAY['a'::text, …])` or `col = ANY (ARRAY[6, 12])` as PostgreSQL prints a CHECK back. */
function valuesOf(def: string): (string | number)[] {
  const arr = /ARRAY\[(.*)\]/.exec(def)?.[1] ?? '';
  const texts = [...arr.matchAll(/'((?:[^']|'')*)'::text/g)].map((m) => m[1].replace(/''/g, "'"));
  return texts.length ? texts : arr.split(',').map((x) => Number(x.trim()));
}

describe('CHECKs of a migrated database', () => {
  it('holds every domain CHECK of the schema with its exact values, and none other', async () => {
    const { rows } = await t.handle.pool.query<{ name: string; def: string }>(
      `select conname as name, pg_get_constraintdef(oid) as def from pg_constraint where contype = 'c' and connamespace = 'arche'::regnamespace`,
    );
    const db = new Map(rows.map((r) => [r.name, r.def]));
    for (const [name, values] of C.DOMAIN_CHECKS) {
      expect(db.has(name), `${name} missing: run npm run db:generate`).toBe(true);
      expect(valuesOf(db.get(name)!), name).toEqual([...values]);
    }
    const strays = rows.filter((r) => r.name.endsWith('_domain') && !C.DOMAIN_CHECKS.has(r.name)).map((r) => r.name);
    expect(strays).toEqual([]);
    expect(C.DOMAIN_CHECKS.size).toBeGreaterThan(70);
  });

  it('refuses a state the code does not know, a blank name and a malformed code', async () => {
    const q = (s: string) => t.handle.pool.query(s);
    await q(`insert into arche.zones (code, name) values ('TST', 'Test zone')`);
    await expect(q(`insert into arche.zones (code, name) values ('TSB', '  ')`)).rejects.toThrow(/zones_name_filled/);
    await expect(q(`insert into arche.subsidiaries (code, name, country_iso2, zone_code) values ('tst1', 'Test', 'FR', 'TST')`)).rejects.toThrow(/subsidiaries_code_shape/);
    await q(`insert into arche.subsidiaries (code, name, country_iso2, zone_code) values ('TST', 'Test', 'FR', 'TST')`);
    const ins = (code: string, status: string) =>
      q(`insert into arche.capex (code, subsidiary_code, title, investment_type, status) values ('${code}', 'TST', 'A CAPEX', 'new_line', '${status}')`);
    await expect(ins('CPX-TST-2026-01', 'archived')).rejects.toThrow(/capex_status_domain/);
    await expect(ins('CPX-ABC-2026-01', 'draft')).rejects.toThrow(/capex_code_of_subsidiary/);
    await expect(ins('CPX-TST-26-1', 'draft')).rejects.toThrow(/capex_code_shape/);
    await ins('CPX-TST-2026-01', 'draft');
  });
});
