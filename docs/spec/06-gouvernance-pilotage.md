# 06 — Gouvernance, pilotage, tableaux de bord, ramp-up, alertes

> CDC §2 (phases 3 et 4), §3, §4 « Dashboards », « IA » ; analyse D-6, D-9, D-10, D-12 ; C-5, C-10.

## 1. Typologie (C-5)

- **Ratio** = budget central de la dernière version **validée** / CA de référence de la filiale (dernier exercice clos,
  saisi par la DAF groupe). **≥ 20 % → Stratégique**, sinon Light (le CDC laisse « = 20 % » indéfini : rangé en Stratégique).
- **Nouvelle usine** (`investment_type = new_plant`) → Stratégique d’office.
- **Forçage** par le Dir.IG avec motif (audité). Sans CA de référence saisi, la typologie est « à déterminer » et bloque le
  G1.
- **Recalcul** à chaque version de budget validée : un changement de typologie n’est pas automatique ; il apparaît dans
  « Mes validations » du Dir.IG (« typologie à confirmer »). Une fois confirmé, le gabarit de staffing et la cadence de revue
  changent.

## 2. Staffing et revues (CDC §3)

| Typologie | Gabarit de staffing | Cadence Copil projet | Audits |
|---|---|---|---|
| Light | CPF + Co-DIG | trimestrielle | — |
| Stratégique | CP dédié + CDG filiale + PMO EPC2i | mensuelle | audit transversal par phase (N-19) |

- Contrôle **« équipe incomplète »** (tableau de bord, critère des jalons, 03 §3).
- **Revue en retard** : `next_due_on` = dernière revue + période ; alerte au CPF et au Sponsor à `next_due_on`, signalement
  au Dir.IG à +15 jours.
- **Rapport Copil** : page imprimable générée pour une revue — synthèse, jalons, budget et S-curve, risques principaux, MoC,
  décisions à prendre ; la revue tenue enregistre présents, synthèse et décisions (registre).

## 3. Budget, engagé, réalisé, S-curve

- **Lots hors EPC2i** : budget (baseline G2, phasage mensuel), engagé, réalisé et % physique, saisis chaque mois par le CDG
  ou importés (CSV d’un gabarit Arche ; import Sage plus tard, N-14).
- **Lots machines** : lus dans Keystone — montant du contrat et des avenants (côté vente), facturé, % physique, SPI
  (`pub_avancement_projets`, `pub_avenants`).
- **S-curve consolidée** : prévu cumulé (phasage de la baseline G2) ; réalisé cumulé ; valeur acquise = Σ (budget du lot ×
  % physique). Indicateurs SPI, CPI au niveau CAPEX ; EAC = réalisé + (budget − valeur acquise) / CPI.
- **Écart d’incertitude** (CDC §4) : largeur relative de la fourchette de la dernière version validée, comparée à la cible
  du prochain jalon. Exemple : version E30 (60 % de largeur) avant G2 (cible E10, 15 %) → écart 45 points. Après G2 :
  écart EAC / budget G2 comparé à la fourchette E10.

## 4. BP (C-8, N-11)

Flux annuels sur l’horizon (défaut 10 ans) : CAPEX (budget phasé), OPEX, chiffre d’affaires. Calculs purs : **VAN** au taux
d’actualisation groupe (paramètre DAF), **TRI**, **délai de retour**. Saisie dans Arche ou import d’un gabarit Excel Arche ;
le modèle de la DAF, s’il existe, définira le gabarit (N-11).

## 5. Tableaux de bord

| Tableau | Pour | Contenu |
|---|---|---|
| **Fiche CAPEX — synthèse** | équipe, groupe | phase, prochain jalon et son état, critères, budget et classe, écart d’incertitude, S-curve, pack %, HS, MoC, risques, revue suivante |
| **Maturité des études** | CPF, Dir.IG | % pack pondéré par famille, part filiale / part EPC2i, tendance hebdomadaire |
| **Portefeuille groupe** | PDG, Dir.IG, DAF, SSE, COPIL | CAPEX par filiale, zone, phase, typologie ; jalons G et HS à venir et en retard ; budget total et EAC ; MoC ; revues en retard |
| **Portefeuille de zone** | Directeur de Zone | idem, limité à sa zone |
| **Ma filiale** | Sponsor, CDG | CAPEX de la filiale |
| **COPIL GPI** | membres | dossiers soumis au G1, délai restant sur les 2 jours, décisions récentes |
| **Ramp-up** | CPF, Client Interne, Dir.IG | courbe par ligne, TRS, rebuts, jours continus, délai restant sur les 6 mois |

Instantanés hebdomadaires (tâche planifiée) pour les tendances, comme dans Keystone.

## 6. Ramp-up (D-10, N-16)

- Après le **début de la MES** (date saisie par le CPF, après le PSSR), saisie **journalière** par ligne de production :
  production, et soit TRS directement, soit disponibilité / performance / qualité (TRS = D × P × Q) ; taux de rebuts.
  Import CSV possible ; import depuis la supervision de l’usine plus tard.
- **Jour conforme** : production ≥ **100 %** de la capacité nominale journalière **et** rebuts ≤ objectif de rebuts de la
  ligne (seuils paramétrables, N-16).
- **Critère G3** : 30 jours conformes **consécutifs** (jours d’arrêt planifiés déclarés neutres) ; la date de fin de la
  série est publiée dans `pub_rampup`.
- Délai : alerte à M+5 après le début de la MES ; dépassement des 6 mois signalé au Dir.IG.

## 7. Alertes et IA

**Alertes à règles** (toujours actives, sans IA) : jalon en retard sur son délai cible ; étape de circuit échue ; avis
d’expert manquant ; revue en retard ; autorisation à échéance (J−30) ; action HS en retard (miroir Vigie) ; SPI ou CPI < 0,9 ;
EAC > budget G2 + 5 % ; typologie à confirmer ; équipe incomplète ; ramp-up proche de M+6.

**IA** (livraison 7, **désactivée par défaut**, C-13) : s’active seulement avec `ARCHE_AI_PROVIDER` réglé sur un fournisseur
validé comme conforme (région UE/France). Fonctions proposées : projection de la S-curve et de l’EAC (tendance des
instantanés), détection de dérive, résumé d’un dossier vivant avant un jalon. Sans fournisseur, les projections se font par
règles (régression sur les instantanés), sans envoi de données.
