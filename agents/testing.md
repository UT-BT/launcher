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
| `e2e/__screenshots__/` | committed screenshot baselines, one folder per spec file |
| `e2e/streamHarness.ts` | fake API plus open, settle and screenshot helpers for scene specs |
| `e2e/sidebarRail.ts`, `e2e/layout.ts`, `e2e/streamPanels.ts` | shared spec helpers: the catch-all `mockApi`, `horizontalOverflow`, `openStreamPanel` |
| `e2e/<name>Harness.html` + `.ts` | standalone pages that mount one component tree outside the app |
| `playwright.config.ts`, `vitest.config.ts`, `.github/workflows/` | runner config and CI |
| `tsconfig.e2e.json` | the TypeScript project for `e2e/` and the two runner configs: `typecheck:e2e` and ESLint read it |

## Vitest

`vitest.config.ts` collects `app/**/*.test.{ts,tsx}` and `lib/**/*.test.ts` and runs them in Node;
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

### Projects

| Project | Runs | Device | For |
|---|---|---|---|
| `desktop-chromium` | every spec except `*.broadcast.spec.ts` | Desktop Chrome, 1280×720 | app UI at desktop width |
| `mobile-chromium` | the same specs | Pixel 7: 412×839, touch, `isMobile` | the same UI on a phone |
| `broadcast` | only `*.broadcast.spec.ts` | Desktop Chrome at 1920×1080, `deviceScaleFactor: 1` | OBS scene pages and their baselines |

The file name picks the project, and app specs run in both app projects. A test that fits only one
size skips with `test.skip(isMobile, '<reason>')` or `test.skip(!isMobile)`. Specs that sweep
widths set `test.use({ viewport })` per `describe` (copy `e2e/event-stats-responsive.spec.ts`) and
expect `horizontalOverflow(page)` from `e2e/layout.ts` to be at most 1. Both app projects preload
`utbt:seasonalThemes:v1 = "off"` so seasonal decor stays out of layout checks; `seasonal.spec.ts`
turns it on itself.

The config runs 2 workers, spec files in parallel and the tests inside a file in order, with the
default 30 s test timeout, `trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'`.
Retries (2), `forbidOnly` and the `github` reporter apply only when `CI` is set; locally there are
no retries, and a stray `test.only` silently narrows the run.

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
npx playwright test                                            # all three projects
npx playwright test --project=desktop-chromium                 # one project
npx playwright test e2e/stream-tab.spec.ts --project=desktop-chromium
npx playwright test e2e/stream-tab.spec.ts:228                 # one test, by its line
npx playwright test -g "lands on Setup"                        # by title
```

`npm run test:e2e -- <args>` is the same. A broadcast spec needs no `--project`: the other projects
ignore it. Specs that listen for browser errors print `BROWSER PAGE ERROR:` lines; read those first
when a page stays blank.

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

## CI

| Workflow | Trigger | Runs |
|---|---|---|
| `.github/workflows/ci.yml`, job `Fast gate` | pull request into `staging` or `main`, push to `staging` | Windows, Node 20: `npm ci`, `typecheck:web`, `typecheck:e2e`, `lint`, `test` (Windows-only suites included), `docs:check`, `build:web`, `check:bundle`, one step each |
| `.github/workflows/ci.yml`, job `Playwright` | the same | Windows, Node 20: `npm ci`, `npx playwright install chromium`, `npm run test:e2e` (all three projects, against the `-win32` baselines); on failure uploads `playwright-report/` and `test-results/` as artifacts |
| `.github/workflows/web.yml` | push to `main`, manual | Ubuntu, Node 20: `npm ci`, `npm run quality:web` (`typecheck:web`, `typecheck:e2e`, `lint`, `test`, `build:web`, `check:bundle`), then a deploy that waits for approval |
| `.github/workflows/release.yml` | push to `main` | Windows: builds and publishes the installer when the `package.json` version has no tag yet; no tests |

`ci.yml` turns off `core.autocrlf` before checkout, so the runner gets each file's committed line
endings, as a local checkout does. A newer push to the same pull request cancels its run in
progress; runs on `staging` finish, so every merged commit gets a result.
GitHub sets `CI`, so Playwright runs with 2 retries, `forbidOnly` and the `github` reporter
([Projects](#projects)); the job adds `--reporter=github,html` so a failure leaves an HTML report.
Download the `playwright-report` artifact and open its `index.html`, or read the images and
`trace.zip` in `playwright-test-results` as in [Reading a mismatch](#reading-a-mismatch).
`docs:check` runs on a shallow checkout with no history before the tested commit, so in CI it
checks paths, links and the manifest but lists no docs to review; run it locally for that list.

`Fast gate` is the check to require on `staging` and `main`. `Playwright` stays advisory until it
has been stable. A branch is ready when the gate in [build.md](build.md) and `npm run test:e2e`
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
