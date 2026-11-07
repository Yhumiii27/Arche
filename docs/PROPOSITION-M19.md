# M-19 — Corriger les données d'Arche depuis Matrix : proposition de périmètre

Demande M-19 de Matrix (`REQUESTS.md`, 5 nov. 2026) : fournir `arche.pub_editer(p_table, p_action, p_cle, p_valeurs, p_par,
p_motif)`, qu'appelle la visionneuse de Matrix pour l'administrateur IT. Décision M-19 du responsable produit : « l'admin IT
peut modifier toutes les données à l'exception des données sensibles RGPD », **par l'outil**, avec ses règles et son journal
(convention : `docs/edition-par-les-outils.md` du dépôt Matrix).

Ce document propose le périmètre et les règles. **Décision du responsable produit (7 nov. 2026)** : les trois réponses
recommandées du § 4 sont retenues — familles B et C, administrateurs groupe d'Arche, journal et avis au chef de projet.
**Fait** : migrations `0033_primary_keys` et `0034_pub_editer`, tests `src/server/db/pub-editer.test.ts` ; une journée de ramp-up
corrigée est recalculée par la tâche `alerts-raised`.

## 1. Le point de vigilance

Arche applique ses règles dans le code de l'application : droits par rôle et par filiale, cycle DIG-PRODI, critères des
jalons, circuits, verrouillage optimiste, recalculs. Une fonction SQL appelée par Matrix passe à côté de ce code. Elle ne
peut reprendre que les règles simples : colonnes admises, types, bornes, état de la ligne. Ouvrir « toutes les données »
mot à mot permettrait de changer une décision de jalon, une signature ou un dossier figé sans circuit. Cela casserait la
preuve que porte Arche (SHA-256 des versions figées, signatures en ajout seul).

La proposition suit donc la décision M-19 (« toutes les données sauf RGPD »), avec deux familles d'exceptions :
- les **preuves** ;
- les **données qu'un autre outil ou un traitement d'Arche tient**, qui seraient écrasées ou incohérentes.

## 2. Tables proposées (74 tables dans le schéma `arche`)

### A. Jamais ouvertes (refus de la fonction)

| Tables | Pourquoi |
|---|---|
| `audit_entries`, `signatures` | ajout seul, garanti par un déclencheur |
| `changes` | demandes de modification (MoC) : elles suivent leur propre circuit |
| `gates`, `decisions`, `gate_criteria_results`, `gate_conditions`, `circuit_steps`, `signature_requests`, `dossier_versions`, `phase_transitions`, `closure_statements`, `fixed_asset_transfers`, `post_audits` | preuves du cycle DIG-PRODI : décisions, circuits, versions figées, clôture ; elles ne changent que par un circuit ou une MoC |
| `users`, `role_assignments`, `capex_members`, `delegation_matrices`, `api_clients`, `api_signatures`, `webhook_subscriptions` | droits, délégation et secrets : un changement donnerait des droits hors d'Arche ; `users.entra_object_id` est sensible (Matrix) |
| `subsidiaries`, `zones`, `sites` | miroirs des référentiels de Matrix (« Matrix fait foi », D21) : on corrige dans Matrix, pas dans Arche |
| `keystone_mirror`, `keystone_sync`, `vigie_studies`, `vigie_sync`, `sage_imports`, `sage_lines`, `sage_rejects` | miroirs et imports : réécrits à la synchronisation suivante |
| `job_runs`, `activity_events`, `email_outbox`, `webhook_deliveries`, `raised_alerts`, `capex_snapshots`, `capex_scores`, `production_lines` (colonnes calculées), `app_settings` | technique ou calculé par Arche |
| `lifecycle_models`, `designs` | modèles versionnés par le concepteur (AR-052) ; une correction passe par une nouvelle version dans Arche |

### B. Listes de référence : ajouter, corriger, retirer

