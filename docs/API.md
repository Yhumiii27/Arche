# Arche — API métier, webhooks et exports

> Livraison 7, lot 7a (AR-042, AR-048 ; décision du responsable produit du 29 oct. 2026, `DECISIONS.md` §5). Les autres
> applications du groupe continuent de lire les vues `pub_` (`CONTRATS.md`) ; l'API sert les outils qui ne lisent pas le
> serveur PostgreSQL commun (Power BI, un connecteur Sage, un script) et ceux qui doivent être prévenus d'un événement.

## 1. Applications clientes et clés

L'administrateur crée une **application cliente** dans *Administration › API et webhooks* (`/admin/api`) :

- un **nom** (« Power BI groupe », « Connecteur Sage APM ») ;
- le droit d'**écrire** (réalisés mensuels, actions) ou la **lecture** seule ;
- les **filiales** qu'elle voit et sur lesquelles elle écrit (aucune cochée : tout le groupe). Les brouillons ne sont jamais
  servis, comme dans `pub_capex`.

La **clé** (`arche_<8 caractères>_<43 caractères>`) n'est affichée **qu'une fois**, à la création : Arche n'en garde que
l'empreinte SHA-256. Une clé perdue se remplace (nouvelle application, puis révocation de l'ancienne). La révocation coupe la
clé et suspend les webhooks de l'application. La création, la révocation, les abonnements et les écritures par l'API sont
au journal d'audit (« API · <application> »).

## 2. Conventions

- Préfixe `/api/v1/`, JSON (`Content-Type: application/json`), montants en k€, dates `AAAA-MM-JJ`, mois `AAAA-MM`.
- Authentification : `Authorization: Bearer <clé>` sur chaque requête ; sans clé valable, **401** `{"error":"unauthorized"}`
  avec `WWW-Authenticate: Bearer realm="arche"`. L'API ne passe pas par la connexion Microsoft (proxy : chemin public).
