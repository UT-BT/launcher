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
sections: [the-model, navigate-is-the-only-entry-point, page-views-vs-detail-pages, the-sidebar-registry, event-driven-navigation, per-entry-state]
last_verified: 2026-06-16
verify_against:
  - app/components/main/Main.tsx
  - app/components/layout/AppLayout.tsx
  - app/components/navigation/NavigationContext.tsx
  - app/components/navigation/useNavState.ts
---

# Navigation

There is **no URL router**. `Main.tsx` owns an in-memory history stack and a
`switch` that renders the active view. Everything else funnels through one
`navigate()`.

## The model

`Main.tsx` holds two pieces of state:

```ts
const [entries, setEntries] = useState<NavEntry[]>(() => [{ id: 0, view: 'home', params: {}, state: {} }])
const [cursor, setCursor] = useState(0)
```

- **`NavEntry`** (`app/components/navigation/NavigationContext.tsx`) =
  `{ id, view, params: NavParams, state: Record<string, unknown> }`. `id` is a
  monotonic counter; `state` is the per-entry bag (see below).
- **`NavParams`** = `{ mapName?, playerId?, capId? }` — the only params a view can
  carry. Add a field here if a new detail page needs a different identifier.
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
gate the UI. Back/forward also fire on **mouse buttons 3/4** (unconditionally) and
on **Alt+←/→** (suppressed while typing in an input/textarea/select/contentEditable).
`NavHistoryBar` (rendered in `AppLayout`) is the back/forward button bar.

**Rule: never add a second navigation mechanism.** No raw `setCurrentView`, no
parallel back stack. Sidebar clicks, `openMap`, and the `open-*` events all call
`navigate()`. This is hard rule 6.

## Page-views vs detail-pages

`renderView()` switches on `currentView`. Two kinds of case:

| Kind | Views | Keyed? | Why |
|---|---|---|---|
| **Page-views** | `home`, `servers`, `maps`, `players`, `cap-it-all`, `world-records`, `achievements` | **No** — one reused instance | State is hoisted per-entry via `usePageState`; the component stays mounted and reads the active entry. |
| **Detail-pages** | `maps-detail`, `player-detail`, `cap-detail` | **Yes — `key={entry.id}`** | A new visit must remount so it refetches for the new param and `useNavState` re-reads the right entry's bag. |

Detail cases pull their identifier from `entry.params` (`mapName!` / `playerId!` /
`capId!`). Forgetting `key={entry.id}` on a detail case is a bug: the page keeps
the previous visit's data and UI state.

## The sidebar registry

The left rail is data, not markup — `navSections` in
`app/components/layout/AppLayout.tsx`:

```ts
const navSections: NavSection[] = [
  { title: 'Main', items: [{ id: 'home', label: 'Home', icon: Home }, /* … */] },
  { title: 'UTBT.net', items: [{ id: 'maps', /* … */ }] },
  // …
]
```

Each `item.id` must match a `renderView` case; clicking calls
`onViewChange(item.id)` which is `navigate`. To add a sidebar page: add the
`renderView` case **and** a `navSections` item. (Settings is **not** a view — it's
a modal opened from the user dropdown / the `open-settings` window event.)

## Event-driven navigation

Identity/time UI doesn't import `navigate` — it dispatches a `window` CustomEvent
that `Main.tsx` listens for:

| Event | Detail | Dispatched by | `Main.tsx` does |
|---|---|---|---|
| `open-player` | `{ userId }` | `PlayerInfo` (click) | `navigate('player-detail', { playerId: userId })` |
| `open-cap` | `{ capId }` | `CapTimeLink` / `openCap()` | `navigate('cap-detail', { capId })` |
| `open-settings` | `{ section? }` | the installation banner | `AppLayout` opens the Settings modal (the user-dropdown Settings item opens it directly via local state, not this event) |

`openMap(name)` is a direct helper (`navigate('maps-detail', { mapName })`) threaded
to pages as `onMapSelect`. Render `PlayerInfo` and `CapTimeLink` (see
`shared-components.md`) — don't dispatch these events by hand.

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
