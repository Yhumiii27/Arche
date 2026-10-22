# 07 — Besoins machines et connecteur Keystone

> Note du responsable produit du 21 oct. 2026 (CDC) ; architecture §2 ; analyse §2. Arche possède la **demande** ;
> Keystone possède le **catalogue** et la **réponse**.

## 1. Parcours

1. Dans un CAPEX (Phase 1 ou 2), le CPF ajoute une **ligne de besoin** : une machine **du catalogue EPC2i** (lu dans
   Keystone, `pub_catalogue_machines`) avec quantité, options, capacité visée, date de besoin — ou un **besoin libre**
   (texte) si rien ne convient.
2. Il la **soumet** : elle apparaît dans `pub_besoins_machines` (statut `submitted`) ; Keystone la lit (corbeille « Besoins
   des filiales », R-187).
3. EPC2i répond dans Keystone : qualification (faisable / à étudier / refusé), puis réponse chiffrée indicative (E50),
   devis budgétaire (E30), offre ferme (E10), avec référence Codex. Arche lit `pub_reponses_besoins` et affiche la dernière
   réponse sur la ligne, avec un lien profond vers Keystone.
4. Le CPF peut **retirer** une ligne (statut `withdrawn`) tant qu’elle n’est pas commandée.
5. Au **G2 Go**, chaque ligne soumise ayant une offre ferme valide passe à **« commandé »** (`ordered`, date) ; Keystone crée
   le projet EPC2i (ou l’ajoute à un projet multi-équipements, R-185) et publie son code dans `pub_reponses_besoins`.
6. Ensuite Arche suit le projet EPC2i par `pub_projets`, `pub_jalons_projets`, `pub_avancement_projets`, `pub_avenants`,
   `pub_reserves`, `pub_livrables`, `pub_pack_ingenierie`, `pub_parc_machines` (lot « machines » du CAPEX).

Une ligne de besoin est liée à un lot `machines` du CAPEX ; son montant budgétaire provient de la dernière réponse
(fourchette selon la classe) tant que le CPF ne l’a pas remplacé.

## 2. Connecteur `keystone` (sur le modèle des connecteurs de Keystone)

`src/server/integrations/keystone/` :

| Élément | Rôle |
|---|---|
| `config.ts` | mode `simulation` (défaut) ou `views` ; interrupteur `ARCHE_KEYSTONE=off|simulation|views` |
| `simulation.ts` | données de démonstration **cohérentes** avec le jeu Arche : catalogue (types EMP, MEMU, SPUR… avec variantes et options), réponses aux besoins de démonstration, projets EPC2i liés, jalons, avancement, avenants, réserves, livrables, pack, parc |
| `views.ts` | lecture des vues `keystone.pub_*` (rôle `arche_app`, droits accordés par Matrix) ; requêtes par date `maj_le` |
| `mirror.ts` | seul écrivain des tables `keystone_*` (miroir) ; garde `synced_at` |
| `links.ts` | liens profonds vers Keystone (`NEXT_PUBLIC_KEYSTONE_URL` + `/projects/<code>`, réponse au besoin) |
| tâche `keystone-sync` | toutes les 15 min (paramétrable) et bouton « Synchroniser » ; chaque vue manquante reste en simulation (mode mixte) et l’écran l’indique |

Arche n’écrit **rien** chez Keystone : le seul flux Arche → Keystone, ce sont les vues `pub_capex` et `pub_besoins_machines`.

## 3. Données financières visibles (P-05, AC-2)

Par défaut : montant de la réponse et de l’offre, montant du contrat et des avenants côté vente, facturé, % physique, SPI,
dates. **Jamais** de coût interne, taux ni marge d’EPC2i.
