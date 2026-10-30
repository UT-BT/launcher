# Shared components

The reusable UI and when to use each piece. Check here before writing inline JSX or a
one-off helper; use or extend the shared piece rather than forking it. Class strings
and tokens are in [styling.md](styling.md).

Feature components are documented with their feature: the pick/ban visual core in
[pick-ban-ui.md](features/pick-ban-ui.md), the broadcast module, scene kit and Stream
tab pieces in [stream-kit.md](features/stream-kit.md), event stats pieces in
[events.md](features/events.md).

## PlayerInfo: every player display

`app/components/shared/PlayerInfo.tsx`. Render every player (review author,
leaderboard row, cap history, achievement, roster) through `PlayerInfo`, never a raw
`alias` or a hand-rolled avatar `<img>`. It handles the Discord avatar and its
fallback, skips the avatar when `userId` is missing or 5 characters or fewer
(string-only authors, bots), shows the active title with per-rarity styling, the
Patreon badge, the "You" highlight, and links to the player profile.

Props are flat primitives; destructure nested user or record shapes at the call site:

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

- `interactive={false}` drops the profile link when the whole row is itself
  clickable (the compare-run picker), so a click selects instead of navigating.
- `presentation="avatar"` renders only the avatar, for compact identity collections
  (`TeamAvatarStack`); the surrounding component exposes names through a label or
  roster tooltip.
- `presentation="name"` drops the avatar for narrow cells (the Maps author column).
  The name links whenever `userId` is set and is plain text otherwise, so linked and
  string-only authors need no branch. The wrapper is `w-fit`: centre it with `mx-auto`,
  not `justify-center`.
- `layout` is `horizontal` or `vertical`; `size` is `sm`, `md` or `lg`.

When a payload lacks `active_title`, get the field added to the API rather than working
around it (skill: consume-api-data).

Title styling outside `PlayerInfo` (a hero panel) imports the helpers from
`app/utils/titleStyles.ts` (`getAvatarBorderStyle`, `getTitleTextStyle`,
`getReadableTitleColor`, `hasTitle`). Rarity 5 animates with the
`legendaryAvatarPulse` / `legendaryTitlePulse` keyframes in `app/styles/globals.css`.

### Patreon badge

`PlayerInfo` adds a `PatreonBadge` by itself: it calls `usePatreonTier(userId)`
(`app/utils/patreon.ts`; the lookup is in [api.md](api.md)). Surfaces that render
identity by hand (`playerDetail/HeroSection.tsx`) call `usePatreonTier` and render
`<PatreonBadge tier={tier} />` from `app/components/shared/PatreonBadge.tsx` rather than
drawing a heart. Clicking a badge stops propagation and fires the `open-patreon` window
event; `PatreonModal` (mounted once in `Main.tsx`) shows the "Support UTBT" info.
Open it from elsewhere with `openPatreonInfo()` from `PatreonBadge.tsx`.

## Links to players, caps and maps

Detail pages open through window events that `Main.tsx` turns into navigation; the
event architecture and `NavLink` semantics are in [navigation.md](navigation.md).
These components dispatch for you, and all render through `NavLink`, so on web they
are real `<a href>` elements (middle-click and "open in new tab" work):

- **Player**: render `PlayerInfo` (dispatches `open-player`).
- **Cap time**: render every cap time through `CapTimeLink`
  (`app/components/shared/CapTimeLink.tsx`):

  ```tsx
  <CapTimeLink capId={entry.id} seconds={entry.cap_time_seconds} className={…} />
  ```

  It formats with `formatCapTime` and, given a `capId` or `teamCapId`, links to the Cap
  Detail or Team Cap Detail page, stopping propagation so it works inside a row that
  opens the map. With neither id (medians, medal thresholds, distribution buckets) it
  renders plain text. `openCap(capId)` / `openTeamCap(teamCapId)` are exported for a
  non-time trigger.
- **Map**: render `MapNameCell` (`app/components/shared/MapNameCell.tsx`) in a table
  cell (thumbnail, favourite star and name, thumbnail and name each linking), or wrap
  any other clickable map surface in `MapNavLink`
  (`app/components/shared/MapNavLink.tsx`):

  ```tsx
  <MapNavLink mapName={map.name} onMapSelect={onMapSelect} className={…}>
    <MapThumbnail mapName={map.name} className="size-10 rounded-md" />
  </MapNavLink>
  ```

  Without `onMapSelect` it renders an inert `<span>`, so the same JSX covers "not
  navigable here" and the click still reaches an enclosing row. Style hover and cursor
  with `cn` conditionals, not Tailwind's `enabled:` variant: `:enabled` never matches
  an `<a>`, so those rules silently die on web.

