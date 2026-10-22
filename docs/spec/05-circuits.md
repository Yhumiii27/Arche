# 05 — Circuits : visas, signatures, avis d’experts, délégation

> CDC §2, §4 « Workflows de validation » ; analyse C-4, C-7, D-5. Moteur « Mes validations » repris du socle Keystone
> (`src/domain/approvals.ts`, `src/server/approvals/` : le moteur et la corbeille, pas les fournisseurs métier de Keystone) ;
> Arche y ajoute ses propres fournisseurs.

## 1. Modèle de circuit

Un circuit est une liste ordonnée d’**étapes** ; des étapes d’un même `parallel_group` se font dans n’importe quel ordre.
Chaque étape a un type, un rôle (ou une personne nommée), une échéance et un résultat.

| Type d’étape | Résultats | Signature |
|---|---|---|
| `opinion` (consultation d’experts) | favorable / avec réserves / défavorable + commentaire | non |
| `visa` | visé / refusé (motif) | simple |
| `decision` | Go / Go sous réserve / Ajourné / No-Go | simple |
| `signature` | signé / refusé (motif) | simple en v1 ; **avancée** pour G2 plus tard (C-7) |
| `countersign` | contresigné / refusé | simple |
| `quitus` / `attestation` | délivré / refusé | simple |

Un refus arrête le circuit et renvoie le dossier au CPF (nouvelle version). Les étapes dues apparaissent dans « Mes
validations » de leurs acteurs, avec relance le matin (tâche planifiée) et alerte au CPF à échéance dépassée.

## 2. Circuits des jalons (modèle `dig-prodi` 4.0)

| Jalon | Étapes |
|---|---|
| **G1** | 1. Consultation d’experts (HSE ; Stratégique : + DAF) · 2. Visa **Sponsor** · 3. Examen par les membres du **COPIL GPI** (avis en ligne, facultatifs) · 4. **Décision** du président du COPIL GPI au nom du comité (N-6, N-7) — le tout en **2 jours ouvrés** à partir de l’étape 3 |
| **G2** | 1. Consultation d’experts **Qualité, HSE, DAF, Exploitation** · 2. Visas **Dir.IG** (conformité technique) et **DAF groupe** (BP E10), en parallèle · 3. **Signature PDG** (décision Go / Go sous réserve / Ajourné / No-Go) |
| **K3** | Visa **Dir.IG** (conformité à l’Avant-Projet) |
| **G3** | 1. **Quitus PSSR** (SSE groupe) et **attestation de clôture comptable** (CDG filiale), en parallèle · 2. **Contresignature** Client Interne et Dir.IG du PV de transfert, en parallèle · 3. G3 prononcé automatiquement à la dernière contresignature |

## 3. Signature simple (v1)

Proposition pour C-7 (niveau « simple » au sens eIDAS) :
- l’utilisateur est connecté par Entra ID **et** s’est authentifié depuis moins de **10 minutes** (sinon Arche relance la
  connexion avec `prompt=login` / `max_age`, N-8) ;
- il confirme le texte de l’engagement (« Je signe le dossier … version … empreinte … ») ;
- Arche enregistre : utilisateur, horodatage serveur, **empreinte SHA-256 de la version figée**, instant d’authentification,
  empreinte de l’adresse IP ; ligne append-only (`signatures`) et entrée d’audit.
- Vérification : la page du dossier recalcule l’empreinte et affiche « intègre » ou « modifié depuis la signature ».

**Signature avancée** (G2 / AFE) : prestataire qualifié français ou européen (Yousign, Docusign…) — choix, coût et date à
décider (C-7) ; prévue en livraison 7.

## 4. Avis d’experts asynchrones

- Le CPF ouvre une consultation sur une **version figée** : spécialités demandées (celles requises par le jalon sont
  pré-cochées), experts nommés (référent par défaut de la spécialité, filiale puis groupe), échéance (défaut **5 jours
  ouvrés**, N-10).
- Chaque expert voit le dossier figé, rend **un avis** motivé ; « avec réserves » crée des conditions proposées au décideur.
- Relance à J−1 et à échéance ; **pas d’avis tacite** : un avis manquant bloque le critère « avis rendus », que le décideur
  peut forcer avec motif (N-10).
- Les avis sont visibles du CPF, des décideurs du jalon et des autres experts consultés.

## 5. Matrice de délégation (C-4, valeurs d’amorce à remplacer)

Après G2, toute **MoC** (`changes`) est routée vers le décideur calculé par `src/domain/delegation.ts` : on prend le plus
petit niveau dont **tous** les plafonds couvrent la modification et le **cumul** des MoC décidées.

| Typologie | Objet | Copil projet | Dir.IG | PDG |
|---|---|---|---|---|
| Light | coût (par MoC) | ≤ 3 % du budget G2 et ≤ 250 k€ | ≤ 7 % et ≤ 1 000 k€ | au-delà |
| Light | délai (par MoC) | ≤ 30 jours | ≤ 90 jours | au-delà |
| Stratégique | coût (par MoC) | ≤ 1 % et ≤ 500 k€ | ≤ 5 % et ≤ 2 500 k€ | au-delà |
| Stratégique | délai (par MoC) | ≤ 15 jours | ≤ 60 jours | au-delà |
| Toutes | tirage de provision pour aléas | ≤ 50 % de la provision | au-delà | — |
| Toutes | **cumul** des MoC coût | ≤ 5 % | ≤ 10 % | au-delà (rebaseline) |
| Toutes | périmètre (ajout / retrait de lot) | — | oui | si > seuil coût Dir.IG |

La matrice est **datée** (`valid_from`) : une MoC est jugée avec la matrice en vigueur à sa soumission. L’admin la modifie ;
chaque modification est auditée.

## 6. « Mes validations » d’Arche

Types : visa de jalon, décision de jalon, signature, contresignature, quitus, attestation, avis d’expert, MoC à décider,
typologie à confirmer (recalcul qui change la typologie), version de budget E10 à valider (DAF groupe). Mêmes KPI et filtres
que dans Keystone (en attente, plus ancien, décidés cette semaine).
