# Arche — reste à développer

Inventaire initial du 2026-10-22, mis à jour le 2026-10-29 (branche `claude/brave-curie-chxbck`). Il recense ce qu'il reste à développer, à brancher, à décider ou à mettre en production pour Arche, aligné sur le plan de livraisons (`docs/PLAN.md`). Il est tenu à jour à chaque développement : un point passe « en cours » quand une livraison le prend, « fait » quand il est intégré et vérifié. Le détail est dans `docs/reste-a-developper.json` ; ce document et la page sont produits par `npm run remaining:page`.

**Lecture.** Priorité : Bloquant production, Prochaine étape, À décider (il faut d'abord trancher), Plus tard. Effort, pour un développeur qui connaît le code : S < 2 jours, M ≤ 1 semaine, L ≤ 3 semaines, XL > 3 semaines. Les identifiants entre parenthèses renvoient aux décisions (`docs/DECISIONS.md`) et aux demandes (`docs/DEMANDES-*.md`).

## 1. En bref

**Avancement** : 30 faits, 17 en cours, 5 à faire, sur 52 points.

| Priorité | Points restants | Effort estimé (jours) |
|---|---:|---:|
| Bloquant production | 3 | ≈ 7 |
| Prochaine étape | 14 | ≈ 88 |
| À décider | 3 | ≈ 15 |
| Plus tard | 2 | ≈ 8 |
| **Total** | **22** | **≈ 118** |

L'effort est un ordre de grandeur (S = 1,5 j, M = 4 j, L = 12 j, XL = 30 j) : il ne compte ni l'attente des décisions et des données, ni les développements à faire côté Keystone, Codex, Vigie, Cursus ou Matrix, ni la recette.

| Statut (points restants) | Points |
|---|---:|
| Non commencé | 13 |
| Partiel | 0 |
| Attend le responsable produit | 3 |
| Attend un système externe | 6 |

| Domaine | Bloquant production | Prochaine étape | À décider | Plus tard | Restants | Faits |
|---|---:|---:|---:|---:|---:|---:|
| Plateforme et mise en production | 2 | 0 | 0 | 1 | 3 | 7 |
| Connexion, profils et isolation par filiale | 0 | 0 | 0 | 0 | 0 | 4 |
| CAPEX et cycle DIG-PRODI | 0 | 4 | 0 | 0 | 4 | 4 |
| Dossiers vivants et circuits de décision | 0 | 2 | 0 | 0 | 2 | 4 |
| Besoins machines et Keystone | 0 | 1 | 0 | 0 | 1 | 3 |
| Documents (Codex) | 0 | 2 | 0 | 0 | 2 | 0 |
| Jalons de sécurité (Vigie) | 0 | 0 | 1 | 0 | 1 | 1 |
| Tableaux de bord et gouvernance | 1 | 3 | 0 | 0 | 4 | 4 |
| Démarrage, montée en puissance et transfert | 0 | 2 | 0 | 0 | 2 | 2 |
| Aide à la décision et signature avancée | 0 | 0 | 0 | 1 | 1 | 0 |
| Cadrage, décisions et données attendues | 0 | 0 | 2 | 0 | 2 | 1 |

### 1.1 Chemin critique vers la production

Les points « Bloquant production » restants, par domaine. Sans eux, Arche reste une démonstration.

- **Plateforme et mise en production** : AR-014 Arche sur le serveur PostgreSQL commun (Matrix) *(en cours, Livraison 3)* ; AR-015 Hébergement en France et choix du serveur de production *(en cours)*.
- **Tableaux de bord et gouvernance** : AR-034 Pilote sur 1 à 2 CAPEX *(en cours, Pilote)*.

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
- **AR-047** Import des réalisés et des engagements depuis l’ERP (Sage) par API — DSI (accès à Sage : API ou extraction planifiée) ; N-14

## 2. Liste détaillée par domaine

### 2.1 Plateforme et mise en production (3 restants, 7 faits)

**AR-014 · Arche sur le serveur PostgreSQL commun (Matrix)** — *Bloquant production · attend un système externe · effort S* · **en cours (Livraison 3)**  
Rôle, schéma, droits, partage, journal unifié, sauvegarde, déclaration des tables. Analyse comparative du 25 oct. 2026 : le serveur PostgreSQL commun est un prérequis d’échelle que les solutions du commerce apportent en SaaS ; sans lui, Arche reste une démonstration. Priorité suggérée : bloquant, inchangée.  
*Avancement : Kit Coolify du serveur commun (deploy/compose.shared.yaml, EXPLOITATION.md § 4.1) essayé en local contre le socle de Matrix : migrations, jeu de démonstration, santé, sauvegarde, partage 70/90/95. Reste : mise en service dans Coolify. · Attend : Matrix (M-1 à M-8) · Sources : docs/DEMANDES-MATRIX.md*

**AR-015 · Hébergement en France et choix du serveur de production** — *Bloquant production · attend le responsable produit · effort S* · **en cours**  
D-11 / C-13 ; même décision que Keystone (I-1a). Analyse comparative du 25 oct. 2026 : l’hébergement en France est le prérequis de tout déploiement réel (les solutions du commerce sont hébergées en SaaS, souvent hors UE) ; à trancher avant toute autre évolution. Priorité suggérée : bloquant, inchangée.  
*Avancement : 24 oct. 2026 : déploiement automatique prêt (workflow Deploy → webhook Coolify, ou Auto Deploy de Coolify ; EXPLOITATION.md § 4.4). Reste le serveur (hébergement en France, C-13). · Attend : Responsable produit et DSI · Sources : docs/DECISIONS.md C-13*

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

**~~AR-048 · API REST métier et webhooks~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 7, lot 7a)**  
API REST authentifiée par clé signée (comme `POST /api/import` de Codex) exposant les CAPEX, les jalons, les budgets et les besoins en lecture, et la création ou mise à jour de quelques objets (réalisé mensuel, action) ; webhooks sur les événements (décision de jalon, ouverture, alerte) pour Keystone, Codex et les outils du groupe. Seule `/api/health` existe ; les autres applications lisent les vues `pub_`. Analyse comparative du 25 oct. 2026 : standard du marché (Unifier, Finario) ; priorité suggérée : à décider.  
*Avancement : API /api/v1 (clé par application créée par l'administrateur, empreinte seule ; périmètre de filiales) : CAPEX, détail, réalisés ; écritures signées (HMAC, anti-rejeu) des réalisés et des actions ; webhooks capex.opened, gate.decided, alert.raised signés, envoyés par le worker avec reprises ; écran Administration › API et webhooks (docs/API.md). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/CONTRATS.md*

**~~AR-049 · Verrouillage optimiste (champ version) et performance des vues de portefeuille~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 7, lot 7a)**  
Champ `version` sur les objets modifiés par plusieurs profils (CAPEX, budget, dossiers, étapes de circuit) vérifié par chaque Server Function pour refuser une écriture sur une version périmée ; lecture des portefeuilles et des alertes en une requête par vue au lieu d’une par CAPEX (`portfolioDashboard`, `alertsForViewer` : N+1), avec un test de charge sur un jeu de 200 CAPEX. Analyse comparative du 25 oct. 2026 : prérequis d’échelle avant un déploiement à toutes les filiales ; priorité suggérée : à décider (avant le pilote élargi).  
*Avancement : Colonne row_version (CAPEX, versions de budget, versions de dossier, étapes de circuit) et déclencheur ; écriture refusée sur une version périmée (fiche, budget, étape ; dossier par section) ; portefeuilles, alertes, registre et Gantt en un nombre fixe de requêtes (test de charge : 200 CAPEX). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026*

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

