# 03 — Cycle DIG-PRODI paramétré

> CDC §2 ; analyse §1.3 (C-1, C-3, C-8), §2. Le cycle est une **définition versionnée** (`lifecycle_models`, `dig-prodi` 4.0),
> lue par un moteur pur (`src/domain/lifecycle.ts`). Un CAPEX garde la version du modèle avec laquelle il a été ouvert.
> L’admin ajuste les **valeurs** (délais, seuils, experts requis) ; un changement de **structure** (phase, jalon) est une
> nouvelle version livrée avec le code.

## 1. États et phases

```
brouillon ──ouverture──▶ Phase 1 Cadrage ──G1──▶ Phase 2 Avant-Projet ──G2──▶ Phase 3 Exécution
                                                                               │
                                                                       K3 « Prêt à démarrer »
                                                                               ▼
                                        Clos ◀──G3── Phase 4 Démarrage / Ramp-up / Transfert
   No-Go à un jalon ──▶ Abandonné        Suspension (sur décision) ──▶ Suspendu ──reprise──▶ phase d’origine
```

| Phase | Code | Objectif (CDC) | Dossier vivant | Classe visée en fin de phase |
|---|---|---|---|---|
| 1 Cadrage & Opportunités | `cadrage` | qualifier le besoin, alignement stratégique et marché | 1 Business Case Cadrage | E50 |
| 2 Avant-Projet (APS → APD) | `avant_projet` | entonnoir 50 → 30 → 10 %, baseline technique, pack > 80 %, autorisations, BP DAF | 2 Dossier Investissement | E10 |
| 3 Exécution | `execution` | réalisation, coûts, délais, MoC | (tableau de bord d’exécution, C-2) | — |
| 4 Démarrage, Ramp-up & Transfert | `demarrage` | pré-commissioning, PSSR, commissioning, SAT, ramp-up 30 jours | 3 Transfert & REX | — |

Correction du CDC proposée (C-1) : la phase 4 se clôt par **G3** (et non « G4 ») ; le passage Exécution → Démarrage est un
**point de contrôle K3 « Prêt à démarrer »** sans arbitrage, visé par le Dir.IG (conformité à l’Avant-Projet).

## 2. Jalons

| Jalon | Libellé | Décideur | Délai cible | Effet |
|---|---|---|---|---|
| **G1** | Go Études | COPIL GPI (président : Dir.IG, N-6) | **2 jours ouvrés** entre la mise à la décision et la décision (N-7) | libère le budget d’études d’Avant-Projet ; passage en Phase 2 |
| **G2** | Single Gate PDG | PDG (signature) | à paramétrer (défaut 10 jours ouvrés) | met le CAPEX en vigueur : achats de terrain, équipements, recrutements ; **besoins machines → « commandé »** ; budget E10 = baseline G2 |
| **K3** | Prêt à démarrer | Dir.IG (visa) | 5 jours ouvrés | passage en Phase 4 |
| **G3** | Go Transfert / Clôture | Client Interne + Dir.IG (contresignature) | — | CAPEX clos ; REX diffusé ; `pub_rampup` final |

Décisions possibles à un jalon G : **Go**, **Go sous réserve** (conditions suivies, échéance, responsable ; le passage a
lieu), **Ajourné** (reste dans la phase, nouvelle session du jalon), **No-Go** (CAPEX abandonné ; motif obligatoire).

## 3. Critères des jalons

Évalués par le moteur à la soumission (instantané dans `gate_criteria_results`). Un critère **bloquant** empêche la
soumission ; le décideur peut le **forcer avec motif** (audité), sauf mention « non forçable ».

