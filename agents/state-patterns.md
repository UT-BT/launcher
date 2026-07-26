---
doc: state-patterns
read_when:
  - "adding or changing a primary page's state, filters, sort, columns, or pagination"
  - "deciding where a piece of UI state lives (per-visit vs persisted vs cache vs account-synced)"
  - "adding a localStorage key, a filter preset, or tutorial state"
  - "making a preference follow the signed-in user across devices"
  - "wiring detail-page transient UI (tabs/search/scroll) that must survive Back/Forward"
keywords: [usePageState, useNavState, localStorage, PREF_KEYS, caches, querySig, presets, tutorial, persistence, controlled-page, userState, synced, badges, seen]
provides: "the state tiers (incl. the account-synced tier), the localStorage key convention, and how pages are controlled + hoisted"
not_here:
  - "the navigation stack / navigate() / renderView wiring → navigation.md"
  - "the shared components used (FilterPresetsMenu, ColumnsMenu, Tutorial) → shared-components.md"
sections: [controlled-pages-with-hoisted-state, navigation-history-per-entry-ui-state, account-synced-state, localstorage-persistence, filter-presets, tutorial-state, favorites, naming-conventions]
last_verified: 2026-07-25
verify_against: [app/components/main/Main.tsx, app/components/navigation/useNavState.ts, app/hooks/useAsync.ts, app/utils/userState.ts]
---

# State patterns

How user-facing UI state is structured, hoisted, and persisted across the app.
New pages must follow these patterns.

## Controlled pages with hoisted state

Every primary page (`MapsPage`, `ServerBrowserPage`, etc.) is a **controlled
component**. The page receives `state`, `onStateChange`, `caches`,
`onCachesChange` as props. In `Main.tsx`, `caches` are shared singletons, but
`state`/`onStateChange` are wired through **`usePageState`** (not a plain
`useState`) so the page's state is stored **per navigation-history entry**.

**Why:** a page's query state (search/filters/sort/page/scroll) belongs to the
*visit*, not the app. Going back/forward restores that entry's exact state; a
**fresh** open (sidebar click, opening something new) starts from defaults.
Preference fields (column layout, page-size, filters-panel-open) are the
exception — they persist across fresh opens and restarts via localStorage. Data
caches survive (shared singleton) so revisiting a page doesn't refetch — but only
for data actually hoisted into that page's `caches`. Anything a page **or one of its
children** keeps in local `useState` is refetched on every visit, because
`renderView()` unmounts the page on a view change (see `agents/navigation.md`). A
child that fetches for itself therefore needs its slice threaded through the page's
`caches` too — `Home` does this for the Medal Hunt rows, the community counts and
the first page of maps-to-review.

**Caches are shared, query state is per-entry — so a cache holds only the *last*
query's rows.** For server-queried/paginated pages (e.g. `PlayersPage`,
`CapItAllPage`), store the query signature the rows were fetched for as
`caches.querySig` and gate the skeleton on it:
`showSkeleton = caches.querySig !== currentQuerySig || (loading && rows.length === 0)`.
Otherwise a fresh visit (query reset) briefly flashes the previous query's rows
before the refetch lands. Pages that filter a full client-side cache
(`WorldRecordsPage`, `ServerBrowserPage`, `MapsPage` browse mode, Achievements)
don't need this — their filtering is synchronous, so there's no stale gap.

`usePageState(storageKey, default, prefKeys, getEntryState, updateEntryState)`
returns the same `[state, setState]` shape as `useState`, so page wiring in
`renderView` is unchanged. It: (a) stores the full page state in the active
entry's bag (fresh entry = `{...default, ...persistedPrefs}`, Back/Forward =
restored snapshot); (b) mirrors only `prefKeys` to localStorage. Define a page's
`*_PREF_KEYS` in `Main.tsx` next to its `*_STORAGE_KEY`. A page with no prefs
(e.g. Achievements) passes `[]` and persists nothing.

### Page shape

