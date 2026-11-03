# Navigation

How the app moves between views: the in-memory history stack in `Main.tsx`, the one
`navigate()` funnel, `renderView`, routes and web URL sync, links, the sidebar registry
and rail, badges, and the refresh button. Read it before adding a view, a link, a sidebar
item or anything that touches Back/Forward. What state lives where is in
[state-patterns.md](state-patterns.md).

There is no URL router. `Main.tsx` owns a history stack and a `switch` that renders the
active entry. On the web build the browser URL mirrors that stack; desktop has no URL.

## The stack

`Main.tsx` holds `entries: NavEntry[]` and `cursor`. `NavEntry` and `NavParams` live in
`app/components/navigation/NavigationContext.tsx`:

- `NavEntry` is `{ id, view, params, state }`. `id` is a monotonic counter; `state` is the
  entry's own bag (see [Per-entry state bag](#per-entry-state-bag)).
- `NavParams` is every identifier a view can carry. A view may read several (`match-pickban`
  reads `eventSlug` + `matchId`, `event-team` reads `eventSlug` + `eventTeamId`). When you
  add a field, add it to `paramsEqual` too: a field it doesn't compare makes a param-only
  change a silent "already here" no-op.
- Seed another page's initial state through a param, never by writing into its entry
  state before `navigate()`. Example: `mapsNewOnly` (Home's "new maps" tile) reaches
  `MapsPage` as its `initialNewOnly` prop.
- The stack lives in memory only. It boots from `seedEntriesFromUrl()`: one `home` entry
  on desktop, the URL's target on web. History is never persisted; preferences are.

Components read the active entry and the nav functions through `useNavigation()`
(`entry`, `currentView`, `navigate`, `back`, `forward`, `canBack`, `canForward`,
`getEntryState`, `setEntryState`, `registerLeaveGuard`).

## `navigate()` is the only entry point

`navigate(view, params?)`:

- checks the [leave guards](#leave-guards), then `commitNavigate` runs `markViewed(view)`
  (see [badges](#sidebar-badges-and-the-new-item-highlight)) before anything else;
- is a no-op when the active entry already has that `view` and `paramsEqual` params;
- otherwise drops forward history, pushes a new entry with an empty `state` bag and moves
  the cursor to it;
- caps the stack at `HISTORY_CAP` (50), dropping from the front.

`back()` / `forward()` move the cursor (clamped). On desktop they also fire on mouse
buttons 3/4 and on Alt+←/→ (ignored while typing in an input, textarea, select or
contentEditable). `NavHistoryBar` (Back, Forward and the shared Refresh button) renders on
desktop only; on web the browser owns history and reload.

Sidebar clicks, `openMap`, the `open-*` window events and every `NavLink` all end in
`navigate()`. Add no second mechanism: no raw `setCurrentView`, no parallel back stack
(hard rule 6). URL sync mirrors the stack and drives it only on external entry.

## Per-entry state bag

Each entry's `state` is read and written through `getEntryState(key, default)` /
`setEntryState(key, value)` on the active entry. Two hooks sit on it:

- `usePageState` (in `Main.tsx`) stores a primary page's query state under
  `page:<storageKey>`.
- `useNavState(key, default)` stores a detail page's transient UI under `key`.

A fresh `navigate()` starts with an empty bag, so the page opens from defaults;
Back/Forward return to the entry and restore its bag. On web, a `popstate` whose entry is
gone (external entry, or trimmed by `HISTORY_CAP`) pushes a fresh entry with an empty bag.
How to use the hooks, and which tier a value belongs in:
[state-patterns.md](state-patterns.md).

## Leave guards

A view whose edits live only in component state registers a guard; `navigate`, `back` and
`forward` consult every guard before moving:

```ts
useUnsavedChanges(dirty, 'The tournament format has edits you have not saved yet.')
```

`useUnsavedChanges` (`app/components/navigation/useUnsavedChanges.ts`) registers the guard
through `registerLeaveGuard` and arms `beforeunload` while `dirty`. The guard covers in-app
moves and, on web, the browser's own Back/Forward, which arrive as `popstate` and pass the
same check ([URL sync](#routes-and-url-sync-web-build)); `beforeunload` covers a reload, a
closed tab and a hard navigation. On web, a Back that only closes an open overlay stays on
the page and asks nothing; the next Back asks ([Overlay history](#overlay-history-web-build)).

When a guard returns a message, `Main` parks the move in `pendingLeave` and shows a
"Leave without saving?" confirm; confirming calls `commitNavigate` (or the parked
`back`/`forward` or browser history move), which bypasses the guards. Navigating to the
entry you are on skips the check. `e2e/history-leave-guards.spec.ts` covers browser Back,
Forward and a multi-entry jump with and without unsaved work.

- `registerLeaveGuard` returns the unregister function; return it from the effect. A guard
  that outlives its view blocks the whole app.
- The guard closure is registered once, so read the dirty flag through a ref (the hook
  does).
- Unmounting is not navigation, and a guard dies with its component. Put the guard and the
  unsaved state it reads above everything that unmounts. Mirroring a child's dirty flag up
  through effects races the child's unmount and sticks. `EventDetailPage` therefore owns
  the drafts outright: `formatDraft` (dirty = `!== null`) and `pickBanDrafts` (one draft
  per stage key, dirty while any key exists), with the Manage panels controlled by them.
  Switching tabs keeps the edit.

## renderView: page-views and detail pages

`renderView()` switches on `currentView` and returns exactly one element, inside a
per-view `ErrorBoundary` (`variant="view"`, keyed on `entry.id` and the view's re-mount
count) around `Suspense`. A page crash shows an inline error card with the shell intact, and
any navigation resets the boundary. The count rises when pull-to-refresh hits a page with no
refresh handler ([Page refresh registry](#page-refresh-registry-and-freshness)). Unknown views
render `Home`.

| Kind | Views | Keyed | Why |
|---|---|---|---|
| Page-views | `home`, `servers`, `maps`, `players`, `teams`, `events`, `cap-it-all`, `world-records`, `achievements`, `news`, `admin` | no | One instance per view, reused across entries of that view. A view change still unmounts it. Its state and data survive because they are hoisted to `Main` (per-entry state via `usePageState`, data via a `caches` singleton); anything in the page's own `useState` refetches on every visit. |
| Detail pages | `maps-detail`, `player-detail`, `cap-detail`, `team-cap-detail`, `news-detail`, `team-detail`, `event-detail`, `match-pickban`, `event-team` | `key={entry.id}` | Each visit remounts, so it fetches for its new param and `useNavState` reads the right bag. Without the key the page keeps the previous visit's data and UI state. |

Detail cases read their identifier from `entry.params` (`mapName!`, `playerId!`, …).

Lazy loading: page-views other than `Home` are `lazy(PAGE_LOADERS.<view>)`
(`app/components/main/pageLoaders.ts`), the same loaders `prefetchPage` warms on sidebar
hover/focus. Detail pages are plain `lazy()` imports in `Main.tsx` with no loader entry.
`Main.tsx` imports only types from a lazy page module; state/cache types and defaults
live in `<Page>.types.ts`. `pageLoaders.test.ts` enforces both and pins the loader list.

To make a page-view refetch after a mutation made elsewhere, clear its cache slice before
navigating to it, as `exitTeamsToGallery` does for `teams`.

## Scroll position and the shell scroller

The main element in `AppLayout` (`main.shell-main`) is the only vertical scroller for page
content, on both targets. A page never fills the shell's height with a scroller of its own: a
page root may clip sideways (`overflow-hidden`) and an inner wrapper may scroll sideways
(`overflow-x-auto`, as a wide table does), but the page grows with its content and `main`
scrolls it. Anything that follows page scrolling attaches to `main`: the modal scroll lock
([shared-components.md](shared-components.md#modal)), pull-to-refresh
([below](#page-refresh-registry-and-freshness)), and the hide-on-scroll bars
([web-target.md](web-target.md#responsive-layout)).
Both of those wrappers are still scroll containers, so a
`sticky` element inside one sticks to it rather than to `main`. Where a page has a sticky
element below `lg`, its wrappers clip with `max-lg:overflow-x-clip max-lg:overflow-y-visible`
instead. The event page does this for the bracket's round headings
([events.md](features/events.md#elimination-stage-on-phones)).

The shell keeps each history entry's scroll position:

- **Saving.** `useShellScroller` (`app/components/navigation/useNavScrollRestore.ts`) listens
  to `main`'s scroll events, and `ShellScrollRestore` (mounted after the page content inside
  `main`) reads `main.scrollTop` in `getSnapshotBeforeUpdate` when `entry.id` changes, before
  React swaps the page. Positions live in a map keyed by entry id, not in the entry's state
  bag: writing the bag re-renders the app on every scroll. The map lives as long as the
  in-memory stack.
- **New navigation** (a fresh entry, a `pushExternal`, a reload) starts at the top.
- **Back/Forward** to an entry restores its position once the page is ready, and keeps
  re-applying it as the content grows until it is reached. While it holds a restored position
  it turns scroll anchoring off on `main`, so content loading in above can't shift it. The
  restore ends when the user scrolls (wheel, touch, pointer or key on `main`), when a scroll
  the shell didn't make moves a reached position, or on the next navigation. A page that
  starts loading again before anyone scrolled gets the restored position back.
- **Pages say when they are ready.** A page whose first render isn't its final content calls
  `useNavScrollRestore(ready)`; while `ready` is false it holds the restore (the page stays at
  the top). Detail pages pass their loading flag (`!loading && !!detail`), list pages
  `!showSkeleton` or `!loading`, and the pick/ban page `!session.loading`. A page that never
  turns ready (an error, or a highlight that must not be scrolled away) is never restored. The
  pure logic is `createScrollRestore` in `scrollRestore.ts`.

## Routes and URL sync (web build)

`app/components/navigation/routes.ts` maps both ways: `viewToPath(view, params)` and
`pathToNav(pathname, search)`. Unknown paths resolve to `home`. `pathToNav` reads as many
segments as a route needs and checks exact segment counts, so
`/events/:slug/matches/:id` and `/events/:slug/teams/:id` resolve only with exactly four
segments and anything else under `/events/:slug` stays on `event-detail`.

On web (`useUrlSync.ts`; on desktop `useUrlSync` returns `null` and `pushUrlForEntry`
no-ops) the in-memory stack is master and browser history mirrors it. The bookkeeping lives in
`createHistorySync` (`historySync.ts`), which `useUrlSync` creates once over
`window.history` and attaches to the stack in `Main`. Each history entry's
state is `{ navId, position }`: the stack entry's `id` and the entry's place in the tab's
history, one more than the entry it was pushed from. Overlay entries add `overlay`
([below](#overlay-history-web-build)).

- The first attach reads `position` from `history.state` (0 when there is none, so a reload
  keeps it) and `replaceState`s the canonical path of the seeded entry. Later attaches (a
  re-run effect, StrictMode) don't boot again.
- `commitNavigate` calls `pushUrlForEntry(entry)` (`pushState({ navId, position }, …)` with
  the next position). A push also drops a confirmed position that never got its `popstate`
  (a `go` past either end of history), so it can't wave through a later move.
- In-app Back/Forward (already past `Main`'s guard check) mark the neighbouring position as
  confirmed and call `history.go(-1)` / `go(1)`.
- The `popstate` handler ignores a `position` equal to the current one, then runs the
  [leave guards](#leave-guards) unless the move was confirmed or lands on the active stack
  entry (an overlay entry of the page on screen). When a guard blocks, it calls
  `history.go(current - target)`, so the URL returns to the current entry with forward
  history intact and the cursor never moves, and hands the move to `Main` through
  `onBlocked({ message, move })`. `Main` shows the same confirm; Leave runs `move`, which
  marks the target confirmed and replays `history.go(target - current)`. A jump of several
  entries (the Back button's history menu) is put back and replayed whole.
- A move that passes finds `state.navId` in the stack and moves the cursor; a missing
  `navId` falls back to `pathToNav` and `pushExternal`, which pushes a fresh entry (and runs
  `markViewed`).
- An entry with no `position` can't be put back reliably, so the move onto it skips the
  guard check and takes the next position; only the `pushExternal` path stamps that into
  the entry's state. That fits a fragment link, which arrives with a `null` state and is
  always pushed forward. An entry left by a build from before positions carries only a
  `navId` and may sit behind the current one, so in a tab open across that update a later
  block can put the URL back to the wrong entry.

**Adding a route touches three files in one commit:** both directions in `routes.ts`, an
entry in `app/public/route-contract.json` (path, view, unique `kind`, and a `params` array
in path order when the path has params; it drives per-URL link previews, see
[web-target.md](web-target.md)), and a title in `titles.ts`.
`routes.contract.test.ts` fails on drift: the contract's views must equal the `case`
labels in `viewToPath`, every route must round-trip, every view needs a non-default
title, and every non-admin route must stay crawlable under `app/public/robots.txt`.

**Pre-shell routes are not app routes.** `/auth/callback`, the match stream view
`/events/:slug/matches/:id/stream` and the stream scene pages `/stream/:eventSlug/:streamerId/:scene`
are claimed in `app/renderer-web.tsx` before the app shell mounts. They have no
`routes.ts` case, no contract entry and no title; `pathToNav` sends them to the unknown-path
fallback, and `routes.contract.test.ts` pins that. Mechanism:
[web-target.md](web-target.md); scenes: [stream-kit.md](features/stream-kit.md).

**Document metadata (web only).** `Main.tsx` calls `useDocumentMeta(currentView,
entry.params)`, which sets `document.title` from `titleForRoute` and the canonical link on
every navigation. A detail page refines the title with `useDocumentTitle(name)` once its
data is in; React runs child effects before the parent's, so the generic title lands first
and the specific one replaces it. Don't move this into `useUrlSync`'s attach effect: its
deps are refs and setters, so it doesn't re-run on navigation.

## Overlay history (web build)

On web, an open overlay owns a browser history entry, so the system back gesture (the iOS
edge swipe, Android back) and the browser's Back close the top-most overlay instead of
leaving the page. Desktop has no URL history: `capabilities.overlayHistory` is off there, no
entry is written and its nav stack is untouched (`useUrlSync.test.ts`). There is still one
page-navigation mechanism, the nav stack; overlay entries never move it.

- **Which overlays.** Every shared `Modal` while `isOpen`; overlays on `useModalBehaviour`
  that take an Escape handler (the sign-out confirm, the tutorial card, a closable
  `ErrorModal`; the boot connection error has no close and takes no entry); and the drawer
  while it is open below `lg`. Each calls `useOverlayHistory(open, close)` from
  `useUrlSync.ts`. The legacy `shared/Modal` (`ConfirmModal`, including the "Leave without
  saving?" confirm), popovers and card expand panels (inline) take none.
- **Opening** pushes an entry with the page's URL and state `{ navId, position, overlay }`:
  the page's `navId`, the next position and `overlay`, the entry's depth above the page
  entry. It takes a position like any entry, so the leave guards' put-back arithmetic holds.
  Stacked overlays push one entry each.
- **Back** onto a lower entry closes every overlay whose entry is above it, top-most first,
  through the overlay's own close handler. The page and URL stay, and a move that stays on
  the active stack entry runs no leave guard: a guarded page with an open overlay closes it
  first and asks on the next Back. An overlay whose close handler refuses (a busy modal)
  loses its entry anyway, so the next Back leaves the page.
- **Closing through the overlay's own UI** (close, backdrop, Escape, the drawer swipe) goes
  back over its entry once the close commits, so the next Back leaves the page and
  Back/Forward keep no dead step. An overlay that replaces another in the same commit (the
  Settings loading placeholder and Settings; the drawer and the modal a drawer user-menu
  item opens, which closes the drawer) takes over its entry.
- **A page navigation from an open overlay** (a link in a modal, a drawer link) replaces the
  top overlay entry with the new page instead of pushing, so Back from the new page returns
  to the page under the overlay. An overlay still open after the navigation (an app-level
  modal) gets a fresh entry on the new page once it commits: `useUrlSync` settles when the
  active entry changes. A navigation that arrives while the history is still going back over
  a closed overlay's entry waits for that move to land, and the landing leaves the new page
  on screen.
- **Forward never reopens an overlay.** An overlay entry whose overlay is gone is passed in
  the direction of travel: Back always passes it; Forward passes it when a page was pushed
  after it (`through`, set on an overlay entry when anything is pushed from it), and
  otherwise returns to where it started. Forward after closing a modal therefore does
  nothing, and nothing reopens.
- **A reload** drops open overlays, and the entry it reloaded on becomes a page entry, as
  before. Entries from before a reload carry that document's `navId`s, which the new stack
  reuses from 0: a known gap of the URL sync, not of overlays.
- **Tests.** `historySync.test.ts` drives `createHistorySync` against a fake history.
  `e2e/overlay-history.spec.ts` (desktop and phone projects) covers a modal, stacked modals,
  a close button then Back and Forward, and a link inside a modal; `history-leave-guards.spec.ts`
  the guarded page with Settings open; `e2e/mobile/overlay-history.spec.ts` the drawer and a
  sheet on both engines.

## Event detail tabs

`eventTab` seeds which tab `EventDetailPage` opens on; `routes.ts` round-trips it as
`?tab=` without knowing the values. The tab set (`EventTab`, `BASE_TABS`, the Manage tab)
and every visibility gate belong to `EventDetailPage.tsx`, so adding a tab needs no route,
contract or title change.

- The open tab is nav state `event.tab`, seeded from `initialTab` (an unknown value seeds
  `info`). Clicking a tab changes nav state only, never the URL, so Back/Forward restore it.
- Each render derives the visible tabs and the active tab from gates: Bracket needs bracket
  stages; Maps needs a stage with a pick/ban pool; Predictions and Achievements need the
  event's `predictions_enabled` / `achievements_enabled`; Schedule follows
  `scheduleTabVisible` ([event-scheduling.md](features/event-scheduling.md)); Stream follows
  `streamTabVisible` ([stream-kit.md](features/stream-kit.md)); Looking for Partner
  (`players`) and Signup hide once `signupsClosed(event, now)` (`app/utils/signupWindow.ts`);
  Manage needs `canManageBracket`.
- A stored or `?tab=` tab whose gate fails renders `info`, silently. The URL is never
  rewritten. Gates fed by a later read (the bracket, the viewer's event status) read as
  closed until it lands, so `?tab=schedule` shows Info first and switches once the data
  allows it.

## Link semantics (`NavLink`)

Render anything the user clicks to navigate through `NavLink`
(`app/components/navigation/NavLink.tsx`):

```tsx
<NavLink view="player-detail" params={{ playerId: userId }} onActivate={() => openPlayer(userId)}>
    {children}
</NavLink>
```

- **Web:** an `<a href={viewToPath(view, params)}>`, so new tab, middle-click, copy link and
  the status-bar preview work. A modified or non-primary click is left to the browser; a
  plain click is `preventDefault`ed and calls `onActivate`, which goes through `navigate()`.
- **Desktop:** a `<button type="button">`, or with `as="div"` a `role="button"` element with
  Enter/Space handling, for places where a button is invalid or restyles the surface.
- `disabled` renders an inert `<span>` (or the `as` element), so a click falls through to an
  enclosing clickable row. `stopPropagation` defaults to `true` so a link inside a
  clickable row doesn't fire the row too.
- The web branch is an `<a>`, where Tailwind's `enabled:` variant never matches; express
  disabled and hover styling with `cn(..., !disabled && '…')`.

Markup rules:

1. Never nest a `NavLink` in another: nested anchors are invalid and the browser closes
   the outer one. When a card holds its own links, link the card's title and its call to
   action instead of the whole card.
2. Table rows (`<tr>`) stay plain click handlers; the row's name and time cells are the
   links.
3. An interactive element inside a link (e.g. `PatreonBadge` inside `PlayerInfo`) calls
   `preventDefault()` as well as `stopPropagation()`; otherwise the browser still follows
   the enclosing href.

`PlayerInfo`, `CapTimeLink`, `MapNavLink` and `MapNameCell` already wrap `NavLink`
([shared-components.md](shared-components.md)).

## Window-event navigation

Identity and time components don't import `navigate`; they dispatch a `window`
`CustomEvent` that `Main.tsx` (or `AppLayout`) handles. Render the component or call its
helper rather than dispatching by hand.

| Event | Detail | Dispatched by | Handled as |
|---|---|---|---|
| `open-player` | `{ userId }` | `PlayerInfo`, the profile menu | `navigate('player-detail', { playerId })` |
| `open-cap` | `{ capId }` | `CapTimeLink` / `openCap()` | `navigate('cap-detail', { capId })` |
| `open-team-cap` | `{ teamCapId }` | `CapTimeLink` / `openTeamCap()` | `navigate('team-cap-detail', { teamCapId })` |
| `open-news` | `{ newsId }` | `ArticleCard` via `openNews()` (`navigation/openNews.ts`) | `navigate('news-detail', { newsId })` |
| `open-settings` | `{ section? }` | installation banner, Cam tool, titlebar Settings button | `AppLayout` opens the Settings modal at that section |
| `open-change-title` | none | Home's profile doorway | `AppLayout` opens the Change Title modal |

`openMap(name)` is a direct helper (`navigate('maps-detail', { mapName })`) passed to pages
as `onMapSelect`. Settings is a modal, never a view; the profile menu's Settings item opens
it through local state.

## The sidebar registry

The rail is data. `app/components/navigation/nav-items.ts` is a pure module (no React,
tested without mounting) holding the sections, the item type and every rule about items:

- `BASE_NAV_SECTIONS` lists the sections; `buildNavSections(userProfile)` appends the Staff
  section (Admin) when `isStaff(userProfile)`. `AppLayout` renders each item through
  `SidebarNavItem`.
- A `NavItem` is `{ id, label, icon, shortLabel?, eventLink? }`. A plain item opens the
  page-view named by its `id`. An item with `eventLink: { slug, fullName, liveUntil }` opens
  that event's `event-detail` instead; there are no free-form view/params fields.
- `navItemDestination(item)` resolves `{ view, params }`. Every sidebar entry renders as a
  `NavLink` to its destination, prefetches that view on hover/focus, and on activation
  calls `changeView` (close the mobile drawer, then `onViewChange`, which is `navigate`).
- `eventSlugOfView(view, params)` says which event a view belongs to: `event-detail`,
  `match-pickban` and `event-team` belong to `params.eventSlug`, anything else to none. Use
  it for any "is this view part of event X?" rule instead of listing the event views.
- `isNavItemActive(item, view, params)`: a plain item is active on its own view; an event
  link is active whenever `eventSlugOfView` gives its slug (the event page with any tab, its
  match pages, its team pages). The plain `events` item is never active on an event page.
- `isEventLinkLive(eventLink, now)` decides the Live tag: through the whole `liveUntil` day
  in the viewer's local time zone, compared against the local start of the next day (the
  day is never parsed as a UTC instant). `AppLayout` passes `new Date()` each render. Only
  the tag expires; remove the item by hand after the event.
- `navItemCaption(item)` is `shortLabel ?? label`, the only source of rail captions. Set
  `shortLabel` only when the label doesn't fit a rail tile; `nav-items.test.ts` pins the
  captions of the live registry, so update it with any `shortLabel`.

Each `id` is unique. To add a page-view to the sidebar, add its `renderView` case and a
plain item (skill: add-data-page). To link an event, add an item with `eventLink` and no
`renderView` case.

**Accessible name.** It starts with the visible text: the label (or, collapsed, the
caption, then the full label as `sr-only` when it differs), then the event's `fullName`
(`sr-only`), then the badge details (`sr-only`), then "Live" (the visible chip expanded,
`sr-only` collapsed).

**Gated pages.** Hide the item and guard the case: Admin is appended only for staff
(`app/utils/roles.ts`), and the `admin` case passes `forceDenied={!isStaff(userProfile)}`
so a forced visit renders a denied card. The admin page is a hub of sections
(`app/components/pages/admin/registry.tsx`, each with its `roles`); a section is the
`activeSection` field of the admin page state, so switching sections (from the section
nav or a section's `onNavigate`) never adds a history entry. Admin sections:
[admin.md](features/admin.md), [map-uploads.md](features/map-uploads.md).

## Sidebar parts and the collapsed rail

The parts live in `app/components/layout/sidebar/` and only render; `AppLayout.tsx` keeps
every piece of state (drawer, `inert`, login error, logout confirm, Settings, Change
Title, the collapsed choice) and passes it down:

| Part | Renders |
|---|---|
| `SidebarBrand` | logo (with its seasonal-burst click and the diagnostic-overlay long-press, [mobile.md](mobile.md)) and, at `lg`+, the collapse toggle in its top-left corner |
| `SidebarActions` | Join Server and Launch Game; returns nothing without `capabilities.game` |
| `SidebarNavItem` | one nav row or rail tile: icon, badge marks, label or caption, Live chip or dot, tooltip |
| `SidebarCollapseToggle` | the icon-only collapse toggle |
| `SidebarReloadApp` | the drawer-only "Reload app" button (`location.reload()`); `AppLayout` mounts it only below `lg` |
| `SidebarUserCard` | the signed-in profile menu, or the Discord login and its error; a `promo` slot above either |

`SidebarActions` and `SidebarUserCard` read capabilities through `usePlatform()` themselves
so the web entry chunk can drop desktop-only markup.

**Desktop promotion row** (website only; the rules are in
[web-target.md](web-target.md#desktop-promotion)). `DesktopPromoNavRow`
(`app/components/desktopPromo/`) is not a destination and not a `sidebar/` part: it is a
self-contained promo part that owns its modal state.

- `AppLayout` mounts it lazily through `SidebarUserCard`'s `promo` slot, only when
  `capabilities.desktopPromo && useDesktopPromo().ambientVisible`. The card renders it first
  in its bordered footer, above Login with Discord or the profile card. It sits outside the
  `navigation` landmark and the scrolling nav, so the rail enumerations in
  `e2e/sidebarRail.ts` don't see it.
- It is a `button` ("Get the desktop app"), not a `NavLink`: it never calls `navigate()`.
  A click calls `onActivate` (closes the mobile drawer, like every row) and then opens the
  lazy `DesktopPromoModal`, portalled to `document.body` and prefetched on the row's
  `pointerenter` / `focus`.
- Collapsed it is an icon-only `size-11` square with the label `sr-only` and the right-side
  rail `Tooltip`.
- The × ("Dismiss the desktop app suggestion") calls `dismiss('nav')`, which also hides
  the server-browser strip. It shows on hover, on keyboard focus within the row and always
  on a touch device (`touch:`), and stays in the tab order.

**Modes.** At `lg` and up the rail is expanded (16rem) or collapsed (5rem). The effective
mode is `collapsePreference && !isMobileViewport`. Below `lg` the sidebar is always the
full drawer, the toggle isn't rendered and the shortcut isn't attached; the stored choice
returns when the window is wide again. `AppLayout` publishes the width as
`--sidebar-width` on `document.documentElement` (`16rem`, `5rem`, `0px` below `lg`) in a
layout effect; overlays beside the rail read it ([styling.md](styling.md)). Switching is
instant.

**Preference.** `utbt:sidebarCollapsed:v1` in `app/components/layout/sidebarPreference.ts`,
device-local. `readSidebarCollapsed()` is the `useState` initialiser, so a collapsed rail
paints collapsed on the first frame; only a stored `true` counts. Only `toggleCollapsed`
writes it.

**Toggle.** A `button` named "Collapse sidebar" / "Expand sidebar" with
`aria-expanded={!collapsed}` and `aria-controls="app-navigation"` (the `aside`'s id), and
the tooltip "… (Ctrl+B)". It is the sidebar's first focusable control. Below `lg` it is not
rendered, so it never enters the drawer's focus trap.

**Shortcut.** Ctrl+B or ⌘B on `window`, attached at `lg` and up. It acts on `b` (any case)
with exactly one of Ctrl/Meta and neither Alt nor Shift, and ignores an event already
`defaultPrevented` or one targeting an input, textarea, select or contentEditable. It
prevents the default; a held key (`repeat`) toggles once.

**Collapsed rail behaviour** (visuals in [styling.md](styling.md)):

- Items are tiles (icon over caption) with the same destination, href, prefetch and
  activation as expanded. Section titles become `sr-only` headings followed by a divider.
- Each tile has one right-side `Tooltip` (hover and focus): full label, event full name,
  "Live", then the badge details. The icon marks lose their own tooltip collapsed;
  expanded keeps the badge tooltip on the icon and none on the label.
- Live shows as a dot on the icon with "Live" kept as `sr-only` text.
- On desktop Join and Play become tiles captioned "Join" / "Play" with the full names
  `sr-only`; a disabled Play keeps its "No valid UT99 installation found" tooltip.
- Signed in, the user card trigger is the avatar alone, a `button` named
  "<name>, profile menu"; the menu opens to the right. Both modes share one menu header in
  which the Patreon badge is inert (a focusable button breaks the menu's roles).
- Signed out, a square "Login with Discord" button; a login error shows in a popover
  portalled to `document.body` (`role="alert"`, linked by `aria-describedby`) and clears on
  the next login click.

**Mobile drawer.** Below `lg` (`AppLayout` reads `belowLg` from the device environment, the
same boundary as the `lg` classes) the same `aside` is an off-canvas drawer behind a top bar. Closed, it
is `inert`; open, it traps focus, closes on Escape and returns focus to what opened it (the
menu button, or the tab bar's Menu tab while it is still on screen). On web, Back closes it
([Overlay history](#overlay-history-web-build)), and a user-menu item that opens a modal
(Settings, Change title, Sign out) closes it. It opens only from those
two controls and closes with a swipe to the left (`useDrawerSwipe`, with the pure thresholds
in `app/components/layout/drawerSwipe.ts`). Keep `inert` and the breakpoint in step when
changing the shell ([web-target.md](web-target.md)).

## Bottom tab bar

On touch below `lg` in portrait, `AppLayout` mounts `BottomTabBar`
(`app/components/layout/BottomTabBar.tsx`) under the content
([web-target.md](web-target.md)). Its data is the pure module
`app/components/navigation/bottomTabs.ts`, tested in `bottomTabs.test.ts`:

- `BOTTOM_TABS` is Home, Maps, World Records and Events, taken from the sidebar registry's
  items, so labels, captions (`navItemCaption`) and icons match the sidebar. Menu is the fifth
  slot and opens the drawer.
- `activeBottomTab(view)` picks the highlighted tab:

  | View | Highlights |
  |---|---|
  | `home` | Home |
  | `maps`, `maps-detail` | Maps |
  | `world-records` | World Records |
  | `events`, `event-detail`, `match-pickban`, `event-team` | Events |
  | anything else | none |

  The highlighted tab is a link with `aria-current="page"`. Add a view to this table when it
  belongs to one of the four sections.
- `showsBottomTabs(environment)` is the gate: touch, below `lg`, portrait.

Every tab is a `NavLink` that calls `changeView` (close the drawer, then `navigate`), the same
path as a sidebar item, so leave guards, URL sync and scroll restore behave as they do there.

## Sidebar badges and the new-item highlight

**Rendering contract.** `AppLayout` calls `getNavBadge(view, params)` with each item's
resolved destination, not its id, so event links are told apart by `params.eventSlug`.
`Main.tsx` implements it as one call to
`resolveNavBadge(destination, eventAttention, allEventsAttention, badgeCounts)`
(`nav-items.ts`). A `NavBadge` is `{ count: number | null, live: boolean, details: string[] }`:
`count` draws a bubble on the icon, `live` a pulsing dot, and `details` are the tooltip
lines (one per line, no native `title`), repeated as `sr-only` text.

`resolveNavBadge` picks the badge by destination:

- A destination that belongs to an event (`eventSlugOfView`) gets
  `attentionNavBadge(eventAttention[slug])`: that event's own to-dos and open-lobby dot,
  never the cross-event total.
- `events` gets `attentionNavBadge(allEventsAttention, newSinceVisitBadge(count))`: any
  to-dos replace the "new events" count; with none, the new count stays and the lobby dot
  can sit beside it.
- `maps`, `world-records` and `news` get `newSinceVisitBadge(count)`: the count with one
  line "N new since your last visit", or `null`.

To-dos and the lobby dot have no seen marker and clear on their own once the condition
ends. What the attention counts mean and how `Main.tsx` derives them (its 60 s attention
poll plus window focus): [event-scheduling.md](features/event-scheduling.md).

**"New since last visit" counts.** Only for the four badged views (`maps`,
`world-records`, `events`, `news`). `Main.tsx` fetches per-account counts and seen
markers at boot, on sign-in and on window focus, so a visit on another device clears the
pill here. Counts are computed server-side against the account's seen markers; a `null`
count (never visited) shows nothing. Signed out, there are no badges.

**`markViewed(view, { highlight })`** runs in `commitNavigate` before the same-view
early return (so re-clicking the active item still clears it) and in `pushExternal` (web
Back/Forward to a lost entry, deep links). Visiting a page from the sidebar or a Home tile
therefore behaves identically. It:

- ignores non-badged views and a zero count;
- zeroes the count optimistically and advances the server marker to the badge fetch's
  `as_of` snapshot, not the wall clock, so items added after the fetch stay new;
- queues marks made before the badge fetch resolves and replays them when it lands (with
  highlight); the view on screen is then marked without highlight;
- on the focus refresh re-marks the view on screen with `{ highlight: false }`: the user
  didn't navigate, so nothing may reorder, refilter or scroll.

Legacy per-device markers (`utbt:newMapsSeen:v1`, `utbt:newRecordsSeen:v1`,
`utbt:newEventsSeen:v1`, `utbt:newsSeen:v1`) are migration inputs only: on a badge fetch
an unset server marker is seeded from the local value, and the key is removed once that
call succeeds (a failure retries next fetch). No code writes them.

**Highlight.** When the cleared count was above zero, `markViewed` dispatches
`highlight-new` `{ view, since }`, and if the target view is not the one on screen it also
writes the sessionStorage hand-off `utbt:highlightSince:<view>` (`writePendingHighlight`)
for the page that is about to mount. A mounted page is served by the event alone; an
unconsumed key would replay a stale highlight on the next visit.

`useNewItemHighlight(view, onActivate?, itemsReady?)` (`app/hooks/useNewItemHighlight.ts`)
consumes either, rings the items newer than `since` and scrolls the first into view; the
ring drops 7 s after `itemsReady` turns true (Events and News pass it so a slow fetch
doesn't burn the window on a spinner). `onActivate` makes the new items reachable: Maps
sorts by `added` desc, World Records switches to records by date desc, News clears its
category filter and skips scroll restore, Events skips scroll restore (both keep
[`useNavScrollRestore`](#scroll-position-and-the-shell-scroller) holding, so Back can't pull
the page away from the highlighted item). Compared timestamps: `map.added`,
`record.added`, `article.publishedAt`, `event.published_at ?? event.created_at` (Events
skips `draft` rows, which the count excludes). The hook parses naive
`YYYY-MM-DD HH:MM:SS` timestamps as UTC; a raw `Date.parse` would read them as local time.

## Page refresh registry and freshness

`PageRefreshContext` (`app/components/navigation/PageRefreshContext.tsx`) is the registry
for a page's refresh. A page calls
`useRegisterPageRefresh({ onRefresh, refreshing, disabled, tooltip })`, and two controls
call it through the registry's `trigger()`:

- `NavHistoryBar` renders the Refresh button beside Back/Forward, on desktop only.
- **Pull-to-refresh**, on any touch device: a pull past about 70 px at the top of the shell
  scroller ([web-target.md](web-target.md), the gesture). Its spinner stays while the page
  reports `refreshing`, and for at least 600 ms. A page in its `disabled` cooldown spins
  without being called.

`trigger()` on a page that registered no handler dispatches `REMOUNT_VIEW_EVENT`. `Main`
counts it into the view's `ErrorBoundary` key, so the current view re-mounts in place and
fetches again. What survives a re-mount is in
[state-patterns.md](state-patterns.md#refresh-handlers-and-pull-to-refresh). On web without
a touch screen, freshness comes from the mount rule below plus the browser's reload.

**Every page-view revalidates on mount**, on both targets. The `caches` singleton is a
render cache for instant revisits, not an authority: render the cached data, fetch anyway,
swap results in silently (no skeleton while a cache exists). The paginated pages get this
from their per-mount page-cache refs; `TeamsPage`, `EventsPage`, `AchievementsPage` use
`load(background)`, `ServerBrowserPage` uses `fetchServers({ silent })`, and `Home` always
refetches behind its cache. A mount effect that returns early because "the cache is warm"
is a staleness bug. `onRefresh` clears every cache layer it owns (page-cache refs and its
`caches` slices) before refetching.
