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
sections: [overview, platform-layer, capability-gates, web-auth, anonymous-browsing, shareable-urls, responsive-layout, performance, build, seo-and-link-previews, hosting-note]
last_verified: 2026-07-28
verify_against:
  - app/public/route-contract.json
  - app/components/navigation/useDocumentMeta.ts
  - app/components/navigation/titles.ts
  - app/platform/index.ts
  - app/platform/capabilities.ts
  - app/platform/auth.ts
  - app/platform/gateway.ts
  - app/platform/downloads.ts
  - app/platform/web/auth-web.ts
  - vite.entry.ts
  - app/components/main/pageLoaders.ts
  - app/components/navigation/NavHistoryBar.tsx
  - app/components/splash/WebBootScreen.tsx
  - scripts/check-web-bundle.mjs
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
  `/patreon`) directly. `fetchGatewayServers` runs both branches through
  `normaliseGatewayServers` (typed `Server[]`; partial rows get defaults,
  identity-less entries are dropped) so pages never see a malformed payload.
- `external.ts` — `openExternal(url)`: conveyor on desktop, `window.open`
  (noopener) on web.
- `downloads.ts` — demo/map saves: desktop writes into the game install; web
  triggers a plain browser download of the same bytes.

## Capability gates (where web hides/changes behavior)

| Feature | Web behavior | Gate |
|---|---|---|
| Launch/join/spectate, isGameRunning | hidden | `capabilities.game` in `AppLayout`, `Home`, `ServerBrowserPage`, `RecentServersCard` |
| Ping column / server pings | hidden/skipped | `capabilities.ping` (ServerBrowserPage `displayColumnOrder`, RecentServersCard) |
| Settings modal | web-specific Appearance + Privacy panels; game/ini panels are never fetched | `capabilities.settingsModal` + target-specific lazy modal in `AppLayout` |
| Install banner / patches | off — `validateInstallation` early-returns | `capabilities.install` in `Main.tsx` |
| Favorites ini side-sync | skipped; DB favorites unchanged | `capabilities.ini` in `useFavorites` |
| Self-updater | provider inert, UI renders nothing | `capabilities.updater` in `useUpdater` |
| Demo/map downloads | browser download | `app/platform/downloads.ts` |
| File logging | console fallback (warn/error) | `use-logger.ts` |
| Titlebar / window controls / zoom | not mounted (web entry skips `WindowContextProvider`) | `app/renderer-web.tsx` |
| Launcher telemetry (`logLauncherStartup`) | skipped | `IS_WEB` in `app/utils/api.ts` |
| Nav bar (`NavHistoryBar` — Back/Forward + Refresh) | never rendered — browser chrome owns history and reload; pages revalidate on mount instead (see navigation.md, page-refresh-registry) | `IS_WEB` in `app/components/navigation/NavHistoryBar.tsx` |
| Splash screen | replaced by `WebBootScreen` (logo + spinner, error+retry variant); `SplashScreen` is lazy and never fetched on web | `IS_WEB` in `app/app.tsx` |

**Bundle split reality check:** desktop-only surfaces (`SplashScreen`,
`SettingsModal`, `UpdateModal`, `LoginPage`) are `lazy()` chunks that dist-web
*emits* but a browser never *fetches* — their mount sites are `IS_WEB` /
capability-gated. `npm run check:bundle` additionally fails the build if
hard desktop markers (`electron-updater`, install/patch code) leak into any
web asset. When adding a desktop-only feature: gate the mount with a
capability AND keep the module behind `lazy()` so the web entry never grows.

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

## Responsive layout

