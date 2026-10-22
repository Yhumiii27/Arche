// Machine needs (docs/spec/07): Arche owns the demand, Keystone the catalogue and the answer. A need line is a machine of
// the EPC2i catalogue (code and version kept) or a free need; draft → submitted (published to Keystone in
// pub_besoins_machines) → withdrawn, or ordered at the G2 Go when it has a valid firm offer. Pure: checks, refs, the latest
// answer, the criteria facts. EN strings.
import type { Check } from './admin';
import { parseKeur } from './budget';

export type NeedStatus = 'draft' | 'submitted' | 'withdrawn' | 'ordered';
export const NEED_STATUS_LABEL: Record<NeedStatus, string> = { draft: 'Draft', submitted: 'Submitted', withdrawn: 'Withdrawn', ordered: 'Ordered' };

/** "CPX-APM-2026-01/B03" (N-9). */
export const needLine = (n: number) => `B${String(n).padStart(2, '0')}`;
export const needRef = (capexCode: string, n: number) => `${capexCode}/${needLine(n)}`;

/** A catalogue sheet as Keystone publishes it (pub_catalogue_machines). */
export interface CatalogueItem {
  code: string;
  version: number;
  typeCode: string;
  typeLabel: string;
  variant: string | null;
  label: string;
  description: string | null;
  options: { code: string; label: string; priceKeur: number | null }[];
  nominalCapacity: number | null;
  capacityUnit: string | null;
  priceKeur: number | null;
  leadTimeWeeks: number | null;
  status: 'publie' | 'retire';
}

export interface NeedInput {
  catalogueCode: string | null;
  catalogueVersion: number | null;
  freeLabel: string | null;
  quantity: number;
  options: string[];
  targetCapacity: number | null;
  capacityUnit: string | null;
  needDate: string | null;
  comment: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A need line typed by the project lead: a published catalogue sheet (`catalogue` = "CODE@version") with options of that
 * sheet, or a free need (text); a quantity from 1 to 99; an optional target capacity and need date.
 */
export function checkNeed(raw: Record<string, unknown>, catalogue: readonly CatalogueItem[], optionCodes: readonly string[]): Check<NeedInput> {
  const sel = String(raw.catalogue ?? '').trim();
  const free = String(raw.freeLabel ?? '').trim();
  let item: CatalogueItem | null = null;
  if (sel) {
    const [code, v] = sel.split('@');
    item = catalogue.find((c) => c.code === code && String(c.version) === v && c.status === 'publie') ?? null;
    if (!item) return { ok: false, error: 'Choose a machine of the catalogue' };
  } else if (free.length < 3) return { ok: false, error: 'Choose a machine of the catalogue or describe the need' };
  const quantity = Number(String(raw.quantity ?? '1').trim());
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { ok: false, error: 'The quantity goes from 1 to 99' };
  const options = item ? optionCodes.filter((o) => item!.options.some((x) => x.code === o)) : [];
  const cap = String(raw.targetCapacity ?? '').trim();
  const targetCapacity = cap ? parseKeur(cap) : null;
  if (cap && targetCapacity == null) return { ok: false, error: 'Enter the target capacity as a number' };
  const needDate = String(raw.needDate ?? '').trim() || null;
  if (needDate && !ISO.test(needDate)) return { ok: false, error: 'Enter a valid date' };
  return {
    ok: true,
    value: {
      catalogueCode: item?.code ?? null, catalogueVersion: item?.version ?? null, freeLabel: item ? null : free.slice(0, 300), quantity, options,
      targetCapacity, capacityUnit: targetCapacity != null ? (item?.capacityUnit ?? (String(raw.capacityUnit ?? '').trim().slice(0, 20) || null)) : null,
      needDate, comment: String(raw.comment ?? '').trim().slice(0, 2000) || null,
    },
  };
}

/** Submission and withdrawal: submitted in phases 1 and 2 only (spec 01 §3); withdrawn while not ordered. */
export function canSubmitNeeds(c: { status: string; phase: string }): boolean {
  return c.status === 'active' && (c.phase === 'cadrage' || c.phase === 'avant_projet');
}

// ── Answers of EPC2i (pub_reponses_besoins) ───────────────────────────────────────────────────────────────────────────

export type AnswerNature = 'qualification' | 'indicatif' | 'devis' | 'offre_ferme';
export const ANSWER_NATURE_LABEL: Record<AnswerNature, string> = { qualification: 'Qualification', indicatif: 'Indicative answer', devis: 'Budgetary quote', offre_ferme: 'Firm offer' };
export const QUALIFICATION_LABEL: Record<string, string> = { faisable: 'Feasible', a_etudier: 'To be studied', refuse: 'Refused' };

export interface Answer {
  needRef: string;
  capexCode: string;
  number: string;
  nature: AnswerNature;
  qualification: string | null;
  reason: string | null;
  estimateClass: 'E50' | 'E30' | 'E10' | null;
  centralKeur: number | null;
  lowKeur: number | null;
  highKeur: number | null;
  leadTimeWeeks: number | null;
  validUntil: string | null;
  documentRef: string | null;
  projectCode: string | null;
  status: string;
  answeredAt: string;
}

/** The answer that is authoritative: the latest one (spec 07 §1). */
export function latestAnswer(answers: readonly Answer[], ref: string): Answer | null {
  return answers.filter((a) => a.needRef === ref).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))[0] ?? null;
}

/** A firm offer (E10) still valid on `today`. */
export const isValidFirmOffer = (a: Answer | null, today: string) => !!a && a.nature === 'offre_ferme' && a.estimateClass === 'E10' && a.status !== 'caduque' && (!a.validUntil || a.validUntil >= today);

/** G2 criterion "firm EPC2i offers for every submitted need" (spec 03 §3): met when there is none to cover. */
export function firmOffersFact(needs: readonly { ref: string; status: string }[], answers: readonly Answer[], today: string): { met: boolean; value: string } {
  const live = needs.filter((n) => n.status === 'submitted');
  const covered = live.filter((n) => isValidFirmOffer(latestAnswer(answers, n.ref), today)).length;
  return { met: covered === live.length, value: `${covered} / ${live.length}` };
}

// ── Follow-up of the EPC2i projects ───────────────────────────────────────────────────────────────────────────────────

export const MILESTONE_LABEL: Record<string, string> = {
  commande: 'Order', fin_etudes: 'End of studies', fat: 'FAT', expedition: 'Shipping', arrivee_site: 'Arrival on site', sat: 'SAT', pv_reception: 'Acceptance report', fin_garantie: 'End of warranty',
};

/** K3 criterion "EPC2i SATs planned": every linked project has a planned SAT. */
export function satPlannedFact(projects: readonly string[], milestones: readonly { projectCode: string; code: string; plannedOn: string | null }[]): { met: boolean; value: string } {
  const ok = projects.filter((p) => milestones.some((m) => m.projectCode === p && m.code === 'sat' && m.plannedOn)).length;
  return { met: ok === projects.length, value: `${ok} / ${projects.length}` };
}

/** G3 criterion part "EPC2i reservations": no open A or B reservation on the linked projects, every acceptance report accepted. */
export function epc2iReservationsFact(
  reserves: readonly { category: string; status: string }[],
  reports: readonly { status: string }[],
): { met: boolean; value: string } {
  const open = reserves.filter((r) => (r.category === 'A' || r.category === 'B') && r.status !== 'closed').length;
  const pending = reports.filter((d) => d.status !== 'accepted').length;
  return { met: open === 0 && pending === 0, value: `${open} A/B · ${pending} PV` };
}