| Jalon | Critère | Bloquant | Source |
|---|---|---|---|
| G1 | Dossier 1 complet à 100 % des sections obligatoires et figé | oui, non forçable | Arche |
| G1 | Budget E50 validé (classe ≥ E50) | oui | Arche |
| G1 | HS 2 HazID franchi | oui | Vigie / déclaratif (N-13) |
| G1 | Équipe conforme au gabarit de staffing | non (alerte) | Arche |
| G1 | Visa Sponsor | oui, non forçable | circuit |
| G1 | Avis d’experts requis rendus (défaut : HSE ; Stratégique : + DAF) | oui | circuit |
| G2 | Dossier 2 complet et figé | oui, non forçable | Arche |
| G2 | Budget **E10** validé par la DAF groupe | oui, non forçable | Arche |
| G2 | Pack ingénierie **> 80 %** (pondéré, parts filiale + EPC2i) | oui | Arche + `pub_pack_ingenierie` |
| G2 | HS 3 HazOp / AMDEC franchi | oui | Vigie / déclaratif |
| G2 | Autorisations : ICPE et permis de construire déposés (obtenus ou échéance connue) | oui | Arche |
| G2 | Offres fermes EPC2i (`E10`) pour tous les besoins machines soumis | oui | `pub_reponses_besoins` |
| G2 | Avis d’experts Qualité, HSE, DAF, Exploitation rendus | oui | circuit |
| G2 | Gabarit de staffing complet (Stratégique : CDG + PMO EPC2i nommés) | oui | Arche |
| K3 | HS 4 contrôle chantier franchi ; lots de travaux ≥ 95 % ; SAT EPC2i planifiés | oui | Arche + `pub_jalons_projets` |
| G3 | PSSR (HS 4+5, RSPDI) franchi et **quitus PSSR** délivré par le SSE groupe | oui, non forçable | Vigie / déclaratif |
| G3 | HS 6 ASPD franchi | oui | Vigie / déclaratif |
| G3 | Réserves soldées : Arche (conditions, MoC) et **réserves A/B de tous les projets EPC2i** (`pub_reserves`) ; PV EPC2i acceptés (`pub_livrables`) | oui | Arche + Keystone |
| G3 | **30 jours continus à capacité nominale** atteints (06 §6) | oui | Arche |
| G3 | Au plus tard **6 mois** après le début de la MES | alerte à M+5, dépassement signalé au Dir.IG (n’empêche pas le G3) | Arche |
| G3 | Clôture comptable attestée par le CDG filiale (N-15) | oui | Arche |
| G3 | REX saisi (≥ 1 entrée par phase) | oui | Arche |

## 4. Jalons HS (C-3, proposition)

| Code | Phase | Contenu | Responsable | Bloque |
|---|---|---|---|---|
| HS 2 | Cadrage | HazID : identification initiale des dangers, pré-validation de la sécurité des procédés | SSE groupe | G1 |
| HS 3 | Avant-Projet | HazOp / AMDEC | SSE groupe | G2 |
| HS 4 | Exécution | contrôle physique chantier | SSE groupe | K3 |
| PSSR (HS 4+5) | Démarrage | Pre-Startup Safety Review avec RSPDI, avant introduction de fluides ou matières | SSE groupe | début de la MES |
| HS 6 | Démarrage | audit ASPD par la Direction SSE groupe | SSE groupe | G3 |

HS 1 n’existe pas dans le CDC : à confirmer (C-3). Définitions de RSPDI et ASPD à fournir.

## 5. Entonnoir de précision (C-8, proposition)

| Classe | Fourchette | Requise | Passage (base de la classe) |
|---|---|---|---|
| `E50` | −50 % / +50 % | au G1 | estimation par ratios, prix catalogue EPC2i |
| `E30` | −30 % / +30 % | mi-Avant-Projet (pas un jalon) | variante retenue, pack ≥ 50 %, devis budgétaires EPC2i (APS) |
| `E10` | −5 % / +10 % | au G2 | baseline technique gelée, pack > 80 %, offres fermes, BP DAF |

Le chef de projet propose la classe d’une version ; la DAF groupe valide `E10`. Un jalon refuse un budget de classe
insuffisante.

## 6. Correspondance avec les étapes Keystone (lecture seule)

| DIG-PRODI | Étapes du projet EPC2i (Keystone) |
|---|---|
| Phase 1 → G1 | `initiative` (réponse indicative E50) |
| Phase 2 → G2 | `aps` (devis budgétaire E30), `apd` (offre ferme E10) |
| G2 | commande → `etudes` |
| Phase 3 | `etudes` … `chantier` |
| Phase 4 → G3 | `mise_en_service_sat`, `garantie` ; PV d’acceptation, réserves soldées |
