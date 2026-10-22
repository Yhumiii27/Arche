# Demandes d’Arche à Cursus (RH)

> 22 oct. 2026. Arche **ne modifie jamais** le dépôt Cursus. État relevé le 22 oct. 2026 (dépôt `Yhumiii27/Cursus`, commit
> `c25516d`) : la personne y est identifiée par son **matricule** ; vues `pub_salaries`, `pub_titres`, `pub_titres_detenus` ;
> API réservée à Keystone ; pas de dimension « société / filiale » visible (un seul employeur).

Arche n’a **pas besoin de Cursus en livraison 1** : ses utilisateurs viennent de Microsoft Entra ID et de ses propres
affectations de rôles. Points à prévoir :

| # | Demande / question | Nécessaire pour (Arche) | Priorité |
|---|---|---|---|
| CU-01 | Les salariés des filiales seront-ils dans Cursus (dimension société) ? Sinon Arche garde ses propres comptes pour eux (N-3). | — | à décider |
| CU-02 | Formation initiale des équipes d’exploitation (CDC phase 4) : si Cursus la porte, une vue des formations d’un site ou d’un CAPEX pour le dossier de transfert | L6 | plus tard |
| CU-03 | Matricule sur les comptes Arche des salariés EPC2i / groupe (colonne `qui_matricule` de `pub_journal`, rapprochement avec Codex et Keystone) : lecture de `pub_salaries` par `arche_app` | après L1 | basse |
