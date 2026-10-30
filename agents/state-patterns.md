# State patterns

Where UI state lives and how it is hoisted, restored and persisted: the state tiers,
controlled primary pages, per-entry UI state, the account-synced store, the localStorage
key convention, filter presets and tutorial state, and interval polling. Read it before
adding page state, a stored preference or a poll. The history stack itself is in
[navigation.md](navigation.md).

## The tiers

| Tier | Lives in | Survives | Use for |
|---|---|---|---|
| Per-entry page state | `usePageState` in `Main.tsx` | Back/Forward to that entry; its pref fields also restarts | a primary page's query state (search, filters, sort, page, scroll) and its preferences |
| Page caches | `useState` singletons in `Main.tsx`, passed as `caches` | the session, shared by every entry | fetched data a revisit paints instantly |
| Per-entry UI bag | `useNavState(key, default)` | Back/Forward to that entry | a detail page's transient UI (tab, search, sort, page, scroll, expansion) |
| Component state | `useState` | until unmount | everything else; a view change unmounts the page |
| Account-synced | `app/utils/userState.ts` | restarts and devices, when signed in | whitelisted preferences that follow the account |
| Device-local | `localStorage`, `utbt:*` keys | restarts, this device only | preferences that stay with the device |
| Live data | `createPoller` | while its owner is mounted | server state followed on an interval |

A fresh `navigate()` gives both per-entry tiers their defaults; Back/Forward restores them.

## Controlled primary pages

Every primary page (`MapsPage`, `ServerBrowserPage`, …) is controlled: it receives
`state`, `onStateChange`, `caches`, `onCachesChange` from `Main.tsx`.

- **State is per visit.** `state` comes from `usePageState`, stored on the active history
  entry, so Back/Forward restores that visit's query and a fresh open starts from defaults.
  Preference fields (column layout, page size, filters-panel open) are the exception: they
  carry across fresh opens and restarts through localStorage.
- **Caches are shared.** `caches` is one singleton per page in `Main.tsx`, so a revisit
  paints without waiting; the page still revalidates on mount
  ([navigation.md](navigation.md), freshness). Only data hoisted into `caches` survives:
  `renderView()` unmounts the page on a view change, so anything the page or any child
  keeps in `useState` refetches on every visit. A child that fetches for itself needs its
  slice threaded through the page's `caches` (Home does this for the Medal Hunt rows, the
  community counts and the first page of maps to review).
- **A shared cache holds only the last query's rows.** On a server-queried, paginated page
  (`PlayersPage`, `CapItAllPage`, `WorldRecordsPage`) store the query signature the rows
  were fetched for as `caches.querySig` and gate the skeleton on it:
  `showSkeleton = !error && (caches.querySig !== querySig || (loading && rows.length === 0))`.
  Without it a fresh visit flashes the previous query's rows before the refetch lands. A
  page that filters a client-side list synchronously (`ServerBrowserPage`) has no stale gap
  and needs no signature.

`usePageState(storageKey, default, prefKeys, getEntryState, updateEntryState)` returns a
`useState`-shaped tuple. It keeps the full page state in the active entry's bag (a fresh
entry starts as `{ ...default, ...persistedPrefs }`) and mirrors only `prefKeys` to
localStorage under `storageKey`. A page without prefs passes `[]` and persists nothing.

### Page shape

State and cache types and their defaults go in `<Page>.types.ts`, because `Main.tsx` may
import only types from a lazily loaded page module (`pageLoaders.test.ts` enforces it):

```tsx
// FooPage.types.ts
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

// FooPage.tsx
interface FooPageProps {
  state: FooPageState
  onStateChange: (updater: (prev: FooPageState) => FooPageState) => void
  caches: FooPageCaches
  onCachesChange: (updater: (prev: FooPageCaches) => FooPageCaches) => void
}
```

### `Main.tsx` wiring

