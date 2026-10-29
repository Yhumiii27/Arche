'use server';
// Living dossiers Server Functions (docs/spec/04): type a section, attach or detach a Codex reference, freeze a version. A
// frozen version never changes: editing after freezing starts the next version (draft, content copied) and cancels the gate
// circuit that ran on the previous one (spec 04 §1). The project lead and the sponsor of the CAPEX write (`canDo('edit')`).
import { and, eq } from 'drizzle-orm';
import { checkCodexRef, checkSectionText, completeness, DOSSIER_LABEL, emptyContent, isDossierKind, readContent, type DossierContent, type DossierKind, type Sections } from '@/domain/dossiers';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { circuitSteps, dossierVersions, gates } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { sectionChanged, SECTION_BASE_FIELD, STALE_MSG } from '@/domain/concurrency';
import { auditOf, fieldsOf, onCapex, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { computedFacts, computedSnapshot, dossierVersionsOf, ensureDossier, runningSession, versionHash } from '@/server/dal/dossiers';
import { currentSections, sectionsFor } from '@/server/dal/designs';
import { lookupCodexDocument } from '@/server/integrations/codex';
import type { Viewer } from '@/server/session';

const BAD_KIND: ActionResult = { ok: false, error: 'Unknown dossier' };

/**
 * The draft of a dossier, created when needed: version 1 empty, or the next version with the content of the latest one. When
 * the latest version is frozen, the circuit running on it is cancelled (gate session returned, steps cancelled) and the
 * version is superseded.
 */
async function draftOf(tx: Tx, c: CapexRowFull, v: Viewer, kind: DossierKind) {
  const versions = await dossierVersionsOf(tx, c.id, kind);
  const latest = versions[0];
  if (latest?.state === 'draft') return latest;
  const dossierId = await ensureDossier(tx, c.id, kind);
  if (latest && latest.state === 'frozen') {
    const session = await runningSession(tx, c.id);
    if (session?.dossierVersionId === latest.id) {
      await tx.update(gates).set({ status: 'returned', updatedAt: new Date() }).where(eq(gates.id, session.id));
      await tx.update(circuitSteps).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(circuitSteps.gateId, session.id), eq(circuitSteps.status, 'open')));
      await tx.update(circuitSteps).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(circuitSteps.gateId, session.id), eq(circuitSteps.status, 'waiting')));
      await writeAudit(tx, auditOf(v, c, `${session.code} session ${session.session}: circuit cancelled (dossier changed after freezing)`, { entityType: 'gate', entityId: session.id }));
    }
    await tx.update(dossierVersions).set({ state: 'superseded', updatedAt: new Date() }).where(eq(dossierVersions.id, latest.id));
  }
  // A new version follows the published template of the dossier (AR-052): the text of the sections it keeps is carried over.
  const tpl = await currentSections(tx, kind);
  const content: DossierContent = latest ? readContent(kind, latest.content, tpl.sections) : emptyContent(kind, tpl.sections);
  const [d] = await tx.insert(dossierVersions).values({ dossierId, number: (latest?.number ?? 0) + 1, state: 'draft', content: content as never, createdByName: v.name, templateVersion: tpl.version }).returning();
  await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]}: version ${d.number} started`, { entityType: 'dossier_version', entityId: d.id }));
  return d;
}

async function saveContent(tx: Tx, c: CapexRowFull, kind: DossierKind, id: string, content: DossierContent, secs: Sections) {
  const pct = completeness(kind, content, await computedFacts(tx, c), secs).pct;
  await tx.update(dossierVersions).set({ content: content as never, completenessPct: pct, updatedAt: new Date() }).where(eq(dossierVersions.id, id));
}

export async function saveSectionAction(code: string, kind: string, key: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!isDossierKind(kind)) return BAD_KIND;
  return onCapex(code, 'edit', async (tx, c, v) => {
    const d = await draftOf(tx, c, v, kind);
    const secs = await sectionsFor(tx, kind, d.templateVersion);
    const ch = checkSectionText(kind, key, fieldsOf(fd).text, secs);
    if (!ch.ok) return ch;
    const content = readContent(kind, d.content, secs);
    if (content.sections[key].text === ch.value) return { ok: true };
    // Optimistic lock at the level of the section (AR-049): several people write a dossier at once, each its own sections;
    // a section changed by someone else since the form was shown is not overwritten.
    if (sectionChanged(fd.get(SECTION_BASE_FIELD), content.sections[key].text)) return { ok: false, error: STALE_MSG };
    content.sections[key].text = ch.value;
    await saveContent(tx, c, kind, d.id, content, secs);
    await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]} v${d.number}: section "${secs.find((s) => s.key === key)!.title}" updated`, { entityType: 'dossier_version', entityId: d.id }));
    return { ok: true };
  });
}

