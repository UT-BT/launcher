# Shared components reference

Single source of truth for reusable UI. **Before writing inline JSX or a one-off
helper, check this list.** When in doubt, use the shared component or extend it;
don't fork it.

## Hard rule: PlayerInfo for every player display

`app/components/shared/PlayerInfo.tsx`

Any UI that shows a player (review author, leaderboard row, cap history, achievement,
server roster, etc.) MUST render through `PlayerInfo`. Never render `alias` as raw
text or hand-roll an avatar `<img>`. Handles:

- Discord avatar via `getAvatarUrl(userId)` + fallback on error
- Skips avatar when `userId` missing or `< 6` chars (string-only authors, bots)
- Active title display + per-rarity styling (color, weight, glow, legendary pulse)
- "You" highlight (emerald tint + badge)
- `horizontal` / `vertical` layout, `sm` / `md` / `lg` sizing

Props are flat primitives — `userId`, `alias`, `title`. Never pass nested
user/record shapes; destructure at the call site.

```tsx
<PlayerInfo
  userId={review.user}
  alias={review.alias}
  title={review.active_title}
  size="md"
  highlight={isOwn}
  showYouBadge={isOwn}
/>
```

If your backend payload lacks `active_title`: extend the backend endpoint
(`MapReview.json()` in `DataService/data_service/endpoints/map_review/model.py`
is the canonical pattern). Don't work around it in the launcher.

Rarity styling (1–5) lives in `app/utils/titleStyles.ts`
(`getAvatarBorderStyle`, `getTitleTextStyle`, `getReadableTitleColor`, `hasTitle`).
`PlayerInfo` consumes those helpers; if you need title styling outside
`PlayerInfo` (e.g. a hero panel), import from `titleStyles.ts` — don't re-implement.
Rarity 5 uses `legendaryAvatarPulse` / `legendaryTitlePulse` keyframes in
`app/styles/globals.css`.

## Tables — `DataTable.*` primitives

`app/components/shared/DataTable.tsx`. Use these for ANY tabular page. They
encode the locked styling decisions (padding, font, hover, sort icons). Pages
own their column definitions and cell content; primitives own the shell.

| Component | Purpose |
|---|---|
| `DataTableShell` | Scroll container + `<table>`. Pass `scrollRef`, `onScroll` for persisted scroll state. |
| `DataTableHeaderRow` | Sticky `<thead>` + bordered `<tr>`. `theadDataAttr` writes a data-attr for tutorial z-lift. |
| `DataTableHeaderCell` | `<th>` with locked padding/font. `sortable` + `sortDirection` + `onSort` for sortable headers. `align`, `width`, `className`, `buttonRef` overrides. |
| `DataTableRow` | Body `<tr>` with locked hover/border styling. Spread-through tr props. |
| `DataTableCell` | `<td>` with locked padding. `align`, `width`, `className` overrides. `forwardRef` so per-cell measurements (tutorial) work. |
| `DataTableEmpty` | Centered empty-state row. Text only, no icon. |
| `DataTableSkeletonRow` | Uniform shimmer row for pages without per-column custom skeletons. |
| `SortIcon` | Standalone sort-direction icon (`asc` / `desc` / `null`). Rarely needed — `DataTableHeaderCell` renders it via `sortable`. |

Locked styling defined in `styling.md`. Don't override padding/font/hover
inline — use the primitives or extend them.

Example:

```tsx
<DataTableShell scrollRef={scrollRef} onScroll={onScroll}>
  <DataTableHeaderRow theadDataAttr="data-utbt-foo-thead">
    <DataTableHeaderCell sortable sortDirection={dir('name')} onSort={() => sort('name')}>
      Name
    </DataTableHeaderCell>
    <DataTableHeaderCell align="center" width="2.5rem">Score</DataTableHeaderCell>
  </DataTableHeaderRow>
  <tbody>
    {rows.length === 0
      ? <DataTableEmpty colSpan={2} message="No items match your filters." />
      : rows.map(r => (
          <DataTableRow key={r.id}>
            <DataTableCell>{r.name}</DataTableCell>
            <DataTableCell align="center">{r.score}</DataTableCell>
          </DataTableRow>
        ))}
  </tbody>
</DataTableShell>
```

