---
doc: data-sources
read_when:
  - "fetching data from the API (maps, records, players, caps, reviews, favorites)"
  - "adding or changing a helper in app/utils/api.ts"
  - "needing an avatar, map screenshot, region flag, or map-download URL"
  - "wiring map/server favorites or Patreon tier lookups"
keywords: [api.ts, fetch, endpoint, accessToken, avatar, MapThumbnail, favorites, patreon, downloadMapZip, world_records, caps]
provides: "the client-side API contract the launcher consumes + asset URLs + favorites/patreon sync models"
not_here:
  - "IPC channels (window.conveyor.*) → lib/conveyor/README.md"
  - "how UI state persists in localStorage → state-patterns.md"
  - "the procedure to wire a new endpoint into the UI → skill: consume-api-data"
sections: [backend-api, admin-api, cap-detail-page-endpoints, world-records-page-endpoints, team-maps-and-team-runs, avatar-urls, map-download-service, map-favorites-dual-storage, patreon-members, server-favorites]
last_verified: 2026-07-15
verify_against: [app/utils/api.ts, app/utils/patreon.ts, app/utils/server-utils.ts]
---

# Data sources

## Backend API

The launcher reads its data over HTTPS from `https://api.utbt.net` (prod) or
`http://localhost:5000` (dev). All HTTP helpers live in `app/utils/api.ts` —
don't hand-roll `fetch` calls in components.

Responses use a `{ success, data }` envelope; the helpers unwrap it for you.
When a launcher need exceeds what the API exposes, get the field added to the
API rather than working around it in the renderer (the
[`consume-api-data` skill](../.claude/skills/consume-api-data/SKILL.md) walks the
full loop).

### Helpers in `app/utils/api.ts`