## Tables: `DataTable.*`

`app/components/shared/DataTable.tsx`. Build every table from these primitives; they
own the locked shell styling, the page owns columns, sort state and cell content.
Width, alignment and the responsive contract are in [styling.md](styling.md).

| Component | Role |
|---|---|
| `DataTableShell` | Scroll container and `<table>`. `scrollRef` / `onScroll` for persisted scroll. `responsive` adds density, priority auto-hide and compact cards. |
| `DataTableHeaderRow` | Sticky `<thead>` and its `<tr>`. `theadDataAttr` writes a data attribute for the tutorial z-lift. |
| `DataTableHeaderCell` | `<th>`. `sortable` + `sortDirection` + `onSort` render the sort button and icon; `align`, `width`, `buttonRef`. |
| `DataTableRow` | Body `<tr>` with locked hover and border; spreads `<tr>` props. |
| `DataTableCell` | `<td>` with locked padding; `align`; forwards its ref for measuring. |
| `DataTableEmpty` | Text-only empty-state row. |
| `DataTableSkeletonRow` | Uniform shimmer row for pages without custom skeletons. |

```tsx
<DataTableShell scrollRef={scrollRef} onScroll={onScroll} responsive={…}>
  <DataTableHeaderRow theadDataAttr="data-utbt-foo-thead">
    <DataTableHeaderCell sortable sortDirection={dir('name')} onSort={() => sort('name')}>
      Name
    </DataTableHeaderCell>
    <DataTableHeaderCell align="right" width="6rem">Score</DataTableHeaderCell>
  </DataTableHeaderRow>
  <tbody>
    {rows.length === 0
      ? <DataTableEmpty colSpan={2} message="No items match your filters." />
      : rows.map(r => (
          <DataTableRow key={r.id}>
            <DataTableCell>{r.name}</DataTableCell>
            <DataTableCell align="right" className="font-mono tabular-nums">{r.score}</DataTableCell>
          </DataTableRow>
        ))}
  </tbody>
</DataTableShell>
```

## ColumnsMenu

