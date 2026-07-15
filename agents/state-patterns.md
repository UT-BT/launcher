---
doc: state-patterns
read_when:
  - "adding or changing a primary page's state, filters, sort, columns, or pagination"
  - "deciding where a piece of UI state lives (per-visit vs persisted vs cache)"
  - "adding a localStorage key, a filter preset, or tutorial state"
  - "wiring detail-page transient UI (tabs/search/scroll) that must survive Back/Forward"
keywords: [usePageState, useNavState, localStorage, PREF_KEYS, caches, querySig, presets, tutorial, persistence, controlled-page]
provides: "the three state tiers, the localStorage key convention, and how pages are controlled + hoisted"
not_here:
  - "the navigation stack / navigate() / renderView wiring → navigation.md"
  - "the shared components used (FilterPresetsMenu, ColumnsMenu, Tutorial) → shared-components.md"
sections: [controlled-pages-with-hoisted-state, navigation-history-per-entry-ui-state, localstorage-persistence, filter-presets, tutorial-state, favorites, naming-conventions]
last_verified: 2026-07-15
verify_against: [app/components/main/Main.tsx, app/components/navigation/useNavState.ts, app/hooks/useAsync.ts]
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

## localStorage persistence

### Conventions

- **Versioned keys:** `utbt:<thing>:v<n>`. Bump version when shape changes
  incompatibly.
- **Persist preferences, not query state or caches.** For primary pages, only
  pref fields persist (handled by `usePageState`/`loadPrefs` in `Main.tsx`).
  Query state is per-entry; caches refetch per launch. Other localStorage users
  (presets, favorites, tutorial seen-flags, dismissed patch) persist directly.
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

The `utbt:*State:v1` keys below are written by `usePageState` and now hold the
page's **preference fields only** (the `*_PREF_KEYS` subset), not full query state.

| Key | Owner | Contents |
|---|---|---|
| `utbt:mapsPageState:v1` | `Main.tsx` (`usePageState`) | Maps prefs: `filtersPanelOpen`, `pageSizePreference` |
| `utbt:mapsColumns:v1` | `MapsPage` | `Record<ColumnId, boolean>` |
| `utbt:mapsColumnOrder:v1` | `MapsPage` | `ColumnId[]` |
| `utbt:mapsPresets:v1` | `MapsPage` | `MapsPreset[]` |
| `utbt:mapsPageTutorial:v1` | `MapsPage` (via hook) | `{ seen, version }` |
| `utbt:serversState:v1` | `Main.tsx` (`usePageState`) | Servers prefs: column visibility/order, `filtersPanelOpen` |
| `utbt:serverPresets:v1` | `Main.tsx` | `ServerPreset[]` |
| `utbt:serverFavorites:v2` | `Main.tsx` | `string[]` (server IDs) |
| `utbt:serversPageTutorial:v1` | `ServerBrowserPage` (via hook) | `{ seen, version }` |
| `utbt:playersState:v1` | `Main.tsx` (`usePageState`) | Players prefs: column visibility/order, `pageSizePreference` |
| `utbt:playersPageTutorial:v1` | `PlayersPage` (via hook) | `{ seen, version }` |
| `utbt:capItAllState:v1` | `Main.tsx` (`usePageState`) | Cap-It-All prefs: `pageSizePreference` |
| `utbt:worldRecordsState:v1` | `Main.tsx` (`usePageState`) | World Records prefs: column visibility/order, `pageSizePreference` |
| `utbt:achievementsState:v1` | `Main.tsx` (`usePageState`) | none (no pref fields → nothing persisted) |
| `utbt:newMapsSeen:v1` | `Main.tsx` (`markViewed`) | ISO timestamp of the newest map the user has seen — gates the Maps "new" sidebar badge + row highlight |
| `utbt:newRecordsSeen:v1` | `Main.tsx` (`markViewed`) | ISO timestamp of the newest WR the user has seen — gates the World Records "new" badge + highlight |
| `utbt:adminState:v1` | `Main.tsx` (`usePageState`) | Admin page pref: `activeSection`. Each admin section owns its own table state: column visibility/order in `utbt:admin:<section>:cols:v2` + saved filters in `utbt:admin:<section>:filters:v1` (both localStorage, via `useAdminTable`/`useAdminFilterPresets`); transient sort/filter/search/page via `useNavState('admin.<section>.<field>')` so it restores on Back/Forward. No caches singleton. |
| `utbt:dismissedPatch:v1` | `Home` | `string` (patch tag the user dismissed) |
| `utbt:theme:v1` | `ThemeProvider` (app-global) | `{ id }` — selected theme (`classic`/`red`/`aurum`/`amethyst`/`emerald`/`rose`/`light`/`black`) |
| `utbt-server-browser-settings` | DEPRECATED | (old shape — can ignore) |

`utbt:theme:v1` is an **app-global** preference (like `ui-scale`), not per-page —
read + written directly by `app/theme/ThemeProvider.tsx` with merge-over-defaults,
not via `usePageState`. A pre-paint inline script in `app/index.html` applies it
before first paint to avoid a flash.

`utbt:highlightSince:<view>` (`maps` / `world-records`) is the one **sessionStorage**
key — a transient navigate-time hand-off written by `markViewed` (inside `Main.tsx`'s
`navigate()`) via `writePendingHighlight` and consumed **once** on the next page mount by
`useNewItemHighlight`. It is **not** a persisted preference; it just tells the
freshly-mounted page which rows to ring. See `agents/navigation.md`
(`sidebar-new-badges`).

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

### Server favorites — local only

No backend. Stored in `localStorage` (`utbt:serverFavorites:v2`). Keyed by
`server.id` (NOT hostname — hostnames can change). Plain set + immediate
serialize on toggle.

## Naming conventions

- State / cache types: `PascalCaseState`, `PascalCaseCaches`
- Default consts: `DEFAULT_FOO_STATE`, `DEFAULT_FOO_CACHES`
- localStorage keys: `utbt:<area>:v<n>` (kebab-case area, integer version)
- Updater callbacks: `onStateChange: (updater) => void` — always a functional
  updater, not a value setter, so updates compose with stale-state safety
