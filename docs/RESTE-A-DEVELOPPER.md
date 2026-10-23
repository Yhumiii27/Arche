# Arche — reste à développer

Inventaire initial du 2026-10-22, mis à jour le 2026-10-23 (branche `claude/brave-curie-chxbck`). Il recense ce qu'il reste à développer, à brancher, à décider ou à mettre en production pour Arche, aligné sur le plan de livraisons (`docs/PLAN.md`). Il est tenu à jour à chaque développement : un point passe « en cours » quand une livraison le prend, « fait » quand il est intégré et vérifié. Le détail est dans `docs/reste-a-developper.json` ; ce document et la page sont produits par `npm run remaining:page`.

**Lecture.** Priorité : Bloquant production, Prochaine étape, À décider (il faut d'abord trancher), Plus tard. Effort, pour un développeur qui connaît le code : S < 2 jours, M ≤ 1 semaine, L ≤ 3 semaines, XL > 3 semaines. Les identifiants entre parenthèses renvoient aux décisions (`docs/DECISIONS.md`) et aux demandes (`docs/DEMANDES-*.md`).

## 1. En bref

**Avancement** : 27 faits, 4 en cours, 7 à faire, sur 38 points.

| Priorité | Points restants | Effort estimé (jours) |
|---|---:|---:|
| Bloquant production | 3 | ≈ 7 |
| Prochaine étape | 3 | ≈ 20 |
| À décider | 3 | ≈ 15 |
| Plus tard | 2 | ≈ 8 |
| **Total** | **11** | **≈ 50** |

L'effort est un ordre de grandeur (S = 1,5 j, M = 4 j, L = 12 j, XL = 30 j) : il ne compte ni l'attente des décisions et des données, ni les développements à faire côté Keystone, Codex, Vigie, Cursus ou Matrix, ni la recette.

| Statut (points restants) | Points |
|---|---:|
| Non commencé | 3 |
| Partiel | 0 |
| Attend le responsable produit | 3 |
| Attend un système externe | 5 |

| Domaine | Bloquant production | Prochaine étape | À décider | Plus tard | Restants | Faits |
|---|---:|---:|---:|---:|---:|---:|
| Plateforme et mise en production | 2 | 0 | 0 | 1 | 3 | 5 |
| Connexion, profils et isolation par filiale | 0 | 0 | 0 | 0 | 0 | 4 |
| CAPEX et cycle DIG-PRODI | 0 | 0 | 0 | 0 | 0 | 4 |
| Dossiers vivants et circuits de décision | 0 | 0 | 0 | 0 | 0 | 4 |
| Besoins machines et Keystone | 0 | 1 | 0 | 0 | 1 | 3 |
| Documents (Codex) | 0 | 2 | 0 | 0 | 2 | 0 |
| Jalons de sécurité (Vigie) | 0 | 0 | 1 | 0 | 1 | 1 |
| Tableaux de bord et gouvernance | 1 | 0 | 0 | 0 | 1 | 3 |
| Démarrage, montée en puissance et transfert | 0 | 0 | 0 | 0 | 0 | 2 |
| Aide à la décision et signature avancée | 0 | 0 | 0 | 1 | 1 | 0 |
| Cadrage, décisions et données attendues | 0 | 0 | 2 | 0 | 2 | 1 |

### 1.1 Chemin critique vers la production

Les points « Bloquant production » restants, par domaine. Sans eux, Arche reste une démonstration.

- **Plateforme et mise en production** : AR-014 Arche sur le serveur PostgreSQL commun (Matrix) *(en cours, Livraison 3)* ; AR-015 Hébergement en France et choix du serveur de production.
- **Tableaux de bord et gouvernance** : AR-034 Pilote sur 1 à 2 CAPEX.

### 1.2 Ce qui attend le responsable produit

Décisions à prendre et données à fournir avant de pouvoir développer (`docs/DECISIONS.md`).

- **AR-002** Réponses du responsable produit aux questions de DECISIONS.md — Responsable produit
- **AR-003** Données de référence des filiales — Responsable produit / DAF groupe
- **AR-015** Hébergement en France et choix du serveur de production — Responsable produit et DSI
- **AR-033** Études de sécurité des procédés dans Vigie (HazID, HazOp, PSSR, ASPD) et vue pub_etudes_securite — Responsable produit (AC-3) puis Vigie

### 1.3 Ce qui attend les autres applications

- **AR-014** Arche sur le serveur PostgreSQL commun (Matrix) — Matrix (M-1 à M-8)
- **AR-026** API de dépôt et de lecture de Codex, rattachement CAPEX, types manquants — Codex
- **AR-029** Vues Keystone pour Arche (catalogue, réponses, jalons, avancement, avenants, réserves, pack) — Keystone (R-185 à R-193)
- **AR-033** Études de sécurité des procédés dans Vigie (HazID, HazOp, PSSR, ASPD) et vue pub_etudes_securite — Responsable produit (AC-3) puis Vigie
- **AR-038** Socle partagé @epc2i/socle — Keystone (R-194)

## 2. Liste détaillée par domaine

### 2.1 Plateforme et mise en production (3 restants, 5 faits)

**AR-014 · Arche sur le serveur PostgreSQL commun (Matrix)** — *Bloquant production · attend un système externe · effort S* · **en cours (Livraison 3)**  
Rôle, schéma, droits, partage, journal unifié, sauvegarde, déclaration des tables.  
*Avancement : Kit Coolify du serveur commun (deploy/compose.shared.yaml, EXPLOITATION.md § 4.1) essayé en local contre le socle de Matrix : migrations, jeu de démonstration, santé, sauvegarde, partage 70/90/95. Reste : mise en service dans Coolify. · Attend : Matrix (M-1 à M-8) · Sources : docs/DEMANDES-MATRIX.md*

**AR-015 · Hébergement en France et choix du serveur de production** — *Bloquant production · attend le responsable produit · effort S*  
D-11 / C-13 ; même décision que Keystone (I-1a).  
*Attend : Responsable produit et DSI · Sources : docs/DECISIONS.md C-13*

**AR-038 · Socle partagé @epc2i/socle** — *Plus tard · attend un système externe · effort M*  
Remplacer les copies du socle par le paquet (R-194 de Keystone).  
*Attend : Keystone (R-194) · Sources : docs/SOCLE.md*

**~~AR-011 · Sauvegardes et restauration du schéma arche~~** — *Bloquant production · non commencé · effort S* · **fait (Livraison 1b)**  
pg_dump du schéma, rétention, exercice de restauration ; sur le serveur commun, la sauvegarde de Matrix couvre arche après M-7.  
*Avancement : docs/DELIVERY-1b.md · Sources : docs/SOCLE.md, docs/DEMANDES-MATRIX.md M-7*

**~~AR-004 · Socle repris de Keystone (configuration, journaux, santé, horloge, base, audit, HTTP, i18n, Nocturne)~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
Copie du socle au commit Keystone 63f43ad, adaptée à PostgreSQL seul (schéma arche).  
*Avancement : docs/DELIVERY-1.md ; 98 tests unitaires sur PostgreSQL, test de fumée HTTP. · Sources : docs/SOCLE.md*

**~~AR-005 · PostgreSQL uniquement (schéma arche, rôle arche_app, db:local, migrateur)~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
Pas de PGlite (décision du 22 oct.) : développement, tests, CI et production sur PostgreSQL ; une base de test par fichier.  
*Sources : docs/DECISIONS.md N-23*

**~~AR-009 · Conteneur, kit Coolify et CI~~** — *Prochaine étape · non commencé · effort S* · **fait (Livraison 1)**  
Image (port 3400), compose (PostgreSQL créé comme le serveur commun, migration, application), CI avec service PostgreSQL 16 et test de fumée.  
*Avancement : Kit Coolify testé de bout en bout en CI depuis la livraison 4 (docs/EXPLOITATION.md §4). · Sources : Dockerfile, deploy/, .github/workflows/ci.yml*

**~~AR-010 · Tâches planifiées et worker~~** — *Prochaine étape · non commencé · effort S* · **fait (Livraison 1b)**  
Relances, revues en retard, synchronisations, instantanés hebdomadaires (moteur de Keystone).  
*Avancement : docs/DELIVERY-1b.md · Sources : docs/SOCLE.md*

### 2.2 Connexion, profils et isolation par filiale (0 restants, 4 faits)

**~~AR-013 · Administration des comptes et des rôles (écriture)~~** — *Bloquant production · non commencé · effort M* · **fait (Livraison 1b)**  
Créer un compte, lui donner des rôles et des portées, le désactiver ; audit.  
*Avancement : docs/DELIVERY-1b.md · Sources : docs/spec/01 §3*

**~~AR-006 · Connexion Entra ID et mode démo~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
Routes de connexion, cookie de session scellé, rôles et portées lus dans Arche, compte administrateur à la première connexion (ARCHE_ADMIN_EMAILS) ; « Voir en tant que » en démo.  
*Avancement : Le parcours Entra complet n’a pas encore de test de bout en bout (AR-012). · Sources : docs/spec/01 §4*

**~~AR-007 · Profils, portées et isolation par filiale dans la couche de données~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
13 profils, affectations à portée groupe / zone / filiale / CAPEX ; filtre SQL sur chaque lecture ; un CAPEX hors portée répond 404.  
*Avancement : Test par profil (src/server/dal/capex.test.ts) et test de fumée HTTP. · Sources : docs/spec/01 §2*

**~~AR-012 · Test de bout en bout de la connexion Entra~~** — *Prochaine étape · non commencé · effort S* · **fait (Livraison 1b)**  
Fournisseur OpenID simulé (src/test/mock-entra.ts) : connexion, refus, compte administrateur créé, déconnexion.  
*Avancement : docs/DELIVERY-1b.md · Sources : src/server/auth/*

### 2.3 CAPEX et cycle DIG-PRODI (0 restants, 4 faits)

**~~AR-016 · CAPEX : création, lots, équipe et gabarit de staffing~~** — *Prochaine étape · non commencé · effort L* · **fait (Livraison 2)**  
Livraison 2.  
*Avancement : Création du brouillon, ouverture, fiche, lots, équipe et gabarit de staffing (docs/DELIVERY-2.md). · Sources : docs/PLAN.md*

**~~AR-017 · Budget par versions et classes d’estimation E50 / E30 / E10~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 2)**  
Livraison 2 (C-8).  
*Avancement : Versions E50 / E30 / E10, fourchettes, soumission, validation (E10 par la DAF groupe), baseline G2. · Sources : docs/spec/03 §5*

**~~AR-018 · Typologie Light / Stratégique~~** — *Prochaine étape · non commencé · effort S* · **fait (Livraison 2)**  
Calcul sur le CA de référence, forçage, confirmation (C-5).  
*Avancement : Calcul (ratio ≥ 20 %, nouvelle usine), confirmation et forçage par le Dir.IG. · Sources : docs/spec/06 §1*

**~~AR-019 · Cycle DIG-PRODI paramétré : phases, K3, critères des jalons~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 2)**  
Livraison 2 (C-1).  
*Avancement : Modèle 4.0, moteur des critères et des transitions, décision directe du décideur en attendant les circuits (N-27) ; valeurs réglables. · Sources : docs/spec/03*

### 2.4 Dossiers vivants et circuits de décision (0 restants, 4 faits)

**~~AR-021 · Dossiers vivants : sections, complétude, versions, figement, empreinte~~** — *Prochaine étape · non commencé · effort L* · **fait (Livraison 3)**  
Livraison 3.  
*Avancement : Sections, complétude, versions, figement, empreinte SHA-256 vérifiée, vue imprimable (docs/DELIVERY-3.md). · Sources : docs/spec/04*

**~~AR-022 · Consultations d’experts, circuits G1 / K3 / G2 / G3, signature simple, Mes validations~~** — *Prochaine étape · non commencé · effort L* · **fait (Livraison 3)**  
Livraison 3 (C-7, N-6 à N-10).  
*Avancement : Circuits G1 / G2 / K3 / G3, avis d’experts, visas, signature simple (authentification récente, empreinte, append-only), Mes validations. Relances par e-mail : N-35. · Sources : docs/spec/05*

**~~AR-023 · Matrice de délégation et MoC~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 3)**  
Livraison 3 (C-4).  
*Avancement : Matrice datée réglable par l’administrateur, MoC routées et décidées. · Sources : docs/spec/05 §5*

**~~AR-024 · BP : VAN, TRI, délai de retour~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 3)**  
Livraison 3 (N-11).  
*Avancement : Saisie du BP sur 10 ans, VAN, TRI, délai de retour, validation par la DAF groupe. · Sources : docs/spec/06 §4*

### 2.5 Besoins machines et Keystone (1 restants, 3 faits)

**AR-029 · Vues Keystone pour Arche (catalogue, réponses, jalons, avancement, avenants, réserves, pack)** — *Prochaine étape · attend un système externe · effort L* · **en cours (Livraison 4)**  
K-01 à K-11.  
*Avancement : Côté Arche prêt (mode views, mixte) ; vues à publier par Keystone (R-186 à R-191). · Attend : Keystone (R-185 à R-193) · Sources : docs/DEMANDES-KEYSTONE.md*

**~~AR-020 · Vue pub_capex~~** — *Prochaine étape · non commencé · effort S* · **fait (Livraison 2)**  
Contrat publié pour Keystone et Matrix.  
*Avancement : drizzle/0005_share_capex.sql, contrat testé. · Sources : docs/CONTRATS.md §3*

**~~AR-027 · Connecteur keystone : simulation, miroir, liens profonds~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 4)**  
Livraison 4.  
*Avancement : src/server/integrations/keystone/ : miroir, simulation (jeu de démo), modes off / simulation / views, tâche keystone-sync, liens profonds. · Sources : docs/spec/07*

**~~AR-028 · Besoins machines, réponses EPC2i, passage à « commandé » au G2 ; vue pub_besoins_machines~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 4)**  
Livraison 4.  
*Avancement : docs/DELIVERY-4.md ; drizzle/0009_share_needs.sql ; commande au Go G2 testée. · Sources : docs/spec/07*

### 2.6 Documents (Codex) (2 restants)

**AR-025 · Connecteur codex : références de documents, vérification, dépôt des dossiers figés** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 3)**  
Tous les documents d’Arche dans Codex (N-17) ; simulation tant que l’API manque.  
*Avancement : Références Codex vérifiées dans codex.pub_documents (ou la simulation de démo), liens profonds ; dépôt des dossiers figés en attente de CX-03 / CX-07. · Sources : docs/DEMANDES-CODEX.md*

**AR-026 · API de dépôt et de lecture de Codex, rattachement CAPEX, types manquants** — *Prochaine étape · attend un système externe · effort M*  
CX-01 à CX-07.  
*Attend : Codex · Sources : docs/DEMANDES-CODEX.md*

### 2.7 Jalons de sécurité (Vigie) (1 restants, 1 faits)

**AR-033 · Études de sécurité des procédés dans Vigie (HazID, HazOp, PSSR, ASPD) et vue pub_etudes_securite** — *À décider · attend un système externe · effort L*  
VG-01 à VG-05 ; Vigie ne les modélise pas aujourd’hui.  
*Attend : Responsable produit (AC-3) puis Vigie · Sources : docs/DEMANDES-VIGIE.md*

**~~AR-032 · Jalons HS (déclaratifs) et registre des autorisations~~** — *Prochaine étape · non commencé · effort M* · **fait (L5)**  
Livraison 5 (C-3, N-13).  
*Avancement : Lot 5a : jalons HS déclarés par le SSE groupe (N-13) avec preuve, quitus PSSR par le circuit du G3, registre des autorisations, critères g1_hs2, g2_hs3, g2_permits, k3_hs4, g3_pssr, g3_hs6. · Sources : docs/spec/03 §4*

### 2.8 Tableaux de bord et gouvernance (1 restants, 3 faits)

**AR-034 · Pilote sur 1 à 2 CAPEX** — *Bloquant production · non commencé · effort M*  
Jeu production, utilisateurs réels, guides par rôle, mesure de référence (C-10).  
*Sources : docs/PLAN.md*

**~~AR-008 · Coquille, registre d’écrans, accueil, registre et fiche CAPEX, administration en lecture~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
25 écrans au registre ; ceux des livraisons suivantes affichent « prévu pour la livraison n ».  
*Sources : docs/spec/08*

**~~AR-030 · Tableaux de bord : synthèse, maturité des études, écart d’incertitude, S-curve, portefeuilles~~** — *Prochaine étape · non commencé · effort L* · **fait (L5)**  
Livraison 5.  
*Avancement : Synthèse du CAPEX, maturité des études (pack pondéré, parts filiale et EPC2i, tendance hebdomadaire), écart d’incertitude, courbe en S, SPI / CPI / EAC, portefeuilles groupe / zone / filiale ; à valider sur le jeu de démo par le responsable produit. · Sources : docs/spec/06 §3, §5*

**~~AR-031 · Revues, rapport Copil, audits ; écran COPIL GPI ; alertes à règles~~** — *Prochaine étape · non commencé · effort M* · **fait (L5)**  
Livraison 5 (N-19).  
*Avancement : Revues projet (cadence par typologie, retard, signalement au Dir.IG), audits transversaux par phase (N-19), rapport Copil imprimable, écran COPIL GPI, alertes à règles, instantanés hebdomadaires. · Sources : docs/spec/06 §2, §7*

### 2.9 Démarrage, montée en puissance et transfert (0 restants, 2 faits)

**~~AR-035 · Ramp-up : saisie journalière, TRS, 30 jours continus, 6 mois ; vue pub_rampup~~** — *Plus tard · non commencé · effort M* · **fait (L6)**  
Livraison 6 (N-16).  
*Avancement : MES après le PSSR, lignes de production et machines du parc, saisie journalière et import CSV, TRS, jour conforme, série de 30 jours (arrêts planifiés neutres), alertes M+5 / M+6, vue pub_rampup. · Sources : docs/spec/06 §6*

**~~AR-036 · Dossier Transfert & REX, PV de transfert contresigné, bibliothèque REX~~** — *Plus tard · non commencé · effort M* · **fait (L6)**  
Livraison 6 (N-15).  
*Avancement : Clôture comptable du CDG (N-15), critères G3 (ramp-up, délai, clôture, REX), REX par phase et bibliothèque, vue pub_rex (colonnes à confirmer avec Matrix et Keystone) ; PV de transfert contresigné dans le circuit du G3 (livraison 3). · Sources : docs/spec/04 §4*

### 2.10 Aide à la décision et signature avancée (1 restants)

**AR-037 · Aide à la décision (règles puis IA conforme) et signature avancée G2 / AFE** — *Plus tard · non commencé · effort M*  
Livraison 7 (C-7, C-13).  
*Sources : docs/PLAN.md*

### 2.11 Cadrage, décisions et données attendues (2 restants, 1 faits)

**AR-002 · Réponses du responsable produit aux questions de DECISIONS.md** — *À décider · attend le responsable produit · effort S* · **en cours**  
Restent ouvertes : N-26 à N-35 ; données à fournir D-1 à D-8.  
*Avancement : 22 oct. 2026 : réponse par défaut confirmée pour 51 questions. Restent N-26 à N-35 et les données D-1 à D-8. · Attend : Responsable produit · Sources : docs/DECISIONS.md*

**AR-003 · Données de référence des filiales** — *À décider · attend le responsable produit · effort S*  
Liste des filiales (code, pays, zone, devise), sites, CA de référence par exercice (C-5).  
*Avancement : Attendu dans le questionnaire : D-1 (filiales), D-2 (sites), D-3 (COPIL GPI), D-4 (premiers comptes). · Attend : Responsable produit / DAF groupe · Sources : docs/DECISIONS.md C-5, N-22*

**~~AR-001 · Cadrage de la livraison 0~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 0)**  
Spécification (docs/spec/00–08), décisions, contrats pub_, demandes aux autres applications, plan, socle.  
*Avancement : PR Yhumiii27/Arche#1 fusionnée le 22 oct. 2026 ; complété le 22 oct. par les demandes à Codex, Vigie, Cursus et Matrix. · Sources : docs/spec/, docs/DECISIONS.md*

## 3. Mises à jour

- 2026-10-23 — REX au contrat commun de Matrix (D22, option 1) : vue pub_rex_v2 (15 colonnes, phase en fin de vue, migration 0016), recommandation facultative d'un REX (migration 0015) ; pub_rex v1 inchangée. Demande de Matrix marquée FAITE, M-13 mise à jour, K-13 retirée (doublon de la demande de Matrix chez Keystone).
- 2026-10-23 — Demandes déposées (validées par Guillaume) : M-13 chez Matrix (partage de pub_rampup et pub_rex, REX réuni, Yhumiii27/Matrix#21) et K-13 chez Keystone (keystone.pub_rex au contrat commun, Yhumiii27/Keystone#27).
- 2026-10-23 — Livraison 6 : début de la MES après le PSSR, lignes de production, saisie journalière et import CSV du ramp-up, série de 30 jours conformes, alertes M+5 / M+6, clôture comptable du CDG, REX et bibliothèque, vues pub_rampup et pub_rex, critères du G3 évalués ; CAPEX de démo en démarrage.
- 2026-10-22 — Livraison 5, lot 5b : revues projet et audits transversaux, rapport Copil imprimable, écran COPIL GPI, portefeuille groupe / zone / filiale avec maturité des études, alertes à règles sur l’accueil, la synthèse et le portefeuille, instantanés hebdomadaires. Livraison 5 terminée, à valider sur le jeu de démo.
- 2026-10-22 — Livraison 5, lot 5a : jalons HS déclarés par le SSE groupe, registre des autorisations, pack ingénierie (part filiale et part EPC2i lue dans Keystone), engagé / réalisé mensuel et import CSV, courbe en S avec SPI, CPI, EAC et écart d’incertitude ; critères HS, autorisations, pack et travaux des jalons évalués.
- 2026-10-22 — Livraison 4b (interface, maquettes validées) : menu par thèmes, section CAPEX toujours visible avec sélecteur de CAPEX, recherche ⌘K, actions en boutons et panneaux, « Nouveau CAPEX », prochaine étape sur la synthèse, carte des CAPEX reprise de Keystone et sélecteur de zone ; demandes déposées chez Keystone, Matrix (M-10 à M-12) et Codex.
- 2026-10-22 — Kit Coolify du serveur commun : deploy/compose.shared.yaml (migrate, app, worker sur le réseau coolify, base epc2i-postgres), authentification HTTP de la bêta par un middleware Traefik dans les étiquettes, runbook EXPLOITATION.md § 4 (ressource, variables, contrôles, partage 70/90/95).
- 2026-10-22 — Livraison 4 : besoins machines (catalogue, soumission, retrait, commande au Go G2), vue pub_besoins_machines, connecteur Keystone (miroir, simulation, mode mixte, synchronisation), suivi des projets EPC2i, critères G2 / K3 / G3 ; kit Coolify testé de bout en bout en CI.
- 2026-10-22 — Livraison 3 : dossiers vivants (versions, figement, empreinte, impression), circuits des jalons G1 / G2 / K3 / G3 avec avis, visas et signature simple, Mes validations, matrice de délégation et MoC, BP (VAN, TRI, retour), connecteur Codex (références vérifiées).
- 2026-10-22 — Décisions D21, D22 et P-01 de Matrix reportées dans la spécification : référentiels du groupe tenus par Matrix (zones, subsidiaries, sites d'Arche deviennent des miroirs de matrix.pub_*), REX publié (pub_rex), PostgreSQL 16.
- 2026-10-22 — Questionnaire : réponse par défaut confirmée pour 51 questions, reportée dans DECISIONS.md ; restent N-26 à N-29 et les données D-1 à D-8.
- 2026-10-22 — Livraison 2 : CAPEX et cycle DIG-PRODI — brouillon et ouverture, lots, versions de budget E50 / E30 / E10, typologie, équipe et gabarit, critères des jalons et décisions G1 / G2 / K3 / G3, risques, décisions, journal, modèle DIG-PRODI réglable, vue pub_capex.
- 2026-10-22 — Livraison 1b : administration en écriture, connexion Entra testée de bout en bout, déclaration à Matrix, pub_journal, worker et sauvegardes ; questionnaire « Décisions Arche » publié.
- 2026-10-22 — Livraison 1 (socle) : socle repris de Keystone (63f43ad) sur PostgreSQL seul, connexion Entra et démo, 13 profils et isolation par filiale, coquille, CI. Demandes à Codex, Vigie, Cursus et Matrix ajoutées.
- 2026-10-22 — Livraison 0 (cadrage) : inventaire initial aligné sur docs/PLAN.md.
