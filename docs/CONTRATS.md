# Arche — contrats d’échange (vues `pub_`)

> 22 oct. 2026. Règles (architecture A-2, Keystone `drizzle/0035_share.sql`) : une vue `pub_` est un **contrat**. On ne
> supprime ni ne renomme jamais une colonne (une rupture → nouvelle vue `pub_<nom>_v2`) ; les nouvelles colonnes vont **en
> fin de vue** ; chaque vue a un `COMMENT ON VIEW` qui nomme ses lecteurs ; `WITH (security_barrier)`. Les lecteurs lisent
> par date (`maj_le` indexée). Noms de colonnes en français, comme les vues existantes de Keystone. Montants en k€
> (`_keur`). Les droits de lecture sont accordés par Matrix (`partage/90-droits.sql`), jamais par l’outil lui-même.
>
> État : **existe** = déjà publiée par Keystone (migration 0035) ; **à créer** = demandée à Keystone (lots R-186 à R-191,
> [`DEMANDES-KEYSTONE.md`](DEMANDES-KEYSTONE.md)) ; tant qu’elle manque, Arche la **simule** (spec 07 §2).

## 1. Clés communes

| Clé | Format | Propriétaire |
|---|---|---|
| code CAPEX | `CPX-APM-2026-01` | Arche |
| référence de besoin | `CPX-APM-2026-01/B01` | Arche |
| code de projet EPC2i | `HLT-026` (`pub_projets.code`) | Keystone |
| numéro de machine | `MCH-041` (`pub_parc_machines.number`) | Keystone |
| code catalogue | `EMP-40T` + `version` | Keystone |

## 2. Vues lues par Arche

### 2.1 Keystone — existent

**`pub_projets`** (contrat D02 v1) — utilisée pour l’étape courante et le chef de projet des projets EPC2i liés.

| Colonne | Type | Usage dans Arche |
|---|---|---|
| `code` | text | clé |
| `numero` | text | affichage |
| `code_analytique`, `nature` | text | non utilisées |
| `nom` | text | affichage |
| `client_id`, `client`, `client_code3` | uuid, text, text | contrôle : le client est la filiale (R-190) |
| `phase_code`, `phase` | text | étape Keystone (spec 03 §6) |
| `imputable` | bool | non utilisée |
| `chef_projet_matricule`, `chef_projet_nom` | text | affichage |
| `ville`, `pays`, `fournisseurs` | text | non utilisées |
| `maj_le` | timestamptz | lecture incrémentale |
| *`capex_code`* | text | **à ajouter en fin de vue** (K-05) : rattachement au CAPEX |
| *`besoin_ref`* | text | **à ajouter** (K-05) : premier besoin à l’origine du projet |

**`pub_livrables`** (D13 v1) : `project_code`, `number`, `title`, `status` (`planned` … `accepted` / `rejected`). Arche y lit
les PV d’acceptation. **Colonnes à ajouter** (K-06) : `type` (`client_acceptance` = PV), `accepte_le` (date), `maj_le`.

**`pub_parc_machines`** (D12 v1, une ligne par machine et par article monté) : `number`, `name`, `client_name`, `site_text`,
`project_code`, `warranty_status`, `part_ref`, `fitted_revision`. Arche lit `DISTINCT number, name, project_code, site_text`.
**Colonnes à ajouter** (K-07) : `type_machine_code`, `livree_le`, `maj_le`.

### 2.2 Keystone — à créer

**`pub_catalogue_machines`** (R-186) — une ligne par fiche publiée et version.

| Colonne | Type | Contenu |
|---|---|---|
| `code` | text | code de la fiche (`EMP-40T`) |
| `version` | int | version de la fiche ; un besoin garde la version choisie |
| `type_code` | text | type de machine Keystone (`EMP`, `MEMU`…) |
| `type_libelle` | text | libellé du type |
| `variante` | text | variante |
| `libelle` | text | nom commercial |
| `description` | text | description courte |
| `options` | jsonb | `[{code, libelle, prix_indicatif_keur}]` |
| `capacite_nominale` | numeric | capacité nominale |
| `unite_capacite` | text | `t/h`, `pièces/j`… |
| `prix_indicatif_keur` | numeric | prix catalogue (classe E50) |
| `delai_type_semaines` | int | délai type de livraison |
| `statut` | text | `publie` / `retire` |
| `maj_le` | timestamptz | |

