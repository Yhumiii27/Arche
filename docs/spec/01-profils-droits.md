# 01 — Profils, portées et droits

> Proposition (CDC §3, §4 « Gestion fine des rôles » ; prompt §2 « Profils »). Points ouverts : C-6, N-3, N-4, N-5.

## 1. Profils

Douze profils métier (prompt §2), plus l’administrateur (hors CDC, N-4). Les clés sont celles du code.

| Clé | Profil | Portée | Rôle dans DIG-PRODI |
|---|---|---|---|
| `sponsor` | Sponsor | filiale | ouvre le CAPEX, vise le Business Case Cadrage, préside le Copil projet |
| `project_lead` | Chef de projet filiale | CAPEX nommés | tient le CAPEX, ses dossiers, ses lots, ses besoins machines ; soumet aux jalons ; ouvre les consultations |
| `controller` | CDG filiale | filiale | budget, engagé, réalisé, BP ; clôture comptable du G3 |
| `co_dig` | Co-DIG | CAPEX nommés (Light) | appui ; lecture et commentaires ; tient les revues avec le CPF |
| `dir_ig` | Directeur Industriel Groupe | groupe | conformité en exécution ; préside le COPIL GPI (N-6) ; contresigne le PV de transfert ; force une typologie |
| `ceo` | PDG | groupe, **voit tout** | signe le G2 (Single Gate) ; décide au-delà des seuils délégués |
| `group_cfo` | DAF groupe | groupe (vue croisée) | consolide le BP (classe E10) ; saisit le CA de référence des filiales ; expert DAF par défaut |
| `group_hse` | SSE groupe | groupe (vue croisée) | jalons HS ; quitus PSSR ; expert HSE par défaut |
| `epc2i_pmo` | PMO EPC2i | CAPEX nommés (Stratégiques) | appui opérationnel ; lecture des besoins machines et des projets EPC2i liés |
| `expert` | Expert (Qualité / HSE / DAF / Exploitation) | CAPEX où il est consulté | rend un avis motivé ; spécialité portée par l’affectation |
| `copil_member` | Membre COPIL GPI | groupe (lecture) | examine les dossiers soumis au G1 ; donne un avis en séance ou en ligne |
| `zone_director` | Directeur de Zone | filiales de ses zones (lecture) | lecteur ; portefeuille de sa zone |
| `admin` *(hors CDC)* | Administrateur Arche | global | référentiels (filiales, sites, zones), utilisateurs et rôles, paramètres du cycle, matrice de délégation, connecteurs ; **aucune donnée métier** |

Un utilisateur peut porter plusieurs rôles (comme dans Keystone : rôle actif + liste des rôles).

## 2. Portées et isolation

Chaque affectation de rôle a une **portée** :

| Portée | Valeur | Exemple |
|---|---|---|
| `group` | — | PDG, Dir.IG, DAF groupe, SSE groupe, membre COPIL GPI, admin |
| `zone` | code de zone | Directeur de Zone « Afrique de l’Ouest » |
| `subsidiary` | code filiale | Sponsor, CDG, expert de filiale |
| `capex` | code CAPEX (équipe nommée) | CPF, Co-DIG, PMO EPC2i, expert consulté |

Règle de **visibilité** d’un CAPEX (`canSeeCapex`, règle pure dans `src/domain/rights.ts`) :

1. `ceo` : tous.
2. Fonctions centrales en **vue croisée** (`dir_ig`, `group_cfo`, `group_hse`, `copil_member`) : tous les CAPEX, au-delà du
   brouillon (N-5 : un brouillon reste dans la filiale).
3. `zone_director` : les CAPEX des filiales de ses zones, au-delà du brouillon.
4. Portée `subsidiary` : les CAPEX de sa filiale.
5. Portée `capex` : les CAPEX où l’utilisateur est nommé (équipe ou consultation en cours ou passée).
6. Tous les autres : rien. Un utilisateur de filiale ne voit **jamais** le CAPEX d’une autre filiale : la page répond
   « introuvable » (pas « interdit »), les listes et tableaux de bord filtrent en base.

L’isolation est appliquée **dans la couche d’accès aux données** (filtre par portée sur chaque lecture), pas seulement dans
les écrans ; un test parcourt chaque profil et vérifie qu’aucune lecture ne renvoie un CAPEX hors portée.

## 3. Droits d’écriture

Le droit d’écrire suit le rôle **et** la phase. Lecture seule partout pour `zone_director`, `copil_member` (hors son avis),
et pour tout CAPEX clos ou abandonné.

| Action | Qui | Conditions |
|---|---|---|
| Créer un CAPEX (brouillon) | `sponsor`, `project_lead` de la filiale | — |
| Ouvrir le CAPEX (brouillon → Phase 1) | `sponsor` | CPF nommé |
| Modifier fiche, lots, risques, décisions | `project_lead` du CAPEX, `sponsor` | phase ouverte ; pas pendant un circuit de jalon en cours sur le dossier figé |
| Budget (versions, engagé, réalisé) | `controller`, `project_lead` | une version validée est figée |
| BP consolidé E10 (Dossier 2) | `group_cfo` (valide), `controller` (prépare) | Phase 2 |
| Saisir le CA de référence d’une filiale | `group_cfo` | — |
| Forcer la typologie | `dir_ig` | motif obligatoire, audité |
| Besoins machines | `project_lead` | soumission : Phase 1 ou 2 ; passage à « commandé » : automatique au G2 |
| Ouvrir une consultation d’experts | `project_lead` | sur une version figée d’un dossier |
| Rendre un avis | `expert` consulté | avant clôture de la consultation |
| Viser / signer / décider un jalon | selon le circuit (05) | dossier figé, critères satisfaits ou forcés avec motif |
| MoC : décider | selon la matrice de délégation (05 §4) | après G2 |
| Jalons HS (déclaratif, N-13) | `group_hse` | preuve (référence Vigie ou Codex) |
| Ramp-up : saisie journalière | `project_lead`, Client Interne (rôle `project_lead` ou `expert` Exploitation, N-16) | après début de MES |
| Référentiels, paramètres, utilisateurs | `admin` | jamais de données métier |

## 4. Connexion

- `ARCHE_AUTH=entra` (production) : Microsoft Entra ID, repris de Keystone (`src/server/auth/`). Rôles et portées en base
  (table `role_assignments`), alimentés par l’admin ; correspondance optionnelle groupes Entra → rôles
  (`ENTRA_GROUP_ROLES`). Les utilisateurs de filiales sur un autre annuaire viennent en invités B2B (N-3).
- `ARCHE_AUTH=demo` (développement, tests, bêta derrière authentification HTTP) : « Voir en tant que » sur une personne de
  démonstration par profil, rattachée à une filiale de démonstration. Jamais exposé sans authentification HTTP.

## 5. Personnes de démonstration (jeu `demo`)

Deux filiales fictives (N-21) : **Atlas Process Maroc** (`APM`, zone Afrique du Nord) et **Sahel Agro Industries** (`SAI`, zone
Afrique de l’Ouest), plus le groupe et EPC2i. Une personne par profil ; deux CAPEX de démonstration (un Light en Phase 2, un
Stratégique en Phase 3) et un CAPEX en brouillon.
