---
doc: shared-components
read_when:
  - "writing JSX that shows a player, a table, a modal, a filter/columns menu, or a tutorial"
  - "about to hand-roll UI that might already be a shared component"
  - "deciding whether to extract a new shared component"
keywords: [PlayerInfo, DataTable, Modal, ColumnsMenu, FilterPresetsMenu, Tutorial, CapTimeLink, MapNavLink, NavLink, MapThumbnail, PatreonBadge, shared, pick/ban, TeamPanel, PoolGrid, StepTimeline, CentreStage, FinalSummary, CountdownBar, PickBanStatusChip, CaptainDock, ManagerDock, EditFinalEditor, PickBanMotion, usePickBanPreload, stageMotion, reduced motion, framer-motion, useCopyFeedback, copy link]
provides: "the inventory of reusable components + when to use each"
not_here:
  - "the class strings / design tokens → styling.md"
  - "how detail pages open via events (open-player / open-cap) → navigation.md"
  - "page/query state + persistence → state-patterns.md"
sections: [hard-rule-playerinfo, player-cap-links, map-links, tables-datatable-primitives, columns-columnsmenu, filter-presets, tutorial, visual-primitives, pick-ban-visual-core, ui-primitives, utilities, when-to-extract]
last_verified: 2026-09-25
verify_against: [app/components/shared/PlayerInfo.tsx, app/components/shared/DataTable.tsx, app/components/shared/CapTimeLink.tsx, app/components/shared/MapNavLink.tsx, app/components/shared/MapNameCell.tsx, app/components/shared/ColumnsMenu.tsx, app/components/shared/FilterPresetsMenu.tsx, app/components/pages/events/pickban/components/TeamPanel.tsx, app/components/pages/events/pickban/components/PoolGrid.tsx, app/components/pages/events/pickban/components/StepTimeline.tsx, app/components/pages/events/pickban/components/CentreStage.tsx, app/components/pages/events/pickban/components/FinalSummary.tsx, app/components/pages/events/pickban/components/Countdown.tsx, app/components/pages/events/pickban/components/PickBanBannerNote.tsx, app/components/pages/events/pickban/components/PickBanStatusChip.tsx, app/components/pages/events/pickban/components/pickBanTone.ts, app/components/pages/events/pickban/components/CaptainDock.tsx, app/components/pages/events/pickban/components/ManagerDock.tsx, app/components/pages/events/pickban/components/EditFinalEditor.tsx, app/components/pages/events/pickban/components/PickBanMotion.tsx, app/components/pages/events/pickban/components/stageMotion.ts, app/components/pages/events/pickban/usePickBanPreload.ts, app/hooks/usePrefersReducedMotion.ts, app/hooks/useCopyFeedback.ts]
---

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
- Avatar-only presentation for compact roster stacks, with the same fallback and
  active-title border styling
- Name-only presentation for narrow table cells, keeping the click-through and
  title/Patreon styling without the avatar

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

Pass `interactive={false}` to suppress the click-through to the player profile when
the whole row is itself a button/clickable (e.g. the compare-run picker), so a click
on the name compares/selects instead of navigating away.

If the API payload you're rendering lacks `active_title`, get the field added to
the API endpoint rather than working around it in the launcher (see the
`consume-api-data` skill).

Use `presentation="avatar"` only inside compact identity collections such as
`TeamAvatarStack`. The surrounding component must expose names through an
accessible label or roster tooltip.

Use `presentation="name"` when a narrow column has no room for an avatar (e.g.
the Maps author column). The name still links to the player profile whenever
`userId` is set, and falls back to plain uninteractive text when it is not — so
linked and string-only authors need no branch at the call site. The wrapper is
`w-fit`, so center it with `mx-auto` rather than `justify-center`.

Rarity styling (1–5) lives in `app/utils/titleStyles.ts`
(`getAvatarBorderStyle`, `getTitleTextStyle`, `getReadableTitleColor`, `hasTitle`).
`PlayerInfo` consumes those helpers; if you need title styling outside
`PlayerInfo` (e.g. a hero panel), import from `titleStyles.ts` — don't re-implement.
Rarity 5 uses `legendaryAvatarPulse` / `legendaryTitlePulse` keyframes in
`app/styles/globals.css`.

