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
| `e2e/mobile/` | the mobile suite: crawl, route manifest, fixture router, rules, known-violations ledger, gallery reporter, and Vitest files for its pure logic ([Mobile suite](#mobile-suite)) |
| `e2e/__screenshots__/` | committed screenshot baselines, one folder per spec file |
| `e2e/streamHarness.ts` | fake API plus open, settle and screenshot helpers for scene specs |
| `e2e/sidebarRail.ts`, `e2e/layout.ts`, `e2e/streamPanels.ts` | shared spec helpers: the catch-all `mockApi`, `horizontalOverflow`, `openStreamPanel` |
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
| `app/components/navigation/routes.contract.test.ts` | every view in `viewToPath` has an entry in `app/public/route-contract.json` and round-trips; `robots.txt` blocks stream pages and leaves every other non-admin route crawlable |
| `app/components/pages/events/stream/streamPanels.test.ts` | Stream tab panels and Match sections keep their order and load only lazily |
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
`streamSides/`) holds API responses as JSON, frozen byte for byte:

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
expect `horizontalOverflow(page)` from `e2e/layout.ts` to be at most 1. Both app projects preload
`utbt:seasonalThemes:v1 = "off"` so seasonal decor stays out of layout checks; `seasonal.spec.ts`
turns it on itself.

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

1. Name it `e2e/<feature>.spec.ts`, or `e2e/<scene>.broadcast.spec.ts` for a scene page.
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
| `npm run test:mobile:full` | every viewport in `e2e/mobile/viewports.ts` on both engines, about 10 minutes locally |
| `npm run test:mobile:ledger`, `npm run test:mobile:ledger:full` | the same two runs in ledger mode: a rule result never fails a test, and the run rewrites `e2e/mobile/ledger/` ([Known-violations ledger](#known-violations-ledger)) |

Narrow a run with `-- -g <surface or viewport>`, for example `npm run test:mobile -- -g cap-detail`
or `-g 390x844`. All four read `E2E_PORT` through the config, and all four crawl the built bundle
([Built bundle](#how-specs-reach-the-app)); `npx playwright test e2e/mobile/...` without a script
crawls the dev server. WebKit must be installed: `npx playwright install webkit chromium`.

The projects are `mobile-suite-webkit` (iPhone 14 base) and `mobile-suite-chromium` (Pixel 7 base),
both with touch and `isMobile`, seasonal decor off, and each test at its own viewport and screen
size. `MOBILE_MATRIX=full` (set by the `:full` scripts) picks the full matrix. When a viewport
belongs to one engine only, the crawl tags its tests `@webkit-only` or `@chromium-only`, and each
project's `grepInvert` drops the other engine's tests. Untagged tests, such as interaction specs, run
on both engines at the project's default size (390×844 and 360×780).

### Mobile route manifest

`e2e/mobile/manifest/<view>.ts` holds one entry per route-contract view id, and
`manifest/index.ts` collects them in `MOBILE_MANIFEST`. It is test-side only and never ships in
`route-contract.json`. Manifest modules import only types from Playwright (no `test`, no `expect`),
so Vitest can import them too; waits use locator `waitFor()`.

| Field | Holds |
|---|---|
| `view` | the route-contract view id |
| `tier` | `public` or `role-gated` |
| `path` | the URL that opens the view |
| `fixtures` | the name of a fixture set in `e2e/mobile/fixtures/index.ts` |
| `ready` | waits on measurable state that says the page shows its data, such as a heading or a fixture row; never a timeout |
| `storage` | `localStorage` seeds, such as a tutorial already seen. Analytics consent is always seeded `denied` |
| `subViews` | tabs and sub-views: `id`, `label`, and either `path` (reached by URL) or `open` (an action on the entry's page), plus optional `ready`, `modals` and `skip` |
| `modals` | `id`, `label`, `open` (acts, then waits until the modal shows its content), an optional `root` (the CSS selector the rules measure, `[data-modal-backdrop]` by default) and `skip` |
| `skip` | `{ rule, reason }` for each rule that does not apply, with the reason |

Each entry yields the surfaces `<view>`, `<view>/<modal>`, `<view>/<subView>` and
`<view>/<subView>/<modal>`. That surface id keys the ledger, the gallery and the test titles. The
entries so far: `home`, `maps` (with `maps/new`) and `cap-detail` (with `cap-detail/compare-run`).

### Fixture router

`serveFixtureSet(page, name)` in `fixtures/router.ts` serves the entry's set. A set is a list of
routes `{ host: 'api' | 'gateway', path, reply }`. `path` is an exact path without a trailing slash,
or a `RegExp`; `reply` is a response or a function of the request URL, and `ok(data)` wraps the
`{ success, data }` envelope. An API request no route answers falls back to `mockApi` from
`e2e/sidebarRail.ts`. Any other request off the dev server gets a blank PNG (images) or a 404, so no
request leaves the machine. The sets so far are builder-made: Home and Maps from typed builders in
their set modules, the cap page from the run-compare golden fixtures.

### Rules

Each crawl test opens one surface at one viewport on one engine. It waits for the layout to settle:
fonts loaded, on-screen images complete, no finite animation running, and the same layout signature
for three animation frames. Then it runs each rule as a `test.step`: first the rules that only
measure, then the gallery shot, then the interaction rules, which close the modal, scroll, navigate
or rotate, in the table's order. Crawl tests are marked `test.slow()`, so each gets 90 s. Boxes are
measured against `window.visualViewport`. On a modal surface, tap targets, form controls, axe and
`modal-fits` measure only the modal's root, and the top bar rule does not apply. An interaction rule
that throws, for example because a tap target never appears, reports `fail` with "the rule could not
finish" instead of ending the test.

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
| `scroll-top-after-modal` | on a modal surface, tapping the close control closes the modal, and after a swipe that moves the page down one viewport height and a swipe back to the top the page is at the real top (below). A down swipe that scrolls nothing while `main` holds more than it shows fails, so a page left locked by the modal is caught. If the tap fails or the control can't be tapped, Escape closes the modal and the detail says so; a modal neither closes fails. `n/a` on a page surface |
| `back-restores-scroll` | on a page surface, after a swipe of one viewport height, a new navigation through the drawer (to World Records, or Home from World Records) starts at the top, and Back returns the swiped scroller to within 4 px of where it was. `n/a` on a modal surface or when nothing scrolls |
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

### Interaction specs

Every other `e2e/mobile/*.spec.ts` drives one flow on the crawl's harness: it serves a manifest
entry's fixture set, opens its path, waits for `ready`, `settleLayout` and `installProbe`, then uses
the helpers in `e2e/mobile/interactions.ts` (`checkModal`, `closeModal`, `rotate`, `swipeScroll`,
`swipeOneViewport`, `scrollToTop`, `scrollDownThenToTop`, `stuckPageProblems`, `scrollerTop`,
`scrollPositionProblems`, `topOfPageProblems`, `tapCentre`, `zoomVisualViewport`). An interaction
spec that is red today is marked `test.fail()`, with a note naming the ticket that flips it.

- `owner-repro.spec.ts`, the owner's reported bug: Compare runs on the cap page, landscape, zoom in
  and out, portrait, then the close control closes the modal, the hamburger opens the drawer and a
  swipe scrolls the page back to the real top. It is expected to fail until the mobile overhaul's
  one-scroller and viewport-recovery work lands. Today it fails at the landscape step: the fixed top
  bar covers the modal's top edge.
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

**Regenerate** with `npm run test:mobile:ledger`, or `npm run test:mobile:ledger:full` for the
full matrix, narrowed with `-- -g` if you like. The run rewrites only the surface, rule, viewport
and engine combinations it ran: failures go in, passes come out, and everything it did not run
stays. Both matrices are seeded.

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
never compared against baselines; every run clears `test-results/`.

### Dev server drops

When the server refuses a document, script or stylesheet while a surface opens (the Windows
socket flake in [When the gate fails](#when-the-gate-fails), seen on the dev server), the crawl prints
`mobile crawl: the dev server dropped …` and reopens the surface once; the dropped attempt takes no
further steps. A second drop fails the test.

## CI

| Workflow | Trigger | Runs |
|---|---|---|
| `.github/workflows/ci.yml`, job `Fast gate` | pull request into `staging` or `main`, push to `staging` | Windows, Node 20: `npm ci`, `typecheck:web`, `typecheck:e2e`, `lint`, `test` (Windows-only suites included), `docs:check`, `build:web`, `check:bundle`, one step each |
| `.github/workflows/ci.yml`, jobs `Playwright (1/4)` to `Playwright (4/4)` | the same | Windows, Node 20: `npm ci`, `npx playwright install chromium`, `npm run test:e2e -- --shard=<n>/4` (all three projects, against the `-win32` baselines, split across four parallel jobs); on failure each shard uploads its `playwright-report/` and `test-results/` as artifacts |
| `.github/workflows/web.yml` | push to `main`, manual | Ubuntu, Node 20: `npm ci`, `npm run quality:web` (`typecheck:web`, `typecheck:e2e`, `lint`, `test`, `build:web`, `check:bundle`), then a deploy that waits for approval |
| `.github/workflows/release.yml` | push to `main` | Windows: builds and publishes the installer when the `package.json` version has no tag yet; no tests |

`ci.yml` turns off `core.autocrlf` before checkout, so the runner gets each file's committed line
endings, as a local checkout does. A newer push to the same pull request cancels its run in
progress; runs on `staging` finish, so every merged commit gets a result.
GitHub sets `CI`, so Playwright runs with 2 retries, `forbidOnly` and the `github` reporter
([Projects](#projects)); the jobs add `--reporter=list,github,html`, so the log shows each test as
it finishes and a failure leaves an HTML report. The full suite takes too long for one runner, so
it runs as four shards. Download the failing shard's `playwright-report-<n>` artifact and open its
`index.html`, or read the images and `trace.zip` in `playwright-test-results-<n>` as in
[Reading a mismatch](#reading-a-mismatch).
`docs:check` runs on a shallow checkout with no history before the tested commit, so in CI it
checks paths, links and the manifest but lists no docs to review; run it locally for that list.

`Fast gate` is the check to require on `staging` and `main`. The `Playwright` shards stay advisory
until they have been stable. A branch is ready when the gate in [build.md](build.md) and `npm run test:e2e`
pass locally, the same commands the two jobs run. `npm run quality:web` reproduces the `main` web
job.

## When the gate fails

A gate run after a merge went red. Work in this order:

1. **Find the first failure.** Both runners print each failing test with file and line. For a
   screenshot mismatch, read the images in `test-results/` now; the next run deletes them.
2. **Rerun only it**: `npx vitest run <file>`, or `npx playwright test <spec>:<line> --project=<project>`.
3. **Rule out a known flake** (Playwright on Windows):
   - One random test's page stays blank and times out after 30 s with `net::ERR_NO_BUFFER_SPACE`
     loading `/renderer-web.tsx` or a harness page. That is a local socket error under two
     workers, not the code. Rerun with `npm run test:e2e -- --retries=2` (the config's retry count under `CI`); a
     real failure fails all three tries.
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
