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
