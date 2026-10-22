import { describe, expect, it } from 'vitest';
import { canSubmitNeeds, checkNeed, epc2iReservationsFact, firmOffersFact, isValidFirmOffer, latestAnswer, needRef, satPlannedFact, type Answer, type CatalogueItem } from './needs';

const sheet: CatalogueItem = {
  code: 'EXT-9MN', version: 3, typeCode: 'EXT', typeLabel: 'Extrusion press', variant: null, label: 'Press', description: null, options: [{ code: 'A', label: 'A', priceKeur: 10 }],
  nominalCapacity: 2, capacityUnit: 't/h', priceKeur: 100, leadTimeWeeks: 10, status: 'publie',
};
const answer = (o: Partial<Answer>): Answer => ({
  needRef: 'CPX-X/B01', capexCode: 'CPX-X', number: '1', nature: 'qualification', qualification: null, reason: null, estimateClass: null, centralKeur: null, lowKeur: null, highKeur: null,
  leadTimeWeeks: null, validUntil: null, documentRef: null, projectCode: null, status: 'remise', answeredAt: '2026-01-01T00:00:00Z', ...o,
});

describe('machine needs', () => {
  it('references and phases', () => {
    expect(needRef('CPX-APM-2026-01', 3)).toBe('CPX-APM-2026-01/B03');
    expect(canSubmitNeeds({ status: 'active', phase: 'avant_projet' })).toBe(true);
    expect(canSubmitNeeds({ status: 'active', phase: 'execution' })).toBe(false);
  });

  it('checks a need line', () => {
    expect(checkNeed({ catalogue: 'EXT-9MN@3', quantity: '2', targetCapacity: '1,5' }, [sheet], ['A', 'B'])).toMatchObject({ ok: true, value: { catalogueCode: 'EXT-9MN', options: ['A'], targetCapacity: 1.5, capacityUnit: 't/h', freeLabel: null } });
    expect(checkNeed({ catalogue: 'EXT-9MN@2' }, [sheet], [])).toEqual({ ok: false, error: 'Choose a machine of the catalogue' });
    expect(checkNeed({ catalogue: '', freeLabel: 'Saw', capacityUnit: 'cuts/h', targetCapacity: '30' }, [sheet], ['A'])).toMatchObject({ ok: true, value: { catalogueCode: null, freeLabel: 'Saw', options: [], capacityUnit: 'cuts/h' } });
    expect(checkNeed({ catalogue: 'EXT-9MN@3', needDate: '1/2/2027' }, [sheet], [])).toEqual({ ok: false, error: 'Enter a valid date' });
  });

  it('the latest answer is authoritative; a firm offer is E10 and still valid', () => {
    const a = [answer({ answeredAt: '2026-02-01T00:00:00Z', nature: 'offre_ferme', estimateClass: 'E10', validUntil: '2026-06-30' }), answer({ answeredAt: '2026-01-01T00:00:00Z' })];
    expect(latestAnswer(a, 'CPX-X/B01')?.nature).toBe('offre_ferme');
    expect(isValidFirmOffer(a[0], '2026-06-30')).toBe(true);
    expect(isValidFirmOffer(a[0], '2026-07-01')).toBe(false);
    expect(isValidFirmOffer({ ...a[0], status: 'caduque' }, '2026-03-01')).toBe(false);
    expect(firmOffersFact([{ ref: 'CPX-X/B01', status: 'submitted' }, { ref: 'CPX-X/B02', status: 'submitted' }, { ref: 'CPX-X/B03', status: 'withdrawn' }], a, '2026-03-01')).toEqual({ met: false, value: '1 / 2' });
    expect(firmOffersFact([], [], '2026-03-01')).toEqual({ met: true, value: '0 / 0' });
  });

  it('K3 SATs planned and G3 reservations of the EPC2i projects', () => {
    expect(satPlannedFact(['P1', 'P2'], [{ projectCode: 'P1', code: 'sat', plannedOn: '2027-01-01' }, { projectCode: 'P2', code: 'fat', plannedOn: '2026-12-01' }])).toEqual({ met: false, value: '1 / 2' });
    expect(epc2iReservationsFact([{ category: 'C', status: 'open' }, { category: 'B', status: 'closed' }], [{ status: 'accepted' }])).toEqual({ met: true, value: '0 A/B · 0 PV' });
    expect(epc2iReservationsFact([{ category: 'A', status: 'open' }], [{ status: 'planned' }])).toEqual({ met: false, value: '1 A/B · 1 PV' });
  });
});
