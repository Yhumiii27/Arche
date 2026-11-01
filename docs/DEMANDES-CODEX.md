# Demandes d’Arche à Codex (GED du groupe)

> 22 oct. 2026. **Décision du responsable produit (22 oct.) : Codex héberge tous les documents d’Arche.** Arche ne stocke
> aucun fichier : il garde des **références** de documents Codex (identifiant `TYPE-CONTEXTE-SEQ`, lettre de révision, lien
> `/documents/{id}`) dans ses dossiers vivants, ses autorisations, son pack ingénierie et ses jalons. Arche **ne modifie
> jamais** le dépôt Codex : ces demandes sont à transmettre au chat Codex par le responsable produit.
>
> État de Codex relevé le 22 oct. 2026 (dépôt `Yhumiii27/Codex`, commit `9f0b121`) : modèle `TYPE-CONTEXTE-SEQ` (projet,
> programme de recherche, `QMS` pour les modèles, département sinon), révisions en lettres validées par circuit, 5 niveaux de
> confidentialité, registre de 69 types (provisoire, O-05), rattachement fermé `none | project | research`, vues `pub_`
> (`pub_documents`, `pub_revisions_document`, `pub_validations`, `pub_types_document`, `pub_circuits_type`,
> `pub_titulaires_fonction`), API limitée au registre (`GET /api/registry`) et à l’import de migration (`POST /api/import`).
> **Aucune API ne permet aujourd’hui à une autre application de déposer ni de lire un document** (même besoin chez Keystone
> et Cursus).

| # | Demande | Pourquoi | Nécessaire pour (Arche) | Priorité |
|---|---|---|---|---|
| CX-01 | **Rattachement d’un document à un CAPEX** : un 4ᵉ rattachement `capex` (contexte = code CAPEX, ex. `PID-CPX-APM-2026-01-001`), ou un CAPEX traité comme un projet dans `codex.projects`, alimenté par `arche.pub_capex` (N-24) | Les documents d’un CAPEX (P&ID usine, plan de masse, permis, AFE, PV de transfert…) n’appartiennent à aucun projet EPC2i | L3 (dossiers vivants) | haute |
| CX-02 | **Types de document manquants** au registre (nouveaux types ou sous-types de `AUT`, `RSQ`, `DEF`, `PLN`, `PV`, `REM`, `CLO`) : plan de masse, HazID, HazOp / AMDEC, zonage ATEX (DRPCE), dossier ICPE, permis de construire / PLU, AFE, PSSR (et RSPDI), audit ASPD, business plan / dossier d’investissement, PV de transfert d’actif, dossier de jalon DIG-PRODI (G1, G2, G3) | Le pack ingénierie et les dossiers vivants (spec 04) citent ces pièces ; le registre ne les a pas (O-05) | L3, L5 | haute |
| CX-03 | **API de dépôt depuis une autre application** : créer un document (métadonnées : type, rattachement, titre, confidentialité, propriétaire) avec son fichier, et recevoir son identifiant ; idempotente (référence d’origine `arche:<objet>`) ; authentification par clé signée comme `POST /api/import` | Arche doit déposer la version figée de chaque dossier vivant (export PDF signé) et laisser l’utilisateur déposer une pièce depuis Arche | L3 (au plus tard L7) | haute |
| CX-04 | **API ou vue de lecture de l’état d’un document** (révision en vigueur, statut, circuit) par identifiant | Afficher dans Arche « validé / en revue » d’une pièce du pack (C-9) et figer la révision dans un dossier | L3 | haute |
| CX-05 | **Droits de lecture d’`arche_app`** sur `codex.pub_documents`, `pub_revisions_document`, `pub_validations`, `pub_types_document` (par Matrix, `90-droits.sql`) | Lecture des références sans API | L3 | moyenne |
| CX-06 | **Accès des utilisateurs des filiales** aux documents de leurs CAPEX dans Codex (organigramme O-04 avec les filiales, confidentialité) | Le lien profond d’Arche vers Codex doit ouvrir le document pour un utilisateur de filiale | L3 | moyenne |
| CX-07 | **Version figée non modifiable** : un dossier de jalon déposé par Arche (signé, empreinte SHA-256 connue d’Arche) reste en l’état (révision approuvée d’office, ou conservation légale `legal_hold`) | La preuve d’une décision G1 / G2 / G3 ne doit pas changer | L3 | moyenne |
| CX-08 | **Lien profond stable** `/documents/{id}` (existe ; il résout aussi les alias) — confirmer qu’il reste le contrat | Liens d’Arche vers Codex | L3 | basse |

**État au 23 oct. 2026.** Codex traite CX-03 (`POST /api/documents`), CX-04 (état lu dans `pub_documents`,
`pub_revisions_document`, `pub_validations`) et CX-08 (`/documents/{id}` confirmé) dans Yhumiii27/Codex#12. Côté Arche
(`src/server/integrations/codex/deposit.ts`) : depuis une section d’un dossier, un fichier est déposé dans Codex (brouillon
A.1) et le document créé est rattaché à la section ; le PDF de la vue imprimable d’une version figée est déposé et son
identifiant Codex est gardé sur la version (`dossier_versions.codex_document_id`). Le dépôt est rejouable : même référence
`arche:dossier/<CAPEX>/<dossier>/…` et même fichier → le document déjà créé. Restent ouvertes : CX-01 (rattachement
`capex` ; le dépôt se fait en attendant au contexte du département), CX-02 (types), CX-06 (accès des filiales), CX-07 (un
dépôt d’Arche reste un brouillon que son propriétaire soumet à un circuit dans Codex).

Sans le dépôt configuré (`CODEX_DOCUMENTS_TOKEN` ou `CODEX_DOCUMENTS_SECRET`), l’utilisateur dépose la pièce dans Codex, puis
colle son identifiant dans Arche ; Arche vérifie l’identifiant dans `codex.pub_documents` dès que CX-05 est accordé, sinon il
garde la référence telle quelle avec la mention « non vérifiée ».

Questions de Codex qui touchent Arche : O-01 (SharePoint), O-02 (Entra ID), O-03 (contrat de dépôt et de synchronisation),
O-04 (organigramme), O-05 (registre).
