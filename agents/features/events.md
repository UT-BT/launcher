# Events: brackets, stats, predictions, achievements

The client contract and UI rules for an event's competition: the bracket and its formats, match
results and the match editor, linking caps to played maps, the event stats (Teams tab and team page),
prediction markets and limited-time achievements. Read it before touching
`app/components/pages/events/` (outside `schedule/`, `pickban/` and `stream/`), `EventDetailPage.tsx` or
`EventTeamPage.tsx`.

Elsewhere: match scheduling, the Schedule tab and the attention badge are in
[event-scheduling.md](event-scheduling.md); the pick/ban contract in [pick-ban-api.md](pick-ban-api.md)
and its UI in [pick-ban-ui.md](pick-ban-ui.md); the Stream tab in [stream-kit.md](stream-kit.md).

## Where the code lives

Paths starting `events/` are under `app/components/pages/`. The folder holds about 210 files; this doc
owns all of it except `schedule/`, `pickban/`, `manage/pickban/` and `stream/` (the docs above). Pure
`.ts` view-models sit beside their components with a `.test.ts` each: put new logic there.

| Path | Holds |
|---|---|
| `app/components/pages/EventDetailPage.tsx` | the event page: tab set and gates, the page-owned reads (event, bracket, `me` poll, predictions, schedule, pick/ban config) handed to tabs as props or context |
| `app/components/pages/EventTeamPage.tsx` | the `event-team` detail page (lazy) |
| `events/` (files) | panels outside a tab folder: Signup, Looking for Partner, the roster context (`TeamRoster.tsx`), the to-do panel, `ManagePanel.tsx` (the Manage sub-tabs); `eventsShared.tsx` status, date and Schedule-tab rules |
| `events/bracket/` | Bracket tab and the group, Swiss and elimination stage views; `bracketShared.tsx` holds `MatchCard` and the pure series, window and feeder helpers |
| `events/manage/` | Manage panels (signups, format builder, seeding, bracket, match editor, cap-link picker, predictions); pure `formatFields.tsx`, `matchEditorForm.ts`, `capLinkRuns.ts` |
| `events/manage/matches/` | Manage → Matches and Caps need linking (lazy); pure `matchesTable.ts`, `capsNeedLinkingView.ts` |
| `events/stats/` | the Teams tab's stats mode (`StatsOverview`, lazy) and its pieces; pure `statsView.ts`, `statsTab.ts`; the accent and lazy stylesheets |
| `events/stats/team/` | the team page's pieces; pure `teamPageView.ts`, `teamTablesView.ts` |
| `events/predictions/` | Predictions tab, bet modal, odds context; pure `marketLock.ts`, `leaderboardView.ts`, `predictionsShared.tsx` |
| `events/achievements/`, `events/maps/` | the lazy Achievements tab (`eventAchievementBoard.ts`) and the Maps tab (`mapsShared.ts`, also its gate); achievement rules app-wide in `app/components/pages/achievements/eventAchievements.ts` |
| `app/utils/api.ts`, `app/utils/fixtures/eventStats/` | event fetchers and types; the sha-pinned stats payloads |
| `e2e/` | `event-stats-responsive`, `event-achievements-responsive`, `predictions-responsive`, `manage-matches` specs |

## Brackets and formats

An event's competition is a **format**: an ordered list of stages, each with a `kind` the server can draw
(`groups`, `swiss`, `single_elim`; round-robin is `groups` with one group). The launcher renders whatever
`fetchEventBracket` returns and **never computes standings, pairings or match winners**: those are
server-side.

- `fetchEventBracket(token, slug)` → `EventBracket` `{ published, format: { template, spec }, stages[] }`.
  Each stage carries `groups[]` (with computed `standings`), `entrants[]`, `matches[]` (each with `maps[]`)
  and `expected_match_duration_minutes` (manager override or `null`; the scheduler's use of it is in
  [event-scheduling.md](event-scheduling.md)).
- **`published` is the whole-surface gate.** Until a manager publishes, a player gets no stages, standings
  or format, so the Bracket tab stays hidden (`EventDetailPage` hides it while the payload has no stages).
  Managers always get the full payload, which is why `BracketTab` treats "unpublished but I can see
  stages" as proof the viewer manages the event and shows its warning banner. Per-stage `published` is the
  finer control inside a published bracket.
- Attaching a format to an event **copies** it: editing a shared template never reshapes a running event.
- Format validation answers one 400 whose message lists every problem as `field.path: reason` joined
  with `; `. `parseSpecErrors` (`manage/formatFields.tsx`) splits it so `FormatBuilder` shows each error
  on its own control.

### Match card

`MatchCard` (`bracket/bracketShared.tsx`) is the one bracket match renderer.

- **Time.** A booked `scheduled_at` renders through `formatSlotTime` in `useDisplayTimezone()`. Every
  `EventMatch` carries `resolved_window: { opens_at, closes_at }` (computed server-side from the
  match/stage/event dates; a spectator only ever sees a booked time or this window, never who proposed
  what). For a `pending` match with both teams decided the card shows `schedulingWindowState` (client math
  against `now`) as a chip: "Opens <date>", "Awaiting a time" or "Scheduling window closed".
