# Livraison 3 — Dossiers vivants, circuits des jalons, MoC

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L3). Réponses appliquées : celles du
> questionnaire (51 réponses par défaut confirmées, dont C-4, C-7, N-6, N-7, N-8, N-10, N-11, N-17) ; les nouvelles questions
> N-30 à N-35 ont leur réponse par défaut et sont ajoutées au questionnaire. N-27 (décision directe du décideur) est remplacée
> par les circuits.

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Dossiers vivants | Business Case Cadrage (G1), Dossier Investissement (G2), Transfert & REX (G3) : sections saisies, valeurs calculées par Arche (budget validé par lot, BP, risques ouverts, équipe et typologie), références Codex par section ; complétude par section et globale ; versions : brouillon → figée (valeurs calculées copiées, **empreinte SHA-256** du contenu canonique) → approuvée / refusée ; modifier une version figée crée la suivante et annule le circuit en cours ; contrôle « intègre / modifié » ; **vue imprimable A4** | `src/domain/dossiers.ts`, `src/features/dossiers/`, `/capex/[code]/dossiers`, `/print/capex/[code]/dossiers/[kind]` |
| Connecteur Codex | une référence (`TYPE-CONTEXTE-SEQ`, révision) est vérifiée dans `codex.pub_documents` quand Codex partage sa vue avec Arche (CX-05), sinon dans un catalogue simulé du jeu de démo ; non trouvée, elle est gardée « non vérifiée » ; lien profond vers Codex (`NEXT_PUBLIC_CODEX_URL`) ; aucune écriture dans Codex | `src/server/integrations/codex/` |
| Circuits des jalons | soumission par le CPF sur la version figée et complète (aucun dossier au K3) ; G1 : avis HSE (+ DAF si Stratégique) → visa Sponsor → examen COPIL GPI (facultatif) et décision du président ; G2 : avis Qualité, HSE, DAF, Exploitation → visas Dir.IG et DAF groupe → signature PDG ; K3 : visa Dir.IG ; G3 : quitus PSSR et attestation CDG → contresignatures Client Interne et Dir.IG, G3 prononcé à la dernière ; échéances en jours ouvrés (5 pour un avis, délai du jalon sinon ; 2 au G1, N-7) ; un refus arrête le circuit et renvoie le dossier ; la décision applique le cycle avec les critères évalués alors (dossier, avis, visa du Sponsor compris) et forcés avec motif | `src/domain/circuits.ts`, `src/features/gates/`, `src/server/cycle/`, `/capex/[code]/gates` |
| Signature simple | toute étape hors avis et examen : engagement à cocher, authentification de moins de 10 minutes en mode Entra (sinon « se reconnecter », `prompt=login`, N-8), ligne **append-only** (déclencheur) avec utilisateur, horodatage, empreinte de la version, instant d’authentification, empreinte de l’adresse IP | migration `0007`, `src/features/gates/actions.ts` |
| Mes validations | étapes de circuit dues au profil actif, versions de budget à valider, typologies à confirmer, MoC à décider ; en attente, en retard, plus ancien | `src/domain/approvals.ts`, `src/server/dal/approvals.ts`, `/my/approvals` |
| Matrice de délégation et MoC | matrice datée (valeurs d’amorce de la spec 05 §5), modifiable par l’administrateur, en vigueur à partir du jour d’enregistrement ; après G2, une MoC (coût, délai, périmètre, tirage de provision) va au plus petit niveau qui couvre la modification et le cumul des MoC approuvées ; décision du Copil projet enregistrée par le Sponsor (N-30), du Dir.IG, du PDG | `src/domain/delegation.ts`, `src/features/changes/`, `/capex/[code]/changes`, `/admin/delegation` |
| BP | flux annuels sur 10 ans (CAPEX, OPEX, CA), taux d’actualisation ; VAN, TRI, délai de retour ; saisi par le CDG ou le CPF, validé par la DAF groupe (une modification annule la validation) | `src/domain/bp.ts`, page Budget |
| Données de démo | circuits et signatures des G1 / G2 passés, dossiers approuvés avec références Codex, dossier 2 en cours, BP, MoC (une approuvée, une à décider par le Dir.IG) | `src/server/db/seed/demo.ts` |

## 2. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur.
- `npm test` : 181 tests sur PostgreSQL 16. Le test de bout en bout `src/features/gates/actions.test.ts` crée un CAPEX et le
  mène à la clôture par les circuits : dossier 1 saisi, références Codex vérifiée et non vérifiée, figé ; **G1 dématérialisé de
  bout en bout le jour même** (échéance de la décision à J+2 ouvrés) avec signature portant l’empreinte ; G2 refusé par un visa
  puis resoumis sur la version 2 et signé par le PDG avec réserves ; MoC routées par la matrice ; K3 ; G3 par quitus, attestation
  et contresignatures ; signatures append-only ; « Mes validations ».
- Build de production, `next start`, `npm run test:smoke` : 30 contrôles HTTP passent. Écrans vérifiés dans le navigateur
  (jalons, dossier, Mes validations, MoC décidée, section et référence Codex saisies).

## 3. Limites et suite

- Relances par e-mail des étapes dues : pas de transport d’e-mail en v1 (N-35) ; « Mes validations » et la page du jalon
  montrent ce qui est dû et en retard.
- Dépôt du dossier figé et signé dans Codex : attend l’API de Codex (CX-03, CX-07) ; l’utilisateur dépose le PDF de la vue
  imprimable et en garde la référence.
- Signature avancée (G2 / AFE) : livraison 7 (C-7).
- Provision pour aléas non saisie : un tirage va au Dir.IG (N-33).
- Jours fériés non pris en compte (N-34).
