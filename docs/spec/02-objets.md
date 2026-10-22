# 02 — Objets et modèle de données

> Proposition. Schéma PostgreSQL `arche` (N-1) sur le serveur commun ; PGlite (`public`) en développement et en tests.
> Montants en **k€** sauf colonne `_eur` (convention Keystone ; devise : N-2). Dates en `date` ISO ; instants en
> `timestamptz`. Codes stockés, jamais de libellés traduits. Chaque table porte `created_at`, `updated_at`.
> Référentiels du groupe (décision D21 de Matrix, 22 oct. 2026) : zones, filiales, sites et pays sont tenus et publiés par
> Matrix ; Arche stocke leurs **codes** (`subsidiary_code`, `site_code`, `zone_code`, `country_iso2`) et contrôle qu’ils
> existent dans les vues `matrix.pub_*`, sans clé étrangère entre schémas.

## 1. Référentiels

| Table | Colonnes principales | Notes |
|---|---|---|
| *(Matrix)* zones | lues dans `matrix.pub_zones` : `code`, `libelle`, `responsable`, `ordre`, `actif` | **décision D21 de Matrix (22 oct. 2026)** : pas de table `zones` dans Arche |
| *(Matrix)* filiales | lues dans `matrix.pub_filiales` : `code` (3 lettres), `nom`, `pays_iso2`, `zone_code`, `devise`, `ordre`, `actif` | D21 : pas de table `subsidiaries` ; le code est le `<FIL>` des codes CAPEX et la clé de `keystone.clients.code3` |
| *(Matrix)* sites | lus dans `matrix.pub_sites` (`filiale_code` renseignée) : `code`, `libelle`, `ville`, `pays_iso2`, `ordre`, `actif`, `filiale_code` | D21 et D14 : pas de table `sites` ; un CAPEX porte `site_code` |
| *(Matrix)* pays | lus dans `matrix.pub_pays` (`iso2`, noms) | D17 |
| `reference_revenues` | `subsidiary_code`, `fiscal_year`, `revenue_keur`, `entered_by`, `entered_at`, `source_note` | CA de référence (C-5), saisi par la DAF groupe ; une ligne par exercice |
| `lifecycle_models` | `code` (`dig-prodi`), `version` (`4.0`), `definition` (jsonb), `active` | cycle paramétré (03) ; une version par révision de la méthode |
| `delegation_rules` | `id`, `typology`, `object_kind`, `max_pct_of_g2`, `max_keur`, `max_delay_days`, `decider_role`, `valid_from` | matrice de délégation (C-4) ; datée |
| `staffing_templates` | `typology`, `role`, `required` | gabarit de staffing (CDC §3) |
| `pack_templates` | `investment_type`, `family`, `item_code`, `label`, `weight`, `owner` (`subsidiary` / `epc2i`) | liste type du pack ingénierie (C-9) |
| `hs_milestones` | `code` (HS2…HS6, PSSR), `phase`, `content`, `owner`, `blocks_gate` | table des jalons HS (C-3) |
| `expert_specialities` | `code` (`quality`, `hse`, `finance`, `operations`) | |

## 2. Utilisateurs et droits

| Table | Colonnes | Notes |
|---|---|---|
| `users` | `id`, `entra_oid`, `email`, `display_name`, `subsidiary_code`, `active`, `last_sign_in_at` | repris du socle Keystone |
| `role_assignments` | `user_id`, `role`, `scope_kind` (`group` / `zone` / `subsidiary` / `capex`), `scope_ref`, `speciality`, `from_on`, `to_on` | portées (01 §2) |

## 3. CAPEX