### Patreon supporters

`PlayerInfo` auto-renders a `PatreonBadge` (heart) next to the name when the
player is a Patreon member — you don't pass anything. It calls
`usePatreonTier(userId)` (`app/utils/patreon.ts`), which resolves the member's
tier from a cached gateway list (see `agents/data-sources.md`). Players with no
`userId` (string-only authors) never match, so they get no badge.

`app/components/shared/PatreonBadge.tsx` — `{ tier: 1|2|3; size?: 'sm'|'md'|'lg' }`.
Per-tier flair: t1 outline rose · t2 filled rose + glow · t3 gold + star +
`patreonPulse` keyframe. Tooltip names the tier. For surfaces that render
identity by hand (e.g. `playerDetail/HeroSection.tsx`, which doesn't use
`PlayerInfo`), call `usePatreonTier(userId)` and drop in `<PatreonBadge>`
directly — don't hand-roll a heart.

Clicking a badge fires the `open-patreon` window event (it `stopPropagation`s
so it doesn't also open the player profile when nested in a clickable row).
`PatreonModal` (`app/components/modals/PatreonModal.tsx`) is mounted once in
`Main.tsx`, listens for that event, and shows a "Support UTBT" info modal (tiers
preview + how to get the badge + Patreon link). Open it from elsewhere via
`openPatreonInfo()` exported from `PatreonBadge.tsx`.

## Player + cap links

Detail pages aren't URL-routed; clicking identity/time UI dispatches a `window`
event that `Main.tsx` turns into navigation. The **event architecture lives in
`agents/navigation.md`** — here are the two components you render so it happens:

- **`PlayerInfo`** opens the Player Detail page on click (dispatches `open-player`).
  Don't dispatch by hand — render `PlayerInfo` (above).
- **`CapTimeLink`** (`app/components/shared/CapTimeLink.tsx`) — render every cap
  time through it:

  ```tsx
  <CapTimeLink capId={entry.id} seconds={entry.cap_time_seconds} className={...} />
  ```

  It renders `formatCapTime(seconds)` and, when `capId` (or `teamCapId`) is a real
  id, makes it a `NavLink` that `stopPropagation`s (so it works inside rows that
  already open the map) and dispatches `open-cap` / `open-team-cap` → the Cap Detail
  page. Pass `capId={undefined}` for aggregate times with no backing cap (medians,
  medal thresholds, distribution buckets) — it falls back to plain text. Don't
  hand-roll `formatCapTime` in a clickable span. `openCap(capId)` is also exported
  for the rare non-time trigger (e.g. the movement "best run" link).

Both render through `NavLink`, so on the web build they are real `<a href>`
elements — middle-click / ctrl-click / "Open in new tab" work. See
`agents/navigation.md` → link semantics.

## Map links

Never wire a map click as a bare `<button onClick={() => onMapSelect(name)}>`.
Render one of:

- **`MapNameCell`** (`app/components/shared/MapNameCell.tsx`) — the table cell:
  thumbnail + favorite star + name, thumbnail and name each linking to the map.
- **`MapNavLink`** (`app/components/shared/MapNavLink.tsx`) — the generic wrapper
  for any other clickable map surface (poster tiles, hero art, compact rows):

  ```tsx
  <MapNavLink mapName={map.name} onMapSelect={onMapSelect} className={...}>
      <MapThumbnail mapName={map.name} className="size-10 rounded-md" />
  </MapNavLink>
  ```

  Omitting `onMapSelect` renders a plain inert `<span>` — so the same JSX covers
  the "not navigable here" case, and the click still reaches an enclosing
  clickable row. It is a thin `NavLink` bound to
  `maps-detail`, so the web build gets a real `/maps/<name>` anchor.

`MapNameCell`/`MapNavLink` use `cn(...)` conditionals for their hover/cursor
classes — do **not** reach for Tailwind's `enabled:` variant around them; `:enabled`
never matches an `<a>`, so those rules silently die on the web build.

## Tables — `DataTable.*` primitives

`app/components/shared/DataTable.tsx`. Use these for ANY tabular page. They
encode the locked styling decisions (padding, font, hover, sort icons). Pages
own their column definitions and cell content; primitives own the shell.

| Component | Purpose |
|---|---|
| `DataTableShell` | Scroll container + `<table>`. Pass `scrollRef`, `onScroll` for persisted scroll state. `minWidth` floors the table width so a flex column scrolls instead of collapsing at small sizes. Opt-in `responsive={{ columns, onResolve, compactContent, compactAriaLabel }}` adds width-driven condensed density + priority auto-hide, and below the required-fit width renders `compactContent` (stacked card rows) instead of the table — mandatory for every primary tabular surface; see `styling.md` → Responsive columns. |
| `DataTableHeaderRow` | Sticky `<thead>` + bordered `<tr>`. `theadDataAttr` writes a data-attr for tutorial z-lift. |
| `DataTableHeaderCell` | `<th>` with locked padding/font. `sortable` + `sortDirection` + `onSort` for sortable headers. `align`, `width`, `className`, `buttonRef` overrides. |
| `DataTableRow` | Body `<tr>` with locked hover/border styling. Spread-through tr props. |
| `DataTableCell` | `<td>` with locked padding. `align`, `width`, `className` overrides. `forwardRef` so per-cell measurements (tutorial) work. |
| `DataTableEmpty` | Centered empty-state row. Text only, no icon. |
| `DataTableSkeletonRow` | Uniform shimmer row for pages without per-column custom skeletons. |
| `SortIcon` | Standalone sort-direction icon (`asc` / `desc` / `null`). Rarely needed — `DataTableHeaderCell` renders it via `sortable`. |

Locked styling defined in `styling.md`. Don't override padding/font/hover
inline — use the primitives or extend them. See **Column layout** in
`styling.md` for the width/alignment convention: one width-less flex text
column, an explicit `width` on every other column (else right-aligned numerics
float under `table-fixed`); numbers right + `tabular-nums`, text left,
icons/badges/actions center.

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
| `app/components/shared/MapThumbnail.tsx` | Any map screenshot tile. Pass `mapName` + `className` for sizing. Falls back to `default.png` on error. Optional `version` (the map's `screenshot_updated`) appends a cache-busting `?v=` — pass it wherever you have it so a replacement swaps instantly. Stored screenshots are square; in a non-square box pass `fit="blend"` (contains the image over a blurred copy of itself) instead of letting `object-cover` crop it a second time. |
| `app/components/modals/MapScreenshotModal.tsx` | The one UI for changing a map screenshot, shared by the map hero and the profile Maps Authored tab. Square crop with drag-to-pan + zoom, uploads a canvas-rendered PNG, and hands the updated map back through `onUploaded`. Gate on who may open it (linked author or staff) at the call site — see `agents/data-sources.md`. |
| `app/components/shared/ActiveFilterChip.tsx` | Removable blue-tinted chip for active filter pills shown above the data table. Props: `label`, `value`, `onClear`. Pages compose a row of these from their own filter state (one chip per filter value). |
| `app/components/shared/FavoriteStar.tsx` | Generic favorite toggle. Prop is `name: string` (not `mapName`); pass whatever identifier you store (map name, server ID, etc.). |
| `app/components/shared/IconActionButton.tsx` | Locked-style icon button used in table action cells. `variant: 'review' \| 'replay' \| 'download'` (orange for review, amber for replay, blue for download). Props: `icon` (lucide), `tooltip`, `onClick`, optional `loading`, `disabled`, `iconFill`. Stops click propagation by default so it works inside clickable rows. |
| `app/components/shared/DemoDownloadStatusModal.tsx` | Modal that shows demo-download progress / success / error. Pair with the `useDemoDownload()` hook (`app/hooks/useDemoDownload.ts`) which exposes `download`, `start(entry, mapName)`, `clear()`. |
| `app/components/ui/modal.tsx` | Primary modal shell (header/footer, focus trap, Escape, stacking). Pass `offsetSidebar` so it respects the navigation rail. (`app/components/shared/Modal.tsx` is a simpler framer-motion variant used by `ErrorModal`.) |
| `app/components/shared/ConfirmModal.tsx` | Yes/no confirmation dialog. |
| `app/components/shared/BackButton.tsx` | "← Back" button. |

## Pick/ban visual core

`app/components/pages/events/pickban/components/` holds the pieces a pick/ban screen is
built from. The match page uses them today, and the chromeless stream view reuses them
inside its fixed 1920×1080 stage. Each takes slices of the view model (`PickBanView`,
see `agents/data-sources.md`) and nothing from the raw payload. Who acts and what they do
read from the view model's `actorLabel` and `actionLabel`; no component rebuilds a team
label from a name and a letter.

| Component | Props | Renders |
|---|---|---|
| `TeamPanel` | `panel: PickBanTeamPanel \| null`, `className?` | The A/B chip, stage seed chip, team name, a reserved "On the clock" row, and every member through `PlayerInfo` with a presence dot and a captain or acting-captain badge. Tinted and ringed in the side's colour. |
| `PoolGrid` / `PoolCard` | `cards`, `previewActor` (the side whose selection preview is shown), `onSelect?: (map) => void`, `className?` | Square `MapThumbnail` cards. Banned: grey with a "BANNED" stamp in the banning side's colour. Picked: the picker's colour and "Map N". Decider: gold. Excluded: faded, "Excluded · <tag> maps", and the full reason in the title and screen-reader text. With `onSelect`, every `selectable` card gets a full-card button (`aria-pressed` = `selected`), and a `selected` card gets a heavy ring and a "Selected" badge in `previewActor`'s colour. Leave `onSelect` out, as the stream view does, and no card is clickable. The stamp and chips (Selected included) enter and exit, and the grey and border colour transition, so an undo reverses them. Nothing animates on first render. |
| `StepTimeline` | `entries`, `skippedBans`, `className?` | One chip per plan step (icon, actor and action, a ring on the current step), a divider between segments, and a dashed "Skipped" chip wherever a ban was dropped. The ring is a shared layout element, so it glides to the next step, and back on an undo. |
| `CentreStage` | `view`, `summaryAction?`, `className?` | Switches on `view.stagePhase`: a not-open or lobby card (Ready per side), the A-vs-B intro with a countdown, the turn indicator (team, Ban or Pick, and the previewed map; the viewer's own turn reads "Your turn: select a map, then lock in"), the reveal, the final summary, or a cancelled or voided notice carrying the session's end reason and that its bans and picks don't count. A paused overlay fades in and out over whatever the pause froze. `summaryAction` renders under the summary. It is a size container (`@container-size/stage`), so `className` must give it a definite height inside a box of definite width. The turn and reveal squares cap themselves by that height (`cqh`), so every state fits whatever fixed height the layout reserves. Each `view.scene` is one keyed presence child. A new scene mounts in the same render that reached its moment (so a reveal starts exactly at `reveal_at`), while the old one fades out in place. On an undo (`sceneDirection` of -1), the old scene plays its entrance backwards and the returning scene waits a short handoff before entering. A scene that `playsEntrance` rules out appears settled. |
| `IntroCard`, `TurnCard`, `RevealCard` | exported from `CentreStage.tsx`; `IntroCard` and `RevealCard` take `entranceMs?` (`view.scene.entranceMs`) | The stage's building blocks, for a layout that places them differently. The intro slides the names in from their sides with the VS between. A reveal scales the square in; a ban then greys the screenshot and slams the BANNED stamp; a pick drops its "Map N" chip; a ban-down reveal carries a "Ban-down" tag; the decider grows more slowly with a gold glow, sheen and ribbon. Every beat is a share of `entranceMs`, and each plays in reverse when an undo removes the step. Their animations are variants driven by the stage's scene element, so outside `CentreStage` they render settled. |
| `CaptainDock` | `dock: CaptainDock` (from `captainDockOf`, see `agents/state-patterns.md`), `ab` (the viewer's side letter, for its colour), `reconnecting`, `actingFor?` (a team name, for the manager dock's act-for: the dock is labelled "Act for a team", the turn's eyebrow reads "Acting for <team>" instead of "Your turn", and Waiting says there is nothing to act for right now), `onLockIn`, `onToggleReady?`, `onDismiss`, `className?` | The captain's controls, as a bar stuck to the bottom of the scroll area: Ready or Unready in the lobby; on their turn, what to do, the selected map and a Lock in button in the side's colour, disabled until a map is selected; Locked in with the map; or a disabled Locked button with what's next and a gliding countdown (`CountdownText` + `CountdownBar`) through the intro, a spotlight or a pause. A refusal shows above them as a dismissible alert, and a Reconnecting line below replaces the page's toast while the dock shows. The page renders it only when `captainDockOf` returns a dock, so spectators, teammates and replaced captains never see a button. The button wraps under the text at phone widths. Match-page only: the stream view never renders it. Its dismissible refusal alert is exported as `Rejection` for the manager dock. |
| `ManagerDock` | `manager` (`useManagerDock`'s result; it renders from `manager.dock`, the `managerDockOf` model, see `agents/state-patterns.md`, and nothing while that is `null`), `slug`, `accessToken`, `children` (the copy-link buttons) | A manager's controls, loaded with `lazy()` by the page only while `manager.dock` is set, placed below the pool so nothing in it moves the stage, timeline or grid. First the act-for strip, a static `CaptainDock` with `actingFor`, right under the grid. It stays from Start to the last lock-in (locked with the countdown through the intro, a reveal or a pause), so the toolbar below never jumps between steps. Then the "Match admin" toolbar: the copy-link buttons, a voided banner (`PickBanBannerNote`, heavier border), the results warning, a dismissible refusal, and the buttons (Open, Start, Swap, Pause or Resume, Undo, Reopen, Restart, Cancel, one "A: <team>" per side, Change sequence…, Hand over…, Edit final maps…) with the Start blocking reason under them. The buttons are a two-column grid of 44px targets at phone widths and a wrapping row of compact chips from `sm` up. Reopen, Restart and Cancel confirm in a `ui/modal` saying what will change (red confirm button). Change sequence… fetches the stage list when it opens and applies the choice from a native select; Hand over… lists each side's roster through `PlayerInfo` (`interactive={false}`), with who is in control; Edit final maps… opens `EditFinalEditor` in a wider modal whose Save… asks for its own confirmation (Keep editing returns to the draft). The editor is hidden while its confirmation shows, so only one modal is ever open. A picker or the editor closes by itself once the session stops allowing it. Every dock modal is portalled to `document.body`: the dock sits inside the page's `@container`, which would otherwise trap a fixed overlay. Match-page only. |
| `EditFinalEditor` | `editor` (the dock's `finalEditor`: `finalEditorOf` from `events/pickban/editFinal.ts` plus `saving` and `rejection`, see `agents/state-patterns.md`), `resultsWarning`, `onChange` (applies an `editFinal.ts` draft change), `onDismissRejection` | The body of the Edit final modal, rendered by `ManagerDock`. One row per map in play order: "Map N" in the picking side's colour (gold for the decider), a native map select over the eligible pool, a picked-by select with both team names (disabled for the decider), a Decider checkbox (enabled on the last row, or on a row that is still marked), and move up, move down and remove buttons. Rows with a problem get a red border, and every problem is listed under Add a map in a polite live region. A refused save shows as a dismissible alert above the rows, with the results warning when results exist. Rows are three-line cards (44px targets) below a 42rem `@container/final`, and a single line at or above it, so the layout follows the modal's width rather than the viewport's. |
| `FinalSummary` | `entries`, `className?` | Maps in play order, who picked each, the decider in gold, and a placeholder for any slot not revealed yet. The slots stagger in when the stage enters the summary. |
| `PickBanMotion` | `children` | Wraps any tree of the visual core (the match page, the stream view). A framer-motion `MotionConfig` that follows the reduced-motion switch (`prefers-reduced-motion: reduce`): with it on, every enter, exit and layout animation below it is instant, and the information shown is the same. |
| `usePickBanPreload(cards)` | `view?.cards`; returns nothing | Fetches and decodes every non-excluded pool screenshot at the `card` size the core renders (following `MapThumbnail`'s derived → canonical → default fallback), and loads the fonts. It holds the decoded images while mounted and keys on the list of URLs, so rebuilding the view doesn't refetch anything. Call it from the lobby on and when the stream view loads. |
| `stageMotion.ts` | `SCENE_VARIANTS`, `choreography(entranceMs)`, `staggeredCard`, `CHIP_MOTION`, `STAMP_MOTION`, `FADE_MOTION`, `INDICATOR_TRANSITION` | The shared motion values. Everything animates `transform`, `opacity` or a one-shot `filter`: nothing loops and nothing blurs per card. |
| `CountdownText` / `CountdownBar` | `countdown`, `tone` (bar only), `className?` | A countdown and a shrinking bar, painted on animation frames from `countdown.endsAt` straight into the DOM, so nothing re-renders per frame. A frozen countdown holds still at `remainingMs`. With reduced motion on (`usePrefersReducedMotion()` in `app/hooks/`, reading the same `prefers-reduced-motion: reduce` switch `shared.css` honours), the bar steps once a second with the text instead of gliding. |
| `PickBanBannerNote` | `banner`, `className?` | One view-model banner (voided, cancelled, paused, skipped bans or a warning) with its icon and tint. |
| `PickBanStatusChip` | `status: PickBanSessionStatus`, `className?` | A session status in the words and colours of `pickBanStatus.ts`: Not open, Cancelled and Voided muted, Lobby in the accent, Live emerald, Paused amber, Complete neutral. The Manage queue and the watch page both use it, so a status reads the same everywhere. |
| `pickBanTone.ts` | `PICK_BAN_TONES`, `teamTone(ab)`, `stepTone(actor)` | Class sets for A, B, gold and neutral. A step with no actor is the decider, so it is gold. |

They size themselves with container queries (`@container-size/stage`, `/team`, `/grid`),
not viewport breakpoints, so they work the same in a phone column, beside the sidebar at 4K
and in a fixed stage. Keys are the view model's (member id, map name, plan index, map
number), and the two team panels sit in fixed left and right slots, so a poll never
remounts them.

All motion here is framer-motion, driven by the view model's timeline (`view.scene`, card
states and timeline statuses), never by a poll arriving. So two screens play a reveal at the
same moment. Don't use the `animate-in` / `fade-in` / `slide-in` utility classes: their
plugin isn't imported, so they emit no CSS. Wrap each root that renders the core in
`PickBanMotion`, and import it, like framer-motion, only from lazily loaded modules.

## UI primitives (`app/components/ui/`)

| Component | Use for |
|---|---|
| `pagination.tsx` — `PaginationBar`, `buildPageList`, `PAGE_SIZE_OPTIONS` | Page count + per-page dropdown + prev/next + ellipsis. Pass optional `meta` ("search" / "filtered") for the count badge. Below `sm` it swaps itself for a touch bar (`‹ Prev [editable page]/total Next ›`) — pages get mobile pagination for free; never hand-roll a second pager. |
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
| `app/utils/roles.ts` | `ROLE_LABELS` — maps `utbt_role` (1=Moderator, 2=Admin, 3=Cup Admin; 0/undefined = no badge) to `{ label, className }`. Shared by the profile hero and Players page; use it for any role badge rather than re-defining the colors. Also `ROLE` (numeric enum), `ADMIN_DASHBOARD_ROLES` / `ADMIN_ONLY_ROLES` (allow-lists), `isStaff(profile)`, and `canActOn(actor, target)` — the staff-gating helpers behind the admin page. |
| `app/utils/search.ts` | `fuzzyMatch(text, query)` — substring-first, ordered-subsequence fallback. |
| `app/utils/server-utils.ts` | Server-specific: `trimServerName`, `getServerType`, `getServerRegion`, `getRegionFlag`, `getGameStatusText`, `sortServers`, `filterServers`. Types: `ServerType`, `FilterState`, `ServerSortField`, `SortDir`, `ServerPreset`, `ServerPresetFilters`. |
| `app/utils/api.ts` | Data fetching + URL builders. See `data-sources.md`. |
| `app/hooks/useCopyFeedback.ts` | `useCopyFeedback(onError)` → `{ copiedKey, copy(key, text) }`. Copies to the clipboard and sets `copiedKey` for 1.5 s, for a transient "Copied" label; the timer is cleared on unmount. A failed copy goes to `onError`. Use it for any copy-link button. |

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
