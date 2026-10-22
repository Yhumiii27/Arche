# Arche — socle repris de Keystone

> Décision A-3 : le **socle** de Keystone est copié **une fois** dans Arche à la livraison 1 ; aucun module métier n’est
> copié. Le socle sera ensuite extrait en paquet partagé `@epc2i/socle` (lot R-194 de Keystone) et ces copies seront
> remplacées. Ce fichier note, pour chaque élément, son chemin dans Keystone et le **commit d’origine** de la copie.
>
> État au 22 oct. 2026 (livraison 0) : **rien n’est encore copié**. Commit de référence prévu : la pointe de `origin/main` de
> Keystone au moment de la reprise (aujourd’hui `63f43ad`) ; la colonne « Commit » sera remplie à la livraison 1.

| Élément | Chemin dans Keystone | Adaptation prévue dans Arche | Commit |
|---|---|---|---|
| Configuration validée | `src/server/config/`, `.env.example` | préfixe `ARCHE_` ; variables Keystone métier retirées | — |
| Journaux | `src/server/log/` | — | — |
| Santé et démarrage | `src/app/api/health/`, `src/instrumentation.ts`, `src/server/startup*` | — | — |
| Horloge métier | `src/domain/clock.ts`, `src/server/clock.ts`, `src/components/app/clock.tsx` | `ARCHE_CLOCK` | — |
| Connexion Entra ID et session | `src/server/auth/`, `src/server/session.ts`, `src/proxy.ts` | rôles et portées d’Arche (spec 01) | — |
| Profils et « Voir en tant que » | `src/config/personas.ts` (mécanisme seulement) | 13 profils d’Arche | — |
| Coquille et registre d’écrans | `src/config/screens.ts`, `src/config/role-screens.ts`, `src/config/screen-icons.ts`, `src/app/(app)/layout.tsx` (mécanisme) | registre de la spec 08 | — |
| Design Nocturne | `src/styles/nocturne.css`, `src/components/ds/`, `src/components/app/` (composants génériques) | sans les composants propres aux écrans Keystone | — |
| i18n et complétude du français | `src/i18n/` (moteur, `data-text.ts`, `completeness.test.ts`, `same-in-french.json`) | dictionnaires vidés, repartent des chaînes d’Arche | — |
| Base de données | `src/server/db/client.ts`, `types.ts`, `transactions.ts`, `migrations.ts`, `server-schema.ts`, `helpers.ts` | schéma `arche`, verrou `hashtext('arche.ecritures')` et `hashtext('arche.migrations')` | — |
| Piste d’audit append-only | `writeAudit` (`src/server/db/helpers.ts`), table `audit_entries` (`src/server/db/schema/platform.ts`), déclencheur `drizzle/0017_audit_append_only.sql` | migration initiale d’Arche (pas de copie de migration) | — |
| Moteur « Mes validations » | `src/domain/approvals.ts`, `src/server/approvals/index.ts`, `types.ts` (le moteur, pas les fournisseurs) | types d’Arche (spec 05 §6) | — |
| Tâches planifiées et worker | `src/server/jobs/`, `scripts/worker.ts` | tâches d’Arche (relances, revues, sync Keystone, instantanés) | — |
| Connecteurs (cadre) | `src/server/integrations/outbox.ts`, `connector-enabled.ts`, `connectors-file.ts` | connecteur `keystone` (spec 07) | — |
| Déclaration à Matrix | `src/server/integrations/matrix/` | schéma `arche` | — |
| Durcissement HTTP | `src/server/http/`, `next.config.ts` (en-têtes) | — | — |
| Conteneur et Coolify | `Dockerfile`, `deploy/` | port 3400 (Mac) ; volumes `arche-*` | — |
| Sauvegardes et restauration | `src/server/backup/`, `scripts/backup.ts`, `scripts/restore.ts` | — | — |
| Migrations et contrôle de base | `scripts/db-migrate.ts`, `scripts/db-check.ts` | — | — |
| CI | `.github/workflows/ci.yml`, `audit.yml` | — | — |
| Tests de bout en bout | `tests/e2e/` (outillage : `run.ts`, port libre) | port 3410 sur le Mac | — |
| Page « reste à développer » | `scripts/remaining-work/` | identifiants `AR-xxx`, page d’Arche | — |

**Jamais copiés** : `src/domain/*` métier (EVM, cycle à 13 étapes, ITP…), `src/features/*`, `src/server/dal/*` métier,
`src/server/prototype/`, les fournisseurs de validations Keystone, les connecteurs Codex / Vigie / Cursus / X3, les migrations
de Keystone.