### 2.3 CAPEX et cycle DIG-PRODI (4 restants, 4 faits)

**AR-039 · Multi-devises : devise par filiale, taux de change datés, consolidation en euros** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Montants des budgets, de l’engagé et du réalisé saisis dans la devise de la filiale (`subsidiaries.currency`, stockée mais inutilisée), table des taux de change datés tenue par la DAF groupe (taux de référence par exercice ou par mois), conversion et consolidation en k€ dans les portefeuilles, les dossiers et les vues `pub_`. Arche ne connaît aujourd’hui que le k€ (N-2). Analyse comparative du 25 oct. 2026 : niveau avancé du marché (Anaplan, CapEx360) mais indispensable pour un groupe multi-pays ; priorité suggérée : prochaine étape.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/DECISIONS.md N-2*

**AR-045 · Cash-flow prévisionnel phasé par mois et comparé à la baseline G2** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Phasage mensuel prévisionnel des décaissements de chaque lot saisi par le chef de projet ou le CDG (et non une répartition uniforme sur la fenêtre du lot), re-prévision à chaque mois (reste à dépenser), comparaison de la prévision à la baseline G2 et au réalisé sur la courbe en S, consolidation par filiale et par exercice pour la trésorerie du groupe. Arche saisit l’engagé et le réalisé mensuels mais ne phase pas la prévision. Analyse comparative du 25 oct. 2026 : niveau avancé du marché (Unifier, Board) ; priorité suggérée : à décider.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/spec/06-gouvernance-pilotage.md*

