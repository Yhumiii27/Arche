# Livraison 1 — socle

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Plan : [`PLAN.md`](PLAN.md) (L1). Lancée à la demande du responsable
> produit avec les réponses par défaut de [`DECISIONS.md`](DECISIONS.md), et ses décisions du jour : nom **Arche**,
> **PostgreSQL uniquement**, **Codex héberge tous les documents**, environnements de Codex, Vigie, Cursus et Matrix pris en
> compte.

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Socle repris de Keystone (`63f43ad`) | configuration validée, journaux sans secret, santé `/api/health`, horloge métier, durcissement HTTP (CSP à nonce, en-têtes), i18n FR/EN avec contrôle de complétude, design Nocturne, piste d’audit append-only | [`SOCLE.md`](SOCLE.md) |
| Base de données | **PostgreSQL uniquement**, schéma `arche` déclaré dans les tables (disposition de Codex), rôle `arche_app`, migrateur sans `CREATE SCHEMA`, verrou d’écriture `arche.ecritures`, migration sous verrou `arche.migrations` ; `npm run db:local` crée la même disposition sur un poste | `src/server/db/`, `drizzle/` |
| Profils et isolation | 13 profils (spec 01), affectations à portée groupe / zone / filiale / CAPEX, visibilité par profil actif, **filtre SQL sur chaque lecture** ; un CAPEX hors portée répond 404 ; un brouillon reste dans sa filiale | `src/config/roles.ts`, `src/domain/rights.ts`, `src/server/dal/capex.ts` |
| Connexion | Entra ID (OIDC + PKCE, cookie scellé), rôles et portées lus dans Arche ; compte administrateur créé à la première connexion (`ARCHE_ADMIN_EMAILS`) ; changement de rôle actif ; mode démo « Voir en tant que » (une personne par profil) | `src/server/auth/`, `src/server/session.ts` |
| Écrans | coquille, registre des 25 écrans (spec 08) ; accueil, registre des CAPEX, fiche CAPEX (identité), filiales / sites / zones et utilisateurs / rôles (lecture) ; les autres écrans affichent « prévu pour la livraison n » | `src/app/`, `src/config/screens.ts` |
| Jeu de démonstration | 2 filiales fictives (APM Maroc, SAI Sénégal), 16 personnes, 3 CAPEX (Light en phase 2, Stratégique en phase 3, brouillon) | `src/server/db/seed/demo.ts` |
| Exploitation | image Docker (port 3400), kit Coolify (PostgreSQL créé comme le serveur commun, migration, application), CI (PostgreSQL 16, tests, migration, build, fumée, image) | `Dockerfile`, `deploy/`, `.github/workflows/ci.yml`, [`EXPLOITATION.md`](EXPLOITATION.md) |
| Cadrage complété | demandes à Codex, Vigie, Cursus ; demandes à Matrix réécrites d’après ses fichiers ; décisions N-22 à N-25 ; contrats des vues Codex et Matrix lues | `docs/DEMANDES-*.md`, `docs/DECISIONS.md`, `docs/CONTRATS.md` |

## 2. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur.
- `npm test` : 98 tests sur PostgreSQL 16 (une base neuve par fichier) — configuration, journaux, horloge, transactions et
  verrou d’écriture, migrations et santé, démarrage, `db:migrate`, piste d’audit (UPDATE / DELETE / TRUNCATE refusés),
  **isolation par profil en SQL** (chacun des 13 profils), registre d’écrans, barre latérale, connexion (crypto, OIDC,
  configuration), en-têtes HTTP, complétude du français.
- `npm run build` puis `next start` sur la base de démonstration et `npm run test:smoke` : 17 contrôles HTTP (santé, CSP,
  registre par profil, 404 sur le CAPEX d’une autre filiale et sur un brouillon pour une fonction centrale, administration).
- Non vérifié ici : la construction de l’image Docker (pas de démon Docker dans la session ; job « image » de la CI).

## 3. Écarts et limites

- **Pas de PGlite** : il faut un PostgreSQL pour développer et tester (`npm run db:local`, `ARCHE_TEST_ADMIN_URL`).
- Reportés à **L1b** : tâches planifiées et worker, sauvegardes et restauration, déclaration des tables à Matrix, écriture de
  l’administration (comptes, rôles), test de bout en bout de la connexion Entra.
- Barre latérale simplifiée par rapport à Keystone (pas de recherche ⌘K ni de tiroir tablette).
- Référentiels `zones`, `subsidiaries`, `sites` tenus par Arche en attendant Matrix (N-22, M-9).

## 4. Questions ouvertes

Voir [`DECISIONS.md`](DECISIONS.md) « À traiter en priorité » ; nouvelles : N-22 (filiales dans Matrix), N-24 (rattachement
Codex d’un CAPEX), N-25 (identité entre outils) ; AC-3 a désormais un constat (Vigie ne porte pas les études de sécurité).
