import { describe, expect, it } from 'vitest';
import { checkEnvelope, checkMovement, envelopeCheck, envelopeFact, envelopeOf, envelopeStates } from './envelopes';

const envs = [
  { id: 'g', fiscalYear: 2027, zoneCode: null, subsidiaryCode: null, category: 'all' as const, amountKeur: 50_000 },
  { id: 'apm', fiscalYear: 2027, zoneCode: null, subsidiaryCode: 'APM', category: 'all' as const, amountKeur: 5_000 },
  { id: 'afo-s', fiscalYear: 2027, zoneCode: 'AFO', subsidiaryCode: null, category: 'strategic' as const, amountKeur: 20_000 },
];
const apm = { id: 'c1', subsidiaryCode: 'APM', zoneCode: 'AFN', typology: 'light', byYear: { 2026: 1000, 2027: 4000 } };
const sai = { id: 'c2', subsidiaryCode: 'SAI', zoneCode: 'AFO', typology: 'strategic', byYear: { 2027: 15_000 } };
const sai2 = { id: 'c3', subsidiaryCode: 'SAI', zoneCode: 'AFO', typology: 'light', byYear: { 2027: 2_000 } };

describe('envelopes (AR-040)', () => {
  it('a CAPEX consumes its most specific envelope', () => {
    expect(envelopeOf(envs, apm, 2027)?.id).toBe('apm');
    expect(envelopeOf(envs, sai, 2027)?.id).toBe('afo-s');
    expect(envelopeOf(envs, sai2, 2027)?.id).toBe('g');
    expect(envelopeOf(envs, apm, 2026)).toBeNull();
    const s = envelopeStates(envs, [{ fromId: 'g', toId: 'apm', amountKeur: 500 }], [apm, sai, sai2]);
    expect(s.find((x) => x.envelope.id === 'apm')).toMatchObject({ totalKeur: 5500, consumedKeur: 4000, availableKeur: 1500, usedPct: 72.7 });
    expect(s.find((x) => x.envelope.id === 'g')).toMatchObject({ totalKeur: 49_500, consumedKeur: 2000 });
  });

  it('over the envelope: an alert; beyond the tolerance: the G2 criterion is unmet; no envelope: no fact', () => {
    const big = { ...apm, byYear: { 2027: 5200 } };
    const c1 = envelopeCheck(envs, [], [], big, 10);
    expect(c1.over.map((r) => r.overKeur)).toEqual([200]);
    expect(c1.blocked).toEqual([]);
    expect(envelopeFact(c1)).toEqual({ met: true, value: '2027: +200 k€' });
    const c2 = envelopeCheck(envs, [], [], { ...apm, byYear: { 2027: 6000 } }, 10);
    expect(envelopeFact(c2)).toEqual({ met: false, value: '2027: +1000 k€' });
    expect(envelopeFact(envelopeCheck(envs, [], [], { ...apm, byYear: { 2026: 900 } }, 10))).toBeUndefined();
  });

  it('the forms', () => {
    const ctx = { zones: new Set(['AFN']), subsidiaries: new Set(['APM']) };
    expect(checkEnvelope({ fiscalYear: '2027', scope: 'sub:APM', category: 'light', amountKeur: '5 000' }, ctx)).toEqual({ ok: true, value: { fiscalYear: 2027, zoneCode: null, subsidiaryCode: 'APM', category: 'light', amountKeur: 5000, note: null } });
    expect(checkEnvelope({ fiscalYear: '2027', scope: 'sub:XXX', amountKeur: '1' }, ctx).ok).toBe(false);
    const state = envelopeStates(envs, [], [apm])[1];
    expect(checkMovement({ amountKeur: '2000', reason: 'Carry over' }, state).ok).toBe(false);
    expect(checkMovement({ amountKeur: '500', reason: 'Carry over' }, state)).toEqual({ ok: true, value: { amountKeur: 500, reason: 'Carry over' } });
  });
});
