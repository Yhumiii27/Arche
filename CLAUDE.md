# Arche — instructions for Claude sessions

Arche is the group's application for steering subsidiaries' CAPEX with the **DIG-PRODI v4.0** method (level N1). EPC2i's
Keystone (`Yhumiii27/Keystone`, read-only for Arche) owns the machine catalogue, the answers to machine needs and the EPC2i
projects. Other group apps: Codex (documents), Vigie (QHSE), Cursus (HR), Matrix (shared PostgreSQL server).

## Where the project stands

- **Delivery 0 (framing, documents only) is done** and waits for the product owner's answers: `docs/spec/00`–`08`,
  `docs/DECISIONS.md`, `docs/CONTRATS.md`, `docs/DEMANDES-KEYSTONE.md`, `docs/DEMANDES-MATRIX.md`, `docs/PLAN.md`,
  `docs/SOCLE.md`. Do not write code before the answers to `DECISIONS.md` "À traiter en priorité".
- Sources of the framing (Keystone repository, branch `main-2a2fep`): `docs/dig-prodi/CDC-DIG-PRODI-v4.0-draft.md`,
  `ANALYSE-DIG-PRODI.md`, `ARCHITECTURE-CAPEX-KEYSTONE.md` (the reference), `PROMPT-APP-CAPEX.md` (kick-off prompt).
- **Remaining-work page**: after every development, update `docs/reste-a-developper.json` (`progress`, `history`, `updated`);
  the generator (`npm run remaining:page`) arrives with delivery 1.

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
- Stack (from delivery 1): Next.js 16 (read `node_modules/next/dist/docs/` before writing code), Drizzle, PostgreSQL /
  PGlite, Vitest, Playwright.