| Category | Functions |
|---|---|
| Maps | `fetchMaps`, `fetchMapsCount`, `fetchMapsMetadata`, `fetchMapsFuzzy`, `fetchMapAuthors`, `buildMapQuery` |
| Records | `fetchWorldRecords`, `fetchWorldRecordsCount`, `fetchRushers`, `fetchRecordsCount`, `fetchWorldRecordsForMaps`, `fetchWorldRecordProgression`, `fetchBestCaps`, `fetchMapLeaderboard` |
| Team runs | `fetchTeamMapLeaderboard`, `fetchTeamRunStatus` (→ [Team maps & team runs](#team-maps-and-team-runs)) |
| Per-map per-user counts | `fetchUserCapCountForMap` |
| Players | `fetchPlayers`, `fetchPlayersCount` (→ `/v2/players`, server-side alias search/sort/pagination + medals; row type `PlayerListRow`) |
| Reviews | `fetchMapReviews`, `fetchAllMapReviews`, `submitSummaryReview` |
| Favorites | `fetchUserFavorites`, `addFavoriteMap`, `removeFavoriteMap`, `replaceFavoriteMaps` |
| Demos | `fetchDemoStatus`, `getFirstPersonVideoUrl`, `downloadDemo` |
| Cap detail | `fetchCapDetail`, `fetchCapCheckpoints` |
| Achievements | `fetchMyAchievements`, `fetchAchievementDefinitions` |
| Home / summary | `fetchSummary` (homepage feed), `fetchHotMaps` (→ `GET /v2/summary/hot_maps` → `HotMap[]`), `fetchPendingReviews` |
| Profile | `UserProfile` type, `getAvatarUrl(userId)`, `toActiveTitle` |
| Admin (staff-only) | the moderator/admin dashboard slice — see [Admin API](#admin-api) |

Most fetchers take `accessToken` first (Discord OAuth bearer).

The player-detail caps list (`fetchCapsForUser`, `UserCapRow`) accepts
`capFilter: 'disallowed'` to return only that player's disallowed caps — each row
then carries `disallowed_at` + `disallow_reason`, sortable via `sort: 'disallowed_at'`.
`UserSummaryCounts.disallowed_caps` is the matching total (powers the public
"Disallowed" profile tab, hidden when zero).

### Admin API

The admin page (`app/components/pages/admin/`) calls a staff-gated slice of
`api.ts`. The server authorizes every endpoint (moderator+) and audit-logs the
mutations; the client role checks (`isStaff` in `app/utils/roles.ts`) are UX
only — never the security boundary. Fetchers grouped by dashboard section:

| Area | Functions |
|---|---|
| Overview | `fetchAdminOverview`, `fetchAdminActivity` |
| Users | `fetchAdminUsers`, `fetchAdminUsersCount`, `fetchAdminUser`, `warnUser`, `banUser`, `unbanUser`, `assignTitleToUser` |
| Titles | `fetchAdminTitles`, `fetchTitleHolders`, `createTitle`, `updateTitle`, `deleteTitle`, `unassignTitleFromUser` |
| Caps | `fetchAdminCaps`, `fetchAdminCapsCount`, `disallowCap`, `reallowCap`, `verifyCapFlag`, `unverifyCap`, `verifyCapWithDemo` |
| Maps | `fetchAdminMaps`, `fetchAdminMapsCount`, `fetchAdminMapTags`, `createMap`, `updateMap`, `fetchDifficultySyncPreview`, `applyDifficultySync`, `fetchMapvoteStatus`, `setMapvoteAnnouncement`, `regenerateMapvote` |
| Map authors | `fetchMapAuthorStrings(+Count)`, `fetchLinkedMapAuthors`, `fetchMapAuthorCandidates`, `fetchMapAuthorPreview`, `linkMapAuthor`, `unlinkMapAuthor` |
| Patches | `fetchAdminPatches`, `createPatch`, `updatePatch`, `setPatchActive`, `deletePatch`, `derivePatch` |
| Anti-cheat | `fetchAcShared(+Count)`, `fetchAcCapDelta(+Count)`, `fetchAcLowFpsWr(+Count)`, `fetchAcIdentifier`, `fetchAcCapStats`, `fetchAcCapMapComparison`, `allowCap`, `unallowCap` |
| Audit | `fetchAuditLog`, `fetchAuditLogCount`, `rollbackAudit` |

`toActiveTitle(row)` normalizes an admin/title-shaped row (plain-number `rarity`)
into the `ActiveTitle` that `PlayerInfo` and the title-style helpers expect.

The map-author fetchers back `MapAuthorsModal` (opened from the Maps section). A map
credited to a plain name (`author_str`) scores for nobody; linking it to a player
(`author_ref`) is what makes that player's mapper achievements count. Every author
name goes through `encodeURIComponent` — the real data contains `&`, `/` and `.`.
`linkMapAuthor` sends `expectedMaps` from exactly the list the preview rendered, and
the server returns 409 if that set has changed since, so a stale preview can never
re-credit maps the admin did not see. `Map.author_ref` is a **string**, not a number:
it is a Discord id large enough to lose precision as a JS number.

### Cap Detail page endpoints

The Cap Detail page (`app/components/pages/CapDetailPage.tsx`, opened by clicking
any cap time — see `CapTimeLink` / the `open-cap` event in `agents/navigation.md`).

- **`GET /caps/<cap_id>/detail`** → `CapDetail`. Enriched single cap: the full
  `cap` record (movement/client fields) + parsed `checkpoints` and
  `wr_checkpoints` (`{zone, cumulative, segment}`) + `rank_on_map` /
  `total_on_map` / `neighbors` (above/below) + `deltas` & `medals` (WR + each
  medal threshold) + `server` `{name, region}`. Negative delta = faster than the
  threshold. Used for both the page and the compare-run overlay
  (`fetchCapCheckpoints`).

Compare-run picker reuses `fetchMapLeaderboard` (`/caps/leaderboard/map/<name>`).

### World Records page endpoints

The World Records page (`app/components/pages/WorldRecordsPage.tsx`) shows the
fastest cap on every map.

- **`GET /v2/world_records/`** → `Record[]`. One row per map (the WR). Supports
  `limit`/`offset` (limit clamped 1–200), `sort` (`asc`/`desc`), `sort_by`
  (`added`/`time`/`map`/`holder`/`difficulty`), `search` (matches map **or**
  player alias), `difficulty_min`/`difficulty_max`, `user` (single holder — used
  by the player-detail WR card), `users`/`difficulties`/`years` (CSV `IN`),
  `time_ranges` (CSV of `min-max` cap-second bands, OR'd), `map` (fuzzy), `maps`
  (CSV exact), `added_since`, and `count=true`. Each row carries **`active_title`**
  (selected title) and map **`difficulty`**. The page paginates **server-side**,
  one page at a time, mirroring `PlayersPage` — `fetchWorldRecords` for the page +
  `fetchWorldRecordsCount` (`count=true`) for the total, with a per-page cache +
  neighbour prefetch. Search / difficulty / timeframe / favorites are pushed to
  the query (favorites → `maps` CSV; timeframe → `added_since`).
- **`GET /v2/world_records/rushers/`** → `{ total, total_records, max_count, items }`
  (`fetchRushers`; its response envelope already carries `total` / `total_records`
  / `max_count`, so no separate count call). Per-player WR aggregation (count, median,
  average WR time) computed server-side. Powers the page's "Top Rushers" mode;
  `total_records` + `max_count` are global (unfiltered) and drive share-% + bar
  widths. Supports `limit`/`offset`, `search` (alias), `count=true`.
- **`GET /v2/world_records/filter_options/`** → `{ holders: [{user_id, alias, count}], years }`
  (`fetchWorldRecordFilterOptions`). Option lists for the records-list filters —
  every WR holder (most prolific first, value = `user_id` → passed back as `user`)
  and every year a WR was set. Fetched once on page mount.
- **`GET /v2/world_records/progression/<map>`** → `WorldRecordProgressionEntry[]`
  (`fetchWorldRecordProgression`). Chronological history of every cap that set a
  new WR on that map. Powers the `WorldRecordProgressionModal` drill-down.

## Team maps & team runs

Some maps are **team maps**, capped by a fixed-size squad rather than a single
player. `/maps*` rows carry the authoritative **`required_players`** value
(`number`, 1–12). A value of `1` is a solo map; values above `1` are team maps.
Map names are not used to infer team size.

A **team run** is one squad's shared attempt. Its time is the **slowest member's**
time; it counts as **verified** only once **every** member has uploaded their
demo. For each unique member combination, the leaderboard shows its fastest
verified run and shows a certified run only when it is faster than that verified
run (or the roster has no verified run).

- **`GET /caps/leaderboard/team/map/<map>`** → `TeamLeaderboardEntry[]`
  (`fetchTeamMapLeaderboard`). One row per member combination:
  `{ id, map, added, cap_time_seconds (team time), complete, verified, disallowed,
  state, team_size, user
  (';'-joined member ids), medal, members }`, where each `members[]` entry is
  `{ user, alias, cap_id, cap_time_seconds, verified }`. Options →
  `verified_limit`, `unverified_limit`, `member` (single member id), `before`
  (pagination cursor), `columns`.
- **`GET /caps/team_runs/<team_run_id>`** → `TeamRunStatus`
  (`fetchTeamRunStatus`): `{ complete, team_time_seconds, team_cap_id, members,
  is_combination_best_verified, is_combination_best_unverified, is_world_record }`.
  Used to render a run's per-member breakdown and to gate what the demo watcher
  auto-uploads for team maps.
- A cap may belong to a team run: `/caps` rows and the Cap Detail `cap`
  (`/caps/<id>/detail`) carry **`team_run_id`** (`string | null`), and
  `GET /caps?btpog_ids=<id>&columns=cap_type,team_run_id` returns it alongside
  `cap_type`.

## Avatar URLs

Discord avatars are served at:

```
https://gateway.utbt.net/users/{userId}/avatar
```

Fallback on error: `https://cdn.discordapp.com/embed/avatars/{userId % 5}.png`.
`PlayerInfo` handles both — never write an avatar `<img>` directly.

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

> Allowed remote hosts are pinned in the renderer CSP (`lib/main/app.ts`
> `connect-src` / `img-src` / `media-src`). A new remote host won't load until
> it's added there.

## Map download service

External service that packages a map + its dependencies into a zip laid out for
direct extraction into a UT99 install:

```
GET https://api.utmapdownload.com/download?mapName={mapName}
```

The service caches packages — the first request for a map can take many seconds
while it builds the zip. Use `downloadMapZip(mapName, timeoutMs?)` in
`app/utils/api.ts` (default 30s `AbortController` timeout). Pair with
`window.conveyor.maps.extractToInstall(mapName, bytes)` to extract into the
configured install dir without overwriting existing files.

## IPC (`window.conveyor.*`)

Server lists, patrons, game launch, ini read/write, and map/demo file writes go
through the main process over a typed IPC bridge, not over HTTP from the
renderer. The full channel inventory + how to add one lives in
[`lib/conveyor/README.md`](../lib/conveyor/README.md). Don't sprinkle
`window.conveyor.*` calls through the renderer — wrap them in a hook or thin
utility if used in more than one place.

## Map favorites — dual storage

Map favorites stay in sync between two stores:

1. **The backend** — source of truth. Fetched via `fetchUserFavorites`.
2. **`UTBT.ini`** — what the game actually reads. Read/written via the
   `favorites` IPC namespace.

Sync logic lives in `Main.tsx` (via the `useFavorites` hook):

- On login: fetch favorites → diff against ini → if mismatch, prompt the user via
  `FavoritesSyncModal` (db-wins / ini-wins / merge).
- On toggle: optimistic update → write to the backend → mirror to ini.
- On game close: re-read ini (the game may have changed favorites) → replace
  backend.

Don't bypass this dance — favorites toggles must go through `Main.tsx`'s
`toggleFavorite`, which already wires persistence + rollback. See
`agents/state-patterns.md` for the persistence framing.

## Patreon members — cached tier lookup

Patreon supporters get a heart next to their name everywhere `PlayerInfo` renders
(and on the profile hero). The data comes from the gateway `/patreon` endpoint
via `window.conveyor.game.fetchPatrons()`, which returns Discord user ids bucketed
by tier — the same id the launcher uses as `userId`, so matching is a direct
lookup.

`app/utils/patreon.ts` owns it: a module-level store (`useSyncExternalStore`) so
all `PlayerInfo` instances share one fetch. `loadPatreonMembers()` is
single-flight and caches the id→tier map in `localStorage` under `utbt:patreon:v1`
with a 1h TTL — members rarely change, so it isn't refetched per render.
Components read it via `usePatreonTier(userId)` (returns `0|1|2|3`, lazy-loads on
first use). `Main.tsx` warm-loads it once on mount. Clear the localStorage key to
force a refetch.

## Server favorites — local only

Server favorites are launcher-local (no API endpoint). Stored in `localStorage`
under `utbt:serverFavorites:v2`, keyed by `server.id` (NOT hostname — hostnames
can change). Managed in `Main.tsx` as `favoriteServerIds` + `toggleServerFavorite`.