```tsx
export interface FooPageState {
  filters: FilterState
  sortBy: FooSortField
  sortDir: SortDir
  filtersPanelOpen: boolean
  columnVisibility: Record<FooColumnId, boolean>
  columnOrder: FooColumnId[]
  scrollTop: number
}

export interface FooPageCaches {
  items: Foo[]
  lastRefreshIso: string | null
}

export const DEFAULT_FOO_STATE: FooPageState = { ... }
export const DEFAULT_FOO_CACHES: FooPageCaches = { ... }

interface FooPageProps {
  state: FooPageState
  onStateChange: (updater: (prev: FooPageState) => FooPageState) => void
  caches: FooPageCaches
  onCachesChange: (updater: (prev: FooPageCaches) => FooPageCaches) => void
  // ...page-specific props
}
```

### Main.tsx wiring

```tsx
const FOO_STATE_STORAGE_KEY = 'utbt:fooState:v1'
const FOO_PREF_KEYS: readonly (keyof FooPageState)[] = ['columnVisibility', 'columnOrder']
const [fooState, setFooState] = usePageState(FOO_STATE_STORAGE_KEY, DEFAULT_FOO_STATE, FOO_PREF_KEYS, getEntryState, updateEntryState)
const [fooCaches, setFooCaches] = useState<FooPageCaches>(DEFAULT_FOO_CACHES)

// in renderView (unchanged — usePageState returns a useState-shaped tuple):
case 'foo':
  return <FooPage state={fooState} onStateChange={setFooState} caches={fooCaches} onCachesChange={setFooCaches} />
```

## Navigation history & per-entry UI state

There are **three** state tiers. Know which one a given piece of state belongs in.

1. **Per-entry page state** (above, via `usePageState`). Primary-page query state
   (search/filters/sort/page/scroll) lives in the active history entry — fresh open
   resets, Back/Forward restores. Only pref fields (columns/page-size/panel) persist
   to `utbt:*:v1`. Caches are shared singletons in `Main.tsx`.
2. **Navigation history stack** — `entries: NavEntry[]` + `cursor` in `Main.tsx`,
   in-memory only. This is the *navigation* tier; its mechanics (the single
   `navigate()` funnel, `back()`/`forward()`, `HISTORY_CAP`, detail keying) live in
   `agents/navigation.md`. What matters for state: tier 1 (per-entry page state)
   and tier 3 (per-entry UI bag) are both keyed to the active entry, so
   Back/Forward restore them; a fresh `navigate()` starts from defaults.
3. **Per-entry UI-state bag** — `useNavState(key, default)` from
   `app/components/navigation/useNavState.ts`. Reads/writes a key on the **active
   history entry's** `state` bag, so the value survives Back/Forward to that entry
   while staying scoped to that single visit. Use for **detail-page** transient UI
   state (search/sort/active-tab/pagination/scroll/expansion) that previously died
   on unmount (e.g. the player-profile World Records tab search).

```tsx
// detail sub-component
const [query, setQuery] = useNavState('wrs.query', '')      // key convention: <card>.<field>
const [sortDir, setSortDir] = useNavState<'asc'|'desc'>('wrs.sortDir', 'desc')
```

Rules for `useNavState`:

- **Value setter, not a functional updater.** `setX(v)` only — `setX(prev => …)`
  does NOT work. Use the in-scope value: `setSortDir(sortDir === 'asc' ? 'desc' : 'asc')`.
- **Don't store fetched data** in the bag — only small primitives. Detail data
  refetches on remount (the memory tradeoff: no DOM/data keep-alive).
- **Debounced search:** keep `queryRaw` as plain local `useState` (fast typing,
  local re-render), persist only the debounced `query`, and **seed `queryRaw` from
  the persisted value**: `const [query,setQuery] = useNavState('x.query',''); const
  [queryRaw,setQueryRaw] = useState(query)`. Otherwise the debounce overwrites the
  restored value with empty.
- **Pagination:** pass the controlled `page`/`pageSize`/`onPageChange`/
  `onPageSizeChange` props of `usePaginatedQuery` (in `app/hooks/useAsync.ts`) from
  `useNavState`. The hook skips its first-render `setPage(1)` reset so a restored
  page isn't clobbered on remount.
- **Detail views remount per visit.** In `Main.tsx`, the three detail cases carry
  `key={entry.id}` so a new param refetches and `useNavState` re-reads the right
  bag. Page-type cases are intentionally NOT keyed (one reused instance).
