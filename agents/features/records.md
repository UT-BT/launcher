# Stats and records pages

The player profile, map detail, cap and team-run detail, World Records and Cap It All pages,
the record rules the Maps and Players lists add, and the replay and record modals they share.
Read it before touching any of those pages, `app/components/pages/capDetail/` or the replay
modals.

Elsewhere: the cap detail, world records, team runs and replay-source endpoints are in
[api.md](../api.md); detail-page navigation, `NavLink` and the refresh registry in
[navigation.md](../navigation.md); `useNavState`, controlled pages and `querySig` in
[state-patterns.md](../state-patterns.md); table columns in the
[`add-table-column` skill](../../.claude/skills/add-table-column/SKILL.md); the Home page (Medal
Hunt, latest records) in [home.md](home.md).

## Where the code lives

| Path | Holds |
|---|---|
| `app/components/pages/PlayerDetailPage.tsx` | profile entry: the summary read, the active tab's card, the lazy activity chart |
| `app/components/pages/playerDetail/` | one card per profile tab plus the hero and sidebar cards, each fetching for itself; `activityChart.ts` is the pure chart default and hour labels (`activityChart.test.ts`); `playerDetailTabs.ts` is the tab list, which tabs hide and the stored tab's fallback (`playerDetailTabs.test.ts`) |
| `app/components/pages/MapDetailPage.tsx` + `mapDetail/` | map detail: one load of every read, then cards that derive stats, ranks and team medal thresholds from the fetched rows |
| `app/components/pages/CapDetailPage.tsx` | one cap: hero, checkpoint splits, both compare flows |
| `app/components/pages/TeamCapDetailPage.tsx` | one team run: roster, per-member analytics, the team replay |
| `app/components/pages/capDetail/` | cap-detail cards; `capStats.ts` holds the pure medal-int helpers, signed deltas and checkpoint alignment (no tests) |
| `app/components/pages/capDetail/videoCompare/` | the synced multi-video comparison player |
| `app/components/pages/WorldRecordsPage.tsx`, `CapItAllPage.tsx` (+ `.types.ts`) | the two server-paginated record lists |
| `app/components/pages/MapsPage.tsx`, `maps/medals.ts`, `PlayersPage.tsx` | the list pages; `computeMedalTier` |
| `app/components/modals/` | replay picker (its row cache in `replayPickerCache.ts`, `replayPickerCache.test.ts`), WR progression, cap-time distribution, playtime breakdown, history, review and favourites lists |
| `app/components/shared/ReplayVideoModal.tsx`, `app/hooks/useReplayWatch.ts`, `useVideoCompareAvailability.ts`, `useDemoDownload.ts` | replay and demo plumbing every record surface reuses |
| `app/utils/format.ts`, `medals.ts`, `difficulty.ts` | cap-time formatting (`format.test.ts`), medal icons, difficulty tiers |
| `app/utils/capTypes.ts`, `medalThresholds.ts`, `mapAuthor.ts`, `teamRunState.ts` | the one definition of the cap types, the medal multipliers, the map author name and the team-run label (each with a `.test.ts`); `recordsDefinitions.test.ts` fails when a records file copies one of them or the difficulty tiers |

## Cap status

A cap carries three independent signals:

| Field | Meaning |
|---|---|
| `cap_type` | where it was set: `2` a certified UTBT server (`CAP_TYPE_UTBT_CERTIFIED`), `3` I4Games (`CAP_TYPE_I4GAMES`), anything else casual. "Certified" in the UI always means `isCertifiedCap(cap)`. |
| `verified` | its demo was uploaded and accepted. Only verified caps have a replay video and count toward the World Record. |
| `disallowed` | removed by staff: it no longer counts toward leaderboards, medals or world records, and cannot be watched. |

A list row's status chip takes the first match: Disallowed, Verified, Certified, I4Games, Casual
(`renderCapStatus` in `playerDetail/RecentCapsCard.tsx`; `PersonalBestsCard` repeats it without
the Disallowed step). The cap-detail hero shows a Disallowed / Verified / Unverified chip and a
separate cap-type chip. Compare cap types only through `app/utils/capTypes.ts`, in the renderer
and the demo watcher alike; never write the numbers.

