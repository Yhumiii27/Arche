// The audit trail is append-only: the database refuses UPDATE, DELETE and TRUNCATE of audit_entries (trigger, migration 0001).
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase, type TestDatabase } from '@/test/db';
import { writeAudit } from './helpers';
import { auditEntries } from './schema';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase({ seed: 'production' });
});
afterAll(() => t.close());

describe('audit_entries', () => {
  it('appends; refuses update, delete and truncate', async () => {
    await writeAudit(t.db, { actorName: 'System', actorUserId: null, objectRef: 'Test', change: 'created', area: 'Tests', occurredAt: new Date('2026-10-22T08:00:00Z') });
    expect(await t.db.$count(auditEntries)).toBe(1);
    await expect(t.db.execute(sql`update arche.audit_entries set change = 'x'`)).rejects.toThrow();
    await expect(t.db.execute(sql`delete from arche.audit_entries`)).rejects.toThrow();
    await expect(t.db.execute(sql`truncate arche.audit_entries`)).rejects.toThrow();
    expect(await t.db.$count(auditEntries)).toBe(1);
  });
});

describe('pub_journal (contract D18)', () => {
  it('has the exact columns and types of the unified journal, and lists the audit rows', async () => {
    const cols = await t.handle.pool.query(
      `select column_name, data_type from information_schema.columns where table_schema = 'arche' and table_name = 'pub_journal' order by ordinal_position`,
    );
    expect(cols.rows.map((r) => `${r.column_name}:${r.data_type}`)).toEqual([
      'ref_source:text', 'nature:text', 'quand:timestamp with time zone', 'qui:text', 'qui_ref:text', 'qui_role:text', 'action:text',
      'objet:text', 'detail:text', 'projet:text', 'qui_matricule:text',
    ]);
    const rows = await t.handle.pool.query(`select nature, qui, detail from arche.pub_journal`);
    expect(rows.rows).toContainEqual({ nature: 'audit', qui: 'System', detail: 'created' });
  });
});

describe('pub_capex (contract v1, docs/CONTRATS.md §3)', () => {
  it('has the contract columns, in order', async () => {
    const cols = await t.handle.pool.query(`select column_name from information_schema.columns where table_schema = 'arche' and table_name = 'pub_capex' order by ordinal_position`);
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'code', 'filiale_code', 'filiale', 'zone', 'site', 'pays_iso2', 'intitule', 'type_investissement', 'statut', 'phase_code', 'typologie',
      'sponsor_nom', 'sponsor_email', 'chef_projet_nom', 'chef_projet_email', 'g1_le', 'g2_le', 'g3_le', 'debut_mes_le', 'maj_le', 'devise',
    ]);
  });
});
