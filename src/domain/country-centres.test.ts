import { describe, expect, it } from 'vitest';
import { COUNTRY_CENTRES, countryCentre } from './country-centres';

describe('countryCentre', () => {
  it('gives the centre of the group countries, inside the country', () => {
    const ma = countryCentre('MA')!;
    expect(ma.latitude).toBeGreaterThan(21);
    expect(ma.latitude).toBeLessThan(36);
    const sn = countryCentre('sn')!;
    expect(sn.longitude).toBeGreaterThan(-17.6);
    expect(sn.longitude).toBeLessThan(-11.3);
  });

  it('takes the main territory of a country with overseas parts', () => {
    const fr = countryCentre('FR')!;
    expect(fr.latitude).toBeGreaterThan(42);
    expect(fr.longitude).toBeGreaterThan(-5);
  });

  it('is null for an unknown or missing country', () => {
    expect(countryCentre('ZZ')).toBeNull();
    expect(countryCentre(null)).toBeNull();
    expect(Object.keys(COUNTRY_CENTRES).length).toBeGreaterThan(170);
  });
});
