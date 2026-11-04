# Run compare

The `/compare` page: a theater that plays up to eight replay videos of one map in sync, with
one delta lane per run, a Runs drawer to build the set, and charts below the fold. It compares
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
`audioModel.ts`, `positionModel.ts`, `teamAnalysisModel.ts`, `clockTargets.ts` and
`playbackMedia.ts` have no sibling test, and `teamTestRuns.ts` and `playbackFakes.ts` are test
helpers.

| Path | Holds |
|---|---|
| `RunComparePage.tsx` | the lazy page: parse, load, compose, render; one part per concern (load and replace, race, drawer, audio and overlays, add runs, cues, keyboard and focus, analysis, phone and tablet, teams) |
| `url/compareUrl.ts` | the URL codec: `parseCompareQuery`, `serializeCompareQuery`, `MAX_COMPARE_RUNS`, `EMPTY_COMPARE_STATE` |
| `loading/` | `soloRuns.ts` (`useRunReads`, `useSoloRuns`), `teamRuns.ts`, `replayVideos.ts` (three reads at a time), `comparisons.ts` (pairwise reads), `teamComparisons.ts` (team reads, 5-minute cache) |
| `model/compareModel.ts` | the composer: `composeCompareModel(input)` → `CompareModel`, everything the page renders |
| `model/` parts | `raceModel` (tiles, badges, result line), `stageLayout` (packers), `referenceModel` (per-side references), `laneModel` (rungs, lanes, live Δ), `cueModel`, `positionModel`, `overlayModel`, `audioModel`, `focusModel`, `phoneStage`, `setEdits`, `addRuns`, `analysisModel`; team mode: `teamModel`, `teamVersus`, `teamPairing`, `teamAddRuns`, `teamAnalysisModel` |
| `playback/` | the playback controller, its media interface, target functions (`clockTargets.ts`, `syncTargets.ts`), constants, the `<video>` adapter (`videoMedia.ts`) and the test fakes (`playbackFakes.ts`) |
| `stage/` | `RaceStage`, `TileOverlay`, `PovSwitcher`, `DeltaChips`, `PairMenu`, `TeamLabel`, and the hooks for playback, measuring, fullscreen, overlay idle, swipes and the stage environment |
| `transport/` | `TransportBar`, `DeltaLanes` (solo and team lanes), `CueTicks`, `useCueSync` |
| `drawer/` | `RunsDrawer` (roster), `AddRuns` / `TeamAddRuns`, `rosterRows`, `offsetNudge`, the leaderboard reads (`mapRuns`, `teamMapRuns`) and the row video pool (`rowVideos`) |
| `keyboard/` | the key map (`shortcuts.ts`), `useCompareShortcuts`, `ShortcutSheetModal` |
| `analysis/` | the lazy below-the-fold chunks `RunAnalysis` and `TeamAnalysis`, their charts and tables, `useAfterPaint` |
| `runCompare.css`, `analysis/analysis.css` | every page rule, shipped in the page's own CSS chunks |
| `app/components/shared/CompareLink.tsx` | the link every entry point renders |

## The page

- **Route.** View `run-compare`, path `/compare`, lazy in `Main.tsx` and keyed by the entry id.
  Its route-contract entry is `{ "path": "/compare", "view": "run-compare", "kind": "compare" }`.
  Default tab title "Compare Runs"; once runs load, the title is the comparison label (below).
- **Flow.** Parse the `compare` nav param, start the video reads and the run reads, compose the
  model, then (once loaded) replace the address with the normalised query. The model is pure:
  components only render it (`composeCompareModel` takes the decoded state, the loaded runs,
  videos, comparisons, team reads, the stage box, the device environment and the transient
  choices below).
- **Layout.** A theater sized to the shell's visible height (`useTheaterHeight`, 320 px
  minimum): the stage area (the stage plus the drawer overlaying it) and the transport bar.
  Below it, the analysis. With no tile, the stage is not rendered and the transport sits under
  the header. "No runs to compare" shows when nothing survives.
- **Notice line.** Anything dropped on parse or after load produces one `role="status"` line
  grouping drops by kind, for example "Dropped 1 malformed run id, 1 repeated run and 1
  invalid start time." It survives the first replace in nav state `compare.notice`; any edit
  clears it.
- **Title.** One run: `<alias> on <map>`; two: `<a> vs <b> on <map>`; three or more:
  `<a>, <b> and N more on <map>`, from the first two in add order, plus ` — UTBT.net`. A team
  run's label joins its member aliases with `" & "`. The map goes through `displayMapName`. The
  link preview uses the same label but orders runs fastest first.
