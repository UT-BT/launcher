# Data sources

## DataService backend

REST API hosted at `https://api.utbt.net` (prod), `http://localhost:5000` (dev).
All HTTP helpers live in `app/utils/api.ts` — don't hand-roll `fetch` calls in
components.

Repo: sibling working directory `C:\Development\UTBT\DataService` (Python). When
a launcher need exceeds what the API exposes, extend the API rather than
working around in the renderer.

### Helpers in `app/utils/api.ts`

| Category | Functions |
|---|---|
| Maps | `fetchMaps`, `fetchMapsCount`, `fetchMapsMetadata`, `fetchMapsFuzzy`, `fetchMapAuthors`, `buildMapQuery` |
| Records | `fetchWorldRecords`, `fetchWorldRecordsCount`, `fetchRushers`, `fetchRecordsCount`, `fetchWorldRecordsForMaps`, `fetchWorldRecordProgression`, `fetchBestCaps`, `fetchMapLeaderboard` |
| Per-map per-user counts | `fetchUserCapCountForMap` |
| Players | `fetchPlayers`, `fetchPlayersCount` (→ `/v2/players`, server-side alias search/sort/pagination + medals join; row type `PlayerListRow`) |
| Reviews | `fetchMapReviews`, `fetchAllMapReviews`, `submitSummaryReview` |
| Favorites | `fetchUserFavorites`, `addFavoriteMap`, `removeFavoriteMap`, `replaceFavoriteMaps` |
| Demos | `fetchDemoStatus`, `getFirstPersonVideoUrl`, `downloadDemo` |
| Cap detail | `fetchCapDetail`, `fetchMovementAggregate`, `fetchCapCheckpoints` |
| Profile | `UserProfile` type, `getAvatarUrl(userId)` |

Most fetchers take `accessToken` first (Discord OAuth bearer).

### Cap Detail page endpoints

The Cap Detail page (`app/components/pages/CapDetailPage.tsx`, opened by clicking
any cap time — see `CapTimeLink` / the `open-cap` event in
`agents/shared-components.md`)

- **`GET /caps/<cap_id>/detail`** → `CapDetail`. Enriched single cap: the full
  `cap` record (movement/client fields) +
  parsed `checkpoints` and `wr_checkpoints` (`{zone, cumulative, segment}`, parsed
  server-side from `Cap.zone_checkpoints`) + `rank_on_map`
  / `total_on_map` / `neighbors` (above/below) + `deltas` & `medals` (WR + each
  medal threshold) + `server` `{name, region}`. Negative delta = faster than the
  threshold. Used for both the page and the compare-run overlay (`fetchCapCheckpoints`).

Compare-run picker reuses `fetchMapLeaderboard` (`/caps/leaderboard/map/<name>`).

### World Records page endpoints

The World Records page (`app/components/pages/WorldRecordsPage.tsx`) shows the
fastest cap on every map.

