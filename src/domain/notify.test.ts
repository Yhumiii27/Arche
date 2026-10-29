import { describe, expect, it } from 'vitest';
import { checkAbsence, noticesOf, noticeText } from './notify';

const v = { reminderEveryDays: 2, escalationDays: 3 };
const step = (dueOn: string | null, openedOn = '2026-10-19') => ({ id: 's1', status: 'open', openedOn, dueOn });
const kinds = (today: string, s = step('2026-10-22')) => noticesOf(s, today, v).map((n) => n.kind);

describe('circuit notices (AR-041)', () => {
  it('announced once open, recalled the working day before and on the day', () => {
    expect(kinds('2026-10-20')).toEqual(['step_open']);
    expect(kinds('2026-10-21')).toEqual(['step_open', 'step_due_soon']);
    expect(kinds('2026-10-22')).toEqual(['step_open', 'step_due']);
    // Due on a Monday: recalled on the Friday before.
    expect(kinds('2026-10-23', step('2026-10-26'))).toEqual(['step_open', 'step_due_soon']);
    expect(noticesOf({ ...step('2026-10-22'), status: 'waiting' }, '2026-10-22', v)).toEqual([]);
  });

  it('late: a reminder every 2 working days, escalated once from 3 working days late; nothing at the weekend', () => {
    expect(kinds('2026-10-23')).toEqual(['step_open']); // 1 day late
    expect(noticesOf(step('2026-10-22'), '2026-10-26', v).slice(1)).toEqual([{ kind: 'step_late', key: 'step_late:s1:2026-10-26', lateDays: 2 }]);
    expect(kinds('2026-10-27')).toEqual(['step_open', 'step_escalated']); // 3 days late
    expect(kinds('2026-10-28')).toEqual(['step_open', 'step_late', 'step_escalated']); // 4 days late: the escalation key is the same
    expect(noticesOf(step('2026-10-22'), '2026-10-28', v).find((n) => n.kind === 'step_escalated')!.key).toBe('step_escalated:s1');
    expect(kinds('2026-10-24')).toEqual(['step_open']); // Saturday
  });

  it('the message: the step as typed, the deadline, the delegate', () => {
    const m = noticeText((s) => s, { kind: 'step_escalated', lateDays: 3 }, { capexCode: 'CPX-1', capexTitle: 'Line', gate: 'G1 · session 1', stepLabel: 'HSE opinion', dueOn: '2026-10-22', link: '/capex/CPX-1/gates', onBehalfOf: 'Paul' });
    expect(m.subject).toBe('[Arche] CPX-1 · G1 · session 1 — Step escalated · HSE opinion');
    expect(m.body).toContain('3 working day(s) late');
    expect(m.body).toContain('You receive this message as the delegate of Paul.');
    expect(m.body).toContain('Open the circuit → /capex/CPX-1/gates');
  });
});

describe('absences (AR-041)', () => {
  const ok = { fromOn: '2026-10-26', toOn: '2026-10-30', delegateUserId: 'd' };
  it('dates, a delegate other than oneself, no overlap', () => {
    expect(checkAbsence(ok, 'u', '2026-10-22', [])).toEqual({ ok: true, value: { ...ok, note: null } });
    expect(checkAbsence({ ...ok, toOn: '2026-10-25' }, 'u', '2026-10-22', [])).toMatchObject({ ok: false, error: 'The last day comes after the first' });
    expect(checkAbsence({ ...ok, delegateUserId: 'u' }, 'u', '2026-10-22', [])).toMatchObject({ ok: false });
    expect(checkAbsence(ok, 'u', '2026-10-22', [{ userId: 'u', delegateUserId: 'x', fromOn: '2026-10-29', toOn: '2026-11-02' }])).toMatchObject({ error: 'You already have an absence over these days' });
    expect(checkAbsence(ok, 'u', '2026-10-22', [{ userId: 'd', delegateUserId: 'x', fromOn: '2026-10-29', toOn: '2026-11-02' }])).toMatchObject({ error: 'Your delegate is absent over these days' });
    expect(checkAbsence(ok, 'u', '2026-10-22', [{ userId: 'u', delegateUserId: 'x', fromOn: '2026-10-29', toOn: '2026-11-02', cancelledAt: new Date() }])).toMatchObject({ ok: true });
  });
});
