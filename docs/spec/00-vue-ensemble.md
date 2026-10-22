# Arche — vue d’ensemble (livraison 0, cadrage)

> 22 oct. 2026. **Arche** est l’application du groupe pour piloter les **CAPEX des filiales** selon la méthodologie
> **DIG-PRODI v4.0**. Sources : dépôt Keystone, branche `main-2a2fep` (commit `9c3a80c`) —
> `docs/dig-prodi/CDC-DIG-PRODI-v4.0-draft.md` (CDC), `docs/dig-prodi/ANALYSE-DIG-PRODI.md` (analyse),
> `docs/dig-prodi/ARCHITECTURE-CAPEX-KEYSTONE.md` (architecture, **la référence**), `docs/dig-prodi/PROMPT-APP-CAPEX.md`.
> Ce document et les suivants sont des **propositions** : les points ouverts sont dans [`../DECISIONS.md`](../DECISIONS.md)
> avec une réponse par défaut. Rien ne sera codé avant les réponses du responsable produit.

## 1. Ce qu’est Arche

| Niveau | Qui pilote | Objet | Outil |
|---|---|---|---|
| **N1 — CAPEX usine** | la filiale (sponsor, chef de projet filiale, CDG) ; le groupe arbitre (COPIL GPI, PDG, Dir.IG, DAF, SSE) | l’investissement complet : terrain, génie civil, bâtiments, utilités, VRD, machines, recrutement, montée en puissance | **Arche** |
| **N2 — Besoin machine** | la filiale exprime (Arche), EPC2i qualifie et répond (Keystone) | une ou plusieurs machines du catalogue EPC2i | Arche (demande) + Keystone (réponse) |
| **N3 — Projet EPC2i** | le chef de projet EPC2i | la fourniture des équipements (13 étapes) | Keystone |

Arche possède (décision A-4) : les CAPEX, leurs phases et jalons G1/G2/G3, les trois dossiers vivants, les lots hors EPC2i,
le budget par classe d’estimation et le BP, la typologie, la gouvernance (staffing, revues), le ramp-up, les besoins machines
(côté demande) et le registre des autorisations du site.

## 2. Frontières

| Propriétaire | Ce qu’il possède | Ce qu’Arche en fait |
|---|---|---|
| **Keystone** | catalogue machines, réponses aux besoins (qualification, devis, offre), projets EPC2i et tout leur contenu (jalons, avancement, avenants, réserves, livrables, pack ingénierie machine, parc installé) | lit les vues `pub_` (connecteur `keystone` : miroir, simulation tant que les vues manquent), affiche, ouvre Keystone par lien profond |
| **Vigie** (à confirmer, AC-3) | HazID, HazOp, AMDEC, PSSR, RSPDI, ASPD et actions de sécurité | affiche l’état (miroir), bloque les jalons, alerte sur les retards, ouvre Vigie par lien profond |
| **Codex** | documents (P&ID, layout, AFE signée, permis, PV…) | garde des **références** de documents dans les dossiers vivants ; ouvre Codex par lien profond |
| **Cursus** | personnes, habilitations | rien en v1 (les utilisateurs d’Arche viennent d’Entra ID) |
| **Sage** | comptabilité, immobilisations | rien en v1 ; la clôture comptable du G3 est une attestation du CDG (N-15) |
| **Matrix** | socle du serveur PostgreSQL commun, droits, registre des tables, journal unifié | Arche s’y déclare ; les scripts Matrix sont **proposés** dans [`../DEMANDES-MATRIX.md`](../DEMANDES-MATRIX.md) |

Arche **n’écrit que dans son schéma** (`arche`, N-1) et ne lit les autres outils que par leurs vues `pub_`. Arche ne crée rien
chez les autres : un besoin machine passe à « commandé » chez Arche, c’est Keystone qui crée le projet EPC2i.

## 3. Glossaire (propositions, à valider — C-6)

