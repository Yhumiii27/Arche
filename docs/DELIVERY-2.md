# Livraison 2 — CAPEX et cycle DIG-PRODI

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L2). Réponses appliquées : celles du
> questionnaire « Décisions Arche » (C-6, N-3, N-4, N-22, N-24 confirmées) et, pour le reste, les réponses par défaut de
> [`DECISIONS.md`](DECISIONS.md) (C-1, C-5, C-8, N-2, N-9, N-12, et les nouvelles N-26 à N-29, ajoutées au questionnaire).

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Modèle DIG-PRODI 4.0 | phases, jalons G1 / G2 / K3 / G3 (C-1), 25 critères avec leur caractère bloquant ou forçable et la livraison qui apporte leur donnée ; moteur pur d’évaluation (un critère sans donnée est « pas encore évalué » et ne bloque pas) et de transitions (ouverture, Go, Go sous réserve, Ajourné = nouvelle session, No-Go = abandon, suspension et reprise) ; valeurs réglables par l’administrateur (délais des jalons, seuil Stratégique, seuils pack / travaux / ramp-up / MES) | `src/domain/lifecycle.ts`, page `/admin/model` |
| Registre et brouillon | « Nouveau CAPEX » pour le Sponsor (sa filiale) et le chef de projet (filiale de son compte) ; code `CPX-<FIL>-<AAAA>-<NN>` calculé dans la transaction (N-9) ; le brouillon reste dans la filiale (N-5) ; ouverture par le Sponsor une fois le chef de projet nommé | `src/features/capex/actions.ts`, `/capex` |
| Synthèse du CAPEX | fiche d’identité modifiable, indicateurs (statut, phase, typologie, budget validé et sa fourchette), cycle avec le jalon à passer et ses critères évalués maintenant, décision du jalon par le décideur (N-27), suspension / reprise par le Dir.IG, historique du cycle et réserves | `/capex/[code]` |
| Budget | lots (liste N-12, lots machines marqués EPC2i) ; versions E50 / E30 / E10 avec montant central par lot et fourchette de la classe (C-8) ; une version en cours à la fois ; brouillon → soumise → validée (figée, la précédente est remplacée) ou renvoyée avec motif ; E10 validée par la DAF groupe seule, E50 / E30 par le CDG ou la DAF (N-26) ; baseline G2 marquée au Go du G2 | `src/domain/budget.ts`, `/capex/[code]/budget` |
| Typologie | ratio budget validé / CA de référence (dernier exercice clos), Stratégique à partir de 20 % (« = 20 % » compris), nouvelle usine Stratégique d’office, « à déterminer » sans CA ou sans budget validé (bloque le G1) ; posée la première fois, puis un changement attend la confirmation du Dir.IG ; forçage par le Dir.IG avec motif (C-5) | `/capex/[code]/governance` |
| Équipe | membres nommés par rôle ; le chef de projet, le Co-DIG et le PMO EPC2i reçoivent le rôle du CAPEX (ils le voient) ; jamais une personne d’une autre filiale ; gabarit de staffing Light / Stratégique et alerte « équipe incomplète » (critère G1 en alerte, G2 bloquant) | `/capex/[code]/governance` |
| Risques et décisions | registre des risques (P × I de 1 à 4, majeur ≥ 9, N-28) ; registre des décisions (les décisions de jalon s’y inscrivent d’office) | `/capex/[code]/risks`, `/capex/[code]/governance` |
| Journal | piste d’audit et activité du CAPEX | `/capex/[code]/journal` |
| Vue `pub_capex` | contrat v1 de `CONTRATS.md` §3 (CAPEX ouverts, hors brouillons ; dates des Go G1 / G2 / G3) | `drizzle/0005_share_capex.sql` |
| Données de démo | CA de référence d’APM et de SAI ; lots, versions, jalons passés, risques et décisions des trois CAPEX | `src/server/db/seed/demo.ts` |

Toutes les écritures passent par des Server Functions qui relisent le CAPEX à travers le filtre de visibilité (hors portée :
« introuvable »), vérifient le droit du rôle actif (`canDo`, `src/domain/capex.ts`), valident l’entrée dans la transaction,
écrivent et tracent l’audit (zone « CAPEX », rattaché au CAPEX).

## 2. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur.
- `npm test` : 161 tests sur PostgreSQL 16, dont un CAPEX créé par le chef de projet qui parcourt les quatre phases jusqu’à
  la clôture (G1 ajourné puis Go, E10 validé par la DAF, typologie recalculée puis confirmée, G2 Go sous réserve avec un
  critère forcé, K3, G3), les refus par profil, l’isolation entre filiales, le No-Go, la suspension, et les contrats de
  `pub_capex`.
- Build de production, `next start`, `npm run test:smoke` : 23 contrôles HTTP passent. Écrans vérifiés dans le navigateur
  (synthèse, budget, gouvernance, risques avec création d’un risque, modèle DIG-PRODI).

## 3. Limites et suite

- Les critères qui lisent les dossiers, les avis, les visas (L3), Keystone (L4), le pack, les autorisations, les jalons HS
  (L5) et le ramp-up (L6) sont affichés « pas encore évalués » : ils ne bloquent pas avant leur livraison.
- La décision d’un jalon est enregistrée directement par le décideur (N-27) ; les circuits la remplacent en L3.
- Les montants restent en k€ (N-2) ; l’engagé, le réalisé et le BP arrivent en L3 et L5.
- Un changement du CA de référence ne recalcule pas la typologie : le recalcul se fait à la validation d’une version.