**`pub_reponses_besoins`** (R-187) — une ligne par réponse (la dernière fait foi).

| Colonne | Type | Contenu |
|---|---|---|
| `besoin_ref` | text | référence du besoin Arche |
| `capex_code` | text | |
| `numero` | text | numéro de la réponse côté Keystone |
| `nature` | text | `qualification` / `indicatif` / `devis` / `offre_ferme` |
| `qualification` | text | `faisable` / `a_etudier` / `refuse` |
| `motif` | text | motif d’un refus ou d’une étude |
| `classe_estimation` | text | `E50` / `E30` / `E10` |
| `montant_central_keur`, `montant_bas_keur`, `montant_haut_keur` | numeric | fourchette |
| `delai_semaines` | int | délai proposé |
| `valide_jusqu_au` | date | validité de l’offre |
| `document_ref` | text | référence Codex du devis ou de l’offre |
| `projet_code` | text | projet EPC2i créé à la commande (sinon null) |
| `statut` | text | `en_cours` / `remise` / `acceptee` / `caduque` |
| `repondu_le` | timestamptz | |
| `maj_le` | timestamptz | |

**`pub_jalons_projets`** (R-189) — une ligne par projet et jalon.

| Colonne | Type | Contenu |
|---|---|---|
| `projet_code` | text | |
| `jalon_code` | text | `commande`, `fin_etudes`, `fat`, `expedition`, `arrivee_site`, `sat`, `pv_reception`, `fin_garantie` |
| `prevu_le` | date | date prévue courante |
| `reference_le` | date | date de la baseline (BL1) |
| `reel_le` | date | date réelle (null si à venir) |
| `maj_le` | timestamptz | |

**`pub_avancement_projets`** (R-189) — une ligne par projet (situation courante). **Aucun coût interne, taux ni marge** (AC-2).

| Colonne | Type | Contenu |
|---|---|---|
| `projet_code` | text | |
| `date_situation` | date | |
| `avancement_physique_pct` | numeric | |
| `spi` | numeric | |
| `fin_prevue_le` | date | |
| `montant_contrat_keur` | numeric | prix de vente initial |
| `montant_avenants_keur` | numeric | avenants signés |
| `facture_keur` | numeric | facturé à la filiale |
| `maj_le` | timestamptz | |

**`pub_avenants`** (R-189) : `projet_code`, `numero`, `objet`, `montant_keur`, `delai_jours`, `statut` (`propose` / `signe` /
`refuse`), `signe_le`, `maj_le`.

**`pub_reserves`** (R-189) : `projet_code`, `numero`, `categorie` (`A` / `B` / `C`), `origine` (`itp` / `site`), `statut`
(`open` / `in_progress` / `closed`), `responsable` (`client` / `keystone`), `ouverte_le`, `levee_le`, `maj_le`.

**`pub_pack_ingenierie`** (R-191) — une ligne par projet et famille.

| Colonne | Type | Contenu |
|---|---|---|
| `projet_code` | text | |
| `famille` | text | `pid`, `bom`, `layout`, `electrique`, `analyse_fonctionnelle` |
| `attendues` | int | pièces attendues |
| `validees` | int | pièces validées |
| `poids` | numeric | poids de la famille dans la liste type |
| `pct_pondere` | numeric | % pondéré du projet (même valeur sur chaque ligne du projet) |
| `maj_le` | timestamptz | |

### 2.3 Codex — existent (lecture à accorder, CX-05)

Tous les documents d’Arche sont dans Codex (N-17). Arche lit, pour vérifier et afficher une référence :

