# Demandes d’Arche à Vigie (QHSE)

> 22 oct. 2026. Arche **ne modifie jamais** le dépôt Vigie : ces demandes sont à transmettre au chat Vigie par le
> responsable produit.
>
> État de Vigie relevé le 22 oct. 2026 (dépôt `Yhumiii27/Vigie`, commit `6794a10`) : événements, DUERP, actions QSE
> (24 sources, dont `hazop` en simple référence libre), audits, plans de prévention, permis, contrôles réglementaires, sites ;
> vues `pub_non_conformites`, `pub_hse_projet`, `pub_journal` ; **aucune API d’intégration** (seulement `/api/sante`) ;
> **ni HazID, ni HazOp / AMDEC, ni PSSR, ni RSPDI, ni audit ASPD ne sont modélisés.** La question AC-3 (« Vigie porte-t-il
> ces études ? ») a donc pour réponse factuelle « pas aujourd’hui ».

| # | Demande | Nécessaire pour (Arche) | Priorité |
|---|---|---|---|
| VG-01 | **Études de sécurité des procédés** : HazID, HazOp / AMDEC, PSSR (avec RSPDI), audit ASPD — par site (usine de la filiale) et par CAPEX : statut, date de conclusion, conclusion, pièces (Codex), responsable SSE | L5 (jalons HS) | à décider (AC-3) |
| VG-02 | **Actions de sécurité issues de ces études**, avec leur échéance et leur retard (les actions QSE existent ; il manque la source « étude de sécurité » rattachée à l’étude et au CAPEX) | L5 | à décider |
| VG-03 | **Vue `pub_etudes_securite`** (colonnes proposées dans `CONTRATS.md` §2.3) et droits de lecture d’`arche_app` (Matrix) | L5 | à décider |
| VG-04 | **Liens profonds** vers une étude et vers les actions d’une étude (sur le modèle de `/actions?action=A-214`) | L5 | basse |
| VG-05 | **Site Vigie = usine de la filiale** (clé `matrix.sites.code`, D14) : les sites des filiales doivent exister dans Matrix et Vigie | L5 | moyenne |

En attendant : les jalons HS sont **déclaratifs** dans Arche (N-13), saisis par le SSE groupe avec une référence de preuve
(document Codex).

## 1er nov. 2026 — AR-033 lancé par le responsable produit

Le responsable produit a lancé AR-033 : **les études de sécurité des procédés sont tenues dans Vigie** (réponse à AC-3 et à la
question CNF-12 à CNF-14 / INT-18 du `docs/RESTE-A-FAIRE.md` de Vigie). Arche est prêt à les lire : contrat de
`vigie.pub_etudes_securite` dans [`CONTRATS.md`](CONTRATS.md) §2.5 (colonnes, valeurs, règle de franchissement des jalons),
connecteur `src/server/integrations/vigie/` (mode `ARCHE_VIGIE`, simulation sur le jeu de démonstration), tâche `vigie-sync`.
**Déposée le 1er nov. 2026** (validée par le responsable produit) dans le `REQUESTS.md` de Vigie (Yhumiii27/Vigie#27). Depuis la
décision M-18 de Matrix (1er nov. 2026), c’est Matrix qui définit la vue sur les tables de Vigie et le lien de lecture
d’`arche_app` : demande M-15 (Yhumiii27/Matrix#52).
