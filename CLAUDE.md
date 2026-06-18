# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

`avf-compta` is a **desktop application for an accountant** to manage their
practice. The intended domain model (not yet implemented — see "Current state")
covers:

- **Clients** — the accountant's customers.
- **Prestations** (services) — billable services, each with a price.
- **Notes de frais** (expense reports / invoices) — composed of one or more
  prestations.
- **Paiements** (payments) and **reçus** (receipts).
- **Stats** — dashboards/statistics over the above.

All UI-facing text and domain terminology is in **French**; keep it that way.

## Current state

The repository is a fresh Tauri scaffold (single `Initial commit`). It still
contains the template `greet` command (`src-tauri/src/lib.rs`) and demo UI
(`src/App.tsx`). None of the accounting domain above exists yet — implementing
it is the work. There is no database, no persistence layer, and no tests
configured. When adding features, replace the template code rather than building
around it.

## Tech stack

- **Tauri 2** (Rust backend) — desktop shell and native bridge.
- **React 19 + TypeScript** (frontend) bundled by **Vite 7**.
- Package manager is **pnpm** (referenced by `tauri.conf.json`'s
  `beforeDevCommand`/`beforeBuildCommand`). No lockfile is committed yet.

## Commands

```bash
pnpm install              # install JS deps

pnpm tauri dev            # run the full desktop app (Rust + Vite, hot reload)
pnpm dev                  # Vite frontend only, browser at :1420 (no Tauri APIs)
pnpm build                # tsc typecheck + vite build (frontend -> dist/)
pnpm tauri build          # produce distributable desktop bundles
```

Type checking is part of `pnpm build` (`tsc && vite build`). There is no
separate lint or test runner configured; `tsc` (via strict mode below) is the
only static check.

Rust side (run from `src-tauri/`): `cargo check`, `cargo build`, `cargo fmt`,
`cargo clippy`.

## Architecture

The app follows the standard Tauri split:

- **`src/`** — React/TypeScript frontend (the entire UI). Entry: `src/main.tsx`
  → `src/App.tsx`. Static assets served from `public/`. The dev server is pinned
  to **port 1420** with `strictPort` (see `vite.config.ts`); Tauri expects this
  exact port.
- **`src-tauri/`** — Rust backend. `src/lib.rs` holds the `run()` builder and
  all `#[tauri::command]` functions; `src/main.rs` just calls `run()`.

**Frontend ↔ backend communication** goes through Tauri commands: define a
`#[tauri::command]` in `src-tauri/src/lib.rs`, register it in the
`invoke_handler(tauri::generate_handler![...])` list, then call it from React
with `invoke("command_name", { args })` from `@tauri-apps/api/core`. This is the
pattern to extend for all data operations (CRUD on clients, prestations,
payments, etc.).

**Capabilities/permissions**: any Tauri plugin or core API the frontend uses
must be allow-listed in `src-tauri/capabilities/default.json`. Adding a feature
that needs new native access (e.g. filesystem, dialog, SQL) means adding both
the Rust plugin (in `Cargo.toml` + `lib.rs`) and its permission here.

## Conventions

- TypeScript is **strict** with `noUnusedLocals`, `noUnusedParameters`, and
  `noFallthroughCasesInSwitch` enabled (`tsconfig.json`) — unused vars fail the
  build.
- App identifier: `com.kouax.avf-compta`.

## Persistence (not yet chosen)

No storage layer exists. An accounting app needs durable local data; when
adding it, the conventional Tauri choice is the `tauri-plugin-sql` (SQLite)
plugin, wired through a new capability permission and exposed via commands.
Confirm the approach before committing to a storage technology.
