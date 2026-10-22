# 08 — Écrans

> Proposition de registre (`src/config/screens.ts`, comme dans Keystone : identifiant, route, titre, profils). Design Nocturne
> repris de Keystone ; pas de maquette dédiée : les écrans suivent les motifs de Keystone (en-tête de page, tuiles KPI,
> cartes de section, tableaux, onglets en paramètres d’URL). Légende des accès : **É** écriture (selon 01 §3), **L** lecture,
> — pas d’accès.

## 1. Écrans

| Id | Route | Écran | Contenu |
|---|---|---|---|
| `home` | `/` | Accueil | mes CAPEX, mes validations, alertes, prochains jalons |
| `approvals` | `/my/approvals` | Mes validations | corbeille unifiée (05 §6) |
| `capex-list` | `/capex` | Registre des CAPEX | liste filtrable (filiale, zone, phase, typologie, statut) ; « Nouveau CAPEX » |
| `portfolio` | `/portfolio` | Portefeuille | tableau de bord groupe / zone / filiale (06 §5) |
| `copil` | `/copil` | COPIL GPI | séances, dossiers soumis au G1, délai des 2 jours |
| `rex` | `/rex` | Bibliothèque REX | REX capitalisés |
| `capex-overview` | `/capex/[code]` | Synthèse du CAPEX | fiche, phase, prochain jalon, KPI |
| `capex-gates` | `/capex/[code]/gates` | Jalons & circuits | G1, K3, G2, G3 : critères, circuit, historique, conditions |
| `capex-dossiers` | `/capex/[code]/dossiers/[kind]` | Dossier vivant | sections, complétude, versions, figement, empreinte, vue imprimable |
| `capex-budget` | `/capex/[code]/budget` | Budget & BP | versions, classes, fourchettes, lots, phasage, engagé / réalisé, BP |
| `capex-execution` | `/capex/[code]/execution` | Exécution | S-curve, SPI / CPI / EAC, lots, projets EPC2i liés |
| `capex-changes` | `/capex/[code]/changes` | MoC | registre, décideur calculé, décisions |
| `capex-machines` | `/capex/[code]/machines` | Besoins machines | lignes, catalogue, réponses EPC2i, liens Keystone |
| `capex-pack` | `/capex/[code]/pack` | Pack ingénierie | pièces par famille, % pondéré, part EPC2i |
| `capex-permits` | `/capex/[code]/permits` | Autorisations | ICPE, PC, PLU, ATEX, échéances |
| `capex-safety` | `/capex/[code]/safety` | Sécurité (HS) | jalons HS, actions (miroir Vigie), liens Vigie |
| `capex-risks` | `/capex/[code]/risks` | Risques | registre |
| `capex-governance` | `/capex/[code]/governance` | Gouvernance | équipe et gabarit, typologie, revues, décisions, rapport Copil |
| `capex-rampup` | `/capex/[code]/rampup` | Ramp-up | lignes, saisie journalière, courbe, critère 30 jours |
| `capex-journal` | `/capex/[code]/journal` | Journal | audit et activité du CAPEX |
| `admin-org` | `/admin/organisation` | Filiales, sites, zones | consultation des miroirs des référentiels de Matrix (D21 : tenus dans Matrix, lien vers son écran « Référentiels ») ; saisie du CA de référence (DAF groupe) |
| `admin-users` | `/admin/users` | Utilisateurs & rôles | affectations et portées |
| `admin-model` | `/admin/model` | Modèle DIG-PRODI | délais, experts requis, seuils (ramp-up, alertes), table HS, gabarits de staffing et de pack |
| `admin-delegation` | `/admin/delegation` | Matrice de délégation | règles datées |
| `admin-connectors` | `/admin/connectors` | Connecteurs | état Keystone / Vigie / Codex, synchronisation |

## 2. Accès par profil

| Écran | sponsor | project_lead | controller | co_dig | dir_ig | ceo | group_cfo | group_hse | epc2i_pmo | expert | copil_member | zone_director | admin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Accueil, Mes validations | É | É | É | É | É | É | É | É | É | É | É | L | L |
| Registre, Portefeuille | É | É | L | L | L | L | L | L | L | — | L | L | — |
| COPIL GPI | L | L | — | — | É | L | L | L | — | — | É | — | — |
| Bibliothèque REX | L | L | L | L | L | L | L | L | L | L | L | L | — |
| Pages d’un CAPEX | É | É | É (budget) | L | É (visas) | É (G2) | É (BP) | É (HS) | L | L (consulté) | L | L | — |
| Ramp-up | L | É | L | L | L | L | L | L | L | É (Exploitation) | L | L | — |
| Administration | — | — | — | — | — | — | É (CA) | É (table HS) | — | — | — | — | É |

Hors portée (01 §2), un CAPEX est introuvable. Une page lisible mais pas modifiable s’affiche sans action principale, avec le
bandeau « Lecture seule » du socle.
