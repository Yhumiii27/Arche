# Arche — décisions et questions ouvertes (livraison 0)

> 22 oct. 2026. Chaque question a une **réponse par défaut (★)**. C’est celle que la livraison 1 appliquera si le responsable
> produit ne répond pas autrement. Le champ « Bloque » donne la première livraison qui a besoin de la réponse (L1 à L7, voir
> [`PLAN.md`](PLAN.md)).
> Sources : C-1 à C-13 et D-x viennent de `ANALYSE-DIG-PRODI.md` ; A-1 à A-4 et §4 viennent de
> `ARCHITECTURE-CAPEX-KEYSTONE.md` (dépôt Keystone, branche `main-2a2fep`). Les N-x sont propres à Arche.

## À traiter en priorité

**Pour répondre : questionnaire « Décisions Arche »**, https://claude.ai/artifact/B2xm3cfZvTvXfRE6TinNNe (toutes les questions
ci-dessous et les données à fournir ; réponses enregistrées dans la page et relues par Claude).

Toutes les questions posées jusqu’à la livraison 1 sont tranchées (voir ci-dessous). À trancher : **N-26 à N-29** (livraison 2), **N-30 à N-35** (livraison 3) et **N-36 à N-38** (livraison 4).
Données de référence attendues : la liste des filiales, de leurs zones et de leurs CA (C-5), la matrice de délégation
(C-4), la table des jalons HS (C-3), la liste type du pack (C-9).

**Décisions reçues le 22 oct. 2026** (appliquées dès la livraison 1) : le système s’appelle **Arche** (AC-1) ; **PostgreSQL
uniquement**, pas de PGlite (N-23) ; **Codex héberge tous les documents** d’Arche (N-17) ; tenir compte des environnements
de Codex, Vigie, Cursus et Matrix (demandes `DEMANDES-*.md`). Le responsable produit a demandé de lancer la livraison 1
avec les réponses par défaut ci-dessous, qui restent révisables.

**Réponses du questionnaire (22 oct. 2026)** : le responsable produit a **confirmé la réponse par défaut (★) de 51 questions**,
sans autre réponse ni note : A-1 à A-4, C-1 à C-13, AC-2 à AC-5, N-1 à N-16, N-18 à N-22, N-24,
N-25, et les ajouts hors CDC X-1 à X-7 (§5, tous retenus). Elles sont marquées « **confirmé** » ci-dessous.
**Restent ouvertes** : N-26 à N-29 (ajoutées par la livraison 2, réponse par défaut appliquée en attendant) et les données à
fournir D-1 à D-8 (liste des filiales et de leurs sites, membres du COPIL GPI, premiers comptes, matrice de délégation, liste
type du pack, définitions RSPDI / ASPD, relevé de l’existant).

## 1. Décisions d’architecture (confirmées le 22 oct. 2026)

| # | Décision (architecture §1) | Application dans Arche | ★ |
|---|---|---|---|
| A-1 | Application CAPEX séparée, dépôt à part | **Arche**, dépôt `Yhumiii27/Arche` ; les filiales et le groupe ont un compte Arche, pas Keystone | **confirmé** |
| A-2 | Données communes sur le serveur PostgreSQL EPC2I : un schéma par outil, partage par vues `pub_` | schéma `arche`, rôle `arche_app` (N-1) ; lecture de `keystone.pub_*` seulement | **confirmé** |
| A-3 | Socle repris de Keystone une fois, puis paquet `@epc2i/socle` (R-194) | inventaire et commit d’origine dans [`SOCLE.md`](SOCLE.md) ; aucun module métier copié | **confirmé** |
| A-4 | Propriétés : Arche = CAPEX, phases, jalons, dossiers, lots hors EPC2i, BP, typologie, ramp-up, besoins (demande) ; Keystone = catalogue, réponses, projets EPC2i ; Vigie = études et actions de sécurité | spec 00 §2 ; ajout proposé : le **registre des autorisations** (ICPE, PC, PLU, ATEX) appartient à Arche | **confirmé** (ajout compris) |

### Décisions de Matrix qui s’appliquent à Arche (22 oct. 2026)

