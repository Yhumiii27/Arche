import { describe, expect, it } from 'vitest';
import { circuitTemplate } from './circuits';
import { builtInCircuit, builtInDossier, checkCircuitDesign, checkDossierDesign } from './designer';

/** The form of a dossier's sections as the designer sends it. */
const dossierForm = (kind: 'business_case', change: (f: Record<string, string>) => void = () => undefined) => {
  const f: Record<string, string> = {};
  builtInDossier(kind).sections.forEach((s, i) => Object.assign(f, { [`key:${i}`]: s.key, [`title:${i}`]: s.title, [`hint:${i}`]: s.hint, [`mode:${i}`]: s.mode, [`order:${i}`]: String(i + 1) }));
  change(f);
  return f;
};
const circuitForm = (gate: 'G1' | 'G3', change: (f: Record<string, string>) => void = () => undefined) => {
  const f: Record<string, string> = {};
  builtInCircuit(gate).steps.forEach((s, i) => Object.assign(f, {
    [`label:${i}`]: s.label, [`group:${i}`]: String(s.group), [`kind:${i}`]: s.kind, [`actor:${i}`]: s.actor, [`speciality:${i}`]: s.speciality ?? '',
    ...(s.optional ? { [`optional:${i}`]: 'on' } : {}), ...(s.decides ? { [`decides:${i}`]: 'on' } : {}), ...(s.strategicOnly ? { [`strategicOnly:${i}`]: 'on' } : {}),
  }));
  change(f);
  return f;
};

describe('dossier templates (AR-052)', () => {
  const base = builtInDossier('business_case');
  it('the built-in form gives the built-in sections back', () => {
    expect(checkDossierDesign('business_case', base, dossierForm('business_case'))).toEqual({ ok: true, value: base });
  });

  it('a section added, one renamed and moved, one made optional, one removed', () => {
    const r = checkDossierDesign('business_case', base, dossierForm('business_case', (f) => {
      f['new:title'] = '10. Water and energy';
      f['new:hint'] = 'Needs of utilities';
      f['title:2'] = '3. Entry barriers';
      f['order:2'] = '0';
      f['mode:3'] = 'optional';
      f['remove:7'] = 'on';
    }));
    expect(r.ok).toBe(true);
    const secs = r.ok ? r.value.sections : [];
    expect(secs[0]).toMatchObject({ key: 'barriers', title: '3. Entry barriers' });
    expect(secs.find((s) => s.key === 'land')!.mode).toBe('optional');
    expect(secs.some((s) => s.key === 'safety')).toBe(false);
    expect(secs.at(-1)).toEqual({ key: 'custom_1', title: '10. Water and energy', hint: 'Needs of utilities', mode: 'text' });
  });

  it('locked: a computed section cannot be removed nor change its mode; a title is required', () => {
    expect(checkDossierDesign('business_case', base, dossierForm('business_case', (f) => { f['remove:4'] = 'on'; }))).toMatchObject({ ok: false, error: 'A section computed by Arche or filled by the circuit cannot be removed' });
    const r = checkDossierDesign('business_case', base, dossierForm('business_case', (f) => { f['mode:4'] = 'text'; }));
    expect(r.ok && r.value.sections.find((s) => s.key === 'prelim_bp')!.mode).toBe('computed');
    expect(checkDossierDesign('business_case', base, dossierForm('business_case', (f) => { f['title:0'] = ''; }))).toMatchObject({ ok: false });
  });
});

describe('circuit templates (AR-052)', () => {
  it('the built-in form gives the built-in steps back; Strategic only steps are filtered by typology', () => {
    const r = checkCircuitDesign('G1', circuitForm('G1'));
    expect(r).toEqual({ ok: true, value: builtInCircuit('G1') });
    expect(circuitTemplate('G1', 'light', r.ok ? r.value.steps : null).map((s) => s.label)).not.toContain('Finance opinion');
    expect(circuitTemplate('G1', 'strategic', r.ok ? r.value.steps : null).map((s) => s.label)).toContain('Finance opinion');
  });

  it('a step added (a quality opinion), the COPIL review removed', () => {
    const r = checkCircuitDesign('G1', circuitForm('G1', (f) => {
      Object.assign(f, { 'new:label': 'Quality opinion', 'new:group': '1', 'new:kind': 'opinion', 'new:actor': 'expert', 'new:speciality': 'quality' });
      f['remove:3'] = 'on';
    }));
    expect(r.ok && r.value.steps.map((s) => s.label)).toEqual(['HSE opinion', 'Finance opinion', 'Quality opinion', 'Sponsor visa', 'COPIL GPI decision (president)']);
  });

  it('the rules of the method', () => {
    expect(checkCircuitDesign('G1', circuitForm('G1', (f) => { delete f['decides:4']; }))).toMatchObject({ error: 'A circuit has exactly one deciding step' });
    expect(checkCircuitDesign('G1', circuitForm('G1', (f) => { f['remove:2'] = 'on'; }))).toMatchObject({ error: 'The G1 circuit keeps the sponsor’s visa (G1 criterion)' });
    expect(checkCircuitDesign('G3', circuitForm('G3', (f) => { f['optional:0'] = 'on'; }))).toMatchObject({ error: 'The G3 circuit keeps the PSSR discharge by the group HSE (G3 criterion)' });
    expect(checkCircuitDesign('G1', circuitForm('G1', (f) => { f['group:0'] = '4'; }))).toMatchObject({ error: 'The deciding step is in the last group' });
    expect(checkCircuitDesign('G1', circuitForm('G1', (f) => { f['actor:0'] = 'sponsor'; }))).toMatchObject({ error: 'An opinion is given by an expert of a speciality' });
    expect(checkCircuitDesign('G1', circuitForm('G1', (f) => { f['kind:4'] = 'review'; }))).toMatchObject({ error: 'The deciding step is a decision, a signature, a visa or a countersignature' });
  });
});
