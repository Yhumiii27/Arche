// Keystone's demonstration data that concerns Arche (owner's pilot feedback, 25 Oct 2026: "align every link" with Keystone's
// fictitious projects): the rows its share views return on its demo database (Keystone origin/main 4af0f31, demo seed, clock
// 25 Sep 2026) — the machine catalogue, its five answers to the needs of CPX-APM-2026-01 and CPX-SAI-2026-01, and RCF-019, the
// EPC2i project that delivers CPX-SAI-2026-01/B01. Exported read-only from the views (contract column order); `maj_le` stamps of
// rows computed at read time are set to the demo day and the client's database id is left out. The simulation returns these rows
// as they are for the needs Keystone knows, and generates the others (src/server/integrations/keystone/simulation.ts).
import type { KeystoneRow, KeystoneViewName } from './views';

export const KEYSTONE_DEMO: Partial<Record<KeystoneViewName, readonly KeystoneRow[]>> = {
  pub_catalogue_machines: [
    { code: 'EMP-40T', version: 1, type_code: 'EMP', type_libelle: 'EMP', variante: 'Quai 40 t', libelle: 'Portique de manutention 40 t', description: 'Portique sur rails pour quai portuaire, levage 40 t, portée 30 m, pilotage cabine.', options: [{ code: 'TELE', libelle: 'Télécommande radio', prix_indicatif_keur: 18 }, { code: 'ANTI-COL', libelle: 'Anticollision laser', prix_indicatif_keur: 45 }], capacite_nominale: 40, unite_capacite: 't', prix_indicatif_keur: 4200, delai_type_semaines: 52, statut: 'publie', maj_le: '2026-05-28T08:00:00+00:00' },
    { code: 'MEMU-16', version: 1, type_code: 'MEMU', type_libelle: 'MEMU', variante: 'Unité mobile 16 t/h', libelle: 'Unité mobile de fabrication 16 t/h', description: 'Unité mobile de fabrication sur conteneurs, 16 t/h, mise en service sur site en 4 semaines.', options: [{ code: 'GEN', libelle: 'Groupe électrogène embarqué', prix_indicatif_keur: 95 }], capacite_nominale: 16, unite_capacite: 't/h', prix_indicatif_keur: 1850, delai_type_semaines: 36, statut: 'publie', maj_le: '2026-06-27T08:00:00+00:00' },
    { code: 'SPUR-2X', version: 1, type_code: 'SPUR', type_libelle: 'SPUR', variante: null, libelle: 'Unité de purification double ligne', description: 'Remplacée par une offre sur mesure.', options: [], capacite_nominale: null, unite_capacite: null, prix_indicatif_keur: 2600, delai_type_semaines: 40, statut: 'retire', maj_le: '2026-07-27T08:00:00+00:00' },
  ],
  pub_reponses_besoins: [
    { besoin_ref: 'CPX-SAI-2026-01/B02', capex_code: 'CPX-SAI-2026-01', numero: 'RB-001', nature: 'qualification', qualification: 'a_etudier', motif: 'Version SPUR-2X en fin de vie : variante sur mesure à étudier avec le lot utilités', classe_estimation: null, montant_central_keur: null, montant_bas_keur: null, montant_haut_keur: null, delai_semaines: null, valide_jusqu_au: null, document_ref: null, projet_code: null, statut: 'remise', repondu_le: '2026-04-20T09:00:00+00:00', maj_le: '2026-04-20T09:00:00+00:00' },
    { besoin_ref: 'CPX-SAI-2026-01/B03', capex_code: 'CPX-SAI-2026-01', numero: 'RB-002', nature: 'offre_ferme', qualification: 'faisable', motif: null, classe_estimation: 'E10', montant_central_keur: 8436, montant_bas_keur: 8014.2, montant_haut_keur: 9279.6, delai_semaines: 52, valide_jusqu_au: '2026-12-31', document_ref: 'OFF-CPX-SAI-2026-01-002', projet_code: null, statut: 'acceptee', repondu_le: '2026-06-20T09:00:00+00:00', maj_le: '2026-06-20T09:00:00+00:00' },
    { besoin_ref: 'CPX-SAI-2026-01/B01', capex_code: 'CPX-SAI-2026-01', numero: 'RB-003', nature: 'offre_ferme', qualification: 'faisable', motif: null, classe_estimation: 'E10', montant_central_keur: 1945, montant_bas_keur: 1847.8, montant_haut_keur: 2139.5, delai_semaines: 36, valide_jusqu_au: '2026-12-31', document_ref: 'OFF-CPX-SAI-2026-01-001', projet_code: 'RCF-019', statut: 'acceptee', repondu_le: '2026-07-02T09:00:00+00:00', maj_le: '2026-07-02T09:00:00+00:00' },
    { besoin_ref: 'CPX-APM-2026-01/B01', capex_code: 'CPX-APM-2026-01', numero: 'RB-004', nature: 'indicatif', qualification: 'faisable', motif: null, classe_estimation: 'E50', montant_central_keur: 4218, montant_bas_keur: 2109, montant_haut_keur: 6327, delai_semaines: 52, valide_jusqu_au: null, document_ref: null, projet_code: null, statut: 'remise', repondu_le: '2026-09-10T09:00:00+00:00', maj_le: '2026-09-10T09:00:00+00:00' },
    { besoin_ref: 'CPX-APM-2026-01/B01', capex_code: 'CPX-APM-2026-01', numero: 'RB-005', nature: 'devis', qualification: 'faisable', motif: null, classe_estimation: 'E30', montant_central_keur: 4150, montant_bas_keur: 2905, montant_haut_keur: 5395, delai_semaines: 50, valide_jusqu_au: '2027-01-31', document_ref: 'DEV-CPX-APM-2026-01-001', projet_code: null, statut: 'remise', repondu_le: '2026-09-24T09:00:00+00:00', maj_le: '2026-09-24T09:00:00+00:00' },
  ],
  pub_projets: [
    { code: 'RCF-019', numero: '#019', code_analytique: 'CPL002', nature: 'client', nom: 'Clinique Pasteur Lyon Fit-out', client_id: null, client: 'Health trust', client_code3: 'CPL', phase_code: 'chantier', phase: 'Chantier', imputable: true, chef_projet_matricule: null, chef_projet_nom: 'C. Moreau', ville: 'Lyon', pays: 'France', fournisseurs: 'Cotswold Fire Systems · Meridian Medical Interiors', maj_le: '2026-09-25T06:00:00.000Z', capex_code: 'CPX-SAI-2026-01', besoin_ref: 'CPX-SAI-2026-01/B01', client_interne: false, filiale_code: null },
  ],
  pub_jalons_projets: [
    { projet_code: 'RCF-019', jalon_code: 'commande', prevu_le: '2026-05-04', reference_le: null, reel_le: '2026-05-04', maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'fin_etudes', prevu_le: '2026-06-01', reference_le: null, reel_le: '2026-06-01', maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'fat', prevu_le: '2026-08-24', reference_le: null, reel_le: '2026-08-24', maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'expedition', prevu_le: '2026-08-24', reference_le: null, reel_le: '2026-08-24', maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'arrivee_site', prevu_le: '2026-09-07', reference_le: null, reel_le: '2026-09-07', maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'sat', prevu_le: null, reference_le: null, reel_le: null, maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'pv_reception', prevu_le: null, reference_le: null, reel_le: null, maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', jalon_code: 'fin_garantie', prevu_le: null, reference_le: null, reel_le: null, maj_le: '2026-09-25T06:00:00.000Z' },
  ],
  pub_avancement_projets: [
    { projet_code: 'RCF-019', date_situation: null, avancement_physique_pct: null, spi: null, fin_prevue_le: '2026-12-27', montant_contrat_keur: 1500, montant_avenants_keur: null, facture_keur: 900, maj_le: '2026-09-25T06:00:00.000Z' },
  ],
  pub_avenants: [
  ],
  pub_reserves: [
  ],
  pub_livrables: [
    { project_code: 'RCF-019', number: 'D-110', title: 'Structural design package — portal & girders', status: 'accepted', type: 'drawings', accepte_le: '2026-03-12', maj_le: '2026-09-25T06:00:00.000Z' },
    { project_code: 'RCF-019', number: 'D-111', title: 'Piling & foundation calculation note', status: 'accepted', type: 'calculation_notes', accepte_le: '2026-03-20', maj_le: '2026-09-25T06:00:00.000Z' },
    { project_code: 'RCF-019', number: 'D-112', title: 'Crane rail alignment report', status: 'submitted', type: 'test_reports', accepte_le: null, maj_le: '2026-09-25T06:00:00.000Z' },
    { project_code: 'RCF-019', number: 'D-113', title: 'Foundations as-built drawings', status: 'accepted', type: 'manuals_asbuilt', accepte_le: '2026-09-18', maj_le: '2026-09-25T06:00:00.000Z' },
  ],
  pub_pack_ingenierie: [
    { projet_code: 'RCF-019', famille: 'analyse_fonctionnelle', attendues: 1, validees: 0, poids: 20, pct_pondere: 0, maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', famille: 'bom', attendues: 1, validees: 0, poids: 20, pct_pondere: 0, maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', famille: 'electrique', attendues: 1, validees: 0, poids: 20, pct_pondere: 0, maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', famille: 'layout', attendues: 1, validees: 0, poids: 20, pct_pondere: 0, maj_le: '2026-09-25T06:00:00.000Z' },
    { projet_code: 'RCF-019', famille: 'pid', attendues: 1, validees: 0, poids: 20, pct_pondere: 0, maj_le: '2026-09-25T06:00:00.000Z' },
  ],
  pub_parc_machines: [
  ],
};

/**
 * The needs Keystone's demo knows (its simulation of Arche's pub_besoins_machines, R-187): the simulation of Arche generates
 * nothing for them — Keystone's answers above are all they get (CPX-APM-2026-01/B02 is still waiting for one).
 */
export const KEYSTONE_DEMO_NEEDS: ReadonlySet<string> = new Set([
  'CPX-APM-2026-01/B01', 'CPX-APM-2026-01/B02', 'CPX-SAI-2026-01/B01', 'CPX-SAI-2026-01/B02', 'CPX-SAI-2026-01/B03',
]);