| Table | Colonnes | Notes |
|---|---|---|
| `capex` | `id`, `code`, `subsidiary_code`, `site_code`, `title`, `description`, `investment_type` (`new_plant` / `new_line` / `extension` / `other`), `status` (`draft` / `active` / `on_hold` / `closed` / `abandoned`), `phase` (`cadrage` / `avant_projet` / `execution` / `demarrage`), `typology` (`light` / `strategic`), `typology_source` (`computed` / `forced`), `typology_reason`, `lifecycle_model_version`, `sponsor_user_id`, `lead_user_id`, `need_date`, `mes_started_on`, `opened_at`, `closed_at` | code `CPX-<FIL>-<AAAA>-<NN>` calculé dans la transaction |
| `capex_members` | `capex_id`, `user_id`, `capex_role` (`lead`, `controller`, `co_dig`, `epc2i_pmo`, `internal_client`, `member`) | équipe nommée ; contrôle du gabarit de staffing |
| `capex_lots` | `id`, `capex_id`, `number`, `kind` (`civil_works`, `buildings`, `utilities`, `vrd`, `machines`, `recruitment`, `land`, `other`), `title`, `epc2i` (bool), `position` | lots (N-12 pour la liste) ; `machines` = lots alimentés par les projets EPC2i |
| `budget_versions` | `id`, `capex_id`, `number`, `estimate_class` (`E50` / `E30` / `E10`), `status` (`draft` / `submitted` / `validated` / `superseded`), `basis` (texte), `validated_by`, `validated_at`, `is_g2_baseline` | entonnoir de précision |
| `budget_lines` | `budget_version_id`, `lot_id`, `amount_keur`, `phasing` (jsonb : mois → k€) | central ; fourchette = classe × central |
| `lot_actuals` | `lot_id`, `month`, `committed_keur`, `spent_keur`, `physical_pct`, `entered_by`, `source` (`manual` / `import`) | engagé, réalisé, % physique (lots hors EPC2i) ; mensuel |
| `business_plans` | `id`, `capex_id`, `dossier_version_id`, `horizon_years`, `discount_rate_pct`, `flows` (jsonb par année : capex, opex, revenue), `npv_keur`, `irr_pct`, `payback_years` | BP ; calculs dans `src/domain/bp.ts` (N-11) |
| `risks` | `id`, `capex_id`, `number`, `title`, `category`, `probability`, `impact`, `owner_user_id`, `response`, `status`, `due_on` | registre simple |
| `decisions` | `id`, `capex_id`, `number`, `taken_on`, `body` (`copil_projet` / `copil_gpi` / `dir_ig` / `ceo`), `text`, `review_id` | registre des décisions |
| `authorizations` | `id`, `capex_id`, `kind` (`icpe`, `building_permit`, `plu`, `atex`, `other`), `authority`, `filed_on`, `due_on`, `obtained_on`, `status`, `codex_ref` | dossier réglementaire ; alerte d’échéance |
| `pack_items` | `capex_id`, `item_code`, `status` (`expected` / `in_progress` / `validated` / `not_applicable`), `codex_ref`, `validated_on` | part filiale du pack ; part EPC2i lue dans `pub_pack_ingenierie` |
| `hs_statuses` | `capex_id`, `hs_code`, `status` (`not_started` / `in_progress` / `passed` / `waived`), `evidence_ref`, `source` (`vigie` / `declared`), `passed_on`, `open_actions`, `late_actions` | miroir Vigie ou déclaratif (N-13) |
| `changes` | `id`, `capex_id`, `number`, `title`, `kind` (`cost` / `schedule` / `scope` / `contingency_draw`), `amount_keur`, `delay_days`, `status`, `required_decider`, `decided_by`, `decided_at`, `decision` | MoC après G2 ; décideur calculé par la matrice |

## 4. Cycle, jalons et dossiers vivants

