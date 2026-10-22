# Livraison 4b — Interface : menus par thèmes, actions visibles, carte des CAPEX

> 22 oct. 2026, branche `claude/brave-curie-chxbck`. Demande du responsable produit du 22 oct. 2026 ; maquettes validées le
> même jour (https://claude.ai/artifact/MVMnKjYf2wD6Tng3us8DJU). Ajouts inscrits dans [`DECISIONS.md`](DECISIONS.md) §5 ;
> reprises de Keystone dans [`SOCLE.md`](SOCLE.md) (commit d'origine `6645cb6`).

## 1. Ce qui est livré

| Domaine | Contenu | Où |
|---|---|---|
| Menu | sections Pilotage, CAPEX, Administration repliables (mémorisées), entrées **regroupées par thèmes** (Portefeuille · Instances et capitalisation ; Cycle DIG-PRODI · Budget et décisions · Réalisation · Risques et sécurité · Démarrage et traçabilité ; Référentiels · Accès · Méthode · Intégrations) ; recherche de page ⌘K | `src/config/screens.ts` (`group`), `src/components/app/shell/nav-model.ts`, `sidebar.tsx` |
| Section CAPEX toujours visible | ses entrées visent le CAPEX de l'URL, sinon le dernier utilisé (cookie `arche-capex`), sinon le premier CAPEX de l'utilisateur ; **sélecteur de CAPEX** repris du sélecteur de projet de Keystone (Mes CAPEX / Tout mon périmètre, recherche, même page du CAPEX choisi) | `sidebar.tsx` |
| Actions visibles | tout formulaire replié devient un **bouton qui ouvre un panneau latéral** ; le panneau se ferme et une notification confirme quand l'action réussit ; actions principales dans l'en-tête des pages | `src/components/app/ActionForm.tsx` (`Folded`) |
| Registre | bouton **« Nouveau CAPEX »** (fenêtre : intitulé, filiale, site, type, date de besoin, description, **chef de projet nommé par le Sponsor**, code attribué), sélecteur de zone, recherche et filtres statut / phase, indicateurs (CAPEX, budget validé, jalons à venir, mes validations), cycle DIG-PRODI en barres, prochain jalon, budget validé, « Ouvrir le CAPEX » sur un brouillon | `src/app/(app)/capex/page.tsx`, `src/features/capex/forms.tsx` (`NewCapexButton`), `src/server/dal/portfolio.ts` |
| Synthèse d'un CAPEX | barre d'actions (modifier la fiche, suspendre / reprendre, ouvrir, **soumettre au jalon**), bandeau **« Prochaine étape »** (premier critère bloquant non atteint et son action), lien d'action sur chaque critère non atteint | `src/app/(app)/capex/[code]/page.tsx`, `src/features/capex/next-step.ts` |
| Besoins machines | « Ajouter un besoin machine » dans l'en-tête, « Retirer… » avec motif dans un panneau | `src/features/needs/forms.tsx` |
| Carte des CAPEX | carte de Keystone adaptée : CAPEX à leur site, marqueurs par phase (3–4 plein, 1–2 pointillé, suspendu cerclé, brouillon ou clos creux), regroupement, info-bulle, cadrage Monde · zone · CAPEX, liste des sites, indicateurs | `/map`, `src/components/charts/capex-map.tsx`, `src/domain/capex-map.ts`, `src/features/map/` |
| Vues géographiques | sélecteur de zone (cookie `arche-zone`) partagé par le registre et la carte ; cadre de chaque zone | `src/components/app/ZoneSeg.tsx`, `setZone` |
| Coordonnées | latitude / longitude des sites (saisies dans *Administration › Filiales, sites, zones*), cadre géographique des zones ; migration `0010_site_coordinates` | en attendant Matrix (M-11, M-12, demandes déposées) |

## 2. Vérifications

- `npm run typecheck`, `npm run lint` : sans erreur. `npm test` : 198 tests sur PostgreSQL 16 (modèle du menu, logique de la
  carte, coordonnées d'un site).
- Build de production, `npm run test:smoke` : 37 contrôles (bouton « Nouveau CAPEX » et sélecteur de zone, carte, prochaine
  étape et action de jalon).
- Navigateur (build de production) : création d'un CAPEX par la fenêtre avec chef de projet nommé, puis ouverture ; sélecteur de
  CAPEX ; panneau d'ajout d'un besoin ; carte avec ses deux sites.

## 3. Limites

- Les coordonnées et le cadre des zones viendront de Matrix (M-11, M-12) ; d'ici là, l'administrateur les saisit dans Arche.
- Le serveur de développement (`next dev`) de la session cloud rechargeait les pages en boucle ; les vérifications ont été
  faites sur le build de production (`next start`), comme en CI.
