# CLAUDE.md

Guidance for Claude Code working in the UTBT launcher repo.

## Project

Electron desktop launcher for UTBT (UT99 BunnyTrack). React 19 + Vite 7 +
TypeScript + Tailwind 4, built with `electron-vite`. Renderer code under `app/`;
main-process code under `lib/main/`; typed renderer↔main IPC under `lib/conveyor/`.
The renderer also ships as a static website ([web-target.md](agents/web-target.md)), so shared
UI stays desktop-agnostic behind `app/platform/`.
**This repo is public.** Docs and code describe the launcher and the client-side API
contract it uses, nothing more: no backend repo names, server paths, server stack,
internal endpoints or infrastructure.

## Router

Read the one row that matches the task. Skills in `.claude/skills/` (add a sidebar page, add a
table column, add an IPC channel, wire new API data, audit the docs) trigger on their own.

| Task | Read first |
|---|---|
| style any UI: colour, table, button, form, animation; add a theme | [agents/styling.md](agents/styling.md) |
| use or choose a shared component (PlayerInfo, DataTable, modals) | [agents/shared-components.md](agents/shared-components.md) |
| persist UI state, add a storage key, poll live data | [agents/state-patterns.md](agents/state-patterns.md) |
| navigation, Back/Forward, detail pages, sidebar, URL sync | [agents/navigation.md](agents/navigation.md) |
| call the API, asset URLs, favorites, Patreon tiers | [agents/api.md](agents/api.md) |
| web build, platform gating, responsive layout, bundle budget | [agents/web-target.md](agents/web-target.md) |
| IPC channels, `window.conveyor`, main → renderer events | [lib/conveyor/README.md](lib/conveyor/README.md) |
| main process: file and URL safety, config, cams, auto-updates | [lib/main/README.md](lib/main/README.md) |
| settings panels, UT99 ini keys | [app/components/pages/settings/README.md](app/components/pages/settings/README.md) |
| run, build, lint, commit | [agents/build.md](agents/build.md) |
| write tests, fix a red gate, update screenshot baselines | [agents/testing.md](agents/testing.md) |
| player, map and cap pages, World Records, Cap It All, replays | [agents/features/records.md](agents/features/records.md) |
| teams and clans: directory, roles, lineups, tags | [agents/features/teams.md](agents/features/teams.md) |
| Home dashboard widgets | [agents/features/home.md](agents/features/home.md) |
| game: install, launch and join, map install, demos, window chrome | [agents/features/game.md](agents/features/game.md) |
| events: brackets, stats, predictions, achievements; add an event tab | [agents/features/events.md](agents/features/events.md) |
| event scheduling: proposals, slots, the Schedule tab | [agents/features/event-scheduling.md](agents/features/event-scheduling.md) |
| pick/ban server contract: state, commands, setup, sides, veto | [agents/features/pick-ban-api.md](agents/features/pick-ban-api.md) |
| pick/ban client: session store, docks, visuals, sound, match page | [agents/features/pick-ban-ui.md](agents/features/pick-ban-ui.md) |
| stream kit: Stream tab, OBS scene pages, broadcast styling | [agents/features/stream-kit.md](agents/features/stream-kit.md) |
| admin dashboard API, Admin → Streamers, map videos; add an admin section | [agents/features/admin.md](agents/features/admin.md) |
| Admin → Map Uploads | [agents/features/map-uploads.md](agents/features/map-uploads.md) |

## Hard rules

1. **Every player display goes through `PlayerInfo`**: alias, avatar, title and flag together,
   never a raw `alias` string or a hand-rolled avatar `<img>`.
2. **Tables use the `DataTable.*` primitives**, with no inline `<th>` / `<td>` styling.
3. **Compose conditional classes with `cn`** from `lib/utils.ts`; it resolves Tailwind
   conflicts through tailwind-merge.
4. **A native `<select>` gets `style={{ colorScheme: 'dark' }}`** so Chromium draws dark form
   chrome on Windows.
5. **Modals use `app/components/ui/modal.tsx`**, with `offsetSidebar` when the modal should
   respect the navigation rail.
6. **State lives in its tier; views change only through `navigate()`.** Primary-page state:
   `usePageState` in `Main.tsx` with a versioned `utbt:<thing>:v<n>` key. Detail-page transient
   UI: `useNavState`. One back/forward mechanism: the nav stack.
7. **Neutral colours use theme tokens**: `text-foreground`, `text-muted-foreground`,
   `*-hairline/<n>` and `bg-card/<n>`. They flip with the theme, so the Light theme works
   unedited; `gray-*`, `white/<n>` and dark hex stay out ([styling.md](agents/styling.md)).
8. **Missing data is an API change.** When the launcher needs a field the API doesn't expose,
   get it added to the API (skill: consume-api-data) instead of deriving it in the renderer.
9. **Desktop-only behaviour gates through `app/platform/` capabilities** (`usePlatform()` or its
   named exports), not `window.conveyor` presence checks or `__WEB_TARGET__` reads.
10. **Every UI change works from a 360 px phone to 4K on both targets, and stays cheap.**
    Tables get `responsive` configs with `compactContent` card rows instead of horizontal
    scroll; heroes and tiles wrap instead of truncating key data; controls stay tappable at
    390 px. Lazy-load anything opened after a user action and keep `npm run check:bundle`
    green; no per-row `backdrop-blur` or infinite animations
    ([styling.md](agents/styling.md), [web-target.md](agents/web-target.md)).

## Keeping docs honest

`agents/verify.json` maps each doc to the code it describes. Run `npm run docs:check` before
committing: it fails on missing paths, broken links and unlisted docs, and lists the docs whose
sources changed on this branch. Update each listed doc in the same commit, or confirm it still
holds. A new doc gets an entry in `agents/verify.json`.
