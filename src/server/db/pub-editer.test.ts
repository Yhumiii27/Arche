// M-19 (Matrix's request of 5 Nov 2026, owner's choices of 7 Nov 2026; docs/PROPOSITION-M19.md): arche.pub_editer, the
// function Matrix's viewer calls to correct Arche's data through Arche's rules and journal. Called here as Matrix would.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, desc, eq, sql } from 'drizzle-orm';
import { activityEvents, assetClasses, auditEntries, capex, emailOutbox, productionLines, rampupDays, risks } from '@/server/db/schema';
import { modelValues } from '@/server/dal/cycle';
import { recomputeStaleLines } from '@/server/dal/rampup';
import { testDatabase, type TestDatabase } from '@/test/db';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());

const ADMIN = 'Arche administrator';
const edit = async (table: string, action: string, key: unknown, values: unknown, by = ADMIN, reason = 'Erreur de saisie signalée par la filiale') => {
  const r = await t.db.execute(sql`select arche.pub_editer(${table}, ${action}, ${key == null ? null : JSON.stringify(key)}::jsonb, ${values == null ? null : JSON.stringify(values)}::jsonb, ${by}, ${reason}) as row`);
  return (r.rows[0] as { row: Record<string, unknown> }).row;
};
const refused = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return String((e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message);
  }
  throw new Error('expected a refusal');
};
const capexOf = async (code: string) => (await t.db.select().from(capex).where(eq(capex.code, code)))[0];

