# Arche — instructions for Claude sessions

Arche is the group's application for steering subsidiaries' CAPEX with the **DIG-PRODI v4.0** method (level N1). EPC2i's
Keystone (`Yhumiii27/Keystone`, read-only for Arche) owns the machine catalogue, the answers to machine needs and the EPC2i
projects. Other group apps: Codex (documents), Vigie (QHSE), Cursus (HR), Matrix (shared PostgreSQL server). Their repositories can be
added read-only to a session (never modified); requests to them go in `docs/DEMANDES-<APP>.md`.

## Where the project stands

- **Delivery 0 (framing) is done** (`docs/spec/00`–`08`, `docs/DECISIONS.md`, `docs/CONTRATS.md`, `docs/DEMANDES-*.md`,
  `docs/PLAN.md`, `docs/SOCLE.md`). The owner started delivery 1 with the default answers of `DECISIONS.md`.
- **Delivery 1 (platform) is done** (`docs/DELIVERY-1.md`). Next: L1b (jobs, backups, Matrix declaration, user
  administration), then L2 (CAPEX and the DIG-PRODI cycle) — see `docs/PLAN.md` and `docs/RESTE-A-DEVELOPPER.md`.
- Sources of the framing (Keystone repository, branch `main-2a2fep`): `docs/dig-prodi/CDC-DIG-PRODI-v4.0-draft.md`,
  `ANALYSE-DIG-PRODI.md`, `ARCHITECTURE-CAPEX-KEYSTONE.md` (the reference), `PROMPT-APP-CAPEX.md` (kick-off prompt).
- **Remaining-work page**: after every development, update `docs/reste-a-developper.json` (`progress`, `history`, `updated`),
  run `npm run remaining:page` (regenerates `docs/RESTE-A-DEVELOPPER.md` and `.artifacts/reste-a-developper.html`), commit,
  and republish the HTML as the "Reste à développer Arche" artifact.

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
npx next typegen && npm run typecheck && npm run lint && npm test
npm run dev                                         # http://localhost:3400
```
