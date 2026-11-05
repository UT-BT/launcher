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
| `DataTableShell` | Scroll container and `<table>`. `scrollRef` / `onScroll` reach that container, which only scrolls sideways; page scroll is the shell's ([navigation.md](navigation.md#scroll-position-and-the-shell-scroller)). `responsive` is required: density, priority auto-hide, and either phone cards (`responsive.cards`) or an explicit `tableOnly: true` ([below](#column-tiers-and-phone-cards)). |
| `DataTableHeaderRow` | Sticky `<thead>` and its `<tr>`. `theadDataAttr` writes a data attribute for the tutorial z-lift. |
| `DataTableHeaderCell` | `<th>`. `sortable` + `sortDirection` + `onSort` render the sort button and icon, and set `aria-sort` on the active column; `align`, `width`, `buttonRef`. |
| `DataTableRow` | Body `<tr>` with locked hover and border; spreads `<tr>` props. |
| `DataTableCell` | `<td>` with locked padding; `align`; forwards its ref for measuring. |
| `DataTableExpandRow` | Full-width detail row under a body row (`colSpan`), for rows that expand in place on the table (Audit Logs). Lives in `shared/DataTableExpandRow.tsx`, out of `DataTable.tsx`, so it ships with the lazy page that uses it instead of the web entry. |
| `DataTableEmpty` | Text-only empty-state row. |
| `DataTableSkeletonRow` | Uniform shimmer row for pages without custom skeletons. |

