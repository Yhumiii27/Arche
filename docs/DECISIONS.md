# Arche — décisions et questions ouvertes (livraison 0)

> 22 oct. 2026. Chaque question a une **réponse par défaut (★)**. C’est celle que la livraison 1 appliquera si le responsable
> produit ne répond pas autrement. Le champ « Bloque » donne la première livraison qui a besoin de la réponse (L1 à L7, voir
> [`PLAN.md`](PLAN.md)).
> Sources : C-1 à C-13 et D-x viennent de `ANALYSE-DIG-PRODI.md` ; A-1 à A-4 et §4 viennent de
> `ARCHITECTURE-CAPEX-KEYSTONE.md` (dépôt Keystone, branche `main-2a2fep`). Les N-x sont propres à Arche.

## À traiter en priorité

**Pour répondre : questionnaire « Décisions Arche »**, https://claude.ai/artifact/B2xm3cfZvTvXfRE6TinNNe (toutes les questions
ci-dessous et les données à fournir ; réponses enregistrées dans la page et relues par Claude).

À trancher avant la livraison 1 : **N-1** (nom du schéma), **N-3** (comptes des filiales), **N-4** (administrateur),
**AC-1** (nom et dépôt : réponse « Arche », `Yhumiii27/Arche`, à confirmer), **C-6** (glossaire et rôles), **C-13 / D-11**
(hébergement).
Données de référence attendues : la liste des filiales, de leurs zones et de leurs CA (C-5), la matrice de délégation
(C-4), la table des jalons HS (C-3), la liste type du pack (C-9).

**Décisions reçues le 22 oct. 2026** (appliquées dès la livraison 1) : le système s’appelle **Arche** (AC-1) ; **PostgreSQL
uniquement**, pas de PGlite (N-23) ; **Codex héberge tous les documents** d’Arche (N-17) ; tenir compte des environnements
de Codex, Vigie, Cursus et Matrix (demandes `DEMANDES-*.md`). Le responsable produit a demandé de lancer la livraison 1
avec les réponses par défaut ci-dessous, qui restent révisables.

**Réponses du questionnaire (22 oct. 2026)** : réponse par défaut confirmée pour **C-6** (glossaire et RACI), **N-3** (comptes
des filiales), **N-4** (administrateur), **N-22** (filiales, zones et sites tenus dans Arche en attendant Matrix) et **N-24**
(rattachement `capex` dans Codex). Les autres questions gardent leur réponse par défaut, appliquée par la livraison 2 ; la
livraison 2 ajoute N-26 à N-29 (§3) au questionnaire.

## 1. Décisions d’architecture déjà prises (à confirmer pour Arche)

| # | Décision (architecture §1) | Application dans Arche | ★ |
|---|---|---|---|
| A-1 | Application CAPEX séparée, dépôt à part | **Arche**, dépôt `Yhumiii27/Arche` ; les filiales et le groupe ont un compte Arche, pas Keystone | confirmer |
| A-2 | Données communes sur le serveur PostgreSQL EPC2I : un schéma par outil, partage par vues `pub_` | schéma `arche`, rôle `arche_app` (N-1) ; lecture de `keystone.pub_*` seulement | confirmer |
| A-3 | Socle repris de Keystone une fois, puis paquet `@epc2i/socle` (R-194) | inventaire et commit d’origine dans [`SOCLE.md`](SOCLE.md) ; aucun module métier copié | confirmer |
| A-4 | Propriétés : Arche = CAPEX, phases, jalons, dossiers, lots hors EPC2i, BP, typologie, ramp-up, besoins (demande) ; Keystone = catalogue, réponses, projets EPC2i ; Vigie = études et actions de sécurité | spec 00 §2 ; ajout proposé : le **registre des autorisations** (ICPE, PC, PLU, ATEX) appartient à Arche | confirmer, dont l’ajout |

## 2. Compléments au CDC (analyse §1.3)

