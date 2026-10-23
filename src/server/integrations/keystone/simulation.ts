// Simulation of Keystone (docs/spec/07 §2), for the demonstration data set while Keystone does not share a view yet. Pure and
// deterministic: from the needs Arche publishes (pub_besoins_machines) and the instant, it gives what EPC2i would answer — a
// qualification two hours after the submission, an indicative answer (E50) the next day, a budgetary quote (E30) after 30
// days and a firm offer (E10) after 60 — and, for a need ordered at the G2, the EPC2i project with its milestones, progress,
// amendments, reservations, deliverables, EPC2i's part of the engineering pack and, once delivered on site, the machines of
// the installed base. Rows have the columns of the contract (French names, ISO dates).
import { rangeOf, round1 } from '@/domain/budget';
import type { KeystoneRow, KeystoneViewName } from './views';

/** A row of arche.pub_besoins_machines, as the simulation reads it. */
export interface PublishedNeed {
  besoin_ref: string;
  capex_code: string;
  ligne: string;
  catalogue_code: string | null;
  catalogue_version: number | null;
  libelle_libre: string | null;
  quantite: number;
  options: string[];
  site: string | null;
  statut: 'submitted' | 'withdrawn' | 'ordered';
  soumis_le: string | null;
  commande_le: string | null;
  maj_le: string;
}

const T0 = '2026-01-05T08:00:00.000Z';

/** The simulated catalogue of EPC2i (one retired sheet, to show that it is not offered). */
export const SIMULATED_CATALOGUE: readonly KeystoneRow[] = [
  {
    code: 'EXT-9MN', version: 3, type_code: 'EXT', type_libelle: 'Extrusion press', variante: '9 MN', libelle: 'Aluminium extrusion press 9 MN',
    description: 'Press, billet heater, run-out table and stretcher.', capacite_nominale: 1.8, unite_capacite: 't/h', prix_indicatif_keur: 4200, delai_type_semaines: 40, statut: 'publie',
    options: [{ code: 'PULLER', libelle: 'Double puller', prix_indicatif_keur: 180 }, { code: 'QUENCH', libelle: 'Water quench', prix_indicatif_keur: 120 }], maj_le: T0,
  },
  {
    code: 'EXT-AGE', version: 1, type_code: 'EXT', type_libelle: 'Extrusion press', variante: 'Oven', libelle: 'Ageing oven 2 × 6 m',
    description: 'Gas-fired ageing oven with loading trolleys.', capacite_nominale: 2, unite_capacite: 't/h', prix_indicatif_keur: 650, delai_type_semaines: 26, statut: 'publie', options: [], maj_le: T0,
  },
  {
    code: 'PRC-TOM', version: 2, type_code: 'PRC', type_libelle: 'Processing line', variante: '40 t/h', libelle: 'Tomato paste line 40 t/h',
    description: 'Reception, washing, hot break, refining and concentration.', capacite_nominale: 40, unite_capacite: 't/h', prix_indicatif_keur: 6800, delai_type_semaines: 52, statut: 'publie',
    options: [{ code: 'EVAP3', libelle: 'Triple-effect evaporator', prix_indicatif_keur: 900 }, { code: 'ASEPT', libelle: 'Aseptic filler', prix_indicatif_keur: 750 }], maj_le: T0,
  },
  {
    code: 'PRC-CAN', version: 1, type_code: 'PRC', type_libelle: 'Processing line', variante: '300/min', libelle: 'Canning line 300 cans/min',
    description: 'Filler, seamer, sterilizer and labeller.', capacite_nominale: 300, unite_capacite: 'cans/min', prix_indicatif_keur: 2100, delai_type_semaines: 36, statut: 'publie', options: [], maj_le: T0,
  },
  {
    code: 'CON-BLT', version: 1, type_code: 'CON', type_libelle: 'Conveying', variante: '20 m', libelle: 'Belt conveyor 20 m',
    description: 'Replaced by the modular range.', capacite_nominale: null, unite_capacite: null, prix_indicatif_keur: 90, delai_type_semaines: 12, statut: 'retire', options: [], maj_le: T0,
  },
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const iso = (t: number) => new Date(t).toISOString();
const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayStart = (d: string) => Date.parse(`${d}T08:00:00.000Z`);

/** "CPX-SAI-2026-01/B01" → "SAI-26011": a project code in Keystone's form (3 letters, digits). */
export function simulatedProjectCode(ref: string): string {
  const m = /^CPX-([A-Z]{3})-\d{2}(\d{2})-(\d{2})\/B(\d{2})$/.exec(ref);
  return m ? `${m[1]}-${m[2]}${m[3]}${Number(m[4])}` : `EPC-${ref.replace(/\W/g, '').slice(-6)}`;
}

/** A machine number in Keystone's form ("MCH-417"), deterministic from the project code and the machine's rank. */
export function simulatedMachineNumber(project: string, rank: number): string {
  const h = [...project].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 900, 7);
  return `MCH-${String(100 + ((h + rank) % 900)).padStart(3, '0')}`;
}

