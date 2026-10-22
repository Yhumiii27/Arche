# Arche

Application du groupe pour piloter les **CAPEX des filiales** selon la méthodologie **DIG-PRODI v4.0** : 4 phases, jalons
G1 / G2 / G3, 3 dossiers vivants sous workflow, avis d’experts, matrice de délégation, tableaux de bord, ramp-up et transfert.
Les besoins machines sont adressés à EPC2i, qui y répond dans **Keystone** ; les documents sont dans **Codex**.

**État : livraison 1 (socle) faite** — [`docs/DELIVERY-1.md`](docs/DELIVERY-1.md). Cadrage : [`docs/spec/00-vue-ensemble.md`](docs/spec/00-vue-ensemble.md),
questions ouvertes : [`docs/DECISIONS.md`](docs/DECISIONS.md), plan : [`docs/PLAN.md`](docs/PLAN.md), reste à développer :
[`docs/RESTE-A-DEVELOPPER.md`](docs/RESTE-A-DEVELOPPER.md).

```bash
npm ci
npm run db:local        # PostgreSQL : base epc2i, rôle arche_app, schéma arche
cp .env.example .env.local
npm run db:migrate      # migrations et jeu de démonstration
npm run dev             # http://localhost:3400
```

Exploitation : [`docs/EXPLOITATION.md`](docs/EXPLOITATION.md).