| # | Décision (journal `docs/decisions.md` de Matrix) | Effet dans Arche |
|---|---|---|
| D21 | Filiales et zones du groupe : « A · Matrix » (répond à N-22 / M-9) | `zones`, `subsidiaries`, `sites` deviennent des miroirs de `matrix.pub_zones`, `pub_filiales`, `pub_sites` (spec 02 §1, CONTRATS §2.4) ; l’écran `admin-org` les consulte et ne garde que la saisie du CA de référence ; à faire dans une prochaine livraison |
| D22 | REX : « A · Deux registres » | `rex_entries` reste dans Arche et se publie dans `pub_rex` (CONTRATS §3), réunie par Matrix avec le REX de Keystone |
| P-01 | Version du serveur : « Rester en 16 » | PostgreSQL 16 en production ; tests sur 16 (PGlite est en 18 : aucune fonction propre à 17 ou 18) |

## 2. Compléments au CDC (analyse §1.3)

| # | Question | ★ Réponse par défaut | Bloque |
|---|---|---|---|
| C-1 | Phase 4 titrée « (G4) » ; pas de jalon en fin de phase 3 | Phase 4 → **G3** ; passage Exécution → Démarrage = point de contrôle **K3 « Prêt à démarrer »**, visa du Dir.IG, sans arbitrage (spec 03 §1) — **confirmé** | L2 |
| C-2 | Livrable « 3.1 » | tableau de bord d’exécution, pas un dossier vivant ; 3 dossiers vivants — **confirmé** | L3 |
| C-3 | HS 1 absent ; RSPDI, ASPD non définis | table HS de la spec 03 §4 (HS 2 → G1, HS 3 → G2, HS 4 → K3, PSSR → début de MES, HS 6 → G3) ; **à compléter par le SSE groupe** : définitions RSPDI / ASPD, preuve attendue — **confirmé** | L5 |
| C-4 | Seuils délégués non chiffrés | **valeurs d’amorce** de la spec 05 §5, modifiables par l’admin ; à remplacer par la matrice du groupe — **confirmé** | L3 |
| C-5 | CA de référence pour la typologie | saisi par la **DAF groupe**, dernier exercice clos ; seuil **≥ 20 %** ; nouvelle usine = Stratégique d’office ; forçage par le Dir.IG avec motif ; recalcul confirmé par le Dir.IG (spec 06 §1) — **confirmé** | L2 |
| C-6 | Co-DIG, Client Interne, COPIL GPI, Dir.IG, Directeur de Zone non définis ; RACI | glossaire de la spec 00 §3 ; RACI = matrice de la spec 01 §3 en attendant la grille du groupe (R-058 de Keystone) — **confirmé** | L1 |
| C-7 | Niveau de signature électronique | **simple** pour tout en v1 (Entra + authentification récente + horodatage + empreinte, spec 05 §3) ; **avancée** pour G2 / AFE en L7, prestataire à choisir (Yousign par défaut, français) — **confirmé** | L3 (simple), L7 (avancée) |
| C-8 | Classes d’estimation et passage ±50 → ±30 | E50 au G1, E30 à mi-Avant-Projet (non bloquant), E10 au G2, validée par la DAF groupe (spec 03 §5) — **confirmé** | L2 |
| C-9 | Base du % du pack ingénierie | liste type par type d’investissement, pondérée par famille ; % = Σ poids des pièces validées / Σ poids des pièces attendues (hors « sans objet ») ; part EPC2i lue dans Keystone ; **liste type à fournir** (amorce : 5 familles à poids égal) — **confirmé** | L5 |
| C-10 | Objectifs −40 % / −50 % / 100 % sans référence | Arche mesure : délai soumission → décision par jalon ; nombre de documents hors dossier ; part des décisions tracées. Référence mesurée pendant le pilote (relevé de l’existant à fournir) — **confirmé** | pilote |
| C-11 | Lien CAPEX ↔ EPC2i et catalogue | spec 07 ; catalogue = module de Keystone (R-186) — **confirmé** | L4 |
| C-12 | Interfaces (Sage, GED, HSE, RH) | Codex (références de documents), Vigie (HS), Keystone ; Sage hors v1 (N-14, N-15) ; Cursus inutile en v1 — **confirmé** | L4 |
| C-13 | Hébergement en France, IA, annuaire | données et sauvegardes en **France** ; IA **désactivée** tant qu’aucun fournisseur conforme (région UE/France) n’est validé ; annuaire **Entra ID accepté** ; même hébergeur que Keystone (I-1a de Keystone) — **confirmé** | production |

## 3. Questions de l’architecture (§4) — numérotées AC-1 à AC-5