```tsx
const FOO_STATE_STORAGE_KEY = 'utbt:fooState:v1'
const FOO_PREF_KEYS: readonly (keyof FooPageState)[] = ['columnVisibility', 'columnOrder']
const FooPage = lazy(PAGE_LOADERS.foo)

const [fooState, setFooState] = usePageState(FOO_STATE_STORAGE_KEY, DEFAULT_FOO_STATE, FOO_PREF_KEYS, getEntryState, updateEntryState)
const [fooCaches, setFooCaches] = useState<FooPageCaches>(DEFAULT_FOO_CACHES)

case 'foo':
  return <FooPage state={fooState} onStateChange={setFooState} caches={fooCaches} onCachesChange={setFooCaches} />
```

The renderView case, sidebar item and loader entry are covered by skill: add-data-page.

## Per-entry UI state (`useNavState`)

`useNavState(key, default)` (`app/components/navigation/useNavState.ts`) reads and writes
one key on the active history entry's bag. Use it for a detail page's transient UI, and for
UI inside a page-view that should come back on Back but not on a fresh open.

```tsx
const [query, setQuery] = useNavState('wrs.query', '')
const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('wrs.sortDir', 'desc')
```

- **Keys** are `<area>.<field>`: a card prefix on detail pages (`wrs.query`), `event.*` on
  the event page, `admin.<section>.<field>` in admin sections.
- **The setter takes a value only.** `setX(prev => …)` stores the function. Compute from
  the in-scope value: `setSortDir(sortDir === 'asc' ? 'desc' : 'asc')`.
- **Small values only**, never fetched data: detail data refetches on remount.
- **Debounced search:** keep the raw input in plain `useState` seeded from the stored
  value, and store only the debounced value:
  `const [query, setQuery] = useNavState('x.query', ''); const [queryRaw, setQueryRaw] = useState(query)`.
  Seeding from anything else lets the debounce overwrite the restored query with empty.
- **Pagination:** pass `page` / `pageSize` / `onPageChange` / `onPageSizeChange` from
  `useNavState` into `usePaginatedQuery` (`app/hooks/useAsync.ts`). It resets to page 1 only
  when its `deps` change after mount, so a restored page survives the remount.
- **Defaults derived from data:** store `null` and resolve the default at render; write
  only an explicit user choice. "No choice yet" then stays distinguishable from a choice,
  and the default can follow the data (`event.scheduleView`, `event.streamPanel`).
- **Scroll:** `useNavScrollRestore(ref, loadingDone, key = 'scrollTop')` returns an
  `onScroll` handler for the container; it restores once `loadingDone` is true. Give a
  second scroll container on the same entry its own key.
- Detail cases in `renderView` carry `key={entry.id}`, so each visit remounts and reads its
  own bag ([navigation.md](navigation.md)).

## Account-synced state (`app/utils/userState.ts`)

Preferences that follow the signed-in account across the desktop app and the website.
The store is a localStorage mirror with a server copy:

- `getSynced(key, fallback)` reads synchronously; `setSynced(key, value)` writes memory and
  localStorage at once and notifies subscribers (a no-op when the value serialises the
  same); `subscribeSynced(key, cb)` returns the unsubscribe.
- When signed in and the key is whitelisted, a write marks it dirty and a debounced
  (1.5 s) flush sends only the dirty keys, which the server merges shallowly. The flush
  also runs on `pagehide` and when the tab is hidden, using `keepalive` unless the body is
  too large for the keepalive quota. Failed flushes retry with exponential backoff capped at
  60 s. Signed out or offline it is plain localStorage.
- `initUserStateSync(token, discordId)` runs at sign-in (`app/app.tsx`). If this device
  last synced a different account (`utbt:syncAccount:v1`), every synced key is purged
  first, so one account's values never upload into another. Server values then win and
  overwrite local ones (subscribers fire), except keys written while the fetch was in
  flight; whitelisted local values the server lacks upload once. `stopUserStateSync()` at
  sign-out flushes and stops.

