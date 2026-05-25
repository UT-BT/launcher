# Build / dev / test

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (Electron + Vite HMR). |
| `npm run lint` | ESLint over `app/`, `lib/`. Auto-fix via `--fix` (already wired in). |
| `npx tsc --noEmit -p tsconfig.web.json` | Typecheck renderer code only. Fast. Run before commits. |
| `npm run build:win` | Production Windows build. |

## Requirements

- **Node 20+**. Vite 7 calls `crypto.hash` which only exists in Node 20+. Older Node = obscure error at dev-server start.
- Windows-first project. PowerShell is the default shell; Bash via WSL also works.

## Pre-commit checklist

1. `npx tsc --noEmit -p tsconfig.web.json` — must pass with 0 errors.
2. `npm run lint` — there are ~23 pre-existing warnings; don't add new ones in changed files.
3. Manual smoke test in `npm run dev` for any UI change. Type-check confirms code correctness, not feature correctness.