- **Own next match.** `EventDetailPage` shows a countdown to the viewer's soonest future `scheduled` match
  (`nextOwnMatch` in `bracketShared.tsx`, `useNow` / `formatCountdown` from
  `predictions/predictionsShared.tsx`).
- **Odds.** `MatchOddsChip` reads the market from `PredictionOddsProvider` (see [Predictions](#predictions)).
- **Linked caps.** Per-map cap links come back only from `fetchEventMatch`, never the bracket list. A card
  given a match payload with `showCaps` lists them (`CapList`), grouped by `linkedCapRows` (see
  [Linking caps](#linking-caps-to-a-played-map)): a run row shows the side chip, both players as
  `PlayerInfo` and the team time as a `CapTimeLink` through `teamCapId`; a lone cap stays a per-cap row.
- **Pick/ban map label.** `pickBanMapLabel(row, teamA, teamB)` reads the map row's `picked_by` / `kind`
  into "Picked by <team>" or "Decider" next to the map name.

### Pick/ban entry points on match surfaces

Every `EventMatch` carries `pick_ban_status`: `'none' | 'lobby' | 'running' | 'paused' | 'complete'`, the
match's **current** session only (cancelled, voided or no session all read `'none'`). It lets a match offer
a way into a session without a direct link.

- `pickBanAction(status, isRostered)` (`events/pickban/pickBanEntryPoints.ts`, pure) is the one mapping
  and holds the one list of open statuses (`lobby`, `running`, `paused`): open → `'join'` for a viewer
  rostered on either side, `'live'` for everyone else; `complete` → `'view'`; `none` → `null`. Derive
  every match entry point from it.
- `pickBanCardAffordance` is `pickBanAction` without `'view'`: the bracket card offers a way in only while
  the session is open, as a pill ("Join" / "Picks & Bans are live!"). The pill renders only when the card
  gets `eventSlug` (and `myTeamId` for the rostered check); every stage view and `BracketTab` thread both
  down like `onMapSelect`, so callers without them (Manage → Bracket editor) show no pill.
- `PickBanLink` (`events/pickban/components/PickBanLink.tsx`) is the one `NavLink` to `match-pickban`.
  `NavLink` stops propagation by default, so it never also fires an enclosing card's `onClick` (the card's
  own click opens the scheduler). Build any new entry point on it.
- `PickBanJoinBanner` ("Picks & Bans against <opponent> are live now.", with `LiveDot`) shows on a My
  Matches card whose session is open; the event page's own session is a row of the "Needs your attention"
  panel instead ([event-scheduling.md](event-scheduling.md)).
- The event `me` payload (`MyEventStatus`) carries `pick_ban_session: { match_id, status } | null`: the
  caller's own active team's open session, `null` once there is none, it completes or it is cancelled.
  `EventDetailPage` polls `fetchMyEventStatus` every 30 s with a `createPoller` (signed in only), so a
  captain gets the lobby row within half a minute; a failed poll keeps the last good value. The same
  payload carries `is_streamer` (missing reads as `false`).
- CSS budget: the card pill has no animation; only the Join banner and the to-do panel's lobby row carry
  the pinging `LiveDot`, and only while a session is open.

## Results, draws and series

A match result is authored as its **map rows**: `caps_a` / `caps_b` per map decide the map, map wins decide
the match.

- `setEventMatchResult` (`PUT .../admin/matches/<id>/result`) treats the submitted `maps` as the whole
  truth: ordinals it omits are deleted. Optional `deaths_a` / `deaths_b` feed the deaths tiebreaker.
- A map is won by whoever reaches `caps_to_win`; caps are bounded to `0..caps_to_win` on both sides.
- A map the time limit ended short of the target is a **drawn map**: played, won by nobody.
  `winner_side` on the map row overrides the caps: `a` / `b` awards it, `draw` records a draw even with no
  caps. The editor's "Won by" select offers all three.
- `complete` and `forfeit` are **derived** from the result, never set: the match editor offers only the
  statuses an admin owns (`pending`, `scheduled`, `live`, `bye`, `cancelled`).
- Series settlement depends on `mode`:
  - `first_to`: a race, complete the moment one side's lead in map wins exceeds the maps left; later maps
    are dead rubbers. `best_of` may be even ("first to three of four").
  - `all_maps`: every map is played and the higher map count wins.
- Length counts maps **played** (`mapWasContested`: any caps or a named `winner_side`), not maps won, so a
  four-map race can settle 2-0 after three maps and never reaches 4-0. `mapIsDrawn` marks a drawn map
  (labelled "Draw").
- A level series is a result only where the stage allows draws: `seriesProgress` takes `drawsAllowed`, and
  callers pass `stage.kind === 'groups'`. The server rejects a `swiss` or `single_elim` stage that allows
  draws. A stage can override the whole match format (a four-map group stage with draws, Best of 3
  knockouts).
- `mapWinnerOf` and `seriesProgress` (`bracketShared.tsx`) mirror the server so the editor can say what a
  result still needs.
- Group points are a **scoreline table**, `EventPointsRow[]` of `{ maps_won, maps_lost, points }`, each
  team reading its own line (a draw pays both the same; a 4-0 can outscore a 3-1). Standings carry
  `wins` / `draws` / `losses`. `scorelinesFor`, `defaultPointsTable`, `syncPointsTable` and
  `withSyncedPoints` (`formatFields.tsx`) mirror the server so the builder offers exactly the scorelines a
  series can produce and keeps the table in step after series length or mode changes.

### Match editor: bracket slots and the Red side

The editor's team selects are "Bracket slot 1" / "Bracket slot 2" (`team_a_id` / `team_b_id`). Any change
to them, order included, voids the match's prediction market and refunds every bet, so when slots differ
from the saved match and its market is not voided the editor warns before saving (`showsSlotWarning`).

Colours are set by the separate **Red side** select (Not set, or either slot's team). It starts from
`red_team_id`, shows `red_side_source` (Step 0, Admin, Caster, Backfill) while unchanged, resets to Not set
when its team leaves the slots, and survives a swap of the same two teams. The server clears the side on a
PATCH that changes the team set unless the PATCH carries `red_team_id`, so the editor resends the Red side
it still shows. `planSave` (`manage/matchEditorForm.ts`) decides what Save sends:

| Changed | `PATCH .../admin/matches/<id>` (`updateEventMatch`) | `PUT .../result` (`setEventMatchResult`) |
|---|---|---|
| Red side only | `{ red_team_id }` (null for Not set) | not sent |
| Form fields (slots included) | every form field, plus `red_team_id` if the Red side changed or is kept across a new team set | not sent |
| Result section only (maps, or a forfeit button) | not sent | the map rows and `forfeit_winner` |
| Slots and result section | refused client-side: "Save the bracket slots first, then edit results" | not sent |
| Nothing | "No changes to save." | not sent |

**The Red side is locked while pick/ban runs** (`redSideLocked`: status `running` or `paused`): read-only
with the hint "Pick & ban is running. Change sides with Undo, Restart or Swap in the pick/ban dock.", and
Save never sends `red_team_id`. If the status was stale and the API answers reason `side_locked`
(`MATCH_EDITOR_SIDE_ERROR_CODES`), `matchEditorErrorMessage` shows the same sentence and the editor
re-reads the match.

### Drawing a stage early

A fed stage is seeded from its feeders' standings, which exist from the moment a group stage is drawn, so
the server allows an early draw (it refuses only when feeders produced nobody). The launcher guards it:
`unfinishedFeeders` (`bracketShared.tsx`) reads the format's `advancement` rules against live stage
statuses, `BracketPanel` shows an amber line on a stage with unfinished feeders, and Draw / Redraw confirm
first. Preview draw is never gated.

## Linking caps to a played map

Linking attaches the real caps behind a played map and gives the public view per-cap times. It is a
convenience, never a requirement for a result.

- `fetchEventCapCandidates(token, slug, matchId, { map?, from?, to? })` →
  `GET /tournaments/<slug>/admin/matches/<matchId>/cap-candidates` → `{ items }` of **grouped team runs**,
  oldest first. Each `EventCapCandidate` is `{ team_run_id | null, side | null, map | null, complete,
  completed_at | null, members[] }`; members carry the per-cap fields (`cap_id`, `user`, `alias`, `side`,
  `cap_time_seconds`, `added`, `verified`). A cap with no team run is a one-member entry. A run with
  `complete: false` has no `completed_at` and does not count toward the score. `map` matches every name
  the map has had.
- `linkEventMatchMapCaps(token, slug, matchId, ordinal, caps, keepCounts = false)` →
  `PUT .../admin/matches/<matchId>/maps/<ordinal>/caps` with `{ caps, keep_counts }`. With `false` the
  map's counts are filled in from the linked runs; with `true` the recorded score stays.
- A link entry on the match payload (`EventMatchCapLink`) has `cap_id`, `side`, `user`, `alias`, `map`,
  `cap_time_seconds`, `added`, and optionally `source` (`'auto' | 'admin'`), `team_run_id`, `team_cap_id`,
  `team_time_seconds` (null for a lone cap), `has_ghost`, `has_demo`. Its `map` is the cap's stored name:
  label maps from the match's map row instead.
- `manage/capLinkRuns.ts` (pure): `candidateKey` keys a candidate by `team_run_id`, falling back to its
  first member's `cap_id`; `defaultPicks` pre-picks complete candidates that have a side; incomplete runs
  can't be picked; `linkedCaps` sends every member of a picked run as its own `{ cap_id, side }`;
  `linkedCapRows` groups link entries by side + `team_run_id` into run rows in link order.
- `CapLinkPicker` takes optional `initialMap` / `initialFrom` / `initialTo`; `capLinkSearchStart` falls
  each back to the map row's `map` / `started_at` / `ended_at`. It does not search on open: the admin
  presses "Find caps". `keepsScore` only relabels the save button ("Link runs" instead of "Link and fill
  counts") and the tally ("Runs picked a – b"); the caller's `onLink` decides what is sent. The match
  editor links with `keepCounts: false`.

### Caps need linking (Manage → Matches)

`fetchEventCapReview(token, slug, stage?)` → `GET /tournaments/<slug>/admin/caps/review` (managers) →
`EventCapReviewItem[]`: played maps of finished matches whose linked runs don't cover the recorded score.
An item is `{ match_id, stage_key, round_label, team_a: {id, name}, team_b: {id, name}, ordinal, map,
display_name, expected: {a, b}, linked: {a, b}, reason, detail, window }`; `map` is the newest name;
`reason` is one of `EVENT_CAP_FLAG_REASONS` (`no_runs`, `too_few_runs`, `mixed_servers`,
`same_second_decider`, `run_used_elsewhere`, `no_window`); `detail` is `{ side, found, expected }` for
`too_few_runs`, else null; `window` is `{ from, to }` or null.

`manage/matches/capsNeedLinkingView.ts` (pure) holds the logic:

- `reviewReason(item, colors)`: the plain-words reason, naming the colour ("Only 1 of 2 Red runs found")
  or the team when the match has no Red side.
- `reviewPrefill(item)`: `{ map, from, to }` from the window (`to` rounded up to the whole minute, since
  the picker's inputs hold minutes), or `{}` with no window.
- `capsNeedLinkingRows(items, redTeamIds)`: the rows; a side's colour comes from the bracket match's
  `red_team_id`, never from the side letter.
- `linkReviewRuns(...)` links with `keepCounts: true`, so linking from the list keeps the recorded score
  even with fewer runs linked; such a map stays in the list.

`manage/matches/CapsNeedLinking.tsx` sits in `MatchesPanel` between the header and the filters: the amber
"Caps need linking (n)" list, nothing when empty or when the read fails, ignoring the stage filter. It
refetches on mount and whenever its `bracket` prop changes. A row opens a `ui/modal` (`offsetSidebar`)
inside the Manage tab (no navigation) that fetches the match, finds the map row by `ordinal` and renders
`CapLinkPicker` with the prefill and `keepsScore`. Linking closes the modal, reloads the list and
refreshes the bracket.

## Event stats

### Reads

Two public reads drive the Teams tab and the team page. Both take the browse token (`''` signed out) and
an optional stage key (missing or null = every stage). The launcher **computes none of the figures**: it
sorts, labels and lays out what comes back.

- **`fetchEventStats(token, slug, stage?)`** → `GET /tournaments/<slug>/stats?stage=<key>` → `EventStats`
  `{ published, stage, stages[], teams[], maps[], records }`.
  - `published: false` when the viewer can't see the bracket: `stages`, `teams`, `maps` empty, every
    `records` entry null.
  - `stages`: `{ key, name, kind, status }`, the stage chips.
  - Each team: `id`, `name`, `status`, `seed` (null unseeded), `members[]`, `standing` (`alive |
    eliminated | champion | withdrawn | disqualified`), `furthest_stage`, `path[]`, `record` (`matches`,
    `maps`, `caps`), `form` (last five, oldest first), `comebacks`, `records_held`.
  - Each map: one row per map, **always under its newest name** (`map`, `display_name` for the label),
    with `played`, `picks`, `bans`, `first_bans`, `deciders`, picker wins / games / rate, and `fastest_run`
    with its `team_id`.
  - `records`: seven headlines (most picked, most banned, banned first, picker, fewest caps conceded,
    biggest upset, most comebacks), each null when its scope has no data.
  - A run (`EventRun`): `{ team_run_id, team_cap_id, team_time_seconds, completed_at, server, members[],
    has_ghost, has_demo }`; `server` may be null, user ids are strings, a lone cap is a one-member run
    with null `team_run_id` and `team_cap_id`.
- **`fetchEventTeamStats(token, slug, teamId, stage?)`** → `GET /tournaments/<slug>/teams/<teamId>/stats`
  → `EventTeamStats` `{ team, matches[], map_profile[], runs[] }`. `team` is the overview's entry. Each
  `map_profile` row has `best_run` and `best_rank` (`{ rank, of }` among every team with a run on the map,
  equal times sharing a rank; null with no run). Each match has stage, group, round, status (`complete |
  forfeit | live | scheduled`), opponent, `own_side` (red / blue, null until set), `score`, `result`,
  `pick_ban` and `maps[]` (`caps_for` / `caps_against`, `runs_for` / `runs_against`,
  `unrecorded_for` / `unrecorded_against` for caps with no linked run). Score, result, maps and pick/ban
  are empty unless the match is complete or a forfeit; `pick_ban` stays null until the session is fully
  revealed; a forfeit has a score and no maps. Pick/ban steps name the team, never the captain.
- **Not found.** An unknown team, or one with no published match, answers 404. `readTeamOrNotFound`
  (`events/stats/statsView.ts`) turns it into `null` ("This team has no published matches in this
  event."). A 404 from a **stage-scoped** read shows an empty stage (`emptyStageStats`,
  `team/teamPageView.ts`). Anything else is an error with "Try again".

**Fixtures.** `app/utils/fixtures/eventStats/` holds the payloads (overview all-stages / empty stage /
unpublished, team, team-not-found error, Caps-need-linking list, match detail with link entries), served
to tests by `eventStatsFixtures.ts`. A test pins their SHA-256, so a payload shape change must update the
fixtures and the pin together.

### Teams tab: roster or stats

The `teams` tab id and `?tab=teams` links serve both modes. `EventDetailPage`'s `TeamsTab` shows "Loading
teams…" until the bracket read settles, then the roster or the lazy `events/stats/StatsOverview.tsx`,
chosen by `statsMode(bracket)`: `stats` once the bracket payload's `published` is true, otherwise
`roster`. A manager who can see an unpublished bracket still gets the roster (the rule reads `published`,
not visibility).

- The overview fetches `fetchEventStats` through `useAsync` for the selected stage, refetches when the
  page reloads the bracket (`refreshKey`), and falls back to the roster if its own read says
  `published: false`. It renders stage chips, team cards, the **Cup at a glance** strip from `records` and
  the **Maps** table from `maps`.
- Per-entry state: `event.statsStage` (default `null` = All) and `event.statsSort` (default `standing`).
- Label (`statsTabView`, `events/stats/statsTab.ts`): "Teams" while roster or unsettled, "Stats" in stats
  mode, with an `aria-hidden` "New" pill until the viewer opens it once (`utbt:eventStatsSeen:v1`, blocked
  storage reads as not seen) and never after `STATS_TAB_NEW_UNTIL`.

### Team page

`EventTeamPage` (view `event-team`, `app/components/pages/EventTeamPage.tsx`) is a lazy detail page keyed
by `entry.id`, reading `eventSlug` and `eventTeamId` from params. No login needed; the web build deep-links
to it.

- **Route.** `/events/:eventSlug/teams/:eventTeamId` (also in `app/public/route-contract.json`).
  `pathToNav` resolves only exactly four segments. Title "Team — UTBT.net", then the team name via
  `useDocumentTitle`. `paramsEqual` compares `eventTeamId`. `eventSlugOfView` covers it, so the event's
  sidebar item stays active.
- **Back** goes to `event-detail` with `eventTab: 'teams'` (`onBackToTeams` from `Main.tsx`).
- **Links in.** Overview team cards, team names in Cup at a glance and the map table, and opponent names on
  a team page are `NavLink`s to `event-team` (real `<a href>` on web). Each match on the page links to
  `match-pickban`.
- **Reads.** One all-stages team read feeds the header (identity, path, standing, records, backdrop map);
  tiles, match timeline, map profile and runs follow the selected stage's read ("All" reuses the
  all-stages read). Stage chips and team colours come from one all-stages overview read; if it fails or is
  unpublished the chips hide and the page still works.
- **Per-entry state** (`useNavState`): `teamPage.stage` (default `null`), `teamMatches.toggles` (with no
  toggle the latest complete match is open), `teamRuns.sort` (default date ascending), `teamRuns.showAll`
  (phone: full list instead of the first 12). Separate from the overview's `event.statsStage`.

### View-model, colours and links

`events/stats/statsView.ts` (plus `team/teamPageView.ts`, `team/teamTablesView.ts`) is the pure
view-model between payloads and components: stage chips, team sorts, accent slots, form pips, path text,
team cards, rank text, tiles, run and map rows (desktop `responsive` columns and phone `compact` cells),
"Time not recorded" placeholders, live/upcoming match states. Put new logic there, unit-tested against the
fixtures; keep components thin.

- **Colours.** A team's accent slot is `(seed − 1) mod 12` (`accentSlots`); unseeded teams follow the
  highest seed, by name. The overview remembers its last All-stages team list, and the team page uses the
  overview's list plus missing opponents, so a team keeps its colour whatever the stage filter.
- **Links.** Run times go through `CapTimeLink` with the team cap id, falling back to the cap id for a lone
  cap. A replay icon links to the run page when `has_demo` or `has_ghost`.

### Components

`app/components/pages/events/stats/` has the reusable pieces; reach for them before writing a team, run or
stat row: `StageChips` / `team/TeamStageChips` (an `aria-pressed` group over `stageChips()`),
`TeamCardsGrid` + `TeamSortControl` + `TeamCard` (whole card is one `NavLink`), `OverviewTeamLink`,
`CupAtAGlance` (tiles from `cupAtAGlanceView(records, teams)`, a tile dropped when its record is null,
nothing links to a pick & ban), `MapStatsTable`, `team/teamShared.tsx` (`TeamPageContext` /
`useTeamPage()`, `TeamLink`, `TeamAvatars`, `ResultBadge`, `FormPips`, `StandingChip`, `SECTION_LABEL`),
`team/RunRow` + `UnrecordedRow` (each player's own cap time inline, region hidden on phones),
`team/TeamTable` (shared table scaffolding), `team/MatchTimeline` / `MatchCard` / `PickBanSteps` /
`MapRow`.

Rules: every player is a `PlayerInfo`, every run time a `CapTimeLink`, every navigation target a real
`NavLink`; tables are `DataTable` with `responsive` columns and `compactContent` phone rows from the
view-model (`mapTableView`, `mapProfileView`, `teamRunsView`), identifying columns required and the rest
dropping by priority.

### Stats styling

On top of the locked tokens in [styling.md](../styling.md):

- **Team accent palette.** `--team-accent-0` … `--team-accent-11`, defined on `:root` and under
  `:root[data-theme='light']` in `events/stats/teamAccents.css`. Use them through `teamAccentColor(slot)`
  / `teamAccentStyle(slot)` (`events/stats/teamAccent.ts`), never raw hex. Slot 11 is a low-chroma slate
  and the fallback for a team with no slot. `teamAccent.test.ts` parses the real CSS and fails if a slot
  leaves sRGB, drops under 4.5:1 against any theme's `--background` / `--card` (`app/styles/themes.css`),
  comes within 25° of the pick/ban Red, Blue or decider-gold hues, or within 15° of another chromatic
  slot: change a value only with it green. The team page imports an identical copy
  (`team/teamPageAccents.css`) and its own `teamAccentColor` in `team/teamPageView.ts`: change all of them
  together.
- **Functional colours, not accents,** for standing chips and form pips: Alive emerald, Eliminated muted,
  Champion brand red, Withdrawn / Disqualified amber; W emerald, D amber, L red. The cup-record badge is
  medal gold (`yellow`), never the decider gold. A match's Red / Blue tag uses the pick/ban tones via
  `sideColorTag` / `sideColorTone`.
- **Bespoke rules live in lazy stylesheets.** Tailwind puts every utility it finds into the one entry
  stylesheet, and the initial CSS budget (36 KiB gzip) has almost no headroom. A rule that needs
  `--team-accent` or a one-off template goes in a stats stylesheet imported by the lazy chunk:
  `teamCards.css` (grid, card glow, avatar ring), `overviewStats.css` (map-table bars, glance tiles, scrim,
  ring, container-query grid). Reuse existing utilities otherwise; a never-used utility can fail
  `npm run check:bundle`.
- **Cup at a glance.** No outer box, no footnotes: a number, a unit word and its subject. Map headlines are
  map-art cards (`card` screenshot under a dark scrim, white text in any theme, dark fallback colour); the
  picker rate is a conic-gradient ring; team headlines glow in the accent; the biggest upset spans two
  columns. Tiles go 4 across, 2 below a 56rem container, 1 below 18rem, packed densely.
- **Team page** uses viewport breakpoints (`sm` / `md` / `lg`), not container queries. Its header keeps one
  statically blurred backdrop; no per-tile blur. The shared `LiveDot` on a live match is its only infinite
  animation.

## Predictions

Coin-backed prediction markets, one per bracket match. Fetchers are the `…EventPrediction…` family in
`app/utils/api.ts`; UI in `app/components/pages/events/predictions/`.

- **The tab exists only when `EventDetail.predictions_enabled` is true**; otherwise no prediction request
  is made. Treat the flag as the whole answer; never probe an endpoint to second-guess it.
- **One fetch, two consumers.** `EventDetailPage` owns `fetchEventPredictions` and passes the result to
  `PredictionsTab` and `PredictionOddsProvider` (which feeds `MatchOddsChip` anywhere in the bracket). A
  new consumer reads the context; never add a second fetch.
- **Empty is a legitimate answer.** List, leaderboard and wallet fetchers use `apiGetOr` with a full
  fallback, because a disabled event, unclaimed wallet or empty leaderboard answer with no `data`.

### Market lifecycle

- **A market closes when its match's pick/ban starts, never on the clock.** The client market type has no
  close time. Countdowns run to kick-off (`kickoffOf`, the match's `scheduled_at`); an open market reads
  "Starts in … · closes at pick/ban", or "Closes at pick/ban" after kick-off or when unscheduled.
- **A started pick/ban locks bets even on stale market data.** The server moves a match to `live` and
  closes its market when pick/ban starts, and back to `scheduled` / `pending` on Restart or Cancel, but a
  market read can lag. `predictions/marketLock.ts` (pure) is the one rule: `matchLocksBets(match)` is true
  once a match is anything but `pending` / `scheduled`, or its `pick_ban_status` is `running`, `paused` or
  `complete` (an open lobby does not lock). `marketTakesPredictions(market, match?)` is an `open` market
  whose own `match` and the optional other read both leave bets open. `EventDetailPage` builds signals
  with `matchLockSignals` (bracket, then `/me/schedule`, then `/me/matches`, then the viewer's
  `pick_ban_session`, later reads winning) and passes both consumers `lockStartedMarkets(markets,
  signals)`: a locked open market shows as `closed` (card reads Closed under "Underway", no countdown or
  Predict, odds chip hidden). `MatchOddsChip` also checks its bracket match, `MarketCard` gates Predict on
  `marketTakesPredictions`, `ClosingSoonBanner` drops locked markets. When `newlyLockedMatchIds` finds a
  match that just locked (seen unlocked before; a first sighting never counts), the page refetches
  predictions once.
- **Markets sort by kick-off**, unscheduled last.
- **Insights and the homepage strip are separate reads.** `fetchEventPredictionInsights` loads lazily when
  a card expands. `fetchUpcomingPredictions` (`/me/predictions/upcoming`) backs
  `home/ClosingSoonBanner`: open markets whose match starts inside the window or started within the last
  hour (unscheduled never appear); it counts down to kick-off, reads "Starting" after, and renders `null`
  when empty.

### Outcomes, prices and payouts

- **Two outcomes or three, server-decided.** `market.draws_allowed`: a group match can finish level, so
  the draw is backable and `price_draw` is a number; a knockout answers `price_draw: null`. Use
  `sidesOf(market)` (`predictionsShared.tsx`), never a hard-coded `['a', 'b']`.
- `PredictionSide` (`'a' | 'draw' | 'b'`) is deliberately not the shared `EventSide`: widening `EventSide`
  would make `draw` legal in map picks and bracket slots.
- **Prices are 0–1 floats** summing to 1 across offered outcomes. Turn them into text only with
  `formatPercent`.
- **Markets do not open at 50/50.** Opening odds come from seeding and results so far
  (`opening_price_a|b|draw`). A price is never evidence that anybody bet; `priceDrift` is the only honest
  measure of movement. There is no rating in any payload and, by decision, no client surface or model for
  one.
- **A price can move with nobody betting**: a result re-rates two teams and re-prices their later matches.
  `price_history` marks those points `source: 'model'`. It does not mean a held position changed.
- `evenMarketPriceAfter` is a yardstick (the server's closed form at zero shares, pinned by a test) for
  comparing liquidity settings in the manage panel. Never use it to describe a real match.
- **Use `wallet.max_stake` as given**: it is per player and per moment; never derive it from `config`,
  cache it across players or assume it holds after a settlement.
- **Paid at the board price.** `quote.avg_price` equals `quote.price_before`: render one number, not "your
  odds" and "board odds".
- **Send `max_slippage` on every bet.** The quote reserves nothing; `BetModal` sends the quoted price plus a
  small tolerance and re-quotes when refused. Quotes are debounced and re-priced on submit, so the
  confirmed payout can differ from the preview.
- **A payout is `Math.floor(shares)`.** `position.shares` is locked at bet time; never recompute a payout
  from the current price. A held position routinely sits at odds nobody can buy now; that is correct.
- **One outcome per match.** A player can only add to their position; the slip locks the other tiles off
  `your_position.side`. A draw settles as a win for its backers where offered and a refund where not, so
  `outcomeLabel` branches on `draws_allowed`.
- **Timestamps** in prediction payloads carry `+00:00`; bracket payloads don't. Read both with
  `parseApiInstant` (`app/utils/timezone.ts`, re-exported by `predictionsShared.tsx`), never
  `new Date(...)`, for anything a countdown depends on.
- **Projected leaderboard.** Results count once official, before payouts are paid, so the server answers
  projected `net_worth` / `profit`. A row with `pending` waits on `pending_count` payouts;
  `PredictionLeaderboard.projected` marks the board. `PredictionsLeaderboard` shows a Pending chip per
  pending row and, while projected with any pending row, the "Projected — payouts pending" note
  (`leaderboardView.ts`). The ticker's Top predictors show an hourglass for `pending`.

### Manager surface

Gated on `MyEventStatus.can_manage_bracket`: settings and per-market controls in
`manage/PredictionsManagePanel.tsx`, and `manage/MarketControl.tsx` inside the match editor, because
scoring a match while its market is open refunds every prediction on it, quietly. The manager sees the
state and a one-click close before scoring.

## Limited-time achievements

An `AchievementDefinition` in the `event` category carries an `event` block `{ key, name, opens_at,
closes_at, finalised_at, state }` and can only be won off that event.

- **Most are awarded when the event ends.** With `unlocks_mid_event: false` the achievement stays locked
  in `/me` until the event is finalised, even while `current_value` meets the threshold.
  `awardedAtEnd(def)` (`achievements/eventAchievements.ts`) is the client test (event achievement, not
  mid-event, no `finalised_at`). Such a row reads "On track" with "Awarded when the event ends", never
  earned, and doesn't count towards "nearly there".
- **`state` is the server's answer** (`upcoming | live | ended`, accounting for finalisation); never
  re-derive it from dates. Logic lives in `eventAchievements.ts` (`isStillWinnable`, `eventSectionFirst`,
  `eventWindowNotice`), unit-tested.
- **Timestamps carry `+00:00`**: read them with `parseApiInstant`.
- **A new category needs two edits**: `AchievementCategory` in `api.ts` and the `CATEGORIES` list in
  `AchievementsShowcase` (which is display order). A category missing from `CATEGORIES` is silently
  dropped.
- **Anything ranking achievements excludes ended ones and ones awarded at the end**, as
  `home/AchievementProgressPreview` does before taking the top six by `percent_to_next`. A mid-event one
  stays while the event runs.
- **The event's Achievements tab** (`events/achievements/EventAchievementsTab.tsx`, lazy) exists only when
  `EventDetail.achievements_enabled`, and loads `fetchEventAchievementBoard(token, slug)` →
  `EventAchievementBoard` when opened. Each entry has `qualifying` (who meets it now, or was awarded once
  `finalised`), `chasing` (a few who could still get there), `you` (null without a wallet) and
  `measure.kind` (`coins`, `signed_coins`, `percent`, `signed_percent`, `count`, `flag`): format values by
  kind, never by achievement code. `names_hidden`: the server withholds who backed an open final, so show
  the count. `awaiting_final`: no final to back yet. Wording and chase hints live in
  `eventAchievementBoard.ts`, unit-tested.
- **Finalising.** `finaliseEventPredictions` awards the event's titles off the final standings, offered in
  `PredictionsManagePanel` only when the admin markets payload reports `achievements.ready_to_finalise`.
  It cannot be undone, so it confirms first and uses `apiGet` (not `apiGetOr`) so a refusal reaches the
  manager.

## Adding an event tab

Copy the Achievements tab (#287): a lazy component behind an `EventDetail` flag, the smallest complete
instance. For a gate that depends on the viewer, copy the Stream tab's `streamTabVisible`
(`events/stream/streamTabAccess.ts`). How `eventTab`, `?tab=` and the `event.tab` nav state behave is in
[navigation.md](../navigation.md).

1. **Folder.** `events/<tab>/<Name>Tab.tsx` (named export) plus its pure logic in a `.ts` with a `.test.ts`
   (`achievements/eventAchievementBoard.ts`). The tab fetches its own read on mount with the page's
   `browseToken` (`''` signed out). Data another surface also uses stays page-owned in `EventDetailPage`
   and comes in as props or context (Predictions: one fetch feeds the tab and the bracket's odds chips).
2. **Register** in `EventDetailPage.tsx`: the id in the `EventTab` union and `{ id, label }` in
   `BASE_TABS`, whose order is the tab-bar order; Manage stays last (`MANAGE_TAB`).
3. **Gate.** One boolean beside `predictionsOn` / `achievementsOn`, from an event flag or a tested pure
   helper. It goes in three places that must agree: the `visibleTabs` filter chain, the `activeTab`
   fallback chain (a failed gate renders `info`, so a `?tab=<id>` link never lands on a blank page) and
   the render guard `activeTab === '<id>' && <gate>`.
4. **Lazy-load.** `const <Name>Tab = lazy(() => import('./events/<tab>/<Name>Tab').then(m => ({ default:
   m.<Name>Tab })))` beside `StreamTab`, rendered inside `<Suspense>` with a one-line
   `text-xs text-muted-foreground` fallback. `EventDetailPage` is itself one lazy chunk and the largest
   lazy chunk is capped (`scripts/check-web-bundle.mjs`), so a tab nobody sees on first paint gets its own.
5. **Links and state.** `?tab=<id>` needs no route change. Link in with `NavLink view="event-detail"
   params={{ eventSlug, eventTab: '<id>' }}` (`home/ClosingSoonBanner.tsx` does it for Predictions). UI
   state Back/Forward should restore is nav state keyed `event.<thing>` (`event.statsStage`,
   `event.streamPanel`; [state-patterns.md](../state-patterns.md)). A new mode of an existing tab keeps
   its id so old links still work, as Stats did inside `teams` (`statsMode`); its "New" pill is
   `statsTabView` with a seen key and an end date.
6. **Tests.** Vitest for the pure module and the gate. A Playwright spec copied from
   `e2e/event-achievements-responsive.spec.ts`: route-mock `api|gateway.utbt.net` (the event with the
   flag on, bracket, `me`, teams, LFP and the tab's read), open `/events/<slug>?tab=<id>`, assert the
   content and `horizontalOverflow(page)` ≤ 1. It runs in the desktop and the Pixel 7 project
   ([testing.md](../testing.md)).
7. **Verify.** `npm run typecheck:web`, `npm test` and `npx playwright test e2e/event-<tab>-responsive.spec.ts`
   pass; `npm run build:web` then `npm run check:bundle` passes; in `npm run dev:web`,
   `/events/<slug>?tab=<id>` opens the tab when the gate passes and Info when it fails.