The renderer must be usable from a 360px phone to a 4K monitor, on BOTH
targets. One breakpoint governs the shell: **`lg` (1024px)**. Content is
deliberately **full-width at every size — no max-width cap** (owner decision;
don't reintroduce centering).

- `app/index.html` carries the viewport meta tag (harmless in Electron).
- `AppLayout` below `lg`: the sidebar becomes an off-canvas drawer (same single
  `<aside>`, CSS `max-lg:` translate — no duplicated markup), opened from a
  fixed top bar (hamburger + logo). The drawer hides the big logo block
  (`max-lg:hidden` — the top bar already brands) so nav items + the profile
  card fit an 800px-tall phone. Every nav action goes through `changeView`,
  which closes the drawer. At `lg+` the DOM and styling are the pre-mobile
  desktop layout.
- Content padding scales `p-4 sm:p-6 lg:p-8`; the app root uses `h-dvh` (mobile
  browser toolbars) and the web entry zeroes `--window-titlebar-height`.
- Modals: `offsetSidebar` pads left only at `lg+` (`lg:pl-64`) so they center on
  phones. A modal with its own internal rail must not assume the modal is wide:
  Settings collapses its 288px rail into a drill-down once the modal body drops
  below 768px and sizes panel contents by named container query — see
  `app/components/pages/settings/README.md` → Responsive behavior. Any
  `position: fixed` overlay rendered inside a container-query ancestor must be
  portalled to `document.body` or containment traps it.
- **Tables:** every tabular surface passes `responsive={{ columns, ...,
  compactContent }}` — priorities drop cosmetic columns first, the core metric
  is `required`, and below the required-fit width rows render as stacked cards
  (never horizontal scroll). Full contract + canonical examples in
  `agents/styling.md` → Responsive columns.
- **Pagination:** `PaginationBar` renders the desktop control row at `sm+` and
  a touch bar (`‹ Prev [page]/total Next ›`, editable page number) below `sm` —
  pages get this for free.
- **Heroes / stat tiles:** titles `line-clamp-2 break-all` + `flex-wrap` action
  rows; tile grids step `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`; see
  `agents/styling.md`.
- Home pairs sections two-up; any section whose partner is conditional
  (login-gated, empty news feed) must widen to `lg:col-span-12` when alone —
  never leave a half-empty grid row (`Home.tsx` render helpers).

When adding UI: never assume the sidebar is visible; anything positioned
relative to it needs the `lg:` variant. Screenshot-verify new surfaces at
390×844, 1024×768 (the breakpoint boundary — historically the worst width),
1920×1080, and 3840×2160 before calling them done.

## Performance

The web entry chunk must stay lean — phones parse it on first visit. The initial
payload is currently **~169 KiB JS + 27 KiB CSS gzip**, enforced by
`npm run check:bundle`.

- **Every primary page except `Home` is `React.lazy`**, built from the shared
  loaders in `app/components/main/pageLoaders.ts`. `Home` stays eager: it is the
  default view and the `pathToNav` fallback for any unrecognised path.
- Detail pages and `AdminPage` are lazy too; one `<Suspense>` wraps `renderView()`.
- `LoginPage` + `UpdateModal` are lazy in `app.tsx`; target-specific Settings
  modals + `ChangeTitleModal` are lazy in `AppLayout` and mount only while open.
  Settings panels are split per section, and web never fetches desktop game panels.
- `MarkdownBody` and the privacy-policy text are lazy behind
  `AnalyticsConsentBanner`'s modal, keeping react-markdown and its
  micromark/mdast/hast tree out of the entry. The banner itself stays eager — it
  renders for every first-time visitor, exactly the cohort whose LCP matters.
- **Lazy alone is not enough.** `lazy()` on a page whose module `Main.tsx` also
  imports a *value* from is a silent no-op: the page lands back in the entry,
  nothing errors, and only the budget moves. That is why each page's state
  constants live in `<PageName>.types.ts` and the medal helpers in
  `pages/maps/medals.ts`. `app/components/main/pageLoaders.test.ts` asserts
  `Main.tsx` never takes a value import from a lazily-loaded page.
- Rule: a module only needed after a user action (a modal, a detail page, an
  admin surface) gets `lazy()` + a mount gate, not a static import. Primary
  sidebar pages are lazy **and prefetched** — the sidebar prefetches on
  `pointerenter`/`focus`, `renderer-web.tsx` prefetches the landing route's chunk
  before React mounts, and desktop warms all of them on `requestIdleCallback`.
- `react`, `react-dom`, `scheduler` and `@radix-ui/*` are pinned into a
  `vendor-react` chunk (`manualChunks` in `vite.config.web.ts`) so they survive a
  deploy in the browser cache. Do **not** widen that rule to all of
  `node_modules`: it would pull recharts, framer-motion and react-markdown back
  onto the first-paint path, and splitting radix away from react-dom risks a
  production-only "cannot access before initialization". Smoke-test any change
  with `preview:web`, never `dev:web` — dev cannot reproduce a TDZ split failure.
- `npm run check:bundle` reads `dist-web/.vite/manifest.json` and measures the
  real **initial payload** (the entry plus its transitive static imports plus
  their CSS), not the largest chunk. It also asserts the structure of
  `dist-web/index.html`: exactly one module script, at least one
  `<link rel="stylesheet">`, an entry chunk over 50 KiB gzip, and every asset tag
  after the `<!--utbt-head-end-->` marker. Run it after touching imports or
  platform gates.
- Bundled art in `app/assets/` ships as **WebP**; the PNGs beside it are the
  editable sources. Regenerate with `node scripts/optimize-assets.mjs` and commit
  both. `app/public/` stays PNG — those are favicons, PWA icons and the OG card,
  which social scrapers and manifests require.
- Avatars are requested at the size they render via `avatarSizeFor()`
  (`app/utils/api.ts`), not the gateway's 256 default.
- Performance is not only bundle size: the page also has a CSS runtime budget
  (compositor / RAM / CPU — phones and the Electron shell share a machine with
  the game). Rules live in `agents/styling.md` → CSS runtime cost; headline:
  no per-row `backdrop-blur`, no per-row infinite animations, compact-card
  renderers mount only below the required-fit width so wide screens pay zero.

| Command | Purpose |
|---|---|
| `npm run dev:web` | Web dev server at `http://localhost:5174`. |
| `npm run build:web` | Static production build into `dist-web/`. |
| `npm run preview:web` | Serve the production build locally. |

One `app/index.html` serves both targets. It names `/renderer-web.tsx` directly,
and the desktop build rewrites that `src` to `/renderer-desktop.tsx` via the
`rendererEntry()` plugin in `vite.entry.ts`, which throws if the expected string
is missing rather than silently doing nothing.

**Do not reintroduce a dynamic-import dispatcher here.** Vite discovers the entry
by parsing `index.html`, and only a statically named entry gets its stylesheet
`<link>` and modulepreload hints emitted into the document. Behind a runtime
`import()` the browser cannot see either until the shim has been fetched and
executed — two extra serial round trips before anything can paint, and the CSS
arrives injected by JavaScript. `check:bundle`'s 50 KiB entry floor exists to
catch exactly that regression.

`electron-builder.yml` excludes `dist-web/**` and `vite.config.web.ts` from the
packaged app.

## SEO and link previews

Crawlers — and Discord's unfurler in particular — never run JavaScript, so a
client-rendered `<head>` is invisible to them. The deployed site therefore
serves each HTML document with per-URL metadata already injected, and the build
ships the static half of that contract:

- **`app/public/`** (web only — `electron.vite.config.ts` sets
  `publicDir: false` so none of it reaches the desktop artifact): favicons,
  `apple-touch-icon`, maskable icon, `site.webmanifest`, `robots.txt`,
  `og-default.png` (the 1200x630 card every link falls back to), and
  `route-contract.json`.
- **`route-contract.json`** is the path→entity table, generated from the same
  route list as `routes.ts`, shipped in the build so a frontend deploy keeps the
  per-URL metadata in sync with no cross-repo edit.
  `routes.contract.test.ts` fails the build if the two drift.
- **`vite.config.web.ts`** carries a `transformIndexHtml` plugin that grafts the
  icon links and a default tag block onto the head, bracketed by
  `<!--utbt-head-start-->` / `<!--utbt-head-end-->`. The deployed site replaces
  everything between those markers per URL, so leave them in place.
  `app/index.html` stays untouched and shared — the plugin lifts the shell's
  `<title>`, `description` and `theme-color` out so the document never carries a
  duplicate.

Client-side, `useDocumentMeta` (called from `Main.tsx`) keeps the tab title and
`<link rel="canonical">` in step with navigation, and detail pages call
`useDocumentTitle` to refine the title once their payload lands. `og:*` is
deliberately **not** updated client-side: crawlers never see it, so it would be
bytes for nothing.

`VITE_SITE_ORIGIN` (default `https://utbt.net`) sets the origin baked into the
default canonical and image URLs.

## Hosting note

The web build is a SPA: unknown paths must resolve to the app rather than 404
(Vite dev/preview already do this locally). In production the deployment fills
the marked `<head>` region per URL and falls back to the plain
`dist-web/index.html` when that is unavailable — so **never remove the
`<!--utbt-head-*-->` markers**. How that is served, and the cutover steps, live
outside this repo. `.github/workflows/web.yml` builds `dist-web/` and publishes
it.

**Stale-chunk recovery.** Assets are content-hashed and pages lazy-load, so a
tab opened before a deploy can request a chunk the new release no longer
references. Two layers keep that from stranding users: the deploy workflow
copies the previous release's `assets/` into each new release (no-clobber,
pruned after 30 days), and `app/renderer-web.tsx` listens for Vite's
`vite:preloadError` and does a one-shot reload (sessionStorage-throttled to
once per minute) so the session picks up the fresh `index.html`.