function priceOf(n: PublishedNeed): { keur: number | null; weeks: number; label: string } {
  const sheet = SIMULATED_CATALOGUE.find((c) => c.code === n.catalogue_code && c.version === n.catalogue_version);
  if (!sheet) return { keur: null, weeks: 30, label: n.libelle_libre ?? n.ligne };
  const opts = (sheet.options as { code: string; prix_indicatif_keur: number }[]).filter((o) => n.options.includes(o.code)).reduce((a, o) => a + o.prix_indicatif_keur, 0);
  return { keur: ((sheet.prix_indicatif_keur as number) + opts) * n.quantite, weeks: sheet.delai_type_semaines as number, label: sheet.libelle as string };
}

/** Families of EPC2i's pack and their expected items (pub_pack_ingenierie). */
const PACK_FAMILIES_EPC2I: readonly (readonly [string, number])[] = [['pid', 6], ['bom', 4], ['layout', 3], ['electrique', 5], ['analyse_fonctionnelle', 2]];

const MILESTONES: [string, number][] = [['commande', 0], ['fin_etudes', 0.25], ['fat', 0.7], ['expedition', 0.75], ['arrivee_site', 0.85], ['sat', 1]];

/** Every simulated view, from the published needs and the instant `now`. */
export function simulateKeystone(needs: readonly PublishedNeed[], now: Date): Record<KeystoneViewName, KeystoneRow[]> {
  const t = now.getTime();
  const out: Record<KeystoneViewName, KeystoneRow[]> = {
    pub_catalogue_machines: [...SIMULATED_CATALOGUE], pub_reponses_besoins: [], pub_projets: [], pub_jalons_projets: [], pub_avancement_projets: [], pub_avenants: [], pub_reserves: [], pub_livrables: [], pub_pack_ingenierie: [], pub_parc_machines: [],
  };
  for (const n of needs) {
    if (!n.soumis_le) continue;
    const s0 = Date.parse(n.soumis_le);
    const stop = n.statut === 'withdrawn' ? Math.min(t, Date.parse(n.maj_le)) : t;
    const { keur, weeks, label } = priceOf(n);
    const short = n.besoin_ref.replace(/^CPX-/, '');
    let seq = 0;
    const answer = (at: number, a: Partial<KeystoneRow>) => {
      if (at > stop) return;
      seq += 1;
      out.pub_reponses_besoins.push({
        besoin_ref: n.besoin_ref, capex_code: n.capex_code, numero: `REP-${short}-${seq}`, nature: 'qualification', qualification: null, motif: null, classe_estimation: null,
        montant_central_keur: null, montant_bas_keur: null, montant_haut_keur: null, delai_semaines: null, valide_jusqu_au: null, document_ref: null, projet_code: null,
        statut: 'remise', repondu_le: iso(at), maj_le: iso(at), ...a,
      });
    };
    const priced = (cls: 'E50' | 'E30' | 'E10', central: number) => ({ classe_estimation: cls, montant_central_keur: round1(central), montant_bas_keur: rangeOf(central, cls).low, montant_haut_keur: rangeOf(central, cls).high, delai_semaines: weeks });
    if (keur == null) {
      answer(s0 + 10 * MINUTE, { qualification: 'a_etudier', motif: 'Need to be specified with the process team of the subsidiary' });
      continue;
    }
    answer(s0 + 10 * MINUTE, { qualification: 'faisable' });
    answer(s0 + DAY, { nature: 'indicatif', ...priced('E50', keur) });
    const docRef = (k: string) => `${k}-${n.capex_code}-${n.ligne}`;
    answer(s0 + 30 * DAY, { nature: 'devis', ...priced('E30', keur * 1.04), valide_jusqu_au: day(s0 + 90 * DAY), document_ref: docRef('DEV') });
    const offerAt = n.commande_le ? Math.min(s0 + 60 * DAY, dayStart(n.commande_le) - 7 * DAY) : s0 + 60 * DAY;
    answer(Math.max(offerAt, s0 + 3 * DAY), { nature: 'offre_ferme', ...priced('E10', keur * 1.02), valide_jusqu_au: day(offerAt + 120 * DAY), document_ref: docRef('OFF') });
    if (n.statut !== 'ordered' || !n.commande_le) continue;

    // Ordered at the G2: the offer is accepted and EPC2i opens the project.
    const o = dayStart(n.commande_le);
    const contract = round1(keur * 1.02);
    const project = simulatedProjectCode(n.besoin_ref);
    answer(o, { nature: 'offre_ferme', ...priced('E10', keur * 1.02), valide_jusqu_au: day(offerAt + 120 * DAY), document_ref: docRef('OFF'), projet_code: project, statut: 'acceptee' });
    if (o > t) continue;
    const span = weeks * WEEK;
    const ref = (k: number) => o + Math.round(k * span / DAY) * DAY;
    const slip = (code: string) => (code === 'commande' || code === 'fin_etudes' ? 0 : 2 * WEEK);
    const ms = [...MILESTONES, ['pv_reception', 1 + (2 * WEEK) / span] as [string, number], ['fin_garantie', 1 + (54 * WEEK) / span] as [string, number]].map(([code, k]) => {
      const planned = ref(k) + slip(code);
      return { code, baseline: ref(k), planned, actual: planned <= t ? planned : null };
    });
    const passed = (code: string) => ms.find((m) => m.code === code)!.actual != null;
    const step = passed('pv_reception') ? ['warranty', 'Warranty'] : passed('sat') ? ['commissioning', 'Commissioning'] : passed('expedition') ? ['installation', 'Installation'] : passed('fin_etudes') ? ['manufacturing', 'Manufacturing'] : ['engineering', 'Engineering'];
    out.pub_projets.push({
      code: project, numero: project, nom: label, client: n.capex_code.slice(4, 7), phase_code: step[0], phase: step[1], chef_projet_matricule: 'E2I-0412', chef_projet_nom: 'Marc Delorme',
      ville: n.site, maj_le: iso(o), capex_code: n.capex_code, besoin_ref: n.besoin_ref,
    });
    for (const m of ms) out.pub_jalons_projets.push({ projet_code: project, jalon_code: m.code, prevu_le: day(m.planned), reference_le: day(m.baseline), reel_le: m.actual != null ? day(m.actual) : null, maj_le: iso(Math.min(t, m.actual ?? o)) });
    const end = ms.find((m) => m.code === 'pv_reception')!.planned;
    const pct = Math.max(0, Math.min(100, Math.round(((t - o) / (end - o)) * 100)));
    const amendments: KeystoneRow[] = [];
    if (t >= o + 8 * WEEK) amendments.push({ projet_code: project, numero: 'AV-01', objet: 'Additional sorting table', montant_keur: 85, delai_jours: 14, statut: 'signe', signe_le: day(o + 8 * WEEK), maj_le: iso(o + 8 * WEEK) });
    if (t >= o + 14 * WEEK) amendments.push({ projet_code: project, numero: 'AV-02', objet: 'Spare parts package', montant_keur: 40, delai_jours: 0, statut: 'propose', signe_le: null, maj_le: iso(o + 14 * WEEK) });
    out.pub_avenants.push(...amendments);
    const signed = amendments.filter((a) => a.statut === 'signe').reduce((a, x) => a + (x.montant_keur as number), 0);
    out.pub_avancement_projets.push({
      projet_code: project, date_situation: day(t), avancement_physique_pct: pct, spi: 0.95, fin_prevue_le: day(end), montant_contrat_keur: contract, montant_avenants_keur: signed,
      facture_keur: round1(contract * (0.3 + (0.6 * pct) / 100)), maj_le: iso(t),
    });
    const fat = ms.find((m) => m.code === 'fat')!;
    const sat = ms.find((m) => m.code === 'sat')!;
    if (fat.actual != null) {
      out.pub_reserves.push({ projet_code: project, numero: 'RES-01', categorie: 'B', origine: 'itp', statut: sat.actual != null ? 'closed' : 'in_progress', responsable: 'keystone', ouverte_le: day(fat.actual), levee_le: sat.actual != null ? day(sat.actual) : null, maj_le: iso(sat.actual ?? fat.actual) });
      out.pub_livrables.push({ project_code: project, number: 'LIV-01', title: 'FAT report', status: 'accepted', type: 'report', accepte_le: day(fat.actual), maj_le: iso(fat.actual) });
    }
    if (sat.actual != null) out.pub_reserves.push({ projet_code: project, numero: 'RES-02', categorie: 'C', origine: 'site', statut: 'open', responsable: 'keystone', ouverte_le: day(sat.actual), levee_le: null, maj_le: iso(sat.actual) });
    // EPC2i's part of the pack: five families of equal weight, validated as the studies progress (complete at the end of studies).
    const studies = ms.find((m) => m.code === 'fin_etudes')!;
    const studied = Math.max(0, Math.min(1, (t - o) / Math.max(DAY, studies.planned - o)));
    const pack = PACK_FAMILIES_EPC2I.map(([famille, attendues]) => ({ famille, attendues, validees: Math.floor(attendues * Math.min(1, 0.6 + 0.4 * studied)) }));
    const pondere = Math.round((pack.reduce((a, f) => a + (20 * f.validees) / f.attendues, 0) / (20 * pack.length)) * 1000) / 10;
    for (const f of pack) out.pub_pack_ingenierie.push({ projet_code: project, ...f, poids: 20, pct_pondere: pondere, maj_le: iso(t) });
    // Once on site, the machines join the installed base (pub_parc_machines, one row per machine: no fitted part here).
    const arrived = ms.find((m) => m.code === 'arrivee_site')!;
    if (arrived.actual != null) {
      for (let k = 0; k < n.quantite; k++) {
        out.pub_parc_machines.push({
          number: simulatedMachineNumber(project, k), name: label, client_name: n.capex_code.slice(4, 7), site_text: n.site, project_code: project, warranty_status: 'in_progress', part_ref: null,
          fitted_revision: null, type_machine_code: n.catalogue_code?.split('-')[0] ?? null, livree_le: day(arrived.actual), maj_le: iso(arrived.actual),
        });
      }
    }
    const pv = ms.find((m) => m.code === 'pv_reception')!;
    out.pub_livrables.push({ project_code: project, number: 'LIV-02', title: 'Client acceptance report', status: pv.actual != null ? 'accepted' : 'planned', type: 'client_acceptance', accepte_le: pv.actual != null ? day(pv.actual) : null, maj_le: iso(pv.actual ?? o) });
  }
  return out;
}