| # | Question | ★ Réponse par défaut | Bloque |
|---|---|---|---|
| AC-1 | Nom et dépôt de l’application | **Arche**, `Yhumiii27/Arche` (réponse du 22 oct. 2026) | — |
| AC-2 | P-05 : données financières d’un projet EPC2i visibles par la filiale | prix de vente, avenants, facturé, % physique, SPI : **oui** ; coûts, taux, marge : **non** — **confirmé** | L4 |
| AC-3 | Vigie porte-t-il HazID / HazOp / AMDEC / PSSR ? | **constat du 22 oct. : non**, Vigie ne modélise aucune de ces études (seulement « HAZOP » comme source libre d’action QSE). Proposition : les demander à Vigie ([`DEMANDES-VIGIE.md`](DEMANDES-VIGIE.md)) ; **en attendant**, statut déclaratif dans Arche (N-13) — **confirmé** | L5 |
| AC-4 | Catalogue : module Keystone (R-186) puis configurateur à part si besoin | **module Keystone** ; Arche lit `pub_catalogue_machines` — **confirmé** | L4 |
| AC-5 | Multi-équipements (R-185) | un besoin de plusieurs machines = **un projet EPC2i à plusieurs équipements** — **confirmé** | L4 |

## 4. Questions propres à Arche