| Table | Colonnes ouvertes | « Retirer » |
|---|---|---|
| `asset_classes` | `label`, `life_years`, `method`, `factor`, `lot_kinds` | `active = false` (jamais supprimée : des transferts d'immobilisation la citent) |
| `exchange_rates` | `units_per_eur`, `note` | refusé : un taux sert aux montants déjà consolidés ; on corrige la valeur |
| `scoring_weights` | `weight` | refusé (liste fixe de critères) |
| `kpi_baselines` | `value`, `source`, `measured_on` | refusé |
| `reference_revenues` | `revenue_keur`, `source_note` | refusé |

### C. Données d'un CAPEX : corriger seulement

Ces tables n'ont pas toutes une clé primaire simple. Les quatre sans clé reçoivent la leur (`exchange_rates`, `reference_revenues`,
`lot_actuals`, `rampup_days` : clé = colonnes de leur contrainte d'unicité). Il s'agit de corriger une saisie erronée, pas de piloter le CAPEX depuis Matrix. L'ajout et le retrait restent dans Arche, où
ils suivent leurs règles (numérotation, circuits, alertes).

| Table | Colonnes ouvertes |
|---|---|
| `capex` | `title`, `description`, `need_date` (jamais `code`, `status`, `phase`, typologie, sponsor ni chef de projet) |
| `risks` | `title`, `category`, `probability`, `impact` (1 à 4), `response`, `due_on` |
| `capex_actions` | `title`, `description`, `due_on` |
| `wbs_tasks` | `name`, `start_on`, `end_on`, `progress_pct` (0 à 100) |
| `authorizations` | `title`, `authority`, `filed_on`, `due_on`, `obtained_on`, `codex_ref`, `note` |
| `reviews` | `held_on`, `attendees`, `summary` |
| `lot_actuals` | `committed_keur`, `spent_keur`, `physical_pct` (mois non clos) |
| `rampup_days` | `output`, `availability_pct`, `performance_pct`, `quality_pct`, `scrap_pct` ; la ligne est recalculée par Arche ensuite |
| `benefit_actuals` | `revenue_keur`, `opex_keur`, `note` |
| `ideas` | `title`, `stake`, `size_keur` (idée non décidée) |
| `rex_entries` | `title`, `text`, `recommendation` (REX non publié) |
| `absences` | `from_on`, `to_on`, `note` (absence non annulée) |

Les tables non citées ici, comme `budget_lines`, `budget_versions`, `machine_needs`, `envelopes`, `lot_forecasts`,
`hs_statuses` ou `pack_items`, restent fermées en v1. Elles portent des montants validés ou un état qui commande un jalon.
Leur correction passe par Arche (nouvelle version de budget, MoC, mouvement d'enveloppe).

## 3. Règles de la fonction

- **Une fonction générique** `arche.pub_editer` : elle aiguille par table vers une liste blanche de colonnes. Toute table ou
  colonne hors liste est refusée par `RAISE EXCEPTION`, avec un message en français que Matrix montre tel quel.
- **Qui** : `p_par` doit correspondre au nom d'un compte Arche actif qui a le rôle `admin` sur la portée groupe. Sinon,
  refus. Le périmètre par filiale d'Arche est ainsi respecté : seul un administrateur groupe voit et corrige toutes les
  filiales.
- **Motif** obligatoire (au moins 5 caractères).
- **Journal** : une ligne `audit_entries` par appel, dans la même transaction :
  - acteur : le compte de `p_par`, avec la mention « via Matrix » ;
  - zone : « Matrix » ;
  - `before` et `after` : les seules colonnes changées ;
  - `reason` : le motif ;
  - `capex_id` renseigné quand la ligne appartient à un CAPEX, pour que la correction apparaisse dans le journal du CAPEX.
- **Verrouillage optimiste** : le déclencheur `row_version` existant incrémente la version. Un formulaire ouvert dans Arche
  sur la même ligne est alors refusé à l'enregistrement, comme pour deux personnes dans Arche.
- **Renvoi** : la ligne après modification, sans colonne sensible.
- **Migration** générée par Arche (`SECURITY DEFINER`, `SET search_path = arche, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC`),
  testée par Vitest sur PostgreSQL : chaque refus, chaque table ouverte, la ligne du journal.
- Une fois la migration passée, l'entrée M-19 passe à FAITE et la DSI autorise le lien d'écriture dans Matrix.

## 4. Questions au responsable produit

1. **Périmètre** : les familles B et C ci-dessus (recommandé), seulement les listes de référence (B), ou davantage ?
2. **Qui** : réserver aux administrateurs groupe d'Arche, retrouvés par leur nom (recommandé), ou faire confiance à Matrix
   (rôle Administrateur de Matrix) sans contrôle côté Arche ?
3. **Prévenir** : signaler chaque correction faite via Matrix au chef de projet du CAPEX (avis dans « Mes actions » et
   e-mail AR-041), ou seulement au journal ?
