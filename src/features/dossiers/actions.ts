'use server';
// Living dossiers Server Functions (docs/spec/04): type a section, attach or detach a Codex reference, deposit a file in Codex
// (CX-03), freeze a version and deposit its PDF in Codex. A
// frozen version never changes: editing after freezing starts the next version (draft, content copied) and cancels the gate
// circuit that ran on the previous one (spec 04 §1). The project lead and the sponsor of the CAPEX write (`canDo('edit')`).
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Check } from '@/domain/admin';
import { checkCodexDeposit, checkCodexRef, checkSectionText, completeness, depositSourceRef, DOSSIER_CODEX, DOSSIER_LABEL, emptyContent, isDossierKind, readContent, type DossierContent, type DossierKind, type Sections } from '@/domain/dossiers';
import { recordActivity, writeAudit } from '@/server/db/helpers';
import { circuitSteps, dossierVersions, gates } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { sectionChanged, SECTION_BASE_FIELD, STALE_MSG } from '@/domain/concurrency';
import { auditOf, capexBeforeCall, fieldsOf, onCapex, type ActionResult, type CapexRowFull } from '@/server/capex/write';
import { getDb } from '@/server/db/client';
import { computedFacts, computedSnapshot, dossierVersionsOf, ensureDossier, runningSession, versionHash } from '@/server/dal/dossiers';
import { currentSections, sectionsFor } from '@/server/dal/designs';
import { lookupCodexDocument } from '@/server/integrations/codex';
import { depositToCodex, type CodexDepositFile } from '@/server/integrations/codex/deposit';
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

/** Largest file relayed to Codex (the Server Function body limit, next.config.ts, leaves room for the form). */
const MAX_DEPOSIT_MB = 20;

/** The file of a deposit form, read in memory: relayed to Codex, never stored by Arche (N-17). */
async function uploadOf(fd: FormData, opts: { pdf: boolean }): Promise<Check<CodexDepositFile>> {
  const f = fd.get('file');
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: 'Choose the file to deposit' };
  if (f.size > MAX_DEPOSIT_MB * 1024 * 1024) return { ok: false, error: 'The file is too large (20 MB at most)' };
  if (opts.pdf && f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return { ok: false, error: 'Deposit the PDF of the print view' };
  return { ok: true, value: { name: f.name || 'document', type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) } };
}

/**
 * Deposits a file in Codex from a section (CX-03) and attaches the document created. Codex is called before the write
 * transaction (rights checked first, then again when writing); the same file deposited again from the same section answers
 * the document already created, so a deposit cut off before the reference was attached is completed by trying again.
 */
export async function depositReferenceAction(code: string, kind: string, key: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!isDossierKind(kind)) return BAD_KIND;
  const pre = await capexBeforeCall(code, 'edit');
  if (!pre.ok) return pre;
  // The sections the next write will follow: the draft's template, else the published one (a new draft starts from it).
  const db = await getDb();
  const [latest] = await dossierVersionsOf(db, pre.c.id, kind);
  const preSecs = latest?.state === 'draft' ? await sectionsFor(db, kind, latest.templateVersion) : (await currentSections(db, kind)).sections;
  if (!preSecs.some((s) => s.key === key && s.mode !== 'circuit')) return { ok: false, error: 'Unknown section' };
  const meta = checkCodexDeposit(fieldsOf(fd), { titleRequired: true });
  if (!meta.ok) return meta;
  const file = await uploadOf(fd, { pdf: false });
  if (!file.ok) return file;
  const sha = createHash('sha256').update(file.value.bytes).digest('hex');
  const { c } = pre;
  const r = await depositToCodex({
    meta: { ...meta.value, sourceRef: depositSourceRef(c.code, kind, `${key}/${sha.slice(0, 16)}`), comment: `${c.code} — ${DOSSIER_LABEL[kind]}`, capexCode: c.code },
    file: file.value,
  });
  if (!r.ok) return { ok: false, error: r.message };
  return onCapex(code, 'edit', async (tx, c, v) => {
    const d = await draftOf(tx, c, v, kind);
    const secs = await sectionsFor(tx, kind, d.templateVersion);
    if (!secs.some((s) => s.key === key && s.mode !== 'circuit')) return { ok: false, error: 'Unknown section' };
    const content = readContent(kind, d.content, secs);
    const refs = content.sections[key].refs;
    if (refs.some((x) => x.id === r.id)) return { ok: true };
    refs.push({ id: r.id, revision: null, title: meta.value.title, verified: true });
    await saveContent(tx, c, kind, d.id, content, secs);
    await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]} v${d.number}: ${file.value.name} deposited in Codex as ${r.id} and attached`, { entityType: 'dossier_version', entityId: d.id, after: { codexId: r.id, sha256: sha } }));
    return { ok: true };
  });
}

/**
 * Deposits the PDF of the latest frozen version (its print view) in Codex (CX-03) and records the document on the version.
 * The version stays as frozen — the PDF is its proof in Codex: under legal hold in the CAPEX's context once Codex accepts it
 * (CODEX_CAPEX=on, CX-01 and CX-07), a draft its owner submits until then. Sub-type: the gate's dossier (CX-02).
 */
export async function depositFrozenVersionAction(code: string, kind: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!isDossierKind(kind)) return BAD_KIND;
  const pre = await capexBeforeCall(code, 'edit');
  if (!pre.ok) return pre;
  const { c } = pre;
  const target = (await dossierVersionsOf(await getDb(), c.id, kind)).find((x) => x.state === 'frozen' || x.state === 'approved');
  if (!target) return { ok: false, error: 'There is no frozen version to deposit' };
  if (target.codexDocumentId) return { ok: false, error: 'This version is already deposited in Codex' };
  const meta = checkCodexDeposit(fieldsOf(fd), { titleRequired: false });
  if (!meta.ok) return meta;
  const file = await uploadOf(fd, { pdf: true });
  if (!file.ok) return file;
  const title = meta.value.title || `${c.code} — ${DOSSIER_LABEL[kind]} v${target.number}`;
  const r = await depositToCodex({
    meta: { ...meta.value, subtype: meta.value.subtype ?? DOSSIER_CODEX[kind].subtype, title, sourceRef: depositSourceRef(c.code, kind, `v${target.number}`), comment: `${DOSSIER_LABEL[kind]} v${target.number}, SHA-256 of the content ${target.contentHash ?? '—'}`, capexCode: c.code, legalHold: true },
    file: file.value,
  });
  if (!r.ok) return { ok: false, error: r.message };
  return onCapex(code, 'edit', async (tx, c, v) => {
    const [d] = await tx.select().from(dossierVersions).where(eq(dossierVersions.id, target.id));
    if (!d) return { ok: false, error: 'There is no frozen version to deposit' };
    if (d.codexDocumentId === r.id) return { ok: true };
    await tx.update(dossierVersions).set({ codexDocumentId: r.id, codexDepositedAt: new Date(), codexDepositedByName: v.name, updatedAt: new Date() }).where(eq(dossierVersions.id, d.id));
    await writeAudit(tx, auditOf(v, c, `${DOSSIER_LABEL[kind]} v${d.number}: PDF deposited in Codex as ${r.id}`, { entityType: 'dossier_version', entityId: d.id, after: { codexDocumentId: r.id } }));
    await recordActivity(tx, { actorName: v.name, actorUserId: v.userId, kind: 'dossier.deposited', text: `${c.code}: ${DOSSIER_LABEL[kind]} v${d.number} deposited in Codex (${r.id})`, capexId: c.id });
    return { ok: true };
  });
}
