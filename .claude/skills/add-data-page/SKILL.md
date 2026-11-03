---
name: add-data-page
description: >-
  Add a brand-new primary page to the launcher's left sidebar (a top-level view
  like Maps / Players / Servers, not a detail page). Use when the request is to
  "add a page", "add a new sidebar tab", "add a <thing> leaderboard/browser
  page", or otherwise create a new top-level navigable screen. Covers the
  controlled-page contract, Main.tsx state wiring, the renderView case, the
  sidebar registry entry in the nav-items module, and the page's required
  mobile route manifest entry.
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
  `agents/state-patterns.md`). Query state (search/filters/sort) lives in
  state; fetched rows live in caches. Scroll is the shell's: call
  `useNavScrollRestore(!showSkeleton)` so Back waits for the rows
  (`agents/navigation.md`, Scroll position and the shell scroller).
- Layout follows `agents/styling.md` Page layout; tables use the `DataTable.*`
  primitives; players render through `PlayerInfo` (`agents/shared-components.md`).
- Fetch data via `app/utils/api.ts` helpers — never raw `fetch`
  (`agents/api.md`).

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

## 3. Add the sidebar entry — `app/components/navigation/nav-items.ts`

Add `{ id: '<name>', label: '<Label>', icon: <LucideIcon> }` to the right
`BASE_NAV_SECTIONS` group. The `id` **must** equal the `renderView` case. The
sidebar button calls `navigate` for you. (A sidebar item may instead link an
event through an optional `eventLink` on the item, skipping the `renderView`
case — see `agents/navigation.md` → the sidebar registry.)

## 4. Add the mobile manifest entry (required) — `e2e/mobile/manifest/<view>.ts`

Every route-contract view needs one: once the view is in `routes.ts` (below),
`routes.contract.test.ts` fails until the entry exists. Read `agents/mobile.md`
(Mobile-ready) and `agents/testing.md` (Mobile route manifest, Test data)
first; copy a page of the same shape (`servers.ts` or `news.ts` for a list
page).

- Export a `MobileRouteEntry`: `view` (the `renderView` case), `tier: 'public'`,
  `path`, `fixtures` (the set name), `ready` (wait for a served row or the
  empty text through `listed` in `manifest/steps.ts`, never a timeout) and
  `decorative` (the header labels of columns the table rules may drop; `[]` if
  none). Add `storage` for a tutorial already seen, `subViews` for its tabs,
  `modals` for every modal a visitor opens by tapping, and `stress: { pr:
  '<variant>' }` when it shows a list. A rule that cannot apply goes in `skip`
  with its reason.
- Add the entry to `MOBILE_MANIFEST` in `manifest/index.ts`.
- Serve it data: add the set name to `RECORDED_SETS`
  (`e2e/mobile/fixtures/index.ts`) and record it with
  `npm run test:mobile:refresh-fixtures -- -g <set>` (read-only public GETs;
  check the file for tokens, emails and IPs before committing). A page only
  signed-in users or staff see gets a synthetic set instead
  (`e2e/mobile/fixtures/synthetic/`), a `tier: 'role-gated'` entry and a line
  in `ROLE_GATED_ENTRIES` (`routes.contract.test.ts`); an admin section is an
  `admin` sub-view instead.
- Run `npm run docs:mobile-routes` so `agents/mobile-routes.md` lists it.
- Run the crawl on it: `npm run test:mobile -- -g "<view>"`. Fix every failure
  it reports; never add a ledger entry for the new page.

## Gated / multi-section pages

Two variations the standard recipe above doesn't cover — the `admin` page
(`app/components/pages/admin/`) is the reference for both:

- **Role-gated nav + view.** The sidebar entry is conditional, not static: the
  `navSections` array is computed from `userProfile` via `buildNavSections` in
  `nav-items.ts` (called from `AppLayout.tsx`), which appends the group only for
  staff (`isStaff`, helpers in `app/utils/roles.ts`). Defence-in-depth: also
  gate the `renderView` case (pass a `forceDenied` prop) and render a denied
  state in-page. Don't rely on the hidden nav item alone.
- **Section-hub page.** When a page holds *many* sub-tools, don't hand-roll a
  `switch` — copy the **section registry** pattern from
  `app/components/pages/admin/registry.tsx`: one `ADMIN_SECTIONS` array of
  `{ id, label, icon, group, roles, Component }` descriptors that both the left
  rail and the content switch derive from. `roles` is an explicit allow-list
  (`number[]`), not a minimum-role threshold. Adding a tool = append one descriptor +
  write one `*Section.tsx`. The page persists only the active section id
  (`PREF_KEYS = ['activeSection']`) and needs no caches singleton (each section
  owns its data).

## Responsive + performance (both targets — non-negotiable)

The page ships to the Electron app AND the website (phones → 4K). Before
calling it done:

- The table passes `responsive={{ columns, onResolve, compactAriaLabel, cards }}`
  — every column with a `tier` and panel `label`, core metric `required`,
  cosmetic columns prioritized, a card face plus skeleton and empty states in
  `cards.placeholder` for phone widths. Contract: `agents/styling.md` →
  Responsive columns. On touch DataTable shows the cards unless every
  non-decorative column fits (`agents/mobile.md` → Phone cards).
- The page scrolls with the shell, registers its refresh with
  `useRegisterPageRefresh` so pull-to-refresh keeps its state, and gates touch
  behaviour on the device environment (`agents/mobile.md`).
- Pagination is the shared `PaginationBar` (mobile touch bar comes free).
- Header/toolbars wrap (`flex-wrap`); no `truncate` beside a `shrink-0` group.
- New view added to `routes.ts` both directions (web deep links).
- Bundle: the page's `DEFAULT_*_STATE` / `DEFAULT_*_CACHES` and its state types
  live in `<PageName>.types.ts`, the component is registered in
  `app/components/main/pageLoaders.ts`, and `Main.tsx` imports the component only
  via `lazy(PAGE_LOADERS.<view>)` plus `type`-only imports from `.types.ts`.
  A value import from the page module in `Main.tsx` silently undoes the split —
  `app/components/main/pageLoaders.test.ts` fails if you do. Any modal or detail
  the page opens is `lazy()` too. `npm run check:bundle` still passes. No per-row
  `backdrop-blur` / infinite animations (`agents/styling.md` → CSS runtime cost).

## Verify

- `npm run typecheck:web` (0 errors).
- `npm run dev`: the sidebar item appears, opens the page, and Back/Forward
  restores the page's query state; a fresh sidebar click starts from defaults;
  persisted prefs survive a restart.
- `npx vitest run app/components/navigation/routes.contract.test.ts e2e/mobile/manifest.test.ts`
  passes, and `npm run docs:check` reports no stale mobile routes doc.
- `npm run test:mobile -- -g "<view>"` passes with no new ledger entry.
- `npm run dev:web`: check the page at 390×844 (phone cards, card sort and
  Details panel, touch pagination), 844×390, 1024×768 (sidebar boundary), and
  1920×1080.
