---
doc: web-target
read_when:
  - "making a feature work (or hide) on the web build"
  - "touching app/platform/, the web entry, or web build config"
  - "adding a desktop-only capability or a web fallback"
keywords: [web, browser, platform, capabilities, IS_WEB, vite, dist-web, dual-target]
provides: "the web build target: platform layer, capability gates, per-bridge web behavior, build commands"
not_here:
  - "IPC channel contract → lib/conveyor/README.md"
  - "build commands reference → agents/build.md"
sections: [overview, platform-layer, capability-gates, build, hosting-note]
last_verified: 2026-07-22
verify_against:
  - app/platform/index.ts
  - app/platform/capabilities.ts
  - app/platform/auth.ts
  - app/platform/gateway.ts
  - app/platform/downloads.ts
  - app/platform/web/auth-web.ts
  - app/renderer.tsx
  - app/renderer-web.tsx
  - vite.config.web.ts
---

# Web target

The renderer in `app/` ships as TWO artifacts from one codebase: the Electron
desktop app (unchanged) and a static website (`dist-web/`). The desktop shell,
IPC bridges, and installer are untouched — the web build simply never mounts
desktop-only UI and swaps a handful of bridge calls for browser equivalents.

## Platform layer (`app/platform/`)

- `target.ts` — `IS_WEB`, driven by the compile-time define `__WEB_TARGET__`
  (`'true'` in `vite.config.web.ts`, `'false'` in `electron.vite.config.ts`).
  Build-time, not runtime sniffing: each artifact is deterministic and the dead
  branch is tree-shaken. Never check `window.conveyor` presence to detect web.
- `capabilities.ts` — boolean flags (`game, ping, ini, install, updater,
  desktopFiles, windowChrome, settingsModal, anonymousBrowse`). All desktop-only
  ones are `true` on desktop / `false` on web; `anonymousBrowse` is the inverse
  (web only). Gate UI with these, not with `IS_WEB` directly, so a future
  capability split stays one-line.
- `index.ts` — `usePlatform()` hook returning `{ isWeb, capabilities, auth,
  gateway, external, downloads }`; non-component modules import the named
  exports directly.
- `auth.ts` — `PlatformAuth` seam (`login/logout/getProfile/consumeLoginError`).
  Desktop passes through `window.auth`; web uses `web/auth-web.ts`.
- `gateway.ts` — `fetchGatewayServers()` / `fetchGatewayPatrons()`: desktop goes
  through `window.conveyor.game.*`; web fetches the gateway (`/server-info`,
  `/patreon`) directly.
- `external.ts` — `openExternal(url)`: conveyor on desktop, `window.open`
  (noopener) on web.
- `downloads.ts` — demo/map saves: desktop writes into the game install; web
  triggers a plain browser download of the same bytes.

## Capability gates (where web hides/changes behavior)

| Feature | Web behavior | Gate |
|---|---|---|
| Launch/join/spectate, isGameRunning | hidden | `capabilities.game` in `AppLayout`, `Home`, `ServerBrowserPage`, `RecentServersCard` |
| Ping column / server pings | hidden/skipped | `capabilities.ping` (ServerBrowserPage `displayColumnOrder`, RecentServersCard) |
| Settings modal + all ini panels | never mounted | `capabilities.settingsModal` in `AppLayout` |
| Install banner / patches | off — `validateInstallation` early-returns | `capabilities.install` in `Main.tsx` |
| Favorites ini side-sync | skipped; DB favorites unchanged | `capabilities.ini` in `useFavorites` |
| Self-updater | provider inert, UI renders nothing | `capabilities.updater` in `useUpdater` |
| Demo/map downloads | browser download | `app/platform/downloads.ts` |
| File logging | console fallback (warn/error) | `use-logger.ts` |
| Titlebar / window controls / zoom | not mounted (web entry skips `WindowContextProvider`) | `app/renderer-web.tsx` |
| Launcher telemetry (`logLauncherStartup`) | skipped | `IS_WEB` in `app/utils/api.ts` |

Event bridges (`utInstall`, `utPatch`, `utProfile`, `utFavorites`,
`utbtUpdater`, `uiScale`) are optional-chained everywhere and simply never fire
on web.

## Web auth (Discord login in the browser)

`app/platform/web/auth-web.ts` implements the PKCE authorization-code flow:

1. `login()` generates a PKCE verifier + S256 challenge and a CSRF `state`,
   stashes `{verifier, state, returnTo}` in sessionStorage
   (`utbt:webAuthFlow:v1`), and redirects to Discord's authorize page with
   `redirect_uri = <origin>/auth/callback` and scope `identify`.
2. `app/renderer-web.tsx` consumes `/auth/callback` BEFORE React mounts:
   verifies `state`, POSTs `{code, code_verifier, redirect_uri}` to the API's
   `POST /auth/discord/token`, stores the resulting profile+tokens in
   localStorage (`utbt:webAuth:v1`), and `replaceState`s back to `returnTo`.
3. `getProfile()` mirrors the desktop refresh model: single-flight
   `POST /auth/discord/refresh` when within 5 min of expiry, stale-on-failure.
4. Tokens are raw Discord bearers, so every existing `app/utils/api.ts` fetcher
   works unchanged once the profile is in React state.

Client-side API contract: `POST /auth/discord/token`
(`{code, code_verifier, redirect_uri}` →
`{access_token, token_type, expires_in, refresh_token, scope, user:{id,
username, avatar}}`) and `POST /auth/discord/refresh` (`{refresh_token}` → same
minus `user`). Errors are `{success:false, error:"invalid_request"|"invalid_grant"}`.
The Discord app must list `<origin>/auth/callback` as a redirect URI
(`http://localhost:5174/auth/callback` for dev).

Accepted risk (documented on purpose): tokens live in localStorage and are
XSS-readable; the scope is `identify` only.

## Anonymous browsing

The web build never shows a login wall. `app.tsx` sends a logged-out web visitor
to `main` with `userProfile = undefined`; `AppLayout` renders a "Login with
Discord" button in the user slot instead of the profile chip. Data pages fetch
public data with `ANONYMOUS_TOKEN` (from `app/utils/api.ts`) — a sentinel that
`apiRequest` strips so no Authorization header is sent; the API allows anonymous
reads on the public GET surface. Personal UI (favorites toggles, my-team panels,
medal hunt, pending reviews, achievements page content, admin) stays gated on a
real `accessToken`.

## Shareable URLs

Web-only URL sync mirrors the in-memory nav stack into the History API — the
path scheme and the popstate model live in `agents/navigation.md`
(`url-sync-web-build`). Deep links cold-load into the right view; a deep link
followed while logged out survives the OAuth redirect via the flow stash's
`returnTo`.

## Build

| Command | Purpose |
|---|---|
| `npm run dev:web` | Web dev server at `http://localhost:5174`. |
| `npm run build:web` | Static production build into `dist-web/`. |
| `npm run preview:web` | Serve the production build locally. |

`app/renderer.tsx` is a dispatcher that dynamic-imports `renderer-desktop.tsx`
or `renderer-web.tsx` based on `__WEB_TARGET__`; Rollup drops the unused branch
per target. One `app/index.html` serves both. `electron-builder.yml` excludes
`dist-web/**` and `vite.config.web.ts` from the packaged app.

## Hosting note

The web build is a SPA. Any future static host must rewrite unknown paths to
`/index.html` (Vite dev/preview already do this). Hosting/deploy is not wired
up in this repo.