- **Sharing.** The address is the share link: it holds the whole set. The page has no Share
  control of its own, and the playhead is never written to the address (only an arriving `t`
  is read).
- **Nav state** (`useNavState`, so Back to the page restores it): `compare.notice`,
  `compare.seekSeconds`, `compare.drawerOpen`, `compare.audioFrom`, `compare.focus` (a cap id
  or a team cap id), `compare.pov`, `compare.speedRun`, `compare.matrixRun`,
  `compare.speedZoom`, `compare.splitsTeam`.

## URL grammar and normalisation

```
/compare
  ?runs=<id>,...                        solo: cap ids · team map: team cap ids (≤ 10, ≤ 4 team runs)
  &ref=<id>,...                         pinned references: ≤ 1 per side (solo) or 1 team cap id (team)
  &data=<capId>,...                     runs or member POVs switched to data-only
  &off=<capId>:<ms>,...                 offsets for videos that aren't from UTRecorder
  &pair=<runnerCapId>:<referenceCapId>,...   team pairing overrides (member cap ids)
  &drive=<runnerCapId>                  team sync-by-position driving pair (runner member cap id)
  &sync=position                        omitted = race
  &t=<seconds, 3 decimals>              seeds the playhead once, page opens paused there
```

- **One codec** (`url/compareUrl.ts`). `serializeCompareQuery` writes the parameters in that
  order, omits empty ones, writes `sync` only for `position` and `t` with three decimals, and
  leaves `,` and `:` unescaped. List order is add order.
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
- **References, one per side** (`referenceModel.ts`). Each side's reference is its pin in `ref`,
  else its fastest run (ties: first in add order). The lead side is the side of the fastest run
  with a known side; a run of unknown side counts on the lead side. Every run is measured
  against its own side's reference; the other side's reference is measured against the lead
  reference on final time only. Removing a pinned run falls back to the fastest on its side.
- **Rungs** (`laneModel.ts`), first match wins:

  | Rung | Badge | When | Gives |
  |---|---|---|---|
  | 1 | `Replay` | an `aligned`, drawable pairwise comparison with the side reference | the delta curve and bands, live Δ, sector splits and cues, sync by position |
  | 2 | `Zones` | a `routes_differ` comparison, or no comparison but shared zones | zone steps, zone cues |
  | 3 | `Time only` | another side than its partner, or nothing shared | the final gap at the cap only |

  A side reference's own rung comes from its own data (ghost → `Replay`, zones → `Zones`).
  While a comparison is pending the lane has no rung badge yet. Runs not on the lead side add
  `Set on Red` / `Set on Blue`; the UI never says "other side". No delta is ever drawn across
  sides.
- **Video badges.** A run without a tile is a data-only lane at its data rung: `No video` (no
  video, switched off, or past the eighth tile) or `Video unavailable` (the element failed).
  Videos not from UTRecorder add `Not frame-synced`. A run that can't follow position in sync
  by position adds `Race clock`.
- **Failure is a lower rung.** A failed pairwise read drops the run to `Zones` or `Time only`; a
  failed video read or element error drops it to a data-only lane. Nothing blocks playback.

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
- **Grid** (`packStage`): every column count is tried and the one giving the largest 16:9 tile
  wins (4 px gap), centred.
- **Focus** (`packFocus`, nav state `compare.focus`): a tile click focuses it, a second click
  or `0` returns to the grid. The focused tile takes the stage and the others form a strip along
  the short side (right on a wide stage, bottom on a tall one, at most a fifth of the long side).
  A focus moves the audio to that tile.
- **Phone and tablet** (`phoneStage.ts`, touch only, from the layout viewport): phone portrait
  (under 640 px wide) shows one tile; phone landscape (under 1024 px) one tile, or two side by
  side when there are exactly two; tablet portrait stacks two. A touch screen in landscape from
  1024 px keeps the grid. Outside the grid, Focus is off.
- **Freeze at cap.** A finished run's tile freezes on its cap frame, dims, and shows
  `CAP 1:23.456 · +0.512 · 2nd`: its time, its gap to its partner, its finish position among the
  runs on its side.
- **Stage fullscreen.** The Fullscreen API on the theater (stage and transport), feature-detected,
  offered only when a video tile exists. Popovers portalled to `document.body` (the offset menu)
  don't show inside fullscreen; the shortcut sheet renders inside the theater so it does.

