# Run compare

The `/compare` page: a theater that plays up to eight replay videos of one map in sync, each
with its name and live gap on the picture, one gap graph of every run under the videos, a Runs
drawer to build the set, and charts below the fold. It compares
solo caps on solo maps and whole team runs on team maps. Read it before touching
`app/components/pages/runCompare/`, the compare entry points or the team compare read's
consumers.

Elsewhere: the reads it uses (cap detail, team cap detail, replay videos, the pairwise and team
comparisons, the leaderboards) are in [api.md](../api.md); `replaceParams`, the query-carrying
route and overlay history in [navigation.md](../navigation.md); the entry points' host pages in
[records.md](records.md); the specs and their helpers in [testing.md](../testing.md).

## Where the code lives

Paths are under `app/components/pages/runCompare/`. Most modules in `url/`, `model/` and
`playback/` are pure and have a sibling `.test.ts`; `videoMedia.ts` is the `<video>` adapter.
`positionModel.ts`, `teamAnalysisModel.ts`, `clockTargets.ts` and
`playbackMedia.ts` have no sibling test, and `teamTestRuns.ts` and `playbackFakes.ts` are test
helpers.

| Path | Holds |
|---|---|
| `RunComparePage.tsx` | the lazy page: parse, load, compose, render; one part per concern (load and replace, race, drawer, captions and sound, add runs, cues, keyboard and focus, analysis, phone and tablet, teams) |
| `RunCompareHeader.tsx` | the header: the Compare Runs breadcrumb, map title, subtitle, Share menu and the Runs button |
| `url/compareUrl.ts` | the URL codec: `parseCompareQuery`, `serializeCompareQuery`, `MAX_COMPARE_RUNS`, `EMPTY_COMPARE_STATE` |
| `url/shareLink.ts` | `compareShareLink`: the site link for a set, with or without a start time |
| `loading/` | `soloRuns.ts` (`useRunReads`, `useSoloRuns`), `teamRuns.ts`, `replayVideos.ts` (three reads at a time), `comparisons.ts` (pairwise reads), `teamComparisons.ts` (team reads, 5-minute cache) |
| `model/compareModel.ts` | the composer: `composeCompareModel(input)` → `CompareModel`, everything the page renders |
| `model/` parts | `raceModel` (tiles, badges, result line), `stageLayout` (packers), `referenceModel` (per-side references), `laneModel` (rungs, lanes, live Δ), `gapGraphModel` (the transport graph), `cueModel`, `positionModel`, `overlayModel`, `audioModel`, `focusModel`, `phoneStage`, `setEdits`, `addRuns`, `analysisModel`; team mode: `teamModel`, `teamVersus`, `teamPairing`, `teamAddRuns`, `teamAnalysisModel` |
| `playback/` | the playback controller, its media interface, target functions (`clockTargets.ts`, `syncTargets.ts`), constants, the `<video>` adapter (`videoMedia.ts`) and the test fakes (`playbackFakes.ts`) |
| `stage/` | `RaceStage` (tiles and team headers), `TileCaption` (the tags on the picture, the phone caption and the sector flash), `videoTags` (the Show on Videos choice), `RunMenu` (the ⋯ menu of a tile, a roster row or a team header), `Tags` (Baseline, Red/Blue, notes, Older video), `PovSwitcher`, `DeltaChips`, `TeamLabel`, and the hooks for playback, measuring, fullscreen, swipes and the stage environment |
| `transport/` | `TransportBar`, `GapGraph` (the gap graph and its key), `CueTicks`, `useCueSync` |
| `drawer/` | `RunsDrawer` (roster), `AddRuns` / `TeamAddRuns`, `rosterRows`, `offsetNudge`, the leaderboard reads (`mapRuns`, `teamMapRuns`) and the row video pool (`rowVideos`) |
| `keyboard/` | the key map (`shortcuts.ts`), `useCompareShortcuts`, `ShortcutSheetModal` |
| `start/` | the lazy start view `CompareStart` (pick a map, then its runs), `startModel` (search term, map and record picks, the map link), `startData` (the map search and latest-records reads) and `recentCompares` (the recent sets on this device), with its own `compareStart.css` |
| `analysis/` | the lazy below-the-fold chunks `RunAnalysis` and `TeamAnalysis`, their charts and tables, `useAfterPaint` |
| `runCompare.css`, `analysis/analysis.css` | every page rule, shipped in the page's own CSS chunks |
| `app/components/shared/CompareLink.tsx` | the link every entry point renders |

## The page

- **Route.** View `run-compare`, path `/compare`, lazy in `Main.tsx` and keyed by the entry id.
  Its route-contract entry is `{ "path": "/compare", "view": "run-compare", "kind": "compare" }`.
  Default tab title "Compare Runs"; once runs load, the title is the comparison label (below).
  The navigation rail collapses to icons while the page is open (`THEATER_VIEWS` in
  `app/components/layout/sidebarPreference.ts`); its toggle expands it for the session without
  touching the saved preference.
