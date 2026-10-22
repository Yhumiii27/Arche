// Delivery 5 (lot 5a), pure rules: safety milestones (N-13), permits, engineering pack (C-9), execution — planned curve, EV,
// SPI / CPI / EAC, works completion, uncertainty gap (CDC §4), the CSV import template (N-14).
import { describe, expect, it } from 'vitest';
import { checkActual, checkWindow, epc2iLotValues, indicatorsAt, monthsBetween, parseActualsCsv, plannedAt, sCurve, uncertaintyGap, worksFact, type LotActual, type LotPlan } from './execution';
import { packFact, packSummary, PACK_TEMPLATE } from './pack';
import { checkPermit, permitsDue, permitsFact } from './permits';
import { checkHs, emptyHs, safetyFacts, withPssrDischarge } from './safety';

const lot = (o: Partial<LotPlan>): LotPlan => ({ id: 'L1', number: 1, kind: 'civil_works', title: 'Slab', epc2i: false, budgetKeur: 1200, start: '2026-01', end: '2026-12', ...o });
const act = (o: Partial<LotActual>): LotActual => ({ lotId: 'L1', month: '2026-06', committedKeur: null, spentKeur: null, physicalPct: null, ...o });

describe('safety milestones', () => {
  it('a passed milestone needs its evidence and its date; a waived one its reason', () => {
    expect(checkHs({ status: 'passed', passedOn: '2026-10-01' }, '2026-10-22')).toEqual({ ok: false, error: 'Give the reference of the evidence (Vigie or Codex)' });
    expect(checkHs({ status: 'passed', evidenceRef: 'VIG-1', passedOn: '2026-11-01' }, '2026-10-22')).toEqual({ ok: false, error: 'The date cannot be in the future' });
    expect(checkHs({ status: 'waived' }, '2026-10-22')).toEqual({ ok: false, error: 'Give the reason the milestone is waived' });
    expect(checkHs({ status: 'in_progress', passedOn: '2026-10-01' }, '2026-10-22')).toMatchObject({ ok: true, value: { passedOn: null } });
  });

  it('HS 2 → G1 … HS 6 → G3; PSSR needs the discharge step of the G3 circuit', () => {
    const facts = safetyFacts([{ ...emptyHs('HS2'), status: 'passed', passedOn: '2026-03-01' }, { ...emptyHs('PSSR'), status: 'passed', passedOn: '2027-01-10' }]);
    expect(facts.g1_hs2).toEqual({ met: true, value: '2026-03-01' });
    expect(facts.g2_hs3.met).toBe(false);
    expect(withPssrDischarge({ ...facts, pssr_discharge: { met: false } }).g3_pssr).toEqual({ met: false, value: 'No discharge' });
    expect(withPssrDischarge({ ...facts, pssr_discharge: { met: true } }).g3_pssr?.met).toBe(true);
    // Before the G3 circuit runs, the milestone alone shows.
    expect(withPssrDischarge(facts).g3_pssr?.met).toBe(true);
  });
});

describe('permits', () => {
  it('filed needs the filing date; obtained the date obtained; not required the reason', () => {
    expect(checkPermit({ kind: 'icpe', title: 'ICPE', status: 'filed' }, '2026-10-22')).toEqual({ ok: false, error: 'Give the filing date' });
    expect(checkPermit({ kind: 'icpe', title: 'ICPE', status: 'obtained', filedOn: '2026-05-01' }, '2026-10-22')).toEqual({ ok: false, error: 'Give the date the permit was obtained' });
    expect(checkPermit({ kind: 'plu', title: 'PLU', status: 'not_required' }, '2026-10-22')).toEqual({ ok: false, error: 'Give the reason the permit is not required' });
    expect(checkPermit({ kind: 'icpe', title: 'ICPE', status: 'obtained', filedOn: '2026-05-01', obtainedOn: '2026-04-01' }, '2026-10-22')).toEqual({ ok: false, error: 'A permit is obtained after it is filed' });
  });

  it('G2: ICPE and building permit filed with a known decision date, or obtained', () => {
    const icpe = { kind: 'icpe' as const, status: 'filed' as const, filedOn: '2026-09-01', dueOn: null, obtainedOn: null };
    expect(permitsFact([icpe])).toEqual({ met: false, value: '0 / 2' });
    expect(permitsFact([{ ...icpe, dueOn: '2026-12-01' }, { kind: 'building_permit', status: 'obtained', filedOn: '2026-06-01', dueOn: null, obtainedOn: '2026-10-01' }])).toEqual({ met: true, value: '2 / 2' });
    expect(permitsDue([{ ...icpe, dueOn: '2026-11-15' }, { ...icpe, dueOn: '2027-03-01' }], '2026-10-22')).toHaveLength(1);
  });
});

describe('engineering pack', () => {
  const all = PACK_TEMPLATE.map((i) => ({ code: i.code, status: 'validated' as const, codexRef: 'X', validatedOn: '2026-10-01' }));
  it('weighted by family over both parts; items not applicable left out', () => {
    expect(packSummary([], []).pct).toBe(0);
    // One family (2 items) fully validated = 20 % of the subsidiary's weight.
    expect(packSummary(all.slice(0, 2), []).pct).toBe(20);
    expect(packSummary([...all.slice(0, 2), ...all.slice(2).map((i) => ({ ...i, status: 'not_applicable' as const }))], []).pct).toBe(100);
    // EPC2i: 100 of weight at 50 % next to the subsidiary's 100 at 100 % → 75 %.
    const s = packSummary(all, [{ projectCode: 'P', family: 'pid', expected: 4, validated: 2, weight: 100 }]);
    expect(s).toMatchObject({ pct: 75, epc2iSharePct: 50 });
    expect(packFact(s, 80)).toEqual({ met: false, value: '75 %' });
    expect(packFact(packSummary(all, []), 80).met).toBe(true);
  });
});

