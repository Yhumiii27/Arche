# Arche — socle repris de Keystone

> Décision A-3 : le **socle** de Keystone est copié **une fois** dans Arche ; aucun module métier n’est copié. Le socle sera
> ensuite extrait en paquet partagé `@epc2i/socle` (lot R-194 de Keystone) et ces copies seront remplacées. Ce fichier note,
> pour chaque élément, son chemin dans Keystone, son adaptation et le **commit d’origine** de la copie.
>
> **Commit d’origine de toutes les copies de la livraison 1 : Keystone `63f43ad`** (pointe de `origin/main` le 22 oct. 2026,
> « Merge pull request #15 from Yhumiii27/claude/shared-postgres »). Les fichiers copiés le disent dans leur en-tête
> (« copied from Keystone »).
>
> Écart principal : **Arche tourne sur PostgreSQL uniquement** (décision du 22 oct. 2026) — la voie PGlite de Keystone
> (`open.ts`, transactions SERIALIZABLE, réécriture `"public".` → `"keystone".`) n’est pas reprise ; les tables sont déclarées
> dans le schéma `arche` (disposition de Codex).

| Élément | Chemin dans Keystone | Adaptation dans Arche | État |
|---|---|---|---|
| Configuration validée | `src/server/config/` | variables `ARCHE_*`, `DATABASE_URL` obligatoire, variables métier de Keystone retirées ; `ARCHE_ADMIN_EMAILS` (N-4) | repris (L1) |
| Journaux | `src/server/log/` | — | repris (L1) |
| Santé et démarrage | `src/app/api/health/`, `src/instrumentation.ts`, `src/server/startup.ts`, `src/server/health.ts` | sans antivirus | repris (L1) |
| Horloge métier | `src/domain/clock.ts`, `src/server/clock.ts`, `src/components/app/clock.tsx` | `ARCHE_CLOCK`, date de démo 22 oct. 2026, jours ouvrés ; sans l’axe du prototype | repris (L1) |
| Connexion Entra ID et session | `src/server/auth/` (crypto, oidc, session-cookie, config, routes), `src/proxy.ts`, routes `src/app/api/auth/*`, page `src/app/sign-in` | rôles et portées lus dans Arche (pas dans le jeton) ; compte administrateur créé à la première connexion (`ARCHE_ADMIN_EMAILS`) | repris (L1) |
| Règles de connexion | `src/domain/auth.ts` | `decideSignIn` d’Arche (compte par objet Entra, sinon par e-mail) | repris et adapté (L1) |
| Session et « Voir en tant que » | `src/server/session.ts`, `src/config/personas.ts` (mécanisme) | personnes de démonstration lues en base, une par profil | repris et adapté (L1) |
| Coquille et registre d’écrans | `src/config/screens.ts`, `src/components/app/shell/` | registre de la spec 08, barre latérale et en-tête simplifiés (sans recherche ⌘K ni tiroir tablette) | repris et adapté (L1) |
| Design Nocturne | `src/styles/nocturne.css`, `src/components/ds/`, composants génériques de `src/components/app/` | sans les composants des écrans Keystone ; police Inter locale de Codex | repris (L1) |
| i18n et complétude du français | `src/i18n/` | moteur simplifié (dictionnaires par domaine dans `src/i18n/fr/`, règles, segments) ; contrôle de complétude | repris et adapté (L1) |
| Base de données | `src/server/db/{client,types,transactions,migrations,server-schema,postgres,migrate-command}.ts` | PostgreSQL seul ; verrous `arche.migrations` / `arche.ecritures` ; `npm run db:local` | repris et adapté (L1) |
| Piste d’audit append-only | `writeAudit` (`src/server/db/helpers.ts`), `audit_entries`, déclencheur de `drizzle/0017_audit_append_only.sql` | migration `0001_audit_append_only` d’Arche | repris (L1) |
| Durcissement HTTP | `src/server/http/security-headers.ts`, `proxy-security.ts`, `next.config.ts` | caméra fermée | repris (L1) |
| Conteneur et Coolify | `Dockerfile`, `deploy/` | port 3400, PostgreSQL du kit créé comme le serveur commun | repris et adapté (L1) |
| CI | `.github/workflows/ci.yml` | service PostgreSQL 16, test de fumée HTTP au lieu de Playwright | repris et adapté (L1) |
| Page « reste à développer » | `scripts/remaining-work/` | domaines d’Arche | repris (L1) |
| Moteur « Mes validations » | `src/domain/approvals.ts`, `src/server/approvals/index.ts`, `types.ts` (le moteur seulement) | types d’Arche (spec 05 §6) | à reprendre (L3) |
| Tâches planifiées et worker | `src/server/jobs/`, `scripts/worker.ts` | moteur simplifié : bail par tâche dans `job_runs`, sauvegarde et déclaration Matrix | repris et adapté (L1b) |
| Sauvegardes et restauration | `src/server/backup/`, `scripts/backup.ts`, `scripts/restore.ts` | `pg_dump` / `pg_restore` du seul schéma `arche`, sans recréer le schéma | repris et adapté (L1b) |
| Connecteurs (cadre) | `src/server/integrations/outbox.ts`, `connector-enabled.ts` | connecteurs `keystone`, `codex` | à reprendre (L3, L4) |
| Déclaration à Matrix | `src/server/integrations/matrix/` | application `arche` (Matrix l’acceptera après M-8) | repris (L1b) |

**Jamais copiés** : la voie PGlite, `src/domain/*` métier (EVM, cycle à 13 étapes, ITP…), `src/features/*`, `src/server/dal/*`
métier, `src/server/prototype/`, les fournisseurs de validations Keystone, les connecteurs Codex / Vigie / Cursus / X3, les
migrations de Keystone.
