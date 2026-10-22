# Livraison 4 — Besoins machines et connecteur Keystone

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L4). Réponses du questionnaire relues : pas
> de nouvelle réponse depuis la livraison 3. Nouvelles questions **N-36 à N-38**, avec leur réponse par défaut appliquée, ajoutées
> au questionnaire. Keystone n’est pas modifié : ses vues manquantes restent demandées (R-186 à R-191, K-05 à K-07).

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Besoins machines | lignes `CPX-…/B01` : fiche du catalogue EPC2i (code **et version** gardés, options de la fiche) ou besoin libre ; quantité, capacité visée, date de besoin, lot machines, commentaire ; brouillon → soumis → retiré (motif) ou **commandé** ; saisie et soumission en phases 1 et 2 par le chef de projet (N-36) ; audit de chaque écriture | `src/domain/needs.ts`, `src/features/needs/`, `/capex/[code]/machines` |
| Vue `pub_besoins_machines` | contrat v1 de `CONTRATS.md` §3 (17 colonnes, brouillons non publiés), lecteurs `keystone_app`, `matrix_app` | `drizzle/0009_share_needs.sql` |
| Connecteur Keystone | miroir en lecture seule (`keystone_mirror`, une ligne par vue et clé, la ligne telle que Keystone la publie) et état par vue (`keystone_sync`) ; modes `off` / `simulation` / `views` (`ARCHE_KEYSTONE`) ; en `views`, chaque vue `keystone.pub_*` partagée est lue, celles qui manquent sont simulées sur le jeu de démo (mode mixte) et restent vides ailleurs ; un point de sauvegarde par vue (une vue en erreur garde ses lignes précédentes) ; tâche `keystone-sync` du worker (15 min, N-38) ; liens profonds vers `NEXT_PUBLIC_KEYSTONE_URL/projects/<code>` ; aucune écriture dans Keystone | `src/server/integrations/keystone/` |
| Simulation | catalogue de 5 fiches (une retirée), réponses datées depuis la soumission (N-37), offre acceptée et projet EPC2i à la commande, jalons BL1 / prévu / réel, avancement (sans coût interne ni marge, AC-2), avenants, réserves, PV de réception ; déterministe (fonction pure de `pub_besoins_machines` et de l’instant) | `src/server/integrations/keystone/simulation.ts` |
| Réponses EPC2i | la dernière réponse fait foi : qualification, indicatif E50, devis E30, offre ferme E10 (validité), référence Codex du devis ou de l’offre | page Besoins machines |
| Critères des jalons | G2 « offres fermes EPC2i pour chaque besoin soumis » (offre E10 valide) ; K3 « SAT EPC2i planifiés » ; G3 « réserves levées » (aucune réserve A/B ouverte, PV acceptés) — évalués dans le miroir, satisfaits quand il n’y a rien à couvrir | `src/server/cycle/evaluation.ts` |
| Passage à « commandé » | au Go du G2, chaque besoin soumis couvert par une offre ferme valide passe à « commandé » (date du G2) ; les autres restent soumis | `src/server/cycle/gate-decision.ts` |
| Suivi des projets EPC2i | par projet : avancement physique, SPI, contrat et avenants signés, facturé, fin prévue ; jalons (référence, prévu en retard surligné, réel) ; avenants ; réserves et livrables | `/capex/[code]/machines` |
| Administration › Connecteurs | état de chaque vue (source, lignes, date, motif), « Synchroniser maintenant », état du connecteur Codex | `/admin/connectors` |
| Données de démo | APM : un devis E30, une offre ferme E10, un brouillon ; SAI : deux besoins commandés au G2 du 8 juil. 2026 et leurs projets EPC2i | `src/server/db/seed/demo.ts` |

## 2. Kit Coolify testé de bout en bout

Nouveau job de CI « Coolify kit » : `deploy/compose.yaml` (sans la clé propre à Coolify) est lancé tel quel — construction de
l’image, PostgreSQL 16 créé comme le serveur commun, migration et jeu de démo, serveur en bonne santé, **test de fumée dans le
conteneur**, seconde migration sans effet, première sauvegarde du worker et synchronisation Keystone. Il remplace le job qui ne
faisait que construire l’image. Guide pas à pas : [`EXPLOITATION.md`](EXPLOITATION.md) §4.

## 3. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur.
- `npm test` : 194 tests sur PostgreSQL 16, dont `src/features/needs/actions.test.ts` : contrat de `pub_besoins_machines` ;
  saisie refusée (fiche retirée, quantité, droit, CAPEX d’une autre filiale) ; **un besoin soumis apparaît dans la vue, la
  réponse simulée revient à la synchronisation** ; critère G2 « 1 / 3 » ; retrait avec motif ; **le Go G2 commande le besoin
  couvert** et ouvre son projet EPC2i ; K3 « 2 / 2 » ; mode `views` qui lit une vue partagée et simule les autres.
- `npm run test:smoke` : 33 contrôles HTTP passent ; écrans vérifiés dans le navigateur (besoins APM, projets SAI, connecteurs).

## 4. Écarts et limites

- Le miroir est **une table générique** (vue, clé, ligne JSON) au lieu d’une table par vue : une colonne ajoutée par Keystone en
  fin de vue est reçue sans migration d’Arche.
- Copie complète à chaque synchronisation (pas de lecture incrémentale par `maj_le`) : les vues sont petites.
- Tant que `pub_projets` n’a pas `capex_code` (K-05), un projet est rattaché au CAPEX par le `projet_code` d’une réponse.
- Le volet « réserves Arche » du critère G3 vient avec les réserves d’Arche (L5) ; le pack d’ingénierie (`pub_pack_ingenierie`)
  et le parc (`pub_parc_machines`) avec la livraison 5.
- La création du projet dans Keystone et la réponse réelle d’EPC2i passent par Keystone (K-01 à K-05) : Arche ne fait que lire.