Enable Watch and Compare only for `verified` caps (All Caps also excludes `disallowed` ones), with
the tooltip "No replay — cap not verified" on the disabled button, rather than letting the replay
read fail. The profile tabs gate the demo download the same way; the map leaderboard, World
Records and Cap Detail always offer the demo.

### World-record demos: the 24 h window

The World Record is the fastest verified cap on a map. The API verifies a world-record time only
from a demo uploaded within 24 hours of the run; a later upload is refused for good (`422`, see
[api.md](../api.md)), so that cap stays unverified and never becomes the WR. The renderer has no
pending-WR state or countdown: render the rows the API returns.

### Team runs

`TeamRunState` is `incomplete` (`complete` is false: not every member has capped), `pending`
(complete, waiting for member demos), `verified` or `disallowed`. The team time and the
per-combination rule are in [api.md](../api.md). Each member carries its own `verified`; the team
cap detail read adds `has_demo` and the member's full `cap`.

Label a run's state with `teamRunStateLabel` (`app/utils/teamRunState.ts`): Incomplete, Pending,
Verified, Disallowed. Team Cap Detail, the team-run chip on Cap Detail and the map's team
leaderboard all use it, so a run reads "Pending" until it is verified.

## Medals

The medal arrives in three encodings; use the helper for each:

| Source | Shape | Helper |
|---|---|---|
| summary rows (profile tabs, `HistoryModal`, Home) | string: `World Record`, `Champion Medal`, `Gold Medal`, `Silver Medal`, `Bronze Medal`, `Certified`, `Casual` | `getMedalIcon` (`app/utils/medals.ts`, case-insensitive) |
| cap detail, team cap detail, team leaderboard rows | int `6` WR, `5` Champion, `4` Gold, `3` Silver, `2` Bronze, `1` Certified, `0` Casual | `medalIconForInt` / `medalLabelForInt` (`capDetail/capStats.ts`) |
| map lists and the solo map leaderboard | not sent; derived from the cap and the map's thresholds | `computeMedalTier` (`pages/maps/medals.ts`) |

`computeMedalTier(bestCap, map)`: no cap is `uncapped`; a cap that is not certified is
`casual`; a certified cap within 0.0005 s of the map's `world_record` is `world_record` (exact
equality misses because of float noise); otherwise the best threshold it meets, else `verified`.
The tier id `verified` is labelled "Certified" (`TIER_LABELS`): a certified cap below every
medal.

**Thresholds.** Solo maps carry server-computed `world_record`, `champion_medal`, `gold_medal`,
`silver_medal` and `bronze_medal` columns, and Cap Detail sends `medals` + `deltas` (a negative
delta is faster than the threshold). Team maps have no threshold columns: `mapDetail/MedalCard.tsx`
and `CapTimeDistributionModal` both take the fastest verified team run (`teamWorldRecord`) times
the medal multipliers (`medalThresholdsFromWorldRecord`, `app/utils/medalThresholds.ts`: Champion
1.025, Gold 1.125, Silver 1.30, Bronze 1.60).

**Copies of server rules.** `MEDAL_MULTIPLIERS` in `medalThresholds.ts` is the client's one copy
of the multipliers; the "WR + 2.5%" explainer labels in `MedalCard` and
`playerDetail/MedalShowcaseCard.tsx` come from it through `medalMultiplierLabel`. The points table
(WR 10, Champion 8, Gold 6, Silver 4, Bronze 2, Certified 1) is a second copy, in
`playerDetail/HeroSection.tsx`. Points and the global rank themselves come from the API
(`summary.medals`, `/v2/players` rows). Change both when the server's medal or scoring rules
change.

## Cap times

Format every cap time with `formatCapTime` (or render `CapTimeLink`, which uses it). It rounds to
the nearest millisecond: API values carry float64 noise (`73.6` can arrive as
`73.59999999999999`), and truncating would show a time one millisecond faster than stored.
`app/utils/format.test.ts` pins the rounding, including the carry into the seconds field.

- Deltas: `formatDelta` (`toFixed(3)` below a minute), or on cap pages `formatSignedDelta` from
  `capStats.ts` (`+` slower, `−` faster, `±` level) with `deltaClass` for the colour.
- Compare times as numbers, never as formatted strings. Client-computed ranks (map leaderboard
  tabs, Your Stats, the team rank window) are positions after a time sort, so ties get
  consecutive ranks; API ranks (`rank_on_map`, player and Cap It All ranks) are the server's.