## Columns customization — `ColumnsMenu`

`app/components/shared/ColumnsMenu.tsx`. Generic drag-reorder + visibility
checkboxes for tables with column customization. Generic over a `TColumnId`
string union.

Key props:
- `columnOrder: TColumnId[]`, `columnVisibility: Record<TColumnId, boolean>`, `columnLabels`
- `onToggle`, `onReorder` — parent owns mutation
- `requiredColumns?: Set` — never hideable
- `excludeFromList?: Set` — column exists in order but doesn't appear in menu (e.g. Maps `tags` pseudo-column)
- `renderExtra?: (id) => ReactNode` — per-row addon (Maps uses this for nested "Show Tags" checkbox)
- `triggerRef`, `menuOpen`, `onMenuOpenChange` — for tutorial control

## Filter presets — `FilterPresetsMenu`

`app/components/shared/FilterPresetsMenu.tsx`. Generic over preset payload
shape (`TFilters`). Owns dropdown + save modal + delete-confirm modal. Parent
owns the preset array + persistence + capture/apply logic.

Key props:
- `presets`, `activePreset` (highlighted state)
- `hasActiveFilters` — controls Save enablement
- `onSave(name, filters)`, `onLoad(preset)`, `onDelete(preset)`
- `captureCurrentFilters()` — parent callback returning current `TFilters`
- `onResetFilters?` — adds a Clear-Filters button next to the menu
- `triggerRef`, `menuOpen`, `onMenuOpenChange` — for tutorial control
- `label`, `placeholderExample` — defaults: "Saved Filters", "e.g. Easy maps from 2024"

## Tutorial — `Tutorial` + `useTutorialState`

`app/components/shared/Tutorial.tsx` + `useTutorialState.ts`.

`useTutorialState(storageKey)` — `{ seen, markSeen, resetSeen }` persisted to
localStorage. Use a versioned key per page (e.g. `utbt:serversPageTutorial:v1`).

`Tutorial` — overlay component. Takes:
- `steps: TutorialStep[]` — each step has `id`, `title`, `body`, optional `targetRef` / `targetRefs`, `onEnter`, `onExit`
- `step`, `setStep` — current step index
- `onClose` — fires on skip or Done
- `ariaLabel` — required, e.g. "Servers page tutorial"

Tutorial steps belong in a per-page file (`app/components/pages/<page>/<page>TutorialSteps.ts`) since they reference page-specific refs. Re-export `TutorialStep` from the shared module.

### Sticky-thead gotcha

Sticky `<thead>` with `z-index` creates a stacking context that traps inline
z-index lifts on children. If a tutorial step targets a header button, lift
the whole thead during the step:

```ts
{
  id: 'sort',
  targetRef: refs.sortHeaderRef,
  onEnter: () => document.querySelector('[data-utbt-foo-thead]')?.classList.add('!z-[60]'),
  onExit:  () => document.querySelector('[data-utbt-foo-thead]')?.classList.remove('!z-[60]'),
}
```

`DataTableHeaderRow` accepts a `theadDataAttr` prop for this purpose.

### Z-index map

| Layer | Z | Notes |
|---|---|---|
| dim overlay | 5 | Backdrop |
| sticky thead default | 2 | Above scrolling rows |
| sticky thead during tutorial sort step | 60 | `!z-[60]` via data-attr |
| highlighted target (inline) | 60 | Set by `Tutorial` via `data-tutorial-highlight` |
| ring (box-shadow glow) | 70 | Transparent div; box-shadow paints around target |
| tutorial card | 80 | Top |

## Visual primitives

