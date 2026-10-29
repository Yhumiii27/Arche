import { describe, expect, it } from 'vitest';
import { checkSageCode, cumulativeByMonth, demoSageCsv, parseSageCsv, SAGE_HEADER, sageKey } from './sage';

describe('Sage extraction (AR-047)', () => {
  it('reads the lines; rejects the bad ones, never the file', () => {
    const r = parseSageCsv([
      SAGE_HEADER,
      'SAI;2026-10-02;CMD;BC-1;sai-ut-01;900000;EUR;Energis;Package',
      'SAI;14/10/2026;FAC;FA-1;SAI-UT-01;1 250,50;eur;Energis;',
      'SAI;2026-10-15;AVO;AV-1;SAI-UT-01;250;EUR;Energis;Credit',
      'APM;2026-10-02;CMD;BC-2;APM-01;10;MAD;;',
      'SAI;2026-13-45;CMD;BC-3;SAI-UT-01;10;EUR;;',
      'SAI;2026-10-02;XXX;BC-4;SAI-UT-01;10;EUR;;',
      '',
    ].join('\n'), 'SAI');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((l) => [l.kind, l.analytic, l.amount, l.date])).toEqual([['order', 'SAI-UT-01', 900000, '2026-10-02'], ['invoice', 'SAI-UT-01', 1250.5, '2026-10-14'], ['credit', 'SAI-UT-01', -250, '2026-10-15']]);
    expect(r.rejects.map((x) => [x.lineNo, x.reason])).toEqual([[5, 'Another company'], [6, 'Unreadable date'], [7, 'Unknown document type (CMD, FAC or AVO)']]);
    expect(sageKey(r.lines[0])).toBe('order:BC-1:SAI-UT-01');
    expect(parseSageCsv('lot;month\n', 'SAI')).toMatchObject({ ok: false });
  });

  it('cumulative committed and spent by lot and month', () => {
    const c = cumulativeByMonth([
      { lotId: 'a', date: '2026-09-10', kind: 'order', amount: 1000 },
      { lotId: 'a', date: '2026-10-02', kind: 'invoice', amount: 400 },
      { lotId: 'a', date: '2026-10-20', kind: 'credit', amount: -50 },
      { lotId: 'a', date: '2026-11-02', kind: 'invoice', amount: 100 },
    ], '2026-10');
    expect(c).toEqual([{ lotId: 'a', month: '2026-09', committed: 1000, spent: 0 }, { lotId: 'a', month: '2026-10', committed: 1000, spent: 350 }]);
  });

  it('codes and the demonstration extraction', () => {
    expect(checkSageCode(' sai-ut-01 ')).toEqual({ ok: true, value: 'SAI-UT-01' });
    expect(checkSageCode('')).toEqual({ ok: true, value: null });
    expect(checkSageCode('a b')).toMatchObject({ ok: false });
    const d = parseSageCsv(demoSageCsv('2026-10'), 'SAI');
    expect(d.ok && d.lines.length).toBe(5);
  });
});