describe('arche.pub_editer (M-19)', () => {
  it('is a SECURITY DEFINER function with a fixed search_path, not executable by PUBLIC', async () => {
    const r = await t.db.execute(sql`select p.prosecdef, p.proconfig, has_function_privilege('public', p.oid, 'execute') as pub
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'arche' and p.proname = 'pub_editer'`);
    expect(r.rows).toEqual([{ prosecdef: true, proconfig: ['search_path=arche, pg_temp'], pub: false }]);
  });

  it('refuses the closed tables, the columns not open, an unknown person and a missing reason', async () => {
    expect(await refused(edit('signatures', 'corriger', { id: '00000000-0000-0000-0000-000000000000' }, { comment: 'x' }))).toMatch(/n'est pas modifiable depuis Matrix/);
    expect(await refused(edit('gates', 'corriger', { id: '00000000-0000-0000-0000-000000000000' }, { status: 'decided' }))).toMatch(/n'est pas modifiable/);
    const c = await capexOf('CPX-APM-2026-01');
    expect(await refused(edit('capex', 'corriger', { id: c.id }, { status: 'closed' }))).toMatch(/colonne « status »/);
    expect(await refused(edit('capex', 'retirer', { id: c.id }, null))).toMatch(/Action « retirer » refusée/);
    expect(await refused(edit('capex', 'corriger', { id: c.id }, { title: 'X' }, 'Someone else'))).toMatch(/n'est pas un administrateur groupe actif/);
    expect(await refused(edit('capex', 'corriger', { id: c.id }, { title: 'X' }, ADMIN, ' '))).toMatch(/motif est obligatoire/);
    expect(await refused(edit('capex', 'corriger', { id: 'not-a-uuid' }, { title: 'X' }))).toMatch(/Clé invalide/);
    expect((await capexOf('CPX-APM-2026-01')).title).toBe(c.title);
  });

  it('corrects a CAPEX: journal (via Matrix, before / after, reason), activity feed, e-mail to the lead, row version', async () => {
    const c = await capexOf('CPX-APM-2026-01');
    const row = await edit('capex', 'corriger', { id: c.id }, { title: 'Extrusion line 2 (corrected)' });
    expect(row).toMatchObject({ code: 'CPX-APM-2026-01', title: 'Extrusion line 2 (corrected)', row_version: c.rowVersion + 1 });
    const [a] = await t.db.select().from(auditEntries).where(and(eq(auditEntries.capexId, c.id), eq(auditEntries.area, 'Matrix'))).orderBy(desc(auditEntries.occurredAt));
    expect(a).toMatchObject({
      actorName: `${ADMIN} (via Matrix)`, actorRole: 'admin', objectRef: 'CPX-APM-2026-01', change: 'capex via Matrix: corrected (title)', entityType: 'capex',
      before: { title: c.title }, after: { title: 'Extrusion line 2 (corrected)' }, reason: 'Erreur de saisie signalée par la filiale',
    });
    expect((await t.db.select().from(activityEvents).where(and(eq(activityEvents.capexId, c.id), eq(activityEvents.kind, 'matrix_edit')))).length).toBe(1);
    const mails = await t.db.select().from(emailOutbox).where(eq(emailOutbox.kind, 'matrix_edit'));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ userId: c.leadUserId, capexId: c.id, subject: '[Arche] CPX-APM-2026-01 — correction depuis Matrix', status: 'pending' });
    // Nothing changed: no journal line.
    const n = (await t.db.select().from(auditEntries).where(eq(auditEntries.area, 'Matrix'))).length;
    await edit('capex', 'corriger', { id: c.id }, { title: 'Extrusion line 2 (corrected)' });
    expect((await t.db.select().from(auditEntries).where(eq(auditEntries.area, 'Matrix'))).length).toBe(n);
  });

  it('applies the rules of the table: risk scale, closed CAPEX', async () => {
    const c = await capexOf('CPX-SAI-2026-01');
    const [risk] = await t.db.select().from(risks).where(eq(risks.capexId, c.id)).limit(1);
    expect(await refused(edit('risks', 'corriger', { id: risk.id }, { probability: 5 }))).toMatch(/de 1 à 4/);
    expect(await edit('risks', 'corriger', { id: risk.id }, { probability: 4, impact: 4 })).toMatchObject({ probability: 4, impact: 4 });
    await t.db.update(capex).set({ status: 'closed' }).where(eq(capex.id, c.id));
    expect(await refused(edit('risks', 'corriger', { id: risk.id }, { title: 'Late' }))).toMatch(/clos ou abandonné/);
    await t.db.update(capex).set({ status: c.status }).where(eq(capex.id, c.id));
  });

  it('a reference list: add, correct, withdraw (archived), never twice; a rate: add and check', async () => {
    expect(await edit('asset_classes', 'ajouter', null, { code: 'TEST', label: 'Test class', life_years: 7, lot_kinds: ['equipment'] })).toMatchObject({ code: 'TEST', active: true, life_years: 7 });
    expect(await refused(edit('asset_classes', 'ajouter', null, { code: 'TEST', label: 'Again', life_years: 7 }))).toMatch(/existe déjà/);
    expect(await refused(edit('asset_classes', 'corriger', { code: 'TEST' }, { life_years: 90 }))).toMatch(/de 1 à 60 ans/);
    expect(await edit('asset_classes', 'corriger', { code: 'TEST' }, { label: 'Test class 2' })).toMatchObject({ label: 'Test class 2' });
    expect(await edit('asset_classes', 'retirer', { code: 'TEST' }, null)).toMatchObject({ active: false });
    expect(await refused(edit('asset_classes', 'retirer', { code: 'TEST' }, null))).toMatch(/déjà retirée/);
    expect((await t.db.select().from(assetClasses).where(eq(assetClasses.code, 'TEST')))[0].active).toBe(false);
    expect(await edit('exchange_rates', 'ajouter', null, { currency: 'XOF', period: '2027', units_per_eur: 655.957 })).toMatchObject({ currency: 'XOF', period: '2027', entered_by_name: `${ADMIN} (via Matrix)` });
    expect(await refused(edit('exchange_rates', 'ajouter', null, { currency: 'XOF', period: '27', units_per_eur: 655 }))).toMatch(/Période/);
    expect(await refused(edit('exchange_rates', 'retirer', { currency: 'XOF', period: '2027' }, null))).toMatch(/Action « retirer » refusée/);
    const [a] = await t.db.select().from(auditEntries).where(eq(auditEntries.objectRef, 'exchange_rates XOF / 2027'));
    expect(a).toMatchObject({ change: 'exchange_rates via Matrix: added (currency, note, period, units_per_eur)', capexId: null, before: null });
  });

  it('a ramp-up day corrected marks its line stale; the job recomputes it', async () => {
    const [d] = await t.db.select().from(rampupDays).where(eq(rampupDays.plannedStop, false)).limit(1);
    await edit('rampup_days', 'corriger', { line_id: d.lineId, day: d.day }, { output: 1 });
    expect((await t.db.select().from(productionLines).where(eq(productionLines.id, d.lineId)))[0].computedAt).toBeNull();
    expect(await recomputeStaleLines(t.db, await modelValues(t.db), '2026-10-22')).toBe(1);
    expect((await t.db.select().from(productionLines).where(eq(productionLines.id, d.lineId)))[0].computedAt).not.toBeNull();
  });
});
