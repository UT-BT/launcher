---
doc: navigation
read_when:
  - "adding a new view/page to the nav stack or sidebar"
  - "opening a detail page or wiring a click that navigates"
  - "anything touching Back/Forward, history, or per-entry state keying"
keywords: [navigate, Main.tsx, AppLayout, NavEntry, useNavigation, open-player, open-cap, renderView, HISTORY_CAP, back, forward]
provides: "the whole navigation model: stack, navigate() funnel, renderView, sidebar registry, event-driven detail pages"
not_here:
  - "where page state / persistence lives → state-patterns.md"
  - "the PlayerInfo / CapTimeLink components that trigger nav → shared-components.md"
sections: [the-model, navigate-is-the-only-entry-point, url-sync-web-build, page-views-vs-detail-pages, the-sidebar-registry, event-driven-navigation, sidebar-new-badges, page-refresh-registry, per-entry-state]
last_verified: 2026-07-24
verify_against:
  - app/components/main/Main.tsx
  - app/components/layout/AppLayout.tsx
  - app/components/navigation/NavigationContext.tsx
  - app/components/navigation/useNavState.ts
  - app/components/navigation/routes.ts
  - app/components/navigation/useUrlSync.ts
  - app/components/navigation/useDocumentMeta.ts
  - app/components/navigation/titles.ts
  - app/public/route-contract.json
---

# Navigation

