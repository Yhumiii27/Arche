# Requêtes inter-applications
Format d'une entrée :
## [YYYY-MM-DD] <app demandeuse> → <cette app> — <titre court>
- Statut : OUVERTE | ACCEPTÉE | REFUSÉE | FAITE
- Demande : (quoi)
- Justification : (pourquoi, impact sur l'app demandeuse)
- Détails techniques : (tables, champs, types, endpoints, exemples)
- Validé par Guillaume le : (date)

## [2026-10-23] Matrix → Arche — Aligner arche.pub_rex sur le contrat commun du REX (D22)
- Statut : FAITE — `arche.pub_rex_v2` (migration `0016_share_rex_v2`) au contrat commun, `phase` en fin de vue ; nouvelle colonne `rex_entries.recommendation` (migration `0015`). `arche.pub_rex` (v1) reste en place, inchangée (contrat `pub_`), et est marquée remplacée. Matrix lit `arche.pub_rex_v2` (M-13 mise à jour).
- Demande : publier `arche.pub_rex` (lecteur `matrix_app`) avec les mêmes colonnes, dans le même ordre et avec les mêmes types que `keystone.pub_rex`, à la place de la proposition de `docs/CONTRATS.md` § 3 (`ref_source`, `capex_code`, `projet_code`, `categorie`, `titre`, `texte`, `phase`, `publie_le`, `auteur`).
- Justification : décision D22 de Matrix (22/10/2026, option A) ; le contrat d'Arche le prévoit lui-même (« à fixer avec Matrix et Keystone avant la livraison 6 »). Matrix réunit les deux vues par `UNION ALL`, qui exige des colonnes identiques. Sans alignement, Matrix doit transformer chaque vue et toute évolution d'un côté casse la vue commune. Pas bloquant avant la livraison 6 d'Arche (`rex_entries`).
- Détails techniques : colonnes, dans cet ordre et de type `text` sauf indication : `ref_source` (identifiant de la ligne dans l'outil), `outil` (`keystone` ou `arche`), `projet_code`, `capex_code`, `numero`, `categorie`, `titre`, `constat`, `impact`, `recommandation`, `portee`, `statut`, `auteur`, `cree_le` (timestamptz), `maj_le` (timestamptz). Colonnes propres à un outil : en fin de vue seulement. Vue `WITH (security_barrier)`, lecteur `matrix_app` (droit déjà prévu dans `infra/postgres/partage/90-droits.sql` de Matrix) ; une vue `pub_` est un contrat : aucune colonne retirée ni renommée. Correspondance proposée : `ref_source` = `'rex_entries:' || id`, `outil` = `'arche'`, `projet_code` = projet EPC2i lié s'il y en a un, sinon null, `capex_code` = code du CAPEX, `numero`, `impact` et `portee` = null si Arche ne les tient pas, `categorie`, `titre`, `constat` = le texte du REX, `recommandation` = la recommandation si Arche la distingue, sinon null, `statut` = `'publie'`, `auteur`, `cree_le` = `published_at`, `maj_le` = `updated_at` ; `phase` en fin de vue (colonne propre à Arche). Seules les entrées publiées (`published_at` renseignée) y figurent.
- Validé par Guillaume le : 2026-10-23


## [2026-10-30] Matrix → Arche — M-17 : accès entre outils décidés par Matrix (plus de copie de vue, écritures par API ou fonction `pub_`)
- Statut : OUVERTE
- Demande : appliquer dans Arche la décision M-17 de Matrix (`docs/decisions.md` et `docs/architecture-postgres.md` § 8 sexies du dépôt Matrix) :
  1. **Lire** les données d'un autre outil uniquement par ses vues `pub_` (R2), jamais par ses tables ;
  2. **Écrire** chez un autre outil uniquement par son API ou par une fonction `pub_` qu'il fournit (R4), jamais par `INSERT` / `UPDATE` / `DELETE` dans son schéma ;
  3. pour un **nouvel échange**, ne plus demander à Matrix de recopier une vue dans `partage/` : la migration de Arche reste la seule définition de ses vues `pub_` (R3), et le besoin d'accès se déclare comme un lien du registre `matrix.liens` (R5) — en attendant l'API `POST /api/liens` (lot M17-4), par une entrée courte dans le `REQUESTS.md` de Matrix : lecteur, objet (`schéma.pub_…`), nature (`lecture` ou `execution`), justification ;
  4. pour une **écriture qu'un autre outil doit faire chez Arche** : lui fournir une API, ou une fonction `pub_<verbe>_<objet>` créée par migration (`SECURITY DEFINER`, `SET search_path = <schéma>, pg_temp`, appelant identifié par `session_user`, règles et journal de Arche appliqués, `REVOKE EXECUTE … FROM PUBLIC` ; § « Fonctions pub_ » de la note) ;
  5. reprendre ces règles dans le `CLAUDE.md` de Arche et dans ses documents de demandes à Matrix, et faire l'inventaire de ses échanges (point de départ ci-dessous), en signalant à Matrix tout accès qui n'y serait pas conforme.
- Justification : décision du responsable produit du 30/10/2026 (M-17) : Matrix décide de chaque accès d'un outil aux données d'un autre, PostgreSQL l'applique. Les vues `pub_` restent les contrats de lecture, mais leur copie par Matrix (quatre étapes par échange, dont deux à la main) disparaît, et l'écriture entre outils devient possible sous le contrôle de Matrix sans contourner les règles métier du propriétaire.
- Détails techniques : relevé du 30/10/2026 sur `main` de Arche (requêtes SQL vers d'autres schémas) : `codex.pub_documents`, `keystone.pub_*` (connecteur en mode `views`), `matrix.pub_sites` ; écriture chez Codex par son API de dépôt (Yhumiii27/Arche#19) : conforme à R4. Toutes ces lectures passent déjà par des vues `pub_` et aucune écriture directe dans un autre schéma n'a été trouvée : aucune correction urgente. Les vues, droits et fichiers de partage actuels restent en place pendant la transition (lots M17-1 à M17-5 côté Matrix) ; une vue `pub_` existante ne change pas.
- Validé par Guillaume le : 2026-10-30
