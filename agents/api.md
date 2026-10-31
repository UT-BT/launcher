# API contract

The client-side contract the launcher consumes: hosts, the response envelope, the request
and normalisation helpers, errors, tokens, and the core read endpoints (caps, world
records, team runs, medal hunt), asset URLs, map download, favorites and Patreon tiers.
Read it before adding or changing a fetcher; the
[`consume-api-data` skill](../.claude/skills/consume-api-data/SKILL.md) walks the full
loop. Feature-specific endpoints live in the feature docs (table below).

## Hosts

| Constant (`app/utils/api.ts`) | Default | Override | Serves |
|---|---|---|---|
| `API_BASE_URL` | `https://api.utbt.net`, `http://localhost` in dev | `VITE_API_BASE_URL` | everything below unless noted |
| `GATEWAY_BASE_URL` | `https://gateway.utbt.net` | `VITE_GATEWAY_BASE_URL` | player avatars, `/patreon`, `/server-info`, `/replays/<capId>` |

Gateway replies are plain JSON, not the `{ success, data }` envelope.

Remote hosts are pinned in the desktop renderer CSP in `lib/main/app.ts` (`connect-src`,
`img-src`, `media-src`). A new remote host does not load on desktop until it is added
there.

## Where fetchers live

Every HTTP fetcher lives in `app/utils/api.ts`, roughly grouped by domain with each
domain's types beside its fetchers; grep the endpoint path or the type name. The
exceptions: stream-kit reads and writes sit beside their UI on the shared `apiRequest`,
and the gateway server list and Patreon list go through `app/platform/gateway.ts` (IPC on
desktop, direct fetch on web, same shape). Anything that needs the main process goes over
IPC: see [lib/conveyor/README.md](../lib/conveyor/README.md).

| Area | Contract in |
|---|---|
| Event brackets, formats, cap linking, event stats, predictions, limited-time achievements | [events.md](features/events.md) |
| Event scheduling, streamer and match-admin assignment | [event-scheduling.md](features/event-scheduling.md) |
| Pick/ban sessions, setup, public Maps tab pools, sides, hard-map veto | [pick-ban-api.md](features/pick-ban-api.md) |
| Stream kit desk and scene data | [stream-kit.md](features/stream-kit.md) |
| Admin dashboard slice, streamer roster, map video uploads | [admin.md](features/admin.md) |
| Admin → Map Uploads | [map-uploads.md](features/map-uploads.md) |
| Account state blob (`fetchUserState` / `mergeUserState`, used only by `app/utils/userState.ts`) | [state-patterns.md](state-patterns.md) |
| Sidebar "new" badges (`fetchNavBadges` / `markSectionSeen`) | [navigation.md](navigation.md) |
| Web sign-in (`/auth/discord/token`, `/auth/discord/refresh`) | [web-target.md](web-target.md) |

`fetchAuditLog` / `fetchAuditLogCount` take `actors` (`staff` / `players` / `all`);
`staff`, the default, keeps player-written rows, such as a mapper replacing their own
screenshot, out of the staff feed.

## Requests and the envelope

Build new fetchers on the helpers, not on raw `fetch` (many older fetchers still use raw
`fetch`; do not copy them):

