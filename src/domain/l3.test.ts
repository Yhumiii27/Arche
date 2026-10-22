import { describe, expect, it } from 'vitest';
import { inboxFigures, sortInbox, type ApprovalItem } from './approvals';
import { irr, npv, payback, checkBusinessPlan, type BpYear } from './bp';
import { addWorkingDays, canActOn, checkOutcome, circuitFacts, circuitState, circuitTemplate, decisionOf, dueOf, openGroup, refreshStatuses, type StepActor, type StepState } from './circuits';
import { checkChange, checkMatrix, deciderOf, DEFAULT_MATRIX, readMatrix } from './delegation';
import { canonicalJson, checkCodexRef, completeness, emptyContent, readContent, SECTIONS } from './dossiers';
import { DEFAULT_VALUES } from './lifecycle';

const steps = (tpl: ReturnType<typeof circuitTemplate>): (StepState & { actor: StepActor })[] =>
  refreshStatuses(tpl.map((s, i) => ({ id: `s${i}`, group: s.group, kind: s.kind, optional: !!s.optional, decides: !!s.decides, status: 'waiting' as const, outcome: null, actor: s.actor })));
const act = <T extends StepState>(xs: T[], id: string, outcome: StepState['outcome']) => refreshStatuses(xs.map((s) => (s.id === id ? { ...s, status: 'done' as const, outcome } : s)));

describe('living dossiers', () => {
  it('completeness counts the typed and computed sections, not the optional and circuit ones', () => {
    const c = emptyContent('business_case');
    const none = { budget_e50: false, budget_e10: false, business_plan: false, business_plan_validated: false, risks: false, team: false };
    expect(completeness('business_case', c, none).pct).toBe(0);
    for (const s of SECTIONS.business_case) if (s.mode === 'text') c.sections[s.key].text = 'x';
    const r = completeness('business_case', c, { ...none, budget_e50: true, risks: true });
    expect(r.bySection).toMatchObject({ need: true, prelim_bp: true, team: false, machines: null });
    expect(r.pct).toBe(88);
    expect(completeness('business_case', c, { ...none, budget_e50: true, risks: true, team: true }).pct).toBe(100);
  });
  it('canonical JSON sorts keys at every depth; stored content is read safely', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"x":2,"y":1}]},"b":1}');
    const c = readContent('investment', { sections: { baseline: { text: 'B', refs: [{ id: 'PID-X-1' }, 3] }, zzz: { text: 'no' } } });
    expect(c.sections.baseline.text).toBe('B');
    expect(c.sections.baseline.refs).toHaveLength(1);
    expect(c.sections.zzz).toBeUndefined();
    expect(c.sections.pack.text).toBe('');
  });
  it('Codex references', () => {
    expect(checkCodexRef({ codexId: ' pid-cpx-apm-2026-01-003 ', revision: 'b' })).toEqual({ ok: true, value: { id: 'PID-CPX-APM-2026-01-003', revision: 'B' } });
    expect(checkCodexRef({ codexId: 'hello' }).ok).toBe(false);
    expect(checkCodexRef({ codexId: 'AUT-APM-12', revision: '3' }).ok).toBe(false);
  });
});