| Vue | Colonnes lues |
|---|---|
| `codex.pub_documents` | `id` (identifiant `TYPE-CONTEXTE-SEQ`), `aliases`, `title`, `type_code`, `subtype`, `attachment`, `project_code`, `conf`, `state`, `status`, `rev_in_force`, `rev_working`, `modified_at` |
| `codex.pub_revisions_document` | `doc_id`, `letter`, `status`, `approved_at`, `in_force_at`, `file_name` |
| `codex.pub_validations` | `doc_id`, `revision`, `current_step`, `outcome`, `step_label`, `assignee_name`, `done_on` (circuit d’une pièce du pack) |
| `codex.pub_types_document` | `code`, libellés, `family`, `attachments`, `subtypes` (choix du type attendu par pièce) |

Les documents de niveau `tres_confidentiel` ne sont pas publiés par Codex : Arche n’en verra que la référence saisie.

### 2.4 Matrix — existent (référentiels, N-22)

`matrix.pub_pays`, `matrix.pub_sites`, `matrix.pub_organigramme` : pays (ISO 2), sites (code, pays), organisation ; à lire
quand Matrix portera les filiales (M-9).

### 2.5 Vigie — à définir (AC-3)

Vigie ne modélise pas ces études aujourd’hui ([`DEMANDES-VIGIE.md`](DEMANDES-VIGIE.md)). Proposition à porter auprès de Vigie (Arche ne modifie pas Vigie) : `pub_etudes_securite` (`capex_code`, `projet_code`,
`etude_code` HS2…HS6 / PSSR, `type` HazID / HazOp / AMDEC / PSSR / ASPD, `statut`, `conclue_le`, `actions_ouvertes`,
`actions_en_retard`, `lien`, `maj_le`). En attendant : statut déclaratif (N-13).

### 2.4 Matrix — existent (référentiels du groupe)

