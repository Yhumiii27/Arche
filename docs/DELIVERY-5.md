# Livraison 5 — Tableaux de bord et gouvernance

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L5). Réponses du questionnaire relues le
> 22 oct. 2026 : toutes « défaut » (C-3, C-9, N-13, N-14, N-19 confirmés). La livraison arrive en deux lots, chacun fusionné
> dans `main` une fois la CI verte.

## Lot 5a — Sécurité, autorisations, pack ingénierie, exécution

### 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Jalons HS (C-3, N-13) | table HS (HS 2 → G1, HS 3 → G2, HS 4 → K3, PSSR avant la MES, HS 6 → G3) ; statut **déclaré par le SSE groupe** (droit `safety`) avec la référence de sa preuve (Vigie ou Codex), date de franchissement, motif d'un jalon sans objet ; un jalon venu de Vigie (`source = vigie`) ne se déclare pas | `src/domain/safety.ts`, `src/features/safety/`, écran `/capex/[code]/safety`, table `hs_statuses` |
| Quitus PSSR | c'est l'étape « Quitus PSSR » du circuit du G3 (livraison 3) : le critère G3 « PSSR franchi et quitus délivré » combine le jalon et cette étape (`withPssrDischarge`) | `src/domain/circuits.ts` (`pssr_discharge`) |
| Autorisations | registre ICPE, permis de construire, PLU, ATEX, autres : dépôt, décision attendue, obtention, autorité, référence Codex du dossier ; décisions attendues sous 30 jours signalées | `src/domain/permits.ts`, `src/features/delivery/`, écran `/capex/[code]/permits`, table `authorizations` |
| Pack ingénierie (C-9) | part filiale : liste type par famille (**amorce : 5 familles à poids égal, 10 pièces**, en attendant la liste du responsable produit), une pièce validée porte sa référence Codex ; part EPC2i lue dans Keystone (`pub_pack_ingenierie`, simulée sur le jeu de démo pour les projets EPC2i) ; % pondéré = Σ poids validés / Σ poids attendus (hors « sans objet ») | `src/domain/pack.ts`, écran `/capex/[code]/pack`, table `pack_items` |
| Engagé, réalisé, % physique (N-14) | par lot hors EPC2i et par mois, **valeurs cumulées à fin de mois**, saisies par le CDG ou le chef de projet (droit `budget`) ou importées du **gabarit CSV d'Arche** (`lot;month;committed_keur;spent_keur;physical_pct`, toutes les lignes contrôlées, une erreur refuse le fichier) ; lots EPC2i lus dans Keystone (engagé = contrat + avenants signés, réalisé = facturé, % physique pondéré par contrat), rattachés par les besoins machines du lot | `src/domain/execution.ts`, `src/features/delivery/`, table `lot_actuals` |
| Courbe en S, SPI, CPI, EAC | budget de chaque lot (baseline G2, sinon dernière version validée, indicatif) étalé uniformément sur la **période prévue du lot** (mois de début et de fin) ; valeur acquise = Σ budget × % physique ; SPI, CPI, EAC = réalisé + (budget − acquis) / CPI ; graphique repris de la courbe EVM de Keystone (vue en tableau, légende, info-bulle par mois) | `src/components/charts/s-curve.tsx`, écran `/capex/[code]/execution` |
| Écart d'incertitude (CDC §4) | avant le G2 : largeur de la fourchette de la dernière version validée contre celle de la classe du prochain jalon (E30 avant G2 → 45 points) ; après : EAC contre le budget G2, comparé à la fourchette E10 | `uncertaintyGap` |
| Critères des jalons | évalués désormais : `g1_hs2`, `g2_hs3`, `g2_permits`, `g2_pack` (> seuil du modèle, 80 %), `k3_hs4`, `k3_works` (lots de travaux hors EPC2i pondérés par budget ≥ 95 %), `g3_pssr`, `g3_hs6` ; « Prochaine étape » renvoie vers l'écran qui permet de les remplir | `deliveryFacts` (`src/server/dal/execution.ts`), `src/features/capex/next-step.ts` |
| Jeu de démo | jalons HS, autorisations (dont une décision attendue sous 30 jours), pack (APM 60 %, SAI complet), périodes des lots, engagé / réalisé de SAI de juillet à octobre 2026 | `src/server/db/seed/demo.ts` |

Migration `0011_delivery_safety` (tables `authorizations`, `pack_items`, `hs_statuses`, `lot_actuals` ; colonnes
`planned_start`, `planned_end` de `capex_lots`).

### 2. Écarts avec la spécification

- **Phasage** : la spec 02 prévoit un phasage mensuel libre dans `budget_lines.phasing`. Le lot 5a étale le budget de chaque
  lot sur sa période prévue (début, fin), modifiable à tout moment et audité ; une version validée reste figée. Un phasage
  mois par mois pourra s'ajouter si le pilote le demande.
- **Part EPC2i du pack avant le G2** : Keystone publie le pack par projet ; tant qu'aucun projet EPC2i n'existe (avant la
  commande), seule la part filiale compte. Sur le jeu de démo, la simulation publie le pack des projets commandés.
- **Actions HS** : elles restent dans Vigie ; l'écran le dit et les affichera quand Vigie les publiera (`DEMANDES-VIGIE.md`).

### 3. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur. `npm test` : 210 tests sur PostgreSQL 16, dont les règles pures du lot
  (`src/domain/l5.test.ts`) et le parcours des quatre jalons qui remplit désormais HS, autorisations, pack et travaux
  (`src/features/gates/actions.test.ts`).
