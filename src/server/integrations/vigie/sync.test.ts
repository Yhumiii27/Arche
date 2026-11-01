// Vigie connector (AR-033) on a fresh PostgreSQL database with the demo data set: the simulated studies give the milestones
// they hold (source vigie, same statuses as declared), audited; the group HSE can no longer declare them; a late recommendation
// raises an alert; the shared view vigie.pub_etudes_securite is read in `views` mode; a milestone Vigie drops goes back to the HSE.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined), set: (n: string, v: string) => void jar.set(n, v) }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import pg from 'pg';
import { and, eq } from 'drizzle-orm';
import { milestonesFromStudies, recommendationsOf, studyOf } from '@/domain/process-safety';
import { auditEntries, capex, hsStatuses } from '@/server/db/schema';
import { capexDashboards } from '@/server/dal/governance';
import { testDatabase, type TestDatabase } from '@/test/db';
import { declareHsAction } from '@/features/safety/actions';
import { syncVigie, studiesOf } from './sync';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.clear());

const hsOf = async (code: string) => {
  const [c] = await t.db.select().from(capex).where(eq(capex.code, code));
  return t.db.select().from(hsStatuses).where(eq(hsStatuses.capexId, c.id));
};
const statusOf = async (code: string, hs: string) => (await hsOf(code)).find((r) => r.hsCode === hs);

describe('process safety studies (AR-033): rules', () => {
  const s = (o: Record<string, unknown>) => studyOf({ etude_ref: 'E', jalon: 'HS3', type: 'hazop', statut: 'validee', conclusion: 'favorable', conclue_le: '2026-06-20', ...o })!;
  it('a validated study passes its milestone unless unfavourable or with a blocking reservation; cancelled ones do not count', () => {
    expect(milestonesFromStudies([s({})]).get('HS3')).toEqual({ status: 'passed', passedOn: '2026-06-20', evidenceRef: 'E' });
    expect(milestonesFromStudies([s({ conclusion: 'defavorable' })]).get('HS3')?.status).toBe('in_progress');
    expect(milestonesFromStudies([s({ reserves_bloquantes: 2 })]).get('HS3')?.status).toBe('in_progress');
    expect(milestonesFromStudies([s({ statut: 'planifiee' })]).get('HS3')?.status).toBe('in_progress');
    expect(milestonesFromStudies([s({ statut: 'annulee' })]).has('HS3')).toBe(false);
    expect(studyOf({ etude_ref: 'X', jalon: 'HS9', type: 'hazop', statut: 'validee' })).toBeNull();
    expect(recommendationsOf([s({ recommandations: 5, recommandations_ouvertes: 2, recommandations_en_retard: 1 }), s({ statut: 'annulee', recommandations_en_retard: 4 })])).toEqual({ total: 5, open: 2, late: 1 });
  });
});

describe('Vigie connector (AR-033)', () => {
  it('off: nothing read, the declared milestones stay', async () => {
    expect(await syncVigie(t.db, { mode: 'off' })).toEqual({ source: 'off', rows: 0, milestones: 0, error: null });
    expect((await statusOf('CPX-SAI-2026-01', 'HS3'))?.source).toBe('declared');
  });

  it('simulation (demo data set): the milestones held in Vigie, same statuses, audited; the HSE no longer declares them', async () => {
    const before = (await hsOf('CPX-SAI-2026-01')).map((r) => [r.hsCode, r.status]).sort();
    const r = await syncVigie(t.db, { mode: 'simulation' });
    expect(r).toMatchObject({ source: 'simulation', rows: 10, error: null });
    expect(r.milestones).toBeGreaterThan(0);
    const after = await hsOf('CPX-SAI-2026-01');
    expect(after.map((x) => [x.hsCode, x.status]).sort()).toEqual(before);
    expect(after.every((x) => x.source === 'vigie')).toBe(true);
    expect(await statusOf('CPX-SAI-2026-01', 'HS3')).toMatchObject({ status: 'passed', passedOn: '2026-06-20', evidenceRef: 'NOT-CPX-SAI-2026-01-009' });
    const audits = await t.db.select().from(auditEntries).where(and(eq(auditEntries.objectRef, 'CPX-SAI-2026-01'), eq(auditEntries.actorName, 'Vigie (connector)')));
    expect(audits.map((a) => a.change)).toContain('HS 3 HazOp / FMEA: passed (from Vigie)');
    // A second run writes nothing.
    expect((await syncVigie(t.db, { mode: 'simulation' })).milestones).toBe(0);
    jar.set('arche-role', 'group_hse');
    const fd = new FormData();
    fd.set('status', 'passed');
    expect(await declareHsAction('CPX-SAI-2026-01', 'HS4', null, fd)).toEqual({ ok: false, error: 'This milestone comes from Vigie' });
  });

  it('a late recommendation raises an alert on the CAPEX', async () => {
    expect((await studiesOf(t.db, ['CPX-SAI-2026-01'])).length).toBe(4);
    const rows = await t.db.select({ id: capex.id, code: capex.code, status: capex.status, phase: capex.phase, typology: capex.typology, typologyProposed: capex.typologyProposed, openedAt: capex.openedAt }).from(capex).where(eq(capex.code, 'CPX-SAI-2026-01'));
    const [d] = await capexDashboards(t.db, rows, '2026-10-22');
    expect(d.alerts.find((a) => a.rule === 'safety_recommendations_late')).toMatchObject({ level: 'alert', detail: '1', screen: 'capex-safety' });
  });

  it('views: reads vigie.pub_etudes_securite once shared; a milestone Vigie drops goes back to the HSE', async () => {
    const admin = new pg.Client({ connectionString: t.url });
    await admin.connect();
    try {
      await admin.query(`create schema vigie;
        create view vigie.pub_etudes_securite as select * from (values
          ('ESP-1', 'CPX-SAI-2026-01', null, 'HS4', 'controle_chantier', 'validee', '2026-10-15'::date, '2026-10-16'::date, 'favorable', 'H. Marchal', 'NOT-CPX-SAI-2026-01-020', 2, 0, 0, 0, 'https://vigie.example/securite-procedes?etude=ESP-1', now())
        ) v(etude_ref, capex_code, projet_code, jalon, type, statut, seance_le, conclue_le, conclusion, animateur, rapport_ref, recommandations, recommandations_ouvertes, recommandations_en_retard, reserves_bloquantes, lien, maj_le);
        grant usage on schema vigie to ${t.role}; grant select on vigie.pub_etudes_securite to ${t.role};`);
    } finally {
      await admin.end();
    }
    const r = await syncVigie(t.db, { mode: 'views' });
    expect(r).toMatchObject({ source: 'views', rows: 1, error: null });
    expect(await statusOf('CPX-SAI-2026-01', 'HS4')).toMatchObject({ status: 'passed', passedOn: '2026-10-16', source: 'vigie' });
    // HS 2 and HS 3 are no longer in Vigie's view: declared again, with their last status.
    expect(await statusOf('CPX-SAI-2026-01', 'HS3')).toMatchObject({ status: 'passed', source: 'declared' });
  });
});
