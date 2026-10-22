# Arche — reste à développer

Inventaire initial du 2026-10-22, mis à jour le 2026-10-22 (branche `claude/brave-curie-chxbck`). Il recense ce qu'il reste à développer, à brancher, à décider ou à mettre en production pour Arche, aligné sur le plan de livraisons (`docs/PLAN.md`). Il est tenu à jour à chaque développement : un point passe « en cours » quand une livraison le prend, « fait » quand il est intégré et vérifié. Le détail est dans `docs/reste-a-developper.json` ; ce document et la page sont produits par `npm run remaining:page`.

**Lecture.** Priorité : Bloquant production, Prochaine étape, À décider (il faut d'abord trancher), Plus tard. Effort, pour un développeur qui connaît le code : S < 2 jours, M ≤ 1 semaine, L ≤ 3 semaines, XL > 3 semaines. Les identifiants entre parenthèses renvoient aux décisions (`docs/DECISIONS.md`) et aux demandes (`docs/DEMANDES-*.md`).

## 1. En bref

**Avancement** : 16 faits, 1 en cours, 21 à faire, sur 38 points.

| Priorité | Points restants | Effort estimé (jours) |
|---|---:|---:|
| Bloquant production | 3 | ≈ 7 |
| Prochaine étape | 12 | ≈ 80 |
| À décider | 3 | ≈ 15 |
| Plus tard | 4 | ≈ 16 |
| **Total** | **22** | **≈ 118** |

L'effort est un ordre de grandeur (S = 1,5 j, M = 4 j, L = 12 j, XL = 30 j) : il ne compte ni l'attente des décisions et des données, ni les développements à faire côté Keystone, Codex, Vigie, Cursus ou Matrix, ni la recette.

| Statut (points restants) | Points |
|---|---:|
| Non commencé | 14 |
| Partiel | 0 |
| Attend le responsable produit | 3 |
| Attend un système externe | 5 |

| Domaine | Bloquant production | Prochaine étape | À décider | Plus tard | Restants | Faits |
|---|---:|---:|---:|---:|---:|---:|
| Plateforme et mise en production | 2 | 0 | 0 | 1 | 3 | 5 |
| Connexion, profils et isolation par filiale | 0 | 0 | 0 | 0 | 0 | 4 |
| CAPEX et cycle DIG-PRODI | 0 | 0 | 0 | 0 | 0 | 4 |
| Dossiers vivants et circuits de décision | 0 | 4 | 0 | 0 | 4 | 0 |
| Besoins machines et Keystone | 0 | 3 | 0 | 0 | 3 | 1 |
| Documents (Codex) | 0 | 2 | 0 | 0 | 2 | 0 |
| Jalons de sécurité (Vigie) | 0 | 1 | 1 | 0 | 2 | 0 |
| Tableaux de bord et gouvernance | 1 | 2 | 0 | 0 | 3 | 1 |
| Démarrage, montée en puissance et transfert | 0 | 0 | 0 | 2 | 2 | 0 |
| Aide à la décision et signature avancée | 0 | 0 | 0 | 1 | 1 | 0 |
| Cadrage, décisions et données attendues | 0 | 0 | 2 | 0 | 2 | 1 |

### 1.1 Chemin critique vers la production

Les points « Bloquant production » restants, par domaine. Sans eux, Arche reste une démonstration.

- **Plateforme et mise en production** : AR-014 Arche sur le serveur PostgreSQL commun (Matrix) ; AR-015 Hébergement en France et choix du serveur de production.
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

**AR-014 · Arche sur le serveur PostgreSQL commun (Matrix)** — *Bloquant production · attend un système externe · effort S*  
Rôle, schéma, droits, partage, journal unifié, sauvegarde, déclaration des tables.  
*Attend : Matrix (M-1 à M-8) · Sources : docs/DEMANDES-MATRIX.md*

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
*Sources : Dockerfile, deploy/, .github/workflows/ci.yml*

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

### 2.4 Dossiers vivants et circuits de décision (4 restants)

**AR-021 · Dossiers vivants : sections, complétude, versions, figement, empreinte** — *Prochaine étape · non commencé · effort L*  
Livraison 3.  
*Sources : docs/spec/04*

**AR-022 · Consultations d’experts, circuits G1 / K3 / G2 / G3, signature simple, Mes validations** — *Prochaine étape · non commencé · effort L*  
Livraison 3 (C-7, N-6 à N-10).  
*Sources : docs/spec/05*

**AR-023 · Matrice de délégation et MoC** — *Prochaine étape · non commencé · effort M*  
Livraison 3 (C-4).  
*Sources : docs/spec/05 §5*

**AR-024 · BP : VAN, TRI, délai de retour** — *Prochaine étape · non commencé · effort M*  
Livraison 3 (N-11).  
*Sources : docs/spec/06 §4*

### 2.5 Besoins machines et Keystone (3 restants, 1 faits)

**AR-027 · Connecteur keystone : simulation, miroir, liens profonds** — *Prochaine étape · non commencé · effort M*  
Livraison 4.  
*Sources : docs/spec/07*

**AR-028 · Besoins machines, réponses EPC2i, passage à « commandé » au G2 ; vue pub_besoins_machines** — *Prochaine étape · non commencé · effort M*  
Livraison 4.  
*Sources : docs/spec/07*

**AR-029 · Vues Keystone pour Arche (catalogue, réponses, jalons, avancement, avenants, réserves, pack)** — *Prochaine étape · attend un système externe · effort L*  
K-01 à K-11.  
*Attend : Keystone (R-185 à R-193) · Sources : docs/DEMANDES-KEYSTONE.md*

**~~AR-020 · Vue pub_capex~~** — *Prochaine étape · non commencé · effort S* · **fait (Livraison 2)**  
Contrat publié pour Keystone et Matrix.  
*Avancement : drizzle/0005_share_capex.sql, contrat testé. · Sources : docs/CONTRATS.md §3*

### 2.6 Documents (Codex) (2 restants)

**AR-025 · Connecteur codex : références de documents, vérification, dépôt des dossiers figés** — *Prochaine étape · non commencé · effort M*  
Tous les documents d’Arche dans Codex (N-17) ; simulation tant que l’API manque.  
*Sources : docs/DEMANDES-CODEX.md*

**AR-026 · API de dépôt et de lecture de Codex, rattachement CAPEX, types manquants** — *Prochaine étape · attend un système externe · effort M*  
CX-01 à CX-07.  
*Attend : Codex · Sources : docs/DEMANDES-CODEX.md*

### 2.7 Jalons de sécurité (Vigie) (2 restants)

**AR-032 · Jalons HS (déclaratifs) et registre des autorisations** — *Prochaine étape · non commencé · effort M*  
Livraison 5 (C-3, N-13).  
*Sources : docs/spec/03 §4*

**AR-033 · Études de sécurité des procédés dans Vigie (HazID, HazOp, PSSR, ASPD) et vue pub_etudes_securite** — *À décider · attend un système externe · effort L*  
VG-01 à VG-05 ; Vigie ne les modélise pas aujourd’hui.  
*Attend : Responsable produit (AC-3) puis Vigie · Sources : docs/DEMANDES-VIGIE.md*

### 2.8 Tableaux de bord et gouvernance (3 restants, 1 faits)

**AR-034 · Pilote sur 1 à 2 CAPEX** — *Bloquant production · non commencé · effort M*  
Jeu production, utilisateurs réels, guides par rôle, mesure de référence (C-10).  
*Sources : docs/PLAN.md*

**AR-030 · Tableaux de bord : synthèse, maturité des études, écart d’incertitude, S-curve, portefeuilles** — *Prochaine étape · non commencé · effort L*  
Livraison 5.  
*Sources : docs/spec/06 §3, §5*

**AR-031 · Revues, rapport Copil, audits ; écran COPIL GPI ; alertes à règles** — *Prochaine étape · non commencé · effort M*  
Livraison 5 (N-19).  
*Sources : docs/spec/06 §2, §7*

**~~AR-008 · Coquille, registre d’écrans, accueil, registre et fiche CAPEX, administration en lecture~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
25 écrans au registre ; ceux des livraisons suivantes affichent « prévu pour la livraison n ».  
*Sources : docs/spec/08*

### 2.9 Démarrage, montée en puissance et transfert (2 restants)

**AR-035 · Ramp-up : saisie journalière, TRS, 30 jours continus, 6 mois ; vue pub_rampup** — *Plus tard · non commencé · effort M*  
Livraison 6 (N-16).  
*Sources : docs/spec/06 §6*

**AR-036 · Dossier Transfert & REX, PV de transfert contresigné, bibliothèque REX** — *Plus tard · non commencé · effort M*  
Livraison 6 (N-15).  
*Sources : docs/spec/04 §4*

### 2.10 Aide à la décision et signature avancée (1 restants)

**AR-037 · Aide à la décision (règles puis IA conforme) et signature avancée G2 / AFE** — *Plus tard · non commencé · effort M*  
Livraison 7 (C-7, C-13).  
*Sources : docs/PLAN.md*

### 2.11 Cadrage, décisions et données attendues (2 restants, 1 faits)

**AR-002 · Réponses du responsable produit aux questions de DECISIONS.md** — *À décider · attend le responsable produit · effort S* · **en cours**  
Les réponses par défaut s’appliquent tant qu’il n’y a pas d’autre réponse ; à confirmer en priorité : N-3, N-4, C-6, C-13, N-22, N-24.  
*Avancement : Reçu le 22 oct. 2026 : nom Arche, PostgreSQL uniquement, Codex pour tous les documents ; questionnaire : C-6, N-3, N-4, N-22, N-24 confirmées (défaut). N-26 à N-29 ajoutées au questionnaire par la livraison 2. · Attend : Responsable produit · Sources : docs/DECISIONS.md*

**AR-003 · Données de référence des filiales** — *À décider · attend le responsable produit · effort S*  
Liste des filiales (code, pays, zone, devise), sites, CA de référence par exercice (C-5).  
*Attend : Responsable produit / DAF groupe · Sources : docs/DECISIONS.md C-5, N-22*

**~~AR-001 · Cadrage de la livraison 0~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 0)**  
Spécification (docs/spec/00–08), décisions, contrats pub_, demandes aux autres applications, plan, socle.  
*Avancement : PR Yhumiii27/Arche#1 fusionnée le 22 oct. 2026 ; complété le 22 oct. par les demandes à Codex, Vigie, Cursus et Matrix. · Sources : docs/spec/, docs/DECISIONS.md*

## 3. Mises à jour

- 2026-10-22 — Livraison 2 : CAPEX et cycle DIG-PRODI — brouillon et ouverture, lots, versions de budget E50 / E30 / E10, typologie, équipe et gabarit, critères des jalons et décisions G1 / G2 / K3 / G3, risques, décisions, journal, modèle DIG-PRODI réglable, vue pub_capex.
- 2026-10-22 — Livraison 1b : administration en écriture, connexion Entra testée de bout en bout, déclaration à Matrix, pub_journal, worker et sauvegardes ; questionnaire « Décisions Arche » publié.
- 2026-10-22 — Livraison 1 (socle) : socle repris de Keystone (63f43ad) sur PostgreSQL seul, connexion Entra et démo, 13 profils et isolation par filiale, coquille, CI. Demandes à Codex, Vigie, Cursus et Matrix ajoutées.
- 2026-10-22 — Livraison 0 (cadrage) : inventaire initial aligné sur docs/PLAN.md.
