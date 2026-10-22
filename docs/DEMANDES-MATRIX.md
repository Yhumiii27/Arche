# Demandes d’Arche à Matrix (socle du serveur PostgreSQL commun)

> 22 oct. 2026. Décision M-01 du dépôt Matrix : base `epc2i`, un schéma par outil, partage par vues `pub_`. Arche **n’écrit
> pas** dans le dépôt Matrix : ces demandes sont à transmettre au chat Matrix par le responsable produit (règle M-05 : une
> branche et une PR par outil). Relevé du dépôt `Yhumiii27/Matrix` au commit `403ff37`.
>
> **Arche tourne sur PostgreSQL uniquement** (décision du responsable produit du 22 oct. 2026), schéma `arche`, rôle
> `arche_app` (N-1) — sur le serveur commun comme sur un poste de développement (`npm run db:local` y crée la même
> disposition). Ses tables sont déclarées dans le schéma (`arche.table(…)`, disposition de Codex) : ses migrations nomment
> `"arche".` elles-mêmes, sans `CREATE SCHEMA` ni réécriture de `"public".`. Verrous : `hashtext('arche.migrations')`
> (session, migration) et `hashtext('arche.ecritures')` (transaction, écritures). Journal : `arche.__drizzle_migrations`.

Aujourd’hui chaque outil est écrit en dur dans les scripts de Matrix ; ajouter Arche touche les fichiers suivants.

## M-1 · Rôle `arche_app` (`init/01-base-et-roles.sql`)

- `\getenv mdp_arche_app ARCHE_APP_PASSWORD` et les mêmes contrôles que pour les autres mots de passe (vide : arrêt ; moins
  de 16 caractères : avertissement) ; génération : `openssl rand -base64 30 | tr -d '/+=' | cut -c1-32`.
- `arche_app` dans la liste des rôles créés, puis `ALTER ROLE arche_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS INHERIT PASSWORD …` (SCRAM).
- `GRANT arche_app TO matrix_admin WITH INHERIT FALSE, SET TRUE;`, `GRANT CONNECT ON DATABASE epc2i TO arche_app;`
- `COMMENT ON ROLE arche_app IS 'Connexion d''Arche (CAPEX des filiales) : propriétaire du schéma arche ; ailleurs, seulement SELECT sur les vues pub_ accordées.';`
- `COMMENT ON DATABASE epc2i` : ajouter `arche` à la liste des schémas.

## M-2 · Schéma `arche` (`init/02-schemas.sql`)

```sql
CREATE SCHEMA IF NOT EXISTS arche AUTHORIZATION arche_app;
ALTER SCHEMA arche OWNER TO arche_app;
REVOKE ALL ON SCHEMA arche FROM PUBLIC;
COMMENT ON SCHEMA arche IS 'Arche (CAPEX des filiales, DIG-PRODI) : tables, vues pub_ et journal des migrations (__drizzle_migrations). Propriétaire arche_app.';
ALTER ROLE arche_app IN DATABASE epc2i SET search_path TO arche;
ALTER ROLE arche_app IN DATABASE epc2i SET idle_in_transaction_session_timeout TO '5min';
```

## M-3 · Droits de base (`init/03-droits.sql`)

Ajouter `arche` / `arche_app` partout où les quatre outils sont énumérés : `GRANT USAGE ON SCHEMA arche TO matrix_lecture,
matrix_admin` ; `ALTER DEFAULT PRIVILEGES FOR ROLE arche_app IN SCHEMA arche …` (SELECT à `matrix_lecture`, tout à
`matrix_admin`, `REVOKE EXECUTE ON ROUTINES FROM PUBLIC`) ; les contraintes `colonnes_sensibles_schema_ck`,
`partage_lecteurs_vue_check` (`^(keystone|codex|cursus|vigie|matrix|arche)\.pub_…`) et `partage_lecteurs_lecteur_check` ;
les listes `nspname IN (…)` et `VALUES ('keystone_app','keystone') …` de `droits_ddl`, `appliquer_droits()` et
`droits.verifier()`.