**AR-047 · Import des réalisés et des engagements depuis l’ERP (Sage) par API** — *Prochaine étape · attend un système externe · effort M* · **en cours (Livraison 7)**  
Rapprochement automatique de l’engagé (commandes) et du réalisé (factures) des lots hors EPC2i depuis Sage, par API ou extraction planifiée, avec une table de correspondance compte / lot et un journal des rejets ; l’import CSV manuel du CDG reste disponible. Arche n’a aujourd’hui que l’import CSV manuel (N-14). Analyse comparative du 25 oct. 2026 : standard du marché par fichier, avancé par connecteur ; priorité suggérée : à décider.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Attend : DSI (accès à Sage : API ou extraction planifiée) ; N-14 · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/DECISIONS.md N-14, docs/DECISIONS.md C-12*

**AR-051 · Backlog d’idées d’investissement en amont de la demande formelle** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Idées d’investissement saisies par n’importe quel utilisateur de la filiale (titre, enjeu, ordre de grandeur), qualifiées par le sponsor ou le zone coordinator, retenues, écartées ou transformées en brouillon de CAPEX par l’assistant « Ouvrir un CAPEX » ; file d’idées visible au portefeuille filiale. Absent d’Arche, dont le cycle commence au brouillon. Analyse comparative du 25 oct. 2026 : niveau avancé du marché (CapEx360) ; priorité suggérée : plus tard.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026*

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

### 2.4 Dossiers vivants et circuits de décision (2 restants, 4 faits)

**AR-041 · Notifications e-mail aux étapes des circuits, relances, escalade automatique et délégation d’absence** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Envoi d’un e-mail à l’ouverture d’une étape de circuit, relances des étapes dues et en retard par le worker, escalade automatique au niveau supérieur après un délai paramétrable, délégation d’absence (un suppléant pour une période) ; préférences par utilisateur. Aucune notification aujourd’hui : les étapes dues n’apparaissent que dans « Mes validations » et sur la page du jalon (N-35). Analyse comparative du 25 oct. 2026 : standard du marché ; priorité suggérée : prochaine étape, dès le choix du transport.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Attend : Responsable produit / DSI : choix du transport (SMTP ou Microsoft Graph, N-35) · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/DECISIONS.md N-35, docs/spec/05-circuits.md*

