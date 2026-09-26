---
doc: shared-components
read_when:
  - "writing JSX that shows a player, a table, a modal, a filter/columns menu, or a tutorial"
  - "about to hand-roll UI that might already be a shared component"
  - "deciding whether to extract a new shared component"
keywords: [PlayerInfo, DataTable, Modal, ColumnsMenu, FilterPresetsMenu, Tutorial, CapTimeLink, MapNavLink, NavLink, MapThumbnail, PatreonBadge, shared, pick/ban, TeamPanel, PoolGrid, StepTimeline, CentreStage, FinalSummary, CountdownBar, PickBanStatusChip, CaptainDock, ManagerDock, EditFinalEditor, PickBanMotion, usePickBanPreload, stageMotion, reduced motion, framer-motion, useCopyFeedback, copy link, PickBanSoundControl, sound control]
provides: "the inventory of reusable components + when to use each"
not_here:
  - "the class strings / design tokens → styling.md"
  - "how detail pages open via events (open-player / open-cap) → navigation.md"
  - "page/query state + persistence → state-patterns.md"
sections: [hard-rule-playerinfo, player-cap-links, map-links, tables-datatable-primitives, columns-columnsmenu, filter-presets, tutorial, visual-primitives, pick-ban-visual-core, ui-primitives, utilities, when-to-extract]
last_verified: 2026-09-25
verify_against: [app/components/shared/PlayerInfo.tsx, app/components/shared/DataTable.tsx, app/components/shared/CapTimeLink.tsx, app/components/shared/MapNavLink.tsx, app/components/shared/MapNameCell.tsx, app/components/shared/ColumnsMenu.tsx, app/components/shared/FilterPresetsMenu.tsx, app/components/pages/events/pickban/components/TeamPanel.tsx, app/components/pages/events/pickban/components/PoolGrid.tsx, app/components/pages/events/pickban/components/StepTimeline.tsx, app/components/pages/events/pickban/components/CentreStage.tsx, app/components/pages/events/pickban/components/FinalSummary.tsx, app/components/pages/events/pickban/components/Countdown.tsx, app/components/pages/events/pickban/components/PickBanBannerNote.tsx, app/components/pages/events/pickban/components/PickBanStatusChip.tsx, app/components/pages/events/pickban/components/pickBanTone.ts, app/components/pages/events/pickban/components/CaptainDock.tsx, app/components/pages/events/pickban/components/ManagerDock.tsx, app/components/pages/events/pickban/components/EditFinalEditor.tsx, app/components/pages/events/pickban/components/PickBanMotion.tsx, app/components/pages/events/pickban/components/stageMotion.ts, app/components/pages/events/pickban/pickBanBeats.ts, app/components/pages/events/pickban/usePickBanPreload.ts, app/hooks/usePrefersReducedMotion.ts, app/hooks/useCopyFeedback.ts, app/components/pages/events/pickban/components/PickBanSoundControl.tsx]
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
built from. The match page uses them; the chromeless stream view has its own broadcast
layout (below) built on the same view model, tones, choreography and reveal effects. Each
takes slices of the view model (`PickBanView`,
see `agents/data-sources.md`) and nothing from the raw payload. Who acts and what they do
read from the view model's `actorLabel` and `actionLabel`; no component rebuilds a team
label from a name and a letter.

