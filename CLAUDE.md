# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

`avf-compta` is a **desktop application for an accountant** to manage their
practice:

- **Clients** — the accountant's customers.
- **Prestations** (services) — billable services, each with a price.
- **Notes de frais** (expense reports / invoices) — composed of one or more
  prestations.
- **Paiements** (payments) and **reçus** (receipts).
- **Stats** — a dashboard aggregating the above.

All UI-facing text and domain terminology is in **French**; keep it that way.

## Tech stack

- **Tauri 2** (Rust backend) — desktop shell, owns all business logic and
  persistence.
- **SQLite** via `rusqlite` (feature `bundled`, compiled from source — no system
  `libsqlite3` needed). Migrations via `rusqlite_migration`.
- **React 19 + TypeScript** (thin UI) bundled by **Vite 7**.
- Package manager is **pnpm** (lockfile committed). Tests: `cargo test` (Rust),
  Vitest + React Testing Library + jsdom (frontend).

## Commands

```bash
pnpm install                       # install JS deps (use --frozen-lockfile in CI)
pnpm tauri dev                     # run the full desktop app (Rust + Vite, hot reload)
pnpm dev                           # Vite frontend only at :1420 (Tauri invoke unavailable)
pnpm build                         # tsc typecheck + vite build -> dist/
pnpm test                          # Vitest (run once);  pnpm test:watch to watch
pnpm typecheck                     # tsc --noEmit
pnpm lint                          # ESLint;  pnpm format -> prettier --check

cd src-tauri && cargo test         # Rust unit tests (in-memory SQLite)
cargo test <name>                  # run a single test by (sub)string match
cargo fmt --all --check            # formatting gate (CI uses this)
cargo clippy --all-targets -- -D warnings   # lint gate (warnings are errors)
```

The Rust crate links Tauri's GTK/WebKit libs, so `cargo test`/`build` need the
Linux system deps: `libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev
librsvg2-dev patchelf` (note **4.1**, not 4.0). See `.github/workflows/ci.yml`.

## Architecture

Standard Tauri split, but **all logic and persistence live in Rust**; React only
renders and calls commands.

### Backend (`src-tauri/src/`)

Layered so business logic is testable without the Tauri runtime:

- `money.rs` — `Money(i64)` newtype; the currency is **franc CFA (XOF)**, which
  has **no minor unit**, so amounts are **whole integer francs, never floats**.
  Formatting is French-grouped (`150 000 FCFA`); parsing rejects decimals.
- `db/` — `open()`/`open_in_memory()` set `PRAGMA foreign_keys = ON` (per
  connection!) and run migrations; `db/migrations.rs` holds the schema.
- `models/` — serde DTOs shared with the frontend.
- `repositories/` — data access as free functions taking `&Connection`.
- `services/` — business rules over `&mut Connection` (transactions): note
  creation **snapshots** each prestation's label+price so later price changes
  don't alter historical notes; payments reject over-payment and flip note
  status to `payee` at zero balance; receipts get sequential numbers.
- `commands/` — thin `#[tauri::command]` wrappers: lock `State<Mutex<Connection>>`,
  delegate, return `AppResult<T>`. These have no unit tests (logic is tested in
  repos/services).
- `error.rs` — `AppError` (serde `Serialize`) returned to JS as a string.
- `lib.rs` — `run()`: opens the DB in `app_data_dir()`, `app.manage(Mutex<..>)`,
  registers every command in `generate_handler![...]`.

**Adding a command:** write the logic + test in a repository/service, add a thin
wrapper in `commands/`, then register it in the `generate_handler!` list in
`lib.rs`. Call it from `src/api/client.ts`. All SQL goes through our commands
(not `tauri-plugin-sql`), so `capabilities/default.json` needs no new
permissions for data work.

### Frontend (`src/`)

- `src/api/client.ts` — the **only** place that calls `invoke`; one typed wrapper
  per command. `src/api/types.ts` mirrors the Rust DTOs (amounts as `number` of
  cents). `src/api/money.ts` — `formatEuros`/`parseEuros` mirror the Rust logic.
- `src/pages/*` — one page per domain area, navigated from `src/App.tsx`.
- Tests mock the bridge with the official `@tauri-apps/api/mocks` `mockIPC`
  (see `src/test/setup.ts`). Test the api client and a few page smoke tests;
  don't over-test presentational markup.

Dev server is pinned to **port 1420 / strictPort** (`vite.config.ts`); Tauri
expects exactly this.

## Conventions

- TypeScript is **strict** with `noUnusedLocals`/`noUnusedParameters` — unused
  symbols fail the build. Rust clippy runs with `-D warnings`.
- Keep amounts as whole integer francs (XOF) end to end; format only at the
  display edge (`formatMontant` in TS mirrors Rust `Money::Display`).
- App identifier: `com.kouax.avf-compta`.

## CI/CD & versioning

- `.github/workflows/ci.yml` runs on every push/PR: a Rust job (fmt, clippy,
  tests) and a frontend job (typecheck, lint, prettier, vitest).
- `.github/workflows/release.yml` runs on tags `v*` on a `windows-latest`
  runner: syncs the version into the three manifests via
  `scripts/set-version.mjs`, then `tauri-action` builds the Windows bundles
  (`--bundles msi,nsis`) and drafts a GitHub Release.
- **Version single source of truth is the git tag.** `package.json`,
  `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` stay at the `0.1.0` dev
  placeholder; the release workflow rewrites them at build time (not committed
  back). Release flow: `git tag vX.Y.Z && git push origin vX.Y.Z`.
- Conventional-commit messages (`feat:`/`fix:`/`chore:`) + hand-maintained
  `CHANGELOG.md`.
