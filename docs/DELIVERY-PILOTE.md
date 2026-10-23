# Lot du pilote — reprise des CAPEX en cours, objectifs DIG-PRODI, guides

> 23 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (pilote). Procédure du pilote :
> [`PILOTE.md`](PILOTE.md). Réponses du questionnaire relues le 23 oct. 2026 : toutes « défaut » (N-20 et C-10 confirmés) ;
> D-1 à D-4 toujours attendues.

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Reprise d'un CAPEX en cours (N-20) | à la place de l'ouverture, le **Sponsor** ouvre un brouillon directement en phase 2, 3 ou 4 : date d'ouverture, **date et décideur** de chaque jalon franchi (G1, G2, K3), **budget validé** (E50 / E30 en phase 2, E10 référence G2 ensuite ; date, validé par, montant par lot), début de la MES en phase 4 ; contrôles d'ordre des dates ; typologie calculée | `takeoverCapexAction`, `src/domain/takeover.ts`, panneau *Reprendre un CAPEX en cours* de la synthèse |
| Traçabilité de la reprise | jalons marqués **« Repris »** (`gates.taken_over` : pas de circuit, pas de signature, affichés « Décidé avant Arche par … ») ; transitions du cycle datées avec le motif « Repris en cours (N-20) » ; `capex.taken_over_at` / `taken_over_by_name` ; une entrée de journal qui reprend tout ce qui a été saisi | migration `0017_pilot` |
| Objectifs DIG-PRODI (C-10) | écran **Objectifs DIG-PRODI** (`/kpi`, CEO, directeur industriel groupe, DAF groupe, membres du COPIL GPI) : délai soumission → décision par jalon (jours ouvrés), documents statiques par dossier de jalon (références Codex de la version figée décidée), part des décisions tracées (étape décisionnelle signée, budget validé par un compte nommé) ; mesurés sur les CAPEX visibles, jalons repris exclus | `src/domain/kpi.ts`, `src/server/dal/kpi.ts`, `src/app/(app)/kpi/` |
| Référence de l'existant | saisie par le **directeur industriel groupe** (valeur, date du relevé, source) ; cible = référence × 0,6 (délais), × 0,5 (documents), 100 % (traçabilité) ; écart et état ; journalisée | `saveBaselineAction`, table `kpi_baselines` |
| Jeu de démo | les jalons de démonstration ont une date de soumission (6 à 16 jours avant la décision) : la page des objectifs montre des mesures | `src/server/db/seed/demo.ts` |
| Guides et procédure | guides par rôle, procédure du pilote (prérequis, mise en place, mesure, retours), journal des retours | [`guide/`](guide/README.md), [`PILOTE.md`](PILOTE.md), [`RETOURS-PILOTE.md`](RETOURS-PILOTE.md) |

Tests : `src/features/capex/takeover.test.ts` (règles et reprise en phase 3 de bout en bout), `src/features/pilot/actions.test.ts`
(règles des indicateurs, mesure sur le jeu de démo, droits de la référence) ; tests de fumée de `/kpi` et du panneau de
reprise.

## 2. Choix faits par défaut (à valider par le responsable produit)

- **Qui reprend** : le **Sponsor**, comme pour l'ouverture (le directeur industriel groupe ne voit pas les brouillons, N-5).
  Les jalons repris portent le nom saisi du décideur ; ils ne sont pas signés dans Arche.
- **« Documents hors dossier » (C-10)** : compté comme les documents **joints** (références Codex) au dossier figé d'un
  jalon, c'est-à-dire ce qui reste des documents statiques à côté du contenu vivant du dossier. Autre lecture possible :
  documents produits hors d'Arche, non mesurables par l'application.
- **Décisions tracées** : décisions de jalon prises par une étape décisionnelle signée et validations de budget faites par
  un compte nommé ; les jalons et budgets repris sont exclus.
- **Saisie de la référence** : directeur industriel groupe seul (propriétaire du processus DIG-PRODI) ; l'écran est visible
  des instances du groupe, en lecture « hors de mon espace » pour les autres profils.

## 3. Reste du pilote (hors code)

Prérequis listés dans [`PILOTE.md`](PILOTE.md) §2 : hébergement (C-13), serveur commun, Entra ID, données D-1 à D-4, relevé de
l'existant, choix des CAPEX pilotes. Les corrections viendront des retours ([`RETOURS-PILOTE.md`](RETOURS-PILOTE.md)).
