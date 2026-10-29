import { describe, expect, it } from 'vitest';
import { checkRate, entryCurrencies, entryCurrency, rateFor, toKeur, unitOf } from './currency';

const rates = [
  { currency: 'MAD', period: '2026', unitsPerEur: 10.9 },
  { currency: 'MAD', period: '2026-10', unitsPerEur: 10.8 },
  { currency: 'XOF', period: '2026', unitsPerEur: 655.957 },
];

describe('currencies (AR-039)', () => {
  it('the month’s rate, else the fiscal year’s; 1 for the euro; none entered: null', () => {
    expect(rateFor(rates, 'MAD', '2026-10')).toBe(10.8);
    expect(rateFor(rates, 'MAD', '2026-09')).toBe(10.9);
    expect(rateFor(rates, 'EUR', '2026-09')).toBe(1);
    expect(rateFor(rates, 'MAD', '2025-12')).toBeNull();
    expect(toKeur(65_595.7, 655.957)).toBe(100);
    expect(unitOf('MAD')).toBe('kMAD');
    expect(unitOf('EUR')).toBe('k€');
  });

  it('entry currencies and the rate form', () => {
    expect(entryCurrencies('XOF')).toEqual(['XOF', 'EUR']);
    expect(entryCurrency('', 'XOF')).toBe('XOF');
    expect(entryCurrency('EUR', 'XOF')).toBe('EUR');
    expect(entryCurrency('USD', 'XOF')).toBeNull();
    expect(checkRate({ currency: 'mad', period: '2026-11', unitsPerEur: '10,75' })).toEqual({ ok: true, value: { currency: 'MAD', period: '2026-11', unitsPerEur: 10.75, note: null } });
    expect(checkRate({ currency: 'EUR', period: '2026', unitsPerEur: '1' }).ok).toBe(false);
    expect(checkRate({ currency: 'MAD', period: '2026-13', unitsPerEur: '1' }).ok).toBe(false);
    expect(checkRate({ currency: 'MAD', period: '2026', unitsPerEur: '0' }).ok).toBe(false);
  });
});