Rules:

- **The whitelist is `isSyncedKey`** in `userState.ts`: a set of exact keys plus two prefix
  rules, `utbt:homeMedalHuntHidden:v1:<userId>` and `utbt:admin:<section>:filters:v1`. It
  holds what a person expects to follow them (theme, tutorial seen-flags, filter presets,
  display timezone, seasonal-themes toggle, pick/ban sound and animations, Medal Hunt
  dismissals). Layout and device choices (columns, page sizes, panel flags, `ui-scale`,
  replay volume, the collapsed rail, the stream kit folder) stay device-local on purpose: a
  4K desktop and a phone want different layouts. Auth never syncs.
- Read and write a whitelisted key only through the store helpers, never raw
  `localStorage`, and `subscribeSynced` wherever a value arriving after mount (the sign-in
  sync) must re-render. `useSyncedPresets` and `useTutorialState` already do.
- Values must round-trip through JSON. Keys follow the localStorage convention below;
  bumping the version abandons a bad shape (the old key simply stops syncing).
- Not in this store: map and server favorites are their own account resources
  ([api.md](api.md)); the sidebar's "new since last visit" counts are server-side and the
  event attention data is in memory in `Main.tsx` ([navigation.md](navigation.md)).

## localStorage

- **Key convention:** `utbt:<thing>:v<n>`, `<thing>` in camelCase, sub-areas separated by
  colons (`utbt:admin:<section>:cols:v2`), `n` an integer bumped on any incompatible shape
  change. Abandoned versions are left behind, not migrated.
- **Persist preferences, not query state or caches.** Page prefs go through
  `usePageState`; other persisted values go through the synced store when whitelisted and
  plain localStorage otherwise. (`utbt:patreon:v1` is a deliberate exception: a 1 h TTL
  cache of patron tiers.)
- **Merge over defaults on load,** since stored JSON may lack fields added since or carry
  removed ones, and guard every access: storage can be blocked or throw. `loadPrefs` in
  `Main.tsx` does both for page prefs. A direct loader looks like:

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

**Finding keys.** `grep -rn "utbt:" app` lists them (it also hits window event names such
as `utbt:login-required`). Page pref keys are the `*_STATE_STORAGE_KEY` constants in
`Main.tsx`. Facts the use site doesn't show:

- The page state keys (`utbt:serversState:v1`, `utbt:mapsPageState:v1`, …) hold only that
  page's `*_PREF_KEYS`, never the query state. `MapsPage` keeps its column visibility and
  order in its own keys (`utbt:mapsColumns:v1`, `utbt:mapsColumnOrder:v1`).
- Admin sections: column layout in `utbt:admin:<section>:cols:v2` (device-local, via
  `useAdminTable`), saved filters in `utbt:admin:<section>:filters:v1` (synced, via
  `useAdminFilterPresets`), transient sort/filter/search/page in
  `useNavState('admin.<section>.<field>')`.
- `utbt:homeMedalHuntHidden:v1:<userId>` is user-suffixed and synced; the suffix stays in
  the account blob.
- `utbt:streamKitFolder:v1` is one device-local map `{ [userId]: folder }`.
- `app/index.html`'s pre-paint script reads `utbt:theme:v1`, `utbt:seasonalThemes:v1` and
  `utbt:season:v1` from localStorage and `utbt:seasonOverride:v1` from sessionStorage before
  React mounts (the synced store mirrors to localStorage, so this works). Change one of
  these shapes and update that script in the same commit.
- `utbt:syncAccount:v1` is internal to the synced store.
- Legacy badge markers and the `utbt:highlightSince:<view>` sessionStorage hand-off:
  [navigation.md](navigation.md). Web auth (`utbt:webAuth:v1`, `utbt:webAuthFlow:v1`):
  [web-target.md](web-target.md).
- `ui-scale` predates the convention (renderer zoom percent; written by Settings, applied
  by `AppLayout` at mount).