| # | Question | ★ Réponse par défaut | Bloque |
|---|---|---|---|
| C-1 | Phase 4 titrée « (G4) » ; pas de jalon en fin de phase 3 | Phase 4 → **G3** ; passage Exécution → Démarrage = point de contrôle **K3 « Prêt à démarrer »**, visa du Dir.IG, sans arbitrage (spec 03 §1) | L2 |
| C-2 | Livrable « 3.1 » | tableau de bord d’exécution, pas un dossier vivant ; 3 dossiers vivants | L3 |
| C-3 | HS 1 absent ; RSPDI, ASPD non définis | table HS de la spec 03 §4 (HS 2 → G1, HS 3 → G2, HS 4 → K3, PSSR → début de MES, HS 6 → G3) ; **à compléter par le SSE groupe** : définitions RSPDI / ASPD, preuve attendue | L5 |
| C-4 | Seuils délégués non chiffrés | **valeurs d’amorce** de la spec 05 §5, modifiables par l’admin ; à remplacer par la matrice du groupe | L3 |
| C-5 | CA de référence pour la typologie | saisi par la **DAF groupe**, dernier exercice clos ; seuil **≥ 20 %** ; nouvelle usine = Stratégique d’office ; forçage par le Dir.IG avec motif ; recalcul confirmé par le Dir.IG (spec 06 §1) | L2 |
| C-6 | Co-DIG, Client Interne, COPIL GPI, Dir.IG, Directeur de Zone non définis ; RACI | glossaire de la spec 00 §3 ; RACI = matrice de la spec 01 §3 en attendant la grille du groupe (R-058 de Keystone) | L1 |
| C-7 | Niveau de signature électronique | **simple** pour tout en v1 (Entra + authentification récente + horodatage + empreinte, spec 05 §3) ; **avancée** pour G2 / AFE en L7, prestataire à choisir (Yousign par défaut, français) | L3 (simple), L7 (avancée) |
| C-8 | Classes d’estimation et passage ±50 → ±30 | E50 au G1, E30 à mi-Avant-Projet (non bloquant), E10 au G2, validée par la DAF groupe (spec 03 §5) | L2 |
| C-9 | Base du % du pack ingénierie | liste type par type d’investissement, pondérée par famille ; % = Σ poids des pièces validées / Σ poids des pièces attendues (hors « sans objet ») ; part EPC2i lue dans Keystone ; **liste type à fournir** (amorce : 5 familles à poids égal) | L5 |
| C-10 | Objectifs −40 % / −50 % / 100 % sans référence | Arche mesure : délai soumission → décision par jalon ; nombre de documents hors dossier ; part des décisions tracées. Référence mesurée pendant le pilote (relevé de l’existant à fournir) | pilote |
| C-11 | Lien CAPEX ↔ EPC2i et catalogue | spec 07 ; catalogue = module de Keystone (R-186) | L4 |
| C-12 | Interfaces (Sage, GED, HSE, RH) | Codex (références de documents), Vigie (HS), Keystone ; Sage hors v1 (N-14, N-15) ; Cursus inutile en v1 | L4 |
| C-13 | Hébergement en France, IA, annuaire | données et sauvegardes en **France** ; IA **désactivée** tant qu’aucun fournisseur conforme (région UE/France) n’est validé ; annuaire **Entra ID accepté** ; même hébergeur que Keystone (I-1a de Keystone) | production |

## 3. Questions de l’architecture (§4) — numérotées AC-1 à AC-5

| # | Question | ★ Réponse par défaut | Bloque |
|---|---|---|---|
| AC-1 | Nom et dépôt de l’application | **Arche**, `Yhumiii27/Arche` (réponse du 22 oct. 2026) | — |
| AC-2 | P-05 : données financières d’un projet EPC2i visibles par la filiale | prix de vente, avenants, facturé, % physique, SPI : **oui** ; coûts, taux, marge : **non** | L4 |
| AC-3 | Vigie porte-t-il HazID / HazOp / AMDEC / PSSR ? | **constat du 22 oct. : non**, Vigie ne modélise aucune de ces études (seulement « HAZOP » comme source libre d’action QSE). Proposition : les demander à Vigie ([`DEMANDES-VIGIE.md`](DEMANDES-VIGIE.md)) ; **en attendant**, statut déclaratif dans Arche (N-13) | L5 |
| AC-4 | Catalogue : module Keystone (R-186) puis configurateur à part si besoin | **module Keystone** ; Arche lit `pub_catalogue_machines` | L4 |
| AC-5 | Multi-équipements (R-185) | un besoin de plusieurs machines = **un projet EPC2i à plusieurs équipements** | L4 |

