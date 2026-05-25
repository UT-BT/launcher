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
| Records | `fetchRecords`, `fetchRecordsCount`, `fetchAllWorldRecords`, `fetchWorldRecordsForMaps`, `fetchBestCaps`, `fetchMapLeaderboard` |
| Reviews | `fetchMapReviews`, `fetchAllMapReviews`, `submitSummaryReview` |
| Favorites | `fetchUserFavorites`, `addFavoriteMap`, `removeFavoriteMap`, `replaceFavoriteMaps` |
| Demos | `fetchDemoStatus`, `getFirstPersonVideoUrl` |
| Profile | `UserProfile` type, `getAvatarUrl(userId)` |

Most fetchers take `accessToken` first (Discord OAuth bearer).

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
| `window.conveyor.ini.readIniValue(file, section, key)` | Read from a UT99 ini file. |
| `window.conveyor.ini.writeIniValue(file, section, key, val)` | Write to a UT99 ini file. |
| `window.conveyor.app.validateCurrentInstallation()` | `{ valid, version }` for the configured UT99 install. |
| `window.conveyor.favorites.readIni()` | `{ ok, mapNames }` — favorites stored in user's `UTBT.ini`. |
| `window.conveyor.favorites.writeIni(mapNames)` | Write favorites to `UTBT.ini`. |
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

## Server favorites — local only

Server favorites are launcher-local (no backend endpoint). Stored in
`localStorage` under `utbt:serverFavorites:v2`, keyed by `server.id` (NOT
hostname — hostnames can change). Managed in `Main.tsx` as `favoriteServerIds`
+ `toggleServerFavorite`.
