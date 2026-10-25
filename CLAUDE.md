# Arche — instructions for Claude sessions

Arche is the group's application for steering subsidiaries' CAPEX with the **DIG-PRODI v4.0** method (level N1). EPC2i's
Keystone (`Yhumiii27/Keystone`, read-only for Arche) owns the machine catalogue, the answers to machine needs and the EPC2i
projects. Other group apps: Codex (documents), Vigie (QHSE), Cursus (HR), Matrix (shared PostgreSQL server). Their repositories can be
added read-only to a session (never modified); requests to them go in `docs/DEMANDES-<APP>.md`.

## Where the project stands

- **Delivery 0 (framing) is done** (`docs/spec/00`–`08`, `docs/DECISIONS.md`, `docs/CONTRATS.md`, `docs/DEMANDES-*.md`,
  `docs/PLAN.md`, `docs/SOCLE.md`). The owner started delivery 1 with the default answers of `DECISIONS.md`.
- **Delivery 1 (platform) and 1b (operations, administration) are done** (`docs/DELIVERY-1.md`, `docs/DELIVERY-1b.md`).
- **Delivery 2 (CAPEX and the DIG-PRODI cycle) is done** (`docs/DELIVERY-2.md`): pure model and engine
  `src/domain/lifecycle.ts` (criteria without data are "not evaluated yet" until their delivery), budget and typology
  `src/domain/budget.ts`, CAPEX rules and write rights `src/domain/capex.ts` (`canDo`), Server Functions
  `src/features/capex/actions.ts` (each re-reads the CAPEX through the visibility filter inside its transaction), reads
  `src/server/dal/cycle.ts`, view `pub_capex`.
- **Delivery 3 (living dossiers, circuits, MoC) is done** (`docs/DELIVERY-3.md`): dossiers `src/domain/dossiers.ts` (frozen
  version = immutable, SHA-256 of the canonical content), circuits `src/domain/circuits.ts` (gate decisions only through the
  deciding step; `src/server/cycle/gate-decision.ts`), signatures append-only (trigger), delegation `src/domain/delegation.ts`,
  BP `src/domain/bp.ts`, "My approvals" `src/server/dal/approvals.ts`, Codex connector `src/server/integrations/codex/`
  (simulated catalogue in the demo data set).
- **Delivery 4 (machine needs, Keystone connector) is done** (`docs/DELIVERY-4.md`): needs `src/domain/needs.ts`,
  `src/features/needs/`, view `pub_besoins_machines`; Keystone connector `src/server/integrations/keystone/` — the mirror
  (`keystone_mirror`, written only by `mirror.ts`), modes `ARCHE_KEYSTONE` off / simulation / views (a missing view is
  simulated on the demo data set only), job `keystone-sync`; G2 Go orders the needs covered by a valid firm offer. The CI runs
  the Coolify kit end to end (`docs/EXPLOITATION.md` §4).
- **Delivery 4b (interface) is done** (`docs/DELIVERY-4b.md`, mockups validated by the owner): sidebar sections grouped by
  theme (`group` in `src/config/screens.ts`), CAPEX section always visible with the CAPEX switcher, ⌘K page search; `Folded`
  is a button opening a side panel (closed on success); main actions in the page header; CAPEX map `/map` (Keystone's map,
  origin `6645cb6`) and the zone selector (`arche-zone`).
- **Delivery 5 (dashboards and governance) is done** (`docs/DELIVERY-5.md`), to be validated by the owner on the demo data
  set. Lot 5a: safety milestones declared by the group HSE (`src/domain/safety.ts`, right `safety`; the PSSR discharge is the
  G3 circuit's quitus step), permits (`src/domain/permits.ts`), engineering pack (`src/domain/pack.ts`, seed list until the
  owner's C-9 list), monthly actuals and CSV import, S-curve, SPI / CPI / EAC, uncertainty gap (`src/domain/execution.ts`,
  `src/server/dal/execution.ts`); the L5 gate criteria are evaluated in `deliveryFacts`. Lot 5b: reviews and audits
  (`src/domain/governance.ts`, right `audit`), rule-based alerts (`src/domain/alerts.ts`), dashboards (`capexDashboard`,
  `portfolioDashboard`, `copilAgenda` in `src/server/dal/governance.ts`), Copil report `/print/capex/[code]/report`, job
  `weekly-snapshot`.
- **Delivery 6 (start-up, ramp-up, transfer) is done** (`docs/DELIVERY-6.md`): start of commissioning after the PSSR,
  production lines and daily ramp-up (`src/domain/rampup.ts`, right `rampup`: project lead or the CAPEX's operations expert;
  line results stored on `production_lines` by `recomputeLines`, read by `pub_rampup`), accounting closure (`src/domain/closure.ts`,
  right `closure`), lessons learned and library `/rex` (right `rex`, published by the lead or sponsor, view `pub_rex_v2`: the common REX contract of Matrix; `pub_rex` v1 kept), G3
  criteria in `startupFacts`. Every screen of the registry is built.
- **The pilot has started** (`docs/PILOTE.md` procedure and prerequisites; `docs/DELIVERY-PILOTE.md` the development lot):
  takeover of a CAPEX in progress by its sponsor (N-20, `src/domain/takeover.ts`, `takeoverCapexAction`; gates
  `taken_over`, no circuit), DIG-PRODI objectives `/kpi` (C-10, `src/domain/kpi.ts`, `src/server/dal/kpi.ts`; reference of
  the existing process `kpi_baselines`, entered by the group industrial director), role guides `docs/guide/`, feedback log
  `docs/RETOURS-PILOTE.md` (record each user feedback there). Next: the owner's prerequisites (hosting C-13, Entra, D-1 to
  D-4, survey of the existing process), then corrections from the feedback; L7 after the pilot.