**AR-052 · Concepteur no-code de formulaires et de circuits par l’administrateur** — *Prochaine étape · non commencé · effort L* · **en cours (Livraison 7)**  
Édition par l’administrateur, sans code, des sections et champs des dossiers vivants et des étapes des circuits (acteurs, délais, parallélisme, conditions), avec versions et prévisualisation. Le modèle DIG-PRODI d’Arche est paramétrable en valeurs (phases, critères, délais) mais sa structure est codée (`src/domain/dossiers.ts`, `src/domain/circuits.ts`). Analyse comparative du 25 oct. 2026 : différenciant du marché (Unifier uDesigner) ; priorité suggérée : plus tard.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026*

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
K-01 à K-11. Analyse comparative du 25 oct. 2026 : les intégrations réelles (vues Keystone publiées à la place de la simulation, dépôt Codex, jalons HS lus dans Vigie, données Cursus pour les formations du transfert, CU-02) sont le niveau standard des logiciels CAPEX ; tant qu’elles manquent, Arche fonctionne en mode simulé. Priorité suggérée : prochaine étape, inchangée.  
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
Tous les documents d’Arche dans Codex (N-17) ; simulation tant que l’API manque. Analyse comparative du 25 oct. 2026 : le dépôt réel des dossiers figés dans Codex (aujourd’hui simulé) fait partie des intégrations attendues en standard (gestion documentaire intégrée chez Unifier, Finario, CapEx360). Priorité suggérée : prochaine étape, inchangée.  
*Avancement : Références Codex vérifiées dans codex.pub_documents (ou la simulation de démo), liens profonds ; dépôt des dossiers figés en attente de CX-03 / CX-07. · Sources : docs/DEMANDES-CODEX.md*

**AR-026 · API de dépôt et de lecture de Codex, rattachement CAPEX, types manquants** — *Prochaine étape · attend un système externe · effort M*  
CX-01 à CX-07. Analyse comparative du 25 oct. 2026 : les pièces jointes et devis fournisseurs sur la demande d’investissement sont un standard du marché ; Arche les délègue à Codex, mais le lien de dépôt depuis Arche n’est pas branché tant que CX-03 et CX-07 manquent. Priorité suggérée : prochaine étape, haute pour CX-03.  
*Attend : Codex · Sources : docs/DEMANDES-CODEX.md*

### 2.7 Jalons de sécurité (Vigie) (1 restants, 1 faits)

**AR-033 · Études de sécurité des procédés dans Vigie (HazID, HazOp, PSSR, ASPD) et vue pub_etudes_securite** — *À décider · attend un système externe · effort L*  
VG-01 à VG-05 ; Vigie ne les modélise pas aujourd’hui. Analyse comparative du 25 oct. 2026 : les jalons HS lus depuis Vigie (aujourd’hui déclarés à la main avec un champ texte de référence) relèvent des intégrations standard attendues ; l’arbitrage AC-3 conditionne le périmètre. Priorité suggérée : à décider, inchangée.  
*Attend : Responsable produit (AC-3) puis Vigie · Sources : docs/DEMANDES-VIGIE.md*

**~~AR-032 · Jalons HS (déclaratifs) et registre des autorisations~~** — *Prochaine étape · non commencé · effort M* · **fait (L5)**  
Livraison 5 (C-3, N-13).  
*Avancement : Lot 5a : jalons HS déclarés par le SSE groupe (N-13) avec preuve, quitus PSSR par le circuit du G3, registre des autorisations, critères g1_hs2, g2_hs3, g2_permits, k3_hs4, g3_pssr, g3_hs6. · Sources : docs/spec/03 §4*

### 2.8 Tableaux de bord et gouvernance (4 restants, 4 faits)

