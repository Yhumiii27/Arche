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
