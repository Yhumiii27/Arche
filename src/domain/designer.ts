// No-code designer of the dossiers and circuits (AR-052, DECISIONS.md §5): a template is a versioned definition of a living
// dossier's sections or of a gate's circuit steps. A draft is edited, previewed, then published; the published version applies
// to the dossier versions and gate sessions started afterwards (those started before keep theirs). What the method needs stays
// locked: a dossier keeps its computed sections and the sections filled by the circuit; a circuit keeps one deciding step in its
// last group, G1 the sponsor's visa and G3 the PSSR discharge by the group HSE. Pure: the checks of the designer's input.
import { EXPERT_SPECIALITIES, isRoleKey, type ExpertSpeciality } from '@/config/roles';
import type { Check } from './admin';
import { BUILT_IN_CIRCUITS, type StepActor, type StepKind, type StepTemplate } from './circuits';
import { SECTIONS, type DossierKind, type SectionDef } from './dossiers';
import type { GateCode } from './lifecycle';

export type DesignKind = 'dossier' | 'circuit';
export type DesignState = 'draft' | 'published' | 'retired';
export const DESIGN_STATE_LABEL: Record<DesignState, string> = { draft: 'Draft', published: 'Published', retired: 'Replaced' };

export interface DossierDesign {
  sections: SectionDef[];
}
export interface CircuitDesign {
  steps: StepTemplate[];
}

const STEP_KINDS: readonly StepKind[] = ['opinion', 'review', 'visa', 'decision', 'signature', 'countersign', 'quitus', 'attestation'];
/** The kinds of step whose outcome may be the gate decision. */
export const DECIDING_KINDS: readonly StepKind[] = ['decision', 'signature', 'visa', 'countersign'];

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const on = (v: unknown) => v === 'on' || v === 'true';
const rows = (raw: Record<string, unknown>, field: string) =>
  [...new Set(Object.keys(raw).filter((k) => k.startsWith(`${field}:`)).map((k) => k.slice(field.length + 1)))].filter((i) => /^\d+$/.test(i)).map(Number).sort((a, b) => a - b);

/** The built-in definition (version 0) of a dossier or a circuit. */
export const builtInDossier = (kind: DossierKind): DossierDesign => ({ sections: SECTIONS[kind].map((s) => ({ ...s })) });
export const builtInCircuit = (gate: GateCode): CircuitDesign => ({ steps: BUILT_IN_CIRCUITS[gate].map((s) => ({ ...s })) });

/** A stored definition read safely (an unreadable one is the built-in). */
export function readDossierDesign(kind: DossierKind, stored: unknown): DossierDesign {
  const secs = (stored as DossierDesign | null)?.sections;
  return Array.isArray(secs) && secs.every((s) => s && typeof s.key === 'string' && typeof s.title === 'string') ? { sections: secs } : builtInDossier(kind);
}
export function readCircuitDesign(gate: GateCode, stored: unknown): CircuitDesign {
  const steps = (stored as CircuitDesign | null)?.steps;
  return Array.isArray(steps) && steps.every((s) => s && typeof s.label === 'string' && typeof s.group === 'number') ? { steps } : builtInCircuit(gate);
}

/**
 * A dossier's sections from the designer's form, over the current definition `base`: per row `key:<i>` (hidden), `title:<i>`,
 * `hint:<i>`, `mode:<i>` (text or optional; locked for computed and circuit sections), `order:<i>`, `remove:<i>`; a new
 * section with `new:title`, `new:hint`, `new:mode`.
 */
export function checkDossierDesign(kind: DossierKind, base: DossierDesign, raw: Record<string, unknown>): Check<DossierDesign> {
  const builtIn = new Map(SECTIONS[kind].map((s) => [s.key, s]));
  const byKey = new Map(base.sections.map((s) => [s.key, s]));
  const out: (SectionDef & { order: number })[] = [];
  for (const i of rows(raw, 'key')) {
    const key = text(raw[`key:${i}`]);
    const was = byKey.get(key);
    if (!was) return { ok: false, error: 'Unknown section' };
    const locked = was.mode === 'computed' || was.mode === 'circuit';
    if (on(raw[`remove:${i}`])) {
      if (locked) return { ok: false, error: 'A section computed by Arche or filled by the circuit cannot be removed' };
      continue;
    }
    const title = text(raw[`title:${i}`]);
    const hint = text(raw[`hint:${i}`]);
    if (title.length < 2 || title.length > 120) return { ok: false, error: 'Each section needs a title (120 characters at most)' };
    if (hint.length > 300) return { ok: false, error: 'A hint is 300 characters at most' };
    const mode = locked ? was.mode : text(raw[`mode:${i}`]) || was.mode;
    if (!locked && mode !== 'text' && mode !== 'optional') return { ok: false, error: 'A typed section is required or optional' };
    const order = Number(text(raw[`order:${i}`]) || i);
    if (!Number.isFinite(order)) return { ok: false, error: 'The order is a number' };
    out.push({ ...was, title, hint, mode: mode as SectionDef['mode'], order });
  }
  // Nothing locked may disappear by omission either.
  for (const s of base.sections) if ((s.mode === 'computed' || s.mode === 'circuit') && !out.some((o) => o.key === s.key)) return { ok: false, error: 'A section computed by Arche or filled by the circuit cannot be removed' };
  const newTitle = text(raw['new:title']);
  if (newTitle) {
    if (newTitle.length < 2 || newTitle.length > 120) return { ok: false, error: 'Each section needs a title (120 characters at most)' };
    const newHint = text(raw['new:hint']);
    if (newHint.length > 300) return { ok: false, error: 'A hint is 300 characters at most' };
    const mode = text(raw['new:mode']) || 'text';
    if (mode !== 'text' && mode !== 'optional') return { ok: false, error: 'A typed section is required or optional' };
    let n = 1;
    while (byKey.has(`custom_${n}`) || builtIn.has(`custom_${n}`)) n++;
    out.push({ key: `custom_${n}`, title: newTitle, hint: newHint, mode, order: Number.MAX_SAFE_INTEGER });
  }
  if (out.length > 30) return { ok: false, error: 'A dossier has 30 sections at most' };
  if (!out.some((s) => s.mode === 'text')) return { ok: false, error: 'A dossier keeps at least one required typed section' };
  const sections = out.map((s, i) => ({ s, i })).sort((a, b) => a.s.order - b.s.order || a.i - b.i).map(({ s }) => {
    const def: SectionDef = { ...s };
    delete (def as Partial<typeof s>).order;
    return def;
  });
  return { ok: true, value: { sections } };
}

