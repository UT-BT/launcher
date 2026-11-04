# Testing

How the launcher is tested: Vitest for logic, Playwright against the web target for UI and OBS
scenes, committed screenshot baselines, and what CI runs. Read it before writing a test or when a
gate goes red. Commands and the pre-commit gate are in [build.md](build.md).

## Where the tests live

| Path | Holds |
|---|---|
| `<module>.test.ts` beside its module in `app/` and `lib/` | Vitest: pure logic and view models, run in Node without a DOM |
| `app/utils/fixtures/` | golden contract fixtures: pinned JSON per area, a typed loader and a pin test each |
| `*Fixtures.ts` beside feature code | synthetic data builders shared by Vitest and Playwright (`pickban/pickBanFixtures.ts`, `stream/data/streamFixtures.ts`, `stream/scenes/<scene>/<scene>Fixtures.ts`, `stream/ticker/feedFixtures.ts`) |
| `lib/main/*.test.ts` | main-process services against a real temp folder; two suites are Windows-only |
| `e2e/*.spec.ts` | Playwright specs for the app, run in `desktop-chromium` and `mobile-chromium` |
| `e2e/*.broadcast.spec.ts` | Playwright specs for OBS scene pages, run only in `broadcast` |
| `e2e/mobile/` | the mobile suite: crawl, route manifest, recorded fixtures and their refresh script, synthetic role-gated fixtures, fixture router, stress variants, rules, known-violations ledger, gallery reporter, and Vitest files for its pure logic ([Mobile suite](#mobile-suite)) |
| `e2e/__screenshots__/` | committed screenshot baselines, one folder per spec file |
| `e2e/streamHarness.ts` | fake API plus open, settle and screenshot helpers for scene specs |
| `e2e/sidebarRail.ts`, `e2e/layout.ts`, `e2e/streamPanels.ts`, `e2e/mapDownload.ts` | shared spec helpers: the catch-all `mockApi`, `horizontalOverflow`, `openStreamPanel`, the map-download mock `serveMapDownloadRoutes` |
| `e2e/replayVideos.ts`, `e2e/teamRuns.ts` | shared compare-page helpers: served replay videos, and team runs with their team reads ([Compare page specs](#compare-page-specs)) |
| `runCompare/playback/playbackFakes.ts`, `runCompare/model/teamTestRuns.ts` | Vitest-only builders for the compare page: a fake clock and fake media, and team run inputs ([Compare page specs](#compare-page-specs)) |
| `e2e/desktopPromo.ts` | desktop promotion helpers: storage seeds, `/users/me` variants, the installer download mock, the telemetry reader ([Desktop promotion specs](#desktop-promotion-specs)) |
| `e2e/<name>Harness.html` + `.ts` | standalone pages that mount one component tree outside the app |
| `playwright.config.ts`, `vitest.config.ts`, `.github/workflows/` | runner config and CI |
| `tsconfig.e2e.json` | the TypeScript project for `e2e/` and the two runner configs: `typecheck:e2e` and ESLint read it |

## Vitest

`vitest.config.ts` collects `app/**/*.test.{ts,tsx}`, `lib/**/*.test.ts` and `e2e/mobile/**/*.test.ts` and runs them in Node;
no DOM library is installed. It defines `__WEB_TARGET__` as `false`, so platform code under test
takes the desktop branch, and resolves the `@/app`, `@/lib` and `@/resources` aliases.

### What gets a unit test

Logic lives in a pure module beside the component that renders it (a `<thing>View.ts` view model,
a `<thing>Actions.ts` command module, a store), or in a pure function exported from the component
file (`cupAtAGlanceView` in `events/stats/CupAtAGlance.tsx`). The test imports that function and
feeds it fixtures; no test renders React. Rendering, layout, interaction and responsive behaviour
go in a Playwright spec. When you add logic to a component, put it in such a function so Vitest
can reach it.

### Stubs

- **Fetchers** in `app/utils/api.ts`: stub `fetch` with `vi.stubGlobal('fetch', vi.fn()...)`,
  assert URL, method, headers and the parsed result, and call `vi.unstubAllGlobals()` in
  `afterEach`. Copy `app/utils/api.pickBan.test.ts`.
- **Time**: `vi.useFakeTimers()` and `vi.setSystemTime()`.
- **Main-process modules that import `electron`**: `vi.mock('electron', ...)` with only the
  members the module uses (copy `lib/main/config.test.ts`). Services that touch files run against
  a `mkdtempSync(join(tmpdir(), ...))` folder made in `beforeEach` and removed in `afterEach`.

### Windows-only suites

`lib/main/cam-launcher.test.ts` and `lib/main/kit-extractor.test.ts` wrap their file-writing
suites in `describe.skipIf(process.platform !== 'win32')`. They assert Windows paths (drive
letters, backslashes, CRLF ini files), and the kit folder must be a drive path
(`lib/main/kit-folder.ts`). The pull-request gate runs on Windows, so they run there; the `main`
web build runs on Linux and skips them. Run them locally after touching the cam launcher,
`lib/stream-kit/cam-plan.ts` or the kit extractor.

### Structure tests

These read source files and guard wiring rules rather than behaviour:

| Test | Guards |
|---|---|
| `app/components/main/pageLoaders.test.ts` | `Main.tsx` never value-imports a lazy page; every sidebar view except Home has a shared loader |
| `app/components/navigation/routes.contract.test.ts` | every view in `viewToPath` has an entry in `app/public/route-contract.json` and round-trips; `robots.txt` blocks stream pages and leaves every other non-admin route crawlable; every contract view has a [mobile manifest](#mobile-route-manifest) entry, every entry names a contract view, the role-gated entries exist, and the `admin` entry crawls every section in `ADMIN_SECTIONS` |
| `app/components/pages/events/stream/streamPanels.test.ts` | Stream tab panels and Match sections keep their order and load only lazily |
| `app/components/shared/LazyModalGate.test.ts` | pages, cards and the shell never value-import a modal listed as opened by a user action; those mount only through `LazyModalGate` ([web-target.md](web-target.md)) |
| `app/prePaint.test.ts`, `app/styles/themes.test.ts`, `app/seasonal/logos.test.ts` | the `index.html` pre-paint script's default theme, light themes and seasons equal the registries; every non-default theme has a palette block and only the `solid` group hides the nebula; every season has its logo file |
| `app/styles/seasons.test.ts`, `app/components/pages/events/stats/teamAccent.test.ts` | seasonal palettes target only the Classic theme; every team accent slot has a dark and a light value and its own hue |
| `app/utils/recordsDefinitions.test.ts` | cap types, medal multipliers, difficulty tiers, the map author name and the team-run label are defined once in `app/utils/` and never copied into a records file |

When one fails after you add a page, route, panel or palette, its message names the rule: change
the wiring to follow it.

### Running

`npm test` runs every file once. One file: `npx vitest run app/utils/format.test.ts`. One test:
add `-t "<test name>"`. `npm test -- pickBan` runs every file whose path contains `pickBan`.

## Fixtures

### Golden contract fixtures

Each area under `app/utils/fixtures/` (`eventStats/`, `mapUploads/`, `pickBanVeto/`,
`runCompare/`, `streamSides/`) holds API responses as JSON, frozen byte for byte. `runCompare/`
holds the pairwise comparison bodies and the team comparison bodies (`team_compare_*.json`), each
a copy of the API's own contract example ([api.md](api.md#team-comparison)):

- `<area>Fixtures.ts` imports every file into a registry (`file`, `route`, `status`, `body` per
  name) typed against `app/utils/api.ts`, and exports `<area>Fixture(name)` (the success data),
  `<area>ErrorFixture(name)` and `<area>FixtureResponse(name)` (a `Response` for fetch stubs).
- `<area>Fixtures.test.ts` checks every file on disk is registered once, pins each file's SHA-256
  in `PINNED_SHA256`, checks the envelope, and (except `mapUploads`) checks the contract's keys
  both ways through `satisfies Record<keyof T, true>` maps, so a field added on one side fails
  until both agree.
- The folder's `.gitattributes` (`*.json -text`) keeps git from rewriting line endings, which
  would break the pins. `.prettierignore` keeps Prettier off them for the same reason.

A fixture changes only when the contract does: replace the file with the new payload, take the new
hash from the failing pin test (it prints the received value), and update the key maps and the
`api.ts` types in the same commit. Vitest tests and Playwright specs import the same getters, so
one contract change reaches both.

### Synthetic fixtures

`*Fixtures.ts` builders beside the feature code (table above) return typed objects with overrides
(`pickBanState({...})`, `streamHotState(...)`, fixed clocks like `T0` and `STREAM_T0`). Specs import
them from `../app/...`, so one builder serves both runners. Use the builder for an area before
writing an inline payload.

### Adding a golden fixture set

1. Create `app/utils/fixtures/<area>/` with the JSON files and a `.gitattributes` holding
   `*.json -text`.
2. Add `app/utils/fixtures/<area>Fixtures.ts`: the imports, the registry and the three getters.
   Copy `streamSidesFixtures.ts`.
3. Add `<area>Fixtures.test.ts`: registry-matches-disk, `PINNED_SHA256`, envelope and key-map
   checks against the `api.ts` types. Copy `streamSidesFixtures.test.ts`.
4. Verify: `npx vitest run app/utils/fixtures/<area>Fixtures.test.ts` passes, and
   `git ls-files --eol app/utils/fixtures/<area>` shows `attr/-text` on every JSON file.

## Playwright

### How specs reach the app

`playwright.config.ts` starts `npm run dev:web` (the web target in Vite dev mode) on
`127.0.0.1:5175` with `VITE_API_BASE_URL=https://api.utbt.net`, so every spec's route mock
matches the same host whatever your `.env` says. Electron never runs under Playwright: specs drive
the website, and desktop-only UI is reached through harness pages.

- **App specs** `page.goto` a real route (`/events/<slug>?tab=stream`, `/admin`, a scene path).
- **Harness pages** (`e2e/<name>Harness.html` + `.ts`) mount one component tree with stub
  providers and, for desktop-only panels, a fake `window.conveyor` (`camToolHarness.ts` records
  every call on `window.camHarness`). The dev server's root is `app/`, so specs load a harness by
  absolute file path through Vite's `/@fs/` prefix: copy the `HARNESS` constant from
  `e2e/stream-cams-panel.spec.ts`.
- **Port.** `reuseExistingServer` is `false`: a dev server left alive by an aborted run fails the
  next one with `http://127.0.0.1:5175 is already used`. Stop it, or set `E2E_PORT` (also how two
  worktrees run their suites side by side).
- **Built bundle.** With `E2E_SERVER=build` (set by every `test:mobile*` script) the config builds
  the web target into `dist-e2e/` (about 15 s) and serves it with `vite preview` instead of the dev
  server, and runs 6 workers instead of 2. Static chunks load in a fraction of the dev server's
  time and never hit its Windows socket drops. Harness pages need the dev server's `/@fs/`
  prefix, so `test:e2e` stays on it.

### Projects

| Project | Runs | Device | For |
|---|---|---|---|
| `desktop-chromium` | every spec except `*.broadcast.spec.ts` and `e2e/mobile/` | Desktop Chrome, 1280×720 | app UI at desktop width |
| `mobile-chromium` | the same specs | Pixel 7: 412×839, touch, `isMobile` | the same UI on a phone |
| `broadcast` | only `*.broadcast.spec.ts` | Desktop Chrome at 1920×1080, `deviceScaleFactor: 1` | OBS scene pages and their baselines |
| `mobile-suite-webkit`, `mobile-suite-chromium` | only `e2e/mobile/**/*.spec.ts` | iPhone 14 and Pixel 7 bases with touch and `isMobile`, sized per test | the mobile suite ([Mobile suite](#mobile-suite)) |

The file name picks the project, and app specs run in both app projects. The app projects ignore
`e2e/mobile/`, and `npm run test:e2e` runs only the first three projects. A test that fits only one
size skips with `test.skip(isMobile, '<reason>')` or `test.skip(!isMobile)`. Specs that sweep
widths set `test.use({ viewport })` per `describe` (copy `e2e/event-stats-responsive.spec.ts`) and
expect `horizontalOverflow(page)` from `e2e/layout.ts` to be at most 1. Both app projects share
one storage state (`APP_STORAGE_STATE` in `playwright.config.ts`) that preloads:

- `utbt:seasonalThemes:v1 = "off"`, so seasonal decor stays out of layout checks;
  `seasonal.spec.ts` turns it on itself.
- `utbt:desktopSeen:v1` = the time the config loaded (the key comes from
  `DESKTOP_SEEN_STORAGE_KEY`). This is the **quiet default**: `desktop-chromium`'s user agent is
  Windows 10, so without it every signed-out spec would show the desktop promotion. Signed-in
  specs stay quiet because their `/users/me` mocks have no `last_desktop_seen_at` (unknown, so not
  eligible). A spec that pins the page clock more than 90 days after the run date needs its own
  seed. Promo specs opt in through `e2e/desktopPromo.ts` ([Desktop promotion
  specs](#desktop-promotion-specs)); never change the default to make a spec promote.

The config runs 2 workers (6 against the built bundle), spec files in parallel and the tests inside a file in order (the mobile
suite projects run those in parallel too), with the default 30 s test timeout,
`trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'`. Retries (2), `forbidOnly` and the
`github` reporter apply only when `CI` is set; locally there are no retries, the `list` reporter
prints, and a stray `test.only` silently narrows the run. Every run also loads the mobile gallery
reporter, which writes nothing unless mobile suite tests ran.

### API mocking

A spec serves the API itself through
`page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, ...)`, answering in the `{ success, data }`
envelope ([api.md](api.md)). A request no route answers goes to the real API, so every spec that
loads the app registers a catch-all:

- `mockApi` in `e2e/sidebarRail.ts` is the minimal one: empty lists, zero counts, an empty
  `/v2/summary`.
- Feature specs keep one handler with a path switch (copy `mockApi` in `e2e/stream-tab.spec.ts`).
- Scene specs use `serveStreamApi` from `e2e/streamHarness.ts`, which also answers `If-None-Match`
  with 304 and stamps `x-server-now`.

Playwright tries the most recently registered matching route first, so a route added after the
catch-all overrides it.

Seed browser state with `page.addInitScript` before `goto`:

- `utbt:analyticsConsent:v1` = `denied`, so the consent banner never covers the page.
- A signed-in web user: `utbt:webAuth:v1` with `accessToken`, `refreshToken` and an `expiresAt`
  computed inside the script, more than 5 minutes ahead of the page clock; a closer expiry makes the
  app refresh the session first.

### Compare page specs

The compare page ([run-compare.md](features/run-compare.md#tests)) has these shared helpers:

- **`e2e/replayVideos.ts`**: `serveReplayVideos(page, missing)` serves the repo's test WebM for
  every replay video read, with range requests, and a 404 for each cap id in `missing`. The file is
  2 s long, so the helper multiplies its WebM `TimecodeScale` by 16 in memory: the same frames last
  32 s (`REPLAY_VIDEO_SECONDS`) and seek and play in real time. It also exports `MEDIA_HOST`,
  `replayVideoUrl`, `REPLAY_VIDEO` and `REPLAY_VIDEO_STRETCH`.
- **`e2e/run-compare.spec.ts`'s `mockApi(options)`** answers cap details, the pairwise read from
  the `runCompare` fixtures (recording which pairs were asked for), and replay videos. It gives every
  mocked cap zone checkpoints scaled to its time, and `converted` names caps whose video is not from
  UTRecorder. `mockLeaderboard`, registered after it, serves the drawer's leaderboard. A file-level
  `beforeEach` runs the phone project on a 1280×800 touch screen (`TOUCH_GRID`), because these cases
  test the grid; the phone layout is `e2e/run-compare-responsive.spec.ts`'s.
- **`e2e/teamRuns.ts`**: `mockTeamRuns` (team cap details, the team leaderboard, member replays),
  `teamDetail`, `teamEntry`, two two-member team runs `ALPHA` and `BRAVO`, `teamFixtureOf` and
  `mockTeamComparisons` (team reads from the `team_compare_*` fixtures).
- **Vitest.** `runCompare/playback/playbackFakes.ts`: `createFakeTime()` steps a fake clock by
  frames or seconds, and `time.media(options)` is a fake video that records every command and plays
  along (options for readiness, start delay and seek duration; hooks to stall, recover, fail, drift
  and finish a seek). The controller, target and team clock tests use it.
  `runCompare/model/teamTestRuns.ts` builds team runs and composed team models (`versusOf`,
  `composeVersus`) from the fixtures.
- Entry points: `e2e/video-compare.spec.ts` (Cap Detail, the checkpoint card, Team Cap Detail and
  the Watch modal into the page), `e2e/cap-compare-responsive.spec.ts` (Watch Side by Side at 390
  and 1366 px) and `e2e/map-compare-selection.spec.ts` (the map leaderboard selection).

### Desktop promotion specs

The promotion ([web-target.md](web-target.md#desktop-promotion)) has one spec per surface:
`desktop-promo.spec.ts` (sidebar row and modal), `desktop-promo-servers.spec.ts`,
`desktop-promo-downloads.spec.ts` (map and demo result lines), `desktop-promo-settings.spec.ts`
and `desktop-promo-stream.spec.ts`. The older Stream specs (`stream-tab`, `stream-guide-panel`,
`stream-cams-panel`) stay unpromoted and assert the fallback line. A promo spec builds on
`e2e/desktopPromo.ts`, and a helper only one spec needs stays in that spec:

- `seedDesktopPromo(page, { consent?, signedIn?, desktopSeen?, dismissed? })` overrides the quiet
  default in an init script: consent `denied`, signed out and both keys cleared unless given;
  `desktopSeen` is `'cleared' | 'null' | 'fresh' | 'stale'`, `dismissed` is
  `'cleared' | 'fresh' | 'stale'` (fresh is 1 day old, stale 91). It runs once per tab, so a
  reload keeps what the page wrote; to change storage mid-test, `page.evaluate`, then reload.
- `routeUsersMe(page, variant)` and `routeDelayedUsersMe(page, variant)` (`{ data, requested,
  release }`) answer `/users/me` with `last_desktop_seen_at` `'absent' | 'null' | 'recent' |
  'stale'`, and `/launcher/activity/latest` with 404. Register them after the catch-all.
- `routeDesktopAppDownload(page)` answers `DESKTOP_APP_DOWNLOAD_URL` with a small `.exe`
  attachment, so no spec downloads the real installer.
- `recordTelemetryFlushes(page).flushedOutcomes()` forces a flush and returns the last payload's
  `outcomes`; poll it with `expect.poll` (consent `granted`).
- `WINDOWS_11_USER_AGENT` and `MACOS_USER_AGENT` set the user agent per `describe`. Windows tests
  skip `mobile-chromium` (Android), which expects no promotion; every spec also has a macOS
  `describe` that expects none.
- The promo UI is lazy, so a "nothing shows" check first waits for the page's anchor and
  `networkidle`, then asserts the count is 0. Locate inline lines with `[data-desktop-app-notice]`.

### Live tests

A `@live` test talks to the real public API. Put `@live` in the title, skip unless
`UTBT_LIVE_API=1`, and let the same flag turn that spec's mocks off (copy
`e2e/responsive-accessibility.spec.ts`). `npm run test:e2e:live` sets the flag and runs only
`@live` tests; the default run skips them. Keep live tests read-only.

### Running

```bash
npm run test:e2e                                               # the two app projects and broadcast
npx playwright test                                            # every project, the mobile suite's PR subset included
npx playwright test --project=desktop-chromium                 # one project
npx playwright test e2e/stream-tab.spec.ts --project=desktop-chromium
npx playwright test e2e/stream-tab.spec.ts:228                 # one test, by its line
npx playwright test -g "lands on Setup"                        # by title
```

`npm run test:e2e -- <args>` passes the args on with the three projects fixed. A broadcast spec needs
no `--project`: the other projects ignore it. The mobile suite has its own commands
([Mobile suite](#mobile-suite)). Specs that listen for browser errors print `BROWSER PAGE ERROR:`
lines; read those first when a page stays blank.

### Adding a spec

1. Name it `e2e/<feature>.spec.ts`, or `e2e/<scene>.broadcast.spec.ts` for a scene page. A flow
   that a phone user drives (a gesture, a sheet, phone cards) goes in `e2e/mobile/<flow>.spec.ts`
   as an [interaction spec](#interaction-specs) instead, and a new route or tab gets a manifest
   entry rather than a spec ([Mobile route manifest](#mobile-route-manifest)).
2. Register a catch-all plus the feature's routes and seed consent (and auth, if needed) before
   `goto`. Build payloads from the area's fixture builder or golden fixture.
3. Locate by role, label and text; scenes also stamp `data-*` hooks. Skip per size with `isMobile`;
   sweep widths with `test.use({ viewport })` and check `horizontalOverflow`.
4. Scene specs open through `openScene` and shoot through `expectSceneScreenshot`
   ([stream-kit.md](features/stream-kit.md)).
5. Verify: `npx playwright test e2e/<file>` passes twice in a row in every project it runs in, and
   `npm run typecheck:e2e` and `npm run lint` pass.

## Screenshot baselines

`snapshotPathTemplate` stores a baseline at `e2e/__screenshots__/<spec file>/<name>-<project>-<platform>.png`,
for example `scene-frame.broadcast.spec.ts/frame-broadcast-win32.png`. Every committed baseline
belongs to a broadcast spec and ends in `-win32`: the suite runs on Windows, and font and gradient
rasterisation differ per OS. A platform or name with no baseline writes one and fails that run
(Playwright's default `missing` mode); read a new baseline before committing it.

**Comparison** (`expect.toHaveScreenshot` in the config): per-pixel `threshold: 0.2` and
`maxDiffPixelRatio: 0.001` (about 2,000 pixels of a 1920×1080 frame), CSS animations and
transitions disabled, caret hidden, CSS-pixel scale. Antialiasing noise passes; a moved, resized
or restyled element fails.

### What makes a shot deterministic

| Source of drift | Pin it with |
|---|---|
| Wall-clock time | `page.clock.setFixedTime(...)` before `goto` (`openScene` uses `STREAM_T0`). It fixes `Date` but timers still fire, so mask what rotates on a timer (`mask` with `maskColor: '#ff00ff'`, as `expectSceneScreenshot` does for the ticker) |
| Web fonts and images | wait until the fonts and every `<img>` have loaded (`settleScene`); an early shot catches fallback glyphs or empty boxes |
| JS-driven motion | the config freezes only CSS animation; framer-motion and `requestAnimationFrame` loops keep running, so open scenes with `motion=0` (`SCENE_OPTIONS` is `sound=0&motion=0`). Scene motion follows that option, not `prefers-reduced-motion`, so `page.emulateMedia({ reducedMotion: 'reduce' })` does not freeze a scene |
| Remote images | serve them from the route mock (the harness draws SVGs) |
| Banners | seed analytics consent as `denied` |
| Local time text | `test.use({ timezoneId })` where the page renders local time (`stream-countdown.spec.ts`, `schedule-responsive.spec.ts`) |

Scene rules (the harness, transparency checks, video scenes, scene fixtures) are in
[stream-kit.md](features/stream-kit.md).

### Reading a mismatch

A mismatch leaves `<name>-expected.png` (the baseline), `<name>-actual.png` and `<name>-diff.png`
(changed pixels in red) in the failing test's folder under `test-results/`, next to `trace.zip`.
The error states how many pixels differ. Read `-diff.png` and `-actual.png` with the Read tool;
eyeballing the baseline in `e2e/__screenshots__/` misses small shifts. Every run clears
`test-results/`, so read them before rerunning. The local `list` reporter writes no HTML report;
add `--reporter=html` for one.

### Updating a baseline

Update a baseline only when your change is meant to alter that screen and the diff shows exactly
that change (a layout, copy, token, font or fixture change you made on purpose):

1. `npx playwright test e2e/<spec> --project=broadcast --update-snapshots`. The flag rewrites only
   baselines that no longer match.
2. Read each rewritten PNG.
3. `git status e2e/__screenshots__` lists only the baselines you meant to change; commit them with
   the code.

Keep the baseline and fix the code when the failing screen is one your change was not meant to
touch, or the diff shows more than your change: shifted neighbours, a missing image, fallback
glyphs, the mask colour outside the masked region. Two runs that disagree with each other mean
nondeterminism: pin it (table above) instead of updating.

## Mobile suite

`e2e/mobile/` crawls every surface in the mobile route manifest on WebKit and Chromium at phone,
landscape, foldable and tablet sizes. It checks a fixed set of mobile rules on each one, compares
the failures with the known-violations ledger, and writes a screenshot gallery. `npm run test:e2e`
never runs it.

### Commands

| Command | Runs |
|---|---|
| `npm run test:mobile` | the PR subset: WebKit at 390×844 and 844×390, Chromium at 360×780 and 915×412, plus every other `e2e/mobile/*.spec.ts` (interaction specs) on both engines |
| `npm run test:mobile:full` | every viewport in `e2e/mobile/viewports.ts` on both engines, with every stress variant: several hours locally, so narrow it with `-g` |
| `npm run test:mobile:ledger`, `npm run test:mobile:ledger:full` | the same two runs in ledger mode: a rule result never fails a test, and the run rewrites `e2e/mobile/ledger/` ([Known-violations ledger](#known-violations-ledger)) |
| `npm run test:mobile:refresh-fixtures` | re-records the public fixture sets from the live public API ([Test data](#test-data)) |

Narrow a run with `-- -g <surface or viewport>`, for example `npm run test:mobile -- -g cap-detail`
or `-g 390x844`. All five read `E2E_PORT` through the config. The four `test:mobile` and
`test:mobile:ledger` scripts crawl the built bundle ([Built bundle](#how-specs-reach-the-app));
`test:mobile:refresh-fixtures` and `npx playwright test e2e/mobile/...` without a script use the
dev server. WebKit must be installed: `npx playwright install webkit chromium`, and on Linux
`npx playwright install --with-deps webkit chromium` (it installs the system libraries with `sudo`), as
the `Mobile suite` job does ([CI](#ci)).

The projects are `mobile-suite-webkit` (iPhone 14 base) and `mobile-suite-chromium` (Pixel 7 base),
both with touch and `isMobile`, seasonal decor off, and each test at its own viewport and screen
size. `MOBILE_MATRIX=full` (set by the `:full` scripts) picks the full matrix. When a viewport
belongs to one engine only, the crawl tags its tests `@webkit-only` or `@chromium-only`, and each
project's `grepInvert` drops the other engine's tests. Untagged tests, such as interaction specs, run
on both engines at the project's default size (390×844 and 360×780).

### Mobile route manifest

`e2e/mobile/manifest/<view>.ts` holds one public entry per route-contract view id, and
`manifest/index.ts` collects them in `MOBILE_MANIFEST` with the role-gated entries
([Role-gated entries](#role-gated-entries)). It is test-side only and never ships in
`route-contract.json`. Manifest modules import only types from Playwright (no `test`, no `expect`),
so Vitest can import them too; waits use locator `waitFor()`. The step helpers they share (`listed`,
`recordShown`, `rowsOf`, `heading`, `shows`, `text`, `tap`, `steps`, `opens`, `opensWhenShown`,
`watchesReplay`, `withCardsOpen`, `modalHeading`, `seen`, `settledStage`) and the shared `watchRun`
and `wrHistory` modals are in `manifest/steps.ts`. `settledStage` is the compare page's `ready`:
the stage has no pending tile and every streamed video has metadata or an error, checked twice
750 ms apart; the run-compare entry and the cap and team-cap sub-views that open the page
(`cap-detail/compare-run`, `cap-detail/compare-runs`, `team-cap-detail/watch-team-replay`) wait on
it. The overlays that aren't a page's own modal are in `manifest/overlays.ts`:
`pageTutorial(page)` (the Servers, Maps and Players tutorial card, opened from the page's help
button, with the card's dialog as `root`) and `consentPolicy(ready)` (the consent banner's privacy
policy on Home: it drops the seeded consent and reloads once, so the banner shows).

| Field | Holds |
|---|---|
| `view` | the route-contract view id |
| `id` | only on a second entry for a view: `<view>:<who>`, such as `event-detail:manager`. It replaces `view` in the surface ids |
| `tier` | `public` or `role-gated` |
| `path` | the URL that opens the view |
| `fixtures` | the name of a fixture set in `e2e/mobile/fixtures/index.ts` |
| `ready` | waits on measurable state that says the page shows its data, such as a heading or a fixture row; never a timeout. Steps receive the served set's data (`data.api(path, query)`, `data.gateway(path, query)`), so a list page waits for its first served row, or for its empty text when a stress variant served none |
| `decorative` | required: the header labels of the columns the [table and card rules](#tables-and-cards) may drop, for every table the entry's surfaces show, such as a thumbnail that repeats the map name or a bar that repeats a number. An unlabelled header is named by its position, `column <n>`; `[]` when nothing is decorative |
| `storage` | `localStorage` seeds, such as a tutorial already seen. Analytics consent is always seeded `denied` |
| `subViews` | tabs and sub-views: `id`, `label`, and either `path` (reached by URL) or `open` (an action on the entry's page), plus `ready` (optional, required with `open`: `manifest.test.ts` checks it), `modals`, `stress` and `skip` |
| `modals` | `id`, `label`, `open` (acts, then waits until the modal shows its content), an optional `root` (the CSS selector the rules measure, `[data-modal-backdrop]` by default) and `skip` |
| `stress` | `{ pr: <variant> }` on a page or tab that shows a table or list: the full matrix crawls it with every [stress variant](#stress-variants), the PR subset with the one named |
| `skip` | `{ rule, reason }` for each rule that does not apply, with the reason |

Each entry yields the surfaces `<id>`, `<id>/<modal>`, `<id>/<subView>` and
`<id>/<subView>/<modal>`, where `<id>` is the entry's `id` or else its `view`, and
`<surface>~<variant>` for each stress variant crawled. That surface
id keys the ledger, the gallery and the test titles. [mobile-routes.md](mobile-routes.md) lists every
entry with its tier, sub-views, modals, fixture set and skipped rules. It is generated from the
manifest: run `npm run docs:mobile-routes` after changing an entry, or `npm run docs:check` fails.

Every public view of the route contract has an entry, with every tab an anonymous visitor sees and
every modal it can open by tapping. History, settings and the other signed-in modals belong to the
role-gated entries (`home:signed-in` crawls Settings). `overlays.spec.ts` covers the overlays the
crawl can't hold or close: the Settings loading placeholder (shown only while its chunk loads),
and those with no named close (`^close`), which `modal-fits`, `scroll-top-after-modal` and
`rotation-recovers` need: the sign-out confirm (Cancel), the boot connection error (Retry) and
dropdown menus (an outside tap or Escape). A modal that needs data a recording may lack, such as WR progression on a map
without a record history, opens through `opensWhenShown`, which leaves the page as it is when the
trigger is not on screen. `watchesReplay` taps the visible replay buttons in turn, closing "Replay
not available" until a replay video opens. When either leaves no modal open, the rules that measure
the modal's root report `n/a`, but `rotation-recovers` fails with "the modal is not open". Portrait
entries used to record that where phones showed no trigger, and none remain. On a tiered table the
trigger sits in the card's expand panel: the shared `watchRun` and `wrHistory` modals open through
`withCardsOpen`, which first opens every collapsed "Details" panel on screen, so World Records and
the map page crawl both modals on phones, and the profile's All Caps and Personal Bests crawl the
replay. The Maps page's Demos and reviews (`maps/demos`, `maps/reviews`) open the same way, from
the first panel's Demos button and Community Review. The reviews modal lists the recorded public
reviews; the replay picker shows "No runs found", because the `maps` recording has no leaderboard
for it. The compare page crawls the open Runs drawer (`run-compare/runs`), eight runs
(`run-compare/pov`, which also opens the first roster row's run menu, `run-compare/pov/run-menu`,
a dropdown with no close control, so it skips `modal-fits` and `rotation-recovers`) and two team
runs (`run-compare/teams`).
Playwright's Windows WebKit can't decode the synthetic `data:` WebM (`MediaError` 4), so there
every compare tile drops to a graph-only lane and the surfaces crawl lanes instead of tiles. The
map page's `maps-detail/compare-selection` ticks the first leaderboard box. Event tabs that show only while signups are open (`players`, `signup`) are not crawled on
the public event; the staff-only `manage` and `stream` tabs are crawled by `event-detail:manager`.

**Contract.** `routes.contract.test.ts` (Vitest) fails when a route-contract view has no entry,
when an entry names a view the contract does not have, when one of the role-gated entries below is
missing, and when an `ADMIN_SECTIONS` section has no `admin` sub-view. A new route, or a new admin
section, therefore needs its entry in the same change.

#### Role-gated entries

Role-gated entries have `tier: 'role-gated'`, sign in through `storage` (`signedInStorage()` in
`fixtures/synthetic/session.ts` seeds `utbt:webAuth:v1`, and the set answers `/users/me` with the
role), and serve a synthetic set ([Synthetic sets](#synthetic-sets)). `manifest.test.ts` checks
both.

| Entry | Signed in as | Crawls |
|---|---|---|
| `admin` | Admin, so every section shows | Overview, then one sub-view per section in `ADMIN_SECTIONS`, picked in the section `<select>` (or the side nav from `lg`), plus the Anti-Cheat High Cap Delta and Low FPS WRs tabs and the Map Uploads Publishing / Recent and Drift tabs; modals: Maps Management's Difficulty Sync and Map authors (both tabs), Anti-Cheat's shared-identifier detail |
| `home:signed-in` | a user | the signed-in Home, the Recent Caps History modal (See More) and Settings (drawer, user card menu) |
| `maps:signed-in` | a user | the Maps page with the viewer's medals, PBs and reviews in the cards and table |
| `event-detail:manager` | an event manager (`/tournaments/<slug>/me` with `can_manage`) | the Manage tab and its Signups, Format, Bracket, Matches (plus the match editor), Picks & Bans, Schedule and Predictions sub-tabs, and the Stream tab as a manager sees it |
| `match-pickban:captain`, `match-pickban:manager` | the lobby's acting captain; a manager | the pick/ban page with the captain's dock, and with Match Control |

A role-gated tab or modal on a public view goes in a `<view>:<who>` entry of its own, in its own
module, and in `ROLE_GATED_ENTRIES` in the contract test.

### Fixture router

`serveFixtureSet(page, name)` in `fixtures/router.ts` serves the entry's set. A set is a list of
routes `{ host: 'api' | 'gateway', path, reply }`. `path` is an exact path without a trailing slash,
or a `RegExp`; `reply` is a response or a function of the request URL, and `ok(data)` wraps the
`{ success, data }` envelope. An API request no route answers falls back to `mockApi` from
`e2e/sidebarRail.ts`. Any other request off the dev server gets a blank PNG (images) or a 404, so no
request leaves the machine. WebKit's `<video>` loads skip that route, so every replay read's remote
`mp4_url` is swapped for the repo's test WebM as a `data:` URL (`withLocalReplayVideo`,
`fixtures/playableVideo.ts`): a recorded live video URL would make a surface wait on the network.
`fixtureSetNamed(name)` in `fixtures/index.ts` resolves a set name, and
`<set>~<variant>` resolves to that set with a stress variant applied to every reply.

### Test data

Public entries are served **recorded** sets: snapshots of public API responses in
`e2e/mobile/fixtures/recorded/<set>.json`, one file per set named in `RECORDED_SETS`
(`fixtures/index.ts`). A file holds `{ set, responses }`; each response is `{ host, path, query,
status, body }`, sorted by host, path and query. `fixtures/recording.ts` turns a file into a set. A
request gets the response with the same path and the same query, whatever the parameter order, or
else the response for that path whose query shares the most parameters. That keeps date-stamped
queries (the Maps page's "new since" filter) and later pages answered after the clock moves on.
Role-gated entries use [synthetic sets](#synthetic-sets).

**Refresh** with `npm run test:mobile:refresh-fixtures`, or `-- -g <set>` for one set. It runs
`e2e/mobile/refresh-fixtures.ts` under `e2e/mobile/refresh.config.ts`: the dev server on
`E2E_PORT`, a Chromium phone at 390×844 and again at 844×390 (so triggers shown only from
landscape up, such as table-row replays, record their data), and every public entry's PR-subset
surfaces opened with the entry's own steps. Each GET to the public API goes out without
credentials, cookies or cache validators, and its answer is recorded; nothing else leaves the
machine. It writes one file per set, so a re-run reproduces the same layout and the diff shows only
what the API now says. When a surface no longer opens, it still writes the file and then fails:
the entry's ids or `ready` step name data the API no longer has, so update the entry.

The script records only public data the site already shows:

- `fixtures/scrub.ts` drops every field whose key names a credential, contact or hardware value
  (token, secret, password, email, hardware or machine id, MAC address, fingerprint, cookie, API
  key), the admin anti-cheat values whose names the shared API types declare (`btpog`,
  `client_cap_delta`, `set_fps`), and every field name the public client never reads
  (`fixtures/client-fields.ts` collects the identifiers in `app/`, admin pages excluded). It
  replaces each IPv4 address with its own `192.0.2.<n>` and an email address inside text with
  `[email removed]`.
- A list longer than 300 items is cut to 300, keeping the items other responses in the set mention.
- Before committing a refresh, grep the files for tokens, emails, IP addresses and hardware ids. The
  only addresses allowed are the `192.0.2.0/24` replacements.

### Synthetic sets

Role-gated entries never serve recorded data, and the compare page needs videos and team reads no
recording holds. Their sets are built in code in
`e2e/mobile/fixtures/synthetic/` and listed in `SYNTHETIC_SETS` (`synthetic/index.ts`), which
`fixtures/index.ts` registers beside the recorded sets:

| Set | Module | Serves |
|---|---|---|
| `admin` | `admin.ts` | every admin section's reads, paged by `limit`/`offset` with realistic totals |
| `run-compare` | `run-compare.ts` | the public compare page: the recorded `cap-detail` responses plus five synthetic cap details (eight solo runs), two synthetic team runs with their team leaderboard and a team read, and a playable video for every run as a `data:` URL in `mp4_url`, because the crawl keeps every non-local host offline |
| `event-manager` | `event-manager.ts` | a managed event with three stages from the standings scene builders, teams, staff, queue, windows and audit |
| `match-pickban-captain`, `match-pickban-manager` | `pickban.ts` | the lobby state from the pick/ban veto golden fixtures, seen by a captain and by a manager |
| `home-signed-in` | `signed-in.ts` | the viewer's summary, caps history, medal hunt and reviews to write, over the recorded `home` set |
| `maps-signed-in` | `maps-signed-in.ts` | the viewer's best caps on the first page's maps and two of their own reviews, over the recorded `maps` set |

- Builders are typed with the app's API types, so a contract change breaks `typecheck:e2e`.
- Identities are synthetic: long player ids start `9000000000` (`syntheticId`), the reused golden
  fixtures keep their short made-up ids (`Player 2000`…), aliases are made-up word pairs, IPs come
  from the documentation ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), hardware
  ids are `FAKE-HWID-<n>-0000-0000-TEST`, and maps are `CTF-BT-Test<Word>`. No real anti-cheat data.
- Every optional field is filled, so the default set is the most-columns case; volumes match a live
  dashboard (a full page of 50 rows, totals in the thousands).
- Times are relative to the moment the set loads. A row the table shows as a relative time ("2h
  ago") sits at least an hour back, so the text can't tick between the crawl's desktop read and
  its card read.
- `synthetic/synthetic.test.ts` (Vitest) fails on an IP outside the documentation ranges, a
  hardware id that is not obviously fake, a player id without the synthetic prefix, an email
  address or a token in any synthetic route.

### Stress variants

`fixtures/stress.ts` derives four variants from any set, so they need no recording of their own:

| Variant | Every reply |
|---|---|
| `long-text` | aliases, names, titles and hostnames in list rows get a long suffix, map names a longer one; ids, numbers and detail objects stay as they are |
| `most-columns` | in each list, every row's empty optional field is filled from another row, so every optional column shows |
| `empty` | every list is emptied and every `count` is 0 |
| `single-row` | every list keeps its first row and every `count` is at most 1 |

An entry or tab opts in with `stress: { pr: <variant> }`. The full matrix crawls every variant there
(`<surface>~<variant>`); the PR subset crawls the default set plus the one variant named.

### Rules

Each crawl test opens one surface at one viewport on one engine, with a 60 s base timeout (WebKit
needs about 20 s for a large recorded page, and close to 30 s on a busy machine). It waits for the
layout to settle: fonts loaded, on-screen images complete, no finite animation running, and the same
layout signature for three animation frames. Then it runs each rule as a `test.step`: first the
rules that only measure, then the gallery shot, then the interaction rules, which widen the page,
close the modal, scroll, navigate or rotate, in the table's order. Crawl tests are marked
`test.slow()`, which triples that to 180 s. Boxes are measured against `window.visualViewport`. On a
modal surface, tap targets, form controls, axe, `modal-fits` and the table rules measure only the
modal's root, and the top bar rule does not apply. An interaction rule that throws, for example
because a tap target never appears, reports `fail` with "the rule could not finish" instead of
ending the test.

When the error boundary or the dev server's error overlay shows while a surface opens, the crawl
stops opening it and runs the rules on what is on screen. A crash then fails `no-error-boundary`,
which the ledger can list, instead of timing out in `ready`. If that leaves a modal surface without
its modal, the rules that measure the modal's root report `n/a`.

| Rule | Passes when |
|---|---|
| `no-horizontal-overflow` | the document, `body` and `main` scroll at most 1 px sideways, the document fits the visual viewport's width, and the visual viewport is not zoomed |
| `top-bar-visible` | below 1024 px, the top bar (the hamburger's fixed ancestor) and the "Open navigation" button sit inside the visual viewport, and the point at the hamburger's centre hits the hamburger. It does not apply from `lg` up or with a modal open |
| `no-error-boundary` | no "Something went wrong" heading and no dev server error overlay |
| `axe-critical-serious` | no critical or serious axe violation under the WCAG 2 A and AA tags, with `color-contrast` off as in `e2e/responsive-accessibility.spec.ts` |
| `form-controls-16px` | every rendered text input, select, textarea and contenteditable has a computed font size of at least 16 px (every crawl device is touch) |
| `tap-targets-44px` | every rendered, enabled link, button, input, select, summary and ARIA widget is at least 44×44 px. A link inside a sentence is exempt, and a checkbox or radio is measured by its label |
| `modal-fits` | on a modal surface, the top-most modal's box sits inside the visual viewport, points along its top and bottom edges hit the box, and its close control (a button whose label or text starts with "Close") sits inside the visual viewport with `elementFromPoint` at its centre hitting the control. `n/a` on a page surface |
| `table-shows-every-column` | on touch, each table the surface shows at desktop width either shows every non-decorative column (a labelled column by its header, an unlabelled one by its cells' content in the first rows) or renders cards; one that shows neither fails. `n/a` when every table renders cards or none shows at desktop width ([Tables and cards](#tables-and-cards)) |
| `cards-expose-every-column` | each of the first three cards holds every non-decorative value of the same desktop row, on its face or once its expand control is open. `n/a` when no table renders cards, or no desktop rows to compare them with ([Tables and cards](#tables-and-cards)) |
| `scroll-top-after-modal` | on a modal surface, tapping the close control closes the modal, and after a swipe that moves the page down one viewport height and a swipe back to the top the page is at the real top (below). A down swipe that scrolls nothing while `main` holds more than it shows fails, so a page left locked by the modal is caught. If the tap fails or the control can't be tapped, Escape closes the modal and the detail says so; a modal neither closes fails. `n/a` on a page surface |
| `back-restores-scroll` | on a page surface, after a swipe of one viewport height, a new navigation through the drawer (to World Records, or Home from World Records) starts at the top, and Back returns the swiped scroller to within 4 px of where it was, measured once the surface's own `ready` (its tab's or sub-view's, else the page's) holds again. `n/a` on a modal surface or when nothing scrolls |
| `rotation-recovers` | after the viewport's width and height are swapped, a modal surface's modal (reopened if an earlier rule closed it) still passes the `modal-fits` checks and closes, and after a swipe that moves the page down one viewport height, scrolling to the top reaches the real top. The page stays rotated, so this rule runs last |

**The real top** means the window and the visual viewport sit at 0,0, `main` and every rendered
scroller inside it are at 0, the first element in `main` that shows text or media is inside the
visible area and not covered, and below 1024 px the hamburger is inside the visible area and its
centre hits it. **Scrolling** is a simulated swipe (`swipeScroll` in `e2e/mobile/interactions.ts`):
starting from the element at the centre of the visual viewport, it scrolls each user-scrollable
ancestor in turn until the distance is used up, the way a touch scroll chains. An element with
`overflow: hidden` or `clip`, including `html` and `body`, is not user-scrollable, so a page stuck
in one is caught. Playwright has no touch-drag API, so this is the closest it gets. **Rotation** swaps
`page.setViewportSize`; no engine fires a real orientation change.

A rule returns `pass`, `fail` or `n/a` plus detail lines. To add one, put its id and label in
`rules/ids.ts` (with `changesPage: true` if it changes the page, so it runs after the gallery shot),
its check in `rules/<id>.ts` and the pair in `rules/index.ts`. Then seed the ledger with the
failures that predate it.

#### Tables and cards

The two table rules share one observation per crawl test (`rules/observe-tables.ts`), and the
judging is pure (`e2e/mobile/tables.ts`, unit-tested in `tables.test.ts`):

1. The page is widened to 1920×1080. Each rendered `<table>` that is not inside another table
   (inside the modal's root on a modal surface) gets its header labels and the values of its first
   three body rows. A value is a line of a cell's visible text, or, for a cell with no text, its
   images' `alt` and its labels. Values without a letter or digit (`—`) don't count. A control
   with no text is a control value: it is named by its `aria-label` or `title`, its Lucide icon
   (`lucide-play`) and, when it is the cell's only such control, its column's header label. Only a
   control on the card with one of those names (as its label, title, text or icon) holds it, and
   the control's own label is not asked for again as text. A card that prints "Watch" without a
   Watch button fails, and one "Actions" menu doesn't stand in for a Play and a Download button.
2. Each layout change waits for the page to hold still for 400 ms, because the table shell's width
   hook debounces resizes by 150 ms and `settleLayout` alone returns before the switch.
3. Back at the crawl's size, the same table shell (the `<table>`'s parent) shows a `<table>`, a
   `role="list"` of cards, or nothing. The shell's outermost tables and lists are counted in order,
   and each table takes the one at its desktop position, so two tables under one parent stay apart
   even when only one turns into cards.
4. Card N is read, then every collapsed expand control in the first three cards is tapped, and the
   cards are read again after each tap; what any read finds counts, so a list that remounts on the
   tap doesn't lose its face, and cards that open one at a time keep what each one showed. Card N's text, its labels and controls, plus the panels its open controls name in
   `aria-controls`, must hold every non-decorative value of desktop row N. Text is read both as
   rendered lines and as separate text nodes, so `<span>3</span><span>caps</span>` holds `3`. A
   value matches only as a whole word: case is ignored, any run of whitespace (line breaks too)
   counts as one space, and the text either side must not be a letter or digit, nor a `.`, `,` or
   `:` that joins it to another number. So a rank `1` is not found in `21`, a difficulty `5` not in
   `4.5`, and `1` and `2` on separate lines don't read as `12`.
5. The cards are collapsed again, and the viewport and every scroll position are put back, so the
   interaction rules after these two see the surface as it was. A card that stays open fails both
   rules, and a failure while reading doesn't hide behind the clean-up.

What the crawl expects of a card, so later card work passes these rules without changes:

- The cards' `role="list"` sits inside the table's parent, at the table's place among that
  parent's tables and lists; wrappers around it are fine. Cards are its outermost
  `role="listitem"` or `<li>` elements, in the table's row order.
- The expand control is a button (or `role="button"`) with `aria-expanded`, and no
  `aria-haspopup`; a dropdown trigger is not an expand control. The panel sits inside the card, or
  the control's `aria-controls` names it.
- An icon-only action on desktop is a control on the card too: the same icon, or a control labelled
  with the action's name (or the column's header, when the column holds that one action only).
- A value may read differently on a card only by case or by how much whitespace separates its
  words: a card that says "2d" for the table's "2 days ago" fails.

Decorative columns are declared per manifest entry
([Mobile route manifest](#mobile-route-manifest)). Today they are the thumbnail columns of Maps, the
server browser and the History modal. A list that desktop shows only in a hover card, such as a
server's player names, is not in a cell, so these rules can't see it; `player-server-cards.spec.ts`
checks the server panel's name lists instead.

### Interaction specs

Every other `e2e/mobile/*.spec.ts` drives one flow on the crawl's harness: it serves a manifest
entry's fixture set, opens its path, waits for `ready`, `settleLayout` and `installProbe`, then uses
the helpers in `e2e/mobile/interactions.ts` (`checkModal`, `closeModal`, `rotate`, `swipeScroll`,
`swipeOneViewport`, `scrollToTop`, `scrollDownThenToTop`, `stuckPageProblems`, `scrollerTop`,
`scrollPositionProblems`, `topOfPageProblems`, `tapCentre`, `zoomVisualViewport`). An interaction
spec that is red today is marked `test.fail()`, with a note naming the ticket that flips it.

- `owner-repro.spec.ts`, the owner's reported bug, replayed on the replay video modal
  (`cap-detail`'s `watch-replay` modal; the Compare runs modal it was first seen on is gone): the
  cap page, landscape, zoom in and out, portrait, then the close control closes the modal, the hamburger opens the drawer and a swipe scrolls the page back to the
  real top. It passes in emulation since the shared modal opens as a sheet portalled above the top
  bar; what a real pinch and rotation leave behind on iOS stays on the manual iPhone checklist.
- `event-table-cards.spec.ts`: the tiered event tables. Group standings and the predictions
  leaderboard appear on no crawl surface (the fixture's bracket opens on its Swiss stage, and the
  leaderboard is a view inside the Predictions tab), so it opens them on the `event-detail/bracket`
  and `event-detail/predictions` surfaces and runs the two table rules at every PR-subset viewport
  (the leaderboard rows are synthetic). At 390×844: a standings card has one control, its
  "Details" chevron, whose panel holds Maps, Diff, Caps and the team's matches; at 1920 px a
  standings row still reveals the matches; a standings card body opens the team's event page.
  A sort field and direction picked on the team runs cards reorder them and show as the Time
  header's `aria-sort` at 1920 px. The map profile and runs panels hold their detail columns.
- `modal-sheet.spec.ts`: a page modal opens as a sheet over the top bar that fills the visible area
  in portrait and at 844×390, and a swipe inside a sheet scrolls only its body while the header and
  close stay in view.
- `modal-lock.spec.ts`: a tapped-open sheet holds the shell scroller and the window still through a
  swipe over it; closing it returns focus to the tapped opener (WebKit doesn't focus a tapped
  button, so this covers the Safari path) and the shell scroller takes a swipe again. A sheet opened
  by a tapped button inside a sheet returns focus to that button, not to the panel WebKit focused.
- `overlays.spec.ts`: the overlays that aren't plain manifest modals, at 390×844 and 844×390. The
  sign-out confirm, the Settings loading placeholder (its chunk held), the consent banner's privacy
  policy and the lazy-modal loading spinner draw over the top bar; the tutorial card stays below
  it; the connection error at boot covers the visible area. Each box sits inside the visible area
  with its close (Cancel, Retry) on top, a swipe over it moves neither `main` nor the window, and
  after it closes `main` takes a swipe again. A multi-filter dropdown and a `modal={false}` menu
  fit the visible area and hold the page still too. Signed-in overlays sign in by seeding the
  stored login and answering the profile request.
- `overlay-history.spec.ts`: Back closes the open drawer and keeps the page, and the next Back
  goes to the previous page; a drawer link takes the drawer's history entry, so the page it
  opens adds one entry; closing the drawer from its backdrop leaves no entry behind; Back
  closes an open sheet (the replay video modal) before it leaves the page. History entries are
  counted with `history.length`, and a closed overlay's entry with `history.state`.
  `e2e/overlay-history.spec.ts` runs the modal cases on `desktop-chromium` and
  `mobile-chromium`: one modal, stacked modals, a close button then Back and Forward, and a
  link inside a modal. `e2e/history-leave-guards.spec.ts` adds the guarded page with Settings
  open.
- `admin-cards.spec.ts`: the tiered admin tables at 390×844, signed in as staff through the
  `admin` entry. Each table's main action works from its card: Manage opens the user, the title,
  patch and news editors open, a draft opens and a publish is selected (both by the request they
  send; the `admin` set serves no single draft or publish), and a recent user's card body opens
  the player. Caps selection works on the cards (a 44 px checkbox target, Select all on this
  page, the bulk bar), and Disallow opens its confirm. Each panel lists the table's detail
  columns; Drift lists every location. Audit Logs opens the entry's details, with Roll back,
  in the card panel, and at 1920 px in a single-cell expand row under the table row; an Actor
  column hidden in Columns is still listed once in the card panel. A sort
  picked on the User Management cards is sent with the request and shows as the header's
  `aria-sort` at 1920 px, where the Columns menu is back. Maps Management: Edit opens the
  editor, the card sort is sent with the request, and the card body opens the map; Difficulty
  Sync's selection works on its cards. Map Authors: Review and Unlink sit on the cards, and the
  review and re-credit lists never scroll sideways. Anti-Cheat: a shared-identifier card opens
  the identifier's detail, whose cap cards open the cap; High Cap Delta and Low FPS WRs keep
  row selection on the cards, their actions open the confirms, a card body opens the cap stats,
  and its percentile cards show FPS and ping on the face. A card body is tapped on a spot of the
  face outside its controls.
- `player-server-cards.spec.ts`: the tiered Players, Cap It All and Servers tables at 390×844.
  A server card keeps name, players n/max, flag and status on its face, and its panel lists the
  player and spectator names with the spectator count. A sort field and direction picked on the
  Servers and Players cards reorder the cards (Players: the request carries the new sort) and show
  as the header's `aria-sort` at 1920 px. The Players face holds rank, points and WRs; the panel
  lists Role, the four medal counts and Member Since, and the card sort every sortable column,
  although the medals and Member Since are hidden on the table by default. At 844×390 the Players
  table stays a table with its five shown columns rather than switching to cards for the hidden
  ones. The Cap It All face holds the certified percentage with the three breakdowns in the
  panel and no sort control. Tapping a Players or Cap It All card body opens the player.
- `pull-to-refresh.spec.ts`: on Maps with the New maps filter set, a short pull shows the
  indicator and refreshes nothing. A pull past the threshold shows the spinner below the top
  bar while the refetch is held, refetches the maps' data, and keeps the filter. The event
  team page, which registers no refresh, re-mounts in place and fetches again. No indicator
  and no request follow a pull while `main` is scrolled down, while the Maps tutorial or a
  dropdown menu holds the scroll lock (the page heading still takes the touch), or when the
  pull starts on an injected `touch-action: none` strip or sideways scroller. Each of these
  tests ends with a pull that does refresh. On Chromium the pull is real touch input
  (`Input.dispatchTouchEvent`), so it also proves the native pan is cancelled. WebKit has no
  touch-drag input, so there the pull is synthetic touch pointer events on the element under
  the start point. `e2e/pull-to-refresh.spec.ts` checks that on desktop, at 1280 and 1920, a
  mouse drag or a touch-type pointer drag (a touchscreen laptop) down at the top of Maps shows
  no indicator and refreshes nothing.
- `screenshot-viewer.spec.ts`: at 390×844 and 844×390, tapping the map hero opens the screenshot
  viewer, which fetches its chunk only on that tap. Its close is in view and on top, a swipe over
  it moves neither `main` nor the window, and a two-finger spread and a double tap zoom the
  screenshot while `visualViewport.scale` stays 1. On Chromium the spread is real touch input
  (`Input.dispatchTouchEvent` with two touch points), so it also proves the page doesn't zoom;
  WebKit has no multi-touch input, so there the spread is synthetic pointer events on the frame.
  The double tap uses the touchscreen on both engines. `e2e/map-screenshot-viewer.spec.ts`
  checks that desktop keeps the plain hero and that Change still opens the screenshot editor.
- `tap-tooltips.spec.ts`: a tap on the Rank pill of a player's page opens its tooltip; a tap on the
  page heading, a second tap on the pill, and a scroll made by code each close it. A tap on the
  disabled Watch in an unverified cap's card panel opens "No replay — cap not verified" and stays on
  the page. Signed in with a team of their own, a viewer of an open team sees Join disabled with
  "Leave your current team to join" inline, and a viewer invited to a team sees Accept disabled
  with "Leave your current team to accept" inline. A team owner's Manage Members modal labels its
  promote and kick buttons in text, and each Team Cap Detail roster member shows its run status as
  text. None of them opens a floating tooltip.
- `bottom-tabs.spec.ts`: at 390×844, each tab opens its page and is the only one with
  `aria-current="page"`, a map's page highlights Maps, Menu opens the drawer and a drawer link
  closes it, and with `main` scrolled to the bottom no element of the content ends below the
  tab bar's top, nor do the first-visit Tutorial card and consent banner. At 844×390, and after
  turning to it, there is no tab bar. A swipe to the left that starts on a drawer link closes
  the drawer, whose `touch-action` is `pan-y pinch-zoom`; a vertical drag leaves it open; a
  short swipe held still before release springs back, and Enter on a drawer link still
  follows it afterwards; a drag in from the left screen edge doesn't open it. On Chromium the
  drags are real touch input (`Input.dispatchTouchEvent`), so they also prove the drawer's
  `touch-action`; on WebKit they are synthetic pointer events. Neither engine sends a click
  after a touch drag, so the click-swallow test fires synthetic pointer events and then the
  click a mouse release would send, on both engines, and checks the link isn't followed. `e2e/bottom-tabs-desktop.spec.ts`
  checks that `desktop-chromium` at 1280 and 1920 has no tab bar and the same sidebar.
- `hide-on-scroll.spec.ts`: at 390×844, a finger scroll down Maps slides the top bar and the tab
  bar out of the visible area together, a scroll back up brings both back, and an 8 px nudge
  leaves them, as does a tap followed at once by a scroll made by code. Scrolling `main` to its
  top by code shows them; tapping a map opens its page with
  both shown, and Back restores Maps' position with them still shown; closing the Playtime modal
  on a map page shows them. At 844×390 the top bar hides and comes back the same way. On
  Chromium the scroll is real touch input (`Input.dispatchTouchEvent`), held still before the
  finger lifts so no fling swallows the next tap; on WebKit it is a synthetic `touchstart` and
  `touchmove` on the content with a `scrollBy` and a `scroll` event per step. Each move waits
  for `main` to stop moving. `e2e/hide-on-scroll-desktop.spec.ts` checks that on
  `desktop-chromium` at 1280 and 1920 a wheel scroll leaves the sidebar where it was, and that
  a 900 px window on a pointer device keeps its top bar in view while it scrolls.
- `scroll-restore.spec.ts`: a cap page opened from a tapped link on the map page starts at the
  top; Back and Forward return each page to within 4 px of where it was left; a new visit to a
  page already in history starts at the top again. The same holds for two list pages, World
  Records and Maps, reached through the drawer. It serves two recorded sets at once; the first
  entry's set answers a path both know. `e2e/scroll-restore.spec.ts` runs the cap and map flow
  on `desktop-chromium` with real wheel input.
- `table-cards.spec.ts`: the tiered World Records tables on a phone. The card's "Details" chevron
  is at least 44 px and opens its panel in place (Difficulty, Date Set, Actions; Median WR and
  Average WR on Top Rushers) without leaving the page, while a tap on the card body away from its
  controls opens the map (or the rusher). A sort field and direction chosen on the cards show as the
  header's `aria-sort` once the page is widened to 1920 px, and come back on the cards, with the
  card that was open still open; switching to Top Rushers and back closes it. Cards stack one per
  row at 430×932 and 440×956 and sit two per row at 744×1133 and 844×390.
- `team-manage-cards.spec.ts`: the tiered team and Manage tables at 390×844. A team world record
  card keeps holder, map and time on its face, with Difficulty and Date in the panel, and its body
  opens the cap; a team activity card keeps player, type, map and when, with Result in the panel,
  and its body opens the cap, or the player for a playtime item.
  Both sort from the cards (world records: the request carries the new sort; activity: the cards
  reorder) and show it as the header's `aria-sort` at 1920 px. Signed in as the event manager, a
  Matches card keeps match, status, Edit and Picks & Bans on its face: Edit opens the match editor,
  the panel's streamer picker saves an assignment, and Picks & Bans opens the match page. A pick/ban
  queue card keeps match, status and its actions, with stage, schedule, streamer and Ready / Online
  in the panel, and Open Page opens the match page. Both manage cards' bodies open the match page.
- `leaderboard-cards.spec.ts`: the map leaderboards on a phone. A solo card shows rank, medal and
  time on its face and Team, Date, Watch replay and Download demo in its panel; Watch opens the
  replay video and Download fetches the card's demo (the demo read is routed in the spec). The
  card sort flips the shown ranks, and a field picked on the cards shows as the header's
  `aria-sort` at 1920 px. A team card's panel holds Status and Date, and its sort lists Rank, Team
  Time and Date.
- `home-records-cards.spec.ts`: Home's Latest World Records on a phone. It takes a team record
  with more than one member from the recorded `home` set, and checks that its card names every
  member.
- `viewport-recovery.spec.ts`: emulation never leaves the window offset the way iOS does, so the
  spec makes the document taller than the viewport and scrolls the window (or `body`) itself.
  The shell then puts it back to 0,0: after the zoom simulation returns to scale 1 (Chromium
  only; while zoomed in the offset stays), at scale 1 on both engines, and, while a text field
  has focus, only once focus leaves it.
- **WebKit delivers `scroll` events for script scrolls late**, sometimes only with the next
  scroll. Wait on positions (`scrollerTop`, `expect.poll`), never on a scroll event.
- **Zoom is simulated.** No engine can emulate a real pinch. On Chromium, `zoomVisualViewport` sets
  the page scale through the DevTools protocol (`Emulation.setPageScaleFactor`) and waits for
  `visualViewport.scale` to follow. It cannot pan the zoomed view, because headless Chromium ignores
  synthesized pinch and scroll gestures. WebKit has no page-scale API, so the step only notes that it
  was skipped (a `zoom simulation` annotation says which). The scale iOS keeps after a pinch, and
  iOS's zoom on focusing a control under 16 px, are left to the manual iPhone checklist in
  [mobile.md](mobile.md).

### Known-violations ledger

`e2e/mobile/ledger/<rule>.json` holds one file per rule, with one `{ surface, viewport, engine }`
per line, sorted. The crawl judges each rule result against it:

| Result | Listed | Outcome |
|---|---|---|
| `fail` | yes | known: reported in the gallery, the test passes |
| `fail` | no | new: the test fails with the rule's detail lines |
| `pass` or `n/a` | yes | stale: the test fails with "remove this entry from e2e/mobile/ledger/<rule>.json" |
| `pass` or `n/a` | no | pass |

A rule the manifest skips does not run, so it never judges. `e2e/mobile/manifest.test.ts` (Vitest)
fails on an entry for an unknown surface, viewport or engine, for a rule the manifest skips there, on
a duplicate, and on a file for an unknown rule.

**Regenerate** with `npm run test:mobile:ledger`, or `npm run test:mobile:ledger:full` for the full
matrix, narrowed with `-- -g` if you like. The gallery reporter writes the ledger, so a `--reporter`
override must keep `./e2e/mobile/gallery-reporter.ts`. The run rewrites only the surface, rule,
viewport and engine combinations it ran: failures go in, passes come out, and everything it did not
run stays. The PR subset is seeded for every surface, role-gated ones included. The full matrix is
seeded only for `home`, `maps`, `maps/new`, `cap-detail` and the `news`
stress variants at the viewports outside the PR subset, and those entries predate the modal,
rotation, scroll, table and card rules and, for all but the `news` variants, the recorded data.
Role-gated surfaces have no full-matrix entries yet. The other stress variants the PR subset does
not crawl hold only the entries of a partial run. Seed the rest with
`npm run test:mobile:ledger:full` before a full run gates anything.

- A fix deletes the entries it fixes, by hand or by regenerating after the fix.
- Only a failure that predates your change goes in. Fix a regression your change caused instead of
  listing it.
- On a merge collision in a ledger file, regenerate; never hand-merge.

### Gallery

After a run with mobile suite tests, `test-results/mobile-gallery/index.html` opens in a browser. It
shows a tally per rule, then every surface at every engine and viewport: the viewport screenshot in
CSS pixels, each rule's outcome with its details, and the run time. `observations.json` beside it
holds every rule result. The terminal prints the same tallies and the time per surface.

`e2e/mobile/gallery-reporter.ts` writes it, and the config loads that reporter for every run.
`--reporter` on the command line replaces the config's reporters, so list
`./e2e/mobile/gallery-reporter.ts` among them when you pass one. The gallery is never committed and
never compared against baselines; every run clears `test-results/`. CI uploads it as an artifact
([CI](#ci)).

### Dev server drops

When the server refuses a document, script or stylesheet while a surface opens (the Windows
socket flake in [When the gate fails](#when-the-gate-fails), seen on the dev server), the crawl prints
`mobile crawl: the dev server dropped …` and reopens the surface once; the dropped attempt takes no
further steps. A second drop fails the test.

## CI

| Workflow | Trigger | Runs |
|---|---|---|
| `.github/workflows/ci.yml`, job `Fast gate` | pull request into `staging` or `main`, push to `staging`, manual (Run workflow) | Windows, Node 20: `npm ci`, `typecheck:web`, `typecheck:e2e`, `lint`, `test` (Windows-only suites included), `docs:check`, `build:web`, `check:bundle`, one step each |
| `.github/workflows/ci.yml`, jobs `Playwright (1/6)` to `Playwright (6/6)` | the same | Ubuntu, Node 20: `npm ci`, `npx playwright install chromium`, `bash scripts/ci-linux-fonts.sh` ([Linux fonts](#ci)), then `desktop-chromium` and `mobile-chromium` split across six parallel jobs (`--shard=<n>/6`); on failure each shard uploads its `playwright-report/` and `test-results/` as artifacts |
| `.github/workflows/ci.yml`, job `Broadcast scenes` | the same | Windows, Node 20: the `broadcast` project alone, because its screenshots compare against the `-win32` baselines; on failure it uploads `playwright-report-broadcast` and `playwright-test-results-broadcast` |
| `.github/workflows/ci.yml`, jobs `Mobile suite (chromium 1/3)` to `(chromium 3/3)` | the same | Ubuntu, Node 20: `npm ci`, `npx playwright install chromium`, `bash scripts/ci-linux-fonts.sh`, then `npx cross-env E2E_SERVER=build playwright test --project=mobile-suite-chromium --workers=3 --shard=<n>/3`: `npm run test:mobile` (the PR subset on the built bundle, mocked data only, [Mobile suite](#mobile-suite)) narrowed to Chromium. Whatever the result, each shard uploads its gallery as `mobile-gallery-chromium-<n>` and its HTML report as `mobile-playwright-report-chromium-<n>` |
| `.github/workflows/ci.yml`, jobs `Mobile suite (webkit 1/8)` to `(webkit 8/8)` | push to `staging`, manual (Run workflow); skipped on pull requests | Windows, Node 20: the same with `npx playwright install webkit` and `--project=mobile-suite-webkit --shard=<n>/8`, uploading `mobile-gallery-webkit-<n>` and `mobile-playwright-report-webkit-<n>` |
| `.github/workflows/ci.yml`, job `Mobile suite` | after the mobile shards | Ubuntu: passes when every Chromium shard passed and the WebKit shards passed or were skipped (on a pull request), so `Mobile suite` is the one check name to require |
| `.github/workflows/mobile-nightly.yml`, jobs `Mobile full matrix (1/12)` to `(12/12)` | daily at 03:00 UTC on the default branch, manual (Run workflow, any branch) | Windows, Node 20: the same install, then `npm run test:mobile:full -- --workers=3 --shard=<n>/12`; each shard uploads its gallery as `mobile-gallery-full-<n>` and its report as `mobile-playwright-report-full-<n>` |
| `.github/workflows/web.yml` | push to `main`, manual | Ubuntu, Node 20: `npm ci`, `npm run quality:web` (`typecheck:web`, `typecheck:e2e`, `lint`, `test`, `build:web`, `check:bundle`), then a deploy that waits for approval |
| `.github/workflows/release.yml` | push to `main` | Windows: builds and publishes the installer when the `package.json` version has no tag yet, plus a copy under the stable name `utbt-launcher-setup.exe` that `DESKTOP_APP_DOWNLOAD_URL` points at; no tests |

`ci.yml`'s Windows jobs turn off `core.autocrlf` before checkout (Linux checks out LF already), so the runner gets each file's committed line
endings, as a local checkout does. A newer push to the same pull request cancels its run in
progress; runs on `staging` finish, so every merged commit gets a result.
GitHub sets `CI`, so Playwright runs with 1 retry, `forbidOnly` and the `github` reporter
([Projects](#projects)); the `Playwright` jobs add `--reporter=list,github,html`, so the log shows each test as
it finishes and a failure leaves an HTML report. One retry still absorbs a one-off flake, and a test
that fails for real stops after two attempts instead of three. The full suite takes too long for one
runner, so it runs as six shards. Download the failing shard's `playwright-report-<n>` artifact and open its
`index.html`, or read the images and `trace.zip` in `playwright-test-results-<n>` as in
[Reading a mismatch](#reading-a-mismatch).
`docs:check` runs on a shallow checkout with no history before the tested commit, so in CI it
checks paths, links and the manifest but lists no docs to review; run it locally for that list.

The mobile jobs pass `--reporter=list,github,html,./e2e/mobile/gallery-reporter.ts`: a
`--reporter` option replaces the config's reporters, so the gallery reporter is listed again
([Gallery](#gallery)).
- **Chromium runs on Ubuntu, WebKit on Windows.** Ubuntu runners start and run faster. WebKit stays
  on Windows: on Ubuntu runners it took about 55 s per crawl test, and with 4 workers on 4 cores its
  tests timed out, and one unsharded job ran past 30 minutes.
- **Linux fonts match Windows.** The app sets `font-family: system-ui`, which is Segoe UI on
  Windows and a wider font on Ubuntu, so overflow, fit and scroll-restore checks failed there by
  6 to 15 px. `scripts/ci-linux-fonts.sh` installs Selawik (Microsoft's open font with Segoe UI
  metrics, checked against a pinned SHA-256) and points fontconfig's `system-ui`, `sans-serif` and
  `sans` at it. Regular and bold measure within a pixel of Segoe UI; semibold runs about 1.5 %
  wider, and `font-medium` falls back to regular on Linux where Windows draws it semibold. A
  layout check that passes on Windows and fails only on Ubuntu by a pixel or two is this gap.
- **No `--with-deps` on Ubuntu.** The runner image ships Google Chrome, so Chromium's libraries
  are already there; `--with-deps` only added CJK, Thai and bitmap fallback fonts through apt, and
  the runner's apt mirror sometimes served them at 43 kB/s, holding a job for 8 minutes. If a
  new image drops a library, Chromium fails to launch and names it: add that package in the
  Ubuntu jobs rather than going back to `--with-deps`.
- **WebKit skips pull requests.** It is the slow half: eight Windows shards that took 5 to 27
  minutes on a pull request. It runs on every push to `staging` and on a manual run (Actions →
  CI → Run workflow, pick the branch), and `npm run test:mobile` runs both engines locally, so run
  it before merging a UI change.
- **A stuck step fails fast.** The crawl caps every Playwright wait at 45 s (`STEP_TIMEOUT_MS` in
  `crawl.spec.ts`, set with `page.setDefaultTimeout`) inside the 180 s budget of a slow-marked crawl
  test, so a page that never settles fails in under a minute instead of burning the whole budget on
  every attempt. The error-screen watcher that races the whole surface opts out with `timeout: 0`;
  the cap is per step, and a surface with many steps can run past 45 s in total.
- **Three workers per shard** leave headroom on the runner's four cores.
- **The shard counts** keep each shard near the Playwright shards' time.
- **The run splits by engine first.** Playwright splits shards by test count, not duration, and a
  WebKit test takes several times as long as a Chromium one. So mixed shards that drew the WebKit
  crawl took 25 minutes while others took 4.
  - WebKit gets eight shards and Chromium three, from the same 384 tests each.
  - The nightly full matrix runs as 12 mixed shards. Open a gallery artifact's `index.html` to see every
surface the run crawled, and the report's `index.html` for a failing test's error and trace. A
run splits both across its shards, one gallery and one report per shard. The nightly run gates
nothing: read its failures as ledger entries the full matrix is missing or new regressions at sizes
the PR subset skips.

`Fast gate` and `Mobile suite` are the checks to require on `staging` and `main`. The `Playwright`
shards stay advisory until they have been stable. A branch is ready when the gate in
[build.md](build.md), `npm run test:e2e` and `npm run test:mobile` pass locally, the same commands
the jobs run. `npm run quality:web` reproduces the `main` web job.

## When the gate fails

A gate run after a merge went red. Work in this order:

1. **Find the first failure.** Both runners print each failing test with file and line. For a
   screenshot mismatch, read the images in `test-results/` now; the next run deletes them.
2. **Rerun only it**: `npx vitest run <file>`, or `npx playwright test <spec>:<line> --project=<project>`.
3. **Rule out a known flake** (Playwright on Windows):
   - One random test's page stays blank and times out after 30 s with `net::ERR_NO_BUFFER_SPACE`
     loading `/renderer-web.tsx` or a harness page. That is a local socket error under two
     workers, not the code. Rerun with `npm run test:e2e -- --retries=1` (the config's retry count under `CI`); a
     real failure fails both tries.
   - `layout never overflows the viewport` (`responsive-accessibility.spec.ts`) can fail on a cold
     dev-server start: rerun it.
   - `http://127.0.0.1:5175 is already used`: a dev server from an earlier run is alive. Stop it or
     set `E2E_PORT`.

   Report a recurring flake; keep the timeouts, retries and thresholds in specs and config as they
   are.
4. **Fix the merge.** Each branch passed alone, so look at what the two sides changed together:
   - `npm run typecheck:web` or `npm run typecheck:e2e`: one side renamed a type, field or export
     the other uses; fix the consumer. `tsconfig.web.json` covers `app/`, `lib/` and `resources/`;
     `tsconfig.e2e.json` adds `e2e/` and the two runner configs, so a spec that builds a payload
     with a dropped field fails here instead of at run time (Playwright strips a spec's types).
   - A structure test (table above) after a new page, route or Stream panel: wire it the way the
     test states.
   - A golden fixture pin or key map after both sides touched one area: keep the contract's bytes,
     then re-pin and update the key maps.
   - A spec that enumerates something the merge extended (`PANEL_LABELS` in `stream-tab.spec.ts`,
     rail tiles in the `sidebar-collapse*.spec.ts` files, `publicRoutes` in
     `responsive-accessibility.spec.ts`): extend the list when the addition is intended.
   - A page that now reads an endpoint the spec's mock does not answer: the catch-all hands it an
     empty list or a 404 and the page shows its empty or error state. Add the endpoint to that
     spec's mock.
   - A broadcast screenshot after shared scene CSS or a token changed: decide intended or regression
     as in [Updating a baseline](#updating-a-baseline).
5. **`npm run lint`.** Fix errors in the files the merge touched. ESLint parses each TypeScript file
   through the project in `tsconfig.json`'s `references` that includes it, with no file cap. `was not
   found by the project service` means a new file sits outside every project: add its folder to
   the matching tsconfig's `include`.
6. **`npm run check:bundle`.** Run `npm run build:web` first: the check reads
   `dist-web/.vite/manifest.json`, so a stale build gives stale numbers. The closing
   `Web bundle checks failed` list names each broken budget, chunk or desktop-only marker; the usual
   cause is a static import of something meant to stay lazy, or desktop code reaching the web
   graph. Budgets, lazy rules and capability gates are in [web-target.md](web-target.md). Raise a budget in
   `scripts/check-web-bundle.mjs` only for growth that is intended, and say so in your report.
7. **`npm run docs:check`**: see [build.md](build.md).
