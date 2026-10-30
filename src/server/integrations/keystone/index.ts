import 'server-only';
// Keystone connector (docs/spec/07, docs/CONTRATS.md §2.1–2.2): Arche reads Keystone only through its mirror
// (arche.keystone_mirror, written by ./mirror.ts) and links to Keystone's own screens; it never writes to Keystone. The
// readers below turn the rows of the contract (French column names) into the shapes of src/domain/needs.ts.
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import type { Answer, AnswerNature, CatalogueItem } from '@/domain/needs';
import { keystoneMirror, keystoneSync } from '@/server/db/schema';
import type { DB, Tx } from '@/server/db/types';
import type { KeystoneRow, KeystoneViewName } from './views';

type Q = DB | Tx;

const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const date = (v: unknown): string | null => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

async function rowsOf(q: Q, view: KeystoneViewName, where?: ReturnType<typeof and>): Promise<KeystoneRow[]> {
  const rows = await q.select({ data: keystoneMirror.data }).from(keystoneMirror).where(where ? and(eq(keystoneMirror.view, view), where) : eq(keystoneMirror.view, view)).orderBy(asc(keystoneMirror.key));
  return rows.map((r) => r.data);
}

export function toCatalogueItem(r: KeystoneRow): CatalogueItem {
  const opts = Array.isArray(r.options) ? (r.options as KeystoneRow[]) : [];
  return {
    code: String(r.code), version: Number(r.version), typeCode: String(r.type_code ?? ''), typeLabel: String(r.type_libelle ?? r.type_code ?? ''), variant: str(r.variante),
    label: String(r.libelle ?? r.code), description: str(r.description), options: opts.map((o) => ({ code: String(o.code), label: String(o.libelle ?? o.code), priceKeur: num(o.prix_indicatif_keur) })),
    nominalCapacity: num(r.capacite_nominale), capacityUnit: str(r.unite_capacite), priceKeur: num(r.prix_indicatif_keur), leadTimeWeeks: num(r.delai_type_semaines),
    status: r.statut === 'retire' ? 'retire' : 'publie',
  };
}

export function toAnswer(r: KeystoneRow): Answer {
  const cls = r.classe_estimation;
  return {
    needRef: String(r.besoin_ref), capexCode: String(r.capex_code ?? ''), number: String(r.numero ?? ''), nature: (['qualification', 'indicatif', 'devis', 'offre_ferme'].includes(String(r.nature)) ? r.nature : 'qualification') as AnswerNature,
    qualification: str(r.qualification), reason: str(r.motif), estimateClass: cls === 'E50' || cls === 'E30' || cls === 'E10' ? cls : null,
    centralKeur: num(r.montant_central_keur), lowKeur: num(r.montant_bas_keur), highKeur: num(r.montant_haut_keur), leadTimeWeeks: num(r.delai_semaines), validUntil: date(r.valide_jusqu_au),
    documentRef: str(r.document_ref), projectCode: str(r.projet_code), status: String(r.statut ?? ''), answeredAt: String(r.repondu_le ?? ''),
  };
}

/** The catalogue (every version; the published ones are offered). */
export async function catalogue(q: Q): Promise<CatalogueItem[]> {
  return (await rowsOf(q, 'pub_catalogue_machines')).map(toCatalogueItem);
}

/** The answers of EPC2i to the needs of a CAPEX. */
export async function answersOf(q: Q, capexCode: string): Promise<Answer[]> {
  return (await rowsOf(q, 'pub_reponses_besoins', and(eq(keystoneMirror.capexCode, capexCode)))).map(toAnswer);
}

export interface Epc2iProject {
  code: string;
  name: string;
  phase: string | null;
  leadName: string | null;
  needRef: string | null;
  milestones: { code: string; plannedOn: string | null; baselineOn: string | null; actualOn: string | null }[];
  progress: { on: string | null; physicalPct: number | null; spi: number | null; endOn: string | null; contractKeur: number | null; amendmentsKeur: number | null; invoicedKeur: number | null } | null;
  amendments: { number: string; subject: string | null; amountKeur: number | null; delayDays: number | null; status: string; signedOn: string | null }[];
  reserves: { number: string; category: string; origin: string | null; status: string; owner: string | null; openedOn: string | null; clearedOn: string | null }[];
  deliverables: { number: string; title: string; status: string; type: string | null; acceptedOn: string | null }[];
  /** EPC2i's part of the engineering pack, by family (pub_pack_ingenierie). */
  pack: { family: string; expected: number; validated: number; weight: number }[];
  /** Machines of the installed base delivered by the project (pub_parc_machines, distinct numbers). */
  machines: { number: string; name: string; deliveredOn: string | null }[];
}

const MILESTONE_ORDER = ['commande', 'fin_etudes', 'fat', 'expedition', 'arrivee_site', 'sat', 'pv_reception', 'fin_garantie'];

/**
 * The EPC2i projects of a CAPEX: those Keystone links to it (pub_projets.capex_code, K-05) and those named by an answer
 * to one of its needs (pub_reponses_besoins.projet_code), with their follow-up.
 */
export async function projectsOf(q: Q, capexCode: string): Promise<Epc2iProject[]> {
  return (await projectsOfMany(q, [capexCode])).get(capexCode) ?? [];
}

