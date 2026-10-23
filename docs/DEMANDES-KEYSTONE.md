# Demandes d’Arche à Keystone

> 22 oct. 2026. Arche **ne modifie jamais** le dépôt Keystone. Chaque demande ci-dessous est à transmettre au chat Keystone
> par le responsable produit. Elles détaillent les lots déjà inscrits au reste à développer de Keystone (R-185 à R-194).
> Les colonnes sont détaillées dans [`CONTRATS.md`](CONTRATS.md). En attendant chaque vue, Arche la simule.
>
> **Déposées le 22 oct. 2026** dans le `REQUESTS.md` de Keystone (validées par Guillaume, Yhumiii27/Keystone#24), en 4
> entrées OUVERTES : K-01 + K-02 + K-03 + K-10 ; K-05 ; K-04 + K-06 + K-08 ; K-07 + K-09 + K-11 + K-12.

| # | Demande | Lot Keystone | Nécessaire pour (Arche) | Priorité |
|---|---|---|---|---|
| K-01 | Publier **`pub_catalogue_machines`** (fiches publiées, versions, options, capacité nominale, prix indicatif, délai type, statut) — CONTRATS §2.2 | R-186 | L4 besoins machines | haute |
| K-02 | Connecteur **`capex`** dans Keystone : lire `arche.pub_capex` et `arche.pub_besoins_machines` (miroir, simulation, liens profonds vers `<ARCHE_URL>/capex/<code>` et `…/machines`) ; corbeille « Besoins des filiales » ; publier **`pub_reponses_besoins`** (qualification, classe, fourchette, devis / offre Codex, validité, projet créé) | R-187 | L4 | haute |
| K-03 | Classe d’estimation (`E50` / `E30` / `E10`) et fourchette sur les réponses et les offres ; offre ferme = `E10` | R-188 | L4 (critère G2) | haute |
| K-04 | Publier **`pub_jalons_projets`**, **`pub_avancement_projets`** (côté vente seulement, sans coût, taux ni marge — P-05), **`pub_avenants`**, **`pub_reserves`** | R-189 | L5 (S-curve, K3), L6 (G3) | moyenne |
| K-05 | `pub_projets` : ajouter **en fin de vue** `capex_code` et `besoin_ref` ; un client peut être une filiale (client interne) | R-190 | L4 | haute |
| K-06 | `pub_livrables` : ajouter en fin de vue `type`, `accepte_le`, `maj_le` (pour reconnaître les PV d’acceptation au G3) | R-189 | L6 | moyenne |
| K-07 | `pub_parc_machines` : ajouter en fin de vue `type_machine_code`, `livree_le`, `maj_le` | R-193 | L6 (ramp-up par machine) | moyenne |
| K-08 | Publier **`pub_pack_ingenierie`** (part EPC2i du pack, pièces attendues / validées par famille, % pondéré) | R-191 | L5 (critère G2) | moyenne |
| K-09 | Lire **`arche.pub_rampup`** au parc installé (capacité atteinte, TRS et rebuts de réception) | R-193 | après L6 | basse |
| K-10 | À la commande (passage d’un besoin à `ordered`), créer le projet EPC2i — ou ajouter des équipements à un projet existant — et publier son code dans `pub_reponses_besoins.projet_code` | R-185, R-187 | L4 | haute |
| K-11 | Index sur `maj_le` (ou colonne source) des vues lues, pour la lecture incrémentale d’Arche | R-189 | L4 | basse |
| K-12 | Socle partagé `@epc2i/socle` : Arche consommera le paquet à la place de ses copies (liste dans [`SOCLE.md`](SOCLE.md)) | R-194 | après le pilote | basse |
| K-13 | ~~Publier `keystone.pub_rex` au contrat commun du REX~~ — retirée le 23 oct. 2026 : Matrix a déposé la même demande chez Keystone avec le contrat commun à 15 colonnes, qu'Arche suit dans `pub_rex_v2` | — | — | — |

> **K-13 retirée le 23 oct. 2026** : l'entrée proposée à Keystone (Yhumiii27/Keystone#27, non fusionnée) doublait la demande
> de Matrix « Publier les leçons apprises des projets (vue pub_rex, D22) », déjà dans le `REQUESTS.md` de Keystone avec le
> contrat commun à 15 colonnes ; la PR est fermée sans fusion. `arche.pub_rampup` (lue par K-09) est publiée depuis
> la livraison 6.

Questions à transmettre en même temps : AC-2 (P-05), AC-4 (catalogue), AC-5 (multi-équipements) — voir
[`DECISIONS.md`](DECISIONS.md) §3.