`app/components/shared/ColumnsMenu.tsx`: drag-to-reorder plus visibility checkboxes,
generic over a `TColumnId` string union. The parent owns order and visibility and
mutates them in `onToggle` / `onReorder`. `requiredColumns` can't be hidden;
`excludeFromList` keeps a column in the order but out of the menu (the Maps `tags`
pseudo-column); `renderExtra(id)` adds a per-row control (Maps' nested "Show Tags").
`triggerRef`, `menuOpen` and `onMenuOpenChange` let a tutorial drive it. Hide it while
a responsive table shows compact cards.

## FilterPresetsMenu

`app/components/shared/FilterPresetsMenu.tsx`, generic over the preset payload
`TFilters`. It owns the dropdown, the save modal and the delete confirm; the parent
owns the preset array, its persistence (see [state-patterns.md](state-patterns.md)),
and `captureCurrentFilters()` / `onLoad` to read and apply filters. `hasActiveFilters`
enables Save; `onResetFilters` adds a Clear Filters button; `triggerRef`, `menuOpen`
and `onMenuOpenChange` serve the tutorial.

## Tutorial

`app/components/shared/Tutorial.tsx` + `useTutorialState.ts`.

- `useTutorialState(key)` returns `{ seen, markSeen, resetSeen }`, stored under a
  versioned per-page key (`utbt:serversPageTutorial:v1`); how such keys persist and
  sync is in [state-patterns.md](state-patterns.md).
- `<Tutorial steps step setStep onClose ariaLabel />`. Each `TutorialStep` has `id`,
  `title`, `body`, an optional `targetRef` or `targetRefs`, and `onEnter` / `onExit`.
- Steps live in a per-page file (`app/components/pages/<page>/<page>TutorialSteps.ts`)
  because they reference page refs; that file re-exports `TutorialStep`.

A sticky `<thead>` with a z-index is a stacking context that traps the tutorial's
inline z-index lift on its children. When a step targets a header button, lift the
whole thead through the `theadDataAttr` hook:

```ts
{
  id: 'sort',
  targetRef: refs.sortHeaderRef,
  onEnter: () => document.querySelector('[data-utbt-foo-thead]')?.classList.add('!z-[60]'),
  onExit:  () => document.querySelector('[data-utbt-foo-thead]')?.classList.remove('!z-[60]'),
}
```

| Layer | z |
|---|---|
| Sticky thead | 2 |
| Dim overlay | 5 |
| Highlighted target (inline, `data-tutorial-highlight`) / lifted thead | 60 |
| Ring | 70 |
| Tutorial card | 80 |

## Visual pieces and modals

| Component | Use for |
|---|---|
| `shared/MapThumbnail.tsx` | Every map screenshot. `size` (`thumb`, `card`, `hero`) picks the resized image; on error it falls back to the full image, then the default screenshot. Pass `version` (the map's `screenshot_updated`) wherever you have it so a replaced screenshot shows at once. Screenshots are square: in a non-square box pass `fit="blend"` (contained over a blurred copy) instead of cropping again with `object-cover`. |
| `modals/MapScreenshotModal.tsx` | The one square-crop screenshot UI (map hero, profile Maps Authored, admin Maps). Pass `accessToken` + `hasScreenshot` + `onUploaded` to upload to an existing map, or `onCropped(image, filename)` (+ optional `previewUrl`) to take the PNG yourself; it awaits `onCropped`, shows a thrown error, and closes on success. Crop rules are in `mapScreenshotCrop.ts`. Gate who may open it (linked author or staff) at the call site; the endpoint is in [api.md](api.md). |
| `shared/ActiveFilterChip.tsx` | One removable chip per active filter value (`label`, `value`, `onClear`). |
| `shared/LiveDot.tsx` | The one pinging emerald "happening now" dot (`aria-hidden`). Position it or add a cutout ring through `className`. |
| `shared/MetaPill.tsx` | Info pill in detail-page headers (`icon`, `label`, `value`, `tone`, `tooltip`, `href` or `onClick`); wraps by itself. |
| `shared/FavoriteStar.tsx` | Favourite toggle. The prop is `name`: pass whatever id you store (map name, server id). |
| `shared/IconActionButton.tsx` | Icon button for table action cells, `variant` `review` / `replay` / `download`. Stops click propagation by default, so it works inside clickable rows. |
| `shared/DemoDownloadStatusModal.tsx` + `hooks/useDemoDownload.ts` | Demo download progress, success and error. `MapDownloadStatusModal` + `useMapDownload` do the same for maps. |
| `shared/ReplayVideoModal.tsx` + `hooks/useReplayWatch.ts` | Watch a cap's replay video: `openReplay({ capId, mapName, time?, alias? })`, then render the modal from `video`. |
| `shared/MarkdownBody.tsx` | Render markdown text with the app's typography. |
| `shared/MapSearchInput.tsx` | Pick one map by searching (`accessToken`, `value`, `onChange`). |
| `pages/teams/PlayerSearchInput.tsx` | Pick a UTBT player: `accessToken`, `onPick(player)`, `excludeIds?` (a `Set` of user ids to leave out, such as current members), `disabled?`, `placeholder?`. Searches by alias from 2 characters with a 300 ms debounce, shows up to 8 results through `PlayerInfo`, and clears after a pick. Used by Admin → Streamers, Roles and Events, event sign-up, team members and Stream tab casters. It takes no label, so wrap it in a labelled `role="group"`. |
| `ui/modal.tsx` | The modal shell: header and footer, focus trap, Escape closes only the top-most modal (`data-modal-backdrop`). Pass `offsetSidebar` so it centres on the content area. |
| `shared/ConfirmModal.tsx` | Yes/no confirmation (built on the simpler framer-motion `shared/Modal.tsx`). |
| `shared/AuthRequiredModal.tsx` | Prompt a signed-out user: call `requestLogin({ feature, description? })`; the modal is mounted once in `Main.tsx`. |
| `shared/BackButton.tsx` | "← Back". |

### Team identity

Team runs and rosters still render each member through `PlayerInfo`, via:
`TeamHolders` (a stacked list of members), `TeamAvatarStack` (overlapping avatars with
a roster tooltip) and `TeamRosterBadge` (a "Team" pill whose tooltip lists the roster).
Members are `TeamHolderMember` (`userId`, `alias`, `activeTitle`); pass
`currentUserId` to highlight the viewer.

## UI primitives (`app/components/ui/`)

| Component | Use for |
|---|---|
| `pagination.tsx`: `PaginationBar` | Page count, per-page select, prev/next and ellipsis; optional `meta` ("search", "filtered") labels the count. Below `sm` it renders a touch bar (`‹ Prev [page]/total Next ›`), so pages need no second pager. |
| `multi-filter-dropdown.tsx`: `MultiFilterDropdown` | Multi-select with optional fuzzy search (`searchable`) and per-option icons (`iconFor`). Empty selection means all. |
| `filter-panel-row.tsx`: `FilterPanelRow` | Label plus wrapping children inside a filter panel. |
| `dropdown-menu.tsx` | Radix dropdown for any click-to-open menu of choices. A panel holding a slider or switch is a disclosure instead (Radix takes Tab and the arrow keys inside a menu); `PickBanSoundControl` is the model. |
| `tooltip.tsx`: `Tooltip` | Hover and focus tooltip, portalled to `document.body`. The trigger wraps `children` in an inline `<span>` so it stays valid inside a `<button>` or `<a>`: pass phrasing content only (`span`, `button`, `img`, icons), and use a `span` with a `block` / `flex` class where a block is needed. With no children it renders an info icon. Sides are in [styling.md](styling.md). |
| `spinner.tsx`: `Spinner` | The loading spinner, in place of `<Loader2 className="animate-spin" />` (same props). It shows the season glyph while a season is active; `WebBootScreen` keeps a plain `Loader2`. |
| `badge`, `button`, `switch`, `checkbox`, `input`, `slider` | shadcn-derived primitives. |
| `shared/Segmented.tsx`: `Segmented` | One toggle button of a small segmented control (`active`, `label`, `onClick`). Render one per option inside your own `role="group"` with an `aria-label`; it adds no keyboard-group behaviour. Example: `events/schedule/ScheduleTabContainer.tsx`. |

## Form kit (`app/components/pages/teams/teamsShared.tsx`)

`ErrorBanner`, `SectionCard`, `teamInputClass` and `StatusBadge` back the forms in Teams and
across Events (signup, manage, schedule, predictions); reuse them before writing a new form
shell ([teams.md](features/teams.md)).

## Admin form pieces (`app/components/pages/admin/components/`)

- `AuthorPicker` (`AuthorPicker.tsx`): a map author as a linked player or free text.
  A Player / Name toggle (default Player; fall back to Name for a stored free-text
  author), a text input, or a 300 ms debounced player search rendering `PlayerInfo`
  rows using the staff `token`. Fully controlled (`mode`, `authorStr`, `authorUser` and
  their setters). `showModeToggle={false}` lets the caller place `AuthorModeToggle`
  itself; `invalid` adds a red border.
- `TagEditor` (`TagEditor.tsx`): edit a list of map tags (`tags`, `onChange`,
  `suggestions`): filter suggestions as you type, Enter or Add to add,
  case-insensitive de-duplication, an "Add new tag" row, removable chips.
- Admin sections are assembled from `SectionShell`, `TableControls` + `useAdminTable`,
  and the controls in `controls.tsx` (search, pager, select, confirm dialog, date
  range); reuse them in a new section.

## Utilities

| Module | Reuse it for |
|---|---|
| `lib/utils.ts`: `cn` | All conditional class composition. |
| `app/utils/scoreColors.ts` | Score colours (`inverted` for lower-is-better dimensions) and 1–10 difficulty colours. The thresholds live only here. |
| `app/utils/format.ts` | Cap times (`MM:SS.mmm`), deltas, dates, relative time, the 30-day "new" window, `displayMapName` (strips `CTF-BT-` / `CTF-BT+`). |
| `app/utils/titleStyles.ts` | Title-aware styling outside `PlayerInfo`. |
| `app/utils/roles.ts` | Role badges (`ROLE_LABELS` for `utbt_role` 1 Moderator, 2 Admin, 3 Cup Admin) and staff gating (`ROLE`, `isStaff`, `canActOn`, the admin allow-lists). |
| `app/utils/search.ts`: `fuzzyMatch` | Substring-first, ordered-subsequence fallback search. |
| `app/utils/server-utils.ts` | Server names, types, regions, flags, status text, sorting and filtering. |
| `app/utils/api.ts` | Every fetcher and URL builder; see [api.md](api.md). |
| `app/hooks/useCopyFeedback.ts` | Any copy-link button: `copy(key, text)` sets `copiedKey` for 1.5 s; a failed copy goes to `onError`. |

## When to extract a shared component

Extract when the same JSX or logic appears in two places and could appear in more, or
when visual and behavioural consistency matters (table styling, modal chrome). Keep it
local when it is tied to one page's data shape (the server table's bot Twitch link), or
when the shared version would need so many flags it is worse than two siblings.

New shared visual components go in `app/components/shared/`, lower-level primitives in
`app/components/ui/`, utility functions in `app/utils/`.