## Tile overlay and audio

- **Overlay** (`overlayModel.ts`, `TileOverlay.tsx`): top left the team colour bar and role index
  on team maps, `PlayerInfo`, the final time, `REF` on side references and the badges; top right
  the live Δ (green ahead, red behind) and, during playback, a 1 s flash of the sector Δ at each
  sector end (the zone label on zone lanes). No live Δ on references, pending lanes, or time-only
  lanes before the cap. Actions: Audio, Pin, Remove, and Paired With on team tiles. Below 22 rem
  wide a tile hides its non-`REF` badges and time (lanes and roster keep them).
- **Auto-hide**: after 2 s idle during playback only (`OVERLAY_IDLE_MS`); any pointer move, tap
  or key in the window brings it back. The result line never hides. Every overlay number also
  exists in the lanes or the analysis.
- **Audio**: every video starts muted. One "audio from" run (nav state `compare.audioFrom`),
  radio-style; choosing it again mutes all. The volume is the replay modal's persisted volume.
  When the audible run loses its tile everything is muted; on a phone, audio chosen for a run
  outside the view brings that run into view.

## Transport bar

Play/Pause, Previous/Next frame, Back/Forward 5 seconds and Shortcuts (pointer devices only),
the rate (a native select, or a `1×` menu on phones), the clock, Previous cue, the Cue menu, Next
cue, Sync by position, Fullscreen and Runs. A "Buffering:" note names each stalled run.

