# Demandes d’Arche à Matrix (socle du serveur PostgreSQL commun)

> 22 oct. 2026. Décision M-01 du dépôt Matrix : base `epc2i`, un schéma par outil, partage par vues `pub_`. Arche **n’écrit
> pas** dans le dépôt Matrix : les scripts ci-dessous sont des **propositions**, à intégrer par le responsable produit (ou le
> chat Matrix) à `infra/postgres/`. Les noms de fichiers suivent ceux que cite Keystone (`docs/EXPLOITATION.md` §4.1) ; ils
> sont à vérifier dans Matrix. Le nom `arche` attend la réponse à N-1.
>
> **État au 22 oct. 2026 : M-1 à M-5 sont faites côté Matrix** (PR Yhumiii27/Matrix#10) : rôle `arche_app`, schéma `arche`,
> droits de base, lecteurs dans `partage/90-droits.sql` (vues absentes signalées sans erreur jusqu’à leur création),
> `arche.pub_journal` dans le journal unifié, Arche dans le catalogue de Matrix (d’après `spec/02-objets.md`). Différences
> avec les propositions ci-dessous : pas de fichier `partage/40-arche.sql` (règle P-02 de Matrix : les vues `pub_` viennent
> des migrations de l’outil) ; Arche lit aussi les référentiels de Matrix (`pub_filiales`, `pub_zones`, `pub_sites`,
> `pub_pays`, décision D21) ; `arche.pub_rex` est accordée à `matrix_app` (décision D22).

## M-1 · Rôle et schéma (`init/01-base-et-roles.sql`, `init/02-schemas.sql`)

```sql
-- 01 : rôle de connexion d'Arche (mot de passe fourni par la DSI, jamais dans le dépôt)
CREATE ROLE arche_app LOGIN PASSWORD :'ARCHE_APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
-- 02 : schéma d'Arche, dont arche_app est propriétaire
CREATE SCHEMA IF NOT EXISTS arche AUTHORIZATION arche_app;
ALTER ROLE arche_app IN DATABASE epc2i SET search_path = arche;
```

## M-2 · Droits de base (`init/03-droits.sql`)

```sql
REVOKE CREATE ON DATABASE epc2i FROM arche_app;
GRANT CONNECT ON DATABASE epc2i TO arche_app;
REVOKE ALL ON SCHEMA public FROM arche_app;
-- aucun droit sur les autres schémas (keystone, codex, vigie, cursus, matrix) hors vues pub_ (M-4)
```

## M-3 · Partage (`partage/40-arche.sql`, exécuté en `arche_app`)

Recrée à l’identique les vues créées par les migrations d’Arche : `arche.pub_capex`, `arche.pub_besoins_machines`,
`arche.pub_rampup`, `arche.pub_journal` (définitions : [`CONTRATS.md`](CONTRATS.md) §3, fichier fourni par Arche à la
livraison 2). Comme `30-keystone.sql`, le rejouer ne change rien.

## M-4 · Droits des lecteurs (`partage/90-droits.sql`)

```sql
-- Arche lit Keystone
GRANT USAGE ON SCHEMA keystone TO arche_app;
GRANT SELECT ON keystone.pub_projets, keystone.pub_livrables, keystone.pub_parc_machines TO arche_app;
-- à ajouter à mesure que Keystone les publie (R-186 à R-191)
GRANT SELECT ON keystone.pub_catalogue_machines, keystone.pub_reponses_besoins, keystone.pub_jalons_projets,
                keystone.pub_avancement_projets, keystone.pub_avenants, keystone.pub_reserves,
                keystone.pub_pack_ingenierie TO arche_app;
-- Keystone et Matrix lisent Arche
GRANT USAGE ON SCHEMA arche TO keystone_app, matrix_app;
GRANT SELECT ON arche.pub_capex, arche.pub_besoins_machines, arche.pub_rampup TO keystone_app;
GRANT SELECT ON arche.pub_capex, arche.pub_besoins_machines, arche.pub_rampup, arche.pub_journal TO matrix_app;
```

Le contrôle `droits.verifier()` doit rester sans erreur (aucun droit d’Arche sur une table d’un autre outil).

## M-5 · Registre des tables et journal unifié

- Arche déclare ses tables à Matrix au démarrage (`MATRIX_URL`), comme Keystone (`src/server/integrations/matrix/`).
- `matrix.journal_unifie` ajoute `arche.pub_journal` (mêmes colonnes que `keystone.pub_journal`, contrat D18).

## M-6 · Plus tard

Droits de lecture d’Arche sur la vue de Vigie des études de sécurité (AC-3), quand Vigie la publie.