**AR-034 · Pilote sur 1 à 2 CAPEX** — *Bloquant production · non commencé · effort M* · **en cours (Pilote)**  
Jeu production, utilisateurs réels, guides par rôle, mesure de référence (C-10). Analyse comparative du 25 oct. 2026 : le pilote sur des données réelles des filiales est le prérequis de toute comparaison utile avec les solutions du commerce ; les écarts fonctionnels relevés (AR-039 à AR-052) seront priorisés sur ses retours. Priorité suggérée : bloquant, inchangée.  
*Avancement : 23 oct. 2026 : lot de développement fait — reprise d'un CAPEX en cours par le Sponsor (N-20), écran Objectifs DIG-PRODI et référence de l'existant (C-10), guides par rôle, procédure et journal des retours. Restent les prérequis du responsable produit (hébergement C-13, Entra, D-1 à D-4, relevé de l'existant, choix des CAPEX) et les corrections issues des retours. 24 oct. 2026 : premiers retours du responsable produit traités (assistant d'ouverture, menus, carte, données de démo, langue) ; plan d'actions et WBS / Gantt à venir. · Sources : docs/PLAN.md*

**AR-040 · Enveloppes budgétaires annuelles et pluriannuelles par filiale, zone et catégorie ; contrôle de disponibilité, reports et réallocations** — *Prochaine étape · non commencé · effort L* · **en cours (Livraison 7)**  
Enveloppe CAPEX votée par exercice (et plan pluriannuel) par filiale, zone et catégorie (typologie Light / Stratégique, nature), consommation par les CAPEX ouverts, contrôle de disponibilité à l’ouverture et au G2 (alerte ou blocage hors enveloppe selon un seuil), reports d’un exercice à l’autre et réallocations tracées entre filiales. Arche ne connaît que le budget de chaque CAPEX (versions E50 / E30 / E10) ; aucune enveloppe ni blocage hors budget. Analyse comparative du 25 oct. 2026 : standard du marché (CapEx360, eCapEx, SAP IM) ; priorité suggérée : prochaine étape.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/spec/06-gouvernance-pilotage.md*

**AR-043 · Scénarios what-if de portefeuille sous contrainte d’enveloppe groupe (base, contraint, croissance)** — *Prochaine étape · non commencé · effort L* · **en cours (Livraison 7)**  
Scénarios de portefeuille nommés (base, contraint, croissance) : sélection et décalage de CAPEX, enveloppe groupe par exercice, comparaison des scénarios (dépense, retour, risques) et retenue d’un scénario pour le COPIL GPI. Dépend des enveloppes (AR-040). Absent d’Arche. Analyse comparative du 25 oct. 2026 : niveau avancé du marché (Planisware, Finario, Board) ; priorité suggérée : à décider.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026*

**AR-044 · Scoring multicritère de priorisation (valeur, risque, alignement stratégique) et classement inter-pays** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Grille de critères pondérés tenue par le groupe (valeur financière du BP, risque, alignement stratégique, urgence, sécurité), note de chaque CAPEX saisie ou calculée, classement des CAPEX entre filiales et zones sur le portefeuille groupe et au COPIL GPI. Arche n’a que la typologie Light / Stratégique et les alertes à règles. Analyse comparative du 25 oct. 2026 : standard des outils de gestion de portefeuille ; priorité suggérée : à décider.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026*

**~~AR-008 · Coquille, registre d’écrans, accueil, registre et fiche CAPEX, administration en lecture~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 1)**  
25 écrans au registre ; ceux des livraisons suivantes affichent « prévu pour la livraison n ».  
*Sources : docs/spec/08*

**~~AR-030 · Tableaux de bord : synthèse, maturité des études, écart d’incertitude, S-curve, portefeuilles~~** — *Prochaine étape · non commencé · effort L* · **fait (L5)**  
Livraison 5.  
*Avancement : Synthèse du CAPEX, maturité des études (pack pondéré, parts filiale et EPC2i, tendance hebdomadaire), écart d’incertitude, courbe en S, SPI / CPI / EAC, portefeuilles groupe / zone / filiale ; à valider sur le jeu de démo par le responsable produit. · Sources : docs/spec/06 §3, §5*