| # | Question | ★ Réponse par défaut | Bloque |
|---|---|---|---|
| N-1 | Nom du schéma et du rôle (le prompt dit « `capex`, nom à confirmer ») | schéma **`arche`**, rôle **`arche_app`** (le nom de l’outil, comme `keystone`) — appliqué en livraison 1 — **confirmé** | L1 |
| N-2 | Devise des filiales hors zone euro | v1 en **k€** seulement ; le montant en devise locale et le taux de référence groupe viennent plus tard — **confirmé** ; **révisé le 29/10/2026 (AR-039)** : saisie en devise de la filiale, consolidation en k€ | L2 |
| N-3 | Comptes des filiales | même locataire Entra si les filiales y sont, sinon **invités B2B** ; rôles et portées attribués dans Arche par l’admin — **confirmé** | L1 |
| N-4 | Administrateur *(hors CDC)* | profil `admin` (PMO groupe ou DSI) : référentiels, utilisateurs, paramètres ; ~~aucune donnée métier~~ **révisé le 24/10/2026 par le responsable produit : lit tous les CAPEX et toutes les pages métier, comme le PDG, sans aucun droit d'écriture métier** (ni saisie, ni signature, ni décision de jalon) | L1 |
| N-5 | Les fonctions centrales voient-elles les brouillons ? | **non** : un brouillon reste dans la filiale jusqu’à l’ouverture — **confirmé** | L1 |
| N-6 | Composition du COPIL GPI et qui enregistre sa décision | membres nommés par l’admin ; **président = Dir.IG**, qui enregistre la décision au nom du comité — **confirmé** | L3 |
| N-7 | Que mesure le délai « 2 jours maximum » du G1 ? | **2 jours ouvrés** entre la mise à la décision (visa Sponsor) et la décision ; examen en ligne par les membres, sans attendre la séance mensuelle ; la séance suivante en prend acte — **confirmé** | L3 |
| N-8 | Authentification récente pour signer | ≤ **10 minutes**, sinon nouvelle connexion Entra — **confirmé** | L3 |
| N-9 | Format des codes | CAPEX `CPX-<FIL>-<AAAA>-<NN>` (ex. `CPX-APM-2026-01`) ; besoin `<code CAPEX>/B01` ; MoC `MOC-01` dans le CAPEX — **confirmé** | L2 |
| N-10 | Consultation d’experts : délai et silence | délai **5 jours ouvrés** ; **pas d’avis tacite** ; le décideur peut forcer avec motif — **confirmé** | L3 |
| N-11 | Modèle financier de la DAF | saisie structurée et import d’un gabarit Excel Arche ; horizon 10 ans ; taux d’actualisation = paramètre DAF ; le modèle existant de la DAF, s’il existe, remplacera le gabarit — **confirmé** | L3 |
| N-12 | Liste des lots | génie civil, bâtiments, utilités, VRD, terrain, machines, recrutement, autres ; la liste est une liste de paramètres — **confirmé** | L2 |
| N-13 | Jalons HS avant le connecteur Vigie | statut **déclaratif** saisi par le SSE groupe, avec une référence de preuve (Vigie ou Codex) ; il bascule en miroir quand Vigie publie — **confirmé** | L5 |
| N-14 | Engagé et réalisé des lots hors EPC2i | saisie mensuelle ou import CSV par le CDG ; import Sage plus tard — **confirmé** | L5 |
| N-15 | Clôture comptable du G3 | **attestation** du CDG (coût final par lot, solde de l’AFE), sans lien Sage en v1 — **confirmé** | L6 |
| N-16 | Ramp-up : saisie et seuils (analyse §6.8) | saisie journalière par le CPF ou l’expert Exploitation de la filiale, import CSV ; jour conforme = production ≥ 100 % du nominal et rebuts ≤ objectif ; arrêts planifiés neutres — **confirmé** | L6 |
| N-17 | Documents | **Décidé (22 oct.) : Codex héberge tous les documents d’Arche.** Arche ne stocke aucun fichier : références Codex (identifiant, révision, lien) ; dépôt des dossiers figés et lecture d’état par API Codex à obtenir ([`DEMANDES-CODEX.md`](DEMANDES-CODEX.md) CX-03, CX-04) ; en attendant, dépôt dans Codex par l’utilisateur et référence collée dans Arche | L3 |
| N-18 | Langues | français (par défaut) et anglais, comme Keystone — **confirmé** | L1 |
| N-19 | « Audits transversaux » des projets Stratégiques | un audit par phase, tenu par le Dir.IG ou le PMO, consigné comme revue de type « audit » — **confirmé** | L5 |
| N-20 | Reprise des CAPEX en cours | saisie manuelle des CAPEX pilotes (phase courante, jalons passés datés, budget validé) ; pas d’import en masse en v1 — **confirmé** | pilote |
| N-21 | Jeu de démonstration | deux filiales fictives (APM Maroc, SAI Sahel), trois CAPEX ; aucune donnée réelle — **confirmé** | L1 |
| N-22 | Qui possède les filiales, leurs zones et leurs sites ? | **Répondu le 22 oct. 2026 (D21 de Matrix) : Matrix**, vues `matrix.pub_zones`, `pub_filiales`, `pub_sites` ; les tables d’Arche deviennent des miroirs (plus de saisie dans Arche) | L2 |
| N-23 | Base de données | **Décidé (22 oct.) : PostgreSQL uniquement**, pas de PGlite : développement, tests, CI et production sur PostgreSQL, schéma `arche` partout (`npm run db:local` sur un poste) | — |
| N-24 | Rattachement Codex d’un document de CAPEX : nouveau rattachement `capex` dans Codex, ou CAPEX traité comme un « projet » Codex | nouveau rattachement **`capex`** (contexte = code CAPEX), qui évite de mélanger CAPEX et projets EPC2i ([`DEMANDES-CODEX.md`](DEMANDES-CODEX.md) CX-01) — **confirmé** | L3 |
| N-26 | Qui valide une version de budget E50 ou E30 ? (le CDC ne parle que de l’E10, validé par la DAF groupe) | le **CDG de la filiale** ou la DAF groupe ; l’E10 reste réservé à la DAF groupe | L2 |
| N-27 | Qui enregistre la décision d’un jalon avant les circuits de la livraison 3 ? | le décideur l’enregistre lui-même sur la synthèse du CAPEX : **Dir.IG** pour G1 (au nom du COPIL GPI, N-6), K3 et G3 ; **PDG** pour G2 ; critères évalués et gardés avec la décision, forçage motivé et tracé ; remplacé par les circuits (visa, avis, signature) en L3 — **remplacée en L3** : la décision est l’étape « décision » (ou « signature ») du circuit du jalon | L2 |
| N-28 | Échelle du registre des risques | probabilité et impact de **1 à 4** ; criticité = P × I ; **majeur à partir de 9** | L2 |
| N-29 | Qui crée le brouillon et qui le porte | le Sponsor (dans sa filiale) ou le chef de projet (dans la filiale de son compte) ; le chef de projet qui crée est nommé d’office ; le Sponsor est celui qui ouvre ; un membre d’équipe est toujours de la filiale ou du groupe (jamais d’une autre filiale) | L2 |
| N-30 | Qui enregistre la décision du Copil projet sur une MoC ? | le **Sponsor** de la filiale, au nom du Copil projet ; le Dir.IG et le PDG enregistrent la leur | L3 |
| N-31 | Qui rend les avis HSE et DAF d’une consultation ? | l’expert de la spécialité nommé sur le CAPEX, **ou** le SSE groupe (HSE) et la DAF groupe (DAF) ; les avis Qualité et Exploitation : un expert nommé sur le CAPEX par l’administrateur ; le CPF peut nommer l’expert de chaque spécialité à la soumission | L3 |
| N-32 | Client Interne du G3 | la personne nommée « Client interne » dans l’équipe du CAPEX contresigne le PV de transfert (avec son profil de chef de projet, d’expert, de Sponsor ou de CDG) | L3 |
| N-33 | Provision pour aléas d’un CAPEX | pas encore saisie dans Arche : un tirage de provision va au **Dir.IG** tant que la provision n’est pas connue | L5 |
| N-34 | Jours ouvrés des échéances | lundi au vendredi, **sans jours fériés** en v1 (calendrier des filiales à fournir) | L3 |
| N-35 | Relances par e-mail des étapes dues (spec 05 §1) | pas d’e-mail en v1 : les étapes dues et en retard apparaissent dans « Mes validations » et sur la page du jalon ; l’envoi attend le choix du transport (SMTP ou Microsoft Graph) ; **29/10/2026 (AR-041)** : relances et escalade calculées et mises en boîte d’envoi, transport `none` ou `file` en attendant ce choix | L5 |
| N-36 | Qui saisit et soumet les besoins machines (spec 07 §1) | le **chef de projet** du CAPEX seul ; un besoin soumis ne se modifie plus (retrait avec motif, puis nouvelle saisie) ; un besoin commandé ne se retire pas (MoC) | L4 |
| N-37 | Simulation de Keystone tant que ses vues manquent (spec 07 §2) | **jeu de démonstration seulement** : qualification à 10 min, indicatif E50 à J+1, devis E30 à J+30, offre ferme E10 à J+60, projet EPC2i ouvert à la commande ; en production une vue non partagée reste vide (signalé dans *Connecteurs*) | L4 |
| N-38 | Fréquence de lecture de Keystone | toutes les **15 minutes** par le worker (`ARCHE_KEYSTONE_SYNC_MIN`), copie complète de chaque vue dans un miroir générique (`keystone_mirror`) ; « Synchroniser maintenant » pour l’administrateur | L4 |
| N-25 | Identité des personnes entre outils (Cursus : matricule ; Arche : e-mail Entra) | Arche identifie par l’objet Entra et l’e-mail ; le matricule est ajouté aux comptes du groupe quand Cursus l’expose à Arche (CU-03) ; les salariés des filiales n’ont pas de matricule Cursus (CU-01) — **confirmé** | L2 |