| Component | Use for |
|---|---|
| `app/components/shared/MapThumbnail.tsx` | Any map screenshot tile. Pass `mapName` + `className` for sizing. Falls back to `default.png` on error. |
| `app/components/shared/ActiveFilterChip.tsx` | Removable blue-tinted chip for active filter pills shown above the data table. Props: `label`, `value`, `onClear`. Pages compose a row of these from their own filter state (one chip per filter value). |
| `app/components/shared/FavoriteStar.tsx` | Generic favorite toggle. Prop is `name: string` (not `mapName`); pass whatever identifier you store (map name, server ID, etc.). |
| `app/components/shared/IconActionButton.tsx` | Locked-style icon button used in table action cells. `variant: 'review' \| 'replay' \| 'download'` (orange for review, amber for replay, blue for download). Props: `icon` (lucide), `tooltip`, `onClick`, optional `loading`, `disabled`, `iconFill`. Stops click propagation by default so it works inside clickable rows. |
| `app/components/shared/DemoDownloadStatusModal.tsx` | Modal that shows demo-download progress / success / error. Pair with the `useDemoDownload()` hook (`app/hooks/useDemoDownload.ts`) which exposes `download`, `start(entry, mapName)`, `clear()`. |
| `app/components/shared/Modal.tsx` | Generic modal shell. Use `offsetSidebar` when modal should respect the navigation rail. |
| `app/components/shared/ConfirmModal.tsx` | Yes/no confirmation dialog, wraps `Modal`. |
| `app/components/shared/BackButton.tsx` | "← Back" button. |

## UI primitives (`app/components/ui/`)

| Component | Use for |
|---|---|
| `pagination.tsx` — `PaginationBar`, `buildPageList`, `PAGE_SIZE_OPTIONS` | Page count + per-page dropdown + prev/next + ellipsis. Pass optional `meta` ("search" / "filtered") for the count badge. |
| `multi-filter-dropdown.tsx` — `MultiFilterDropdown` | Multi-select with optional fuzzy search and per-option icons. Empty selection = show all. |
| `filter-panel-row.tsx` — `FilterPanelRow` | Label + flex-wrap children. Used inside a filter panel. |
| `dropdown-menu.tsx` | Radix dropdown primitive. Use for any click-to-open popover. |
| `tooltip.tsx`, `badge.tsx`, `button.tsx`, `switch.tsx`, `checkbox.tsx`, `input.tsx`, `slider.tsx` | shadcn-derived primitives. |

## Utilities

| Module | Exports |
|---|---|
| `lib/utils.ts` | `cn(...inputs)` — clsx + tailwind-merge. Use for all conditional classes. |
| `app/utils/scoreColors.ts` | `scoreTextColor`, `scoreBgColor`, `scoreSliderAccent` (pass `inverted` for lower-is-better dims). `difficultyTextColor`, `difficultyBgColor` for 1–10 map difficulty (paired with `DIFFICULTY_RANGES`). Don't re-implement thresholds. |
| `app/utils/format.ts` | `formatCapTime` (`MM:SS.mmm`), `formatDelta`, `formatAddedDate`, `isNew` (30-day window), `displayMapName` (strips `CTF-BT-` / `CTF-BT+` prefix). |
| `app/utils/titleStyles.ts` | `hasTitle`, `getReadableTitleColor`, `getAvatarBorderStyle`, `getTitleTextStyle`. Use when rendering title-aware UI outside `PlayerInfo`. |
| `app/utils/roles.ts` | `ROLE_LABELS` — maps `utbt_role` (1=Moderator, 2=Admin, 3=Cup Admin; 0/undefined = no badge) to `{ label, className }`. Shared by the profile hero and Players page; use it for any role badge rather than re-defining the colors. |
| `app/utils/search.ts` | `fuzzyMatch(text, query)` — substring-first, ordered-subsequence fallback. |
| `app/utils/server-utils.ts` | Server-specific: `trimServerName`, `getServerType`, `getServerRegion`, `getRegionFlag`, `getGameStatusText`, `sortServers`, `filterServers`. Types: `ServerType`, `FilterState`, `ServerSortField`, `SortDir`, `ServerPreset`, `ServerPresetFilters`. |
| `app/utils/api.ts` | Data fetching + URL builders. See `data-sources.md`. |

## When to extract a NEW shared component

Extract when:
- The same JSX/logic appears in 2+ places and could appear in more
- Visual / behavioral consistency matters (table styling, modal chrome, etc.)
- You're tempted to copy-paste

Don't extract when:
- It's tightly coupled to one page's data shape (e.g. `ServerRow`'s bot Twitch
  link, spectator opacity — page-local concern)
- The "shared" version would need so many flags it's worse than two siblings
- It's a one-off and unlikely to recur

Put new shared visual components in `app/components/shared/`, lower-level
primitives in `app/components/ui/`, utility functions in `app/utils/`.
