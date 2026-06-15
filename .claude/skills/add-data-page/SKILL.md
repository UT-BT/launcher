---
name: add-data-page
description: >-
  Add a brand-new primary page to the launcher's left sidebar (a top-level view
  like Maps / Players / Servers, not a detail page). Use when the request is to
  "add a page", "add a new sidebar tab", "add a <thing> leaderboard/browser
  page", or otherwise create a new top-level navigable screen. Covers the
  controlled-page contract, Main.tsx state wiring, the renderView case, and the
  AppLayout sidebar entry.
---

# Add a primary page

Primary pages are **controlled components** whose state is hoisted per
navigation-history entry. Read `agents/state-patterns.md` (controlled pages,
Page shape, Main.tsx wiring) and `agents/navigation.md` (sidebar registry,
page-views vs detail-pages) first.

## 1. The page component — `app/components/pages/<Name>Page.tsx`

- Props are the controlled contract: `state`, `onStateChange`,
  `caches`, `onCachesChange` (functional updaters), plus page-specific props.
- Export `interface <Name>PageState`, `interface <Name>PageCaches`, and
  `DEFAULT_<NAME>_STATE` / `DEFAULT_<NAME>_CACHES` (see Page shape in
  `agents/state-patterns.md`). Query state (search/filters/sort/scroll) lives in
  state; fetched rows live in caches.
- Layout follows `agents/styling.md` Page layout; tables use the `DataTable.*`
  primitives; players render through `PlayerInfo` (`agents/shared-components.md`).
- Fetch data via `app/utils/api.ts` helpers — never raw `fetch`
  (`agents/data-sources.md`).

## 2. Wire it in `Main.tsx`

- `import` the page, its defaults, and its types.
- Add `const <NAME>_STATE_STORAGE_KEY = 'utbt:<name>State:v1'` and
  `const <NAME>_PREF_KEYS: readonly (keyof <Name>PageState)[] = [...]` (only the
  fields that should persist across restarts — column layout, page size, panel
  open; `[]` if none).
- Add the state hook + caches:
  ```ts
  const [<name>State, set<Name>State] = usePageState(<NAME>_STATE_STORAGE_KEY, DEFAULT_<NAME>_STATE, <NAME>_PREF_KEYS, getEntryState, updateEntryState)
  const [<name>Caches, set<Name>Caches] = useState(DEFAULT_<NAME>_CACHES)
  ```
- Add a `renderView` case (a **page-view**, so do **not** set `key=`):
  ```tsx
  case '<name>':
    return <<Name>Page state={<name>State} onStateChange={set<Name>State} caches={<name>Caches} onCachesChange={set<Name>Caches} />
  ```

## 3. Add the sidebar entry — `app/components/layout/AppLayout.tsx`

Add `{ id: '<name>', label: '<Label>', icon: <LucideIcon> }` to the right
`navSections` group. The `id` **must** equal the `renderView` case. The sidebar
button calls `navigate` for you.

## Verify

- `npx tsc --noEmit -p tsconfig.web.json` (0 errors).
- `npm run dev`: the sidebar item appears, opens the page, and Back/Forward
  restores the page's query state; a fresh sidebar click starts from defaults;
  persisted prefs survive a restart.
