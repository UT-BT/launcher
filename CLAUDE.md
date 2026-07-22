# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in the UTBT launcher repo.

## Project

Electron desktop launcher for UTBT (UT99 BunnyTrack). React 19 + Vite 7 +
TypeScript + Tailwind 4, built with `electron-vite`. Renderer code under `app/`;
main-process code under `lib/main/`; typed renderer↔main IPC under `lib/conveyor/`.
The renderer also ships as a static website (`agents/web-target.md`) — shared UI
must stay desktop-agnostic behind `app/platform/`.
**This repo is public** — keep docs and code about the launcher only. Never put
backend internals here (repo names, filesystem paths, tech stack, internal
endpoints or patterns); document only the client-side contract the launcher uses.

## Router — open the RIGHT doc, not all of them

Match the task to ONE row and read that first. Skills auto-trigger and pull their
own references. Don't pre-load the whole `agents/` set; `agents/_map.md` indexes
every doc.

| If the task is… | Read FIRST | Gives you |
|---|---|---|
| add/modify a sortable or toggleable table column | skill: add-table-column | the column diff + token sections |
| add a brand-new sidebar page | skill: add-data-page | controlled-page contract + Main/AppLayout wiring |
| add a renderer↔main IPC channel | skill: add-ipc-channel | api + handler + schema + register |
| wire NEW data from the API into the UI | skill: consume-api-data | api.ts fetcher + render |
| audit docs vs code (maintenance / pre-release) | skill: doc-audit | drift + confidentiality leak gate |
| style any UI (color / table / button / form) | agents/styling.md | locked tokens; don't invent variants |
| use or choose a shared component | agents/shared-components.md | PlayerInfo, DataTable, modals, inventory |
| persist UI state / add a localStorage key | agents/state-patterns.md | the 3 state tiers + key convention |
| navigation / Back-Forward / detail pages | agents/navigation.md | navigate(), renderView, sidebar, events |
| call the API / asset URLs / favorites | agents/data-sources.md | endpoints + favorites/patreon sync |
| make a feature work or hide on the web build / platform gating | agents/web-target.md | platform layer + capability gates + web build |
| IPC channels / window.conveyor / events | lib/conveyor/README.md | channel inventory + add pattern |
| main-process / services / file access | lib/main/README.md | services + path/url safety + config |
| settings panels / UT99 ini keys | app/components/pages/settings/README.md | sections + ini flow + constants |
| run / build / lint / typecheck / commit | agents/build.md | commands + pre-commit gate |

## Hard rules

1. **`PlayerInfo` is mandatory for every player display.** Never render `alias`
   as raw text or hand-roll an avatar `<img>`. See `agents/shared-components.md`.
2. **Tables use `DataTable.*` primitives.** No inline `<th>` / `<td>` styling.
   See `agents/styling.md`.
3. **Use `cn` from `lib/utils.ts`** for any conditional class composition — it
   resolves Tailwind conflicts via tailwind-merge.
4. **Native `<select>` needs `style={{ colorScheme: 'dark' }}`** so Chromium
   renders dark form chrome on Windows.
5. **Modals use `app/components/ui/modal.tsx`** with `offsetSidebar` when the
   modal should respect the navigation rail.
6. **Persist state in the right tier; navigate via `navigate()` only.** Primary-
   page state → `usePageState` in `Main.tsx` with a versioned `utbt:<thing>:v<n>`
   key; detail-page transient UI → `useNavState`. Never a raw `setCurrentView` or
   a second back/forward mechanism. See `agents/navigation.md` + `agents/state-patterns.md`.
7. **No `text-gray-*` / `bg-gray-*` / `border-gray-*`.** Use `muted-foreground` /
   `white/<n>` / `card/<n>`. See `agents/styling.md`.
8. **Extend the API, don't hack the renderer.** When the launcher needs data the
   API doesn't expose, get the field added to the API rather than deriving or
   working around it in the renderer. See skill: consume-api-data.
9. **Desktop-only behavior gates via `app/platform/` capabilities** (the
   `usePlatform()` hook or its named exports), never raw `window.conveyor`
   presence checks or direct `__WEB_TARGET__` reads. The renderer ships to
   desktop AND web — see `agents/web-target.md`.

## Keeping docs honest

Every doc carries `verify_against` frontmatter naming the launcher files it
documents. If your change touches one of those files, update that doc and bump
its `last_verified` in the same commit. `agents/_map.md` is the index;
`agents/build.md` has the pre-commit check.
