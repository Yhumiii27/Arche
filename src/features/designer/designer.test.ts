// The no-code designer (AR-052) on a fresh database with the demo data set: reserved to the administrator and the group
// industrial director; a draft started from the built-in template, changed, previewed then published; a new gate session follows
// the published circuit, a new dossier version the published sections (a section added is typed on a CAPEX).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { and, eq } from 'drizzle-orm';
import { builtInCircuit, builtInDossier } from '@/domain/designer';
import { capex, designs, dossiers, dossierVersions } from '@/server/db/schema';
import { circuitFor, currentSections, designsOf } from '@/server/dal/designs';
import { testDatabase, type TestDatabase } from '@/test/db';
import { saveSectionAction } from '@/features/dossiers/actions';
import { discardDesignAction, publishDesignAction, saveDesignAction, startDesignAction } from './actions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());
beforeEach(() => jar.set('arche-role', 'dir_ig'));

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const g1Form = (extra: Record<string, string>) => {
  const f: Record<string, string> = {};
  builtInCircuit('G1').steps.forEach((s, i) => Object.assign(f, {
    [`label:${i}`]: s.label, [`group:${i}`]: String(s.group), [`kind:${i}`]: s.kind, [`actor:${i}`]: s.actor, [`speciality:${i}`]: s.speciality ?? '',
    ...(s.optional ? { [`optional:${i}`]: 'on' } : {}), ...(s.decides ? { [`decides:${i}`]: 'on' } : {}), ...(s.strategicOnly ? { [`strategicOnly:${i}`]: 'on' } : {}),
  }));
  return form({ ...f, ...extra });
};

describe('designer (AR-052)', () => {
  it('reserved to the administrator and the group industrial director', async () => {
    jar.set('arche-role', 'copil_member');
    expect(await startDesignAction('circuit', 'G1')).toEqual({ ok: false, error: 'This action is reserved to the administrator and the group industrial director' });
    jar.set('arche-role', 'dir_ig');
    expect(await startDesignAction('circuit', 'X9')).toEqual({ ok: false, error: 'Unknown template' });
  });

  it('a G1 circuit with a quality opinion: draft, publish; the next G1 sessions follow it', async () => {
    expect(await startDesignAction('circuit', 'G1')).toEqual({ ok: true });
    expect(await startDesignAction('circuit', 'G1')).toEqual({ ok: false, error: 'A draft of this template already exists' });
    expect(await saveDesignAction('circuit', 'G1', null, g1Form({ 'decides:4': '' , 'decides:2': 'on' }))).toMatchObject({ ok: false });
    expect(await saveDesignAction('circuit', 'G1', null, g1Form({ 'new:label': 'Quality opinion', 'new:group': '1', 'new:kind': 'opinion', 'new:actor': 'expert', 'new:speciality': 'quality', note: 'Quality first' }))).toEqual({ ok: true });
    // Until published, the built-in circuit is in force.
    expect((await circuitFor(t.db, 'G1', 'light')).map((s) => s.label)).not.toContain('Quality opinion');
    expect(await publishDesignAction('circuit', 'G1')).toEqual({ ok: true });
    expect((await circuitFor(t.db, 'G1', 'light')).map((s) => s.label)).toEqual(['HSE opinion', 'Quality opinion', 'Sponsor visa', 'COPIL GPI members’ review', 'COPIL GPI decision (president)']);
    // A second version replaces it; a draft discarded leaves nothing.
    await startDesignAction('circuit', 'G1');
    expect(await discardDesignAction('circuit', 'G1')).toEqual({ ok: true });
    expect((await designsOf(t.db, 'circuit', 'G1')).map((d) => [d.version, d.state, d.note])).toEqual([[1, 'published', 'Quality first']]);
  });

  it('a business case with a section added: the dossier versions started afterwards have it', async () => {
    expect(await startDesignAction('dossier', 'business_case')).toEqual({ ok: true });
    const f: Record<string, string> = {};
    builtInDossier('business_case').sections.forEach((s, i) => Object.assign(f, { [`key:${i}`]: s.key, [`title:${i}`]: s.title, [`hint:${i}`]: s.hint, [`mode:${i}`]: s.mode }));
    expect(await saveDesignAction('dossier', 'business_case', null, form({ ...f, 'new:title': '10. Water and energy', 'new:mode': 'text' }))).toEqual({ ok: true });
    expect(await publishDesignAction('dossier', 'business_case')).toEqual({ ok: true });
    expect((await currentSections(t.db, 'business_case')).version).toBe(1);
    // The warehouse extension (draft, no dossier yet): its project lead types the new section.
    jar.set('arche-role', 'project_lead');
    expect(await saveSectionAction('CPX-APM-2026-02', 'business_case', 'custom_1', null, form({ text: 'Water 40 m3/day, 1.2 MW.' }))).toEqual({ ok: true });
    const [c] = await t.db.select().from(capex).where(eq(capex.code, 'CPX-APM-2026-02'));
    const [d] = await t.db.select().from(dossiers).where(and(eq(dossiers.capexId, c.id), eq(dossiers.kind, 'business_case')));
    const [v] = await t.db.select().from(dossierVersions).where(eq(dossierVersions.dossierId, d.id));
    expect(v.templateVersion).toBe(1);
    expect((v.content as { sections: Record<string, { text: string }> }).sections.custom_1.text).toBe('Water 40 m3/day, 1.2 MW.');
    expect((await t.db.select().from(designs)).length).toBe(2);
  });
});