- **Pilot feedback (owner, 24 Oct 2026; `docs/RETOURS-PILOTE.md`)**: guided opening `/open` (`src/domain/guided.ts`,
  `openGuidedAction`, `src/features/capex/guided-form.tsx`; writes in one transaction through `src/server/capex/cycle-writes.ts`),
  sidebar sections Group portfolio / Subsidiary portfolio (subsidiary selector, cookie `arche-subsidiary`, `subsidiaryChoice`)
  / Steering (the selected CAPEX), FR / EN toggle in the page header, richer demo data, `npm run db:reset-demo`; CAPEX action
  plan (`capex_actions`, `src/domain/actions.ts`, right `actions`; "New action" added to every CAPEX page header by
  `PageHeader`, page `/capex/[code]/actions`, "My actions" on Home). WBS and Gantt: `wbs_tasks`, `src/domain/schedule.ts`,
  `src/server/dal/schedule.ts`, right `schedule`, page `/capex/[code]/schedule`, `src/components/charts/capex-gantt.tsx`
  (Keystone's Gantt look, origin `5b425d5`); an EPC2i project and, at subsidiary and group level, each CAPEX are one
  summary bar. Page actions (owner, 25 Oct 2026): every page passes the actions its viewer may take to `PageHeader`
  (`primary`, `actions`: client elements only, so that they can be counted); beyond 3 they go in the "Actions" list
  (`src/components/app/shell/header-actions.tsx`; `Folded`, `ActionButton`, `ActionLink` render as menu rows there).
- **Owner's answers**: questionnaire "Décisions Arche", https://claude.ai/artifact/B2xm3cfZvTvXfRE6TinNNe — read its database
  (ArtifactData, collection `answers`, one document per question id: `choice` = default | altN | other | discuss, `note`)
  before each delivery and apply the answers to `docs/DECISIONS.md`; rebuild it with `npm run questionnaire:page`.
- Sources of the framing (Keystone repository, branch `main-2a2fep`): `docs/dig-prodi/CDC-DIG-PRODI-v4.0-draft.md`,
  `ANALYSE-DIG-PRODI.md`, `ARCHITECTURE-CAPEX-KEYSTONE.md` (the reference), `PROMPT-APP-CAPEX.md` (kick-off prompt).
- **Remaining-work page**: after every development, update `docs/reste-a-developper.json` (`progress`, `history`, `updated`),
  run `npm run remaining:page` (regenerates `docs/RESTE-A-DEVELOPPER.md` and `.artifacts/reste-a-developper.html`), commit,
  and republish the HTML with the Artifact tool to the same page, https://claude.ai/artifact/NYa4xuAJicPTQcsJhBUBKh (pass it
  as `url`).

## Rules from the product owner

- Reply in **French**. Code, identifiers and commit messages in English. UI strings are English source strings translated
  through `src/i18n`; French is the default language.
- **Never modify the Keystone repository** (nor Matrix, Codex, Vigie, Cursus). A change needed there is written as a request
  in `docs/DEMANDES-KEYSTONE.md` or `docs/DEMANDES-MATRIX.md`.
- Nothing outside the CDC without the owner's approval (additions are listed in `DECISIONS.md` §5).
- Arche writes only in its schema (`arche`, role `arche_app`) and reads other tools only through their `pub_` views.
  Its own `pub_` views are contracts: never drop or rename a column; new columns go at the end.
- Copy only the **platform** from Keystone (`docs/SOCLE.md`, record the origin commit), never business modules.
- Typed text is displayed as typed (never through `t()`); the audit trail is append-only; every Server Function validates
  input and rights server-side; migrations are generated, never edited.
- Every verified lot goes to `main` through a PR merged once CI is green.
- Ports on the owner's Mac: **3400** (Arche) and **3410** (Arche tests). Never use or kill 3000, 3100, 3110, 3200, 3210,
  3217, 3310, 5173.
- **PostgreSQL only** (owner, 22 Oct 2026): no PGlite, anywhere. Tables are declared in the schema (`arche.table(…)`,
  `src/server/db/schema/_schema.ts`, never exported). Tests get a fresh database per file (`src/test/db.ts`,
  `ARCHE_TEST_ADMIN_URL`); a developer runs `npm run db:local` then `npm run db:migrate`.
- **Codex hosts every document** (owner, 22 Oct 2026): Arche stores no file, only Codex references
  (`docs/DEMANDES-CODEX.md`).
- Isolation by subsidiary is enforced in the data layer: every CAPEX read goes through `visibilityCondition`
  (`src/server/dal/capex.ts`); a CAPEX outside the viewer's scope is a 404.
- Stack: Next.js 16 (read `node_modules/next/dist/docs/` before writing code), Drizzle, PostgreSQL, Vitest.

## Setup and checks

```bash
npm ci && npm run db:local && npm run db:migrate   # .env.local: see .env.example
npm run db:reset-demo                              # local only: drop schema arche, reseed the current demo data set
npm run db:demo-topup                              # an existing demo database (a server): add what later lots added, change nothing
npx next typegen && npm run typecheck && npm run lint && npm test
npm run dev                                         # http://localhost:3400
```