There is **no URL router**. `Main.tsx` owns an in-memory history stack and a
`switch` that renders the active view. Everything else funnels through one
`navigate()`. On the **web build only**, the browser URL mirrors the stack —
see [URL sync (web build)](#url-sync-web-build); desktop stays URL-less.

## The model

`Main.tsx` holds two pieces of state:

```ts
const [entries, setEntries] = useState<NavEntry[]>(() => [{ id: 0, view: 'home', params: {}, state: {} }])
const [cursor, setCursor] = useState(0)
```

- **`NavEntry`** (`app/components/navigation/NavigationContext.tsx`) =
  `{ id, view, params: NavParams, state: Record<string, unknown> }`. `id` is a
  monotonic counter; `state` is the per-entry bag (see below).
- **`NavParams`** = `{ mapName?, playerId?, capId?, teamCapId?, newsId?, teamId?, mapsNewOnly? }` — the params a
  view can carry. Add a field here if a new detail page needs a different
  identifier, or if a page must open in a specific state. `mapsNewOnly` seeds the
  Maps page's new-only filter when opened from the Home "new maps" tile; `MapsPage`
  reads it via its `initialNewOnly` prop on mount. (Seed page state through params
  like this — never by mutating another page's per-entry state before `navigate()`.)
- The stack is **in-memory only** — it boots to a single `home` entry on every
  launch and is never persisted. (Preferences persist; history doesn't — see
  `state-patterns.md`.)

The active entry (`entries[cursor]`) is exposed through `NavigationContext`;
components read it via `useNavigation()`.

## `navigate()` is the only entry point

```ts
navigate(view: string, params?: NavParams)
```

- No-op if the active entry already matches (`view` + `paramsEqual(params)`).
- Otherwise it **truncates forward history** (`entries.slice(0, cursor + 1)`),
  pushes a new entry with a fresh empty `state` bag, and points the cursor at it.
- Capped at `HISTORY_CAP` (50) — overflow drops from the front and the cursor
  shifts with it.

`back()` / `forward()` just move the cursor (clamped); `canBack` / `canForward`
gate the UI. Back/forward also fire on **mouse buttons 3/4** and
on **Alt+←/→** (suppressed while typing in an input/textarea/select/contentEditable);
both custom handlers are skipped on the web build, where the browser natively maps
those inputs to history navigation. `NavHistoryBar` (rendered in `AppLayout`) is
the back/forward + refresh button bar **on desktop only** — on web the whole
bar never renders (`IS_WEB`; browser chrome owns history and reload).

**Rule: never add a second navigation mechanism.** No raw `setCurrentView`, no
parallel back stack. Sidebar clicks, `openMap`, and the `open-*` events all call
`navigate()`. This is hard rule 6. (URL sync below is not a second mechanism —
it mirrors this stack, it never drives it except on external entry.)

## URL sync (web build)

Files: `app/components/navigation/routes.ts` (`viewToPath` / `pathToNav`) +
`app/components/navigation/useUrlSync.ts`. Desktop is untouched — `useUrlSync`
returns `null` unless `IS_WEB`, and `pushUrlForEntry` no-ops.

Model: **the in-memory stack stays master; browser history mirrors it.**

- `Main.tsx` seeds `entries` from the URL (`seedEntriesFromUrl`) and the boot
  effect `replaceState`s the canonical path (unknown paths normalize to `/`).
- `navigate()` also calls `pushUrlForEntry(entry)` → `history.pushState({navId},
  '', viewToPath(...))`.
- In-app Back/Forward delegate to `history.back()/forward()` on web; the
  `popstate` handler looks up `event.state.navId` in the stack and moves the
  cursor. A `navId` that is missing (external entry, `HISTORY_CAP` trim) falls
  back to `pathToNav` and pushes a fresh entry — its per-entry state starts
  empty, which is accepted.
- `/auth/callback` is consumed before React mounts (see `agents/web-target.md`)
  and never becomes a view.

Path scheme: `/` home, `/servers`, `/maps` (+`?new=1`), `/maps/:mapName`,
`/players`, `/players/:playerId`, `/teams`, `/teams/:teamId`, `/world-records`,
`/cap-it-all`, `/caps/:capId`, `/team-caps/:teamCapId`, `/achievements`,
`/news`, `/news/:newsId`, `/admin`; unknown → `/`. Adding a view = add both
directions in `routes.ts`, same commit.

**Adding a route is now a three-file change.** `app/public/route-contract.json`
ships the same table for per-URL link previews (see `agents/web-target.md` → SEO
and link previews), and `titles.ts` supplies the tab title.
`routes.contract.test.ts` fails if any of the three drift — it asserts the
contract's view list equals the `case` labels in `viewToPath`, round-trips every
path, and requires a non-default title per view.

**Document metadata.** `Main.tsx` calls `useDocumentMeta(currentView,
entry.params)` right after resolving the active entry; it sets `document.title`
and the canonical link on every navigation. Detail pages additionally call
`useDocumentTitle(name)` once loaded — React flushes child effects before the
parent's, so the generic title lands first and the specific one replaces it when
data arrives. Do **not** hook this into `useUrlSync`'s effect: its deps are
`[stackRef, setCursor, pushExternal]` and `stackRef` is a ref, so it does not
re-run on navigation.

## Page-views vs detail-pages

`renderView()` switches on `currentView`. Two kinds of case:

| Kind | Views | Keyed? | Why |
|---|---|---|---|
| **Page-views** | `home`, `servers`, `maps`, `players`, `teams`, `cap-it-all`, `world-records`, `achievements`, `news`, `admin` | **No** — one reused instance per view | Not-keyed means no remount between *entries of the same view*. It does **not** mean the component survives a view change: `renderView()` returns exactly one element, so `home` -> `maps` unmounts `Home`. State and data survive because they are hoisted to `Main` — per-entry via `usePageState`, data via a `caches` singleton — and read back on remount, **not** because the component stays mounted. A page-view that keeps data in its own `useState` refetches it on every visit. |
| **Detail-pages** | `maps-detail`, `player-detail`, `cap-detail`, `news-detail`, `team-detail` | **Yes — `key={entry.id}`** | A new visit must remount so it refetches for the new param and `useNavState` re-reads the right entry's bag. |

Detail cases pull their identifier from `entry.params` (`mapName!` / `playerId!` /
`capId!` / `newsId!` / `teamId!`). Forgetting `key={entry.id}` on a detail case is a bug: the page keeps
the previous visit's data and UI state. `team-detail` (`TeamDetailsPage`) is role-aware:
it fetches `/teams/<id>` + `/me/team`, derives `viewerRole` (owner/admin/member/none) +
`isOwnTeam`, and renders management / member / public branches accordingly; leave/disband/
join/accept/decline route back to the `teams` gallery and force it to refresh.

## The sidebar registry

The left rail is data, not markup. The base groups are a const, but the rendered
list is **computed from `userProfile`** via `buildNavSections` in
`app/components/layout/AppLayout.tsx` (so role-gated groups can be appended):

```ts
const BASE_NAV_SECTIONS: NavSection[] = [
  { title: 'Main', items: [{ id: 'home', label: 'Home', icon: Home }, /* … */] },
  { title: 'UTBT.net', items: [{ id: 'maps', /* … */ }] },
  // …
]

function buildNavSections(userProfile?: UserProfile): NavSection[] {
  if (!isStaff(userProfile)) return BASE_NAV_SECTIONS
  return [...BASE_NAV_SECTIONS, { title: 'Staff', items: [{ id: 'admin', label: 'Admin', icon: ShieldAlert }] }]
}
// in the component: const navSections = useMemo(() => buildNavSections(userProfile), [userProfile])
```

Each `item.id` must match a `renderView` case; clicking calls
`changeView(item.id)` — a thin wrapper that closes the mobile drawer and then
calls `onViewChange` (`navigate`). Below the `lg` breakpoint the same sidebar
`<aside>` renders as an off-canvas drawer behind a hamburger top bar (see
`agents/web-target.md`, responsive-layout). To add a sidebar page: add the
`renderView` case **and** a `navSections` item. (Settings is **not** a view — it's
a modal opened from the user dropdown / the `open-settings` window event.)

**Gated pages** (e.g. `admin`): hide the nav item (`buildNavSections` only appends
the Staff group when `isStaff(userProfile)`, helpers in `app/utils/roles.ts`) **and**
guard the `renderView` case — `admin` passes `forceDenied={!isStaff(userProfile)}` so
a forced view renders a denied card instead of the page. The `admin` page is itself a
section hub; see `app/components/pages/admin/registry.tsx`.

## Event-driven navigation

Identity/time UI doesn't import `navigate` — it dispatches a `window` CustomEvent
that `Main.tsx` listens for:

| Event | Detail | Dispatched by | `Main.tsx` does |
|---|---|---|---|
| `open-player` | `{ userId }` | `PlayerInfo` (click) | `navigate('player-detail', { playerId: userId })` |
| `open-cap` | `{ capId }` | `CapTimeLink` / `openCap()` | `navigate('cap-detail', { capId })` |
| `open-news` | `{ newsId }` | news `ArticleCard` / `openNews()` | `navigate('news-detail', { newsId })` |
| `open-settings` | `{ section? }` | the installation banner | `AppLayout` opens the Settings modal (the user-dropdown Settings item opens it directly via local state, not this event) |

`openMap(name)` is a direct helper (`navigate('maps-detail', { mapName })`) threaded
to pages as `onMapSelect`. Render `PlayerInfo` and `CapTimeLink` (see
`shared-components.md`) — don't dispatch these events by hand. `openNews(id)`
(`app/components/navigation/openNews.ts`) is the news equivalent, dispatched by the
news `ArticleCard`.

## Sidebar "new" badges + new-item highlight (not navigation)

Two cross-cutting signals decorate the UI around navigation but are **not**
navigation events — `Main.tsx` doesn't turn them into `navigate()` calls, so they
don't belong in the table above:

- **`summary-badges`** — dispatched by `Home.tsx` after it loads the summary
  (`{ maps, worldRecords }`, each `{ count, newestIso }`). `Main.tsx` holds the
  badge state and renders the sidebar count pills via the `getNavBadge` prop it
  threads into `AppLayout` (AppLayout is display-only here).
- **`highlight-new`** — dispatched by `Main.tsx`'s `markViewed()` (folded into
  `navigate()`), consumed by `useNewItemHighlight` on the Maps / World Records
  pages to briefly ring rows added since the last visit. A pending hand-off is
  also written to `sessionStorage` (`writePendingHighlight`) for the page that
  mounts right after navigating.

Because `markViewed()` lives inside `navigate()`, opening Maps / World Records from
**either** the sidebar **or** the Home tiles clears the "new" badge and fires the
highlight identically. Seen-stamps persist in `localStorage`
(`utbt:newMapsSeen:v1` / `utbt:newRecordsSeen:v1`).

## Page refresh registry (not navigation)

`PageRefreshContext` (`app/components/navigation/PageRefreshContext.tsx`) is a
cross-cutting **refresh-button registry**, not a history primitive. A page calls
`useRegisterPageRefresh({ onRefresh, refreshing, disabled, tooltip })`;
`NavHistoryBar` renders one shared refresh button beside Back/Forward and invokes
the registered handler. Pages no longer hand-roll their own refresh button.
**Desktop-only surface** — on web `NavHistoryBar` never renders, so the
registered handler is unreachable there. Freshness on web comes from the
mount contract below, plus the browser's own reload.

**Freshness contract (both targets):** the `caches` singleton exists so a
revisit paints instantly — it is a render cache, not a data authority. Every
page-view must **revalidate on mount**: render the cached data, then kick the
fetch anyway and swap results in silently (no skeleton when cache exists).
The paginated pages get this for free (their page cache is a per-mount ref);
`Home`, `TeamsPage`, `AchievementsPage`, `ServerBrowserPage` do it explicitly
with a `background`/`silent` flag. A mount effect that early-returns because
"the cache is warm" is a staleness bug. The registered `onRefresh` must clear
every cache layer it owns (page cache refs AND the `caches` singleton slices)
before refetching.

## Per-entry state

The active entry's `state` bag backs two hooks (both keyed to the current entry,
so Back/Forward restore them):

- **`usePageState`** (in `Main.tsx`) — primary-page query state.
- **`useNavState(key, default)`** (`app/components/navigation/useNavState.ts`) —
  detail-page transient UI (tab/search/sort/pagination/scroll). **Value setter
  only** — no functional updater. Scroll restoration: `useNavScrollRestore`.

The tier rules, persistence, and `usePageState` wiring live in
`state-patterns.md` — this doc owns the stack + routing; that one owns what's
stored.
