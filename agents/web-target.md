# Web target

The renderer in `app/` ships twice from one codebase: the Electron desktop app and a
static website (`dist-web/`, served as utbt.net). Read this before making a feature work
or hide on the web build, touching `app/platform/` or the web entry, or changing what
loads on first paint. Build commands are in [build.md](build.md).

## Platform layer (`app/platform/`)

- `target.ts`: `IS_WEB`, from the compile-time define `__WEB_TARGET__` (`'true'` in
  `vite.config.web.ts`, `'false'` in `electron.vite.config.ts`). Each artifact is
  deterministic and the dead branch is tree-shaken. Detect the target only through this,
  never by checking whether `window.conveyor` exists.
- `capabilities.ts`: `game, ping, ini, install, updater, settingsModal, anonymousBrowse,
  camTool`. Every flag is `true` on desktop and `false` on web, except `settingsModal`
  (`true` on both) and `anonymousBrowse` (web only). Gate UI on a capability rather than
  `IS_WEB`, so a future split stays a one-line change.
- `index.ts`: `usePlatform()` returns `{ isWeb, capabilities, auth, gateway, external,
  downloads }`. Non-component modules import the named exports (`capabilities`, `IS_WEB`,
  `platformAuth`, `openExternal`, `fetchGatewayServers`, `saveDemoFile`, `saveMapZip`, …).
- `auth.ts`: the `PlatformAuth` seam (`login`, `logout`, `getProfile`, `consumeLoginError`,
  `recoverRejectedSession`). Desktop passes through `window.auth`; web uses
  `web/auth-web.ts`.
- `gateway.ts`: `fetchGatewayServers()` / `fetchGatewayPatrons()`. Desktop goes through
  `window.conveyor.game.*`, web fetches the gateway's `/server-info` and `/patreon`
  directly. Both server branches run through `normaliseGatewayServers`, which fills
  defaults on partial rows and drops rows with no `id`, `ip` or `hostname`, so pages always
  get a typed `Server[]`.
- `external.ts`: `openExternal(url)`. Desktop calls the `web-open-url` channel (main's
  `openExternalSafe`); web calls `window.open` with `noopener,noreferrer`.
- `downloads.ts`: `saveDemoFile` / `saveMapZip`. Desktop writes into the game install; web
  triggers a browser download of the same bytes.

## Capability gates

| Feature | On web | Gate |
|---|---|---|
| Launch / join / spectate, sidebar Play + Join Server | hidden | `capabilities.game` in `SidebarActions`, `ServerBrowserPage`, `FavoriteServersCard`, and in `useServerJoin` / `launchStandaloneGame` before any IPC call |
| Ping column and server pings | hidden, skipped | `capabilities.ping` in `ServerBrowserPage` (`displayColumnOrder`) and `FavoriteServersCard` |
| Settings modal | web modal with Appearance + Privacy only; game panels never fetched | `capabilities.settingsModal` + target-specific lazy modal in `AppLayout` |
| Install banner and patches | off (`validateInstallation` returns early) | `capabilities.install` in `Main.tsx` |
| Map favorites ini side-sync | skipped; account favorites unchanged | `capabilities.ini` in `useFavorites` |
| Server favorites | identical; only the card's join/spectate buttons hide | `capabilities.game` in `FavoriteServersCard` |
| Self-updater, old-install card | provider inert, UI renders nothing | `capabilities.updater` in `useUpdater`, `legacyInstall.ts` |
| Demo and map downloads | browser download | `app/platform/downloads.ts` |
| File logging | console fallback for warn/error | `window.logging` presence in `app/hooks/use-logger.ts` |
| Titlebar, window controls, zoom | not mounted (web entry has no `WindowContextProvider`) | `app/renderer-web.tsx` |
| Launcher telemetry (`logLauncherStartup`) | skipped | `IS_WEB` in `app/utils/api.ts` |
| Back/Forward/Refresh bar (`NavHistoryBar`) | not rendered; browser chrome owns history and reload, pages revalidate on mount ([navigation.md](navigation.md)) | `IS_WEB` in `NavHistoryBar.tsx` |
| Navigation triggers | real `<a href>` (new tab, copy link work); buttons on desktop | `NavLink` ([navigation.md](navigation.md)) |
| Stream tab: Cams panel, Kit card, Guide | Cams shows the Red/Blue card then a "needs the desktop launcher" notice; Kit takes a typed folder and downloads the ZIP instead of picking a folder and extracting | `capabilities.camTool` (`camsPanelView` in `events/stream/panels/camsGate.ts`, `KitSection`, `GuidePanel`) |
| Splash screen | `WebBootScreen`; `SplashScreen` is lazy and never fetched | `IS_WEB` in `app/app.tsx` |
| Login page | never shown; logged-out visitors browse anonymously | `IS_WEB` in `app/app.tsx` |

