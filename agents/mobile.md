# Mobile

What "mobile-ready" means for a UI change, and where each piece of the phone build lives. The web
build runs on phones, foldables and tablets, often as a standalone Home Screen app with no browser
chrome. Each section below names the code and the tests, and links the doc that holds the details.
The manual iPhone checklist at the end covers what emulation can't reproduce.

## Mobile-ready

A UI change is mobile-ready when:

1. **Its route is in the mobile route manifest.** A new view gets an entry, a new tab a sub-view
   and a new tappable modal a modal in its entry ([Mobile route manifest](#mobile-route-manifest)).
2. **Its tables declare a tier and a label on every column** and render DataTable's phone cards,
   never a sideways-scrolling table ([Phone cards](#phone-cards-and-column-tiers)).
3. **Its overlays use the shared modal**, or `useModalBehaviour` when the markup must stay, and an
   overlay opened by a user action is lazy ([Modals and overlays](#modals-and-overlays)).
4. **It scrolls with the shell.** No page-level scroller of its own
   ([One scroller](#one-scroller)).
5. **It gates touch behaviour on the device environment** or the `touch:` variant, never on width
   alone or on a new `matchMedia` ([Gating tiers](#gating-tiers)). Nothing critical hides in a
   hover tooltip.
6. **Its controls fit a finger:** form controls keep the shell's 16 px touch size (no font-size
   override on a control), tap targets are 44×44 px, and anything fixed to a screen edge pads by
   the safe-area and bar variables ([Safe areas](#safe-areas-and-the-bars)).
7. **`npm run test:mobile` passes** with no new ledger entry. A new gesture or flow gets an
   interaction spec in `e2e/mobile/` ([Mobile suite](#mobile-suite)).
8. **Desktop looks the same.** The Electron window is at least 1280 px wide, so it never enters the
   below-`lg` layout; any visible desktop change is flagged to the owner.

The add-data-page and add-table-column skills (`.claude/skills/`) walk through 1 and 2.

## Gating tiers

| Tier | Gets | Read it from |
|---|---|---|
| Any touch device (`hover: none`), any width | the touch table/card rule, tap tooltips, 16 px form controls, pull-to-refresh, the map screenshot viewer, solid tints instead of full-screen blur, no nebula; on a phone or a tablet in portrait, the compare page's one- or two-tile views | `useDeviceEnvironment(env => env.touch)`; CSS `touch:` |
| Touch and below `lg` (1024 px) | hide-on-scroll bars; in portrait, the bottom tab bar | `env.touch && env.belowLg` (`hidesBarsOnScroll` in `AppLayout.tsx`, `showsBottomTabs` in `bottomTabs.ts`) |
| Below `lg`, any pointer | the drawer and top bar instead of the rail | CSS `max-lg:`; `env.belowLg` |
| Below `sm` (640 px), or a touch screen under 640 px tall | modals open as full-screen sheets | `app/styles/modal.css` |
| Web target only | overlay history: Back closes the top-most overlay | `capabilities.overlayHistory` |
| Desktop only | game, install, ini, updater and the other capabilities | `app/platform/` capabilities ([web-target.md](web-target.md#capability-gates)) |

Desktop and pointer devices never reach the touch rows, and the Electron window never reaches the
below-`lg` rows.

## Device environment

`app/device/useDeviceEnvironment.ts` is the one source for touch, below `lg`, orientation,
standalone mode and the current `visualViewport` (scale, offsets, size). Components call
`useDeviceEnvironment(select)`, other code `getDeviceEnvironment()` and
`subscribeDeviceEnvironment()`; the pure parts and the query strings are in
`app/device/deviceEnvironment.ts` (Vitest beside it). DataTable, the tooltip, the shell, the
sheet modal, the compare page's stage and the diagnostic overlay all read it. API and selector rules:
[web-target.md](web-target.md#responsive-layout), Device environment.

## One scroller

`main.shell-main` in `AppLayout.tsx` is the only vertical scroller for page content. A page grows
with its content; an inner wrapper may scroll sideways only. The scroll lock, scroll restore,
pull-to-refresh, the hide-on-scroll bars and viewport recovery all attach to `main`. A page whose
first render isn't its content calls `useNavScrollRestore(ready)` so Back waits for it. Details:
[navigation.md](navigation.md#scroll-position-and-the-shell-scroller). Tests:
`e2e/mobile/scroll-restore.spec.ts`, `e2e/scroll-restore.spec.ts` and the crawl's
`back-restores-scroll` rule.

`useViewportRecovery` (`app/components/layout/useViewportRecovery.ts`) puts the window and every
ancestor of `main` back at 0,0 once the visible area returns to scale 1 after a pinch, a rotation
or the keyboard ([web-target.md](web-target.md#responsive-layout), Viewport recovery;
`e2e/mobile/viewport-recovery.spec.ts`).

## Safe areas and the bars

`app/styles/shell.css` exposes the insets as `--safe-area-top/right/bottom/left` and the bar
heights as `--top-bar-offset` and `--tab-bar-offset`. The top bar, drawer, main element, tab bar
and modal sheets pad by them, and the strip behind the iOS status bar stays dark in every theme.
Anything new fixed to a screen edge reads the same variables (inline, to keep the initial CSS
budget), never `env()` directly. `e2e/mobile/shell.spec.ts` simulates a notch by setting the
variables. Details: [web-target.md](web-target.md#responsive-layout), Safe areas, Top bar
height, Status bar.

The phone shell around the content:

- **Bottom tab bar** (`layout/BottomTabBar.tsx`, data in `navigation/bottomTabs.ts`): touch, below
  `lg`, portrait. A view that belongs to one of its sections gets a row in `activeBottomTab`
  ([navigation.md](navigation.md#bottom-tab-bar); `e2e/mobile/bottom-tabs.spec.ts`).
- **Drawer**: opens from the hamburger or the Menu tab only, closes with a swipe left
  (`layout/useDrawerSwipe.ts`, `drawerSwipe.ts`), and holds **Reload app**
  ([web-target.md](web-target.md#responsive-layout), Drawer below `lg`).
- **Hide-on-scroll bars** (`layout/HideOnScrollBars.tsx`, pure rule in `barVisibility.ts`): both
  bars slide away on a user scroll down and come back on a scroll up, at the top, after navigation
  and when an overlay closes ([web-target.md](web-target.md#responsive-layout);
  `e2e/mobile/hide-on-scroll.spec.ts`, `e2e/hide-on-scroll-desktop.spec.ts`).

## Modals and overlays

`app/components/ui/modal.tsx` is a full-screen sheet below `sm` and on a short touch screen, and a
centred card elsewhere. It portals into `document.body` above all chrome, follows `visualViewport`
so the keyboard never covers the focused field, always renders its header close, closes on a
backdrop tap unless `closeOnBackdrop={false}`, holds the counted scroll lock
(`ui/scrollLock.ts`) and returns focus to its opener (`ui/modalFocus.ts`). An overlay whose markup
must not change uses `ui/useModalBehaviour.ts` for the same lock, focus and Escape. Details and
props: [shared-components.md](shared-components.md#modal). Tests:
`e2e/mobile/modal-sheet.spec.ts`, `modal-lock.spec.ts`, `overlays.spec.ts`, `owner-repro.spec.ts`
and the crawl's `modal-fits`, `scroll-top-after-modal` and `rotation-recovers` rules.

- **Overlay history (web).** Each open modal, Escape-closable `useModalBehaviour` overlay and the
  open drawer owns a history entry through `useOverlayHistory` (`navigation/useUrlSync.ts`), so the
  system back gesture closes the top-most overlay first and closing it any other way consumes the
  entry ([navigation.md](navigation.md#overlay-history-web-build); `e2e/overlay-history.spec.ts`,
  `e2e/mobile/overlay-history.spec.ts`).
- **Lazy loading.** A modal opened by a user action is a `lazy()` module mounted through
  `shared/LazyModalGate.tsx`; `LazyModalGate.test.ts` fails on a static import. Which modals stay
  eager, and why: [web-target.md](web-target.md#performance-and-bundle-budgets).
- **Popovers** (`ui/dropdown-menu`) stack above every modal and, on touch, hold the scroll lock
  while open ([shared-components.md](shared-components.md#ui-primitives-appcomponentsui)).

## Phone cards and column tiers

Every `DataTableShell` passes `responsive` with a `ResponsiveColumn` per column. Each declares a
`tier` (`essential` on the card face, `detail` in the expand panel, `decorative` may drop) and a
panel `label`, and the compiler rejects a column without them. DataTable
(`app/components/shared/DataTable.tsx`) draws the cards itself from `responsive.cards`: the
page's face, a 44 px "Details" chevron, a panel generated from the detail columns (actions
included, and columns the user hid in Columns), and the card body's tap opening the detail page.
The only exception is `tableOnly: true`, used by the cap page's split, sector and speed tables,
which fit 360 px as tables. Contract: [shared-components.md](shared-components.md#column-tiers-and-phone-cards)
and [styling.md](styling.md#responsive-columns). Each feature doc lists its tables' faces.

- **The touch switch rule** (`resolveTableLayout`, Vitest in `DataTable.test.ts`): on touch, the
  table renders only when every non-decorative column fits its container; otherwise cards, two
  per row from 600 px. Desktop keeps dropping optional columns by priority and shows cards only
  when the required columns don't fit.
- **Card sorting.** DataTable renders one sort control on the cards, a field picker and a
  direction toggle built from every column with a `sortKey`. It reads and writes the header's
  sort state (`cards.sort`), so a rotation between table and cards keeps the sort.
- **Tests.** The crawl's `table-shows-every-column` and `cards-expose-every-column` rules check
  every table on every surface against its desktop rows ([testing.md](testing.md#tables-and-cards));
  the decorative headers are listed per manifest entry. Card specs in `e2e/mobile/`
  (`table-cards`, `leaderboard-cards`, `player-server-cards`, `event-table-cards`,
  `team-manage-cards`, `admin-cards`) pin each table's face, panel and sort, and
  `cap-numeric-tables.spec.ts` the cap tables' fit at 360 px.

## Pull-to-refresh

`layout/PullToRefresh.tsx` (guards and threshold pure in `pullGesture.ts`) arms on a touch at the
top of `main` with no scroll-lock hold, and outside sideways scrollers, `touch-none` controls and
range inputs. A release past about 70 px calls the page's refresh. Register it with
`useRegisterPageRefresh({ onRefresh, refreshing, disabled })` from
`navigation/PageRefreshContext.tsx`: `onRefresh` refetches and keeps every piece of UI state. A
page with no handler re-mounts in place, which loses its own `useState`; register one when that
matters. Details: [state-patterns.md](state-patterns.md#refresh-handlers-and-pull-to-refresh) and
[navigation.md](navigation.md#page-refresh-registry-and-freshness). Test:
`e2e/mobile/pull-to-refresh.spec.ts`.

## Touch details

- **Form controls** are 16 px or more on touch through one rule in `shell.css`; don't override a
  control's font size ([styling.md](styling.md#form-inputs); crawl rule `form-controls-16px`).
- **Tooltips** (`ui/tooltip.tsx`) open on tap and close on an outside tap or a scroll. Information
  that matters goes inline on touch, read from the device environment at the call site
  ([shared-components.md](shared-components.md#ui-primitives-appcomponentsui);
  `e2e/mobile/tap-tooltips.spec.ts`).
- **Video and effects.** Every `<video>` plays inline. Compare page videos start muted and at
  most one plays sound; on a phone, and on a tablet in portrait, only the visible tiles stream: a
  hidden tile drops its `src` and reloads empty, and a revealed one seeks to the master clock. A
  touch screen in landscape from 1024 px keeps the full grid. The page's playback clock runs
  outside React state.
  On touch, full-screen blur becomes a solid tint and the nebula is off
  ([run-compare.md](features/run-compare.md#mobile), [styling.md](styling.md#css-runtime-cost);
  `e2e/run-compare-responsive.spec.ts`, `e2e/nebula.spec.ts`).
- **Swipe between views** (the compare page's POV switcher): a `role="group"` of 44 px chips, one
  per view with `aria-pressed`, that scrolls sideways inside itself, plus a horizontal swipe on the
  content (`stage/useSwipe.ts`: the primary pointer only, at least 48 px and twice as long along
  its axis as across it, cancelled by a second finger). The swipe area keeps
  `touch-action: pan-y pinch-zoom`, so a vertical swipe still scrolls the page and pinch-zoom
  still works. Every swipe has a tappable control beside it.
- **A non-modal panel as a bottom sheet** (the compare page's Runs drawer): a panel the page stays
  usable behind is not a `ui/modal.tsx` sheet. It keeps `useModalBehaviour` without the scroll lock
  (so it still takes an overlay history entry, focus and Escape) and adopts the sheet's rules: fixed
  to the bottom edge above the tab bar, safe-area padding, a sticky header with a handle and the
  close button, a swipe down on the header to close (`touch-action: none` on the header only), the
  sheet's `sheetBounds` to stay above the keyboard, and contained overscroll. Use it only on phone
  portrait; in landscape a full-height side panel fits better.
- **Wide content** keeps a sideways scroller of its own: the elimination bracket snaps round by
  round below `lg` with sticky round names ([events.md](features/events.md#elimination-stage-on-phones);
  `e2e/mobile/bracket-snap.spec.ts`), and on touch the map hero's screenshot opens the pinch-zoom viewer
  (`modals/MapScreenshotViewer.tsx`, [records.md](features/records.md#map-detail);
  `e2e/mobile/screenshot-viewer.spec.ts`).

## Mobile route manifest

`e2e/mobile/manifest/<view>.ts` holds one entry per route-contract view, collected in
`MOBILE_MANIFEST` (`manifest/index.ts`). An entry names its tier, path, fixture set, `ready` wait,
decorative columns, tabs and sub-views, the modals to open and how, stress variants and any
skipped rule with a reason. It is test-side only and never ships. `routes.contract.test.ts` fails
when a contract view has no entry, an entry names an unknown view, a role-gated entry is missing,
or an admin section has no sub-view, so a route can't land without mobile coverage. Public entries
serve recorded public data, role-gated ones synthetic sets. Format, fixtures and the step helpers:
[testing.md](testing.md#mobile-route-manifest).

[mobile-routes.md](mobile-routes.md) lists every entry with its surfaces. It is generated from the
manifest by `npm run docs:mobile-routes`, and `npm run docs:check` fails while it is stale.

## Mobile suite

`e2e/mobile/` runs on the `mobile-suite-webkit` and `mobile-suite-chromium` projects:

- **The crawl** (`crawl.spec.ts`) opens every manifest surface at each viewport in
  `e2e/mobile/viewports.ts` and runs the rules in `e2e/mobile/rules/`: overflow, top bar, error
  boundary, axe, 16 px controls, 44 px tap targets, modal fit, the two table rules, scroll to top
  after a modal, Back restoring scroll, and rotation. Rules and their thresholds:
  [testing.md](testing.md#rules).
- **Interaction specs** (every other `e2e/mobile/*.spec.ts`) drive one flow each with the helpers in
  `e2e/mobile/interactions.ts` ([testing.md](testing.md#interaction-specs)).
- **The ledger** (`e2e/mobile/ledger/<rule>.json`) lists the failures that predate the rule. A
  listed failure passes, an unlisted one fails, and a listed one that now passes fails until the
  entry is deleted. A fix deletes its entries; a regression is fixed, never listed
  ([testing.md](testing.md#known-violations-ledger)).
- **The gallery** (`test-results/mobile-gallery/index.html`) shows every crawled surface with
  each rule's outcome. Nothing is compared against baselines.

`npm run test:mobile` runs the PR subset on the built bundle: WebKit at 390×844 and 844×390,
Chromium at 360×780 and 915×412, plus every interaction spec. The `Mobile suite` job in
`.github/workflows/ci.yml` is the mobile gate: its Chromium half runs on every pull request and its
WebKit half on pushes to `staging` and manual runs, and
`.github/workflows/mobile-nightly.yml` runs the full matrix (`npm run test:mobile:full`) every
night ([testing.md](testing.md#ci)). While iterating, narrow with `-g "<surface or viewport>"` or
run one spec with `npx playwright test e2e/mobile/<spec> --project=mobile-suite-webkit`, which uses
the dev server.

## Capturing a diagnostic report

The diagnostic overlay shows what the app thinks is happening on the device: the
`visualViewport` scale, offsets and size, `innerHeight` and `innerWidth`, the window and shell
scroll positions, orientation, standalone mode, touch and below-`lg`, the safe-area insets,
the open modal count, the scroll-lock count (how many open modals hold the page still), the
active view and the path. It is part of the production build and sends nothing anywhere.

1. Turn it on:
   - in Safari, open any page with `?debug=mobile` (for example `https://utbt.net/?debug=mobile`);
   - in the Home Screen app, or anywhere without a URL bar, long-press the logo in the top bar
     (on desktop, the sidebar logo) for about half a second. A normal tap on the logo does what
     it always did.
2. Reproduce the problem. The values update live; **Move down** / **Move up** moves the panel out
   of the way.
3. Tap **Copy report** while the broken state is on screen and paste the text into the bug report.
   If the copy fails, the report appears in a text box below the buttons to select by hand.
4. Long-press the logo again, or tap **Close**, to hide it.

## iPhone checklist

Run it on a real iPhone after a wave of mobile work lands, in the Home Screen app unless a check
says otherwise. When a check fails, capture a report in the broken state and attach it.

### Shell

- [ ] **Standalone launch and status bar, both themes.** Add the site to the Home Screen and open
      it: it launches full-screen with the right name and icon, and the report says
      `Standalone: yes`. The status bar clock and battery are readable in the Classic theme and
      in the Light theme.
- [ ] **Safe areas, both orientations.** In portrait and in landscape (notch on either side), the
      top bar, drawer, bottom tab bar, modals, the sign-out confirm, the tutorial card and page
      edges stay clear of the notch or Dynamic Island, the rounded corners and the home
      indicator. The report's `Safe area` row shows non-zero insets on the notch side.
- [ ] **Pinch zoom in and out.** Pinch-zoom a page in, pan around, then zoom back out to normal:
      `Viewport scale` returns to 1, `Window scroll` returns to `0, 0`, and the top bar, menu and
      page scrolling all work.
- [ ] **The owner's sequence.** On a cap page, open Watch Replay, rotate to landscape, pinch-zoom
      in and out, rotate back: the modal still fits, its close button works, the menu opens and
      the page scrolls from top to bottom afterwards.
- [ ] **Rotation during video.** Watch a replay: it plays inside the page. Rotate to landscape and
      back, then close it: the layout recovers.
- [ ] **Keyboard.** Focus a text field inside a sheet (for example Create a Team): the page does
      not zoom, the field stays visible above the keyboard, and closing the keyboard leaves the
      layout as it was. Focusing the map search, a multi-filter search or the compare page's
      Search Players box doesn't zoom either, and after the keyboard closes on a page search field the page isn't
      left shifted.
- [ ] **Reload app.** The drawer's Reload app reloads the same page.

### Overlays and navigation

- [ ] **The page stays still.** Flick the page and open a sheet, the tutorial or a filter
      dropdown while it is still moving: the page stops. Swiping past either end of a sheet's body
      doesn't bounce or move the page. Landscape sheets use the full height.
- [ ] **Edge swipe back.** On a detail page, swipe in from the left screen edge: the app goes back
      one page and the drawer doesn't open. With a sheet (Watch Replay, the compare page's Runs
      sheet) or the drawer open, the swipe closes it first and the next swipe goes back. A swipe back from a page opened by a
      drawer link returns to the page the drawer was opened on. On Android Chrome the system back
      gesture does the same, and with the maps tutorial card open on a first visit, Back closes
      the card and keeps the page.
- [ ] **Scroll restore.** Scroll down a list, the cap, map, player or news page, open something
      and go back: the page returns to where it was. A new page starts at its top.
- [ ] **Bars.** In portrait the tab bar sits clear of the home indicator and highlights the
      section of the page shown. A finger scroll and a momentum fling hide the top bar and the tab
      bar; a scroll up, a status-bar tap to the top, Back, closing a modal and closing the drawer
      bring them back.
- [ ] **Drawer swipe.** Swiping the open drawer left closes it smoothly, with no spring-back
      before it slides out.
- [ ] **Pull-to-refresh.** A pull at the top shows the badge coming out from under the top bar,
      turns accent past about 70 px and spins on release; the page doesn't rubber-band, and a
      flick up still scrolls. A deliberate pull arms every time. Nothing happens with a sheet or
      the tutorial open, or on the compare page's timeline.
- [ ] **VoiceOver.** Closing a sheet, the sign-out confirm or the tutorial returns focus to the
      control that opened it.

### Content

- [ ] **Cards.** On World Records, Maps, a map's leaderboard and a profile tab, a card body opens
      its page, the Details chevron opens the panel (Watch plays a replay from it), the sort
      control reorders the cards, and a tap near the favourite star doesn't toggle it.
- [ ] **Tap tooltips.** On a map page, tap the (i) beside Medal Thresholds: it opens, and a tap
      elsewhere or a scroll closes it. A tap on a medal icon in a caps card opens its tooltip and
      the card doesn't navigate.
- [ ] **Cap tables.** The cap page's split, sector and speed tables show every column at 360–390 px
      with Safari's digits.
- [ ] **Compare page.** Open a comparison from a cap page's Compare, and Watch Team Run on a team
      cap with four or more members: one tile plays; swiping between POVs or tapping a chip lands
      in sync, during playback too, and the app doesn't reload. The compact transport and its rate
      menu are comfortable to tap, the Runs sheet swipes closed from its header, and a vertical
      swipe on the stage scrolls the page. In landscape two runs play side by side.
- [ ] **Bracket.** On an event with an elimination stage, a momentum swipe across the bracket lands
      on a round edge, and the round names stay under the top bar while scrolling down.
- [ ] **Screenshot viewer.** Tap a map's hero screenshot: pinch-zoom and pan feel natural, a double
      tap zooms in and out, and the page itself never zooms.