describe('execution', () => {
  it('a lot is planned evenly over its window', () => {
    expect(plannedAt(lot({}), '2025-12')).toBe(0);
    expect(plannedAt(lot({}), '2026-06')).toBe(600);
    expect(plannedAt(lot({}), '2027-03')).toBe(1200);
    expect(plannedAt(lot({ start: null }), '2026-06')).toBeNull();
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('SPI, CPI and EAC from the latest values of each lot', () => {
    const rows = [act({ month: '2026-05', spentKeur: 400, physicalPct: 30 }), act({ month: '2026-06', physicalPct: 40 })];
    const i = indicatorsAt([lot({})], rows, '2026-06');
    // PV 600, EV 480, AC 400 (May's spent kept), CPI 1.2, EAC = 400 + 720 / 1.2 = 1000.
    expect(i).toMatchObject({ bacKeur: 1200, pvKeur: 600, evKeur: 480, acKeur: 400, spi: 0.8, cpi: 1.2, eacKeur: 1000 });
    expect(indicatorsAt([lot({})], [], '2026-06')).toMatchObject({ evKeur: 0, acKeur: 0, cpi: null, eacKeur: 1200 });
    const curve = sCurve([lot({})], rows, '2026-06');
    expect(curve[0]).toEqual({ month: '2026-01', planned: 100, earned: 0, actual: 0 });
    expect(curve.at(-1)).toEqual({ month: '2026-12', planned: 1200, earned: null, actual: null });
  });

  it('K3: works lots outside EPC2i weighted by budget', () => {
    const lots = [lot({}), lot({ id: 'L2', kind: 'buildings', budgetKeur: 800 }), lot({ id: 'M', kind: 'machines', epc2i: true, budgetKeur: 5000 })];
    const rows = [act({ physicalPct: 100 }), act({ lotId: 'L2', physicalPct: 90 }), act({ lotId: 'M', physicalPct: 10 })];
    expect(worksFact(lots, rows, '2026-06', 95)).toEqual({ met: true, value: '96 %' });
    expect(worksFact(lots, rows, '2026-06', 97)?.met).toBe(false);
  });

  it('uncertainty gap: range before G2 (E30 before G2 → 45 points), EAC against the G2 budget after', () => {
    expect(uncertaintyGap({ latestClass: 'E30', nextGate: 'G2', afterG2: false, g2Keur: null, eacKeur: null })).toEqual({ kind: 'range', widthPct: 60, targetClass: 'E10', targetWidthPct: 15, gapPts: 45 });
    expect(uncertaintyGap({ latestClass: 'E10', nextGate: 'K3', afterG2: true, g2Keur: 4000, eacKeur: 4500 })).toEqual({ kind: 'eac', deviationPct: 12.5, lowPct: -5, highPct: 10, within: false });
  });

  it('input: a month not in the future, at least one value; a window of two months', () => {
    expect(checkActual({ month: '2026-11', spentKeur: '1' }, '2026-10')).toEqual({ ok: false, error: 'The month cannot be in the future' });
    expect(checkActual({ month: '2026-10' }, '2026-10')).toEqual({ ok: false, error: 'Enter at least one value' });
    expect(checkActual({ month: '2026-10', physicalPct: '120' }, '2026-10')).toEqual({ ok: false, error: 'The physical progress goes from 0 to 100 %' });
    expect(checkActual({ month: '2026-10', spentKeur: '1 250,5', physicalPct: '40,5 %' }, '2026-10')).toEqual({ ok: true, value: { month: '2026-10', committedKeur: null, spentKeur: 1250.5, physicalPct: 40.5 } });
    expect(checkWindow({ start: '2026-10', end: '2026-01' })).toEqual({ ok: false, error: 'The end month is before the start month' });
    expect(checkWindow({})).toEqual({ ok: true, value: { start: null, end: null } });
  });

  it('CSV import: the template, a line per lot and month; EPC2i lots and duplicates refused', () => {
    const lots = [{ id: 'a', number: 1, epc2i: false }, { id: 'm', number: 2, epc2i: true }];
    expect(parseActualsCsv('lot;month;committed_keur;spent_keur;physical_pct\n1;2026-09;1000;500;30\n1;2026-10;;600;40', lots, '2026-10')).toEqual({
      ok: true, value: [{ lotId: 'a', month: '2026-09', committedKeur: 1000, spentKeur: 500, physicalPct: 30 }, { lotId: 'a', month: '2026-10', committedKeur: null, spentKeur: 600, physicalPct: 40 }],
    });
    expect(parseActualsCsv('2;2026-10;1;1;1', lots, '2026-10')).toEqual({ ok: false, error: 'EPC2i lots come from Keystone', line: 1 });
    expect(parseActualsCsv('lot;month\n1;2026-10;1;;\n1;2026-10;2;;', lots, '2026-10')).toEqual({ ok: false, error: 'The same lot and month appear twice', line: 3 });
    expect(parseActualsCsv('9;2026-10;1;;', lots, '2026-10')).toMatchObject({ ok: false, error: 'Unknown lot number' });
  });

  it('EPC2i lot values from the projects: committed = contract + signed amendments, spent = invoiced', () => {
    expect(epc2iLotValues([{ contractKeur: 1000, amendmentsKeur: 50, invoicedKeur: 400, physicalPct: 60 }, { contractKeur: 3000, amendmentsKeur: 0, invoicedKeur: 900, physicalPct: 20 }]))
      .toEqual({ committedKeur: 4050, spentKeur: 1300, physicalPct: 30 });
    expect(epc2iLotValues([])).toBeNull();
  });
});