```tsx
<DataTableShell responsive={{ columns, onResolve, compactAriaLabel: 'Foos', cards }}>
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

### Column tiers and phone cards

Every responsive table passes `responsive.cards`. DataTable then renders the phone cards
itself: the page's card face, a 44 px expand chevron, an inline panel generated from the
columns, and a sort control. Reference: `WorldRecordsPage.tsx` (records and Top Rushers).
There is no other phone fallback: no hand-made compact rows, and no sideways-scrolling
cut-down table on touch.

The one exception is a table that reads best as a table at every width: it passes
`tableOnly: true` instead of `cards` and keeps the desktop rule on every device. Only numeric
comparisons do: the cap page's checkpoint split, sector and speed tables (their widths fit
360 px; see [records.md](features/records.md)), and the compare page's Team Splits and
Different Route tables. Team Splits shows the run columns that fit by priority and a picker for
the rest (`onResolve`); the compare page's Sector Times, one row per run, renders cards instead
([run-compare.md](features/run-compare.md#analysis-below-the-fold)). The types allow `cards` or
`tableOnly`, never both or neither.

Every `ResponsiveColumn<Row>` declares, and the compiler rejects a column without them:

| Field | Meaning |
|---|---|
| `tier` | `essential`: on the card face. `detail`: in the expand panel. `decorative`: may be dropped (a thumbnail that repeats the name, a bar that repeats a number). A `tableOnly` table marks every column `essential`. |
| `label` | The short label the panel shows beside the value, and the card sort field's name. |

And optionally:

| Field | Meaning |
|---|---|
| `cell(row)` | The cell content, without the `<td>`. The page's table rows render it inside `DataTableCell`, and the panel renders it beside `label`, so a new detail column reaches phones with no card code. Action columns (watch, download, history) are detail columns too. |
| `sortKey` | The column's sort field. The card sort control lists every column that has one. |
| `hiddenByUser` | The user hid the column in `ColumnsMenu`. Pass every column, flagged, rather than filtering the list: the table and its layout decision skip a flagged column, while the card panel and the card sort still list it, because the Columns menu is hidden on cards. `useAdminTable`'s `responsiveColumns` sets it. |

`width`, `priority` and `required` keep governing the desktop table exactly as before.

`cards: DataTableCards<Row>`:

| Field | Meaning |
|---|---|
| `rows`, `rowKey(row)` | The rows on screen and a stable key; the expand state is keyed by it. |
| `face(row)` | The card face: at most about four essential fields plus the favourite and status badges, identity through `PlayerInfo`, times through `CapTimeLink`. DataTable pads it. |
| `onOpen(row)` | What tapping the card body does: today's detail-page navigation. Taps on links, buttons and other controls inside the face keep their own action. |
| `rowClassName(row)` | A per-card tint, such as the new-record highlight. |
| `placeholder` | Skeleton or empty state, shown as the list's one item instead of the cards. |
| `panel(row)` | Extra panel content below the label/value grid, for detail that is not a column (Audit Logs' entry details). The chevron shows when either is present. |
| `sort` | `{ key, direction, onSort }`: the header's sort state and the header's own `onSort(key)` handler. Picking a field calls `onSort(field)`, so the page applies its usual default direction; the direction button calls `onSort(key)` on the active field, which flips it as a second header click would. Switching between table and cards keeps the sort because both read the same state. |

The layout rule (`resolveTableLayout`, unit-tested in `DataTable.test.ts`):

- **Touch** (`useDeviceEnvironment(env => env.touch)`): the table renders only when every
  non-decorative column fits the container; decorative columns drop by priority. Otherwise
  cards render, never a cut-down table.
- **Desktop**: today's rule. Optional columns drop by priority, and cards render only when the
  required columns don't fit.
- Both decide on the shell's measured width. Cards sit two per row from 600 px of container
  (`cardsPerRow`).
- A column with `hiddenByUser` never takes part, so hiding columns can't flip a landscape
  phone to cards, and the switch can't oscillate as cards come and go.
- `onCompactChange` reports cards, so hide `ColumnsMenu` while it is true. The card sort
  control replaces the sort headers. `compactAriaLabel` names the card list.

The expand control is a button named "Details" with `aria-expanded`; the panel is a `<dl>`
inside the card, followed by the `cards.panel` content when the table passes one. Expand state is per row and inline. The shell holds it, so an open card stays open
when a rotation switches to the table and back, and it resets when the page unmounts. A page
that renders two tables in one spot gives each `DataTableShell` its own `key` (World Records:
`records` and `rushers`), so cards open in one view don't reopen in the other.

## ColumnsMenu

`app/components/shared/ColumnsMenu.tsx`: drag-to-reorder plus visibility checkboxes,
generic over a `TColumnId` string union. The parent owns order and visibility and
mutates them in `onToggle` / `onReorder`. `requiredColumns` can't be hidden;
`excludeFromList` keeps a column in the order but out of the menu (the Maps `tags`
pseudo-column); `renderExtra(id)` adds a per-row control (Maps' nested "Show Tags").
`triggerRef`, `menuOpen` and `onMenuOpenChange` let a tutorial drive it. Hide it while
a responsive table shows cards; the cards list hidden columns anyway (`hiddenByUser`).

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
- The card follows the [modal rules](#modal): on touch it holds the shell scroll lock (steps
  still `scrollIntoView` their targets; on desktop the page scrolls under the card as before), takes
  focus and returns it, closes on Escape, and grows its close and buttons to 44px on touch. It sits above the bottom safe area, or above the bottom tab bar while that shows, and its body scrolls, so
  it never reaches under the top bar. The dim overlay doesn't take pointer events and stays under
  the top bar and, on desktop, the rail.

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
| `shared/DemoDownloadStatusModal.tsx` + `hooks/useDemoDownload.ts` | Demo download progress, success and error. `MapDownloadStatusModal` + `useMapDownload` do the same for maps. On the web, the map dialog's success copy ("Map Downloaded", the zip sentence) comes from `shared/mapDownloadCopy.ts`, chosen by `capabilities.install`, and both success views end with `DownloadResultPromo` (below). |
| `desktopPromo/DesktopAppNotice.tsx` | The one inline desktop-app suggestion: `source` (a `DesktopPromoClickSource`), `message` (the line without "· Download"), optional `fallback`, `onDismiss` and `className`. It reads `useDesktopPromo()` itself. Eligible: a muted box with the line, ` · ` and a `Download` link to `DESKTOP_APP_DOWNLOAD_URL`; a click records the source and turns the line into the SmartScreen hint ("Downloading… If Windows warns…", `aria-live`) until the notice unmounts. Not eligible: renders `fallback` (default nothing). `onDismiss` adds an always-visible × ("Dismiss the desktop app suggestion"); only the ambient server strip passes it. The root carries `data-desktop-app-notice` for specs. Use it for any new promo line instead of another link, and gate the mount as in [web-target.md](web-target.md#desktop-promotion). Consumers: the server strip, `shared/DownloadResultPromo.tsx` (map and demo results, lazy, `text-xs`), the web Settings placeholder, and the Stream tab's `DesktopLauncherNotice`, the one `fallback` consumer. |
| `shared/ReplayVideoModal.tsx` + `hooks/useReplayWatch.ts` | Watch a cap's replay video: `openReplay({ capId, mapName, time?, alias?, teamCapId? })`, then render the modal from `video`. `ReplayVideoPlayer` plays inline (`playsInline`), so iPhones don't force fullscreen. The state keeps `capId` and, for a team member's cap, `teamCapId`; `ReplayVideoFooter` takes both and shows **Compare** beside Share, linking to the team run when there is one, else to the cap. A caller that builds its own Watch state passes them too. |
| `shared/CompareLink.tsx` | `CompareLink({ runs, disabled, className })`: a `NavLink` to the compare page with `runs` serialised through the page's URL codec, so on web it is a real `/compare?runs=…` anchor; disabled or empty, it renders `NavLink`'s inert span. Every Compare, Watch Side by Side and Watch Team Run entry point uses it. `CompareStartLink({ map?, className })` links the start view instead (`/compare`, or `/compare?map=…` with a map), for the Map Detail and World Records **Compare Runs** buttons ([run-compare.md](features/run-compare.md#entry-points)). |
| `shared/MarkdownBody.tsx` | Render markdown text with the app's typography. |
| `shared/MapSearchInput.tsx` | Pick one map by searching (`accessToken`, `value`, `onChange`). |
| `pages/teams/PlayerSearchInput.tsx` | Pick a UTBT player: `accessToken`, `onPick(player)`, `excludeIds?` (a `Set` of user ids to leave out, such as current members), `disabled?`, `placeholder?`. Searches by alias from 2 characters with a 300 ms debounce, shows up to 8 results through `PlayerInfo`, and clears after a pick. Used by Admin → Streamers, Roles and Events, event sign-up, team members and Stream tab casters. It takes no label, so wrap it in a labelled `role="group"`. |
| `ui/modal.tsx` | The modal shell: a sheet on phones, a centred card elsewhere, with a header close that is always there. Props and dismissal rules: [Modal](#modal). |
| `shared/ConfirmModal.tsx` | Yes/no confirmation (built on the simpler framer-motion `shared/Modal.tsx`). |
| `shared/LazyModalGate.tsx` | Mount a `lazy()` modal that opens on a user action: `<LazyModalGate open={…}>` renders nothing until the first open, shows a loading spinner while the chunk loads, then keeps the modal mounted. Which modals use it: [web-target.md](web-target.md). |
| `shared/AuthRequiredModal.tsx` | Prompt a signed-out user: call `requestLogin({ feature, description? })`; the modal is mounted once in `Main.tsx`. |
| `shared/BackButton.tsx` | "← Back". |

### Modal

`ui/modal.tsx` (styles in `app/styles/modal.css`):

- **Portalled by default** into `document.body`, so it stacks above the top bar, the drawer and,
  on desktop, the rail. `portal={false}` renders it in place; no call site needs that.
- **A sheet on phones.** Below `sm` (640px wide), and on a touch screen under 640px tall (a phone
  in landscape), the modal fills the visible area:
  - Its top and height follow `visualViewport` through the device environment (`sheetBounds` in
    `ui/modalSheet.ts`), so the keyboard never covers the focused field. While pinch-zoomed it
    falls back to `100dvh`.
  - It pads by the safe-area insets, drops the card's border and radius, and ignores `maxWidth`,
    `maxHeight` and width classes.
  - The header (title, `leftAction`, close) and the footer stay put; only the body scrolls.
- **A centred card** at `sm` and up: `maxWidth`, `maxHeight` (default `90dvh`) and `className`
  size it. `offsetSidebar` pads the backdrop by the rail width plus 1rem, so the card centres on
  the content area.
- **Dismissal.** The header close (`Close modal`) is always rendered, whatever `footer` holds:
  omitted gives a Close button, `null` none, or pass your own. Escape closes only the top-most
  modal (`data-modal-backdrop`). A tap on the backdrop closes it too; pass
  `closeOnBackdrop={false}` when the modal holds unsaved input (a form, a draft, a crop, a
  selection) or a destructive or one-time step (a confirm that overwrites, deletes or reassigns,
  a token shown once, a running sync).
  On web, an open modal also owns a browser history entry: the back gesture or the browser's
  Back closes the top-most modal through `onClose`, and closing it any other way consumes the
  entry ([navigation.md](navigation.md#overlay-history-web-build)). Desktop writes no entry.
- **Touch** (`hover: none`): the backdrop is a solid `bg-black/80` tint, the panel drops any
  `backdrop-blur`, and the header close grows to 44px. Desktop keeps the blur and the 32px close.
- **Scroll lock.** An open modal holds the counted scroll lock (`ui/scrollLock.ts`): the shell
  scroller (`main.shell-main`) gets `overflow: hidden`, plus `scrollbar-gutter: stable` when it
  shows a scrollbar that takes width, so nothing reflows. Stacked and nested modals each hold one;
  the scroller is freed when the last is released, including when a modal unmounts while open (a
  route change unmounts the page and its modals). The body scrolls with
  `overscroll-behavior: contain`, so a swipe past its end doesn't chain to the page. An overlay
  that isn't a `Modal` takes the same lock: call `lockShellScroll()` in a layout effect and return
  the release it gives (`LazyModalGate`'s loading spinner does). `scrollLockCount()` and
  `subscribeScrollLock()` read the count; the diagnostic overlay shows it.
- **Focus** (`ui/modalFocus.ts`). Opening focuses the first tabbable element (`leftAction` or the
  header close), or the panel when there is none. Tab and Shift+Tab wrap inside the top-most
  modal, also from a clicked element that isn't a tab stop, and the tabbable list is read at each
  key press, so content that loads after opening joins the trap. Closing returns focus to the
  opener: the element focused when the modal opened, or the control last pressed where the browser
  doesn't focus a tapped button (Safari focuses the nearest focusable container instead, such as
  the panel of the modal underneath). It returns only if focus was still in the modal, so a modal
  closing under another doesn't take focus from it.
  Every programmatic focus passes `preventScroll`, so neither the window nor the page moves.
- **Overlays with their own markup** follow the same rules through
  `useModalBehaviour(panelRef, isOpen, onEscape?, lockScroll?)` (`ui/useModalBehaviour.ts`): the
  counted lock (unless `lockScroll` is false), the focus trap and return, and Escape for the
  top-most overlay when `onEscape` is given; with `onEscape`, the web's Back calls it too
  (overlay history). The
  overlay portals into `document.body` itself, puts `data-modal-backdrop` on the panel's parent
  and stacks at `z-50` or higher, above the top bar (`z-30`) and the drawer. `ErrorModal` (no
  Escape with `disableClose`), the sign-out confirm (`layout/SignOutConfirm.tsx`; Escape and
  Cancel close it, a backdrop tap does not) and the tutorial card use it. Reach for `Modal` first;
  the hook is for an overlay whose look must not change. The Settings loading placeholder in
  `AppLayout` is a `Modal` with the Settings modal's own props, so it already has the header close.
- **Popovers.** `ui/dropdown-menu` content portals at `z-[1000]`, above every modal and overlay
  (modals sit at `z-50`, the tutorial card at `z-80`, the Settings modal at `z-[100]`), so a menu
  opened inside one stacks over it.

### Team identity

Team runs and rosters still render each member through `PlayerInfo`, via:
`TeamHolders` (a stacked list of members), `TeamAvatarStack` (overlapping avatars with
a roster tooltip) and `TeamRosterBadge` (a "Team" pill whose tooltip lists the roster).
`teamRosterLabel` builds `TeamAvatarStack`'s accessible label ("Team roster: …"). A phone card
that lists the members with `TeamHolders`, where the table cell shows the avatar stack, wraps
them in a `role="group"` carrying the same label, so the card exposes the cell's value (Home's
Latest World Records).
Members are `TeamHolderMember` (`userId`, `alias`, `activeTitle`); pass
`currentUserId` to highlight the viewer.

## UI primitives (`app/components/ui/`)

| Component | Use for |
|---|---|
| `pagination.tsx`: `PaginationBar` | Page count, per-page select, prev/next and ellipsis; optional `meta` ("search", "filtered") labels the count. Below `sm` it renders a touch bar (`‹ Prev [page]/total Next ›`), so pages need no second pager. |
| `multi-filter-dropdown.tsx`: `MultiFilterDropdown` | Multi-select with optional fuzzy search (`searchable`) and per-option icons (`iconFor`). Empty selection means all. When the menu has less room than it needs, the option list shrinks and scrolls; the search box and Clear stay in view. |
| `filter-panel-row.tsx`: `FilterPanelRow` | Label plus wrapping children inside a filter panel. |
| `dropdown-menu.tsx` | Radix dropdown for any click-to-open menu of choices. A panel holding a slider or switch is a disclosure instead (Radix takes Tab and the arrow keys inside a menu); `PickBanSoundControl` is the model. The content stacks at `z-[1000]` ([Modal](#modal)), caps its height at the room Radix measures on its side and scrolls past it, and on touch devices holds the shell scroll lock while open, so the page behind stays still even with `modal={false}`. |
| `tooltip.tsx`: `Tooltip` | Hover and focus tooltip, portalled to `document.body`. The trigger wraps `children` in an inline `<span>` so it stays valid inside a `<button>` or `<a>`: pass phrasing content only (`span`, `button`, `img`, icons), and use a `span` with a `block` / `flex` class where a block is needed. With no children it renders an info icon. Sides are in [styling.md](styling.md). On a touch device (the device environment's `touch`) hover and focus do nothing: a tap on the trigger toggles the tooltip, and a tap elsewhere, a scroll anywhere or focus moving elsewhere closes it. A tap on a disabled control inside the trigger reaches the trigger, so a disabled button's reason opens too: on touch the trigger carries `data-tooltip-trigger`, and a rule in `app/styles/shell.css` turns off pointer events on disabled controls inside it. A tap on plain trigger content (an icon, a date, a badge) opens the tooltip only, so an enclosing card or row doesn't also navigate; a tap on a control still runs the control. **Anything critical goes inline on touch, never only in a tooltip**: read `useDeviceEnvironment(env => env.touch)` at the call site and render the text beside the control there instead of the `Tooltip` (`TeamDetailsPage`'s Join and Accept reason, `TeamCapDetailPage`'s member run status, the labels of `MembersPanel`'s icon-only promote, demote and kick buttons). |
| `spinner.tsx`: `Spinner` | The loading spinner, in place of `<Loader2 className="animate-spin" />` (same props). While there is a Seasonal entry (the Seasonal theme, or a `?season=` preview) it shows that season's or holiday's glyph from the lazy decorations chunk, falling back to `Loader2` while it loads or if it fails; the glyph stays under reduced motion and with the Effects switch off ([styling.md](styling.md#decorations)). `WebBootScreen` keeps a plain `Loader2`. |
| `badge`, `button`, `switch`, `checkbox`, `input`, `slider` | shadcn-derived primitives. A selection column of a table (the map leaderboard's compare ticks) uses a native `<input type="checkbox">` (`size-4 accent-accent-500`, dark `colorScheme`) inside a 44 px `<label>` instead of `checkbox`: the mobile crawl's tap-target rule credits a label only to a native input, and the Radix checkbox measures 16 px. |
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
  `AdminCardFace`, and the controls in `controls.tsx` (search, pager, select, confirm
  dialog, date range); reuse them in a new section. `useAdminTable` builds a tiered
  table's columns and tracks card mode ([admin.md](features/admin.md#tables-on-phones)).

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
