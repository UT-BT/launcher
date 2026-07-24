---
doc: build
read_when:
  - "running, building, linting, or typechecking the app"
  - "before committing a change"
keywords: [npm, dev, lint, tsc, build, node, pre-commit, typecheck]
provides: "the dev/build/lint/typecheck commands + the pre-commit gate"
not_here: ["release / versioning process → CONTRIBUTING.md"]
sections: [commands, requirements, pre-commit-checklist]
last_verified: 2026-07-22
verify_against: [package.json, tsconfig.web.json, vite.config.web.ts]
---

# Build / dev / test

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (Electron + Vite HMR). |
| `npm run dev:web` | Start the WEB dev server (plain browser, port 5174). See `agents/web-target.md`. |
| `npm run lint` | ESLint over `app/`, `lib/`. Auto-fix via `--fix` (already wired in). |
| `npx tsc --noEmit -p tsconfig.web.json` | Typecheck renderer code only. Fast. Run before commits. |
| `npm run build:win` | Production Windows build. |
| `npm run build:web` | Static web build into `dist-web/` (gitignored, excluded from the installer). |
| `npm run preview:web` | Serve the production web build locally. |

## Requirements

- **Node 20+**. Vite 7 calls `crypto.hash` which only exists in Node 20+. Older Node = obscure error at dev-server start.
- Windows-first project. PowerShell is the default shell; Bash via WSL also works.

## Pre-commit checklist

1. `npx tsc --noEmit -p tsconfig.web.json` — must pass with 0 errors.
2. `npm run lint` — there are ~23 pre-existing warnings; don't add new ones in changed files.
3. Manual smoke test in `npm run dev` for any UI change. Type-check confirms code correctness, not feature correctness.
4. **Docs freshness.** If this change touched a file listed in any doc's
   `verify_against` frontmatter (see `agents/_map.md`), update that doc and bump
   its `last_verified` in the same commit. Quick check: `git diff --name-only`,
   then grep the changed paths against `agents/_map.md`.
