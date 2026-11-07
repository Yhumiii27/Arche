# Requêtes inter-applications
Format d'une entrée :
## [YYYY-MM-DD] <app demandeuse> → <cette app> — <titre court>
- Statut : OUVERTE | ACCEPTÉE | REFUSÉE | FAITE
- Demande : (quoi)
- Justification : (pourquoi, impact sur l'app demandeuse)
- Détails techniques : (tables, champs, types, endpoints, exemples)
- Validé par Guillaume le : (date)

## [2026-10-23] Matrix → Arche — Aligner arche.pub_rex sur le contrat commun du REX (D22)
- Statut : FAITE — `arche.pub_rex_v2` (migration `0016_share_rex_v2`) au contrat commun, `phase` en fin de vue ; nouvelle colonne `rex_entries.recommendation` (migration `0015`). `arche.pub_rex` (v1) reste en place, inchangée (contrat `pub_`), et est marquée remplacée. Matrix lit `arche.pub_rex_v2` (M-13 mise à jour).
- Demande : publier `arche.pub_rex` (lecteur `matrix_app`) avec les mêmes colonnes, dans le même ordre et avec les mêmes types que `keystone.pub_rex`, à la place de la proposition de `docs/CONTRATS.md` § 3 (`ref_source`, `capex_code`, `projet_code`, `categorie`, `titre`, `texte`, `phase`, `publie_le`, `auteur`).
- Justification : décision D22 de Matrix (22/10/2026, option A) ; le contrat d'Arche le prévoit lui-même (« à fixer avec Matrix et Keystone avant la livraison 6 »). Matrix réunit les deux vues par `UNION ALL`, qui exige des colonnes identiques. Sans alignement, Matrix doit transformer chaque vue et toute évolution d'un côté casse la vue commune. Pas bloquant avant la livraison 6 d'Arche (`rex_entries`).
- Détails techniques : colonnes, dans cet ordre et de type `text` sauf indication : `ref_source` (identifiant de la ligne dans l'outil), `outil` (`keystone` ou `arche`), `projet_code`, `capex_code`, `numero`, `categorie`, `titre`, `constat`, `impact`, `recommandation`, `portee`, `statut`, `auteur`, `cree_le` (timestamptz), `maj_le` (timestamptz). Colonnes propres à un outil : en fin de vue seulement. Vue `WITH (security_barrier)`, lecteur `matrix_app` (droit déjà prévu dans `infra/postgres/partage/90-droits.sql` de Matrix) ; une vue `pub_` est un contrat : aucune colonne retirée ni renommée. Correspondance proposée : `ref_source` = `'rex_entries:' || id`, `outil` = `'arche'`, `projet_code` = projet EPC2i lié s'il y en a un, sinon null, `capex_code` = code du CAPEX, `numero`, `impact` et `portee` = null si Arche ne les tient pas, `categorie`, `titre`, `constat` = le texte du REX, `recommandation` = la recommandation si Arche la distingue, sinon null, `statut` = `'publie'`, `auteur`, `cree_le` = `published_at`, `maj_le` = `updated_at` ; `phase` en fin de vue (colonne propre à Arche). Seules les entrées publiées (`published_at` renseignée) y figurent.
- Validé par Guillaume le : 2026-10-23


## [2026-10-30] Matrix → Arche — M-17 : accès entre outils décidés par Matrix (plus de copie de vue, écritures par API ou fonction `pub_`)
- Statut : FAITE
- Demande : appliquer dans Arche la décision M-17 de Matrix (`docs/decisions.md` et `docs/architecture-postgres.md` § 8 sexies du dépôt Matrix) :
  1. **Lire** les données d'un autre outil uniquement par ses vues `pub_` (R2), jamais par ses tables ;
  2. **Écrire** chez un autre outil uniquement par son API ou par une fonction `pub_` qu'il fournit (R4), jamais par `INSERT` / `UPDATE` / `DELETE` dans son schéma ;
  3. pour un **nouvel échange**, ne plus demander à Matrix de recopier une vue dans `partage/` : la migration de Arche reste la seule définition de ses vues `pub_` (R3), et le besoin d'accès se déclare comme un lien du registre `matrix.liens` (R5) — en attendant l'API `POST /api/liens` (lot M17-4), par une entrée courte dans le `REQUESTS.md` de Matrix : lecteur, objet (`schéma.pub_…`), nature (`lecture` ou `execution`), justification ;
  4. pour une **écriture qu'un autre outil doit faire chez Arche** : lui fournir une API, ou une fonction `pub_<verbe>_<objet>` créée par migration (`SECURITY DEFINER`, `SET search_path = <schéma>, pg_temp`, appelant identifié par `session_user`, règles et journal de Arche appliqués, `REVOKE EXECUTE … FROM PUBLIC` ; § « Fonctions pub_ » de la note) ;
  5. reprendre ces règles dans le `CLAUDE.md` de Arche et dans ses documents de demandes à Matrix, et faire l'inventaire de ses échanges (point de départ ci-dessous), en signalant à Matrix tout accès qui n'y serait pas conforme.
- Justification : décision du responsable produit du 30/10/2026 (M-17) : Matrix décide de chaque accès d'un outil aux données d'un autre, PostgreSQL l'applique. Les vues `pub_` restent les contrats de lecture, mais leur copie par Matrix (quatre étapes par échange, dont deux à la main) disparaît, et l'écriture entre outils devient possible sous le contrôle de Matrix sans contourner les règles métier du propriétaire.
- Détails techniques : relevé du 30/10/2026 sur `main` de Arche (requêtes SQL vers d'autres schémas) : `codex.pub_documents`, `keystone.pub_*` (connecteur en mode `views`), `matrix.pub_sites` ; écriture chez Codex par son API de dépôt (Yhumiii27/Arche#19) : conforme à R4. Toutes ces lectures passent déjà par des vues `pub_` et aucune écriture directe dans un autre schéma n'a été trouvée : aucune correction urgente. Les vues, droits et fichiers de partage actuels restent en place pendant la transition (lots M17-1 à M17-5 côté Matrix) ; une vue `pub_` existante ne change pas.
- Validé par Guillaume le : 2026-10-30
- Réponse d'Arche (2026-11-01, validée par Guillaume) : règles reprises dans le `CLAUDE.md` d'Arche (« Exchanges between tools »). Inventaire confirmé : lectures `codex.pub_documents`, `keystone.pub_*` (mode `views`), `matrix.pub_sites`, `vigie.pub_etudes_securite` (connecteur Vigie, mode `views`, lien demandé dans M-15 de Matrix) ; écriture chez Codex par `POST /api/documents` (R4) ; aucune écriture reçue d'un autre outil ; aucun accès non conforme. Le point 3 est remplacé par M-18.

## [2026-11-01] Matrix → Arche — M-18 : Matrix définit vos vues `pub_` et décide de vos écritures croisées (plus de vue `pub_` dans vos migrations)
- Statut : FAITE
- Demande : appliquer dans Arche la décision M-18 de Matrix (`docs/decisions.md` et `docs/architecture-postgres.md` § 8 septies du dépôt Matrix), qui **remplace le point 3 de la demande M-17** du 30/10/2026 (« la migration reste la seule définition des vues `pub_` ») :
  1. **ne plus créer, modifier ni supprimer de vue `pub_` dans vos migrations** (les migrations déjà appliquées ne changent pas) : une nouvelle publication, ou une colonne de plus, se demande à Matrix, qui la définit dans son écran « Publications » (`matrix.publications`) et l'applique lui-même (rôle `matrix_gestion`). Votre migration crée les tables et colonnes ; la vue est celle de Matrix ;
  2. **avant de modifier ou de supprimer une colonne lue par une vue `pub_`**, le signaler à Matrix (entrée dans son `REQUESTS.md`) : la migration échouerait, la vue en dépend. Une colonne publiée ne se retire ni ne se renomme ; un changement incompatible passe par une vue `…_v2` ;
  3. **écritures que d'autres outils font chez vous** : votre API reste permise ; pour une écriture en SQL, fournir une fonction `pub_<verbe>_<objet>` créée par migration (`SECURITY DEFINER`, `SET search_path = <schéma>, pg_temp`, appelant identifié par `session_user`, vos règles et votre journal appliqués, `REVOKE EXECUTE … FROM PUBLIC`). Le droit de l'exécuter est un lien « écriture » décidé dans Matrix ; une fonction exécutable par tous est signalée en erreur par `droits.verifier()` ;
  4. **vos besoins chez les autres** (lecture d'une vue, exécution d'une fonction) se déclarent comme liens dans Matrix (écran « Liens entre outils » ou entrée courte dans son `REQUESTS.md` : outil, objet `schéma.pub_…`, nature `lecture` ou `execution`, justification), plus par une demande de copie de vue ;
  5. reprendre ces règles dans votre `CLAUDE.md`, puis passer cette entrée à FAITE : Matrix reprend alors vos vues `pub_` (`partage/14-reprise-publications.sql` : elles passent au rôle `matrix_gestion`, leurs lecteurs gardent leur droit).
- Justification : décision du responsable produit du 01/11/2026 (M-18) : « matrix [doit] être le seul outil qui permette d'administrer la base de données postgre […] c'est matrix qui doit avoir la main sur ce que chaque outil publie, lie, écrit ». Matrix est en place (lots P1 à P4 fusionnés le 01/11/2026 : rôle `matrix_gestion`, registre et écran « Publications », liens appliqués tout de suite, liens d'écriture). Tant que la reprise n'est pas faite, rien ne change pour Arche ; après la reprise, une migration qui recréerait une vue `pub_` échouerait (« must be owner of view »), d'où le point 1 d'abord.
- Détails techniques : vues de Arche reprises par Matrix : pub_besoins_machines, pub_capex, pub_journal, pub_rampup, pub_rex, pub_rex_v2 (6 vues). Écritures reçues d'autres outils : aucune aujourd'hui. Une vue reprise garde son nom, ses colonnes, son commentaire et ses lecteurs ; seule sa propriété change. Contrôles : `droits.verifier()` (vue `pub_` encore à l'outil : attention, « pas encore reprise »). Pour un essai local (PGlite, base de démonstration), vos migrations anciennes continuent de créer les vues : seule une **nouvelle** migration ne doit plus en créer ni en modifier.
- Validé par Guillaume le : 2026-11-01
- Réponse d'Arche (2026-11-01, validée par Guillaume) : règles reprises dans le `CLAUDE.md` d'Arche ; aucune migration n'a créé ni modifié de vue `pub_` depuis la décision (dernières : `0030_signature_requests`, `0031_vigie_studies`, `0032_codex_deposit`, tables seulement) ; une nouvelle publication ou colonne sera demandée à Matrix. Matrix peut reprendre les 6 vues (`pub_besoins_machines`, `pub_capex`, `pub_journal`, `pub_rampup`, `pub_rex`, `pub_rex_v2`).

## [2026-11-04] Keystone → Arche — Démo alignée : reprendre APM-008, MCH-045 et la SAT de RCF-019 dans la démo de Keystone d'Arche (suite de K-14)
- Statut : FAITE
- Demande : dans `src/server/integrations/keystone/keystone-demo.ts` (lignes réelles de la démo de Keystone reprises par Arche) :
  1. ajouter `CPX-APM-2025-01/B01` à `KEYSTONE_DEMO_NEEDS`, pour que la simulation ne génère plus le projet `APM-25011` ;
  2. reprendre la réponse **RB-006** de Keystone : `besoin_ref = 'CPX-APM-2025-01/B01'`, `capex_code = 'CPX-APM-2025-01'`, offre ferme acceptée, classe E10, 663 k€ (bas 629,9, haut 729,3), 26 semaines, valable jusqu'au 2025-11-29, `document_ref = 'OFF-CPX-APM-2025-01-001'`, `projet_code = 'APM-008'`, répondue le 2025-08-01 ;
  3. reprendre le projet **APM-008** de `pub_projets` (numéro `#008`, code analytique `APM001`, client interne Atlas Process Maroc, `filiale_code = 'APM'`, phase Garantie, `capex_code = 'CPX-APM-2025-01'`, `besoin_ref = 'CPX-APM-2025-01/B01'`, Kénitra, Maroc) et ses jalons de `pub_jalons_projets` (commande 2025-09-15, fin d'études 2025-11-14, FAT et expédition 2026-04-13, arrivée sur site 2026-05-11, SAT prévue et réelle 2026-06-19, fin de garantie prévue 2028-05-10) ;
  4. la machine du parc installé de APM-008 est **MCH-045** (« Ageing oven 2 × 6 m », livrée le 2026-05-11, garantie jusqu'au 2028-05-10) : la ligne de ramp-up « Ageing oven » de `CPX-APM-2025-01` (seed `seedStartup`) doit porter `MCH-045` au lieu de `MCH-443` ;
  5. ajouter la SAT de RCF-019 aux jalons repris : `jalon_code = 'sat'`, `prevu_le = '2026-11-16'` (critère K3 de `CPX-SAI-2026-01`).
- Justification : demande K-14 d'Arche, faite côté Keystone le 02/11/2026 (points 1 à 4 ; `docs/delivery-9/notes-k14-demo.md` du dépôt Keystone). Keystone publie APM-008 et MCH-045 ; la simulation d'Arche génère encore `APM-25011` et `MCH-443`. Sans cette reprise, les deux applications montrées côte à côte n'affichent pas les mêmes numéros pour le four de CPX-APM-2025-01, et le critère K3 de CPX-SAI-2026-01 reste vide dans la démo d'Arche. Keystone ne reprend pas MCH-443 : ce numéro ferait sauter la numérotation « Ajouter une machine » de la démo de Keystone (MCH-050 → MCH-444). Le point 5 de K-14 (renommer RCF-019) n'est pas fait : le responsable produit garde RCF-019 tel quel (questionnaire de suivi de Keystone, S-01, 04/11/2026).
- Détails techniques : uniquement la démo / simulation d'Arche, aucun contrat de vue `pub_` ne change. Valeurs exactes : dépôt Keystone, `src/server/db/seed/capex-k14.ts` et `src/server/integrations/capex/simulation.ts` (branche `main`).
- Validé par Guillaume le : 2026-11-04
- Réponse d'Arche (2026-11-05) : les cinq points sont repris dans `src/server/integrations/keystone/keystone-demo.ts` avec les valeurs de `capex-k14.ts` et de son test (lignes des vues `pub_` de Keystone) : `CPX-APM-2025-01/B01` dans `KEYSTONE_DEMO_NEEDS` (plus de `APM-25011` généré) ; RB-006 ; APM-008 (`pub_projets`, phase Garantie, client interne, `pays = 'Morocco'` comme la vue) et ses huit jalons (`pv_reception` vide) ; MCH-045 dans `pub_parc_machines` et sur la ligne de ramp-up « Ageing oven » du jeu de démonstration (plus de `MCH-443`) ; SAT de RCF-019 prévue le 2026-11-16 (critère K3 de `CPX-SAI-2026-01` rempli, 1 / 1). Une base de démonstration déjà remplie garde l'ancien numéro sur sa ligne de ramp-up : `npm run db:reset-demo` en local.

## [2026-11-05] Matrix → Arche — M-19 · Fonction d'édition `arche.pub_editer` : corriger les données de Arche depuis Matrix, par vos règles
- Statut : FAITE
- Demande : fournir, par une migration de Arche, la fonction
  `arche.pub_editer(p_table text, p_action text, p_cle jsonb, p_valeurs jsonb, p_par text, p_motif text) RETURNS jsonb`
  (`SECURITY DEFINER`, `SET search_path = arche, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC`), qui ajoute, corrige ou retire une ligne
  d'une table de Arche en appliquant vos règles et votre journal :
  - `p_action` = `ajouter` | `corriger` | `retirer` (un retrait peut être un archivage) ; `p_cle` = clé primaire de la ligne
    (null pour `ajouter`) ; `p_valeurs` = colonnes à écrire (null pour `retirer`) ;
  - `p_par` = nom de la personne connectée à Matrix (Microsoft Entra ID, rôle Administrateur) ; `p_motif` = motif saisi
    (obligatoire) ;
  - refus par `RAISE EXCEPTION` (message montré tel quel dans Matrix) ; la fonction renvoie la ligne après modification,
    sans colonne sensible ;
  - elle refuse les tables que Arche ne veut pas ouvrir et toute colonne de `droits.colonnes_sensibles` (Matrix ne les
    transmet jamais, mais la fonction ne doit pas en dépendre) ;
  - règle propre à Arche à respecter : journal d'audit en ajout seul et visibilité par filiale : une modification hors du périmètre attendu est refusée.
  Une fonction par table (`arche.pub_editer_<table>`, mêmes paramètres sans `p_table`) reste possible et passe avant la
  générique. Une fois la migration passée, passer cette entrée à FAITE : la DSI autorise alors le lien d'écriture dans Matrix.
- Justification : décision M-19 du 05/11/2026 (responsable produit) : « pour le moment, l'admin IT peut modifier toutes les
  données à l'exception des données sensibles RGPD », **par les outils** : Matrix n'écrit jamais lui-même dans vos tables
  (M-18) ; la DSI corrige depuis la visionneuse de Matrix, Arche garde ses règles et son journal.
- Détails techniques : convention complète et exemple dans `docs/edition-par-les-outils.md` du dépôt Matrix. Le droit
  d'exécution est un lien « écriture » `matrix_app` → `arche.pub_editer`, décidé dans Matrix (« Liens entre outils ») et posé
  par `droits.accorder_execution` ; `droits.verifier()` signale une fonction `pub_` exécutable par tous ou sans
  `search_path` fixé. Rien ne change pour Arche tant que la fonction n'existe pas : la visionneuse reste en lecture seule.
- Validé par Guillaume le : 2026-11-05
- Réponse d'Arche (2026-11-07, choix de Guillaume du même jour, `docs/PROPOSITION-M19.md`) : fonction générique `arche.pub_editer` (migration `0034_pub_editer` ; `SECURITY DEFINER`, `SET search_path = arche, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC`). Elle ouvre :
  - les listes de référence (`asset_classes` : ajouter, corriger, retirer = archivage ; `exchange_rates`, `reference_revenues` : ajouter, corriger ; `scoring_weights`, `kpi_baselines` : corriger) ;
  - la correction des saisies d'un CAPEX (`capex` : intitulé, description, date de besoin ; `risks`, `capex_actions`, `wbs_tasks`, `authorizations`, `reviews`, `lot_actuals`, `rampup_days`, `benefit_actuals`, `ideas`, `rex_entries`, `absences`), sur des colonnes listées, avec les règles d'Arche (bornes, CAPEX clos, REX publié, idée décidée…).

  Restent fermés : les preuves du cycle (décisions, circuits, signatures, versions figées, journal), les droits et secrets, les miroirs (`subsidiaries`, `zones`, `sites` : Matrix fait foi) et les tables calculées. `p_par` doit être le nom ou l'adresse d'un compte Arche actif qui a le rôle `admin` sur le groupe. Chaque correction est journalisée (`audit_entries`, zone « Matrix », avant / après, motif) ; celle d'un CAPEX va aussi au fil d'activité du CAPEX et par e-mail à son chef de projet. Clés primaires ajoutées (migration `0033_primary_keys`) à `exchange_rates`, `reference_revenues`, `lot_actuals` et `rampup_days` pour la visionneuse. La DSI peut autoriser le lien d'écriture `matrix_app` → `arche.pub_editer`.