| Table | Colonnes | Notes |
|---|---|---|
| `phase_transitions` | `capex_id`, `from_phase`, `to_phase`, `gate_code`, `effective_on`, `forced`, `reason`, `by_user_id` | historique (comme `stage_transitions` de Keystone) |
| `gates` | `id`, `capex_id`, `code` (`G1` / `G2` / `G3` / `K3`), `session` (n° de passage), `status` (`open` / `submitted` / `in_review` / `decided`), `decision` (`go` / `go_with_conditions` / `no_go` / `deferred`), `decided_at`, `due_at` | une ligne par passage ; un « ajourné » ouvre une nouvelle session |
| `gate_conditions` | `gate_id`, `number`, `text`, `owner_user_id`, `due_on`, `closed_on` | réserves d’un « Go sous réserve » |
| `gate_criteria_results` | `gate_id`, `criterion_code`, `met`, `value`, `forced_reason` | instantané des critères au moment de la soumission |
| `dossiers` | `id`, `capex_id`, `kind` (`business_case` / `investment` / `transfer`) | un par type et par CAPEX |
| `dossier_versions` | `id`, `dossier_id`, `number`, `state` (`draft` / `frozen` / `approved` / `rejected` / `superseded`), `content` (jsonb par section), `frozen_at`, `frozen_by`, `content_hash` (SHA-256), `completeness_pct` | figé = immuable ; toute modification crée une version |
| `dossier_attachments` | `dossier_version_id`, `section`, `codex_ref`, `title`, `revision` | références Codex, figées avec la version |
| `circuit_steps` | `id`, `gate_id`, `position`, `parallel_group`, `kind` (`visa` / `signature` / `decision` / `countersign` / `quitus` / `attestation`), `role`, `user_id`, `due_at`, `status`, `acted_at`, `outcome`, `comment` | circuit instancié depuis le modèle (05) |
| `signatures` | `circuit_step_id`, `user_id`, `signed_at`, `level` (`simple` / `advanced`), `content_hash`, `auth_time`, `ip_hash`, `provider_ref` | preuve de signature ; append-only |
| `consultations` | `id`, `dossier_version_id`, `opened_by`, `opened_at`, `due_on`, `status` (`open` / `closed`) | consultation d’experts |
| `opinions` | `consultation_id`, `speciality`, `expert_user_id`, `verdict` (`favorable` / `reserved` / `unfavorable`), `comment`, `given_at`, `reminded_at` | un avis par expert ; les réserves deviennent des conditions |

## 5. Gouvernance

| Table | Colonnes | Notes |
|---|---|---|
| `review_series` | `capex_id`, `kind` (`copil_projet`), `cadence` (`quarterly` / `monthly`), `next_due_on` | créée d’office selon la typologie |
| `reviews` | `id`, `capex_id`, `held_on`, `kind`, `attendees`, `summary`, `report_ref` | revue tenue ; rapport Copil |
| `copil_sessions` | `id`, `held_on`, `agenda` (gates) | séances du COPIL GPI (ordre du jour = G1 soumis) |

## 6. Besoins machines et ramp-up

| Table | Colonnes | Notes |
|---|---|---|
| `machine_needs` | `id`, `capex_id`, `line` (B01…), `catalogue_code`, `catalogue_version`, `free_label`, `quantity`, `options` (jsonb), `target_capacity`, `capacity_unit`, `need_date`, `status` (`draft` / `submitted` / `withdrawn` / `ordered`), `submitted_at`, `ordered_at`, `lot_id`, `comment` | publiés dans `pub_besoins_machines` |
| `keystone_*` (miroir) | `keystone_catalogue`, `keystone_responses`, `keystone_projects`, `keystone_milestones`, `keystone_progress`, `keystone_amendments`, `keystone_punch`, `keystone_deliverables`, `keystone_pack`, `keystone_machines` | copies en lecture des vues `pub_` Keystone (ou de la simulation), avec `synced_at` |
| `production_lines` | `id`, `capex_id`, `name`, `nominal_capacity_per_day`, `unit`, `machine_numbers` (Keystone MCH-…) | ligne de production à monter en puissance |
| `rampup_days` | `line_id`, `day`, `output`, `availability_pct`, `performance_pct`, `quality_pct`, `oee_pct`, `scrap_pct`, `entered_by`, `source` | une ligne par jour ; TRS = D × P × Q si non saisi |
| `rex_entries` | `id`, `capex_id`, `category`, `title`, `text`, `phase`, `shared_with` (fonctions centrales), `published_at` | décision D22 de Matrix : Arche garde le REX des CAPEX et le publie dans `pub_rex` (Keystone garde celui des projets) ; REX capitalisé |

## 7. Socle

`audit_entries` (append-only, déclencheur), `activity_events`, `notifications`, `approvals` (moteur « Mes validations »),
`job_runs`, `connector_outbox`, `connector_settings` — repris de Keystone (voir [`../SOCLE.md`](../SOCLE.md)).

## 8. Vues publiées

`pub_capex`, `pub_besoins_machines`, `pub_rampup`, `pub_journal`, `pub_rex` (D22) : [`../CONTRATS.md`](../CONTRATS.md) §3.