| Terme | Définition proposée |
|---|---|
| **CAPEX** | dossier d’investissement d’une filiale, porté par un sponsor ; une usine, une ligne ou une extension. Code `CPX-<FIL>-<AAAA>-<NN>` (N-9). |
| **Filiale** | société du groupe qui investit ; a un code à 3 lettres, un pays, une zone, un CA de référence. |
| **Site** | usine ou terrain d’une filiale où le CAPEX est réalisé. |
| **Zone** | regroupement géographique de filiales, suivi par un **Directeur de Zone** (lecteur). |
| **Sponsor** | dirigeant de la filiale porteur du CAPEX ; vise le Business Case Cadrage. |
| **Chef de projet filiale (CPF)** | pilote le CAPEX au quotidien ; « Chef de projet dédié » pour un projet Stratégique. |
| **CDG filiale** | contrôleur de gestion de la filiale ; tient budget, engagé, réalisé, clôture comptable. |
| **Co-DIG** | appui opérationnel léger de la Direction Industrielle Groupe aux projets Light (définition à confirmer). |
| **Dir.IG** | Directeur Industriel Groupe : vérifie la conformité de l’exécution à l’Avant-Projet, contresigne le PV de transfert. |
| **COPIL GPI** | comité de pilotage groupe (« Grands Projets Industriels », à confirmer), mensuel, qui prononce le G1. |
| **Copil projet** | comité propre à un CAPEX ; revues trimestrielles (Light) ou mensuelles (Stratégique) ; décide dans ses seuils délégués. |
| **Client Interne** | l’exploitation de la filiale qui reçoit l’actif (directeur d’usine) ; contresigne le PV de transfert. |
| **PMO EPC2i** | appui opérationnel d’EPC2i aux projets Stratégiques. |
| **Expert** | spécialiste Qualité, HSE, DAF ou Exploitation qui rend un avis asynchrone sur un dossier. |
| **Dossier vivant** | ensemble structuré de données sous workflow (pas un document) ; figé et horodaté à chaque soumission. |
| **Classe d’estimation** | précision d’un budget : `E50` (±50 %), `E30` (±30 %), `E10` (+10 % / −5 %) (C-8). |
| **Jalon G** | décision G1, G2, G3. **Jalon HS** : jalon de sécurité HS 2 à HS 6 (C-3). |
| **MoC** | *Management of Change* : modification du CAPEX après G2 (coût, délai, périmètre), décidée selon la matrice de délégation. |
| **MES** | mise en service ; la date de **début de la MES** (introduction de produit, après le PSSR) ouvre le délai de 6 mois du G3. |

## 4. Documents du cadrage

| Fichier | Contenu |
|---|---|
| [`01-profils-droits.md`](01-profils-droits.md) | profils, portées, isolation par filiale, matrice des droits |
| [`02-objets.md`](02-objets.md) | objets et modèle de données (tables du schéma `arche`) |
| [`03-cycle-dig-prodi.md`](03-cycle-dig-prodi.md) | cycle paramétré : phases, jalons G et HS, critères, transitions |
| [`04-dossiers-vivants.md`](04-dossiers-vivants.md) | les 3 dossiers vivants : sections, complétude, versions, figement |
| [`05-circuits.md`](05-circuits.md) | visas, signatures, avis d’experts, matrice de délégation, « Mes validations » |
| [`06-gouvernance-pilotage.md`](06-gouvernance-pilotage.md) | typologie, staffing, revues, budget et S-curve, tableaux de bord, ramp-up, alertes, IA |
| [`07-besoins-machines.md`](07-besoins-machines.md) | besoins machines et connecteur Keystone |
| [`08-ecrans.md`](08-ecrans.md) | registre des écrans et accès par profil |
| [`../DECISIONS.md`](../DECISIONS.md) | questions ouvertes et réponses par défaut |
| [`../CONTRATS.md`](../CONTRATS.md) | vues `pub_` lues et publiées, colonne par colonne |
| [`../DEMANDES-KEYSTONE.md`](../DEMANDES-KEYSTONE.md), [`../DEMANDES-MATRIX.md`](../DEMANDES-MATRIX.md) | ce qu’Arche demande aux autres dépôts |
| [`../PLAN.md`](../PLAN.md) | plan de livraisons aligné sur le §5 du CDC |
| [`../SOCLE.md`](../SOCLE.md) | socle repris de Keystone et commit d’origine |

## 5. Principes repris de Keystone

- Réponses au responsable produit en français ; code, identifiants et commits en anglais ; interface en anglais source
  traduite, **français par défaut** ; contrôle de complétude du français.
- Rien hors du CDC sans accord. Les ajouts que ce cadrage propose au-delà du CDC sont marqués **« hors CDC »** et listés
  dans `DECISIONS.md` §5.
- Ce que les gens tapent s’affiche tel quel (jamais par `t()`).
- La piste d’audit est append-only (déclencheur en base) : jamais modifiée ni effacée.
- Chaque Server Function valide l’entrée et les droits côté serveur, écrit par la couche d’accès aux données, trace l’audit
  et l’activité, puis revalide la page.
- Les règles pures (cycle, typologie, classes, délégation, ramp-up) vivent dans `src/domain/` avec des tests de valeurs.
- Une seule horloge métier (`businessToday()`), jamais de date figée dans le code.
- Migrations générées, jamais réécrites ; les vues `pub_` sont des contrats.
- Chaque lot vérifié va dans `main` par une PR fusionnée une fois la CI verte.
- Ports sur le Mac du responsable produit : **3400** (Arche), **3410** (tests d’Arche) ; jamais 3000, 3100, 3110, 3200, 3210,
  3217, 3310, 5173.