- **Header** (`RunCompareHeader`): once a map is known, a **‹ Compare Runs** breadcrumb link back
  to the start view (`/compare`, a pushed entry); the map name as the `h1` (named "Compare Runs:
  <map>", just "Compare Runs" before a map is known), a subtitle "Solo · N runs" or "N-player · N
  team runs", **Share** and **Runs · N** (which toggles the drawer).
- **Flow.** Parse the `compare` nav param, start the video reads and the run reads, compose the
  model, then (once loaded) replace the address with the normalised query. The model is pure:
  components only render it (`composeCompareModel` takes the decoded state, the loaded runs,
  videos, comparisons, team reads, the stage box, the device environment and the transient
  choices below).
- **Layout.** A theater: the stage area (the stage plus the drawer overlaying it) and the
  transport bar, then the analysis. The stage is packed into the shell's visible height
  (`useTheaterHeight`, 320 px minimum) minus the transport bar, then hugs the packed tiles, so the
  transport sits right under the videos and the analysis starts in view when the tiles don't fill
  the height. In fullscreen and on phones the stage fills its box instead. With no tile, the stage
  is not rendered and the transport sits under the header. With no run in the set (a bare
  `/compare`, or a link whose runs all dropped) the [start view](#start-view) shows instead.
- **Notice line.** Anything dropped on parse or after load produces one `role="status"` line
  grouping drops by kind, for example "Dropped 1 malformed run id, 1 repeated run and 1
  invalid start time." It survives the first replace in nav state `compare.notice`; any edit
  clears it.
- **Title.** One run: `<alias> on <map>`; two: `<a> vs <b> on <map>`; three or more:
  `<a>, <b> and N more on <map>`, from the first two in add order, plus ` — UTBT.net`. A team
  run's label joins its member aliases with `" & "`. The map goes through `displayMapName`. The
  link preview uses the same label but orders runs fastest first.
- **Sharing.** The address holds the whole set; the playhead is never written to it (only an
  arriving `t` is read). **Share** opens a menu: "Start at 00:08.200" (checked by default, shown
  when the playhead is past 0) and **Copy Link**, which copies the site link from
  `compareShareLink` and turns the button into "Link Copied" for 1.5 s.
- **Nav state** (`useNavState`, so Back to the page restores it): `compare.notice`,
  `compare.seekSeconds`, `compare.drawerOpen`, `compare.audio`, `compare.focus` (a cap id
  or a team cap id), `compare.pov`, `compare.speedRun`, `compare.sectorView`, `compare.speedFollow`,
  `compare.speedZoom`, `compare.splitsTeam`, `compare.picked` (the start view's picks), `compare.side` (the analysed side).

## Start view

`/compare` on its own is a way in that needs no source page. `start/CompareStart.tsx` is a lazy
chunk the page renders whenever the loaded set is empty.

- **Pick a Map.** A hero panel: a large search field (`fetchMapsFuzzy`, 250 ms debounce, 8
  results from two letters, shown as a grid of map tiles with an "N-player" tag on team maps) and
  an ⓘ **How it works** button in its corner that opens the help (below).
- **Recent Comparisons** (`recentCompares.ts`): the last 6 sets opened on this device, newest
  first, in localStorage `utbt:compareRecent:v1`. The page records a set once it has loaded and its
  address is normalised, keyed by its runs in any order and without the start time; a tile shows
  the runs' names (or the name the player gave it), the map and the count and opens the set.
  Each tile has **Rename** (an inline field, up to 60 characters; Enter or leaving it saves, Esc
  cancels, an empty name goes back to the runs' names, and the name survives reopening the set)
  and **Remove**; **Clear All** empties the list. Hidden while the list is empty.
- **Latest World Records**: one `fetchWorldRecords` read of the 120 newest records, newest record
  per map, kept for 5 minutes, as a grid of cards, 12 at first and 12 more per **Show More
  Records** (the map's screenshot, its name, the holders, the
  time and the team size). Picking a map anywhere navigates to `/compare?map=<map>`, a pushed
  entry, so Back returns to the start view.
- **Pick Runs.** The header's `h1` becomes the map; a side panel (sticky beside the list on wide
  screens, above it on narrow ones) shows its screenshot, a line on what to do and **Change Map**
  (back to `/compare`). Beside it the drawer's own `AddRuns`, or `TeamAddRuns` when the map is a
  team map (`useMapRuns` says `team`), in selection mode (`selection`): the rows' toggles are
  checkboxes named **Select <name>**, the Quick Add chips tick runs instead of adding them, and
  nothing changes the address. Next Faster and Next Slower are left out: there is no run to be
  faster or slower than.
- **Compare.** A tray sticks to the bottom of the list ("2 of 10 runs selected", **Clear**,
  **Compare →**); the picks live in nav state `compare.picked` in pick order, up to 10 runs or 4
  team runs, so Back from the comparison brings them back. **Compare** pushes
  `/compare?runs=<picked>`; a set of one run opens with the Runs drawer, as any one-run link does.
- **Help** (`drawer/CompareHelpModal.tsx`, lazy, a `Modal` titled "How Compare Works"), opened from
  the start view's ⓘ and from the ⓘ **About these runs** beside the filters wherever runs are
  added: how comparing works and what the baseline is; the two video sources (**UTRecorder**,
  frame accurate from start to finish, and **DemoConverter**, legacy recording that may need custom
  syncing, each named as a link to its site that opens through `openExternal`; no video, `Graph
  only`); and the run data
  (full replay, `Checkpoints only`, `Final time only`, and why red and blue get their own
  baselines).

## URL grammar and normalisation

```
/compare
  ?map=<map name>                       only while no run is listed: the start view's map
  ?runs=<id>,...                        solo: cap ids · team map: team cap ids (≤ 10, ≤ 4 team runs)
  &ref=<id>,...                         pinned references: ≤ 1 per side (solo) or 1 team cap id (team)
  &data=<capId>,...                     runs or member POVs whose video is hidden (graph only)
  &off=<capId>:<ms>,...                 offsets for videos that aren't from UTRecorder
  &pair=<runnerCapId>:<referenceCapId>,...   team pairing overrides (member cap ids)
  &drive=<runnerCapId>                  team Same Spot driving pair (runner member cap id)
  &sync=position                        Same Spot; omitted = Race
  &t=<seconds, 3 decimals>              seeds the playhead once, page opens paused there
```

- **One codec** (`url/compareUrl.ts`). `serializeCompareQuery` writes the parameters in that
  order, omits empty ones, writes `sync` only for `position` and `t` with three decimals, and
  leaves `,` and `:` unescaped. List order is add order. `map` is written URI-encoded and only
  while `runs` is empty; parse keeps it only then too (a name over 128 characters, or with a
  control character, `/` or `\`, is `malformed`).
- **Parse** (`parseCompareQuery(query, members)`) returns the state plus structured notices
  (`malformed`, `duplicate`, `over-cap`, `outside-set`). It lowercases ids, keeps dashed UUIDs
  only, drops duplicates and runs past 10, and concatenates repeated list keys (first value
  wins for `drive`, `sync`, `t`). Unknown parameters drop silently. `ref` must name a listed
  run; `data` and `off` a run or a member; `pair` and `drive` a member, so a solo set always
  drops them. `members` is the loaded team members' cap ids, which is why the page parses once
  before loading (to learn what to read) and again after. `off` values are integers; a
  negative, non-decimal or infinite `t` is malformed. A pair is a duplicate when its runner is
  already listed or it repeats a pair reversed.
- **After load** the composer drops, in run order: runs that can't be loaded, disallowed runs,
  runs on another map than the first valid run, runs of the other kind (a team cap in a solo
  set or the reverse; the kind of a set is the kind of its first valid run), team runs past 4,
  a second pin on one side (solo) and every team pin past the first. The query is then
  re-serialised and re-parsed, so entries that pointed at dropped runs drop too.
- **Replace, never push.** The normalised query and every edit go through `replaceParams`
  ([navigation.md](../navigation.md#replace-params)), so one Back leaves the page. `t` is consumed
  once: the first replace drops it and stores the seed in nav state `compare.seekSeconds`. Back
  to the page seeks to that seed again.
- **Canonical link.** `canonicalPath` keeps only `runs`, deduplicated and sorted.

## Runs, references and data rungs

- **Run data.** Solo: the cap detail read (`SoloRun`: side, ghost flag, zone checkpoints,
  player, time). Team: the team cap detail read (`TeamRun`: members as `SoloRun`s in finish
  order, each member's first crossing of each zone). The URL doesn't say which kind an id is,
  so each id is read as a cap first and, if that read finds nothing, as a team cap.
- **Baselines, one per side** (`referenceModel.ts`; "reference" in code, **Baseline** on screen).
  Each side's baseline is its pin in `ref`, else its fastest run (ties: first in add order). A
  run of unknown side counts on the lead side. Every run is measured against its own side's
  baseline; the other side's baseline is measured against the lead baseline on final time only.
  Removing a pinned run falls back to the fastest on its side.
- **One side analysed at a time** (`focusSide`, `sideChoice`, `onFocusSide`). Red and blue take
  different routes, so a set that mixes sides analyses one of them, the lead side: the side
  chosen in nav state `compare.side` when it has two or more runs, else the fastest run's side
  when it has two or more, else the side with the most runs. Only lead-side runs get the gap
  graph, Sector Times, Speed, a live gap on their tile, a gap in the roster and a **Baseline**
  chip; the other side's videos play as usual with their `Red`/`Blue` tag and time. The graph's key
  ends with "N blue runs on the other route", the analysis opens with a note naming the analysed
  side, and when both sides have two or more runs the transport shows an **Analyse** switch (Red
  · Blue with their counts). With one run per side there is nothing to measure: no Baseline chip,
  no graph (a line says the sides compare by final time) and no analysis. A Baseline chip only
  shows when its side has another run to measure.
- **Rungs** (`laneModel.ts`), first match wins. The words say what the player gets, never where
  the data came from, and the normal case carries no note:

  | Rung | Note | When | Gives |
  |---|---|---|---|
  | `replay` | none | an `aligned`, drawable pairwise comparison with the side baseline | the gap curve and bands, live gap, sector splits and cues, Same Spot |
  | `zones` | `Checkpoints only` | a `routes_differ` comparison, or no comparison but shared zones | zone steps, zone cues |
  | `time` | `Final time only` | another side than its partner, or nothing shared | the final gap at the cap only |

  Baselines never carry a rung note. While a comparison is pending a run has no note yet.
- **Sides.** When the set mixes sides, every run with a known side carries a `Red` or `Blue` tag
  (`SIDE_TAGS`, in the pick/ban side colours); a one-side set shows none. No gap is ever drawn
  across sides.
- **Video notes.** A run without a tile is a graph-only lane at its data rung: `Graph only` (no
  video, hidden, or past the eighth tile) or `Video didn’t load` (the element failed). Videos not
  from UTRecorder show `Older video` (amber). A run that can't follow position in Same Spot shows
  `Plays in race time`.
- **Failure is a lower rung.** A failed pairwise read drops the run to `Checkpoints only` or
  `Final time only`; a failed video read or element error drops it to a graph-only lane. Nothing
  blocks playback.

## Loading

- Video reads start from the first parse, three at a time (`VIDEO_READ_CONCURRENCY`), in
  `videoReadOrder`: runs not in `data` first, in add order. They go through the 5-minute replay
  video cache (`app/utils/replayVideoCache.ts`). On team maps every member POV is a video read,
  hidden POVs last.
- Run reads fetch only ids not yet requested, so a replace that only drops runs never reloads.
  A read that throws counts as not loadable.
- Pairwise reads (`useComparisons`) start for each solo run that has a ghost, against its side
  reference when that has one too. Team reads (`useTeamComparisons`) start for each non-reference team run
  against the reference team run, then pairwise reads for its `aligned` pairs. Changing the set
  aborts reads that are no longer needed; answered pairs are kept for the page's life, team
  reads for 5 minutes.
- **Adding keeps the stage.** While an added run loads, `holdWhileAdding` keeps the last settled
  model on screen with the new query, so playback, the roster and the open drawer stay.

## Stage layouts

- **Tiles** are typed slots (`{ kind: 'video', … }`); the packers read only count and order, so
  another tile kind can join later. The first eight runs in add order that aren't in `data` and
  whose video isn't known missing get a tile (`MAX_VIDEO_TILES`). A pending read keeps its tile
  with a spinner.
- **Tile shape.** A tile is a 16:9 video; its tags sit on the picture. On phone forms the
  captions of the visible tiles sit in a row under the stage instead.
- **Grid** (`packStage`): every column count is tried and the one giving the largest tile wins
  (4 px gap), centred.
- **Focus** (`packFocus`, nav state `compare.focus`): a tile click focuses it, a second click
  or `0` returns to the grid. The focused tile takes the stage and the others form a strip along
  the short side (right on a wide stage, bottom on a tall one, at most a fifth of the long side).
  A focus gives the sound to that tile alone, unless it already has sound.
- **Phone and tablet** (`phoneStage.ts`, touch only, from the layout viewport): phone portrait
  (under 640 px wide) shows one tile; phone landscape (under 1024 px) one tile, or two side by
  side when there are exactly two; tablet portrait stacks two. A touch screen in landscape from
  1024 px keeps the grid. Outside the grid, Focus is off.
- **Freeze at cap.** A finished run's tile freezes on its cap frame, dims, and shows
  `CAP 01:23.456 · +0.512 · 2nd` in the middle of the video: its time, its gap to its partner,
  its finish position among the runs on its side.
- **Stage fullscreen.** The Fullscreen API on the theater (stage and transport), feature-detected,
  offered only when a video tile exists. Popovers portalled to `document.body` (the run menus)
  don't show inside fullscreen; the shortcut sheet renders inside the theater so it does.

## Tile tags and sound

The tags sit in the picture's corners, clear of the game's own timer at the top centre.

- **Name tag** (`overlayModel.ts` → `TileTags` in `TileCaption.tsx`), top left: the role index on
  team maps or the run's colour (the same colour as its line in the gap graph and its row in
  Sector Times), `PlayerInfo`, the final time, then the tags (`Red`/`Blue`, `Older video`, the
  notes) on a second line. Below 24 rem wide a tile hides the time, below 18 rem the tags.
- **Live gap**, top right: the gap (green ahead, red behind) with "vs <name>", the run's side
  baseline or its paired member on team maps; a **Baseline** chip on a baseline. No live gap on
  pending lanes or on final-time-only lanes before the cap. Team members of the baseline team run
  show no Baseline chip: their row header does.
- **Show on Videos** (transport, wide and tablet forms): **Names** and **Live Gap** turn the two
  tags on or off, kept per device in localStorage `utbt:compareVideoTags:v1` (`videoTags.ts`).
- **Tile actions**, bottom right: the speaker and the run menu, dimmed until the tile is hovered.
- **Phone captions**: on phone forms a caption row under the stage carries the same parts for the
  visible tiles.
- **Sector flash**: during playback, a 1 s pill at the bottom centre of the video with the sector
  gap at each sector end (the zone label on zone lanes).
- **Run menu** (`RunMenu`, "More for <name>"), shared by tiles, roster rows and team headers:
  **Set as Baseline** / **Unpin Baseline**, **Hide Video, Keep the Graph** / **Show Video**,
  **Adjust Sync · <offset>** (−100 ms, −1 frame, +1 frame, +100 ms, Reset; older videos only),
  **Leads Same Spot Sync** (team member rows in Same Spot), **Compare <name> With** (team pairs)
  and **Remove**. On team maps a tile's baseline and remove act on the whole team run, so they
  live in the team header's menu.
- **Sound**: every video starts muted. Each speaker, on a tile or a roster row, turns that run's
  sound on or off, so several runs can play sound at once (nav state `compare.audio`, in the order
  they were turned on). `M` gives the sound to the next tile alone. The volume is the replay
  modal's persisted volume, set in the transport bar (pointer devices). A run that loses its tile
  loses its sound; on a phone, sound chosen for a run outside the view brings that run into view.
- **No picture-in-picture.** Videos carry `disablePictureInPicture`, so the browser's own pop-out
  button never shows on a tile, not even through the open drawer.

## Transport bar

Top to bottom: the gap graph, the clock (`00:08.200 / 00:23.474`) beside the timeline and its ticks,
then the controls: Play/Pause, Previous/Next frame, Back/Forward 5 seconds (pointer devices),
**Jump to Sector** (or **Jump to Zone** on team sets; a menu of the cue points with their times),
the **Sync** switch (**Race** · **Same Spot**), a "Buffering:" note naming each stalled run, the
volume (pointer devices), Show on Videos, the rate menu (`1×`), Shortcuts (pointer devices) and
Fullscreen. Runs
and Share live in the page header.

- **Gap graph** (`gapGraphModel.ts` → `GapGraph.tsx`): one chart for every run, sharing the
  timeline's x axis (the run's own time over the slowest cap). Its key, in the label column, lists
  each run in stage order with its colour, name, `Red`/`Blue` tag and live gap (**Baseline** on a
  baseline, a dashed mark); a run on final time only has a hollow mark and no line. The plot draws
  each run's gap curve or zone steps against its side baseline (the dashed zero line) in the
  analysis colour, with its "took another line" bands, sector-end dots and a cap dot, on one y
  scale built from the drawn lines; faint verticals mark the cue points and a playhead with a dot
  on each line follows the clock. A mouse or pen scrubs from pointer-down; a touch arms the
  gesture, scrubs after a sideways move past 8 px, and seeks on a tap, so a vertical swipe still
  scrolls the page. On phones the key wraps above the plot. While a run's comparison loads the
  graph keeps its place, so the stage doesn't re-pack; with nothing to draw (one team run on its
  own, or only baselines) the graph is not shown.
- **Cue ticks**: `Sectors` (S1–S10 at the lead baseline's sector starts, labelled on wide forms)
  and `Zones` (diamonds, once a run on that side is on checkpoints) under the timeline. Ticks are
  buttons ("Jump to S4", "Jump to Zone 5") on pointer devices and marks on touch, where the Jump
  to menu does the cueing.
- **Team graph**: with two or more team runs, one line per team run in its team colour, drawn
  from the team splits as steps; the key names the members.

## Sync modes and the playback controller

`createPlaybackController({ time })` (`playback/playbackController.ts`) runs the clock against a
small media interface (`PlaybackMedia`), so the same code drives real `<video>` elements
(`videoMedia.ts`) and the fakes in tests. `setRuns` is declarative: pass the whole set every time.
What it guarantees:

- **One master clock** `t` from 0 to the slowest run's cap, wall time × rate. Videos follow it.
- **Targets.** Each clock group (a solo run, or every member of one team run) has one target
  function `f(t)`. Race: `f(t) = t`. A video's media time is its group's target plus its offset
  (only for videos not from UTRecorder, from `off`).
- **Stall hold.** Any visible video waiting or seeking pauses every visible video; they resume
  together once all can play. Data-only, hidden, frozen and errored runs never block.
- **Start gate.** On each start the clock waits until every started video has moved, up to 1 s.
- **Drift.** While playing, a video within 50 ms of its target is left alone (`currentTime`
  jitters by about a frame, and a seek holds every video). Between 50 ms and 0.25 s its rate is
  nudged by up to 10 % until it is back within 25 ms. Over 0.25 s it is re-seeked. Before a start,
  each video is lined up to one frame of its own fps (30 when unknown). Explicit seeks re-seek
  anything more than 1 ms off.
- **Freeze.** A video stops at its cap time plus its offset, or at its media end.
- **Errors** never throw: the run is listed in `errored` and keeps its run time as a graph-only
  run. Hidden videos are paused and re-seeked when revealed.
- **Transport.** A frame step pauses first and uses the lowest fps among visible runs. `J`/`L`
  skip 5 s and keep playing. Rates are 0.25×–2×. Play at the end restarts from 0.
- **State** (`getState`/`subscribe`): `playing`, `t`, `end`, `rate`, `stalled`, `frozen`,
  `errored`, `runTimes` (each run's own time at `t`) and `cue`. Readouts select from it with
  `usePlaybackSelector`, so only the clock and timeline re-render every frame.

The constants (`playbackConstants.ts`): one-frame start alignment, 50 ms drift deadband, 10 %
rate nudge with a 1 s catch-up, 0.25 s re-seek in every mode, position rate
½–2× the global rate with a 1 s catch-up, fallback fps 30, 5 s skip, rates 0.25–2.

**Modes:**

- **Race** (default): every group on `f(t) = t`.
- **Sector cue** (always available, **Jump to** in the transport): a cue moves every run to its
  own entry into that sector or zone and plays from there. Cues resolve per side: each side's
  baseline at its own sector start, its full-analysis runs at their own crossing from the
  comparison, checkpoint runs at their first crossing of that zone; anything else keeps Race. The
  playhead lands at the lead baseline's time. The cue is a layer over the base targets: a seek,
  scrub, skip, mode change or a change of baseline clears it; a frame step keeps it. It is never
  stored.
- **Same Spot** (`sync=position`): each full-analysis run follows its side baseline's position
  (`f(t) = t + delta(t)` from the comparison, along the connector inside a band). The video's rate
  tracks the slope, clamped to ½–2× the global rate; a gap over 0.25 s re-seeks. Every other
  non-baseline run stays on Race and shows `Plays in race time`.

## Runs drawer

`RunsDrawer` is a non-modal panel over the stage, opened by **Runs · N** in the header (nav state
`compare.drawerOpen`; a one-run solo set opens with it). Its header counts the set ("2 of 10", or
"2 of 4 team runs"). It goes through `useModalBehaviour` without a scroll lock, so it takes an
overlay history entry: Back closes it first. Escape closes it. On a wide stage that hugs its tiles
the drawer keeps the theater's height. On touch it is fixed to the right edge, and on a phone in
portrait it is a bottom sheet (60 % high, swipe down on its header to close).

- **In This Comparison** (the `Roster` list): one row per run with `PlayerInfo` (no title), its
  tags under the name, the time, the final gap (or **Baseline**), the speaker and the run menu.
  On team maps each team run is a row (colour, member names, time, Baseline, menu) with a
  `Members` list whose rows carry the speaker and the run menu (hide the POV, Adjust Sync,
  Compare With, Leads Same Spot Sync).
- **Edits** (`setEdits.ts`: `add`, `remove`, `pin`, `unpin`, `video`, `offset`, `sync`, `pair`,
  `drive`) return the next query or a blocked reason, shown in the drawer's live note: at most 10
  runs, at most 4 team runs, at most 8 videos, and a comparison needs one run.
- **Add Runs** (solo maps): the map's solo leaderboard without disallowed caps. Quick Add chips
  (World Record, Your Best when signed in, Next Faster, Next Slower, Top 3; Top 3 is all or
  nothing), a Search Players box, a **Filters** menu (Video: Any, Has Video, UTRecorder,
  DemoConverter, No Video; Run Data: Any, Full Replay, Checkpoints Only, Final Time Only; the
  button reads "Filters · 2" while any is set, with Clear Filters), the ⓘ help, and a **Side**
  switch (Both, Red, Blue) shown only when the map has runs on both sides; the baseline pinned at
  the top, 25 rows per Show More. Video filters wait for a row's video read; until then the row is
  left out. A row shows the rank (`#3`), the player, its tags (`Red`/`Blue` when sides mix,
  `Older video` for a DemoConverter video, `Graph only`, `Checkpoints only`, `Final time only`),
  the time, a video mark (read
  lazily, three at a time, visible rows first) and a toggle: **Add <name>** (+) or, filled,
  **Remove <name>** (✓). A run past the eighth video joins as a graph only, with a note. The
  leaderboard is cached per map for 5 minutes once read whole.
- **Add Team Runs** (team maps): the same controls over the team leaderboard; each row lists its
  members with their tags and video marks, and search and filters match any member.

## Keyboard

One window listener (`useCompareShortcuts`), ignored while typing, in menus and under a modal.
Space play/pause, ←/→ one frame, `J`/`L` 5 s, `1`–`8` focus a tile, `0` the grid, `Shift`+`1`–`4`
focus a team row, `[`/`]` the previous/next sector, `F` fullscreen, `R` make the focused run its
side's baseline, `M` move the sound to the next tile, `?` the shortcut sheet. Number keys also read the physical digit row, AltGr character
keys count as plain, and Alt/Ctrl combinations are left to the app. Every shortcut has a visible
control.

## Analysis below the fold

The analysis is a lazy chunk loaded two frames after the page has loaded (`useAfterPaint`), and
the scroll restore waits for it. Its rows and charts seek or cue the playhead. Identities render
through an inert `PlayerInfo` (`RunIdentity`).

Each block is a card with an uppercase header bar and its legend on the right.

- **Solo** (`RunAnalysis`, `analysisModel.ts`): the gap curve lives in the transport, so the solo
  analysis starts at **Sector Times** (`SectorTimes`, `sectorTable.ts`): one row per run, its colour
  swatch and side tag, then a column per sector and Total. A cell is the run's time gained or lost
  against its baseline in that sector, tinted by size against the table's largest gap, with the
  split in its tooltip and the fastest per side marked by a green dot. A baseline row carries no
  splits, since each of its sectors is a tenth of its run; the panel says so once. When a run
  only has zone crossings, a **Sectors / Checkpoints** switch (nav state `compare.sectorView`)
  shows the gap at each checkpoint instead, the baseline's own crossing times in its row; a run
  without data for the view says why ("Checkpoints only", "Final time only", "Sector times
  only"). Column headers cue (`Cue S4`) and Total seeks to the cap. When the columns don't fit
  (phones, narrow windows) it renders cards: name, total, a heat strip of the sectors, the values
  behind Details, and a row of jump buttons above. Then **Speed** for one chosen run (a segmented
  picker, nav state `compare.speedRun`, which outlines its tile; zoom in `compare.speedZoom`): a
  hint in the plot until it zooms, **Zoom In / Zoom Out / Whole Run** buttons, a strip of the whole
  run under the plot whose brush drags, resizes and moves with the arrow keys, and **Follow Video**
  (`compare.speedFollow`, `speedWindow.ts`), which keeps the zoomed window centred on the
  baseline's playhead. Zoomed, it draws every sample with the dodge, jump, kicker and in-the-air
  key. With a mouse or pen, hovering the plot shows a guide line, a dot on each run's line and a
  readout of the time, both runs' speed and the difference (`speedAt` in `runSpeed.ts`
  interpolates between samples; the shared `SpeedPlot` does the same on Cap Detail). On touch the
  plot's sector labels hide and its table rows zoom.
- **Teams** (`TeamAnalysis`, `teamAnalysisModel.ts`): the **Team Splits** table (one column per
  team run: time and gap at each zone, with the role badge of the team's first member across, and
  on Finish its last; nav state `compare.splitsTeam` picks the column on narrow widths), then
  **Member Pairs** (`pairSummaries`): one row per paired member, how much of the run the pair spent
  on another line ("Same line", "Took another line for 36% of the run", "Different routes" for a
  `routes_differ` pair) and **Compare Pair**, a `CompareLink` to a solo comparison of the two
  member caps, where the gap curve, sectors and speed of that pair live. Teammates split up on
  team maps, so the team page keeps to team-level numbers. A single team run has no analysis.

## Team mode

On a team map each item in `runs` is a whole team run that expands into its members' POVs.

- **The team compare read** (`fetchTeamComparison`, [api.md](../api.md#team-comparison)) answers
  for each non-reference team run against the reference team run: both rosters, the server's
  member pairs with their state (`aligned`, `routes_differ`, `zones`), unpaired members, every
  same-side candidate with its score, the team zone splits and the final Δ. Pairs and candidates
  only ever join members on the same side. Any non-200 means that team run compares on final time
  only.
- **Baseline.** One baseline team run: the first team cap id in `ref`, else the fastest. The
  **Baseline** chip sits on its team header and roster row. There are no per-side baselines in
  team mode.
- **Clock groups.** Each team run is one clock group: its POVs never desync. Cues move each team
  to its own team crossing of the zone (from the team splits once a read answers, else the members'
  first crossings). There are no S1–S10 cues on team sets.
- **Team headers** (`packTeamRows`): in the grid each team run's header is a card in a column
  left of its row (`TEAM_HEADER_WIDTH`, the row's height): colour, member names, team time, then
  the live team gap ("team gap", from the last passed team split) or **Baseline**, and the team's
  run menu (Set as Baseline, Remove). When the grid transposes, the header is a band above each
  column (`TEAM_HEADER_HEIGHT`). The packer weighs both orientations with their headers included.
- **One team run** (Watch team run): one row of member tiles with its header, no gap graph (there
  is no baseline to draw against) and no member-vs-member gap. The drawer stays
  closed.
- **Team vs team**: rows are team runs and columns are pairs, by the baseline team's paired
  members in its finish order; unpaired members sit at the row end. A third or fourth team run whose
  read hasn't answered keeps finish order inside the existing columns. The grid transposes (teams
  as columns) when that gives a larger tile. Each tile carries its team colour and its column as a
  role index, so counterparts share an index. Tile gap per pair, "vs" the partner: `aligned` → the
  pairwise curve; `zones` → the zone gap (`Checkpoints only`); `routes_differ` → `Different route`
  plus `Checkpoints only`, stepping only at the shared anchors; unpaired or a failed read →
  `Final time only`.
- **Pairing override** (**Compare <name> With** in the run menu of a team tile or member row, once
  the team read answered): options are the other team's members on the same side with their
  `route match NN %` or `zone match NN %`. Choosing one forms the pair and swaps the two displaced
  members when they share a side, else leaves them unpaired. `pair` then holds that team run's
  whole pairing; choosing back the server's pairing drops it. An override pair reads the pairwise
  comparison when both have a ghost.
- **Driving pair.** In Same Spot the other team's whole clock follows one `aligned`, drawable pair
  (default: the highest score). **Leads Same Spot Sync** in a member row's menu stores it in
  `drive`; setting another baseline team run clears it. A team run with no driving pair shows
  `Plays in race time`.
- **Limits**: 4 team runs, 8 video POVs (the rest graph only); hiding a member's video writes
  `data`, and Set as Baseline and Remove act on the whole team run.

## Entry points

Every entry point is a `CompareLink` or a `CompareStartLink` (`shared/CompareLink.tsx`): a
`NavLink` with a real `/compare?runs=…` (or `/compare`, `/compare?map=…`) href, so a click pushes
one entry and one Back returns to the source page.

- **Cap Detail → Compare**: this cap plus the default compare candidate (nearest faster run with a
  ghost, the checkpoint card's rule); alone when there is none, which opens the drawer.
- **Checkpoint card → Watch Side by Side**: this cap and the card's selected target.
- **Team Cap Detail → Watch Team Run** (this team run alone) and **Compare** (plus the next faster
  team run in the rank window, or the next slower on the world record).
- **Map Detail leaderboard**: row checkboxes and a floating **Compare (n)** button
  ([records.md](records.md#map-detail)).
- **Watch modal → Compare**: the watched run, or its team run for a team member's cap.
- **Map Detail hero → Compare Runs** (`CompareStartLink` with the map): the start view with this
  map picked (`/compare?map=<map>`), beside Download Map.
- **World Records header → Compare Runs** (`CompareStartLink`): the bare start view (`/compare`).
- **Team analysis → Compare Pair**: a solo comparison of the two paired member caps.

Disallowed runs, and team runs without a team time, disable their links. The compare page has no
sidebar entry on purpose: people arrive from a map, a record or a run.

## Mobile

The page is in the mobile route manifest (`e2e/mobile/manifest/run-compare.ts`) with the `runs`
drawer sheet modal, the `pov` (eight runs, plus the `run-menu` modal on the first roster row), `teams`, `start`
(`/compare`) and `start-map` (`/compare?map=…`) sub-views
([mobile-routes.md](../mobile-routes.md)). On a phone only the visible tiles stream: a hidden tile
drops its `src` and reloads empty, and a revealed one is seeked to the master clock. The captions
of the visible tiles sit in a row under the stage. The POV switcher (`PovSwitcher`, a
`Point of View` group of 44 px chips, grouped per team run) and a horizontal swipe on the stage
switch the tile; the other runs' live gaps ride on the visible tile as chips (`DeltaChips`).

## Tests

| Part | Covered by |
|---|---|
| URL codec | `url/compareUrl.test.ts` |
| Start view | `start/startModel.test.ts`, `start/recentCompares.test.ts`; the empty set with a map in `model/compareModel.test.ts` |
| View model (rungs, baselines, side tags, lanes, the gap graph, cues, tags, focus, packing, phone views, edits, add runs, analysis, team rows and headers, pairing, overrides) | `model/*.test.ts` through `composeCompareModel` and the `runCompare` fixtures; `model/teamTestRuns.ts` builds team inputs |
| Playback controller and targets | `playback/playbackController.test.ts`, `syncTargets.test.ts`, `teamClock.test.ts`, with the fake media and clock in `playback/playbackFakes.ts`; `videoMedia.test.ts` for the adapter |
| Loading | `loading/*.test.ts`; `drawer/rowVideos.test.ts`, `drawer/rosterRows.test.ts` |
| Keyboard | `keyboard/shortcuts.test.ts` |
| The page | `e2e/run-compare.spec.ts`: links, header and notices, race playback, the gap graph and notes, the drawer and run menus, tags and sound, adding runs, Jump to and Same Spot, focus, fullscreen and keys, the solo analysis, team runs, team vs team, pairing override and the leading pair |
| Phone and tablet | `e2e/run-compare-responsive.spec.ts` |
| Entry points | `e2e/video-compare.spec.ts`, `e2e/cap-compare-responsive.spec.ts`, `e2e/map-compare-selection.spec.ts` |
| Mobile crawl | `e2e/mobile/crawl.spec.ts` on the run-compare surfaces |
