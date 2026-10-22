import { describe, expect, it } from 'vitest';
import { capexMapKpis, capexMarkerStyle, clusterPoints, fitBox, tooltipTitle } from './capex-map';

describe('CAPEX map', () => {
  it('styles a CAPEX marker by status and phase', () => {
    expect(capexMarkerStyle('active', 'execution')).toBe('ontrack');
    expect(capexMarkerStyle('active', 'avant_projet')).toBe('pipeline');
    expect(capexMarkerStyle('on_hold', 'execution')).toBe('risk');
    expect(capexMarkerStyle('draft', 'cadrage')).toBe('closed');
  });

  it('clusters close points and frames a box', () => {
    const c = clusterPoints([{ code: 'A', x: 10, y: 10 }, { code: 'B', x: 12, y: 10 }, { code: 'C', x: 200, y: 200 }], 1);
    expect(c.map((x) => x.items.length)).toEqual([2, 1]);
    expect(fitBox([0, 0, 100, 100], 8, 800, 500).k).toBeCloseTo(3.6);
  });

  it('tooltip title and KPI tiles count CAPEX', () => {
    const t = (s: string) => s;
    expect(tooltipTitle([{ city: 'Kénitra', country: 'Maroc' }, { city: 'Kénitra', country: 'Maroc' }], t)).toBe('Kénitra · Maroc · 2 CAPEX');
    expect(capexMapKpis([{ style: 'ontrack', country: 'Sénégal' }, { style: 'pipeline', country: 'Maroc' }], 1).map((k) => k.value)).toEqual(['2', '2', '1']);
  });
});