- Scroll: use `useNavScrollRestore(ref, loadingDone)` for detail scroll containers.

## Account-synced state (`app/utils/userState.ts`)

A fourth tier: preferences that follow the **signed-in account across devices**
(the same person uses the desktop app and the website). The store is a synced
localStorage mirror — reads are synchronous, writes hit localStorage immediately,
and for whitelisted keys the change is also pushed to the user's server-side
state (debounced ~1.5 s, dirty-keys-only shallow merge, flushed on
`pagehide`/tab-hidden). Signed out or offline it behaves exactly like plain
localStorage.

API: `getSynced(key, fallback)` / `setSynced(key, value)` /
`subscribeSynced(key, cb)`; `initUserStateSync(token, accountId)` runs at
sign-in (`app/app.tsx`) — server values win and overwrite localStorage
(subscribers fire) except for keys dirtied while the fetch was in flight, and
local-only values upload once as a migration; `stopUserStateSync()` on
sign-out. The store remembers which account last synced
(`utbt:syncAccount:v1`): signing in as a different account purges all synced
keys first, so one machine's leftovers never upload into another account.
Failed flushes retry with exponential backoff (1.5 s → 60 s cap); the
`pagehide` flush drops `keepalive` for blobs near the 64 KB keepalive quota.

Rules:

- **Which keys sync is a whitelist** (`isSyncedKey` in `userState.ts`): theme,
  tutorial seen-flags, server favorites + presets, Maps/World-Records filter
  presets, admin `:filters:v1` presets, Medal Hunt dismissals. Everything else
  (column layout, page sizes, panel-open flags, ui-scale, replay volume, recent
  servers, auth) is **deliberately device-local** — layout preferences differ
  between a 4K desktop and a phone. Add a key to the whitelist only if the user
  would expect it to follow their account.
- Consumers go through the store's helpers, never raw
  `localStorage.getItem/setItem`, for any whitelisted key — and should
  `subscribeSynced` if a server value arriving after mount must re-render.
- Values must be JSON round-trippable; keys keep the `utbt:<thing>:v<n>`
  convention (bump the version to abandon a bad shape — old versions just stop
  syncing).
- **"New since last visit" markers are NOT in this store.** The sidebar badge
  counts for Maps / World Records / Events / News are computed **server-side**
  against per-account seen markers. `Main.tsx` fetches them at boot + on window
  focus, `markViewed` (fired from `navigate()`/deep links) optimistically zeroes
  a badge and advances the marker. Signed-out users get no badges. See
  `agents/navigation.md` (sidebar-new-badges) and `agents/data-sources.md` for
  the endpoints.

## localStorage persistence

### Conventions

- **Versioned keys:** `utbt:<thing>:v<n>`. Bump version when shape changes
  incompatibly.
- **Persist preferences, not query state or caches.** For primary pages, only
  pref fields persist (handled by `usePageState`/`loadPrefs` in `Main.tsx`).
  Query state is per-entry; caches refetch per launch. Other persisted state
  (presets, favorites, tutorial seen-flags) goes through the account-synced
  store above when whitelisted, plain localStorage otherwise.