- Erreurs : `{ "error": "<code>", "message": "<texte anglais>" }` — `not_found` (404, aussi pour un CAPEX hors du périmètre
  de l'application), `invalid` (422), `unknown_lot`, `epc2i_lot` (les lots EPC2i viennent de Keystone), `capex_not_active`
  (409), `forbidden` / `read_only_client` (403), `invalid_json` (400), `too_large` (413).
- Réponses : `Cache-Control: no-store` et `X-Request-Id` (celui de la requête quand il est un simple jeton, sinon tiré par
  Arche).

## 3. Lecture

| Point d'entrée | Contenu |
|---|---|
| `GET /api/v1/capex` | les CAPEX du périmètre : code, intitulé, filiale, zone, site, type, statut, phase, typologie, sponsor, chef de projet, date du besoin, ouverture, début de MES, budget validé et sa classe, dernière mise à jour |
| `GET /api/v1/capex/<code>` | le même, plus les lots (budget validé par lot), les versions de budget, les sessions de jalons et leurs décisions, les besoins machines, les indicateurs (BAC, PV, EV, AC, EAC, SPI, CPI, budget G2, pack, risques) et les alertes à règles |
| `GET /api/v1/capex/<code>/actuals` | l'engagé, le réalisé et l'avancement physique mensuels des lots (source, saisi par, le) |

## 4. Écriture (application avec le droit d'écrire, requête signée)

Une écriture porte, en plus de la clé, la **signature de son corps** (convention de Codex, `docs/api.md` de Codex) :

```
X-Arche-Timestamp: <secondes Unix>
X-Arche-Signature: v1=<hex de HMAC-SHA256(clé, "<horodatage>." + corps)>
```

L'horodatage doit être à moins de 300 secondes de l'heure d'Arche (`signature_expired`) ; une même requête signée n'est
acceptée **qu'une fois** (`signature_replayed`) : un nouvel essai se signe à nouveau. Autres refus : `signature_missing`,
`signature_invalid`. Plusieurs valeurs `v1=` séparées par des virgules sont admises (quatre au plus).

| Point d'entrée | Corps | Effet |
|---|---|---|
| `POST /api/v1/capex/<code>/actuals` | `{"lot": 2, "month": "2026-09", "committedKeur": 120, "spentKeur": 80, "physicalPct": 35}` (au moins une mesure) | engagé / réalisé / avancement du lot (hors EPC2i) pour le mois, comme une ligne de l'import CSV du CDG (source « import ») |
| `POST /api/v1/capex/<code>/actions` | `{"title": "…", "description": "…", "dueOn": "2026-11-15", "ownerEmail": "…", "source": "general", "sourceRef": "…"}` | une action du plan d'actions (201) ; le responsable, par son adresse, est dans l'équipe du CAPEX |

```bash
KEY='arche_…'; BODY='{"lot":2,"month":"2026-09","spentKeur":80}'; TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$KEY" -hex | sed 's/^.* //')
curl -s https://arche.example/api/v1/capex/CPX-APM-2026-01/actuals -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -H "X-Arche-Timestamp: $TS" -H "X-Arche-Signature: v1=$SIG" --data-binary "$BODY"
```

## 5. Webhooks

Un **abonnement** relie une application à une adresse HTTPS (HTTP admis sur `localhost` seulement) et à des événements. Son
**secret de signature** (`whsec_…`) n'est affiché qu'une fois. Les événements sont écrits dans une file (`webhook_deliveries`)
dans la transaction du changement, puis envoyés par la tâche `webhooks` du worker (chaque minute), seulement pour les CAPEX
du périmètre de l'application.

| Événement | Quand | `data` |
|---|---|---|
| `capex.opened` | ouverture d'un brouillon, ou reprise d'un CAPEX en cours (N-20) | `openedOn`, `takenOver` (et `phase` pour une reprise) |
| `gate.decided` | décision d'un jalon par l'étape décisionnaire de son circuit | `gate`, `session`, `decision`, `reason`, `conditions`, `decidedOn`, `decidedBy`, `status`, `phase` |
| `alert.raised` | une alerte à règles apparaît sur un CAPEX actif (contrôle toutes les heures, tâche `alerts-raised`) ; annoncée une fois tant qu'elle dure | `rule`, `level`, `text` (anglais), `detail` |

Corps : `{ "id": "<uuid de l'événement>", "event": "…", "occurredAt": "…", "capex": { "code", "subsidiary", "title", "status", "phase" }, "data": { … } }`.

En-têtes : `X-Arche-Event`, `X-Arche-Delivery` (identifiant de l'envoi), `X-Arche-Timestamp`, `X-Arche-Signature`
(`v1=` HMAC-SHA256 du secret sur `"<horodatage>." + corps`, à vérifier par le destinataire). Une réponse 2xx vaut réception ;
sinon l'envoi est retenté après 1, 5, 15, 60 minutes puis toutes les 4 heures, 8 essais au plus, puis marqué « en échec »
(l'administrateur peut le renvoyer depuis `/admin/api`). Un même événement peut arriver deux fois (reprise après une
coupure) : dédoublonner sur `id`.

## 6. Exports (AR-042)

- **Tableaux** : registre des CAPEX (avec les filtres de la page), portefeuilles groupe et filiale (indicateurs de chaque
  CAPEX), alertes de l'accueil, engagé / réalisé d'un CAPEX : boutons « Exporter (Excel) » et « Exporter (CSV) » de
  l'en-tête de chaque page (`/export/<jeu>?format=xlsx|csv`). Mêmes droits et même visibilité que la page. CSV pour Excel en
  français : séparateur `;`, virgule décimale, UTF-8 avec BOM ; un texte qui ressemblerait à une formule est préfixé d'une
  apostrophe. Fichier Excel : une feuille, en-tête figé et filtré, textes jamais évalués.
- **PDF** : le rapport Copil et chaque version de dossier sont écrits en PDF par le serveur (A4, Helvetica, pagination ;
  « Télécharger en PDF » de la page imprimable, « Rapport Copil (PDF) » de la page Gouvernance, et la page du dossier). Le
  dossier figé et signé reste déposé dans Codex par l'utilisateur (Arche ne garde aucun fichier).

## 7. Power BI

Deux voies, au choix de la DSI :

1. **API** (disponible) : une application cliente en lecture seule (« Power BI groupe »), puis dans Power BI *Obtenir des
   données › Web › Avancé* : l'URL `https://<arche>/api/v1/capex` et l'en-tête `Authorization` = `Bearer <clé>` ; le détail
   d'un CAPEX par `/api/v1/capex/<code>`. Actualisation planifiée : par la passerelle de données de l'entreprise.
2. **Vues `pub_`** (demande M-14 à Matrix) : un rôle de lecture `bi_reader` sur les vues `pub_` d'Arche (et des autres outils)
   du serveur commun, lu par le connecteur PostgreSQL de Power BI.