/** Attaches a Codex reference to a section; it is checked against Codex (or the simulation) and kept as typed when not found. */
export async function addReferenceAction(code: string, kind: string, key: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!isDossierKind(kind)) return BAD_KIND;
  return onCapex(code, 'edit', async (tx, c, v) => {
    const ch = checkCodexRef(fieldsOf(fd));
    if (!ch.ok) return ch;
    const found = await lookupCodexDocument(tx, ch.value.id);
    const d = await draftOf(tx, c, v, kind);
    const secs = await sectionsFor(tx, kind, d.templateVersion);
    if (!secs.some((s) => s.key === key && s.mode !== 'circuit')) return { ok: false, error: 'Unknown section' };
    const content = readContent(kind, d.content, secs);
    const refs = content.sections[key].refs;
    if (refs.some((r) => r.id === ch.value.id)) return { ok: false, error: 'This document is already referenced in the section' };
    refs.push({ id: ch.value.id, revision: ch.value.revision ?? (found.found ? found.doc.revision : null), title: found.found ? found.doc.title : null, verified: found.found });
    await saveContent(tx, c, kind, d.id, content, secs);
    await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]} v${d.number}: Codex reference ${ch.value.id} attached${found.found ? '' : ' (not verified)'}`, { entityType: 'dossier_version', entityId: d.id }));
    return { ok: true };
  });
}

export async function removeReferenceAction(code: string, kind: string, key: string, refId: string): Promise<ActionResult> {
  if (!isDossierKind(kind)) return BAD_KIND;
  return onCapex(code, 'edit', async (tx, c, v) => {
    const d = await draftOf(tx, c, v, kind);
    const secs = await sectionsFor(tx, kind, d.templateVersion);
    const content = readContent(kind, d.content, secs);
    const sec = content.sections[key];
    if (!sec || !sec.refs.some((r) => r.id === refId)) return { ok: false, error: 'Unknown reference' };
    sec.refs = sec.refs.filter((r) => r.id !== refId);
    await saveContent(tx, c, kind, d.id, content, secs);
    await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]} v${d.number}: Codex reference ${refId} detached`, { entityType: 'dossier_version', entityId: d.id }));
    return { ok: true };
  });
}

/** Freezes the draft: computed values copied in, completeness fixed, SHA-256 of the canonical content recorded. */
export async function freezeVersionAction(code: string, kind: string): Promise<ActionResult> {
  if (!isDossierKind(kind)) return BAD_KIND;
  return onCapex(code, 'edit', async (tx, c, v) => {
    const [d] = await dossierVersionsOf(tx, c.id, kind);
    if (!d || d.state !== 'draft') return { ok: false, error: 'There is no draft to freeze' };
    const secs = await sectionsFor(tx, kind, d.templateVersion);
    const content = readContent(kind, d.content, secs);
    const pct = completeness(kind, content, await computedFacts(tx, c), secs).pct;
    const computed = await computedSnapshot(tx, c);
    const hash = versionHash(kind, d.number, content, computed);
    await tx.update(dossierVersions).set({
      state: 'frozen', content: content as never, computed: computed as never, completenessPct: pct, contentHash: hash, frozenAt: new Date(), frozenByName: v.name, frozenByUserId: v.userId, updatedAt: new Date(),
    }).where(eq(dossierVersions.id, d.id));
    await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]} v${d.number} frozen (${pct} %, SHA-256 ${hash.slice(0, 12)}…)`, { entityType: 'dossier_version', entityId: d.id, after: { contentHash: hash, completenessPct: pct } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'dossier.frozen', text: `${c.code}: ${DOSSIER_LABEL[kind]} v${d.number} frozen`, capexId: c.id });
    return { ok: true };
  });
}