**~~AR-031 · Revues, rapport Copil, audits ; écran COPIL GPI ; alertes à règles~~** — *Prochaine étape · non commencé · effort M* · **fait (L5)**  
Livraison 5 (N-19).  
*Avancement : Revues projet (cadence par typologie, retard, signalement au Dir.IG), audits transversaux par phase (N-19), rapport Copil imprimable, écran COPIL GPI, alertes à règles, instantanés hebdomadaires. · Sources : docs/spec/06 §2, §7*

**~~AR-042 · Exports CSV / XLSX / PDF des registres, portefeuilles et dossiers ; connecteur Power BI~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 7, lot 7a)**  
Export CSV et XLSX du registre des CAPEX, des portefeuilles, du suivi engagé / réalisé et des alertes (colonnes du contrat `pub_capex`) ; export PDF serveur des dossiers figés et du rapport Copil (aujourd’hui des vues imprimables HTML seulement) ; connecteur Power BI (lecture des vues `pub_` par un compte dédié, ou flux OData). Analyse comparative du 25 oct. 2026 : standard du marché ; priorité suggérée : prochaine étape.  
*Avancement : Exports Excel et CSV du registre, des portefeuilles groupe et filiale, des alertes et de l'engagé / réalisé (en-tête de chaque page, mêmes droits) ; PDF du rapport Copil et des versions de dossier écrit par le serveur ; Power BI par l'API en lecture (docs/API.md §7), rôle de lecture des vues pub_ demandé à Matrix (M-14). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/CONTRATS.md*

### 2.9 Démarrage, montée en puissance et transfert (2 restants, 2 faits)

**AR-046 · Bénéfices réalisés contre le business plan approuvé ; post-audit automatique N mois après la mise en service** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Suivi des gains du BP approuvé au G2 (chiffre d’affaires, économies, productivité) contre les gains constatés après la mise en service, saisis par le CDG ou le sponsor ; post-audit programmé automatiquement N mois (6, 12, 24) après la MES avec son circuit et son compte rendu ; VAN et TRI recalculés sur le réalisé. Arche a le ramp-up et la clôture des coûts, mais aucun suivi des gains du BP. Analyse comparative du 25 oct. 2026 : niveau avancé du marché (Finario, eCapEx) ; priorité suggérée : à décider.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026, docs/spec/03-cycle-dig-prodi.md*

**AR-050 · Dépréciation simulée, durée de vie par classe d’actif, transfert en immobilisation** — *Prochaine étape · non commencé · effort M* · **en cours (Livraison 7)**  
Classes d’actifs avec durée de vie et méthode d’amortissement, simulation de la dépréciation dès le BP (charge annuelle, impact résultat), transfert des lots en immobilisations à la clôture comptable avec date de mise en service et export vers la comptabilité (Sage FI-AA). Absent d’Arche. Analyse comparative du 25 oct. 2026 : niveau avancé du marché (Jedox, SAP FI-AA) ; priorité suggérée : plus tard.  
*Avancement : Retenu par le responsable produit le 29 oct. 2026 (DECISIONS.md §5). · Sources : Analyse comparative avec les solutions du commerce, 25 oct. 2026*

**~~AR-035 · Ramp-up : saisie journalière, TRS, 30 jours continus, 6 mois ; vue pub_rampup~~** — *Plus tard · non commencé · effort M* · **fait (L6)**  
Livraison 6 (N-16).  
*Avancement : MES après le PSSR, lignes de production et machines du parc, saisie journalière et import CSV, TRS, jour conforme, série de 30 jours (arrêts planifiés neutres), alertes M+5 / M+6, vue pub_rampup. · Sources : docs/spec/06 §6*