| Helper | Use |
|---|---|
| `apiRequest(path, { token, method, body, headers, signal, timeoutMs, keepalive })` | raw `Response`; JSON-encodes `body`, adds auth headers, 20 s default timeout (rejects with a `TimeoutError`), chains your `signal` |
| `apiGet<T>(path, opts)` | unwraps `data`; throws `ApiError` on non-2xx and `Invalid response format from server` when `data` is null or missing |
| `apiGetOr<T>(path, fallback, opts)` | same, but returns `fallback` when `data` is absent |
| `apiGetList<T>(path, opts)` | returns `[]` when `data` is not an array |
| `apiUpload<T>(path, form, opts)` | `FormData` upload with progress (see [Uploads](#uploads-with-progress)) |
| `bearerHeaders(token)` | auth headers for the raw-`fetch` cases; in dev it also adds the impersonation header, so always build headers through it |

Responses use `{ success, data }`. The server may omit `data` on empty results, send
absent numerics as `""`, and send `{}` for absent nested objects. Normalise at the fetch
layer, never in components: write a `normaliseX(raw)` beside the fetcher using `asNum`,
`asStr`, `asArray`, `asStringArray` and `asNonEmptyObj` (pattern: `normaliseCapDetail` +
`fetchCapDetail`). Dates arrive in several formats; parse them with `parseApiDate` from
`app/utils/format.ts`. A title that arrives as a raw row (plain-number `rarity`) goes
through `toActiveTitle`, which clamps `rarity` to 1–5 and returns the `ActiveTitle` that
`PlayerInfo` and the title-style helpers expect (`null` for a missing title).

`/maps` list queries go through `buildMapQuery`: active maps only unless `active` is
passed, and always a `columns` list (`DEFAULT_MAP_COLUMNS` when none). Add any field the UI
shows, such as `has_screenshot` / `screenshot_updated`, to the fetch's `columns`.

When the launcher needs data the API does not expose, get the field added to the API
rather than deriving it in the renderer.

## Auth tokens

Most fetchers take `accessToken` first (the Discord OAuth bearer). Signed-out callers
pass `''` (`accessToken ?? ''`): `bearerHeaders` sends no `Authorization` header for an
empty token, and the API's public GET endpoints accept that. Mutations and "my X"
fetchers need a real token; gate the UI on `accessToken` before calling them.

## Errors

A failed request answers `{ success: false, error: "<reason>" }`. The rate limiter sends
`reason` instead of `error`, and endpoints with machine-readable failures add `code`.
`ApiError` (built by `apiErrorFor` / `apiErrorFromBody`) carries:

| Field | Value |
|---|---|
| `status` | HTTP status |
| `message` | `error`, else `reason`, else `Request failed (<status>)` |
| `serverMessage` | `error` or `reason`; `undefined` when the body had none |
| `reason` | the body's `code`; `undefined` on the plain `{ error }` shape |

Show `e.message` to the user. Branch on `e.reason` only for a specific code; each
feature doc lists the codes its endpoints send. Never read `res.statusText`: it is empty
over HTTP/2, which prod serves.

Server validation messages are the source of truth, but mirror rules the user types
against so the error shows inline: team name, clan tag and member number live in
`app/components/pages/teams/tagFormat.ts`. Keep the mirror in step with the API, or the
client rejects values the server accepts.

### Uploads with progress

`apiUpload<T>(path, form, { token, method, signal, timeoutMs, onProgress })` sends over
`XMLHttpRequest`, the one browser API that reports upload progress on both targets.

- `onProgress({ loaded, total })` fires only when `loaded` grows; `total` is `0` when the
  size is unknown.
- A 2xx is unwrapped like `apiGet`; any other status rejects with the same `ApiError`.
- Aborting `signal` rejects with a `DOMException` named `AbortError`, so a cancel can be
  told apart from a failure. A network failure rejects with a plain `Error` whose message
  the UI can show. `timeoutMs` is off by default (files are large) and rejects with a
  `TimeoutError`.

## Clan tags

The API returns aliases already tagged; the launcher never assembles the name a player
wears. A member with `tag_hidden` comes back untagged everywhere. `TeamMember.raw_alias`
is the untagged alias: compose previews from it, never from `alias`.

`formatTaggedAlias` in `tagFormat.ts` only previews an unsaved choice and mirrors the
server rule (`style`: `plain` / `numbered` / `number_only`; `position`: `prefix` /
`suffix`):

```
no tag                -> alias
unit = tag + number   when style != 'plain' and a number is assigned, else tag
sep  = ' ' if tag_spaced else ''
style 'number_only'   -> unit when numbered, else alias
position 'suffix'     -> alias + sep + unit
position 'prefix'     -> unit + sep + alias
```

## Teams directory

`fetchTeams` (`/teams/`) rows carry a `stats` block (`caps`, `world_records`,
`playtime_seconds`, `spectator_seconds`, plus `ranks` per metric) totalled over the
team's active members. `sort` accepts `world_records` / `caps` / `playtime` on top of
`added` / `name` / `members`; pass `limit: 0` for the whole directory (the gallery is
unpaginated).

- Ranks are directory-wide: searching or filtering never renumbers them. `ranked_teams`
  is the "of N". Ties share a rank.
- A team on zero for a metric still comes back ranked; the UI drops the rank chip when
  the metric total is zero.
- Rows carry `owner_alias` + `owner_title`: render the owner from the row, never with a
  profile request per card.
- Team settings and member mutations return the fresh `TeamDetail`. `fetchTeamActivity` returns the same
  totals and ranks for one team alongside its feed.

## Events

An event is addressed by its `slug`. `fetchMyTournaments` (`/me/tournaments`) lists every
tournament the caller has a team membership in, each row
`{ tournament, team, membership_status, pick_ban_session }` (`pick_ban_session` is the
same `MyPickBanSession | null` as on the event `me` payload). It is the cross-event
"which team is mine" lookup; schedule entries do not carry it.

## Caps

### Cap detail

`GET /caps/<cap_id>/detail` → `CapDetail` (`fetchCapDetail`, `null` on any failure): the
full `cap` record, parsed `checkpoints` and `wr_checkpoints` (`{ zone, cumulative,
segment }`), `rank_on_map` / `total_on_map`, `neighbors` (`above` / `below`), `deltas`
and `medals` (WR and each medal threshold; a negative delta is faster than the
threshold), `server` `{ name, region }`, and `compare_candidates`. The Cap Detail page
defaults the comparison to the candidate nearest in time and loads the compared run with
`fetchCapCheckpoints` (a cap-detail read of the other cap).

Team caps have their own read: `GET /caps/team_caps/<id>/detail` → `TeamCapDetail`
(`fetchTeamCapDetail`, used by `TeamCapDetailPage`).

### A player's summary

`GET /v2/summary/user/<id>` → `UserSummary` (`fetchUserSummary`): `profile`, `medals`,
`counts`, `capItAll`, `recentCaps` and `recentWrs`, with `medals` and `counts` zero-filled
when absent. `capItAll` is `{ rank, team_caps }`: the rank the Cap It All leaderboard shows
for the player (tied players share it, `null` when unranked) and the team maps capped. It is
`null` when the response carries no such object, or when `rank` is neither `null` nor a
positive integer or `team_caps` is not a non-negative integer. Read a player's Cap It All rank
from here, never by searching the leaderboard. Home's tiles: [home.md](features/home.md).

### A player's caps

`fetchCapsForUser` (`/v2/summary/user/<id>/caps`) takes `capFilter`
(`all` / `verified` / `certified` / `casual` / `disallowed`). With `disallowed`, each row
carries `disallowed_at` + `disallow_reason`, sortable with `sort: 'disallowed_at'`.
`UserSummaryCounts.disallowed_caps` is the matching total; the profile's Disallowed tab
hides when it is zero.

### Demos and replay videos

- `uploadDemo` throws `ApiError` with the status and the server's reason. `422` means
  refused for good (for example a world-record demo sent more than 24 hours after the
  run): the demo watcher marks it rejected instead of retrying.
- `fetchReplayVideo(capId)` → gateway `GET /replays/<capId>` → `ReplayVideo`
  `{ source, mp4_url, view_url, fps }`, or `null` when there is no video yet (or the
  read fails). The gateway picks the source: UTRecorder first, democonverter.com for
  older caps. Play `mp4_url`; share `view_url ?? mp4_url` (`view_url` is a UTRecorder
  page that previews in Discord). `view_url` and `fps` are `null` for democonverter.com.
  The comparison view steps frames at the lowest `fps` of its runs, 30 when unknown.
  Credit the source with `ReplaySourceCredit`.

## World records

`GET /v2/world_records/` → `Record[]`, one row per map (the WR), each with `active_title`
and the map's `difficulty`. Query parameters:

| Param | Meaning |
|---|---|
| `limit` / `offset` | paging; `limit` is clamped to 1–200 |
| `sort`, `sort_by` | `asc` / `desc`; `added` / `time` / `map` / `holder` / `difficulty` |
| `search` | matches map name or holder alias |
| `user` / `users` | single holder / CSV of holder ids |
| `difficulties`, `years` | CSV `IN` filters |
| `difficulty_min` / `difficulty_max` | difficulty range |
| `time_ranges` | CSV of `min-max` cap-second bands, OR'd |
| `map` / `maps` | fuzzy name / CSV of exact names (the favorites filter sends `maps`) |
| `added_since` | the timeframe filter |
| `count=true` | answers `{ count }` instead of rows |

The World Records page paginates server-side: `fetchWorldRecords` for the page,
`fetchWorldRecordsCount` for the total.

- `GET /v2/world_records/rushers/` → `{ total, total_records, max_count, items }`
  (`fetchRushers`; no separate count call). Per-player WR count, median and average
  time, computed server-side. `total_records` and `max_count` are global (unfiltered)
  and drive the share % and bar widths. Takes `limit` / `offset` / `search`.
- `GET /v2/world_records/filter_options/` → `{ holders: [{ user_id, alias, count }],
  years }`: every WR holder (most prolific first) and every year a WR was set. A holder's
  `user_id` goes back in `users`.
- `GET /v2/world_records/progression/<map>` → `WorldRecordProgressionEntry[]`: every cap
  that set a new WR on that map, oldest first.

## Team maps and team runs

A map's `required_players` (1–12) is authoritative: `1` is a solo map, more is a team
map. Never infer team size from the map name.

A team run is one squad's shared attempt. Its time is the slowest member's time, and it
is verified only once every member has uploaded their demo. For each member combination
the leaderboard shows its fastest verified run, plus a certified run only when that is
faster than the verified one (or the combination has no verified run).

- `GET /caps/leaderboard/team/map/<map>` → `TeamLeaderboardEntry[]`
  (`fetchTeamMapLeaderboard`), one row per member combination. `cap_time_seconds` is the
  team time, `user` is the `;`-joined member ids, and `members[]` holds each member's own
  cap. Options: `verified_limit`, `unverified_limit`, `member` (one member id), `before`
  (pagination cursor), `columns`.
- `GET /caps/team_runs/<team_run_id>` → `TeamRunStatus` (`fetchTeamRunStatus`): state,
  team time, members and the `is_combination_best_*` / `is_world_record` flags, for a
  run's per-member breakdown on Cap Detail.
- `/caps` rows and the Cap Detail `cap` carry `team_run_id` (`string | null`). The demo
  watcher reads it with `/caps?btpog_ids=<id>&columns=cap_type,team_run_id` to route a
  demo to the team or solo upload path.

## Medal hunt

`GET /v2/summary/medal_hunt` (`fetchMedalHunt`) takes no params; the bearer identifies
the caller. It answers "which medals can I still win", pre-joined and pre-filtered:
certified best caps on active maps that still have an unreached medal threshold.

- The response is `{ opportunities: [...] }` so the zero case still carries the key;
  `fetchMedalHunt` returns `[]` for any non-array payload.
- Rows are unsorted; the card owns all filtering, sorting and paging client-side.
- `worldRecordAdded` has no UTC offset, so `new Date()` parses it as local time;
  `parseDateTime` in `app/utils/medalHunt.ts` turns it into the `worldRecordAddedTime`
  epoch for the "recently lost" sort (`0` when absent or unparseable). It is always
  `null` for team maps.
- `difficulty` arrives as `""` when a map has none, despite the `number` type.
- The medal ladder (which medal is targeted, the improvement epsilon) is server-side.
  `app/utils/medalHunt.fixture.json` pins the contract; the same fixture is asserted
  against the API's implementation, so a divergence fails a test.

## Asset URLs

Build every asset URL through its helper so it stays on the right host; never copy a
`url` field from a payload.

### Player avatars

`getAvatarUrl(userId, size?)` → `{GATEWAY_BASE_URL}/users/{userId}/avatar?size=`, with
`avatarSizeFor(displayPx)` picking the CDN size bucket. The fallback on error is
`https://cdn.discordapp.com/embed/avatars/{userId % 5}.png`. `PlayerInfo` handles both;
render players through it.

### Team crests

`teamAvatarUrl(team)` → `{API_BASE_URL}/teams/{id}/avatar?v={avatar_updated}`, or `null`
when `has_avatar` is false. `TeamAvatar` renders it with an initials fallback. A crest is
not a player avatar, so the `PlayerInfo` rule does not apply.

### Map screenshots

`MapThumbnail` (helpers in `app/utils/mapScreenshots.ts`) walks a fallback chain on
error: the derived WebP for its `size` (`/screenshots/derived/{px}/{map}.webp`, `thumb`
96 / `card` 256 / `hero` 1024 px), then the canonical `/screenshots/{map}.png`, then
`/screenshots/default.png`, all on `API_BASE_URL`. Pass `version` (the map's
`screenshot_updated`) as a `?v=` cache buster wherever you have it: the API serves
screenshots `Cache-Control: no-cache`, so a replacement shows up anyway, but `version`
makes the swap instant. `priority` loads eagerly with high fetch priority.

Stored screenshots are always square. On a non-square box, avoid a second centre-crop:
pass `fit="blend"` (contains the square and fills the rest with a blurred 96 px copy, as
the map hero does) or make the box `aspect-square` (the homepage poster grid, where a
blur per tile would break the CSS runtime budget).

### Changing a map screenshot

`uploadOwnMapScreenshot` (`POST /maps/{mapName}/screenshot`) is the only upload path, for
mappers and staff alike; the admin dashboard uses it too. `deleteMapScreenshot` is in the
staff slice; mappers have no delete.

The API authorizes the upload: the caller must be the map's linked `author_ref` (a
matching `author_str` grants nothing) and the map must be active, else 403; staff bypass
both. The renderer mirrors that check only to decide whether to show the control
(`MapDetailPage`, `AuthoredMapsCard`, `MapsManagementSection`).

`MapScreenshotModal` is the one crop UI; its rules live in
`app/components/modals/mapScreenshotCrop.ts`.

- It crops client-side (drag to pan, slider to zoom) and exports a square PNG of at most
  1024 px. Zoom is capped so the crop never falls below the API's 256 px minimum; the
  API centre-crops anything that arrives uncropped.
- Crop maths use the frame's measured width, not its 320 px maximum, so a narrow phone
  exports the region it shows. The measurement is keyed on `open`, because
  `ui/modal.tsx` renders nothing while closed and a mount-only observer would never see
  the element.
- Upload mode (`accessToken`, `hasScreenshot`, `onUploaded`): `onUploaded` hands back the
  updated map so the caller can refresh `has_screenshot` + `screenshot_updated` in
  place.
- Callback mode (`onCropped(image, filename)`, optional `previewUrl`): the modal awaits
  the callback, shows its error if it throws and closes when it resolves, so the caller
  can stage the image somewhere other than an existing map.

### Map fly-through videos

`mapVideoUrl(mapName, version?)` in `app/utils/mapScreenshots.ts` →
`{API_BASE_URL}/videos/{map}.webm`, with `?v={version}` only when `version` is set.
`version` is the map's `video_updated_at` (or the version the next-map read reports) and
is only a cache buster. The video supports range requests.

### Region flags

`getRegionFlag(region)` in `app/utils/server-utils.ts` →
`https://flagcdn.com/w40/{code}.png` (unknown regions map to `aq`).

## Map download

`downloadMapZip(mapName, timeoutMs = 30_000)` fetches
`https://api.utmapdownload.com/download?mapName={map}`, an external service that
packages a map and its dependencies into a zip laid out for a UT99 install. The first
request for a map can take many seconds while the service builds the zip. It throws
`http-<status>` on a non-2xx and an `AbortError` on timeout.

Use the `useMapDownload()` hook, which pairs it with `saveMapZip` from `app/platform`:
desktop extracts into the configured install and skips files that already exist
(reported as `skipped`), web hands the zip to the browser as a download.

## Favorites

Map and server favorites are separate account resources on the API with different sync
models. Neither lives in the synced localStorage store.

### Map favorites: backend + ini

The backend (`/user_favorite_maps/`) is the source of truth; the game reads
`System/UTBT_MapVote.ini` in the install, written through the `favorites` IPC namespace
on desktop only (`capabilities.ini`). `app/hooks/useFavorites.ts` owns the sync and
`Main.tsx` exposes it:

- Sign-in: fetch the backend list; on desktop read the ini once and, if the sets differ,
  open `FavoritesSyncModal` (`db-wins` / `ini-wins` / `merge`).
- Toggle: optimistic update, backend write, then a best-effort ini write. A backend
  failure rolls back to the previous list; an ini failure is ignored.
- Game close (`window.utFavorites.onGameClosed`): re-read the ini and replace the
  backend list, so edits made in game land. An empty ini is ignored while the launcher
  still has favorites.

Route every change through `toggleFavoriteOrLogin` from `Main.tsx` (signed out it opens
the sign-in modal); calling `addFavoriteMap` / `removeFavoriteMap` directly desyncs the
ini and local state. `fetchUserFavorites(token, userId?)` reads any player's list and
returns `[]` on failure.

### Server favorites: account resource only

Server favorites follow the signed-in account across desktop and web with no local tier.
Fetchers: `fetchUserFavoriteServers` / `addFavoriteServer` / `removeFavoriteServer`
against `/user_favorite_servers/`. `app/hooks/useServerFavorites.ts` owns the set;
`Main.tsx` exposes `favoriteServerIds`, `favoriteServersLoadFailed` and
`toggleServerFavoriteOrLogin`.

Two rules keep the launcher from deleting a favorite the user still wants:

- Toggles serialise per server id: a second click waits for the first write, so a double
  click resolves to one net state instead of racing a POST against a DELETE. A failed
  write is undone by reversing that one operation against the live set, never by
  restoring a snapshot, which would wipe another server's successful toggle.
- A failed read is not an empty list: `fetchUserFavoriteServers` throws on non-OK, the
  hook raises `favoritesLoadFailed`, and Home's card says so instead of showing the "no
  favorites" state with every star dark.

Key by the server's API `id` (`Server.id` from `fetchGatewayServers()`), never a hostname
or `ip:port`: those change, and the API rejects anything that is not a resolved server
id. `normaliseGatewayServers` falls back to `ip:port` or the hostname only when the
gateway row has no `id`.

Signed out the set is empty and the star opens the sign-in modal. Home shows only
favorites present in the current live server list, so an unlisted favorite is absent
rather than a stale row. Join and spectate are desktop-only (`capabilities.game`).

## Patreon tiers

Patreon supporters get a heart wherever `PlayerInfo` renders and on the profile hero.
`fetchGatewayPatrons()` (gateway `/patreon`) returns Discord user ids bucketed as
`{ tier1, tier2, tier3 }`; the id is the launcher's `userId`, so matching is a direct
lookup.

`app/utils/patreon.ts` holds one module-level store (`useSyncExternalStore`) so every
`PlayerInfo` shares one fetch. `loadPatreonMembers()` is single-flight and caches the
id → tier map in localStorage under `utbt:patreon:v1` for 1 h; on a failed fetch it falls
back to a stale cache. Read a tier with `usePatreonTier(userId)` (`0`–`3`, lazy-loads on
first use); `Main.tsx` warm-loads on mount. Clear the key to force a refetch.
`getPatreonMembers()` lists every member as `{ id, tier }` once loaded (the update
splash draws from it).