| Component | Props | Renders |
|---|---|---|
| `MatchBanner` | `view` | The page's header: an `sr-only` `h1` with the match title, then two team plates in the side colours around the status chip, a VS and `matchSubtitle` (below `@3xl/banner` the plates sit side by side under a row with the chip and subtitle, the VS hidden, and each plate lists its members in a column). Each plate is a `section` labelled with the team's name: the A/B chip, stage seed, "On the clock" while the team is on turn or Ready / Not ready in the lobby, the name in `font-pickban`, every member through `PlayerInfo` (with their selected title) with a presence dot and a captain or acting-captain badge, and "N of M online". The on-turn plate brightens. |
| `MapTile` | `card`, `previewActor` (the side whose selection preview is shown), `actorLabels` (`actorLabelsOf(left, right)`), `dimmed`, `imageSize` (`MapThumbnailSize`), `onSelect?: (map) => void` | One square map tile, shared by the page board and the stream. It is its own `@container/tile` and sizes its text and badges in `cqw`, so it looks the same at 100px and 320px. Banned: grey under a ban mark and "Banned" in the banning side's colour, "By <team>" under the name. Picked: a coloured frame and glow, a "Map N" badge and "Picked by <team>". Decider: gold with a star. Excluded maps never reach a tile (see `ExcludedMaps`). The previewed map lifts with "Considering"; a `selected` one with "Selected", a `lockedIn` one with "Locked In", both in `previewActor`'s colour. With `onSelect`, every `selectable` tile gets a full-tile button (`aria-pressed` = `selected`) and a hover lift. The root carries `title` = the map name. Badges enter and exit and the grey transitions, so an undo reverses them. |
| `MapBoard` | `cards` (the eligible ones, `eligibleCardsOf(view.cards)`), `previewActor`, `actorLabels`, `onSelect?`, `className?` | The page's pool: `MapTile`s in centred rows (`@container/board`, padded so a lifted tile stays inside). The column count per container width comes from `boardColumnVars(count)` (`boardColumns.ts`: the largest balanced column count under each breakpoint's cap of 3 to 8), passed as CSS variables, so a tile's size is pure CSS (`min(18rem, …100cqw…)`), never measured, and the board's height depends only on its width and the pool size. While another team's map is previewed, the other open tiles dim. From `@3xl/board` a tile is also capped by the window height (`100dvh` less the space the banner, caption and dock need, divided by the row count from `--rows-N`, never below 9rem), and the row is as wide as its column count, so the maps and the dock under them fit one screen on desktop. |
| `StepTrack` | `entries`, `skippedBans`, `size` (`'page'` or `'broadcast'`), `className?` | One slot per plan step, centred: the step's map art once revealed (greyed under a ban mark for a ban), otherwise the action icon, with "Ban", "Pick · Map N" or "Decider" under it. Each slot is a `@container/slot`, sized in `cqw`. A divider sits between segments and a dashed "Skipped" slot wherever a ban was dropped. The ring on the current step is a shared layout element, so it glides to the next step, and back on an undo. On the page the slots wrap onto more rows at narrow widths. |
| `ExcludedMaps` | `cards` | Maps excluded for this match, kept off the board: an "Excluded" row of small greyed chips (thumbnail and name, the reason in the title) and each distinct reason under it. `ExcludedMaps.tsx` also exports `eligibleCardsOf`, `excludedCardsOf` and `exclusionReasonsOf`. |
| `PickBanStage` | `view`, `summaryAction?`, `onSelect?`, `className?` | The page's stage, a `section` labelled "Picks & Bans Stage" (`@container/arena`): `StageCaption` over a `MapBoard` of the eligible maps, with a glow on the acting side. The intro, a reveal, the final lineup ("Maps in play order", `FinalSummary`, `summaryAction`) and the cancelled or voided notice are overlays: each `view.scene` is one keyed presence child in a `@container-size/stage` box over the board, and the board fades out (and is `inert`) under it but keeps its space, so the stage keeps one height per width in every state. A new scene mounts in the same render that reached its moment (so a reveal starts exactly at `reveal_at`), while the old one fades out in place; on an undo (`sceneDirection` of -1) the old scene plays its entrance backwards and the returning one waits a short handoff. A scene that `playsEntrance` rules out appears settled. A paused overlay fades in and out over whatever the pause froze. |
| `StageCaption` | `view` | The line over the board: the step (and map) count, "<team> to ban" or "to pick" in `font-pickban` with chevrons pointing at the acting team, and a detail line ("Your turn: select a map, then lock in", "<team> is considering this map…", "Waiting for <team> to lock in" or "Locked in, revealing now!"); in the lobby "Waiting for an admin to start", before it "Not open yet". Exports `Chevrons` for the stream. |
| `IntroCard`, `RevealCard`, `StageNotice`, `PausedOverlay` | exported from `StageScenes.tsx`; `IntroCard` and `RevealCard` take `entranceMs?` (`view.scene.entranceMs`) | The page's scenes, sized by the `stage` size container around them. The intro slides the names in from their sides with the VS between. A reveal scales the square in; a ban then greys the screenshot and slams the BANNED stamp; a pick drops its "Map N" badge; under the map name the byline reads "Banned by <team>", "Picked by <team>" or, for the decider, "Left by both teams", then "Next: <team> to ban" (`nextStepLabel`). The decider grows more slowly with a gold glow, sheen and ribbon. Every beat is a share of `entranceMs`, and each plays in reverse when an undo removes the step. `StageScenes.tsx` also exports what the stream's own scenes reuse: `useSceneDirection`, `stageAnnouncement`, `revealKindOf`, `shakeOf`, `frameOf`, `revealByline`, `nextStepLabel`, `endReasonOf`, `DISCARDED` and `DECIDER_LETTERS`. |
| `CaptainDock` | `dock: CaptainDock` (from `captainDockOf`, see `agents/state-patterns.md`), `ab` (the viewer's side letter, for its colour), `reconnecting`, `actingFor?` (a team name, for the manager dock's act-for: the dock is labelled "Act for a team", the turn's eyebrow reads "Acting for <team>" instead of "Your turn", and Waiting says there is nothing to act for right now), `onLockIn`, `onToggleReady?`, `onDismiss`, `className?` | The captain's controls, as a bar the page places right under the stage, between the maps and the step track. It is `sticky bottom-3`, so it only pins to the bottom of the window when the board is taller than the window (on phones); on wider layouts `MapBoard` sizes its tiles to the window height so it stays in place under the maps. It shows Ready or Unready in the lobby; on their turn, what to do, the selected map and a Lock In button in the side's colour, disabled until a map is selected; Locked In with the map; or a disabled Locked button with what's next and a gliding countdown (`CountdownText` + `CountdownBar`) through the intro, a spotlight or a pause. A refusal shows above them as a dismissible alert, and a Reconnecting line below replaces the page's toast while the dock shows. The page renders it only when `captainDockOf` returns a dock, so spectators, teammates and replaced captains never see a button. The button wraps under the text at phone widths. Match-page only: the stream view never renders it. Its dismissible refusal alert is exported as `Rejection` for the manager dock. |
| `ManagerDock` | `manager` (`useManagerDock`'s result; it renders from `manager.dock`, the `managerDockOf` model, see `agents/state-patterns.md`, and nothing while that is `null`), `slug`, `accessToken`, `links` (`buildMatchLinks`'s player and stream links) | A manager's "Match Control" panel, loaded with `lazy()` by the page only while `manager.dock` is set, placed below the pool so nothing in it moves the stage, timeline or grid. It is its own `@container/dock`. The header shows the status chip and the model's status line, with Copy Player Link and Copy Stream Link as icon buttons (tooltips, a check and a polite "copied" status while copied). Under it: a voided banner (`PickBanBannerNote`, heavier border), the results warning (a `PickBanBannerNote` warning), a dismissible refusal, then the model's `playingNote` for a manager who plays in the match, a quiet one-line note. The act-for controls (`dock.actFor`) are not part of this panel: the page renders them as a `CaptainDock` with `actingFor` in the captain dock's slot under the stage, from Start to the last lock-in (locked with the countdown through the intro, a reveal or a pause). Then two columns from `@3xl/dock` (stacked below it). Left: the primary card, one big context button (Open Lobby, Start in emerald, Pause in amber, Resume) with its hint; beside Start each team's Ready mark and, while Start is refused, an amber "Start is blocked" callout with the reason and its fix. Once complete, a Pick/ban complete card instead. Under it the Sequence card: in the lobby a Radix dropdown (presets, then each stage's sequence, the current one checked, loaded with `fetchPickBanConfig` when the lobby dock mounts) that sends the override on select; otherwise plain text. Right: the Sides board. While A is undetermined or the stage seeds are tied, a "Who is Team A?" segmented `radiogroup` (arrow keys move and choose, a crimson indicator slides with `INDICATOR_TRANSITION`). Then one tile per team, A first, in its A or B colour (letter, name, stage seed; while the chooser shows, only the name and, once A is chosen, the letter, so the chooser stays the one call to action), with a round ⇄ Swap between them while Swap applies (on a swap it turns and the tiles glide past each other; it points ⇅ when the tiles stack). Each tile has an "In Control" dropdown of the roster through `PlayerInfo` (`interactive={false}`), with online dots and the captain tagged; choosing the captain gives control back. A footer separates History (Undo Last Step, Reopen, Edit Final Maps…) from the red-outlined Dangerous Actions group (Restart, Cancel Picks & Bans), each button with an icon and its hint as a tooltip. Every control is a 44px target below `sm`, and a control in flight shows a spinner. Reopen, Restart and Cancel confirm in a `ui/modal` saying what will change (red confirm button). Edit Final Maps… (shown once the last spotlight is over) opens `EditFinalEditor` in a wider modal whose Save… asks for its own confirmation (Keep Editing returns to the draft). Save… is held while the draft is invalid or `outdated`. The editor is hidden while its confirmation shows, so only one modal is ever open. A dropdown or the editor closes by itself once the session stops allowing it. Every dock modal is portalled to `document.body`: the dock sits inside the page's `@container`, which would otherwise trap a fixed overlay. Match-page only. |
| `EditFinalEditor` | `editor` (the dock's `finalEditor`: `finalEditorOf` from `events/pickban/editFinal.ts` plus `saving` and `rejection`, see `agents/state-patterns.md`), `resultsWarning`, `onChange` (applies an `editFinal.ts` draft change), `onReload` (starts the draft again from the current summary), `onDismissRejection` | The body of the Edit final modal, rendered by `ManagerDock`. While the draft is `outdated` (the session moved past the version it opened on), an amber notice says the final maps changed since the editor opened, with a Reload button. One row per map in play order: "Map N" in the picking side's colour (gold for the decider), a native map select over the eligible pool, a picked-by select with both team names (disabled for the decider), a Decider checkbox (enabled on the last row, or on a row that is still marked), and move up, move down and remove buttons. Rows with a problem get a red border, and every problem is listed under Add a Map in a polite live region. A refused save shows as a dismissible alert above the rows, with the results warning when results exist. Rows are three-line cards (44px targets) below a 42rem `@container/final`, and a single line at or above it, so the layout follows the modal's width rather than the viewport's. |
| `FinalSummary` | `entries`, `className?` | Maps in play order as square cards with a coloured frame and a "Map N" badge, who picked each, the decider in gold with a star, and a placeholder for any slot not revealed yet. The slots stagger in when the stage enters the summary. |
| `PickBanMotion` | `animate`, `children` | Wraps any tree of the visual core (the match page, the stream view). A framer-motion `MotionConfig` driven by `animate`, not by the OS reduced-motion switch: pick/ban reveals are the show, and Windows reports "reduce" whenever its Animation effects are off. The match page takes `animate` from its Animations toggle (`pickBanMotionPreference.ts`, key `utbt:pickBanMotion:v1`, on by default, account-synced); the stream view animates unless its URL carries `motion=0`. With `animate` off, every enter, exit and layout animation below it is instant and the information shown is the same. Its wrapper carries `data-motion="on"` while animating, which exempts the subtree from `shared.css`'s reduced-motion rule. `usePickBanAnimate()` reads the value below it. |
| `PickBanSoundControl` | `preference` (`{ enabled, volume }`), `onToggle(enabled)`, `onChange` (the whole next preference), `onPreview()`, `className?` (the trigger's classes) | The match page's header sound control: a button showing `preference.enabled` ("Sound On"/"Sound Off") that opens a small panel with a Sound switch (`ui/switch`, labelled by its row) and a Volume `ui/slider` 0–100% with the number shown. The slider keeps a local draft while it moves and calls `onChange` then `onPreview` only on release (pointer up, key up or blur); while sound is off a line says to turn it on to hear a preview. It is a disclosure (`aria-expanded`, a labelled group under the button), not a Radix menu, so Tab and the arrow keys reach the switch and slider; Escape, an outside pointer or focus leaving closes it. 44px rows below `sm`. It holds no sound state itself: the page wires it to `usePickBanSound` and `pickBanSoundPreference.ts` (see `agents/navigation.md` → `match-pickban-page`). |
| `usePickBanPreload(cards, sizes?)` | `view?.cards`, and the `MapThumbnailSize`s to fetch (default `['card']`, the size the core renders; the stream view passes `['card', 'hero']`); returns nothing | Fetches and decodes every non-excluded pool screenshot at each size (following `MapThumbnail`'s derived → canonical → default fallback), and loads the fonts. It holds the decoded images while mounted and keys on the list of URLs, so rebuilding the view doesn't refetch anything. Call it from the lobby on and when the stream view loads. |
| `stageMotion.ts` | `SCENE_VARIANTS`, `choreography(entranceMs)`, `staggeredCard`, `CHIP_MOTION`, `STAMP_MOTION`, `FADE_MOTION`, `INDICATOR_TRANSITION` | The shared motion values. Everything animates `transform`, `opacity` or a one-shot `filter`: nothing loops and nothing blurs per card. The hits inside an entrance (`IMPACT`, `STAMP_HIT`, `DECIDER_IMPACT`, `VS_HIT`, each a share of `entranceMs`) live in `events/pickban/pickBanBeats.ts`, which the sound cues read too, so a sound's hit and the picture's can't drift apart. |
| `CountdownText` / `CountdownBar` | `countdown`, `tone` (bar only), `className?` | A countdown and a shrinking bar, painted on animation frames from `countdown.endsAt` straight into the DOM, so nothing re-renders per frame. A frozen countdown holds still at `remainingMs`. With animations off (`usePickBanAnimate()` from the surrounding `PickBanMotion`), the bar steps once a second with the text instead of gliding. |
| `PickBanBannerNote` | `banner`, `className?` | One view-model banner (voided, cancelled, paused, skipped bans or a warning) with its icon and tint. |
| `PickBanStatusChip` | `status: PickBanSessionStatus`, `className?` | A session status in the words and colours of `pickBanStatus.ts`: Not Open, Cancelled and Voided muted, Lobby in the accent, Live emerald, Paused amber, Complete neutral. The Manage queue and the watch page both use it, so a status reads the same everywhere. |
| `pickBanTone.ts` | `PICK_BAN_TONES`, `PICK_BAN_HUES`, `teamTone(ab)`, `stepTone(actor)`, `tint(hue, percent)` | Class sets for A, B, gold and neutral, and each tone's CSS colour. A step with no actor is the decider, so it is gold. `tint` mixes a hue with transparency for inline gradients, glows and shadows. |

They size themselves with container queries (`/banner`, `/arena`, `/board`, `/tile`,
`/slot`, the `stage` size container), not viewport breakpoints, so they work the same in a
phone column, beside the sidebar at 4K and in the stream's fixed stage. Keys are the view
model's (member id, map name, plan index, map number), and the two team plates sit in fixed
left and right slots, so a poll never remounts them. Display text (team names, the caption,
tile and track labels, the scenes) is set in `font-pickban`, which `PickBanStage` loads.

### Stream broadcast layout

`events/pickban/stream/` renders the stream view for a 1920×1080 OBS source, in its own
layout, fixed in pixels, sharing `MapTile`, `StepTrack` and `Chevrons` with the page.
`StreamBroadcast` (`view`, `eventName`) stacks:

| Piece | Renders |
|---|---|
| `BroadcastHeader` | Two angled team plates in the side colours (letter, stage seed, name sized down for long names, every member through `PlayerInfo` with `interactive={false}`), with the event name, "Picks & Bans" and `matchSubtitle` between them. The side on turn brightens and shows "On the clock"; in the lobby each plate shows Ready or Not ready. |
| `BroadcastCaption` | A line over the board: "<team> to ban" or "to pick" with the step (and map) count and chevrons pointing at the acting team, or the lobby and not-open notices. |
| `BroadcastBoard` | The eligible maps as big square `hero`-size `MapTile`s, laid out by `boardLayout(count, width, height, gap, maxTile)` (the column count that keeps tiles largest, capped at 320px), and one muted line under them per exclusion tag ("Hard maps are out: …"). While a map is previewed the other open maps dim. |
| `StepTrack` | `size="broadcast"`: fixed 128px slots in one row. |
| `BroadcastIntro`, `BroadcastReveal` | The intro (names from their sides, players, VS, countdown) and the reveal (card, stamp or map badge, map name, byline, countdown, next turn) at broadcast size, from the same `choreography(entranceMs)`, `RevealEffects` and `StageScenes.tsx` helpers as the page's scenes. |
| `BroadcastLineup`, `BroadcastNotice`, `BroadcastPaused` | The maps in play order once complete, the cancelled or voided notice (`endReasonOf`, `DISCARDED`), and the paused overlay. |

The intro, a reveal, the lineup and the notices are overlays keyed by `view.scene.key` and
entered with `SCENE_VARIANTS`, `useSceneDirection` and `playsEntrance`, so a source loaded
mid-scene doesn't replay it; the board fades out under them. A backdrop tints each side in
its colour and glows on the acting side. The turn chevrons are the layout's one looping
animation. Text uses `font-pickban` (see `agents/styling.md`), whose faces it loads on mount.

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
| `dropdown-menu.tsx` | Radix dropdown primitive. Use for any click-to-open menu of choices. A panel that holds a slider or a switch is not a menu (Radix takes Tab and the arrow keys inside one): make it a disclosure like `PickBanSoundControl`. |
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
