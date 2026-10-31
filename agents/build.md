# Build, test, commit

The commands you need and the gate every commit passes. `package.json` `scripts` has the full list.

## Commands

| Command | Use |
|---|---|
| `npm run dev` | Electron app with HMR |
| `npm run dev:web` | the website in a plain browser on port 5174 ([web-target.md](web-target.md)) |
| `npm run typecheck:web` | typecheck `app/` and `lib/`; fast |
| `npm run typecheck:e2e` | typecheck `e2e/`, `playwright.config.ts` and `vitest.config.ts` (`tsconfig.e2e.json`); re-checks `app/` and `lib/` with them, so it takes about a minute |
| `npm run lint` | ESLint over the repo: `app/`, `lib/`, `e2e/`, `scripts/` and the configs (`lint:fix` to auto-fix) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright |
| `npm run build:web` then `npm run check:bundle` | static web build into `dist-web/`, then the bundle budget |
| `npm run build:win` | per-user Windows installer into `dist/` |
| `npm run docs:check` | doc manifest, links, and the docs this branch made stale |

## Requirements

- **Node 20+.** Vite 7 calls `crypto.hash`; older Node fails with an obscure error at dev-server start.
- **Where a new package goes.** `dependencies` holds only what the main process or preload load at
  runtime; those ship inside the installer as-is. Renderer libraries (UI kits, icons, charts) go in
  `devDependencies`, because Vite bundles them into `out/renderer`; listing one in `dependencies`
  ships it twice and grows every update (`lib/main/README.md`, Auto-updates).

- **Format the files you changed** (`npx prettier --write <files>`). `.prettierignore` keeps Prettier
  off the pinned golden fixtures ([testing.md](testing.md)) and generated output, so no format run
  breaks a pin. Much of the repo is not Prettier-formatted, so `npm run format` gives a repo-wide diff.

## Pre-commit gate

1. `npm run typecheck:web` and `npm run typecheck:e2e`: 0 errors.
2. `npm run lint`: no new warnings in the files you changed.
3. `npm test`: green. Writing tests or fixing a red suite: [testing.md](testing.md).
4. `npm run docs:check`: fix every failure; update each doc listed under "Review" in the same
   commit, or confirm it still matches the code.
5. UI change: smoke it in `npm run dev`, and in `npm run dev:web` at 390 px and 1920 px. The
   typecheck proves types, not behaviour.
6. Change that can move the bundle (new page import, new dependency, new lazy boundary):
   `npm run build:web` then `npm run check:bundle`.