- **`GET /v2/world_records/`** → `Record[]`. One row per map (the WR). Supports
  `limit`/`offset` (limit clamped 1–200), `sort` (`asc`/`desc`), `sort_by`
  (`added`/`time`/`map`/`holder`/`difficulty`), `search` (matches map **or**
  player alias), `difficulty_min`/`difficulty_max` (joins `Map`),
  `user` (single holder — used by the player-detail WR card),
  `users`/`difficulties`/`years` (CSV `IN`), `time_ranges` (CSV of `min-max`
  cap-second bands, OR'd), `map` (fuzzy), `maps` (CSV exact), `added_since`, and
  `count=true`. The list
  endpoint joins **`active_title`** (selected title, same shape as the
  progression endpoint) and map **`difficulty`** onto each row. The page paginates
  **server-side**, one page at a time, mirroring `PlayersPage` — `fetchWorldRecords`
  for the page + `fetchWorldRecordsCount` (`count=true`) for the total, with a
  per-page cache + neighbour prefetch. Search / difficulty / timeframe / favorites
  are pushed to the query (favorites → `maps` CSV; timeframe → `added_since`).
- **`GET /v2/world_records/rushers/`** → `{ total, total_records, max_count, items }`
  (`fetchRushers` / `fetchRushersCount`). Per-player WR aggregation (count, median,
  average WR time) grouped in Postgres, replacing the old client-side
  `aggregateRushers` over the full set. Powers the page's "Top Rushers" mode;
  `total_records` + `max_count` are global (unfiltered) and drive share-% + bar
  widths. Supports `limit`/`offset`, `search` (alias), `count=true`.
- **`GET /v2/world_records/filter_options/`** → `{ holders: [{user_id, alias, count}], years }`
  (`fetchWorldRecordFilterOptions`). Option lists for the records-list filters —
  every WR holder (most prolific first, value = `user_id` → passed back as `user`)
  and every year a WR was set. Fetched once on page mount.
- **`GET /v2/world_records/progression/<map>`** → `WorldRecordProgressionEntry[]`
  (`fetchWorldRecordProgression`). Chronological history of every cap that set a
  new WR on that map. Powers the `WorldRecordProgressionModal` drill-down (the
  `WorldRecordHistoryTrigger` "History" button on each row).

## Avatar URLs

Discord avatars proxied at:

```
https://gateway.utbt.net/users/{userId}/avatar
```

Fallback on error: `https://cdn.discordapp.com/embed/avatars/{userId % 5}.png`.

`PlayerInfo` handles both — never write avatar `<img>` directly.

Map screenshots:

```
https://utbt.net/images/screenshots/{mapName}.png
```

Fallback: `default.png`. `MapThumbnail` handles both.

Region flags (server list):

```
https://flagcdn.com/w40/{2letterCode}.png
```

`getRegionFlag(region)` in `server-utils.ts` returns the URL.

## Map download service

External service that dynamically packages a map + its dependencies into a zip
laid out for direct extraction into a UT99 install:

```
GET https://api.utmapdownload.com/download?mapName={mapName}
```

The server caches packages — first request for a map can take many seconds while
it builds the zip. Use `downloadMapZip(mapName, timeoutMs?)` in `app/utils/api.ts`
(default 30s `AbortController` timeout). Pair with
`window.conveyor.maps.extractToInstall(mapName, bytes)` to extract into the
configured install dir without overwriting existing files.

## Electron IPC (`window.conveyor.*`)

The main process exposes APIs via a contextBridge. Type-safe wrappers are
generated from `lib/main/...`. Common usage:

| API | Purpose |
|---|---|
| `window.conveyor.game.fetchServers()` | Server list. Main process calls gateway `/server-info`; gateway proxies to DataService and returns enriched payload (each player has `alias` + `active_title`). |
| `window.conveyor.game.pingServer(ip)` | Latency measurement per IP. |
| `window.conveyor.game.launchGame(ip, port)` | Launch UT99 + auto-join server. |
| `window.conveyor.game.launchGameStandalone()` | Launch UT99 without auto-join. |
| `window.conveyor.game.isGameRunning()` | Bool — used to skip auto-refresh while in-game. |
| `window.conveyor.game.fetchPatrons()` | Patreon members. Main process calls gateway `/patreon` (public); returns `{ tier1[], tier2[], tier3[] }` of **Discord user ids**. |
| `window.conveyor.ini.readIniValue(file, section, key)` | Read from a UT99 ini file. |
| `window.conveyor.ini.writeIniValue(file, section, key, val)` | Write to a UT99 ini file. |
| `window.conveyor.app.validateCurrentInstallation()` | `{ valid, version }` for the configured UT99 install. |
| `window.conveyor.favorites.readIni()` | `{ ok, mapNames }` — favorites stored in user's `UTBT.ini`. |
| `window.conveyor.favorites.writeIni(mapNames)` | Write favorites to `UTBT.ini`. |
| `window.conveyor.maps.extractToInstall(mapName, bytes)` | Extract a map zip into the install dir without overwriting. Returns `{ ok, installPath, extracted[], skipped[] }` or `{ ok: false, reason }`. |
| `window.conveyor.demos.saveToSystem(filename, bytes)` | Save a demo file into `{install}/System`. |
| `window.utFavorites.onGameClosed(cb)` | Event — fires when the game process exits (so the launcher can re-read ini favorites). |
| `window.utPatch.onPatchInstallStatus(cb)` / `onInstallationPathUpdated(cb)` | Patch / install change events. |
| `window.auth.logout()` | Discord logout. |

Avoid sprinkling `window.conveyor.*` calls throughout the renderer. Wrap in a
hook or a thin utility if used in more than one place.

## Map favorites — dual storage

Map favorites have to stay in sync between two stores:

1. **DataService DB** — source of truth. Fetched via `fetchUserFavorites`.
2. **`UTBT.ini`** — what the game actually reads. Read/written via the
   `favorites` IPC namespace.

Sync logic lives in `Main.tsx`:
- On login: fetch DB favorites → diff against ini → if mismatch, prompt the
  user via `FavoritesSyncModal` (db-wins / ini-wins / merge).
- On toggle: optimistic update → mutate DB → mirror to ini.
- On game close: re-read ini (game may have changed favorites) → replace DB.

Don't bypass this dance — favorites toggles must go through `Main.tsx`'s
`toggleFavorite`, which already wires up persistence + rollback.

## Patreon members — cached tier lookup

Patreon supporters are flagged by a heart next to their name everywhere
`PlayerInfo` renders (and on the profile hero). Data comes from gateway
`/patreon` via `window.conveyor.game.fetchPatrons()`, which returns Discord user
ids bucketed by tier — the same id the launcher uses as `userId`, so matching is
a direct lookup (no backend change).

`app/utils/patreon.ts` owns it: a module-level store (`useSyncExternalStore`) so
all `PlayerInfo` instances share one fetch. `loadPatreonMembers()` is
single-flight and caches the id→tier map in `localStorage` under
`utbt:patreon:v1` with a 1h TTL — members rarely change, so it isn't refetched
per render. Components read it via `usePatreonTier(userId)` (returns `0|1|2|3`,
lazy-loads on first use). `Main.tsx` warm-loads it once on mount. Clear the
localStorage key to force a refetch.

## Server favorites — local only

Server favorites are launcher-local (no backend endpoint). Stored in
`localStorage` under `utbt:serverFavorites:v2`, keyed by `server.id` (NOT
hostname — hostnames can change). Managed in `Main.tsx` as `favoriteServerIds`
+ `toggleServerFavorite`.