Colonnes sensibles d’Arche (à ne pas montrer à `matrix_lecture`) : `arche.users.email`, `arche.users.entra_object_id`,
`arche.signatures.ip_hash` (livraison 3).

## M-4 · Partage (`partage/70-arche.sql`, nouveau, exécuté en `arche_app`)

Copie qualifiée des vues créées par les migrations d’Arche : `arche.pub_journal` (existe : `drizzle/0002_share_journal.sql`),
puis `arche.pub_capex`, `arche.pub_besoins_machines`, `arche.pub_rampup` (définitions : [`CONTRATS.md`](CONTRATS.md) §3 ; le fichier sera fourni avec la
livraison qui crée chaque vue). Le rejouer ne change rien. Numéro 70 : premier emplacement libre après `60-vigie-ecr-eco.sql`.

## M-5 · Droits des lecteurs (`partage/90-droits.sql`)

Ajouter `arche_app` au tableau de contrôle des rôles, puis à la liste (vue, lecteurs) :

| Vue | Lecteurs à ajouter |
|---|---|
| `keystone.pub_projets`, `keystone.pub_livrables`, `keystone.pub_parc_machines` | `arche_app` |
| `keystone.pub_catalogue_machines`, `pub_reponses_besoins`, `pub_jalons_projets`, `pub_avancement_projets`, `pub_avenants`, `pub_reserves`, `pub_pack_ingenierie` (à mesure que Keystone les publie) | `arche_app` |
| `codex.pub_documents`, `codex.pub_revisions_document`, `codex.pub_validations`, `codex.pub_types_document` | `arche_app` |
| `matrix.pub_pays`, `matrix.pub_sites`, `matrix.pub_organigramme` | `arche_app` |
| `arche.pub_capex`, `arche.pub_besoins_machines`, `arche.pub_rampup` (nouvelles) | `keystone_app`, `matrix_app` (et `codex_app` pour `pub_capex` si CX-01 retient un CAPEX comme contexte Codex) |
| `arche.pub_journal` (nouvelle) | `matrix_app` |

`droits.verifier()` doit rester sans ligne de gravité `erreur`.

## M-6 · Journal unifié (`partage/95-matrix-journal-unifie.sql`)

Ajouter `'arche'` au tableau `FOREACH v_outil IN ARRAY ARRAY['keystone','codex','cursus','vigie']`. `arche.pub_journal`
respecte le contrat exact (ordre et types) : `ref_source text, nature text, quand timestamptz, qui text, qui_ref text,
qui_role text, action text, objet text, detail text, projet text, qui_matricule text`.

## M-7 · Sauvegardes et vérifications

- `sauvegarde/sauvegarder.sh` : ajouter `arche` à la boucle des schémas.
- `verifier-droits.sql` : cas d’essai d’`arche_app` (aucun droit sur les tables d’un autre outil, lecture des seules vues
  accordées).

## M-8 · Déclaration des tables (application Matrix)

`serveur.mjs` : ajouter `'arche'` à `APPS` (aujourd’hui `['keystone','codex','cursus','vigie']` : une déclaration
`app: 'arche'` est refusée « outil inconnu »). Arche déclarera ses tables (`POST {MATRIX_URL}/api/declarations`, format
`matrix.schema/1`, comme Keystone) avec la livraison qui ajoute le connecteur Matrix.

## M-9 · Filiales dans le référentiel d’organisation (à décider, N-22)

`matrix.organigramme` ne connaît que les niveaux `departement | service | equipe` d’une seule société, et `matrix.sites`
(D14) ne porte pas de filiale. Arche a besoin des **filiales** (code à 3 lettres, pays, zone, devise) et de leurs **sites**.
Proposition : Matrix ajoute un niveau « société » (ou une table `matrix.societes`) et rattache chaque site à sa société ;
Arche lit alors `matrix.pub_sites` / `pub_organigramme` au lieu de tenir ses propres tables `zones`, `subsidiaries`, `sites`
(gardées en attendant, alimentées par l’administrateur d’Arche).