- **Timeline and lanes share one x axis** (the run's own time over the slowest cap). Each run has
  a lane: label (`PlayerInfo`, time, `REF`, badges) and an SVG plot with bands, the delta curve or
  zone steps, and a cap marker in the final gap's tone; y is the lane's own range. A mouse or pen
  scrubs from pointer-down; a touch arms the gesture, scrubs after a sideways move past 8 px, and
  seeks on a tap, so a vertical swipe still scrolls the page.
- **Cue ticks**: `Sectors` (S1–S10 at the lead reference's sector starts) above the timeline and
  `Zones` below it, once a run on that side is on `Zones`. Ticks are buttons on pointer devices
  and marks on touch, where the Cue menu and Previous/Next cue do the cueing.
- **Team lanes**: with two or more team runs, one lane per team run drawn from the team splits
  (steps, crossing marks), else one lane per member POV with its zone crossings marked.

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
- **Drift.** A video more than one frame off its target (one frame of its own fps, 30 when
  unknown) is re-seeked. Explicit seeks re-seek anything more than 1 ms off.
- **Freeze.** A video stops at its cap time plus its offset, or at its media end.
- **Errors** never throw: the run is listed in `errored` and keeps its run time as a data-only
  run. Hidden videos are paused and re-seeked when revealed.
- **Transport.** A frame step pauses first and uses the lowest fps among visible runs. `J`/`L`
  skip 5 s and keep playing. Rates are 0.25×–2×. Play at the end restarts from 0.
- **State** (`getState`/`subscribe`): `playing`, `t`, `end`, `rate`, `stalled`, `frozen`,
  `errored`, `runTimes` (each run's own time at `t`) and `cue`. Readouts select from it with
  `usePlaybackSelector`, so only the clock and timeline re-render every frame.

The constants (`playbackConstants.ts`): one-frame drift, 0.25 s position re-seek, position rate
½–2× the global rate with a 1 s catch-up, fallback fps 30, 5 s skip, rates 0.25–2.

**Modes:**

- **Race** (default): every group on `f(t) = t`.
- **Sector cue** (always available): a cue moves every run to its own entry into that sector or
  zone and plays from there. Cues resolve per side: each side's reference at its own sector start,
  its `Replay` runs at their own crossing from the comparison, `Zones` runs at their first
  crossing of that zone; anything else keeps Race. The playhead lands at the lead reference's
  time. The cue is a layer over the base targets: a seek, scrub, skip, mode change or a change of
  reference clears it; a frame step keeps it. It is never stored.
- **Sync by position** (`sync=position`): each `Replay` run follows its side reference's position
  (`f(t) = t + delta(t)` from the comparison, along the connector inside a band). The video's rate
  tracks the slope, clamped to ½–2× the global rate; a gap over 0.25 s re-seeks. Every other
  non-reference run stays on Race and is marked `Race clock`.

## Runs drawer

`RunsDrawer` is a non-modal panel over the stage, opened by Runs (nav state `compare.drawerOpen`;
a one-run solo set opens with it). It goes through `useModalBehaviour` without a scroll lock, so
it takes an overlay history entry: Back closes it first. Escape closes it. On touch it is fixed to
the right edge, and on a phone in portrait it is a bottom sheet (60 % high, swipe down on its
header to close).

- **Roster**: one row per run with `PlayerInfo`, time, `REF`, badges and Pin (toggles), Video,
  Audio, an Offset menu (±100 ms, ±1 frame, Reset; only for videos not from UTRecorder) and
  Remove. On team maps each team run is a group (Pin, Remove) with member rows (POV, Audio,
  Offset, Paired With, Drives Sync).
- **Edits** (`setEdits.ts`: `add`, `remove`, `pin`, `unpin`, `video`, `offset`, `sync`, `pair`,
  `drive`) return the next query or a blocked reason, shown in the drawer's live note: at most 10
  runs, at most 4 team runs, at most 8 videos, and a comparison needs one run.
- **Add Runs** (solo maps): the map's solo leaderboard without disallowed caps. Quick Add chips
  (WR, Your PB when signed in, Next faster, Next slower, Top 3; Top 3 is all or nothing), a Search Players
  box, filters (Has video, Has replay, Team Colour), the reference pinned at the top, 25 rows per
  Show More. Row badges: `Video` / `No video` (read lazily, three at a time, visible rows first),
  `Replay` or `Zones`, `Set on Red` / `Set on Blue`, `In comparison`. A run past the eighth video
  joins data-only with a note. The leaderboard is cached per map for 5 minutes once read whole.
- **Add Team Runs** (team maps): the same controls over the team leaderboard; each row lists its
  members with their badges, and search and filters match any member.

## Keyboard

One window listener (`useCompareShortcuts`), ignored while typing, in menus and under a modal.
Space play/pause, ←/→ one frame, `J`/`L` 5 s, `1`–`8` focus a tile, `0` the grid, `Shift`+`1`–`4`
focus a team row, `[`/`]` previous/next cue, `F` fullscreen, `R` pin the focused run, `M` cycle
the audio, `?` the shortcut sheet. Number keys also read the physical digit row, AltGr character
keys count as plain, and Alt/Ctrl combinations are left to the app. Every shortcut has a visible
control.

## Analysis below the fold

The analysis is a lazy chunk loaded two frames after the page has loaded (`useAfterPaint`), and
the scroll restore waits for it. Its rows and charts seek or cue the playhead. Identities render
through an inert `PlayerInfo` (`RunIdentity`).

- **Solo** (`RunAnalysis`, `analysisModel.ts`): **Cumulative Δ** (one line per `Replay` or `Zones`
  run against its reference, with bands; time-only runs are left out), the **Sector Matrix** (S1–S10,
  zone rows and a Cap row, one column per run with split and Δ, the best split per side marked;
  a run picker on narrow widths, nav state `compare.matrixRun`) and **Speed** for one chosen run
  (nav state `compare.speedRun`, which outlines its tile; zoom in `compare.speedZoom`). On touch the
  speed plot's sector labels hide and its table rows zoom.
- **Teams** (`TeamAnalysis`, `teamAnalysisModel.ts`): the **Team Splits** table first (one column
  per team run: time, Δ, the first member across, and on Cap the last; nav state
  `compare.splitsTeam` picks the column on narrow widths), then one section per `aligned` or
  `zones` pair rendered by the solo panels, then **Different Route** cards (spawn, the zones both
  members crossed, the cap). A single team run has no analysis.

## Team mode

On a team map each item in `runs` is a whole team run that expands into its members' POVs.

- **The team compare read** (`fetchTeamComparison`, [api.md](../api.md#team-comparison)) answers
  for each non-reference team run against the reference team run: both rosters, the server's
  member pairs with their state (`aligned`, `routes_differ`, `zones`), unpaired members, every
  same-side candidate with its score, the team zone splits and the final Δ. Pairs and candidates
  only ever join members on the same side. Any non-200 means that team run compares on final time
  only.
- **Reference.** One reference team run: the first team cap id in `ref`, else the fastest. `REF`
  sits on its row header and roster row. There are no per-side references in team mode.
- **Clock groups.** Each team run is one clock group: its POVs never desync. Cues move each team
  to its own team crossing of the zone (from the team splits once a read answers, else the members'
  first crossings). There are no S1–S10 cues on team sets.
- **One team run** (Watch team run): one row of member tiles with a header (colour bar, label, team
  time), member lanes with each member's zone crossings and cap marked, and no member-vs-member
  delta. The drawer stays closed.
- **Team vs team**: rows are team runs and columns are pairs, by the reference team's paired
  members in its finish order; unpaired members sit at the row end. A third or fourth team run whose
  read hasn't answered keeps finish order inside the existing columns. The grid transposes (teams
  as columns) when that gives a larger tile. Each tile carries its team colour and its column as a
  role index, so counterparts share an index. The row header shows the live team Δ from the team
  lane. Tile Δ per pair: `aligned` → the pairwise curve against the partner; `zones` → the zone
  delta; `routes_differ` → `Zones` plus `Different route`, stepping only at the shared anchors;
  unpaired or a failed read → `Time only`.
- **Pairing override** (Paired With, on team tiles and member rows once the team read answered):
  options are the other team's members on the same side with their `route match NN %` or
  `zone match NN %`. Choosing one forms the pair and swaps the two displaced members when they
  share a side, else leaves them unpaired. `pair` then holds that team run's whole pairing;
  choosing back the server's pairing drops it. An override pair reads the pairwise comparison
  when both have a ghost.
- **Driving pair.** In sync by position the other team's whole clock follows one `aligned`,
  drawable pair (default: the highest score). Drives Sync in the roster stores it in `drive`;
  pinning another team run clears it. A team run with no driving pair is marked `Race clock`.
- **Limits**: 4 team runs, 8 video POVs (the rest data-only); POV hides a member (`data`), and Pin
  and Remove act on the whole team run.

## Entry points

Every entry point is a `CompareLink` (`shared/CompareLink.tsx`): a `NavLink` with a real
`/compare?runs=…` href, so a click pushes one entry and one Back returns to the source page.

- **Cap Detail → Compare**: this cap plus the default compare candidate (nearest faster run with a
  ghost, the checkpoint card's rule); alone when there is none, which opens the drawer.
- **Checkpoint card → Watch Side by Side**: this cap and the card's selected target.
- **Team Cap Detail → Watch Team Run** (this team run alone) and **Compare** (plus the next faster
  team run in the rank window, or the next slower on the world record).
- **Map Detail leaderboard**: row checkboxes and a floating **Compare (n)** button
  ([records.md](records.md#map-detail)).
- **Watch modal → Compare**: the watched run, or its team run for a team member's cap.

Disallowed runs, and team runs without a team time, disable their links.

## Mobile

The page is in the mobile route manifest (`e2e/mobile/manifest/run-compare.ts`) with the `runs`
drawer sheet modal and the `pov` (eight runs) and `teams` sub-views
([mobile-routes.md](../mobile-routes.md)). On a phone only the visible tiles stream: a hidden tile
drops its `src` and reloads empty, and a revealed one is seeked to the master clock. The POV
switcher (`PovSwitcher`, a `Point of View` group of 44 px chips, grouped per team run) and a
horizontal swipe on the stage switch the tile; the other runs' live Δ ride on the visible tile as
chips (`DeltaChips`).

## Tests

| Part | Covered by |
|---|---|
| URL codec | `url/compareUrl.test.ts` |
| View model (rungs, references, lanes, cues, overlays, focus, phone views, edits, add runs, analysis, team rows, pairing, overrides) | `model/*.test.ts` through `composeCompareModel` and the `runCompare` fixtures; `model/teamTestRuns.ts` builds team inputs |
| Playback controller and targets | `playback/playbackController.test.ts`, `syncTargets.test.ts`, `teamClock.test.ts`, with the fake media and clock in `playback/playbackFakes.ts`; `videoMedia.test.ts` for the adapter |
| Loading | `loading/*.test.ts`; `drawer/rowVideos.test.ts`, `drawer/rosterRows.test.ts` |
| Keyboard | `keyboard/shortcuts.test.ts` |
| The page | `e2e/run-compare.spec.ts`: links and notices, race playback, lanes and rungs, the drawer, overlays and audio, adding runs, cues and sync by position, focus, fullscreen and keys, the solo analysis, team runs, team vs team, pairing override and driving pair |
| Phone and tablet | `e2e/run-compare-responsive.spec.ts` |
| Entry points | `e2e/video-compare.spec.ts`, `e2e/cap-compare-responsive.spec.ts`, `e2e/map-compare-selection.spec.ts` |
| Mobile crawl | `e2e/mobile/crawl.spec.ts` on the run-compare surfaces |