**~~AR-036 · Dossier Transfert & REX, PV de transfert contresigné, bibliothèque REX~~** — *Plus tard · non commencé · effort M* · **fait (L6)**  
Livraison 6 (N-15).  
*Avancement : Clôture comptable du CDG (N-15), critères G3 (ramp-up, délai, clôture, REX), REX par phase et bibliothèque, vue pub_rex (colonnes à confirmer avec Matrix et Keystone) ; PV de transfert contresigné dans le circuit du G3 (livraison 3). · Sources : docs/spec/04 §4*

### 2.10 Aide à la décision et signature avancée (1 restants)

**AR-037 · Aide à la décision (règles puis IA conforme) et signature avancée G2 / AFE** — *Plus tard · non commencé · effort M*  
Livraison 7 (C-7, C-13). Analyse comparative du 25 oct. 2026 : la signature électronique qualifiée (DocuSign, Adobe Sign, Yousign) pour le G2 / AFE est un niveau avancé du marché (Unifier) ; l’IA de prévision de dérive des coûts et des délais et le benchmark d’une demande contre les CAPEX passés (Finario Predict) sont également avancés. Arche n’a qu’une signature simple par empreinte et des alertes à règles. Priorité suggérée : plus tard (après le pilote, livraison 7), inchangée.  
*Sources : docs/PLAN.md*

### 2.11 Cadrage, décisions et données attendues (2 restants, 1 faits)

**AR-002 · Réponses du responsable produit aux questions de DECISIONS.md** — *À décider · attend le responsable produit · effort S* · **en cours**  
Restent ouvertes : N-26 à N-35 ; données à fournir D-1 à D-8. Analyse comparative du 25 oct. 2026 : les décisions N-2 (devise des filiales), N-33 (provision pour aléas), N-34 (jours fériés dans les échéances) et N-35 (relances par e-mail) correspondent à des fonctions standard des logiciels CAPEX du commerce (CapEx360, eCapEx, SAP IM) ; la provision pour aléas et les calendriers de jours fériés des filiales sont attendus dès la mise en production (priorité suggérée : à décider avant le pilote élargi), la devise et les relances font l’objet des points AR-039 et AR-041.  
*Avancement : 22 oct. 2026 : réponse par défaut confirmée pour 51 questions. Restent N-26 à N-35 et les données D-1 à D-8. · Attend : Responsable produit · Sources : docs/DECISIONS.md*

**AR-003 · Données de référence des filiales** — *À décider · attend le responsable produit · effort S*  
Liste des filiales (code, pays, zone, devise), sites, CA de référence par exercice (C-5). Analyse comparative du 25 oct. 2026 : prérequis bloquant du pilote avec AR-014, AR-015 et AR-034 ; la liste des filiales avec leur devise conditionne aussi le multi-devises (AR-039). Priorité suggérée : bloquant, inchangée.  
*Avancement : Attendu dans le questionnaire : D-1 (filiales), D-2 (sites), D-3 (COPIL GPI), D-4 (premiers comptes). · Attend : Responsable produit / DAF groupe · Sources : docs/DECISIONS.md C-5, N-22*

**~~AR-001 · Cadrage de la livraison 0~~** — *Prochaine étape · non commencé · effort M* · **fait (Livraison 0)**  
Spécification (docs/spec/00–08), décisions, contrats pub_, demandes aux autres applications, plan, socle.  
*Avancement : PR Yhumiii27/Arche#1 fusionnée le 22 oct. 2026 ; complété le 22 oct. par les demandes à Codex, Vigie, Cursus et Matrix. · Sources : docs/spec/, docs/DECISIONS.md*

## 3. Mises à jour

