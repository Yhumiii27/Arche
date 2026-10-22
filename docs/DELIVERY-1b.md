# Livraison 1b — exploitation et administration

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L1b). Tout ce lot avance **sans réponse du
> responsable produit** ; les questions ouvertes sont dans le questionnaire « Décisions Arche »
> (https://claude.ai/artifact/B2xm3cfZvTvXfRE6TinNNe, sources `scripts/questionnaire/`).

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Administration en écriture | l’administrateur crée un compte, donne et retire un rôle avec son périmètre (groupe, zone, filiale, CAPEX ; spécialité d’un expert), désactive et réactive un compte, crée zones, filiales et sites ; la DAF groupe saisit le CA de référence d’une filiale par exercice (C-5). Chaque action vérifie le rôle actif et l’entrée côté serveur, écrit dans une transaction et trace la piste d’audit ; un administrateur ne peut ni se désactiver ni retirer son dernier rôle d’administrateur | `src/domain/admin.ts`, `src/features/admin/`, pages `/admin/users`, `/admin/organisation` |
| Connexion Entra de bout en bout | test complet contre un fournisseur OpenID simulé : connexion par e-mail puis par objet Microsoft, refus (e-mail inconnu, sans rôle, désactivé, autre compte Microsoft, état falsifié), premier administrateur (`ARCHE_ADMIN_EMAILS`), changement de rôle actif, déconnexion | `src/server/auth/entra-flow.test.ts` |
| Déclaration à Matrix | après chaque migration, au démarrage d’un serveur et chaque jour (worker) : tables, colonnes, clés et liens du schéma `arche` envoyés à Matrix (`matrix.schema/1`), jamais bloquant | `src/server/integrations/matrix/` |
| Vue `pub_journal` | piste d’audit et fil d’activité aux colonnes exactes du journal unifié de Matrix (contrat D18) | `drizzle/0002_share_journal.sql` |
| Tâches planifiées | `npm run worker` : sauvegarde du schéma, déclaration Matrix ; un bail par tâche (`job_runs`) garantit qu’une seule instance exécute une tâche | `src/server/jobs/`, `scripts/worker.ts` |
| Sauvegardes | `pg_dump` du schéma `arche` (format personnalisé, mot de passe hors de la ligne de commande), rétention en jours ; `npm run backup`, `npm run restore -- <fichier> --yes` (le schéma est conservé : `arche_app` n’a pas le droit d’en créer) ; service `worker` et volume `arche-backups` dans le kit Coolify ; clients PostgreSQL 16 dans l’image | `src/server/backup.ts`, `scripts/`, `deploy/compose.yaml`, `Dockerfile` |
| Questionnaire | page de réponse aux 59 questions ouvertes et aux données à fournir, réponses enregistrées dans la base de la page (seuls le propriétaire et les éditeurs écrivent) | `scripts/questionnaire/` |

## 2. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur.
- `npm test` : 127 tests sur PostgreSQL 16, dont l’administration (droits, écritures, audit, auto-verrouillage), le parcours
  Entra complet, la déclaration Matrix sur un vrai schéma, le contrat de `pub_journal`, le bail des tâches (deux
  exécutions simultanées → une seule), la sauvegarde puis la restauration (données et déclencheur append-only revenus).
- Base locale migrée (`0002`, `0003`), `npm run worker` avec `ARCHE_BACKUP_DIR` : la sauvegarde est écrite.
- Build de production, `next start`, `npm run test:smoke` : 17 contrôles HTTP passent ; page « Utilisateurs et rôles » vérifiée
  à l’écran.

## 3. Corrigé en route

- Les tests réinitialisaient le mot de passe du rôle `arche_app`, partagé par tout le serveur PostgreSQL : la base locale
  d’un développeur devenait inaccessible. Les tests se connectent désormais en administrateur et agissent en `arche_app`
  (`SET ROLE`), sans jamais toucher au mot de passe du rôle.

## 4. Limites

- Matrix refuse aujourd’hui une déclaration `app: "arche"` tant que son serveur ne connaît pas Arche (M-8).
- Le CA de référence est saisi mais pas encore utilisé : la typologie arrive avec la livraison 2.