- **Merge over defaults on load.** Persisted JSON may be missing fields you've
  added since (or have stale fields you've removed). `loadPrefs` does this for
  page prefs (picks `prefKeys`, falls back to the default for missing keys). Any
  other direct loader should merge over its default the same way, e.g.:

```ts
function loadFoo(): Foo {
  if (typeof window === 'undefined') return DEFAULT_FOO
  try {
    const raw = window.localStorage.getItem('utbt:foo:v1')
    return raw ? { ...DEFAULT_FOO, ...JSON.parse(raw) } : DEFAULT_FOO
  } catch {
    return DEFAULT_FOO
  }
}
```

### Current storage keys

The `utbt:*State:v1` keys below are written by `usePageState` and hold the
page's **preference fields only** (the `*_PREF_KEYS` subset), not full query
state. **Synced?** = whitelisted in the account-synced store (follows the
signed-in user across devices); everything else is device-local.

| Key | Owner | Synced? | Contents |
|---|---|---|---|
| `utbt:mapsPageState:v1` | `Main.tsx` (`usePageState`) | no | Maps prefs: `filtersPanelOpen`, `pageSizePreference` |
| `utbt:mapsColumns:v1` | `MapsPage` | no | `Record<ColumnId, boolean>` |
| `utbt:mapsColumnOrder:v1` | `MapsPage` | no | `ColumnId[]` |
| `utbt:mapsPresets:v1` | `MapsPage` (via `filterPresets.ts`) | **yes** | `MapsPreset[]` |
| `utbt:mapsPageTutorial:v1` | `MapsPage` (via hook) | **yes** | `{ seen, version }` |
| `utbt:serversState:v1` | `Main.tsx` (`usePageState`) | no | Servers prefs: column visibility/order, `filtersPanelOpen` |
| `utbt:serverPresets:v1` | `Main.tsx` | **yes** | `ServerPreset[]` |
| `utbt:serverFavorites:v2` | `Main.tsx` | **yes** | `string[]` (server IDs) |
| `utbt:serversPageTutorial:v1` | `ServerBrowserPage` (via hook) | **yes** | `{ seen, version }` |
| `utbt:playersState:v1` | `Main.tsx` (`usePageState`) | no | Players prefs: column visibility/order, `pageSizePreference` |
| `utbt:playersPageTutorial:v1` | `PlayersPage` (via hook) | **yes** | `{ seen, version }` |
| `utbt:capItAllState:v1` | `Main.tsx` (`usePageState`) | no | Cap-It-All prefs: `pageSizePreference` |
| `utbt:worldRecordsState:v1` | `Main.tsx` (`usePageState`) | no | World Records prefs: column visibility/order, `pageSizePreference`, `filtersPanelOpen` |
| `utbt:worldRecordsPresets:v1` | `WorldRecordsPage` (via `filterPresets.ts`) | **yes** | `FilterPreset[]` |
| `utbt:achievementsState:v1` | `Main.tsx` (`usePageState`) | no | none (no pref fields → nothing persisted) |
| `utbt:teamsState:v1` | `Main.tsx` (`usePageState`) | no | none persisted (no pref fields); per-entry query state = team-gallery search/page + directory access filter + sort field + sort direction + scroll. Gallery caches (`myTeam`, `invitations`) live in the shared singleton, refreshed on mount and updated from each mutation's fresh `TeamDetail`. The role-aware `team-detail` page fetches its own `/teams/<id>` + `/me/team`; leave/disband/join/accept/decline invalidate the gallery cache and route back. |
| `utbt:eventsState:v1` | `Main.tsx` (`usePageState`) | no | none persisted (no pref fields) |
| `utbt:adminState:v1` | `Main.tsx` (`usePageState`) | no | Admin page pref: `activeSection`. Each admin section owns its own table state: column visibility/order in `utbt:admin:<section>:cols:v2` (device-local) + saved filters in `utbt:admin:<section>:filters:v1` (**synced**, via `useAdminFilterPresets` → `filterPresets.ts`); transient sort/filter/search/page via `useNavState('admin.<section>.<field>')` so it restores on Back/Forward. No caches singleton. |
| `utbt:homeMedalHuntHidden:v1:<userId>` | `MedalHuntCard` | **yes** | `string[]` map names dismissed from the home Medal Hunt card (already user-suffixed; the suffix is kept inside the per-account blob) |
| `utbt:theme:v1` | `ThemeProvider` (app-global) | **yes** | `{ id }` — selected theme (`classic`/`red`/`aurum`/`amethyst`/`emerald`/`rose`/`light`/`black`) |
| `utbt:recentServers:v1` | `app/utils/server-utils.ts` | no | last 5 joined servers (desktop game launches) |
| `utbt:replayVideoVolume:v1` | `app/utils/replayVideoVolume.ts` | no | replay player volume `0..1` |
| `utbt:patreon:v1` | `app/utils/patreon.ts` | no | cached patron tier map, 1 h TTL (pure cache) |
| `ui-scale` | `LauncherGeneralSettings` | no | renderer zoom percent (pre-dates the key convention) |
| `utbt:webAuth:v1` | `app/platform/web/auth-web.ts` (**web build only**) | never | `AuthProfile` — Discord identity + access/refresh tokens + expiry; the web equivalent of the desktop main-process auth config. Secrets never sync. |
| `utbt:syncAccount:v1` | `userState.ts` (store-internal) | never | Discord id of the account that last synced on this device; a different id at sign-in purges all synced keys before syncing (no cross-account bleed) |
| `utbt-server-browser-settings` | DEPRECATED | — | (old shape — can ignore) |

Legacy per-device badge markers (`utbt:newMapsSeen:v1`, `utbt:newRecordsSeen:v1`,
`utbt:newEventsSeen:v1`, `utbt:newsSeen:v1`) are **migration inputs only**: on the
first badge fetch after sign-in, a still-unset server marker is seeded from the
local value and the local key is removed once that seeding call succeeds (a
failed seed keeps the key and retries on the next badge fetch). No code writes
them anymore.

`utbt:theme:v1` is an **app-global** preference, not per-page — read + written
by `app/theme/ThemeProvider.tsx` through the synced store. A pre-paint inline
script in `app/index.html` still reads the raw localStorage value (the store
mirrors it) so the theme applies before first paint without a flash.

`utbt:highlightSince:<view>` (`maps` / `world-records`) is the one **sessionStorage**
key — a transient navigate-time hand-off written by `markViewed` (inside `Main.tsx`'s
`navigate()`) via `writePendingHighlight` and consumed **once** on the next page mount by
`useNewItemHighlight`. It is **not** a persisted preference; it just tells the
freshly-mounted page which rows to ring. See `agents/navigation.md`
(`sidebar-new-badges`). The web build adds one more sessionStorage key:
`utbt:webAuthFlow:v1`, the in-flight OAuth redirect state (PKCE verifier + CSRF
state + return path), written on login start and consumed once on `/auth/callback`.

## Filter presets

Use `FilterPresetsMenu<TFilters>` from
`app/components/shared/FilterPresetsMenu.tsx`. Parent owns:
- `presets: FilterPreset<TFilters>[]` + persistence
- `activePresetId` local state
- `useEffect` that clears `activePresetId` when current filters drift away
  from the active preset (so the highlight goes away when the user starts
  tweaking)

Capture logic (parent provides `captureCurrentFilters: () => TFilters`):

```ts
const captureCurrentFilters = () => ({
  filters: state.filters,
  sortBy: state.sortBy,
  sortDir: state.sortDir,
})
```

## Tutorial state

Use `useTutorialState(storageKey)` from
`app/components/shared/useTutorialState.ts`. Returns `{ seen, markSeen, resetSeen }`.

Pattern:
- First-time `<Modal>` checks `!tutorial.seen && !tutorialActive` and prompts.
- HelpCircle icon-button in page header reopens via `startTutorial()`.
- `Tutorial` component fires `onClose` when user skips or finishes; that
  closes any opened panels (filter panel, columns menu, presets menu).

Tutorial steps live in a per-page file:
`app/components/pages/<page>/<page>TutorialSteps.ts`. Re-export
`TutorialStep` from the shared module so types stay aligned.

## Favorites — different sync models per kind

### Map favorites — dual sync (DB + ini)

Driven by `Main.tsx`:
- Source of truth: the backend (via the API).
- Mirror: `UTBT.ini` (so the game itself sees them).
- On login: diff DB vs ini, prompt user via `FavoritesSyncModal` on mismatch.
- On toggle: optimistic DB write + mirror to ini, rollback on failure.
- On game-close event: re-read ini → replace DB.

Don't bypass `toggleFavorite` in `Main.tsx`.

### Server favorites — account-synced

Stored under `utbt:serverFavorites:v2` through the synced store (follows the
account across devices; plain localStorage when signed out). Keyed by
`server.id` (NOT hostname — hostnames can change). Plain set + immediate
serialize on toggle; `Main.tsx` subscribes so a value arriving from another
device re-renders.

## Naming conventions

- State / cache types: `PascalCaseState`, `PascalCaseCaches`
- Default consts: `DEFAULT_FOO_STATE`, `DEFAULT_FOO_CACHES`
- localStorage keys: `utbt:<area>:v<n>` (kebab-case area, integer version)
- Updater callbacks: `onStateChange: (updater) => void` — always a functional
  updater, not a value setter, so updates compose with stale-state safety