- A team cap row (`isTeam` on summary rows, non-empty `members` on world records) links with
  `CapTimeLink teamCapId`; on world-record rows the row's `cap_id` is then the team cap id.

## Player profile

`PlayerDetailPage` reads `fetchUserSummary` (`/v2/summary/user/<id>`: profile, medal counts,
points, rank, tab counts) and then, once it has landed, the activity buckets and the authored-map
count. Each tab card fetches its own rows. `isSelf` (the viewer's id equals the profile id)
unlocks favourite toggling, Change Title and the screenshot actions on Maps Authored.

| Tab (`PlayerDetailTab`) | Card | Read | Paging |
|---|---|---|---|
| `caps` All Caps | `RecentCapsCard` | `fetchCapsForUser` | server |
| `disallowed` | `DisallowedCapsCard` | `fetchCapsForUser` with `capFilter: 'disallowed'` | server |
| `pbs` Personal Bests | `PersonalBestsCard` | `fetchPersonalBestsForUser` (`/v2/summary/user/<id>/personal_bests`) | server |
| `wrs` World Records | `WorldRecordsCard` | `fetchUserWorldRecords` (`/v2/world_records/?user=`) | server, total from `counts.wr_count` |
| `playtime` | `PlaytimeBreakdownCard` | `fetchPlaytimeByMap` (`/playtime/by_map/<id>`) | server |
| `uncapped` | `UncappedMapsCard` | `fetchUncappedMaps` + `fetchUncappedMapsCount` (`/caps/uncapped/<id>`) | server |
| `achievements` | `PlayerAchievementsCard` | `fetchAchievementDefinitions` + `fetchUserAchievements` | client |
| `maps` Maps Authored | `AuthoredMapsCard` | `fetchMaps({ authorRef })` | client |

- **Tab visibility** (`playerDetailTabs`). Counts come from `summary.counts`. Disallowed hides
  while `disallowed_caps` is zero; Maps Authored hides until `fetchMapsCount({ authorRef })` is
  non-zero. A stored `disallowed` or `maps` tab whose count has loaded as zero falls back to
  `caps`, and the All Caps button shows active; while its count is still loading the stored tab
  stays. Both show to every viewer, not only on your own profile.
- **Disallowed caps.** All Caps includes them, dimmed, with the Disallowed chip and no
  watch/download. Its filter offers All / Verified / Certified / Casual; disallowed caps have
  their own tab, which shows `disallow_reason` and sorts by `disallowed_at` (newest first).
- **Maps Authored** lists active maps whose `author_ref` is this player; a free-text
  `author_str` match does not count.
- **Searched lists without a count.** The WR and Uncapped tabs have no filtered total; while a
  search or filter is on, the pager assumes one more page whenever the current page is full.
- **Fetch failures look empty.** The server-paged tab fetchers (caps, disallowed, PBs, WRs,
  playtime, uncapped) resolve `{ total: 0, items: [] }` (or `[]`) on a non-2xx, so a failing tab
  shows its empty state, not its error line.
- **Tab state** lives in `useNavState` keys prefixed per card (`caps.*`, `disallowed.*`, `pbs.*`,
  `wrs.*`, `playtime.*`, `uncapped.*`, `achievements.*`, `authored.*`) and the active tab in
  `player.activeTab`, so Back restores tab, page, sort and search.
- **Activity chart** (`PlayerActivityChart`, lazy): lifetime weekly buckets
  `{ week, caps, hours }` from `/v2/summary/user/<id>/activity`. It shows playtime unless every
  week has zero hours, then caps (`defaultActivityMode`; an empty list, still loading, counts as
  playtime). A click picks the mode for this mount only. `formatHours` keeps sub-hour
  axis ticks distinct within five characters. The brush appears above 8 weeks.
- **Favourites** on your own profile render the live `favoriteMapNames` set, so a toggle shows at
  once; other profiles show the fetched list.
- **Hero.** A ban (`profile.active_ban`) shows a banner; an end date 50 or more years out reads
  "Permanent". Changing your title dispatches `refresh-user-profile` and refetches the summary.

## Map detail

`MapDetailPage` loads everything in one pass: `fetchMap` with the page's own
`MAP_METADATA_COLUMNS` (add any new map field there), then in parallel the solo leaderboard
(`fetchMapLeaderboard`, unfiltered), the team leaderboard on team maps, reviews, playtime, the WR
progression, and for a signed-in viewer their cap count and team stats. Every card derives from
those rows; none fetches for itself except the version bar.

- **Solo or team** comes from `required_players` ([api.md](../api.md)). Team maps render
  `TeamLeaderboardTable` (tabs Verified / All on `state`), team medal thresholds and team stats.
- **Solo leaderboard tabs**: Verified (default), Certified (`cap_type 2`), All, filtered
  client-side; the rank is the row's position by time within the tab. Each row's medal comes from
  `computeMedalTier`. The row whose id equals the newest WR progression entry's `cap_id` carries
  the WR history trigger.
- **Stat tiles**: the median is over certified caps (all team runs on a team map); "engaged
  players" count players with more than 300 s of non-spectator playtime.
- **Your Stats**: on solo maps the PB and rank are the viewer's position among verified rows; on
  team maps they come from `fetchUserTeamMapStats`. Signed out, the card is replaced by a sign-in
  prompt (`requestLogin`).
- **Activity chart** (`mapDetail/ActivityChart.tsx`, lazy): caps by default, weekly; zooming the
  brush below 90 days switches to daily buckets.
- **Author**: the name is `mapAuthorName(map)` (`app/utils/mapAuthor.ts`) everywhere a map's
  author shows (Map Detail, the Maps table, its author filter and sort, the Uncapped tab): the
  display `author` first, then the free-text `author_str`, trimmed. A linked author
  (`author_ref`) renders as `PlayerInfo`, so it links to the profile; a free-text author renders
  as a plain `MetaPill`. The Maps table does the same through `PlayerInfo presentation="name"`
  ([shared-components.md](../shared-components.md)).
- **Inactive version** (`active === false`): an amber "no longer in rotation" banner, reviews
  closed (`ReviewsCard canSubmit`), screenshot editing for staff only. The screenshot permission
  rule is in [api.md](../api.md).
- **Version chain** (`MapVersionsBar` in `MapVersionsCard.tsx`): follows `preceded_by` /
  `superseded_by` one `fetchMap` per hop, caches the chain module-wide under every member's
  name, and links another version only when it has caps (records are not transferred between
  versions). A linked pill is a `MapNavLink`, so on the web it is an `<a href>` that opens in a
  new tab on a middle click (`e2e/map-versions.spec.ts`). Labels are the names minus their
  shared prefix.

## Cap detail

`CapDetailPage` reads `fetchCapDetail`, plus `fetchTeamRunStatus` when the cap has a
`team_run_id`. A team-run member's hero shows the team time and the member list in place of
rank, Δ WR and gap to next. The cap is the WR when `wr_cap_id` matches or `rank_on_map` is 1;
Δ WR and gap then read "—". Gap to next is the distance to `neighbors.above[0]`.

**Checkpoint splits.** The compare dropdown lists `compare_candidates` and defaults to the one
nearest in time ([api.md](../api.md)). `buildSyncAnchors` (`capStats.ts`) matches checkpoints by
`zone`, drops a zone whose relative position (cumulative ÷ cap time) differs by more than 6 % and
by more than 4× its neighbours' mismatch (a skipped or misread checkpoint), and renumbers the
kept ones `CP1…` between `SPAWN` and `CAP`. The splits table, the delta chart and the video
scrubber all use it.

**Compare Run** (side-by-side video):

1. `ReplayPickerModal` in `compareMode` lists the map's verified solo runs except this one.
2. Picking a run resolves both videos through `useVideoCompareAvailability` (a 5-minute
   module cache shared with Team Cap Detail) and loads the opponent's checkpoints.
3. If either video is missing, a small modal says which one is not available yet; otherwise
   `VideoCompareModal` opens.
4. Checkpoints go to the player only when both caps ran for the same side (`cap.team`, `0` Red /
   `1` Blue): the sides run different routes, so cross-side splits are meaningless and the
   scrubber shows only spawn and cap.

## Team cap detail

`TeamCapDetailPage` reads `fetchTeamCapDetail` and the map's `fetchTeamMapLeaderboard`. From the
leaderboard it computes the gap to the next faster run and a rank window of five verified runs
around this one (found by `team_cap_id`, else by `member_key`, the same member combination).
`rank_on_map` / `total_on_map` stay the API's.

- **Roster.** One card per member; selecting a member swaps the client-settings grid and
  movement analytics to that member's `cap`. The default is the member whose time equals the
  team time (the slowest).
- **Watch Team Replay** takes the members with `has_demo`, resolves their videos three at a time,
  and opens `VideoCompareModal` with every run that has one. Fewer than two shows "Not enough
  replay videos are available yet".
- **Download all demos** runs the members with `has_demo` one after another.
- **Medal strip**: the API's `deltas.world_record` feeds the strip's `wr` key.

## Comparison player

`capDetail/videoCompare/VideoCompareModal.tsx` plays N runs in sync (two from Cap Detail, the
roster from Team Cap Detail; lane colours cycle after eight).

- The master clock is the furthest video time plus that run's nudge. Nudges move in 0.1 s steps,
  clamped to ± the larger of 60 s and the longest video.
- Arrow keys step one frame at the lowest `fps` among the runs (30 when unknown); J and L skip
  5 s; keys typed into an input are ignored. Videos start muted; rates run 0.25×–2×.
- Each run's checkpoint ticks are aligned against the slowest run. The delta bar shows only for
  exactly two runs with at least one matched checkpoint.
- Play starts only once every video reports a finite duration and none has errored.
- Credit the sources with `ReplaySourceCredit`; source rules are in [api.md](../api.md).

## World Records

Server-paginated ([api.md](../api.md) has the parameters). The page fetches the rows
(`fetchWorldRecords`) and the total (`fetchWorldRecordsCount`) in parallel, caches pages by query
signature in a ref, prefetches the neighbouring pages, and gates its skeleton on
`caches.querySig` ([state-patterns.md](../state-patterns.md)). The count cache ignores sort, so
re-sorting reuses the total.

- **Filters to params**: difficulty tiers expand to a CSV of levels (`expandDifficultyTiers`,
  `app/utils/difficulty.ts`); time buckets become `min-max` second ranges; the timeframe becomes
  `added_since` (now minus 7 / 30 / 90 / 365 days); holders are user ids from
  `fetchWorldRecordFilterOptions`; search is debounced 200 ms.
- **Favourites only** applies only when signed in: it sends the favourite names, sorted, as
  `maps`, and with no favourites shows an empty table without a request.
- **Top Rushers** mode reads `fetchRushers` (rows and totals in one call) and takes only search.
- **Presets** sync under `utbt:worldRecordsPresets:v1`; apply them sanitised
  ([state-patterns.md](../state-patterns.md)). Persisted prefs: column visibility and order, page
  size, filters panel open.
- Watch and the demo download are always enabled: every row is a verified WR.
- Arriving from the sidebar's new-records badge resets to Records sorted by date, newest first
  (`useNewItemHighlight`, [navigation.md](../navigation.md)).

## Cap It All

`fetchCapItAllLeaderboard` (`/v2/leaderboards/cap_it_all`, `search` / `limit` / `offset`) answers
`{ map_count, total, items }`. Each row's rank and its four count-and-percentage pairs
(certified, non-certified, team maps, total) are server-computed, so the table has no sort
controls; the header shows `map_count` active maps. It pages the way World Records does (ref page
cache, neighbour prefetch, `querySig` gate). The only persisted pref is the page size.

## Players list

`fetchPlayers` (`/v2/players/`) and `fetchPlayersCount` (`/v2/players/count/`, search only) page
and sort server-side. `rank` and `alias` sort ascending on first click, every other field
descending. A `rank` of 0 means unranked and renders "—". Rank and points are the same
server-computed values the profile hero shows.

## Maps list

`MapsPage` runs in one of three data modes, chosen per render:

| Mode | When | Rows |
|---|---|---|
| browse | no search, no client-only filter or sort | `fetchMaps` + `fetchMapsCount` per page; the server sorts by name, added or difficulty |
| search | a search term | `fetchMapsFuzzy` names merged with tag matches from the metadata cache, then client filters |
| fullload | any filter other than New, or a rating / my rating / WR / PB / author / medal sort | the cached full metadata list, filtered and sorted client-side |

On mount it loads the full active-map metadata, every review, the author list and, signed in,
the viewer's best caps (`fetchBestCaps`, `/caps/capped_maps/<userId>`) into `caches`; filter
options, counters, ratings and the medal column use them in every mode. The medal column and
the capped filter run `computeMedalTier` on those best caps; the medal sort puts uncapped and
casual maps last in either direction. WR holders load lazily for the visible rows
(`fetchWorldRecordsForMaps`) and accumulate in `caches.wrHolders`.

## Shared modals

| Modal | Opened from | Rules |
|---|---|---|
| `shared/ReplayVideoModal.tsx` + `useReplayWatch` | every Watch button | `openReplay` turns a `null` video into "Replay video not available yet" and a thrown read into "Could not load this replay"; render `replay.error` in a `Modal` titled "Replay not available" beside it. Volume persists in `utbt:replayVideoVolume:v1`; Share copies `view_url ?? mp4_url`. |
| `modals/ReplayPickerModal.tsx` | Maps row replay, Home Medal Hunt, Cap Detail Compare Run | Lists the map's verified solo runs, or its team runs on a team map outside `compareMode`. Resolves each row's video three at a time, visible page first. Caches every run per map for 5 minutes (`replayPickerCache.ts`), and drops `excludeCapId` (the cap being compared) after the read, so compare mode never offers the cap itself and a later normal open still lists it. |
| `modals/WorldRecordProgressionModal.tsx` | the WR history trigger on Map Detail, World Records and the profile WR tab | `lazy()`-loaded; the caller fetches `fetchWorldRecordProgression` and passes `entries`. |
| `modals/CapTimeDistributionModal.tsx` | Map Detail median tile | Certified caps only on solo maps, every team run on team maps; the x-axis ends at the tightest medal boundary that holds about 95 % of caps. |
| `modals/PlaytimeBreakdownModal.tsx` | Map Detail playtime tiles | Per-player playtime; spectator rows excluded. |
| `modals/HistoryModal.tsx` | Home | The signed-in player's own caps (`fetchSummaryCaps`, `/v2/summary/caps`). The read has no total, so it asks for one row more than the page to know whether a next page exists. |
| `modals/PlayerFavoritesModal.tsx`, `PlayerReviewsModal.tsx` | profile sidebar cards | The full list behind each card's preview. |
| `modals/ReviewModal.tsx` | Map Detail, Home | Map Detail prefills it with the viewer's existing review and refetches on success. |
| `modals/MapScreenshotModal.tsx` | map hero, Maps Authored | [api.md](../api.md) |

## Adding a profile tab

Reference instance: the Disallowed tab (`DisallowedCapsCard.tsx`), the smallest server-paged tab.
It has no phone card rows yet; take those from `RecentCapsCard.tsx`.

1. **Fetcher** in `app/utils/api.ts` returning `{ total, items }` (skill: consume-api-data). If
   the tab shows a count, add the field to `UserSummaryCounts` and `normaliseUserSummaryCounts`.
2. **Tab id**: add it to `PlayerDetailTab` in `playerDetail/MainSectionTabs.tsx`.
3. **Card** `playerDetail/<Name>Card.tsx`, copied from `DisallowedCapsCard.tsx`: props
   `accessToken`, `userId`, `onMapSelect`, `tabsSlot`; render `tabsSlot` first in the header; keep
   query, sort, page and page size in `useNavState('<prefix>.<field>')` with a prefix no other
   card uses; page through `usePaginatedQuery`; render `DataTableShell` with `responsive`
   including `compactContent` (as `RecentCapsCard` does), then `PaginationBar`.
4. **Wire it**: add `{ value, label, count, hidden }` to the tab list in
   `playerDetail/playerDetailTabs.ts` in display order; if the tab can hide, add its known-empty
   fallback there the way `disallowed` and `maps` fall back to `caps`, with a case in
   `playerDetailTabs.test.ts`. In `PlayerDetailPage.tsx`, add an `activeTab === '<id>'` block
   rendering the card with
   `tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}`.
5. **Verify**: `npm run typecheck:web` passes. In `npm run dev:web`, open `/players/<id>`, switch to
   the tab, change page, open a map and go Back: tab, page and search are restored; at 390 px the
   compact rows render with no horizontal scroll. `npm run test:e2e -- responsive-accessibility`
   still renders `/players/1` without the error boundary.