## 4. Questions propres à Arche

| # | Question | ★ Réponse par défaut | Bloque |
|---|---|---|---|
| N-1 | Nom du schéma et du rôle (le prompt dit « `capex`, nom à confirmer ») | schéma **`arche`**, rôle **`arche_app`** (le nom de l’outil, comme `keystone`) — appliqué en livraison 1 | L1 |
| N-2 | Devise des filiales hors zone euro | v1 en **k€** seulement ; le montant en devise locale et le taux de référence groupe viennent plus tard | L2 |
| N-3 | Comptes des filiales | même locataire Entra si les filiales y sont, sinon **invités B2B** ; rôles et portées attribués dans Arche par l’admin | L1 |
| N-4 | Administrateur *(hors CDC)* | profil `admin` (PMO groupe ou DSI) : référentiels, utilisateurs, paramètres ; aucune donnée métier | L1 |
| N-5 | Les fonctions centrales voient-elles les brouillons ? | **non** : un brouillon reste dans la filiale jusqu’à l’ouverture | L1 |
| N-6 | Composition du COPIL GPI et qui enregistre sa décision | membres nommés par l’admin ; **président = Dir.IG**, qui enregistre la décision au nom du comité | L3 |
| N-7 | Que mesure le délai « 2 jours maximum » du G1 ? | **2 jours ouvrés** entre la mise à la décision (visa Sponsor) et la décision ; examen en ligne par les membres, sans attendre la séance mensuelle ; la séance suivante en prend acte | L3 |
| N-8 | Authentification récente pour signer | ≤ **10 minutes**, sinon nouvelle connexion Entra | L3 |
| N-9 | Format des codes | CAPEX `CPX-<FIL>-<AAAA>-<NN>` (ex. `CPX-APM-2026-01`) ; besoin `<code CAPEX>/B01` ; MoC `MOC-01` dans le CAPEX | L2 |
| N-10 | Consultation d’experts : délai et silence | délai **5 jours ouvrés** ; **pas d’avis tacite** ; le décideur peut forcer avec motif | L3 |
| N-11 | Modèle financier de la DAF | saisie structurée et import d’un gabarit Excel Arche ; horizon 10 ans ; taux d’actualisation = paramètre DAF ; le modèle existant de la DAF, s’il existe, remplacera le gabarit | L3 |
| N-12 | Liste des lots | génie civil, bâtiments, utilités, VRD, terrain, machines, recrutement, autres ; la liste est une liste de paramètres | L2 |
| N-13 | Jalons HS avant le connecteur Vigie | statut **déclaratif** saisi par le SSE groupe, avec une référence de preuve (Vigie ou Codex) ; il bascule en miroir quand Vigie publie | L5 |
| N-14 | Engagé et réalisé des lots hors EPC2i | saisie mensuelle ou import CSV par le CDG ; import Sage plus tard | L5 |
| N-15 | Clôture comptable du G3 | **attestation** du CDG (coût final par lot, solde de l’AFE), sans lien Sage en v1 | L6 |
| N-16 | Ramp-up : saisie et seuils (analyse §6.8) | saisie journalière par le CPF ou l’expert Exploitation de la filiale, import CSV ; jour conforme = production ≥ 100 % du nominal et rebuts ≤ objectif ; arrêts planifiés neutres | L6 |
| N-17 | Documents | **Décidé (22 oct.) : Codex héberge tous les documents d’Arche.** Arche ne stocke aucun fichier : références Codex (identifiant, révision, lien) ; dépôt des dossiers figés et lecture d’état par API Codex à obtenir ([`DEMANDES-CODEX.md`](DEMANDES-CODEX.md) CX-03, CX-04) ; en attendant, dépôt dans Codex par l’utilisateur et référence collée dans Arche | L3 |
| N-18 | Langues | français (par défaut) et anglais, comme Keystone | L1 |
| N-19 | « Audits transversaux » des projets Stratégiques | un audit par phase, tenu par le Dir.IG ou le PMO, consigné comme revue de type « audit » | L5 |
| N-20 | Reprise des CAPEX en cours | saisie manuelle des CAPEX pilotes (phase courante, jalons passés datés, budget validé) ; pas d’import en masse en v1 | pilote |
| N-21 | Jeu de démonstration | deux filiales fictives (APM Maroc, SAI Sahel), trois CAPEX ; aucune donnée réelle | L1 |
| N-22 | Qui possède les filiales, leurs zones et leurs sites ? Matrix possède les sites (D14) et l’organigramme (D15) mais sans niveau « société » | Matrix (nouveau niveau « société », [`DEMANDES-MATRIX.md`](DEMANDES-MATRIX.md) M-9) ; Arche garde ses tables `zones`, `subsidiaries`, `sites` en attendant, tenues par son administrateur | L2 |
| N-23 | Base de données | **Décidé (22 oct.) : PostgreSQL uniquement**, pas de PGlite : développement, tests, CI et production sur PostgreSQL, schéma `arche` partout (`npm run db:local` sur un poste) | — |
| N-24 | Rattachement Codex d’un document de CAPEX : nouveau rattachement `capex` dans Codex, ou CAPEX traité comme un « projet » Codex | nouveau rattachement **`capex`** (contexte = code CAPEX), qui évite de mélanger CAPEX et projets EPC2i ([`DEMANDES-CODEX.md`](DEMANDES-CODEX.md) CX-01) | L3 |
| N-26 | Qui valide une version de budget E50 ou E30 ? (le CDC ne parle que de l’E10, validé par la DAF groupe) | le **CDG de la filiale** ou la DAF groupe ; l’E10 reste réservé à la DAF groupe | L2 |
| N-27 | Qui enregistre la décision d’un jalon avant les circuits de la livraison 3 ? | le décideur l’enregistre lui-même sur la synthèse du CAPEX : **Dir.IG** pour G1 (au nom du COPIL GPI, N-6), K3 et G3 ; **PDG** pour G2 ; critères évalués et gardés avec la décision, forçage motivé et tracé ; remplacé par les circuits (visa, avis, signature) en L3 | L2 |
| N-28 | Échelle du registre des risques | probabilité et impact de **1 à 4** ; criticité = P × I ; **majeur à partir de 9** | L2 |
| N-29 | Qui crée le brouillon et qui le porte | le Sponsor (dans sa filiale) ou le chef de projet (dans la filiale de son compte) ; le chef de projet qui crée est nommé d’office ; le Sponsor est celui qui ouvre ; un membre d’équipe est toujours de la filiale ou du groupe (jamais d’une autre filiale) | L2 |
| N-25 | Identité des personnes entre outils (Cursus : matricule ; Arche : e-mail Entra) | Arche identifie par l’objet Entra et l’e-mail ; le matricule est ajouté aux comptes du groupe quand Cursus l’expose à Arche (CU-03) ; les salariés des filiales n’ont pas de matricule Cursus (CU-01) | L2 |

## 5. Ajouts au-delà du CDC (à valider, règle « rien hors du CDC sans accord »)

| Ajout | Pourquoi | ★ |
|---|---|---|
| Profil `admin` et écrans d’administration | il faut quelqu’un pour tenir les référentiels et les rôles | retenir |
| Point de contrôle K3 « Prêt à démarrer » | correction C-1 | retenir |
| Registres des risques et des décisions | le CDC cite « risques » et « décisions » sans les décrire | retenir, en version simple |
| Bibliothèque REX | « capitalisation automatique du REX » | retenir |
| Vue `pub_journal` pour Matrix | journal unifié des outils (convention D18 de Keystone) | retenir |
| Alertes à règles sans IA | le CDC demande des alertes ; elles marchent sans fournisseur d’IA | retenir |
| Mode démo « Voir en tant que » | développement, tests, démonstrations, derrière authentification HTTP | retenir |