/**
 * A gate's circuit from the designer's form: per row `label:<i>`, `group:<i>` (1 to 9), `kind:<i>`, `actor:<i>` (a profile or
 * `internal_client`), `speciality:<i>` (an expert's), `optional:<i>`, `decides:<i>`, `strategicOnly:<i>`, `remove:<i>`; a new
 * step with the same fields prefixed `new:` (added when it has a label).
 */
export function checkCircuitDesign(gate: GateCode, raw: Record<string, unknown>): Check<CircuitDesign> {
  // One step read through `get(field)`: null when it has no label (an empty new row).
  const read = (get: (field: string) => unknown): Check<StepTemplate> | null => {
    const label = text(get('label'));
    if (!label) return null;
    if (label.length > 120) return { ok: false, error: 'A step label is 120 characters at most' };
    const group = Number(text(get('group')));
    if (!Number.isInteger(group) || group < 1 || group > 9) return { ok: false, error: 'Groups go from 1 to 9' };
    const kind = text(get('kind')) as StepKind;
    if (!STEP_KINDS.includes(kind)) return { ok: false, error: 'Choose the kind of each step' };
    const actor = text(get('actor')) as StepActor;
    if (actor !== 'internal_client' && !isRoleKey(actor)) return { ok: false, error: 'Choose who acts on each step' };
    if (actor === 'admin') return { ok: false, error: 'The administrator acts on no step' };
    const speciality = text(get('speciality'));
    if (kind === 'opinion' && actor !== 'expert') return { ok: false, error: 'An opinion is given by an expert of a speciality' };
    if (actor === 'expert' && !(EXPERT_SPECIALITIES as readonly string[]).includes(speciality)) return { ok: false, error: 'Choose the expert’s speciality' };
    const step: StepTemplate = { group, kind, actor, label };
    if (actor === 'expert') step.speciality = speciality as ExpertSpeciality;
    if (on(get('optional'))) step.optional = true;
    if (on(get('decides'))) step.decides = true;
    if (on(get('strategicOnly'))) step.strategicOnly = true;
    return { ok: true, value: step };
  };
  const steps: StepTemplate[] = [];
  for (const i of rows(raw, 'label')) {
    if (on(raw[`remove:${i}`])) continue;
    const r = read((f) => raw[`${f}:${i}`]);
    if (r && !r.ok) return r;
    if (r) steps.push(r.value);
  }
  const added = read((f) => raw[`new:${f}`]);
  if (added && !added.ok) return added;
  if (added) steps.push(added.value);
  if (!steps.length) return { ok: false, error: 'A circuit has at least one step' };
  if (steps.length > 20) return { ok: false, error: 'A circuit has 20 steps at most' };
  const deciding = steps.filter((s) => s.decides);
  if (deciding.length !== 1) return { ok: false, error: 'A circuit has exactly one deciding step' };
  const d = deciding[0];
  if (!DECIDING_KINDS.includes(d.kind)) return { ok: false, error: 'The deciding step is a decision, a signature, a visa or a countersignature' };
  if (d.optional || d.strategicOnly) return { ok: false, error: 'The deciding step is required for every CAPEX' };
  if (steps.some((s) => s.group > d.group)) return { ok: false, error: 'The deciding step is in the last group' };
  const required = (s: StepTemplate) => !s.optional && !s.strategicOnly;
  if (gate === 'G1' && !steps.some((s) => s.kind === 'visa' && s.actor === 'sponsor' && required(s))) return { ok: false, error: 'The G1 circuit keeps the sponsor’s visa (G1 criterion)' };
  if (gate === 'G3' && !steps.some((s) => s.kind === 'quitus' && s.actor === 'group_hse' && required(s))) return { ok: false, error: 'The G3 circuit keeps the PSSR discharge by the group HSE (G3 criterion)' };
  return { ok: true, value: { steps: steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.group - b.s.group || a.i - b.i).map(({ s }) => s) } };
}