When adding a desktop-only feature, gate the mount with a capability and keep the module
behind `lazy()`. The web build may still emit the chunk, but a browser never fetches it
and the web entry does not grow. `npm run check:bundle` fails if desktop-only markers
(`electron-updater`, `utbt-launcher-updater`, `checking-installation`, `electron.vite`)
appear in any web asset.

The `window.*` event bridges ([lib/conveyor/README.md](../lib/conveyor/README.md)) do not
exist on web. Code that can mount on web optional-chains them (`window.utPatch?.on…`,
`window.uiScale?.set`) or sits behind a capability check; only desktop-only modules (the
game settings panels, `KitSection`'s desktop branch) call them directly.

## Web auth (Discord login in the browser)

`app/platform/web/auth-web.ts` runs the PKCE authorization-code flow:

1. `login()` makes a PKCE verifier, an S256 challenge and a CSRF `state`, stores
   `{verifier, state, returnTo}` in sessionStorage (`utbt:webAuthFlow:v1`) and redirects to
   Discord's authorize page with `redirect_uri = <origin>/auth/callback` and scope
   `identify`.
2. `renderer-web.tsx` awaits `handleOAuthCallbackIfPresent()` before React mounts. On
   `/auth/callback` it checks `state`, posts to `POST /auth/discord/token`, stores the
   profile and tokens in localStorage (`utbt:webAuth:v1`) and `replaceState`s to
   `returnTo` (only a same-site path that is not under `/auth/`; otherwise `/`). Errors
   become the login error. A deep link opened while logged out survives the round trip
   through `returnTo`.
3. `getProfile()` refreshes through `POST /auth/discord/refresh` once the token is within
   5 minutes of expiry, single-flight. If the refresh fails it keeps the stored token while
   it is still valid; once expired it drops the login with "Your session expired".
4. The tokens are raw Discord bearers, so every `app/utils/api.ts` fetcher works unchanged.
5. A token the API refuses at boot (`/users/me` → 401, `isRejectedSession`) never
   dead-ends the site. `app.tsx` calls `platformAuth.recoverRejectedSession()`, which
   refreshes once: success reloads the profile with the new token; a refresh refused with
   a 4xx drops `utbt:webAuth:v1` and continues logged out with
   `SESSION_EXPIRED_MESSAGE`; a 5xx or network failure keeps the stored login for the next
   visit and continues logged out with `SESSION_UNCONFIRMED_MESSAGE`
   (`web/sessionRecovery.ts`). `AppLayout` reads the message through
   `consumeLoginError()` and the sidebar's signed-out card shows it. Desktop returns
   `unrecoverable`, so a refused token there surfaces as the boot error.

Client-side contract:

- `POST /auth/discord/token` `{code, code_verifier, redirect_uri}` →
  `{access_token, token_type, expires_in, refresh_token, scope, user: {id, username,
  avatar}}`.
- `POST /auth/discord/refresh` `{refresh_token}` → the same without `user`.
- Errors are `{success: false, error: "invalid_request" | "invalid_grant"}`.
- The Discord app must list `<origin>/auth/callback` as a redirect URI
  (`http://localhost:5174/auth/callback` for `dev:web`).

Accepted risk, on purpose: tokens live in localStorage and are readable by XSS; the scope
is `identify` only.

## Anonymous browsing

The web build has no login wall. `app.tsx` sends a logged-out web visitor to `main` with
`userProfile = undefined`, and the sidebar shows a "Login with Discord" button where the
profile card goes. Signed-out data pages call the same fetchers with an empty token
(`accessToken ?? ''`), which sends no `Authorization` header, and the API allows anonymous
reads on its public GET surface; the token convention is in [api.md](api.md). Pages that
would otherwise demand a login check `capabilities.anonymousBrowse` (`Home`, `TeamsPage`). Personal UI (favorite
toggles, my-team panels, medal hunt, pending reviews, achievement progress, admin) stays
gated on a real `accessToken`.

## Pre-shell routes

`app/renderer-web.tsx` handles three path families before `App` mounts. `/auth/callback`
(above) then continues into the normal app. The two stream families never mount `App`, so
they skip the boot auth check, telemetry, the analytics consent banner and
`SeasonProvider`:

- The pick/ban stream view, `/events/:eventSlug/matches/:matchId/stream`
  (`parseStreamPath` in `app/components/navigation/matchLinks.ts`).
- The stream scene pages, `/stream/:eventSlug/:streamerId/:scene` (`parseStreamScenePath`
  in `app/components/stream/streamScenes.ts`). Scene ids, the scene list and the scene
  stylesheet are in [stream-kit.md](features/stream-kit.md).

For either stream family the entry calls `markPageNoIndex()` (`app/components/stream/noIndex.ts`,
sets `<meta name="robots" content="noindex">`, reusing an existing robots tag) and then
dynamically `import()`s its root: `events/pickban/stream/mountStreamRoot.tsx` or
`components/stream/mountStreamSceneRoot.tsx`. Each root mounts its own
`ReactDOM.createRoot` tree with `ErrorBoundary` + `ThemeProvider`, no `App`, no
`WindowContextProvider`, no login. `app/public/robots.txt` also disallows `/stream/` and
`/events/*/matches/*/stream`, and `routes.contract.test.ts` checks that.

Rules that hold the mechanism together:

- **Keep the roots dynamic.** The `import()` is what keeps each root, and everything it
  pulls in (the pick/ban visual core, the scenes), out of the entry chunk.
  `scripts/check-web-bundle.mjs` checks both roots and every
  `app/components/stream/scenes/*Scene.tsx` directly: each must have a manifest record that
  is a dynamic entry, is not in the entry's static import graph and is not
  modulepreloaded by `index.html`; each scene chunk also gets the lazy-chunk budget. The
  lookup goes through `manifestKeyOf`, which falls back to a unique name match because a
  module that another chunk also imports is emitted under an `_`-prefixed shared key. If a
  root or scene moves or is renamed, update the script rather than loosening it.
- **No route-table entry.** Stream paths have no entry in `routes.ts` or
  `route-contract.json`: `Main`'s nav stack and URL sync never see them. `pathToNav` still
  resolves a stream-view path to some other view, which is harmless because `Main` never
  renders it; `routes.contract.test.ts` (`the stream sub-route`) pins that it never
  resolves to `match-pickban`.
- **No seasonal look.** The pre-paint script in `app/index.html` re-implements the two
  stream path shapes so it can skip `data-season` on them. Change a stream path shape and
  you must update that script too.

### Pick/ban stream view

`StreamView` (`events/pickban/stream/StreamView.tsx`) needs no login, calls
`usePickBanSession` with `alwaysPoll: true` (polling contract in
[pick-ban-api.md](features/pick-ban-api.md)), and renders a fixed 1920×1080
`BroadcastStage` (`app/components/broadcast/`) scaled to the window. The broadcast layout
and the sound cues are in [pick-ban-ui.md](features/pick-ban-ui.md). The view has no
controls of its own; `mountStreamRoot` reads its URL options once:

- `sound=0` mutes (`isStreamSoundMuted` in `stream/streamSound.ts`); any other value, or
  none, plays.
- `volume=0..100` sets the volume in percent (`streamSoundVolume`). Missing or non-numeric
  values (`loud`, `60%`, empty) fall back to `DEFAULT_SOUND_VOLUME` (40%); out-of-range
  values clamp. An unknown `sounds=` param is ignored.
- `motion=0` turns animations off (`isStreamMotionOff` in
  `events/pickban/pickBanMotionPreference.ts`); the sounds keep the same timing. Without
  it the view animates even when the OS reports reduced motion, because an OBS machine
  with Windows animation effects off would otherwise show no reveals.

## Deep links and shareable URLs

On web, URL sync mirrors the in-memory nav stack into the History API and every in-app
navigation trigger is a real anchor; the path scheme, popstate model and `NavLink` live in
[navigation.md](navigation.md). Deep links cold-load into the right view, and
`renderer-web.tsx` prefetches the landing route's page chunk before React mounts.
Shareable match links (`buildMatchLinks` in `matchLinks.ts`) are covered in
[pick-ban-ui.md](features/pick-ban-ui.md); they build on `VITE_SITE_ORIGIN` (below), never
`window.location.origin`, because desktop has no usable site origin.

## Responsive layout

The renderer must work from a 360px phone to a 4K monitor on both targets. One breakpoint
governs the shell: `lg` (1024px). Content is full-width at every size, with no max-width
cap (owner decision).

- **Drawer below `lg`.** `AppLayout` turns the same single `<aside>` into an off-canvas
  drawer (CSS `max-lg:` translate, no duplicated markup), opened from a fixed top bar
  (hamburger + logo). The drawer hides the big logo block (`max-lg:hidden`) so nav items
  and the profile card fit an 800px-tall phone. Every nav action goes through
  `changeView`, which closes the drawer.
- **Rail at `lg` and up.** The sidebar sits beside the content, expanded (16rem) or
  collapsed (5rem, icon tiles with short captions), toggled by the button in its top-left
  corner or `Ctrl+B` / `⌘B`, on both targets. The choice is per device
  (`utbt:sidebarCollapsed:v1`, `app/components/layout/sidebarPreference.ts`). Below `lg`
  the preference is ignored: the drawer is always expanded, the toggle is hidden and the
  shortcut is not attached; a window resized back across 1024px reapplies it. Sidebar
  parts are in [navigation.md](navigation.md).
- **`--sidebar-width`** on the root is `16rem`, `5rem` or `0px` below `lg`, set by
  `AppLayout` in a layout effect before paint. Anything offset beside the rail reads it
  ([styling.md](styling.md)). Never assume the sidebar is visible; anything positioned
  relative to it needs the `lg:` variant.
- Content padding is `p-4 sm:p-6 lg:p-8`; the app root uses `h-dvh` (mobile browser
  toolbars); the web entry sets `--window-titlebar-height` to `0px`.
- **Modals.** `offsetSidebar` pads left by the rail width plus 1rem
  (`pl-[calc(var(--sidebar-width,0px)_+_1rem)]`), so a modal centres on the content area
  in both rail modes and on the viewport on phones. A modal with its own internal rail
  sizes by container query, not viewport: see Settings in
  [app/components/pages/settings/README.md](../app/components/pages/settings/README.md).
  A `position: fixed` overlay inside a container-query ancestor must be portalled to
  `document.body`, or containment traps it.
- **Tables** pass `responsive={{ columns, …, compactContent }}` and fall back to stacked
  cards below the required-fit width, never horizontal scroll ([styling.md](styling.md)).
- **Pagination.** `PaginationBar` (`app/components/ui/pagination.tsx`) switches to a touch
  bar below `sm` on its own.
- **Heroes and tiles**: see [styling.md](styling.md).
- **Home** pairs sections two-up. A section whose partner is conditional (login-gated,
  empty news feed) widens to `lg:col-span-12` when alone, so no grid row is left
  half-empty.

Screenshot-verify new surfaces at 390×844, 1024×768 (the breakpoint boundary, the most
fragile width), 1920×1080 and 3840×2160.

## Performance and bundle budgets

Phones parse the web entry chunk on first visit, so it stays lean.

- **Primary pages are lazy, except `Home`.** They are built from the shared loaders in
  `app/components/main/pageLoaders.ts`. `Home` stays eager: it is the default view and the
  `pathToNav` fallback for unknown paths. Detail pages, `AdminPage` and `ConfirmModal` are
  lazy too; one `<Suspense>` wraps `renderView()`.
- **Lazy plus prefetch.** The sidebar prefetches a page on `pointerenter`/`focus`
  (`SidebarNavItem`), the web entry prefetches the landing route, and desktop warms every
  page on `requestIdleCallback` (`warmAllPages`, skipped on web).
- **`lazy()` on a page `Main.tsx` takes a value from is a silent no-op**: the page lands
  back in the entry with no error, only the budget moves. Keep each page's state constants
  in `<PageName>.types.ts` (and medal helpers in `pages/maps/medals.ts`).
  `pageLoaders.test.ts` asserts `Main.tsx` never value-imports a lazily loaded page.
- **Anything needed only after a user action** (a modal, a detail page, an admin surface)
  gets `lazy()` and a mount gate. Existing examples: `LoginPage`, `UpdateModal` and
  `LegacyInstallCard` in `app.tsx`; the Settings modal and `ChangeTitleModal` in
  `AppLayout`; per-section Settings panels; the pick/ban `ManagerDock` (fetched only when
  the manager dock model shows it); `PrivacyPolicyBody` behind `AnalyticsConsentBanner`'s
  modal, which keeps react-markdown out of the entry. The banner itself stays eager: it
  renders for every first-time visitor, exactly the cohort whose LCP matters.
- **`vendor-react` chunk.** `manualChunks` in `vite.config.web.ts` pins `react`,
  `react-dom`, `scheduler` and `@radix-ui/*` into one chunk so it survives deploys in the
  browser cache. Do not widen it to all of `node_modules` (it would pull recharts,
  framer-motion and react-markdown onto the first-paint path), and do not split radix away
  from react-dom (risks a production-only "cannot access before initialization"). Smoke
  test chunking changes with `preview:web`; `dev:web` cannot reproduce a TDZ split
  failure.
- **Bundled art** in `app/assets/` ships as WebP; the PNGs beside it are the editable
  sources. Regenerate with `node scripts/optimize-assets.mjs` and commit both.
  `app/public/` stays PNG (favicons, PWA icons, OG card), which scrapers and manifests
  require.
- **CSS runtime cost** is a separate budget (compositor, RAM, CPU): no per-row
  `backdrop-blur`, no per-row infinite animations, compact-card renderers mount only below
  the required-fit width. Rules in [styling.md](styling.md).

`npm run check:bundle` (`scripts/check-web-bundle.mjs`) reads
`dist-web/.vite/manifest.json` and measures the real initial payload (entry plus its
transitive static imports plus their CSS), gzip. Run it after touching imports or
platform gates.

| Budget | Limit |
|---|---|
| Initial JS | 190 KiB |
| Initial CSS | 36 KiB |
| Initial total | 224 KiB |
| Largest lazy chunk (and each stream scene chunk) | 120 KiB |
| App JS (every JS file except those only the stream scene pages load) | 900 KiB |
| Stream scene JS (files reachable only from the scene root) | 120 KiB |

It also asserts `dist-web/index.html`: exactly one module script, at least one
`<link rel="stylesheet">`, an entry chunk of at least 50 KiB gzip, both
`<!--utbt-head-*-->` markers in order, and every `/assets/` tag after
`<!--utbt-head-end-->`.

## Entry wiring

One `app/index.html` serves both targets. It names `/renderer-web.tsx` directly; the
desktop build rewrites that `src` to `/renderer-desktop.tsx` with the `rendererEntry()`
plugin in `vite.entry.ts`, which throws if the expected string is missing.

Keep the entry statically named; do not reintroduce a dynamic-import dispatcher. Vite
finds the entry by parsing `index.html`, and only a statically named entry gets its
stylesheet `<link>` and modulepreload hints in the document. Behind a runtime `import()`
the browser sees neither until the shim has run: two extra serial round trips before
paint, and CSS injected by JavaScript. The 50 KiB entry floor in `check:bundle` exists to
catch that regression.

## SEO and link previews

Crawlers, Discord's unfurler included, never run JavaScript. The deployed site serves each
HTML document with per-URL metadata already injected; the build ships the static half:

- **`app/public/`** (web only; `electron.vite.config.ts` sets `publicDir: false`):
  favicons, `apple-touch-icon`, maskable icon, `site.webmanifest`, `robots.txt`,
  `og-default.png` (the 1200×630 fallback card) and `route-contract.json`.
- **`route-contract.json`** is the path → entity table, generated from the same route list
  as `routes.ts` and shipped in the build so a frontend deploy keeps per-URL metadata in
  sync. `routes.contract.test.ts` fails if the two drift.
- **`vite.config.web.ts`** has a `transformIndexHtml` plugin that grafts the icon links and
  a default tag block onto the head between `<!--utbt-head-start-->` and
  `<!--utbt-head-end-->`, lifting the shell's `<title>`, `description` and `theme-color`
  out of `app/index.html` so the document never carries duplicates. The deployed site
  replaces everything between the markers per URL and falls back to the plain
  `dist-web/index.html` when it cannot, so never remove the markers.

Client-side, `useDocumentMeta` (called from `Main.tsx`) keeps the tab title and
`<link rel="canonical">` in step with navigation, and detail pages call
`useDocumentTitle` to refine the title once their payload lands. `og:*` is deliberately not
updated client-side: crawlers never see it.

`VITE_SITE_ORIGIN` (default `https://utbt.net`) sets the origin baked into the default
canonical and image URLs at build time (`vite.config.web.ts`) and, through
`import.meta.env`, the origin of shareable match links and scene links on both targets.

## Hosting and stale chunks

The web build is a SPA: unknown paths must resolve to the app (Vite dev/preview do this
locally). `.github/workflows/web.yml` builds `dist-web/` and publishes it; how production
serves it lives outside this repo.

Assets are content-hashed and pages lazy-load, so a tab opened before a deploy can ask for a
chunk the new release no longer has. Two layers cover that: the deploy copies the previous
release's `assets/` into each new release (no-clobber, pruned after 30 days), and
`renderer-web.tsx` listens for Vite's `vite:preloadError` and reloads once
(sessionStorage key `utbt:chunkReloadedAt`, at most once a minute) to pick up the fresh
`index.html`. It ignores failures of the seasonal decorations chunk
(`isSeasonalDecorChunkError`); those decorations just stay away.
