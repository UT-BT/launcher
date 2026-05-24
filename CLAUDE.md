# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in the UTBT launcher repo.

## Project

Electron desktop launcher for UTBT (UT99 Bunny Track). React 19 + Vite 7 + TypeScript + Tailwind 4. Built with `electron-vite`. Renderer code lives under `app/`; main-process code under `lib/main/`. Data is fetched from the DataService backend (`api.utbt.net`, `localhost:5000` in dev) via the helpers in `app/utils/api.ts`. User avatars come from `https://gateway.utbt.net/users/{userId}/avatar`.

## Build / dev

- `npm run dev` — start dev server (Node 20+ required, Vite 7 calls `crypto.hash`).
- `npm run lint` — ESLint.
- `npx tsc --noEmit -p tsconfig.web.json` — typecheck renderer code only.
- `npm run build:win` — production build.

## Shared components

### `PlayerInfo` — MANDATORY for every player display

`app/components/shared/PlayerInfo.tsx`.

Any time the UI lists a player (reviewer in a review card, map author, achievement attribution, leaderboard row, cap history, etc.), render them through `PlayerInfo`. Do not output `alias` / `username` as raw text and do not write a one-off avatar `<img>`. The component handles:

- Discord avatar via `getAvatarUrl(userId)` with fallback to Discord default on load error
- Skipping the avatar entirely when `userId` is missing or short (string-only authors, bots)
- Active title display + per-rarity styling (color, weight, glow, legendary pulse animation)
- "You" highlight (emerald tint + badge)
- Horizontal or vertical layout, `sm` / `md` / `lg` sizing

The props are flat primitives — `userId`, `alias`, `title` — never nested user/record shapes. If your data is in a different structure, destructure at the call site:

```tsx
<PlayerInfo
  userId={review.user}
  alias={review.alias}
  title={review.active_title}
  size="md"
  highlight={isOwn}
  showYouBadge={isOwn}
/>
```

#### Rarity styling (1–5)

Defined inside `PlayerInfo` as two tables (`getAvatarBorderStyle` / `getTitleStyle`) ported from `UTBT_FrontEnd/src/components/UTBT/PlayerInfo.js`. Do not re-implement rarity logic elsewhere. Rarity 5 uses `legendaryAvatarPulse` and `legendaryTitlePulse` keyframes defined in `app/styles/globals.css`.

#### If your backend payload lacks `active_title`

Extend the backend endpoint to include it (see `MapReview.json()` in `DataService/data_service/endpoints/map_review/model.py` for the pattern: relationship to `AssignedTitle` filtered by `selected=True`, chained to `TitleCatalogue`, injected as `active_title` dict in an overridden `json()`). Don't work around it in the launcher.

## Player data shapes

| Source | Fields available |
|---|---|
| `MapReview` | `user` (id), `alias`, `active_title` |
| `Record` | `user_id`, `alias`, `color_r/g/b` (no rarity yet) |
| `Summary.achievements[]` | `author` only (text-only `PlayerInfo` usage) |
| `SummaryCap` | `author` only (text-only `PlayerInfo` usage) |
| `UserProfile` | `id`, `alias`, `active_title` |

For the text-only sources, pass just `alias`; the component renders without avatar.

## Shared utilities (use these instead of re-implementing)

Before writing inline helpers or one-off components, check these. They were extracted from MapsPage and the modals; future pages should reuse them.

| Module | Use for |
|---|---|
| `app/components/shared/MapThumbnail.tsx` | Any map screenshot tile. Pass `mapName` + optional `className` for size/rounding. Falls back to `default.png` on load error. |
| `app/utils/scoreColors.ts` | `scoreTextColor` / `scoreBgColor` / `scoreSliderAccent` for any 0–10 review value (pass `inverted` for lower-is-better dimensions like luck/learning/difficulty-in-review). `difficultyTextColor` / `difficultyBgColor` for 1–10 map difficulty (different yellow band — paired with `DIFFICULTY_RANGES`). Do not re-implement these thresholds. |
| `app/utils/format.ts` | `formatCapTime(seconds)` for `MM:SS.mmm`, `formatDelta` for short deltas, `formatAddedDate`, `isNew` (30-day window). |
| `app/components/ui/pagination.tsx` | `PaginationBar` + `buildPageList`. Pass optional `meta` string (e.g. `"search"`, `"filtered"`) for the count badge. |
| `app/components/ui/multi-filter-dropdown.tsx` | `MultiFilterDropdown` — multi-select with optional fuzzy search, optional per-option icon. |
| `app/components/ui/filter-panel-row.tsx` | `FilterPanelRow` — label + flex-wrap children, used inside a filters panel. |
| `app/utils/search.ts` | `fuzzyMatch(text, query)` — substring-first, then ordered-subsequence fallback. |

## Conventions

- `cn` class merger lives in `lib/utils.ts`; always use it for conditional classes.
- Selects need `style={{ colorScheme: 'dark' }}` so Chromium renders dark form chrome on Windows.
- Modals use `app/components/ui/modal.tsx` with `offsetSidebar` when the modal should respect the navigation rail.
- Persist user-facing UI state (filters, sort, page) in `localStorage` via the pattern used by `Main.tsx` for `mapsState` — versioned key (`utbt:thing:v1`), merge-over-defaults on load.

## Where the maps page state lives

- `MapsPage` is a controlled component. State + data caches are hoisted to `Main.tsx` so they survive navigation to `MapDetailPage` and back.
- Filters/sort/page persisted to `localStorage`; data caches are not (they re-fetch on launcher start).
