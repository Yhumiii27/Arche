import 'server-only';
// Templates of the dossiers and circuits (AR-052): the published version of each target, a given version (a dossier version
// keeps the template it was started with), the draft and the history. Version 0 is the built-in definition.
import { and, desc, eq } from 'drizzle-orm';
import { builtInCircuit, builtInDossier, readCircuitDesign, readDossierDesign } from '@/domain/designer';
import { circuitTemplate, type StepTemplate } from '@/domain/circuits';
import type { DossierKind, Sections } from '@/domain/dossiers';
import type { GateCode } from '@/domain/lifecycle';
import { designs } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';

type Q = DB | Tx;

/** Every version of a target, newest first. */
export async function designsOf(q: Q, kind: 'dossier' | 'circuit', target: string) {
  return q.select().from(designs).where(and(eq(designs.kind, kind), eq(designs.target, target))).orderBy(desc(designs.version));
}

async function published(q: Q, kind: 'dossier' | 'circuit', target: string) {
  return (await q.select().from(designs).where(and(eq(designs.kind, kind), eq(designs.target, target), eq(designs.state, 'published'))).limit(1))[0] ?? null;
}

/** The sections a new dossier version starts with: the published template (its version), else the built-in ones (null). */
export async function currentSections(q: Q, kind: DossierKind): Promise<{ version: number | null; sections: Sections }> {
  const p = await published(q, 'dossier', kind);
  return p ? { version: p.version, sections: readDossierDesign(kind, p.definition).sections } : { version: null, sections: builtInDossier(kind).sections };
}

/** The sections of a dossier version's template (null: the built-in ones). */
export async function sectionsFor(q: Q, kind: DossierKind, version: number | null | undefined): Promise<Sections> {
  if (version == null) return builtInDossier(kind).sections;
  const [d] = await q.select().from(designs).where(and(eq(designs.kind, 'dossier'), eq(designs.target, kind), eq(designs.version, version)));
  return readDossierDesign(kind, d?.definition).sections;
}

/** The steps of a new gate session: the published circuit, else the built-in one; filtered for the CAPEX's typology. */
export async function circuitFor(q: Q, gate: GateCode, typology: 'light' | 'strategic' | null): Promise<StepTemplate[]> {
  const p = await published(q, 'circuit', gate);
  return circuitTemplate(gate, typology, p ? readCircuitDesign(gate, p.definition).steps : null);
}

/** The definition a new draft starts from: the published version, else the built-in one. */
export async function baseDefinition(q: Q, kind: 'dossier' | 'circuit', target: string) {
  const p = await published(q, kind, target);
  if (kind === 'dossier') return p ? readDossierDesign(target as DossierKind, p.definition) : builtInDossier(target as DossierKind);
  return p ? readCircuitDesign(target as GateCode, p.definition) : builtInCircuit(target as GateCode);
}