## 5. Ajouts au-delà du CDC (retenus le 22 oct. 2026, X-1 à X-7 du questionnaire)

| Ajout | Pourquoi | ★ |
|---|---|---|
| Profil `admin` et écrans d’administration | il faut quelqu’un pour tenir les référentiels et les rôles | **retenu** |
| Point de contrôle K3 « Prêt à démarrer » | correction C-1 | **retenu** |
| Registres des risques et des décisions | le CDC cite « risques » et « décisions » sans les décrire | **retenu**, en version simple |
| Bibliothèque REX | « capitalisation automatique du REX » | **retenu** |
| Vue `pub_journal` pour Matrix | journal unifié des outils (convention D18 de Keystone) | **retenu** |
| Alertes à règles sans IA | le CDC demande des alertes ; elles marchent sans fournisseur d’IA | **retenu** |
| Mode démo « Voir en tant que » | développement, tests, démonstrations, derrière authentification HTTP | **retenu** |
| Carte des CAPEX (reprise de la carte des projets de Keystone) et sélecteur de zone des vues de portefeuille | demandé par le responsable produit le 22 oct. 2026 ; maquettes validées le même jour | **retenu** |
| Menu par thèmes, section CAPEX toujours visible avec sélecteur de CAPEX, recherche de page ⌘K, actions en boutons et panneaux | demandé par le responsable produit le 22 oct. 2026 ; maquettes validées le même jour | **retenu** |
| Nommer le chef de projet dès la création d'un CAPEX (Sponsor) | maquette « Nouveau CAPEX » validée le 22 oct. 2026 | **retenu** |
| Assistant « Ouvrir un CAPEX » (Accueil, Registre) : toutes les questions de l'ouverture et du cadrage en une fois (identité, lots, budget E50 indicatif, équipe, risques initiaux, dossier de la phase), ou la reprise d'un CAPEX en cours ; seuls le titre et le type sont obligatoires | retour du pilote du 24 oct. 2026 | **retenu** |
| Menus en trois sections : Portefeuille groupe, Portefeuille filiale (sélecteur de filiale : registre, portefeuille de la filiale, ouverture), Pilotage (pages du seul CAPEX sélectionné) ; choix de langue FR / EN en haut à droite comme dans Keystone | retour du pilote du 24 oct. 2026 (option choisie le jour même) | **retenu** |
| Plan d'actions du CAPEX : bouton « Nouvelle action » dans l'en-tête de chaque page du CAPEX (origine déduite de la page), actions de suivi (responsable, échéance, élément d'origine), clôture faite / annulée (motif), « Mes actions » à l'Accueil | retour du pilote du 24 oct. 2026 | **retenu** |
| WBS et Gantt du CAPEX (composants d'affichage repris de Keystone, exception à la règle « plateforme seulement », `SOCLE.md`) : tâches sous les lots ou au niveau du CAPEX (dates, avancement, responsable, jalons), lots sans tâche à leurs mois prévus ; un projet EPC2i y figure en une barre de synthèse ; aux niveaux filiale et groupe, une barre de synthèse par CAPEX (durée, avancement), sans détail | retour du pilote du 24 oct. 2026 | **retenu** |

### Ajouts retenus le 29 oct. 2026 (analyse comparative du 25 oct. 2026, AR-039 à AR-052)

Le responsable produit a lancé les 14 points de l'analyse comparative (« lance AR-039 à AR-052 »). Ils sont développés par lots
(7a plateforme, 7b finance, 7c portefeuille, 7d circuits, 7e amont et aval) ; le choix par défaut de chaque point, pris en
l'absence de consigne, est noté ici et reste modifiable par le responsable produit.

| Point | Ajout | Choix par défaut | ★ |
|---|---|---|---|
| AR-049 | Verrouillage optimiste et lecture des portefeuilles | colonne `row_version` sur le CAPEX, les versions de budget, les versions de dossier et les étapes de circuit, augmentée par un déclencheur à chaque mise à jour ; la fiche d'identité, la version de budget en brouillon et l'étape de circuit renvoient la version affichée et l'écriture est refusée si elle a changé (« rechargez la page ») ; un dossier se verrouille par section (le texte affiché), pour que deux personnes écrivent chacune leurs sections ; portefeuilles, alertes, registre et Gantt lus en un nombre fixe de requêtes, test sur 200 CAPEX | **retenu** |
| AR-042 | Exports et Power BI | registre, portefeuilles groupe et filiale, alertes de l'accueil, engagé / réalisé d'un CAPEX en Excel et en CSV (en-tête de chaque page, mêmes droits) ; rapport Copil et versions de dossier en PDF écrit par le serveur (sans navigateur ni dépendance) ; Power BI par l'API en lecture (clé dédiée) ou, plus tard, par un rôle de lecture des vues `pub_` (demande M-14 à Matrix) — `API.md` | **retenu** |
| AR-048 | API REST et webhooks | applications clientes créées par l'administrateur (clé montrée une fois, empreinte seule conservée ; lecture ou écriture ; périmètre de filiales) ; lecture des CAPEX, du détail et des réalisés ; écriture signée (HMAC, anti-rejeu, convention de Codex) des réalisés mensuels et des actions, auditée « API · application » ; webhooks `capex.opened`, `gate.decided`, `alert.raised` signés, par une file envoyée par le worker avec reprises — `API.md` | **retenu** |
| AR-039 | Multi-devises | budgets, réalisés, prévisions et API saisis dans la devise de la filiale (ou en euros) et convertis en k€ au taux de référence du groupe — celui du mois, sinon celui de l'exercice —, tenu par la DAF groupe (Administration › Filiales) ; montant saisi, devise et taux conservés à côté du k€ ; toutes les consolidations restent en k€ ; `pub_capex` gagne `devise` en fin de vue ; une saisie sans taux est refusée (révise N-2) | **retenu** |
| AR-040 | Enveloppes budgétaires | enveloppes votées par la DAF groupe par exercice (et les suivants : plan pluriannuel) pour le groupe, une zone ou une filiale, tous CAPEX ou une typologie ; chaque CAPEX ouvert ou suspendu consomme, par exercice, ses décaissements phasés sur son enveloppe la plus précise ; reports à l'exercice suivant et réallocations tracés ; à l'ouverture, un dépassement est consigné et signalé (alerte) ; au G2, critère bloquant forçable « dans l'enveloppe » au-delà de la tolérance du modèle (10 % par défaut) ; page « Enveloppes CAPEX » | **retenu** |
| AR-045 | Cash-flow prévisionnel phasé | prévision mensuelle des décaissements de chaque lot pour les mois à venir (chef de projet, CDG ; en devise de la filiale), re-prévisible chaque mois ; sans prévision, le reste à dépenser est réparti sur la fenêtre du lot ; comparée à la baseline G2 et au réalisé (page Exécution), consolidée par filiale et par exercice dans les portefeuilles ; l'exercice est l'année civile | **retenu** |
| AR-050 | Amortissement et immobilisations | classes d'actifs du groupe (durée, linéaire ou dégressif, natures de lots par défaut) tenues par la DAF groupe ; amortissement simulé dès le budget de référence sur l'horizon du BP (prorata du premier exercice, bascule dégressif → linéaire) ; transfert des lots en immobilisations à la clôture comptable (coût final, classe, mise en service) et export Excel / CSV pour Sage FI-AA | **retenu** |
| AR-044 | Scoring multicritère | grille de 6 critères pondérés (poids par défaut 30/10/15/25/10/10, réglés par le directeur industriel groupe) : 3 calculés — valeur financière (VAN / budget du BP), TRI, risques ouverts et majeurs — et 3 notés de 0 à 5 par le directeur industriel, la DAF groupe ou un membre du COPIL GPI (alignement stratégique, urgence, sécurité et conformité), avec un motif ; score sur 100 = moyenne pondérée des critères notés, donné seulement quand 80 % du poids est noté (un CAPEX sans BP n'est pas classé) ; classement sur le Portefeuille groupe, détail sur la page Gouvernance du CAPEX | **retenu** |
| AR-043 | Scénarios de portefeuille | scénarios nommés (base, contraint, croissance, autre) créés et modifiés par le directeur industriel ou la DAF groupe : chacun garde ou écarte des CAPEX (ouverts, suspendus, ou en brouillon avec un budget phasé) et décale leurs décaissements à venir de −36 à +36 mois, sous une enveloppe groupe par exercice ; comparés à l'état actuel sur la dépense par exercice (dépassement de l'enveloppe signalé), la VAN, les risques majeurs et le score moyen (AR-044) ; un scénario est retenu par le directeur industriel pour le COPIL GPI, qui l'affiche ; un scénario n'écrit rien sur les CAPEX (aide à la décision) ; page « Scénarios de portefeuille » | **retenu** |
| AR-041 | Notifications e-mail, relances, escalade, absences | e-mail à ceux qui peuvent agir quand une étape de circuit s'ouvre, la veille ouvrée et le jour de l'échéance ; en retard, une relance tous les 2 jours ouvrés ; à 3 jours ouvrés de retard, escalade unique au directeur industriel groupe et au sponsor du CAPEX, tracée au journal (les deux délais sont des valeurs du modèle) ; rien le week-end ; boîte d'envoi `email_outbox` (un message par destinataire et par avis) remplie par la tâche `notifications` toutes les 15 min ; envoi par `ARCHE_MAIL_TRANSPORT` : `none` par défaut (messages conservés, visibles dans « Mes validations » et Administration › Connecteurs), `file` (fichiers .eml) ; SMTP ou Microsoft Graph attendent N-35 ; absences : chacun déclare ses absences et un suppléant (toute personne active du métier) qui reçoit ses notifications et agit sur ses étapes « pour le compte de » lui (signature à son propre nom, mention dans la preuve, le journal et la page du jalon) ; le suppléant lit le CAPEX tant que l'étape l'attend | **retenu** |
| AR-052 | Concepteur sans code des dossiers et circuits | page Administration › Concepteur des dossiers et circuits (administrateur et directeur industriel groupe) : un modèle versionné par dossier vivant et par jalon ; brouillon copié du modèle en vigueur, modifié ligne par ligne (titres, aides, ordre, sections obligatoires ou facultatives, sections ajoutées ou retirées ; étapes, groupes, natures, acteurs, spécialités, facultatives, « Stratégique seulement », étape qui décide), aperçu, publication ou abandon ; la version publiée s'applique aux versions de dossier commencées et aux sessions de jalon soumises ensuite (les autres gardent les leurs) ; verrous de la méthode : sections calculées et remplies par le circuit conservées, une seule étape qui décide dans le dernier groupe, visa du sponsor au G1, levée PSSR par la HSE groupe au G3 ; version 0 = modèle intégré | **retenu** |
| AR-051 | Backlog d'idées | page « Idées d'investissement » (section Portefeuille filiale) : toute personne du métier propose une idée pour une filiale de son périmètre (titre, enjeu, ordre de grandeur, type), numérotée IDEA-<filiale>-NNN ; le sponsor de la filiale, le directeur de sa zone ou le directeur industriel groupe la qualifie, la retient ou l'écarte (motif obligatoire) ; une idée retenue ouvre « Ouvrir un CAPEX » prérempli (titre, enjeu, type) et devient un brouillon de CAPEX (idée « devenue un CAPEX », liée au CAPEX) ; file d'idées sur le portefeuille filiale | **retenu** |
| AR-046 | Gains réalisés et post-audit | page « Gains et post-audit » du CAPEX : après le début de la mise en service, le contrôleur de gestion ou le sponsor saisit, année par année du business plan validé, le CA et les coûts d'exploitation constatés ; gain d'exploitation prévu / réel / écart, cumul ; VAN et TRI recalculés sur les flux réalisés (réel où saisi, plan ailleurs ; investissement au coût final une fois la clôture comptable saisie) ; post-audits à M+6, M+12 et M+24 de la mise en service, tenus par le directeur industriel groupe (date, conclusion au-dessus / conforme / en dessous, compte rendu, référence Codex ; VAN et TRI réalisés figés avec lui), dus dans « Mes validations » ; saisie possible aussi après le G3 (CAPEX clos) | **retenu** |
| AR-047 | Import Sage | connecteur par fichier d'extraction en attendant l'accès de la DSI (N-14) : format `company;date;type;number;analytic;amount;currency;supplier;label` (CMD = engagé, FAC et AVO = réalisé ; à confirmer par la DSI) ; chaque lot hors EPC2i porte son code analytique Sage (unique dans la filiale) ; lignes rattachées par ce code, doublons (type, numéro, code) ignorés, autres lignes rejetées avec leur motif, jamais le fichier entier ; engagé et réalisé cumulés par lot et par mois, convertis en k€ au taux de référence du mois (AR-039), avancement physique saisi conservé ; import déposé par le contrôleur de gestion de la filiale ou la DAF groupe (page « Import Sage »), ou extraction planifiée déposée dans `ARCHE_SAGE_DIR` et lue toutes les heures (fichiers `<FILIALE>*.csv` déplacés dans `done/` ou `rejected/`), ou extraction de démonstration (SAI, jeu de démonstration) ; l'import CSV manuel reste | **retenu** |

### AR-037 lancé le 31 oct. 2026 (aide à la décision et signature avancée, livraison 7 du plan)

Le responsable produit a lancé AR-037 (« lance AR-037 »). C-13 reste en vigueur : l'IA est **désactivée** tant qu'aucun
fournisseur conforme (région UE / France) n'est validé ; tout ce qui suit est calculé par règles dans Arche, sans envoi de
données. Choix par défaut, modifiables par le responsable produit :

| Point | Ajout | Choix par défaut | ★ |
|---|---|---|---|
| AR-037a | Aide à la décision par règles | prévision de la courbe en S : la valeur acquise continue à son rythme des 3 derniers mois mesurés (fin projetée, retard sur la fin prévue) ; EAC et EAC « avec le planning » (AC + reste / (CPI × SPI)) ; tendance de l'EAC sur 3 mois depuis le premier mois dépensé ; **dérive des coûts** si l'EAC a crû de plus de 3 % sur 3 mois, **dérive du planning** si la fin projetée est 2 mois ou plus après la fin prévue (alertes « à surveiller » de la page Exécution, de l'accueil et des portefeuilles) ; **comparaison avec les CAPEX déjà réalisés** (classe de référence) : coût final des CAPEX clôturés, ou EAC des CAPEX dont la moitié du budget est acquise, rapporté à leur budget G2, parmi les CAPEX que la personne voit ; même type d'investissement dès 3 CAPEX, sinon tous types ; médiane et 80e centile appliqués au budget du CAPEX (coût final probable et prudent) ; montrée au G1 et au G2 ; **synthèse de la décision** sur la page du jalon (budget, BP, critères, avis d'experts, risques majeurs, coût final probable, exécution) | **retenu** |