describe('gate circuits', () => {
  it('G1: opinions, then the sponsor visa, then the decision (the COPIL review is optional and open with it)', () => {
    let s = steps(circuitTemplate('G1', 'light'));
    expect(s.map((x) => x.status)).toEqual(['open', 'waiting', 'waiting', 'waiting']);
    expect(circuitFacts('G1', s)).toMatchObject({ g1_experts: { met: false, value: '0 / 1' }, g1_sponsor_visa: { met: false } });
    s = act(s, 's0', 'favorable');
    expect(s.map((x) => x.status)).toEqual(['done', 'open', 'waiting', 'waiting']);
    s = act(s, 's1', 'approved');
    expect(openGroup(s)).toBe(3);
    expect(s.map((x) => x.status)).toEqual(['done', 'done', 'open', 'open']);
    expect(circuitFacts('G1', s)).toMatchObject({ g1_experts: { met: true }, g1_sponsor_visa: { met: true } });
    s = act(s, 's3', 'go');
    expect(circuitState(s)).toBe('decided');
    expect(decisionOf(s[3])).toBe('go');
  });
  it('Strategic G1 asks the finance opinion too; a refused visa stops the circuit', () => {
    let s = steps(circuitTemplate('G1', 'strategic'));
    expect(s.filter((x) => x.kind === 'opinion')).toHaveLength(2);
    s = act(act(s, 's0', 'favorable'), 's1', 'reserved');
    s = act(s, 's2', 'refused');
    expect(circuitState(s)).toBe('refused');
  });
  it('G3 is decided by the last countersignature; K3 by the visa', () => {
    let s = steps(circuitTemplate('G3', null));
    s = act(act(s, 's0', 'approved'), 's1', 'approved');
    s = act(act(s, 's2', 'approved'), 's3', 'approved');
    expect(decisionOf(s[3])).toBe('go');
    const k = act(steps(circuitTemplate('K3', null)), 's0', 'approved');
    expect(decisionOf(k[0])).toBe('go');
  });
  it('outcomes: kind, open step, reasons', () => {
    const s = steps(circuitTemplate('G2', null));
    expect(checkOutcome(s[0], 'approved', null).ok).toBe(false);
    expect(checkOutcome(s[0], 'reserved', ' ')).toEqual({ ok: false, error: 'Give the reason' });
    expect(checkOutcome(s[0], 'favorable', null).ok).toBe(true);
    expect(checkOutcome(s[6], 'go', null)).toEqual({ ok: false, error: 'This step is not open' });
  });
  it('working days and deadlines (5 for an opinion, the gate delay otherwise)', () => {
    expect(addWorkingDays('2026-10-22', 2)).toBe('2026-10-26');
    expect(addWorkingDays('2026-10-23', 1)).toBe('2026-10-26');
    expect(dueOf('opinion', 'G1', '2026-10-22', DEFAULT_VALUES)).toBe('2026-10-29');
    expect(dueOf('decision', 'G1', '2026-10-22', DEFAULT_VALUES)).toBe('2026-10-26');
  });
  it('who acts on a step', () => {
    const c = { code: 'CPX-APM-2026-01', subsidiaryCode: 'APM', status: 'active' };
    const hse = { actor: 'expert' as const, speciality: 'hse', assigneeUserId: null };
    const base = { userId: 'u1', internalClient: false };
    expect(canActOn(hse, { ...base, role: 'group_hse', assignments: [{ role: 'group_hse', scopeKind: 'group', scopeRef: null }] }, c)).toBe(true);
    expect(canActOn(hse, { ...base, role: 'expert', assignments: [{ role: 'expert', scopeKind: 'capex', scopeRef: c.code, speciality: 'hse' }] }, c)).toBe(true);
    expect(canActOn(hse, { ...base, role: 'expert', assignments: [{ role: 'expert', scopeKind: 'capex', scopeRef: c.code, speciality: 'quality' }] }, c)).toBe(false);
    expect(canActOn({ ...hse, assigneeUserId: 'u2' }, { ...base, role: 'group_hse', assignments: [{ role: 'group_hse', scopeKind: 'group', scopeRef: null }] }, c)).toBe(false);
    const visa = { actor: 'sponsor' as const, speciality: null, assigneeUserId: null };
    expect(canActOn(visa, { ...base, role: 'sponsor', assignments: [{ role: 'sponsor', scopeKind: 'subsidiary', scopeRef: 'SAI' }] }, c)).toBe(false);
    const ic = { actor: 'internal_client' as const, speciality: null, assigneeUserId: null };
    expect(canActOn(ic, { ...base, role: 'project_lead', internalClient: true, assignments: [] }, c)).toBe(true);
  });
});