Décisions de Matrix : D14 (sites), D17 (pays), D21 (zones et filiales, 22 oct. 2026, option A : « Matrix fait foi »).
Les tables `zones`, `subsidiaries` et `sites` d’Arche deviennent des miroirs de ces vues (plus de saisie dans Arche). Droits posés
par Matrix (`partage/90-droits.sql`, PR Yhumiii27/Matrix#10).

| Vue | Colonnes | Usage dans Arche |
|---|---|---|
| `matrix.pub_filiales` | `code`, `nom`, `pays_iso2`, `zone_code`, `devise`, `ordre`, `actif` | filiale d’un CAPEX ; `<FIL>` des codes CAPEX ; portées des rôles |
| `matrix.pub_zones` | `code`, `libelle`, `responsable`, `ordre`, `actif` | portée du Directeur de Zone |
| `matrix.pub_sites` | `code`, `libelle`, `ville`, `pays_iso2`, `ordre`, `actif`, `filiale_code` | site d’un CAPEX (sites où `filiale_code` est renseignée) |
| `matrix.pub_pays` | `iso2`, noms, `actif` | pays |
| `matrix.pub_organigramme`, `pub_correspondances` | voir Matrix | `pub_organigramme` accordée à Arche (M-5) ; non utilisées en v1 |

## 3. Vues publiées par Arche

Créées par les migrations d’Arche (comme `0035_share` de Keystone, règle P-02 de Matrix) ; Matrix n’en garde pas de copie
tant qu’elles n’existent pas. Lecteurs accordés par Matrix (`partage/90-droits.sql`, déjà prêts).

**`pub_capex`** — lecteurs : `keystone_app`, `matrix_app`. Les brouillons ne sont pas publiés.

| Colonne | Type | Contenu |
|---|---|---|
| `code` | text | `CPX-APM-2026-01` |
| `filiale_code` | text | code à 3 lettres |
| `filiale` | text | nom |
| `zone` | text | |
| `site` | text | nom du site |
| `pays_iso2` | text | |
| `intitule` | text | |
| `type_investissement` | text | `new_plant` / `new_line` / `extension` / `other` |
| `statut` | text | `active` / `on_hold` / `closed` / `abandoned` |
| `phase_code` | text | `cadrage` / `avant_projet` / `execution` / `demarrage` |
| `typologie` | text | `light` / `strategic` |
| `sponsor_nom`, `sponsor_email` | text | |
| `chef_projet_nom`, `chef_projet_email` | text | |
| `g1_le`, `g2_le`, `g3_le` | date | dates des décisions Go (null si non passées) |
| `debut_mes_le` | date | début de la MES |
| `maj_le` | timestamptz | |

**`pub_besoins_machines`** — lecteurs : `keystone_app`, `matrix_app`. Les brouillons ne sont pas publiés.

| Colonne | Type | Contenu |
|---|---|---|
| `besoin_ref` | text | `CPX-APM-2026-01/B01` |
| `capex_code` | text | |
| `ligne` | text | `B01` |
| `catalogue_code` | text | null pour un besoin libre |
| `catalogue_version` | int | |
| `libelle_libre` | text | besoin libre |
| `quantite` | int | |
| `options` | jsonb | codes d’options choisies |
| `capacite_visee` | numeric | |
| `unite_capacite` | text | |
| `date_besoin` | date | |
| `site` | text | |
| `statut` | text | `submitted` / `withdrawn` / `ordered` |
| `commentaire` | text | |
| `soumis_le` | timestamptz | |
| `commande_le` | date | date du G2 |
| `maj_le` | timestamptz | |

**`pub_rampup`** — lecteurs : `keystone_app` (R-193), `matrix_app`. Une ligne par machine du parc mise en service.

| Colonne | Type | Contenu |
|---|---|---|
| `machine_numero` | text | `MCH-041` |
| `capex_code` | text | |
| `ligne_production` | text | |
| `debut_mes_le` | date | |
| `capacite_nominale` | numeric | par jour |
| `unite_capacite` | text | |
| `capacite_atteinte_pct` | numeric | moyenne des 30 derniers jours saisis |
| `trs_reception_pct` | numeric | TRS moyen de la série des 30 jours (ou des 30 derniers jours) |
| `rebuts_reception_pct` | numeric | idem |
| `trente_jours_le` | date | fin de la série de 30 jours conformes ; null si non atteinte |
| `statut` | text | `en_cours` / `atteint` / `hors_delai` |
| `maj_le` | timestamptz | |

**`pub_journal`** — lecteur : `matrix_app` (journal unifié, mêmes colonnes que `keystone.pub_journal`, contrat D18) :
`ref_source`, `nature`, `quand`, `qui`, `qui_ref`, `qui_role`, `action`, `objet`, `detail`, `projet` (= code CAPEX),
`qui_matricule` (toujours null en v1).

**`pub_rex_v2`** — lecteur : `matrix_app`. Décision D22 de Matrix (22 oct. 2026, option A) : Arche garde le REX des CAPEX,
Keystone celui des projets (`keystone.pub_rex`) ; Matrix réunit les deux par `UNION ALL`. Contrat commun fixé par Matrix
(demande du 23 oct. 2026, `REQUESTS.md`), migration `0016_share_rex_v2`, colonnes dans cet ordre (`text` sauf indication) :
`ref_source` (`'rex_entries:' || id`), `outil` (`'arche'`), `projet_code` (null), `capex_code`, `numero` (`REX-nn`),
`categorie`, `titre`, `constat` (le texte du REX), `impact` (null), `recommandation` (facultative, `rex_entries.recommendation`),
`portee` (null), `statut` (`'publie'`), `auteur`, `cree_le` (timestamptz, `published_at`), `maj_le` (timestamptz,
`updated_at`) ; colonne propre à Arche en fin de vue : `phase`. Seules les entrées publiées (`published_at` renseignée) y
figurent.

**`pub_rex`** (v1, remplacée par `pub_rex_v2`) — lecteur : `matrix_app`. Proposition de la livraison 6 (migration
`0014_share_rampup_rex`) : `ref_source` (`rex_entries.id`), `capex_code`, `projet_code` (null), `categorie`, `titre`, `texte`,
`phase`, `publie_le`, `auteur`. Gardée telle quelle (contrat `pub_`) ; plus de nouveau lecteur.
