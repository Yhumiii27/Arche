# Pilote d'Arche — procédure

> 23 oct. 2026. Plan : [`PLAN.md`](PLAN.md) (pilote, mois 3–4 du CDC : « déploiement sur 1 à 2 projets pilotes pour valider
> les dashboards d'études »). Ce que le lot du pilote ajoute à l'application : [`DELIVERY-PILOTE.md`](DELIVERY-PILOTE.md).
> Guides des utilisateurs : [`guide/`](guide/README.md).

## 1. Objectif et critères de sortie

- Faire vivre **1 à 2 CAPEX réels** dans Arche (N-20), avec les utilisateurs réels, sur au moins un jalon décidé dans Arche.
- Mesurer les **indicateurs des objectifs** (C-10) et les comparer au relevé de l'existant.
- Recueillir les retours et les corriger ; valider les tableaux de bord (livraison 5) sur des données réelles.

Sortie du pilote (proposition, à confirmer par le responsable produit) : au moins un jalon décidé de bout en bout dans Arche
(circuit signé sur une version figée), références de l'existant saisies pour les trois objectifs, retours bloquants traités,
décision « déploiement général » prise en COPIL GPI.

## 2. Prérequis (hors code)

| Prérequis | Qui | Où | État |
|---|---|---|---|
| Hébergement en France (C-13), même hébergeur que Keystone | responsable produit, DSI | [`EXPLOITATION.md`](EXPLOITATION.md) §4 | à faire (AR-015) |
| Serveur PostgreSQL commun : rôle `arche_app`, schéma `arche`, droits de partage | Matrix | [`DEMANDES-MATRIX.md`](DEMANDES-MATRIX.md) | en cours (AR-014) |
| Inscription d'Arche dans le tenant Entra ID, comptes des pilotes | DSI | [`EXPLOITATION.md`](EXPLOITATION.md) §4.3 | à faire |
| Données de référence : filiales, sites, COPIL GPI, premiers comptes (D-1 à D-4) | responsable produit | questionnaire « Décisions Arche » | à fournir (AR-003) |
| Chiffre d'affaires de référence des filiales pilotes | DAF groupe | *Administration › Filiales, sites, zones* | à saisir |
| Relevé de l'existant (C-10) : délai moyen d'un jalon, documents d'un dossier de jalon, part des décisions tracées | directeur industriel groupe | §4 ci-dessous | à fournir |
| Choix des 1 à 2 CAPEX pilotes et de leur phase | responsable produit, Sponsors | — | à décider |
| Vues Keystone (`pub_*`) si un CAPEX pilote a des machines EPC2i | Keystone | [`DEMANDES-KEYSTONE.md`](DEMANDES-KEYSTONE.md) | en cours (AR-029) |

## 3. Mise en place

1. **Instance** : base vide avec `ARCHE_SEED=production` (aucune donnée de démonstration), `ARCHE_AUTH=entra`,
   `ARCHE_ADMIN_EMAILS` (premier administrateur), `ARCHE_KEYSTONE=views` ; `npm run db:migrate`, démarrage, `GET /api/health`.
2. **Administrateur** : zones, filiales et sites des CAPEX pilotes ; comptes et rôles (Sponsor et CDG par filiale, chef de
   projet par CAPEX, experts avec leur spécialité, fonctions groupe). Voir [`guide/administrateur.md`](guide/administrateur.md).
3. **DAF groupe** : chiffre d'affaires de référence des filiales pilotes (typologie).
4. **Reprise de chaque CAPEX pilote** (N-20, [`guide/sponsor.md`](guide/sponsor.md)) :
   1. le chef de projet ou le Sponsor crée le brouillon, nomme le chef de projet, saisit les **lots** ;
   2. le Sponsor fait **Reprendre un CAPEX en cours** : phase, dates et décideurs des jalons franchis, budget validé ;
   3. l'équipe complète : équipe nommée, risques ouverts, dossier vivant de la phase en cours (références Codex),
      besoins machines, pack, autorisations, engagé et réalisé (import CSV) selon la phase.
   Un CAPEX encore en phase 1 s'ouvre normalement (**Ouvrir le CAPEX**), sans reprise.
5. **Directeur industriel groupe** : références de l'existant dans *Objectifs DIG-PRODI* (§4).

## 4. Mesure des objectifs (C-10)

| Objectif du CDC | Indicateur mesuré par Arche | Référence à fournir |
|---|---|---|
| −40 % sur les délais de validation | délai, en jours ouvrés, entre la soumission d'un jalon (ouverture de la session) et sa décision, moyenne par jalon | délai moyen d'un G1, G2, K3, G3 dans le processus actuel (6 étapes) |
| −50 % de documents statiques | nombre de documents (références Codex) joints au dossier figé sur lequel le jalon est décidé, en moyenne | nombre de documents (formulaires Word / Excel et annexes) d'un dossier de jalon actuel |
| 100 % de traçabilité | part des décisions de jalon prises par une étape signée dans Arche et des validations de budget faites par un compte nommé | part actuelle (souvent inconnue : saisir l'estimation) |

- Les jalons **repris** (décidés avant Arche) ne sont pas mesurés ; seuls les jalons décidés dans Arche comptent.
- Page *Objectifs DIG-PRODI* (CEO, directeur industriel groupe, DAF groupe, membres du COPIL GPI) : valeur mesurée, nombre de
  mesures, référence, cible (référence × 0,6 ; × 0,5 ; 100 %), écart et état ; détail des sessions mesurées.
- Point de mesure proposé : à chaque COPIL GPI du pilote, puis en fin de pilote.

## 5. Retours du pilote

- Chaque retour est noté dans [`RETOURS-PILOTE.md`](RETOURS-PILOTE.md) (date, rôle, page, constat, gravité : bloquant /
  gênant / suggestion) par le responsable produit ou directement par la session de développement à partir des messages.
- Un retour bloquant est corrigé dans la semaine ; les autres sont regroupés par lot. Ce qui sort du CDC passe par
  `DECISIONS.md` §5 (accord du responsable produit).