/** projectsOf for several CAPEX in three reads (portfolio views, AR-049). */
export async function projectsOfMany(q: Q, capexCodes: readonly string[]): Promise<Map<string, Epc2iProject[]>> {
  const out = new Map<string, Epc2iProject[]>(capexCodes.map((c) => [c, []]));
  if (!capexCodes.length) return out;
  const answers = (await rowsOf(q, 'pub_reponses_besoins', and(inArray(keystoneMirror.capexCode, [...capexCodes])))).map(toAnswer);
  const named = [...new Set(answers.map((a) => a.projectCode).filter((x): x is string => !!x))];
  const byCapex = inArray(keystoneMirror.capexCode, [...capexCodes]);
  const projects = await rowsOf(q, 'pub_projets', named.length ? or(byCapex, inArray(keystoneMirror.projectCode, named)) : byCapex);
  const all = [...new Set([...named, ...projects.map((p) => String(p.code))])];
  if (!all.length) return out;
  const sub = await q.select({ view: keystoneMirror.view, project: keystoneMirror.projectCode, data: keystoneMirror.data }).from(keystoneMirror)
    .where(and(inArray(keystoneMirror.view, ['pub_jalons_projets', 'pub_avancement_projets', 'pub_avenants', 'pub_reserves', 'pub_livrables', 'pub_pack_ingenierie', 'pub_parc_machines']), inArray(keystoneMirror.projectCode, all))).orderBy(asc(keystoneMirror.key));
  const of = (view: string, code: string) => sub.filter((r) => r.view === view && r.project === code).map((r) => r.data);
  const build = (code: string, mine: Answer[]): Epc2iProject => {
    const p = projects.find((x) => x.code === code);
    const prog = of('pub_avancement_projets', code)[0];
    return {
      code, name: String(p?.nom ?? code), phase: str(p?.phase), leadName: str(p?.chef_projet_nom), needRef: str(p?.besoin_ref) ?? mine.find((a) => a.projectCode === code)?.needRef ?? null,
      milestones: of('pub_jalons_projets', code).map((m) => ({ code: String(m.jalon_code), plannedOn: date(m.prevu_le), baselineOn: date(m.reference_le), actualOn: date(m.reel_le) }))
        .sort((a, b) => MILESTONE_ORDER.indexOf(a.code) - MILESTONE_ORDER.indexOf(b.code)),
      progress: prog ? {
        on: date(prog.date_situation), physicalPct: num(prog.avancement_physique_pct), spi: num(prog.spi), endOn: date(prog.fin_prevue_le), contractKeur: num(prog.montant_contrat_keur),
        amendmentsKeur: num(prog.montant_avenants_keur), invoicedKeur: num(prog.facture_keur),
      } : null,
      amendments: of('pub_avenants', code).map((a) => ({ number: String(a.numero), subject: str(a.objet), amountKeur: num(a.montant_keur), delayDays: num(a.delai_jours), status: String(a.statut ?? ''), signedOn: date(a.signe_le) })),
      reserves: of('pub_reserves', code).map((r) => ({ number: String(r.numero), category: String(r.categorie ?? ''), origin: str(r.origine), status: String(r.statut ?? ''), owner: str(r.responsable), openedOn: date(r.ouverte_le), clearedOn: date(r.levee_le) })),
      deliverables: of('pub_livrables', code).map((d) => ({ number: String(d.number), title: String(d.title ?? ''), status: String(d.status ?? ''), type: str(d.type), acceptedOn: date(d.accepte_le) })),
      machines: [...new Map(of('pub_parc_machines', code).map((m) => [String(m.number), { number: String(m.number), name: String(m.name ?? m.number), deliveredOn: date(m.livree_le) }])).values()],
      pack: of('pub_pack_ingenierie', code).map((f) => ({ family: String(f.famille ?? ''), expected: num(f.attendues) ?? 0, validated: num(f.validees) ?? 0, weight: num(f.poids) ?? 0 })),
    };
  };
  for (const capexCode of capexCodes) {
    const mine = answers.filter((a) => a.capexCode === capexCode);
    const codes = [...new Set([...mine.map((a) => a.projectCode).filter((x): x is string => !!x), ...projects.filter((p) => p.capex_code === capexCode).map((p) => String(p.code))])].sort();
    out.set(capexCode, codes.map((code) => build(code, mine)));
  }
  return out;
}

/** State of the last synchronisation of each view. */
export async function syncState(q: Q) {
  return q.select().from(keystoneSync).orderBy(asc(keystoneSync.view));
}

/**
 * Deep link to a project in Keystone: its Contract page, which shows the CAPEX the project delivers (Keystone has no page at
 * /projects/<code> itself); null without NEXT_PUBLIC_KEYSTONE_URL.
 */
export function keystoneProjectUrl(code: string): string | null {
  const base = process.env.NEXT_PUBLIC_KEYSTONE_URL;
  return base ? `${base.replace(/\/+$/, '')}/projects/${encodeURIComponent(code)}/contract` : null;
}

/** Deep link to Keystone's machine catalogue; null without NEXT_PUBLIC_KEYSTONE_URL. */
export function keystoneCatalogueUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_KEYSTONE_URL;
  return base ? `${base.replace(/\/+$/, '')}/catalogue/machines` : null;
}

export { syncKeystone } from './mirror';