- Build de production, `npm run test:smoke` : contrôles des quatre écrans (courbe en S, jalons HS, autorisation à échéance,
  pack pondéré).
- Navigateur (build de production) : écrans Exécution, Jalons HS, Autorisations, Pack sur le jeu de démo.

## Lot 5b — Revues, Copil, COPIL GPI, portefeuilles, alertes, instantanés

### 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Revues projet (CDC §3) | cadence par typologie (Light : trimestrielle, Stratégique : mensuelle) ; prochaine revue = dernière revue tenue (sinon l'ouverture) + période ; **en retard** à l'échéance, **signalée au Dir.IG** 15 jours après ; une revue tenue enregistre présents, synthèse et décisions (au registre des décisions, `decisions.review_id`) ; saisie par le chef de projet ou le Sponsor | `src/domain/governance.ts`, `src/features/governance/`, écran Gouvernance, table `reviews` |
| Audits transversaux (N-19) | CAPEX Stratégiques : un audit par phase, tenu par le Dir.IG ou le PMO EPC2i (droit `audit`), consigné comme revue de type « audit » ; une phase quittée sans audit est signalée | `missingAudits` |
| Rapport Copil | page imprimable : synthèse (prochain jalon, budget, valeur acquise, SPI / CPI / EAC, pack, HS, dernière revue), jalons, courbe en S des six derniers mois, risques principaux, MoC, décisions à prendre (MoC soumises, alertes) ; imprimée ou enregistrée en PDF puis déposée dans Codex | `/print/capex/[code]/report` |
| Alertes à règles (spec 06 §7) | toujours actives, sans IA : décision de jalon au-delà de son délai cible, étape de circuit échue / avis d'expert manquant, revue en retard (signalée au Dir.IG), audit de phase manquant, décision d'autorisation sous 30 jours, SPI ou CPI < 0,9, EAC > budget G2 + 5 %, typologie à confirmer, équipe incomplète, réserve de jalon échue | `src/domain/alerts.ts` |
| Synthèse du CAPEX | second rang d'indicateurs (valeur acquise, SPI / CPI et EAC, écart d'incertitude, pack, HS, MoC et risques majeurs, prochaine revue) et les alertes du CAPEX | `/capex/[code]`, `capexDashboard` (`src/server/dal/governance.ts`) |
| Portefeuille (spec 06 §5) | groupe pour les fonctions centrales, zone du Directeur de Zone, filiale du Sponsor ou du CDG (filtre de visibilité), sur la zone choisie : CAPEX en cours, budget, EAC après G2, jalons en cours et en retard, MoC en attente, revues en retard, alertes ; tableau par CAPEX ; **maturité des études** (pack pondéré, parts filiale et EPC2i, tendance sur 12 semaines, écart d'incertitude) ; répartition par filiale et par phase | `/portfolio` |
| COPIL GPI (N-6, N-7) | ordre du jour : les G1 dont le circuit tourne, étapes, échéance de la décision et jours ouvrés restants sur les 2 ; décisions G1 des 90 derniers jours | `/copil`, `copilAgenda` |
| Accueil | mes validations, alertes et prochains jalons des CAPEX que je suis (tout mon périmètre pour les fonctions centrales et les Directeurs de Zone) | `/` |
| Instantanés hebdomadaires | tâche `weekly-snapshot` (quotidienne, une ligne par CAPEX actif et par semaine) : phase, pack, valeur acquise, coût réel, EAC, SPI, CPI, alertes ; tendances du portefeuille | `takeSnapshots`, table `capex_snapshots`, `src/server/jobs/registry.ts` |
| Jeu de démo | revues d'APM (la dernière date de juin : revue en retard signalée) et de SAI (audit de la phase 1, celui de la phase 2 manque), 12 semaines d'instantanés | `src/server/db/seed/demo.ts` |

Migration `0012_governance` (tables `reviews`, `capex_snapshots` ; colonne `review_id` de `decisions`, en fin de table).

### 2. Écarts avec la spécification

- **Séances du COPIL GPI** : la spec 02 prévoit une table `copil_sessions`. L'ordre du jour est ici calculé à partir des G1 en
  cours (la décision reste celle du circuit, N-6) ; une table de séances s'ajoutera si le comité veut planifier ses dates.
- **`review_series`** : la cadence se calcule de la typologie et de la dernière revue (rien à stocker).
- **Alerte ramp-up M+6** : avec la livraison 6.
- **Notifications** : les alertes s'affichent dans Arche (accueil, synthèse, portefeuille) ; l'envoi par courriel n'est pas
  prévu en L5.

### 3. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur. `npm test` : 219 tests sur PostgreSQL 16, dont les règles de revue,
  d'audit et d'alerte (`src/domain/l5.test.ts`) et le parcours du lot (`src/features/governance/actions.test.ts` : droits des
  saisies, import CSV refusé sur une ligne EPC2i, revue et décisions, audit sur un CAPEX Stratégique seulement, portefeuille du
  Directeur de Zone limité à sa zone, instantanés idempotents).
- Build de production, `npm run test:smoke` : portefeuille, COPIL GPI, rapport Copil, alertes de l'accueil.
- Navigateur (build de production) : portefeuille, synthèse avec alertes, gouvernance et revues, rapport Copil, COPIL GPI.

**Terminé quand** (PLAN.md) : tableaux de bord validés par le responsable produit sur le jeu de démo — à valider.