## Filter presets

The menu is `FilterPresetsMenu<TFilters>` (`app/components/shared/FilterPresetsMenu.tsx`,
see [shared-components.md](shared-components.md)). The parent page owns:

- the presets and their persistence, through `useSyncedPresets(storageKey, migrate?,
  validate?)` / `persistPresets` (`app/utils/filterPresets.ts`);
- `activePresetId` in local state, plus an effect that clears it once the current filters
  stop matching the active preset (`presetFiltersMatch`), so the highlight goes when the
  user starts tweaking;
- `captureCurrentFilters`, which returns what a preset saves (filters plus sort).

Presets sync across devices and app versions, so stored shapes and enum values may be ones
this build doesn't know. `loadPresets` skips entries without a string `id` and `name` and an
object `filters`, then runs `migrate` and the optional `validate`; a failing entry is
skipped and its siblings survive. On apply, never spread `preset.filters` into state blind:
filter enum arrays to known values and validate sort fields (each page's
`handleLoadPreset`; `sanitizeServerFilters` in `app/utils/server-utils.ts`).

## Tutorial state

`useTutorialState(storageKey)` (`app/components/shared/useTutorialState.ts`) returns
`{ seen, markSeen, resetSeen }`, stored synced as `{ seen, version }`. The page pattern:
a first-visit `Modal` open while `!tutorial.seen && !tutorialActive`; a help button in the
header calls `startTutorial()`; the `Tutorial` component's `onClose` (skip or finish)
closes any panel the tour opened. Steps live in `app/components/pages/<area>/<area>TutorialSteps.ts`
and re-export `TutorialStep` from `app/components/shared/Tutorial.tsx` so the types stay
aligned.

## Polling live data

Screens that follow server state poll on an interval instead of fetching once. This is a
data tier: nothing is persisted, and the data lives only while the poller's owner is
mounted. `Main.tsx`'s event attention poll is one; the pick/ban session store
([pick-ban-ui.md](features/pick-ban-ui.md)) and the stream desk and scene stores
([stream-kit.md](features/stream-kit.md)) are built on the same scheduler.

**Use `createPoller` (`app/utils/poller.ts`) for every interval poll** instead of an ad hoc
`setInterval`. It takes `poll(signal)`, `intervalMs()` (read again after every attempt, so
the cadence can follow the data), `alwaysPoll`, `pollOnStart`, `onSettled` and an optional
visibility `environment` (default: `document`).

- `start()` polls at once, even in a hidden document, so a page never opens empty; after
  that it polls one interval after each attempt settles.
- `pollOnStart: false` makes `start()` wait one interval first, for a caller that already
  holds fresh data. Every `start()` then waits a full interval; the document showing again
  still polls at once.
- Attempts never overlap: `pollNow()` during an attempt returns the one in flight.
- `refresh()`, for right after a write, aborts the attempt in flight (it started before the
  write, so its answer may be stale) and polls afresh. An aborted attempt reports nothing.
- It rests while the document is hidden and polls the moment it shows again; `alwaysPoll`
  ignores visibility.
- `stop()` aborts the attempt in flight and reports nothing after; `start()` may follow at
  once (React StrictMode's double mount relies on it).
- `onSettled` reports each outcome with the count of consecutive failures.
- `reschedule()` re-reads the interval after the data changed outside a poll.

`poller.test.ts` covers it with fake timers.

## Naming conventions

- State and cache types: `FooPageState`, `FooPageCaches`; defaults `DEFAULT_FOO_STATE`,
  `DEFAULT_FOO_CACHES`; `Main.tsx` constants `FOO_STATE_STORAGE_KEY`, `FOO_PREF_KEYS`.
- localStorage keys: `utbt:<thing>:v<n>` (above). `useNavState` keys: `<area>.<field>`.
- `onStateChange` / `onCachesChange` take a functional updater, so successive updates
  compose without reading stale state.
