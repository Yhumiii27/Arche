# 04 — Les trois dossiers vivants

> CDC §1 (« 3 dossiers vivants sous workflow »), §2 ; analyse C-2. Un dossier vivant est **une donnée structurée**, pas un
> document : des sections saisies dans Arche, des valeurs calculées (budget, pack, HS, BP) et des **références** de documents
> Codex. Le tableau de bord d’exécution (CDC « Livrable 3.1 ») n’est pas un dossier vivant (C-2).

## 1. Cycle d’une version

```
brouillon ──figer & soumettre──▶ figé ──circuit──▶ approuvé
    ▲                              │            └──▶ refusé / ajourné
    └────── nouvelle version ◀─────┘ (toute modification après figement)
```

- **Figer** copie le contenu (sections, valeurs calculées à l’instant, références Codex avec leur révision) dans
  `dossier_versions.content`, calcule l’**empreinte SHA-256** du contenu canonique (JSON trié) et l’enregistre. La version
  figée est immuable ; les signatures portent cette empreinte.
- Une modification après figement crée la version suivante (brouillon) et **annule** le circuit en cours (étapes non
  encore faites), avec trace dans l’audit.
- **Complétude** : % des champs obligatoires renseignés, par section et global ; affiché en permanence.
- **Vue imprimable** de chaque version (page « dossier » au format A4). La version figée et signée est **déposée dans Codex**
  (dossier de jalon, PDF + empreinte) dès que Codex offre une API de dépôt (CX-03, CX-07) ; en attendant, l’utilisateur la
  dépose et Arche garde la référence.
- **Pièces** : toujours des **documents Codex** (N-17) — Arche garde l’identifiant, la révision figée avec la version et le
  lien profond ; le type Codex attendu par pièce est dans la colonne « Type Codex » (types manquants : CX-02).

## 2. Dossier 1 — Business Case Cadrage (Phase 1, G1)

| Section | Contenu | Obligatoire |
|---|---|---|
| 1. Besoin et périmètre | description du besoin, produit, capacité visée, site, périmètre inclus / exclus | oui |
| 2. Alignement stratégique et marché | marché, clients, alignement avec la stratégie de la filiale et du groupe | oui |
| 3. Barrières à l’entrée | technologiques, réglementaires, concurrence | oui |
| 4. Contraintes foncières et réglementaires | ICPE, PLU, accès site, foncier (statut, surface) | oui |
| 5. BP préliminaire | budget **E50** par lot (version validée), OPEX, CA attendu, VAN / TRI / retour simple (06 §4) | oui |
| 6. Besoins machines | lignes de besoin (07) et réponses indicatives EPC2i reçues | si le CAPEX comprend des machines |
| 7. Risques initiaux | extrait du registre (risques ouverts) | oui |
| 8. Sécurité | état HS 2 HazID (preuve) | oui |
| 9. Équipe et typologie | sponsor, CPF, équipe, typologie calculée ou forcée | oui |

Circuit : avis d’experts → visa Sponsor → décision COPIL GPI (05 §2).

## 3. Dossier 2 — Dossier Investissement (Phase 2, G2)

| Section | Contenu | Obligatoire |
|---|---|---|
| 1. Baseline technique | variantes étudiées, variante retenue, date de gel | oui |
| 2. Pack ingénierie | % pondéré (filiale + EPC2i), pièces par famille : P&ID (`PID`), BOM (`BOM`), layout (`GA`) et plan de masse (à créer), schémas électriques (`SCH`), analyses fonctionnelles (`FDS`) — références Codex | oui (> 80 %) |
| 3. Dossier réglementaire | registre des autorisations : ICPE, permis de construire, PLU, zonage ATEX — pièces Codex de type `AUT` (sous-types à créer, CX-02) | oui |
| 4. Sécurité | HS 3 HazOp / AMDEC (preuve), actions ouvertes | oui |
| 5. AFE | montant demandé (budget E10), phasage des décaissements, lots, provision pour aléas | oui |
| 6. BP consolidé DAF | flux, VAN, TRI, retour, sensibilités ; validé par la DAF groupe | oui |
| 7. Offres EPC2i | offres fermes par besoin machine (`pub_reponses_besoins`) | si besoins machines |
| 8. Planning directeur | jalons prévus : commande, travaux, MES, ramp-up, G3 | oui |
| 9. Risques | registre à jour | oui |
| 10. Avis d’experts | Qualité, HSE, DAF, Exploitation | oui (rempli par le circuit) |

Circuit : avis d’experts → visas Dir.IG et DAF groupe → **signature PDG** (05 §2).

## 4. Dossier 3 — Transfert & REX (Phase 4, G3)

| Section | Contenu | Obligatoire |
|---|---|---|
| 1. Actifs transférés | liste unique : lots et machines (parc Keystone `pub_parc_machines`), valeur | oui |
| 2. Réserves | conditions de jalons et MoC soldées ; réserves des projets EPC2i (`pub_reserves`) ; PV EPC2i (`pub_livrables`) | oui (toutes soldées) |
| 3. Sécurité | quitus PSSR, HS 6 ASPD | oui |
| 4. Montée en puissance | courbe, date des 30 jours continus, TRS et rebuts de réception | oui |
| 5. Clôture comptable | coût final par lot, écart au budget G2, solde de l’AFE, attestation du CDG | oui |
| 6. REX | leçons par phase et par catégorie, diffusion aux fonctions centrales (DAF, SSE, Dir.IG, PMO EPC2i) | oui |
| 7. PV de transfert d’actif | généré depuis les sections 1–5 ; contresigné Client Interne + Dir.IG | oui (rempli par le circuit) |

Circuit : attestation CDG et quitus PSSR → contresignature Client Interne et Dir.IG (en parallèle) → G3 (05 §2).

**Capitalisation du REX** (CDC « automatique ») : au G3, les entrées REX sont publiées dans la bibliothèque REX d’Arche,
lisible par toutes les fonctions centrales et par les CPF de toutes les filiales (titre, catégorie, texte, CAPEX d’origine),
avec notification aux fonctions centrales. Le partage vers Keystone (REX machine) passe par `pub_rampup` (R-193).