describe('delegation (spec 05 §5)', () => {
  const ctx = { typology: 'light' as const, g2BudgetKeur: 10000, approvedCostKeur: 0, contingencyKeur: 500 };
  it('cost, delay, cumulative, scope and contingency', () => {
    expect(deciderOf({ kind: 'cost', amountKeur: 250, delayDays: 0 }, ctx)).toBe('copil_projet');
    expect(deciderOf({ kind: 'cost', amountKeur: 300, delayDays: 0 }, ctx)).toBe('dir_ig');
    expect(deciderOf({ kind: 'cost', amountKeur: 800, delayDays: 0 }, ctx)).toBe('ceo');
    expect(deciderOf({ kind: 'cost', amountKeur: 100, delayDays: 0 }, { ...ctx, approvedCostKeur: 450 })).toBe('dir_ig');
    expect(deciderOf({ kind: 'cost', amountKeur: 100, delayDays: 0 }, { ...ctx, approvedCostKeur: 950 })).toBe('ceo');
    expect(deciderOf({ kind: 'schedule', amountKeur: 0, delayDays: 31 }, ctx)).toBe('dir_ig');
    expect(deciderOf({ kind: 'schedule', amountKeur: 0, delayDays: 20 }, { ...ctx, typology: 'strategic' })).toBe('dir_ig');
    expect(deciderOf({ kind: 'scope', amountKeur: 0, delayDays: 0 }, ctx)).toBe('dir_ig');
    expect(deciderOf({ kind: 'scope', amountKeur: 2000, delayDays: 0 }, ctx)).toBe('ceo');
    expect(deciderOf({ kind: 'contingency_draw', amountKeur: 250, delayDays: 0 }, ctx)).toBe('copil_projet');
    expect(deciderOf({ kind: 'contingency_draw', amountKeur: 260, delayDays: 0 }, ctx)).toBe('dir_ig');
  });
  it('input of a change and of the matrix', () => {
    expect(checkChange({ title: 'Extra piles', kind: 'cost', amountKeur: '120' })).toMatchObject({ ok: true, value: { amountKeur: 120, delayDays: 0 } });
    expect(checkChange({ title: 'Extra piles', kind: 'cost' }).ok).toBe(false);
    expect(checkChange({ title: 'Late slab', kind: 'schedule', delayDays: '1.5' }).ok).toBe(false);
    const flat: Record<string, string> = {};
    for (const t of ['light', 'strategic'] as const) for (const l of ['copil_projet', 'dir_ig'] as const) for (const f of ['costPct', 'costKeur', 'delayDays'] as const) flat[`${t}.${l}.${f}`] = String(DEFAULT_MATRIX[t][l][f]);
    Object.assign(flat, { 'cumulativePct.copil_projet': '5', 'cumulativePct.dir_ig': '10', contingencyPct: '50' });
    expect(checkMatrix(flat)).toEqual({ ok: true, value: DEFAULT_MATRIX });
    expect(checkMatrix({ ...flat, 'light.copil_projet.costKeur': '5000' }).ok).toBe(false);
    expect(readMatrix({ light: { copil_projet: { costPct: 2 } } }).light.copil_projet).toEqual({ costPct: 2, costKeur: 250, delayDays: 30 });
  });
});

describe('business plan', () => {
  const ys: BpYear[] = [{ year: 0, capexKeur: 1000, opexKeur: 0, revenueKeur: 0 }, ...[1, 2, 3, 4].map((year) => ({ year, capexKeur: 0, opexKeur: 100, revenueKeur: 450 }))];
  it('NPV, IRR, payback', () => {
    expect(npv(0, ys)).toBe(400);
    expect(npv(10, ys)).toBe(109.5);
    expect(irr(ys)).toBeCloseTo(14.96, 1);
    expect(payback(ys)).toBe(2.9);
    expect(irr([{ year: 0, capexKeur: 0, opexKeur: 0, revenueKeur: 10 }])).toBeNull();
    expect(payback([{ year: 0, capexKeur: 10, opexKeur: 0, revenueKeur: 0 }])).toBeNull();
  });
  it('input', () => {
    expect(checkBusinessPlan({ discountRatePct: '8', 'capex:0': '1 000', 'revenue:1': '450' }, 2)).toEqual({ ok: true, value: { discountRatePct: 8, years: [{ year: 0, capexKeur: 1000, opexKeur: 0, revenueKeur: 0 }, { year: 1, capexKeur: 0, opexKeur: 0, revenueKeur: 450 }] } });
    expect(checkBusinessPlan({ discountRatePct: '80' }, 2).ok).toBe(false);
  });
});

describe('my approvals', () => {
  const it0 = (since: string, due: string | null): ApprovalItem => ({ kind: 'step', capexCode: 'C', title: 't', detail: 'd', subject: 's', since, due, href: '/' });
  it('figures and order', () => {
    const items = [it0('2026-10-20', '2026-10-27'), it0('2026-10-10', '2026-10-21'), it0('2026-10-21', null)];
    expect(inboxFigures(items, '2026-10-22')).toEqual({ pending: 3, late: 1, oldest: '2026-10-10' });
    expect(sortInbox(items).map((i) => i.since)).toEqual(['2026-10-10', '2026-10-20', '2026-10-21']);
  });
});