- 2026-10-29 — Lot 7a : exports Excel / CSV / PDF (AR-042) ; API métier et webhooks (AR-048).
- 2026-10-29 — AR-039 à AR-052 retenus par le responsable produit (livraison 7). Lot 7a : verrouillage optimiste et lecture des portefeuilles en un nombre fixe de requêtes (AR-049).
- 2026-10-26 — Analyse comparative avec les solutions du commerce (25 oct. 2026) : 14 items ajoutés (AR-039 à AR-052), 10 items annotés.
- 2026-10-25 — Démo alignée sur Keystone : catalogue machines, réponses RB-001 à RB-005 et projet RCF-019 de la démo Keystone ; besoins de démo réécrits ; liens profonds vers Keystone corrigés ; demande K-14 (à valider).
- 2026-10-25 — Retours du pilote : toutes les actions d'une page dans son en-tête (selon les droits), liste « Actions » au-delà de trois ; étape de circuit à traiter en tête de la page Jalons et circuits.
- 2026-10-24 — Droits : l'administrateur lit tous les CAPEX et toutes les pages métier comme le PDG, sans droit d'écriture métier (N-4 révisée par le responsable produit).
- 2026-10-24 — db:demo-topup couvre aussi les livraisons 4 à 6 (besoins machines, jalons de sécurité, autorisations, pack, réalisé, démarrage et montée en cadence de CPX-APM-2025-01, revues et instantanés) : la base du serveur de démonstration datait d'avant la livraison 4b.
- 2026-10-24 — Démo d'un serveur existant : npm run db:demo-topup complète une base de démonstration créée avant les derniers lots (sites localisés, CAPEX SAI-02 et 03, COPIL GPI, REX, actions, WBS) sans rien modifier ; EXPLOITATION.md § 4.5.
- 2026-10-24 — Déploiement automatique : workflow GitHub « Deploy » qui appelle le webhook Coolify après une CI verte sur main (ou à la main) ; EXPLOITATION.md § 4.4 (secrets COOLIFY_WEBHOOK et COOLIFY_TOKEN, ou Auto Deploy de Coolify).
- 2026-10-24 — Sécurité : Next.js 16.4.3 (et eslint-config-next), zod 4.6.7 (GHSA-mrhx-c7xc-m3w5) ; reste l'avertissement « moderate » d'esbuild, embarqué par drizzle-kit (outil de développement, absent de l'image).
- 2026-10-24 — Retours du pilote (5) : « Nouvelle action » sur les pages hors CAPEX avec le choix du CAPEX ; carte : un CAPEX sans site localisé est placé au centre de son pays ; db:reset-demo compatible avec PostgreSQL de Homebrew.
- 2026-10-24 — Retours du pilote (4) : WBS et Gantt du CAPEX (tâches sous les lots ou au niveau du CAPEX, jalons, lots à leurs mois prévus, projets EPC2i en une barre de synthèse, jalons du cycle) ; « Planning des CAPEX » dans les portefeuilles groupe et filiale, une barre de synthèse par CAPEX.
- 2026-10-24 — Retours du pilote (3) : plan d'actions du CAPEX — « Nouvelle action » en haut de chaque page du CAPEX (origine déduite de la page), page Plan d'actions (ouvertes, en retard, faites ; clôture faite ou annulée avec motif), « Mes actions » à l'Accueil, actions du jeu de démo.
- 2026-10-24 — Retours du pilote (1) : jeu de démo enrichi (COPIL GPI, REX), carte des CAPEX (position au site de la filiale, liste « Hors de la carte »), commande npm run db:reset-demo. (2) Assistant « Ouvrir un CAPEX » (identité, lots, budget E50, équipe, risques, dossier, ou reprise d'un CAPEX en cours), menus Portefeuille groupe / Portefeuille filiale (sélecteur de filiale) / Pilotage, choix de langue en haut à droite. Plan d'actions, WBS et Gantt retenus pour les lots suivants.
- 2026-10-23 — Pilote lancé : reprise d'un CAPEX en cours (N-20 : phase, jalons franchis datés, budget validé ; jalons « Repris » sans circuit), écran Objectifs DIG-PRODI (C-10 : délai soumission → décision par jalon, documents statiques par dossier de jalon, décisions tracées ; référence de l'existant saisie par le Dir.IG, cibles −40 % / −50 % / 100 %), guides par rôle, procédure du pilote et journal des retours.
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
