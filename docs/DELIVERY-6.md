# Livraison 6 — Démarrage, ramp-up et transfert

> 23 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L6). Réponses du questionnaire relues le
> 23 oct. 2026 : toutes « défaut » (N-15, N-16 confirmés). Avec cette livraison, tous les écrans du registre sont construits.

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Début de la MES | saisi par le chef de projet en phase 4, **après le PSSR franchi**, une seule fois ; ouvre la saisie du ramp-up et fixe l'alerte M+5 et la limite M+6 | `startMesAction`, `checkMesStart` |
| Lignes de production | nom, capacité nominale par jour et unité, objectif de rebuts, **machines du parc** (numéros Keystone `MCH-…`, proposés depuis `pub_parc_machines`) | table `production_lines`, `src/features/startup/` |
| Saisie journalière (N-16) | par le chef de projet ou l'**expert Exploitation** du CAPEX (droit `rampup`) : production, TRS ou disponibilité / performance / qualité (TRS = D × P × Q), rebuts, **arrêts planifiés neutres** ; import CSV du gabarit Arche (`line;day;output;availability_pct;performance_pct;quality_pct;oee_pct;scrap_pct;planned_stop`, une erreur refuse le fichier) | table `rampup_days`, `src/domain/rampup.ts` |
| Règles du ramp-up | **jour conforme** = production ≥ 100 % du nominal et rebuts ≤ objectif ; **série de jours conformes consécutifs** (un jour manquant ou non conforme la rompt, un arrêt planifié est neutre) ; atteinte quand la série atteint la valeur du modèle (30 jours) ; capacité, TRS et rebuts moyens sur la série ; statut `en_cours` / `atteint` / `hors_delai` | `lineRampup`, `capexRampup` |
| Écran Ramp-up | indicateurs (début de la MES, série requise, lignes atteintes, délai limite), par ligne : série en cours, date d'atteinte, capacité, TRS, rebuts, **graphique journalier** (jours conformes, non conformes, arrêts planifiés, capacité requise) et vue en tableau | `/capex/[code]/rampup`, `src/components/charts/rampup-chart.tsx` |
| Clôture comptable (N-15) | déclaration du CDG (droit `closure`) : **coût final par lot**, solde de l'AFE (négatif si dépassée), note ; écart au budget G2 ; le CDG l'atteste ensuite dans le circuit du G3 | page Exécution, tables `closure_statements`, `lot_final_costs`, `src/domain/closure.ts` |
| Retours d'expérience (D22) | saisis par l'équipe (droit `rex`) par phase et catégorie, **publiés** par le chef de projet ou le Sponsor (définitif) ; bibliothèque REX (recherche, filtres phase et catégorie), limitée aux CAPEX que l'utilisateur voit | page Gouvernance, `/rex`, table `rex_entries` |
| Critères du G3 | évalués désormais : `g3_rampup` (toutes les lignes atteintes), `g3_mes_delay` (alerte : avant M+6), `g3_accounts` (déclaration complète), `g3_rex` (≥ 1 REX par phase) ; « Prochaine étape » renvoie vers l'écran qui les remplit | `startupFacts` (`src/server/dal/rampup.ts`) |
| Alertes | ramp-up proche du délai (à M+5), hors délai (après M+6, signalé au Dir.IG) | `src/domain/alerts.ts` |
| Vues publiées | **`pub_rampup`** (une ligne par machine d'une ligne en MES : capacité atteinte, TRS et rebuts de réception, date des 30 jours, statut ; résultats recalculés à chaque saisie) ; **`pub_rex`** (REX publiés, colonnes proposées dans `CONTRATS.md` §3) | migration `0014_share_rampup_rex` |
| Connecteur Keystone | vue `pub_parc_machines` lue dans le miroir (simulée sur le jeu de démo : les machines d'un projet arrivées sur site) | `src/server/integrations/keystone/` |
| Jeu de démo | **CPX-APM-2025-01** « Four de vieillissement et ligne de finition », en phase 4 : HS jusqu'au PSSR, MES le 1er juillet 2026, une ligne (machine `MCH-…` de Keystone) qui atteint ses 30 jours le 18 octobre (arrêt planifié le 15 août, un jour non conforme le 18 septembre), REX de trois phases ; la clôture comptable et HS 6 restent à faire | `src/server/db/seed/demo.ts` |

Migrations `0013_rampup_rex` (tables) et `0014_share_rampup_rex` (vues, écrites à la main dans une migration `--custom`).

## 2. Écarts et points ouverts

- **`pub_rex`** : les colonnes suivent la proposition de `CONTRATS.md` §3 ; le contrat commun reste **à confirmer avec Matrix et
  Keystone** (D22). Matrix accorde déjà `arche.pub_rex` à `matrix_app` (`90-droits.sql`).
- **Dossier 3 (Transfert & REX)** : ses sections restent rédigées ; les données (ramp-up, clôture, REX) sont sur leurs écrans.
- **Seuils N-16** : la part du nominal (100 %) est fixe ; la durée de la série (30 jours) et le délai (6 mois) sont les valeurs
  du modèle DIG-PRODI réglées par l'administrateur.
- **Supervision de l'usine** : import automatique hors v1 (saisie et CSV seulement).
- **Démo** : un jeu de démo plus riche change les listes de CAPEX visibles (quatre CAPEX).

## 3. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur. `npm test` : 228 tests sur PostgreSQL 16, dont les règles de la livraison
  (`src/domain/l6.test.ts`), le parcours des quatre jalons jusqu'à la clôture au G3 avec MES, ligne, import CSV de 30 jours,
  clôture et REX (`src/features/gates/actions.test.ts`) et la démo (`src/features/startup/actions.test.ts` : `pub_rampup`,
  droits de l'expert Exploitation, publication REX, isolation de la bibliothèque).
- Build de production, `npm run test:smoke` : ramp-up, bibliothèque REX et son isolation, prochaine étape d'un CAPEX en démarrage.

**Terminé quand** (PLAN.md) : un CAPEX de démo passe le G3 en test e2e — fait (`src/features/gates/actions.test.ts`).
