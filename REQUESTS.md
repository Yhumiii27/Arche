# Requêtes inter-applications
Format d'une entrée :
## [YYYY-MM-DD] <app demandeuse> → <cette app> — <titre court>
- Statut : OUVERTE | ACCEPTÉE | REFUSÉE | FAITE
- Demande : (quoi)
- Justification : (pourquoi, impact sur l'app demandeuse)
- Détails techniques : (tables, champs, types, endpoints, exemples)
- Validé par Guillaume le : (date)

## [2026-10-23] Matrix → Arche — Aligner arche.pub_rex sur le contrat commun du REX (D22)
- Statut : OUVERTE
- Demande : publier `arche.pub_rex` (lecteur `matrix_app`) avec les mêmes colonnes, dans le même ordre et avec les mêmes types que `keystone.pub_rex`, à la place de la proposition de `docs/CONTRATS.md` § 3 (`ref_source`, `capex_code`, `projet_code`, `categorie`, `titre`, `texte`, `phase`, `publie_le`, `auteur`).
- Justification : décision D22 de Matrix (22/10/2026, option A) ; le contrat d'Arche le prévoit lui-même (« à fixer avec Matrix et Keystone avant la livraison 6 »). Matrix réunit les deux vues par `UNION ALL`, qui exige des colonnes identiques. Sans alignement, Matrix doit transformer chaque vue et toute évolution d'un côté casse la vue commune. Pas bloquant avant la livraison 6 d'Arche (`rex_entries`).
- Détails techniques : colonnes, dans cet ordre et de type `text` sauf indication : `ref_source` (identifiant de la ligne dans l'outil), `outil` (`keystone` ou `arche`), `projet_code`, `capex_code`, `numero`, `categorie`, `titre`, `constat`, `impact`, `recommandation`, `portee`, `statut`, `auteur`, `cree_le` (timestamptz), `maj_le` (timestamptz). Colonnes propres à un outil : en fin de vue seulement. Vue `WITH (security_barrier)`, lecteur `matrix_app` (droit déjà prévu dans `infra/postgres/partage/90-droits.sql` de Matrix) ; une vue `pub_` est un contrat : aucune colonne retirée ni renommée. Correspondance proposée : `ref_source` = `'rex_entries:' || id`, `outil` = `'arche'`, `projet_code` = projet EPC2i lié s'il y en a un, sinon null, `capex_code` = code du CAPEX, `numero`, `impact` et `portee` = null si Arche ne les tient pas, `categorie`, `titre`, `constat` = le texte du REX, `recommandation` = la recommandation si Arche la distingue, sinon null, `statut` = `'publie'`, `auteur`, `cree_le` = `published_at`, `maj_le` = `updated_at` ; `phase` en fin de vue (colonne propre à Arche). Seules les entrées publiées (`published_at` renseignée) y figurent.
- Validé par Guillaume le : 2026-10-23
