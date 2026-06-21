# Doc map

Manifest of every agent-facing doc. Two jobs:

1. **"Is there a doc for X?"** — scan the table.
2. **"Did my code change invalidate a doc?"** — after editing, grep your changed
   paths against the `verify_against` column; update any doc that matches and bump
   its `last_verified`.

The always-loaded router lives in `/CLAUDE.md`. These docs are pull-on-demand:
open the ONE the router points to, not the whole set.

## Reference docs

| Doc | Path | Provides | verify_against |
|---|---|---|---|
| build | `agents/build.md` | dev/build/lint/typecheck commands + pre-commit gate | `package.json`, `tsconfig.web.json` |
| auth | `agents/auth.md` | client-side Discord OAuth flow + token storage + `auth:*` bridge + renderer gating | `lib/main/auth-service.ts`, `lib/main/config.ts`, `lib/main/main.ts`, `lib/preload/preload.ts`, `app/index.d.ts`, `app/app.tsx`, `app/components/pages/LoginPage.tsx`, `app/components/layout/AppLayout.tsx` |
| styling | `agents/styling.md` | locked design tokens + canonical class strings | `app/components/shared/DataTable.tsx`, `app/styles/globals.css`, `lib/utils.ts`, `app/hooks/useElementWidth.ts` |
| shared-components | `agents/shared-components.md` | inventory of reusable components + when to use each | `app/components/shared/{PlayerInfo,DataTable,CapTimeLink,ColumnsMenu,FilterPresetsMenu}.tsx` |
| state-patterns | `agents/state-patterns.md` | three state tiers + localStorage convention + controlled pages | `app/components/main/Main.tsx`, `app/components/navigation/useNavState.ts`, `app/hooks/useAsync.ts` |
| navigation | `agents/navigation.md` | nav stack, `navigate()` funnel, renderView, sidebar, `open-*` events | `app/components/main/Main.tsx`, `app/components/layout/AppLayout.tsx`, `app/components/navigation/NavigationContext.tsx`, `useNavState.ts` |
| data-sources | `agents/data-sources.md` | client-side API contract + asset URLs + favorites/patreon sync | `app/utils/api.ts`, `app/utils/patreon.ts`, `app/utils/server-utils.ts` |
| conveyor-ipc | `lib/conveyor/README.md` | renderer↔main IPC contract + channel inventory + event bridges | `lib/conveyor/api/index.ts`, `lib/conveyor/schemas/index.ts`, `lib/main/app.ts`, `lib/preload/preload.ts` |
| main-process | `lib/main/README.md` | main-process service map + safety helpers + config + boundary | `lib/main/app.ts`, `lib/main/config.ts`, `lib/main/path-safety.ts`, `lib/main/url-safety.ts`, `lib/conveyor/handlers/ini-handler.ts` |
| settings | `app/components/pages/settings/README.md` | settings sections + ini flow + constants reference | `app/components/pages/settings/SettingsLayout.tsx`, `constants.ts`, `SettingsComponents.tsx` |

## Skills (`.claude/skills/`, model-invoked procedures)

| Skill | Use when |
|---|---|
| `add-data-page` | adding a new primary sidebar page |
| `add-table-column` | adding/modifying a sortable or toggleable DataTable column |
| `add-ipc-channel` | adding a renderer↔main IPC channel |
| `consume-api-data` | wiring new data from the API into the UI |
| `doc-audit` | (maintenance) diff every doc against its `verify_against` files |

## Confidentiality

This repo is public. Docs cover the launcher only — never backend repo names,
paths, tech stack, internal architecture, or "how to change the backend." Every
`verify_against` path must be inside this repo.
