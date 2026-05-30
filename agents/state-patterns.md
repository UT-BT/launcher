# State patterns

How user-facing UI state is structured, hoisted, and persisted across the app.
New pages must follow these patterns.

## Controlled pages with hoisted state

Every primary page (`MapsPage`, `ServerBrowserPage`, etc.) is a **controlled
component**. State + data caches live in `Main.tsx`; the page receives
`state`, `onStateChange`, `caches`, `onCachesChange` as props.

**Why:** state survives navigation to a sibling page (or back via
`MapDetailPage`) without resetting filters, scroll position, sort, etc. Data
caches also survive so we don't refetch on every tab switch.

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
const [fooState, setFooState] = useState<FooPageState>(loadPersistedFooState)
const [fooCaches, setFooCaches] = useState<FooPageCaches>(DEFAULT_FOO_CACHES)

useEffect(() => {
  try {
    window.localStorage.setItem('utbt:fooState:v1', JSON.stringify(fooState))
  } catch { /* ignore */ }
}, [fooState])

// in renderView:
case 'foo':
  return <FooPage state={fooState} onStateChange={setFooState} caches={fooCaches} onCachesChange={setFooCaches} />
```

## localStorage persistence

### Conventions

- **Versioned keys:** `utbt:<thing>:v<n>`. Bump version when shape changes
  incompatibly.
- **Persist state, not caches.** State (filters, sort, columns, scroll) is
  cheap to serialize and feels broken if lost. Caches (rows, lookups) are
  refetched per launch.
- **Merge over defaults on load.** Persisted JSON may be missing fields you've
  added since (or have stale fields you've removed). Always:

```ts
function loadPersistedFooState(): FooPageState {
  if (typeof window === 'undefined') return DEFAULT_FOO_STATE
  try {
    const raw = window.localStorage.getItem('utbt:fooState:v1')
    if (!raw) return DEFAULT_FOO_STATE
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_FOO_STATE,
      ...parsed,
      // For nested objects, merge those too:
      filters: { ...DEFAULT_FOO_STATE.filters, ...(parsed?.filters ?? {}) },
      columnVisibility: { ...DEFAULT_FOO_STATE.columnVisibility, ...(parsed?.columnVisibility ?? {}) },
      columnOrder: Array.isArray(parsed?.columnOrder) && parsed.columnOrder.length > 0
        ? parsed.columnOrder
        : DEFAULT_FOO_STATE.columnOrder,
      scrollTop: 0,  // Don't restore scroll across full page reloads.
    }
  } catch {
    return DEFAULT_FOO_STATE
  }
}
```

- **`scrollTop = 0` on reload.** Persisted scrollTop only meaningful for
  in-session navigation (page → detail → back). Cold start should top.

### Current storage keys

| Key | Owner | Contents |
|---|---|---|
| `utbt:mapsPageState:v1` | `Main.tsx` | `MapsPageState` |
| `utbt:mapsColumns:v1` | `MapsPage` | `Record<ColumnId, boolean>` |
| `utbt:mapsColumnOrder:v1` | `MapsPage` | `ColumnId[]` |
| `utbt:mapsPresets:v1` | `MapsPage` | `MapsPreset[]` |
| `utbt:mapsPageTutorial:v1` | `MapsPage` (via hook) | `{ seen, version }` |
| `utbt:serversState:v1` | `Main.tsx` | `ServerBrowserState` |
| `utbt:serverPresets:v1` | `Main.tsx` | `ServerPreset[]` |
| `utbt:serverFavorites:v2` | `Main.tsx` | `string[]` (server IDs) |
| `utbt:serversPageTutorial:v1` | `ServerBrowserPage` (via hook) | `{ seen, version }` |
| `utbt:playersState:v1` | `Main.tsx` | `PlayersPageState` |
| `utbt:playersPageTutorial:v1` | `PlayersPage` (via hook) | `{ seen, version }` |
| `utbt:dismissedPatch:v1` | `Home` | `string` (patch tag the user dismissed) |
| `utbt-server-browser-settings` | DEPRECATED | (old shape — can ignore) |

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
- Source of truth: DataService DB.
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
