---
doc: data-sources
read_when:
  - "fetching data from the API (maps, records, players, caps, reviews, favorites)"
  - "adding or changing a helper in app/utils/api.ts"
  - "needing an avatar, map screenshot, region flag, or map-download URL"
  - "wiring map/server favorites or Patreon tier lookups"
keywords: [api.ts, fetch, endpoint, accessToken, avatar, MapThumbnail, favorites, patreon, downloadMapZip, world_records, caps, predictions, draw, odds]
provides: "the client-side API contract the launcher consumes + asset URLs + favorites/patreon sync models"
not_here:
  - "IPC channels (window.conveyor.*) → lib/conveyor/README.md"
  - "how UI state persists in localStorage → state-patterns.md"
  - "the procedure to wire a new endpoint into the UI → skill: consume-api-data"
sections: [backend-api, errors, admin-api, event-brackets, event-predictions, changing-a-map-screenshot, cap-detail-page-endpoints, world-records-page-endpoints, team-maps-and-team-runs, avatar-urls, map-download-service, map-favorites-dual-storage, patreon-members, server-favorites, account-state-and-badges]
last_verified: 2026-09-03
verify_against: [app/utils/api.ts, app/utils/chartBuckets.ts, app/components/pages/admin/components/controls.tsx, app/components/pages/admin/sections/HostsManagementSection.tsx, app/utils/patreon.ts, app/utils/server-utils.ts, app/hooks/useServerFavorites.ts, app/components/pages/events/manage/formatFields.tsx, app/components/pages/events/bracket/bracketShared.tsx, app/components/pages/events/predictions/predictionsShared.tsx, app/components/pages/events/predictions/PredictionsTab.tsx]
---

# Data sources

## Backend API

The launcher reads its data over HTTPS from `https://api.utbt.net` (prod) or
`http://localhost` (dev; override with `VITE_API_BASE_URL`). All HTTP helpers live in `app/utils/api.ts` —
don't hand-roll `fetch` calls in components.

Responses use a `{ success, data }` envelope; the helpers unwrap it for you.
The server may omit the `data` key entirely on empty results, serialize absent
numerics as empty strings, and send `{}` for absent nested objects — fetchers
must normalise those at the fetch layer, never in components. Use the exported
coercion helpers (`asNum`, `asArray`, `asNonEmptyObj`, `asStr`) plus `apiGetOr`
(fallback when `data` is absent) and follow the `normaliseCapItAllRows` /
`fetchUserSummary` pattern when adding a fetcher. Dates arrive in several
formats; parse them with `parseApiDate` from `app/utils/format.ts`.
When a launcher need exceeds what the API exposes, get the field added to the
API rather than working around it in the renderer (the
[`consume-api-data` skill](../.claude/skills/consume-api-data/SKILL.md) walks the
full loop).

### Helpers in `app/utils/api.ts`

| Category | Functions |
|---|---|
| Maps | `fetchMaps`, `fetchMapsCount`, `fetchMapsMetadata`, `fetchMapsFuzzy`, `fetchMapAuthors`, `buildMapQuery`, `uploadOwnMapScreenshot` |
| Records | `fetchWorldRecords`, `fetchWorldRecordsCount`, `fetchRushers`, `fetchRecordsCount`, `fetchWorldRecordsForMaps`, `fetchWorldRecordProgression`, `fetchBestCaps`, `fetchMapLeaderboard` |
| Team runs | `fetchTeamMapLeaderboard`, `fetchTeamRunStatus` (→ [Team maps & team runs](#team-maps-and-team-runs)) |
| Per-map per-user counts | `fetchUserCapCountForMap` |
| Players | `fetchPlayers`, `fetchPlayersCount` (→ `/v2/players`, server-side alias search/sort/pagination + medals; row type `PlayerListRow`) |
| Reviews | `fetchMapReviews`, `fetchAllMapReviews`, `submitSummaryReview` |
| Favorites | `fetchUserFavorites`, `addFavoriteMap`, `removeFavoriteMap`, `replaceFavoriteMaps` |
| Demos | `fetchDemoStatus`, `getFirstPersonVideoUrl`, `downloadDemo` |
| Cap detail | `fetchCapDetail`, `fetchCapCheckpoints` |
| Achievements | `fetchMyAchievements`, `fetchAchievementDefinitions` |
| Home / summary | `fetchSummary` (homepage feed), `fetchHotMaps` (→ `GET /v2/summary/hot_maps` → `HotMap[]`), `fetchMedalHunt` (→ `GET /v2/summary/medal_hunt` → `MedalHuntOpportunity[]`), `fetchPendingReviews` |
| Account state / badges | `fetchUserState` / `mergeUserState` (per-account preference blob keyed by the `utbt:*` storage names, shallow-merged per key; consumed only by `app/utils/userState.ts` — see `agents/state-patterns.md`), `fetchNavBadges` (per-section "new since my last visit" counts + seen markers; `count: null` = never visited = no badge), `markSectionSeen(token, section, seenAtIso?)` (advances one marker; omitted stamp = server now). All require a real bearer — signed-out users have no account state and no badges. |
| Profile | `UserProfile` type (incl. `team` clan-tag summary), `getAvatarUrl(userId)`, `toActiveTitle` |
| Teams | `createTeam`, `fetchTeams`, `fetchTeam`, `updateTeam`, `disbandTeam`, `transferTeamOwnership`, `fetchTeamMembers`, `inviteToTeam`, `joinTeam`, `acceptTeamInvite`, `declineTeamInvite`, `leaveTeam`, `denyTeamMember`, `unblockTeamMember`, `kickTeamMember` (optional `block`), `setTeamMemberRole`, `setTeamMemberNumber`, `fetchTeamActivity`, `fetchTeamAudit`, `fetchLineups`, `createLineup`, `updateLineup`, `deleteLineup`, `fetchMyTeam`, `setMyTagHidden`, `fetchMyInvitations`, `uploadTeamAvatar`, `deleteTeamAvatar`, `teamAvatarUrl` (clans + lineups; mutations return the fresh `TeamDetail`; validation failures surface the server's message — see [Errors](#errors)). `fetchTeams` rows carry a `stats` block (`caps`, `world_records`, `playtime_seconds`, `spectator_seconds`, plus `ranks` per metric) totalled over the team's active members, and `sort` accepts those three metrics on top of `added`/`name`/`members`; pass `limit: 0` for the whole directory (the gallery is unpaginated). Ranks are **directory-wide** — searching or filtering never renumbers them — and `ranked_teams` is the "of N". Ties share a rank. A team on zero for a metric still comes back ranked; the UI drops the chip rather than showing a meaningless placing. Rows also carry `owner_alias` + `owner_title`, so render the owner straight from the directory row — never fan out a profile request per card. `fetchTeamActivity` returns the same totals and ranks for one team alongside its feed. |
| Events | `fetchEvents`, `fetchEvent`, `fetchEventTeams`, `fetchEventLfp`, `fetchMyEventStatus`, `createEventTeam`, `inviteEventPartner`, `acceptEventInvite`, `declineEventInvite`, `updateEventTeam`, `deleteEventTeam`, `joinEventLfp`, `leaveEventLfp`, `setEventVolunteer`, `deleteEventVolunteer` (cup signups; an event is addressed by its `slug`) |
| Event brackets | `fetchEventBracket`, `fetchEventMatch` (→ [Event brackets](#event-brackets)); manager-only: `fetchEventFormats`, `setEventBracketPublished`, `setEventFormat`, `updateEventFormatSpec`, `setEventSeeds`, `updateEventStage`, `generateEventStage`, `generateEventRound`, `resetEventStage`, `updateEventGroup`, `createEventMatch`, `updateEventMatch`, `deleteEventMatch`, `setEventMatchResult`, `clearEventMatchResult`, `fetchEventCapCandidates`, `linkEventMatchMapCaps`; staff-only: `createEventFormat`, `updateEventFormat`, `deleteEventFormat`, `fetchEventFormat` |
| Admin (staff-only) | the moderator/admin dashboard slice — see [Admin API](#admin-api). `fetchAuditLog`/`fetchAuditLogCount` take `actors` (`staff` default / `players` / `all`): the default keeps player-written rows, such as a mapper replacing their own screenshot, out of the staff feed |

Most fetchers take `accessToken` first (Discord OAuth bearer). On the web build,
logged-out pages pass the `ANONYMOUS_TOKEN` sentinel (exported from `api.ts`)
instead — `apiRequest` strips it so the request goes out with no Authorization
header, and the API's public read endpoints accept that. Never send
`ANONYMOUS_TOKEN` into a mutation or "my X" fetcher; those require a real token.
The web login flow itself uses `POST /auth/discord/token` + `/auth/discord/refresh`
(see `agents/web-target.md` for the full contract).

### Errors

A failed request answers `{ success: false, error: "<human-readable reason>" }` — the
rate limiter is the one endpoint that uses `reason` instead. `apiErrorFor` in
`app/utils/api.ts` reads `error` then falls back to `reason`, and both `apiGet` and
`apiGetList` throw the resulting `ApiError` (`.status`, `.reason`, `.message`). Surface
`e.message` in the UI — it already carries the server's explanation, falling back to
`Request failed (<status>)` only when the body has none. **Don't use `res.statusText`**:
it is an empty string over HTTP/2, which is what prod serves.

Server-side validation messages are the source of truth, but mirror any rule the user
types against (team name, clan tag, member number — `app/components/pages/teams/tagFormat.ts`)
so the error shows inline instead of after a round trip. Keep the mirror in sync with the API
or the client will reject values the server accepts.

### Clan tag composition

The API returns aliases **already tagged** — the launcher never assembles the name a player
actually wears. `formatTaggedAlias` in `tagFormat.ts` exists only to preview an unsaved
choice, and mirrors the server rule:

```
unit = tag + number   (style !== 'plain' and a number is assigned)   else tag
sep  = ' ' if tag_spaced else ''
'number_only' -> unit               (raw alias when no number is assigned)
'suffix'      -> alias + sep + unit
'prefix'      -> unit  + sep + alias
```

`'numbered'` without an assigned number renders as `'plain'`. A member with `tag_hidden`
comes back from the API untagged everywhere, so nothing client-side needs to special-case it.

### Event brackets

An event's competition is described by a **format**: an ordered list of stages,
each with a `kind` the server knows how to draw (`groups`, `swiss`,
`single_elim` — round-robin is `groups` with one group). The launcher renders
whatever `fetchEventBracket` returns and **never computes standings, pairings or
match winners itself** — those are all server-side.

`fetchEventBracket(token, slug)` → `{ published, format: { template, spec }, stages[] }`.
Each stage carries `groups[]` (with computed `standings`), `entrants[]` and
`matches[]` (each with its `maps[]`). Per-map cap links come back only from
`fetchEventMatch`, not the bracket list.

**`published` is the whole-surface gate.** Until an event manager turns it on, a
player gets no stages, no standings and no format at all — so the Bracket tab
never renders for them, and nothing a manager does while building an event reaches
the site. Managers always get the full payload, which is why `BracketTab` can
treat "unpublished but I can see stages" as proof the viewer manages the event and
show its warning banner. Per-stage `published` is the finer control inside a
published bracket. An event with no format, or an older API, answers nothing and
the tab stays hidden the same way.

A match result is authored as its **map rows** — `caps_a`/`caps_b` per map decide
the map, and map wins decide the match. `setEventMatchResult` treats the submitted
`maps` array as the whole truth: ordinals it omits are deleted. Optional
`deaths_a`/`deaths_b` feed the deaths tiebreaker where a format uses one.

A map is won by whoever reaches `caps_to_win`; caps are bounded to `0..caps_to_win`
on both sides, since a side stops capping the moment it gets there. A map the
**time limit** ended short of the target has no winner until one is named —
`winner_side` on the map row does that, and the map then counts in full. `Final`
and `Forfeit` are **derived** from the result, never set directly: the match editor
offers only the states an admin owns (`pending`, `scheduled`, `live`, `bye`,
`cancelled`) so the form cannot claim an outcome the server then overrules.
`mapWinnerOf` and `seriesProgress` in `bracket/bracketShared.tsx` mirror the
server's rules so the editor can say what a result still needs.

**Drawing a stage early.** A fed stage is seeded from its feeders' standings, and
those exist from the moment a group stage is drawn — so "the top two in each
group" resolves to the entry seeds long before it means anything. The server
allows the draw (it only refuses when the feeders have produced nobody at all),
so the launcher is what stops it being done by accident: `unfinishedFeeders`
(`bracket/bracketShared.tsx`) reads the format's `advancement` rules against the
live stage statuses, `BracketPanel` shows an amber line on any stage whose
feeders are unfinished, and Draw/Redraw go through a confirm first. `Preview
draw` is never gated — a dry run is the safe way to look.

How map wins settle the match depends on the match's `mode`:

- `first_to` — a race to a majority of `best_of`. Complete the moment one side
  reaches it; anything entered on a later map is a dead rubber and does not
  count. `best_of` may be even, which is how "first to three of four" works.
- `all_maps` — every map is played and the higher map count takes it.

**A map can be played and won by nobody**, because the time limit can beat the cap
target. Length is therefore measured in maps *played* (`mapPlayed`: any caps, or a
named `winner_side`), not maps won, so a four-map race settles on any of thirteen
scorelines — 3-0 and 0-0 included — and never reaches 4-0. A level series only
counts as a result where the stage allows it, which is why `seriesProgress` takes
`drawsAllowed` and `BracketPanel` passes `stage.kind === 'groups'`.

A stage can override the whole match format, which is how a group stage plays four
maps with draws while the knockout stages stay Best of 3. A `swiss` or
`single_elim` stage that allows draws is rejected by the server.

Group points are a **scoreline table** — `EventPointsRow[]` of
`{maps_won, maps_lost, points}`, each team reading its own line, so a draw row
pays both sides the same and a 4-0 can outscore a 3-1. Standings carry
`wins` / `draws` / `losses`. `scorelinesFor`, `defaultPointsTable` and
`syncPointsTable` in `formatFields.tsx` mirror the server so the builder can offer
exactly the scorelines a series can produce; `withSyncedPoints` keeps a table in
step after the series length or mode changes.
`fetchEventCapCandidates` + `linkEventMatchMapCaps` attach the real caps behind a
played map, which fills the counts in and gives the public view per-cap times —
a convenience, never a requirement.

Format validation returns one 400 whose message lists every problem as
`field.path: reason`, joined with `; `. `parseSpecErrors`
(`app/components/pages/events/manage/formatFields.tsx`) splits it back apart so
`FormatBuilder` can show each error against its own control.

Attaching a format to an event **copies** it, so editing a shared template later
never reshapes an event that is already running.

### Event predictions

Coin-backed prediction markets on bracket matches, one market per match. Fetchers are
the `…EventPrediction…` family in `app/utils/api.ts`; the UI lives in
`app/components/pages/events/predictions/`.

**The tab only exists when the API says so.** `EventDetail.predictions_enabled` is the
single flag: the Predictions tab is filtered out of `BASE_TABS` when it is false and no
prediction request is made at all. Treat it as the whole answer — it already accounts for
whatever the server uses to decide, and probing an endpoint to second-guess it will be
wrong.

**One fetch, two consumers.** `EventDetailPage` owns `fetchEventPredictions` and passes
the result both to `PredictionsTab` and to `PredictionOddsProvider`, which is what lets
`MatchCard` show a live odds chip anywhere in the bracket without any view threading
markets down to it. That mirrors `EventRosterProvider`. If you add a third consumer,
read the context — do not add a second fetch.

**A market has two outcomes or three, and the server decides which.**
`market.draws_allowed` is the flag: a group match races to three maps of four and
can finish level, so the draw is a third thing to back and `price_draw` is a
number; a knockout has to produce a winner and answers `price_draw: null`. Use
`sidesOf(market)` from `predictionsShared.tsx` rather than writing `['a', 'b']`
anywhere — that array is why the draw was invisible on every surface it was
hard-coded into.

`PredictionSide` (`'a' | 'draw' | 'b'`) is deliberately NOT the shared `EventSide`,
which the bracket also uses and where a draw is a result rather than something to
pick. Widening `EventSide` would quietly make `draw` a legal value in map picks and
bracket slots.

**Prices are 0–1 floats, not percentages**, and they sum to 1 across the outcomes
the market offers — two of them or three. `formatPercent` is the only thing that
should turn them into text.

**Markets do not open at 50/50.** The server sets the opening odds from the event
seeding and from results so far, and `opening_price_a|b|draw` is what the market
opened at. Two consequences for the client: a price is never evidence that anybody
has bet, and `priceDrift` is the only honest way to show that a market has moved.
There is no rating in any payload and there is no client surface for one.

**A price can move with nobody betting.** A result in one match re-rates two teams,
which re-prices every later match either of them plays. `price_history` marks those
points `source: 'model'` so a chart can say why the line jumped. It does **not**
mean a standing position changed — see the payout rule below.

**`evenMarketPriceAfter` is a yardstick, not a market.** It is still the server's
closed form at zero shares and no prior, and its test still pins it to the server's
number, but no real market opens even any more. It exists so the manage panel can
compare two liquidity settings against a reference that does not move as the cup is
played. Do not use it to describe an actual match.

**The per-match cap is per player, and arrives resolved.** Use `wallet.max_stake` as
given: it is specific to that player and to that moment, so it must not be derived from
anything in `config`, cached across players, or assumed to hold after a settlement.

**A prediction is paid at the price the board showed, not an average.** `quote.avg_price`
equals `quote.price_before`, so "your odds" and "board odds" are one number — do not
render them as two. The board still moves for the next player. One prediction beats
splitting the same total, which is the opposite of what LMSR alone would do.

**Send `max_slippage` on every bet.** The quote reserves nothing, so somebody else can
move the market between the quote and the button. `BetModal` sends the quoted price plus
a small tolerance and re-quotes when the server refuses; without it a player silently
buys at whatever the price became.

**A payout is `Math.floor(shares)`.** `position.shares` is the payout the server locked
in when the prediction was made and it never changes afterwards, whatever the price does.
The UI must never recompute a payout from the current price — that number is history, not
a live quote. This matters more than it used to: a market re-prices when a team is
re-rated, so a held position routinely sits at odds nobody could buy at now, and
that is correct rather than a bug to paper over.

**One outcome per match, forever.** A player who holds a position can only add to
it; the bet slip locks the other tiles off `your_position.side`. With three outcomes
that is stricter, not looser. A draw settles as a WIN for its backers on a market
that offered one and as a refund on one that did not, which is why `outcomeLabel`
branches on `draws_allowed` rather than on the outcome alone.

**Quotes are indicative and reserve nothing.** `fetchEventPredictionQuote` is debounced
in `BetModal` and re-priced by the server on submit, so the confirmed payout can differ
from the previewed one if somebody else predicts in between.

**Timestamps in prediction payloads carry an offset (`+00:00`); bracket payloads do
not.** `parseApiInstant` in `predictionsShared.tsx` handles both by treating a bare
`YYYY-MM-DD HH:MM:SS` as UTC. Use it rather than `new Date(...)` for anything a countdown
depends on — `closes_at` is a real deadline and an hours-off render is a lie about it.

**Matchup insights and the homepage strip are separate reads.**
`fetchEventPredictionInsights` is fetched lazily when a card is expanded, not with
the market list, because most cards are never opened.
`fetchUpcomingPredictions` (`/me/predictions/upcoming`) backs
`home/ClosingSoonBanner`, one line at the top of the homepage that returns `null`
when nothing is closing. The API only returns markets with a real close time inside
the window, and the banner re-filters against its own clock so a market that expires
while the page is open drops off rather than counting down to nothing.

**Markets sort by `closes_at`, not by bracket position.** The only question on this
page is what can still be predicted on and how long is left. A market with no close
time sorts last; it is not upcoming in any useful sense.

**Writes go to `api.utbt.net`, never the gateway**, like every other authenticated
mutation the launcher makes.

**Empty is a legitimate answer.** The list, leaderboard and wallet fetchers use
`apiGetOr` with a fully-formed fallback, because a disabled event, an unclaimed wallet
and an empty leaderboard all answer with no `data` key, and `apiGet` would surface that
as `Invalid response format from server` in front of the user.

**There is no ratings surface here, by decision.** The strengths behind the opening
odds are readable only through a manager API call. Do not add a screen for them, and
do not add a client-side model that tries to reconstruct one.

**Manager surface**, gated on the `can_manage_bracket` field of `MyEventStatus`: the
settings and per-market controls in `manage/PredictionsManagePanel.tsx`, and
`manage/MarketControl.tsx` inside the match editor. The latter is there because scoring a
match while its market is still open refunds every prediction on it, which is easy to do
by accident and quiet when it happens — so the manager sees the state and a one-click
close before they score.

### Medal Hunt (`fetchMedalHunt`)

`GET /v2/summary/medal_hunt` takes no params — the caller is identified by the bearer
token. It answers "which medals can I still win", returning the opportunity list
**pre-joined and pre-filtered**: certified best caps on active maps that still have an
unreached medal threshold. The response is `{ opportunities: [...] }`, an object rather
than a bare array, so the zero-opportunity case (a brand-new player) still carries the
key; `fetchMedalHunt` returns `[]` for any non-array payload so a malformed response
degrades to the card's empty state instead of throwing.

Each row is `{ mapName, difficulty, currentTime, targetTime, targetMedal, improvement,
improvementPct, worldRecordAdded }`. The rows are **unsorted** — the card owns all
filtering, sorting and paging, and they stay instant and client-side.
`worldRecordAdded` is a date string with **no UTC offset**, so `new Date()` parses it as
local time; `medalHunt.ts::parseDateTime` turns it into the `worldRecordAddedTime` epoch
the "recently lost" sort uses, falling back to `0` when the date is absent or
unparseable. It is always `null` for team maps. `difficulty` is `""` rather than `null`
when a map has none.

The medal ladder itself (which medal is targeted, the improvement epsilon) is decided
server-side; the launcher does not reimplement it. `app/utils/medalHunt.fixture.json`
pins the exact contract — the same fixture is asserted against the API's own
implementation, so a divergence fails a test rather than silently reordering the card.

The player-detail caps list (`fetchCapsForUser`, `UserCapRow`) accepts
`capFilter: 'disallowed'` to return only that player's disallowed caps — each row
then carries `disallowed_at` + `disallow_reason`, sortable via `sort: 'disallowed_at'`.
`UserSummaryCounts.disallowed_caps` is the matching total (powers the public
"Disallowed" profile tab, hidden when zero).

### Admin API

The admin page (`app/components/pages/admin/`) calls a staff-gated slice of
`api.ts`. The server authorizes every endpoint (moderator+) and audit-logs the
mutations; the client role checks (`isStaff` in `app/utils/roles.ts`) are UX
only — never the security boundary. Fetchers grouped by dashboard section:

| Area | Functions |
|---|---|
| Overview | `fetchAdminOverview`, `fetchAdminActivity` |
| Users | `fetchAdminUsers`, `fetchAdminUsersCount`, `fetchAdminUser`, `warnUser`, `banUser`, `unbanUser`, `assignTitleToUser` |
| Titles | `fetchAdminTitles`, `fetchTitleHolders`, `createTitle`, `updateTitle`, `deleteTitle`, `unassignTitleFromUser` |
| Caps | `fetchAdminCaps`, `fetchAdminCapsCount`, `disallowCap`, `reallowCap`, `verifyCapFlag`, `unverifyCap`, `verifyCapWithDemo` |
| Maps | `fetchAdminMaps`, `fetchAdminMapsCount`, `fetchAdminMapTags`, `createMap`, `updateMap`, `fetchDifficultySyncPreview`, `applyDifficultySync`, `fetchMapvoteStatus`, `setMapvoteAnnouncement`, `regenerateMapvote` |
| Map authors | `fetchMapAuthorStrings(+Count)`, `fetchLinkedMapAuthors`, `fetchMapAuthorCandidates`, `fetchMapAuthorPreview`, `linkMapAuthor`, `unlinkMapAuthor` |
| Patches | `fetchAdminPatches`, `createPatch`, `updatePatch`, `setPatchActive`, `deletePatch`, `derivePatch` |
| Game hosts (admin only) | `fetchAdminHosts`, `createAdminHost`, `updateAdminHost`, `setAdminHostServers`, `issueAdminHostToken`, `removeAdminHostToken`. A host holds exactly one token; issuing when one exists replaces it, and the server revokes the old one in the same transaction. The plaintext comes back once and is never retrievable again - show it, let the admin copy it, and do not persist it anywhere in the renderer. Both replace and remove are destructive and are behind a ConfirmDialog that states the consequence |
| Anti-cheat | `fetchAcShared(+Count)`, `fetchAcCapDelta(+Count)`, `fetchAcLowFpsWr(+Count)`, `fetchAcIdentifier`, `fetchAcCapStats`, `fetchAcCapMapComparison`, `allowCap`, `unallowCap` |
| Audit | `fetchAuditLog`, `fetchAuditLogCount`, `rollbackAudit` |

`toActiveTitle(row)` normalizes an admin/title-shaped row (plain-number `rarity`)
into the `ActiveTitle` that `PlayerInfo` and the title-style helpers expect.

`fetchAdminActivity(token, { start, end })` takes an arbitrary UTC date range — two
inclusive `YYYY-MM-DD` days — and that is the only shape the Overview section sends;
the quick presets in `RANGE_PRESETS` (`app/utils/chartBuckets.ts`, up to `10y`) are
just shortcuts that fill those two dates. The server owns the granularity and answers
with `bucket` (`hour`/`day`/`week`/`month`, chosen from the span so a decade never
asks for daily points — `bucketForSpanDays` mirrors the same ladder for labelling
before the response lands), the effective bucket-aligned `start`/`end` it actually
queried, the `requestedStart`/`requestedEnd` that were asked for, `partialFrom`,
`dayResolutionSeries` (series whose true resolution is coarser than `bucket`;
`new_users` is day-resolution at hourly granularity) and `unavailableSeries` (series
this range cannot answer at all — session history is not kept far enough back for an
hourly range months in the past). Both lists are series keys, and each chart labels
itself from them rather than drawing an unexplained flat zero.

Both edges snap OUTWARD to whole buckets, so the chart's first bucket is never a
short one — that partial-bucket mismatch is what used to make every series dip at the
start and end of the range. `points` covers EVERY bucket in the effective range,
including empty ones, so a zero and a missing bucket are never conflated. The final
bucket is usually still accumulating; it carries `partial: true` rather than being
dropped, and `splitPartialSeries` moves those buckets onto a second dashed series so
an in-progress period reads as in-progress instead of as a crash. Call
`validateRange` before fetching — the server rejects a reversed range, a start in the
future, an empty `start=`/`end=`, or a span over `MAX_RANGE_YEARS` with a 400 whose
message surfaces through `ApiError`.

**Every bucket timestamp is a UTC instant, so every label must be formatted with
`timeZone: 'UTC'`** (`formatWeekRange` already is). Formatting them in the viewer's
zone shifts the header and the week labels by a day — east of UTC a Monday-start week
renders as an 8-day span — and contradicts the `UTC` marker on the date inputs. The
date inputs debounce by `DATE_COMMIT_DELAY_MS` (400ms, and commit on blur/Enter)
before the range is applied, because a native date input fires `change` on every
year-spinner step and each commit is a fresh set of aggregate queries; preset buttons
stay immediate. A single-bucket range (the `Today` preset just after UTC midnight)
draws nothing as a line, so `needsPointMarkers` turns on dots for it.

The map-author fetchers back `MapAuthorsModal` (opened from the Maps section). A map
credited to a plain name (`author_str`) scores for nobody; linking it to a player
(`author_ref`) is what makes that player's mapper achievements count. Every author
name goes through `encodeURIComponent` — the real data contains `&`, `/` and `.`.
`linkMapAuthor` sends `expectedMaps` from exactly the list the preview rendered, and
the server returns 409 if that set has changed since, so a stale preview can never
re-credit maps the admin did not see. The Review step lets the admin tick a subset of
a name's maps; `linkMapAuthor` then sends that subset as `maps` and only those are
re-credited, while unticked maps keep their `author_str` and stay unlinked. `Map.author_ref` is a **string**, not a number:
it is a Discord id large enough to lose precision as a JS number.

### Cap Detail page endpoints

The Cap Detail page (`app/components/pages/CapDetailPage.tsx`, opened by clicking
any cap time — see `CapTimeLink` / the `open-cap` event in `agents/navigation.md`).

- **`GET /caps/<cap_id>/detail`** → `CapDetail`. Enriched single cap: the full
  `cap` record (movement/client fields) + parsed `checkpoints` and
  `wr_checkpoints` (`{zone, cumulative, segment}`) + `rank_on_map` /
  `total_on_map` / `neighbors` (above/below) + `deltas` & `medals` (WR + each
  medal threshold) + `server` `{name, region}`. Negative delta = faster than the
  threshold. Used for both the page and the compare-run overlay
  (`fetchCapCheckpoints`).

Compare-run picker reuses `fetchMapLeaderboard` (`/caps/leaderboard/map/<name>`).

### World Records page endpoints

The World Records page (`app/components/pages/WorldRecordsPage.tsx`) shows the
fastest cap on every map.

- **`GET /v2/world_records/`** → `Record[]`. One row per map (the WR). Supports
  `limit`/`offset` (limit clamped 1–200), `sort` (`asc`/`desc`), `sort_by`
  (`added`/`time`/`map`/`holder`/`difficulty`), `search` (matches map **or**
  player alias), `difficulty_min`/`difficulty_max`, `user` (single holder — used
  by the player-detail WR card), `users`/`difficulties`/`years` (CSV `IN`),
  `time_ranges` (CSV of `min-max` cap-second bands, OR'd), `map` (fuzzy), `maps`
  (CSV exact), `added_since`, and `count=true`. Each row carries **`active_title`**
  (selected title) and map **`difficulty`**. The page paginates **server-side**,
  one page at a time, mirroring `PlayersPage` — `fetchWorldRecords` for the page +
  `fetchWorldRecordsCount` (`count=true`) for the total, with a per-page cache +
  neighbour prefetch. Search / difficulty / timeframe / favorites are pushed to
  the query (favorites → `maps` CSV; timeframe → `added_since`).
- **`GET /v2/world_records/rushers/`** → `{ total, total_records, max_count, items }`
  (`fetchRushers`; its response envelope already carries `total` / `total_records`
  / `max_count`, so no separate count call). Per-player WR aggregation (count, median,
  average WR time) computed server-side. Powers the page's "Top Rushers" mode;
  `total_records` + `max_count` are global (unfiltered) and drive share-% + bar
  widths. Supports `limit`/`offset`, `search` (alias), `count=true`.
- **`GET /v2/world_records/filter_options/`** → `{ holders: [{user_id, alias, count}], years }`
  (`fetchWorldRecordFilterOptions`). Option lists for the records-list filters —
  every WR holder (most prolific first, value = `user_id` → passed back as `user`)
  and every year a WR was set. Fetched once on page mount.
- **`GET /v2/world_records/progression/<map>`** → `WorldRecordProgressionEntry[]`
  (`fetchWorldRecordProgression`). Chronological history of every cap that set a
  new WR on that map. Powers the `WorldRecordProgressionModal` drill-down.

## Team maps & team runs

Some maps are **team maps**, capped by a fixed-size squad rather than a single
player. `/maps*` rows carry the authoritative **`required_players`** value
(`number`, 1–12). A value of `1` is a solo map; values above `1` are team maps.
Map names are not used to infer team size.

A **team run** is one squad's shared attempt. Its time is the **slowest member's**
time; it counts as **verified** only once **every** member has uploaded their
demo. For each unique member combination, the leaderboard shows its fastest
verified run and shows a certified run only when it is faster than that verified
run (or the roster has no verified run).

- **`GET /caps/leaderboard/team/map/<map>`** → `TeamLeaderboardEntry[]`
  (`fetchTeamMapLeaderboard`). One row per member combination:
  `{ id, map, added, cap_time_seconds (team time), complete, verified, disallowed,
  state, team_size, user
  (';'-joined member ids), medal, members }`, where each `members[]` entry is
  `{ user, alias, cap_id, cap_time_seconds, verified }`. Options →
  `verified_limit`, `unverified_limit`, `member` (single member id), `before`
  (pagination cursor), `columns`.
- **`GET /caps/team_runs/<team_run_id>`** → `TeamRunStatus`
  (`fetchTeamRunStatus`): `{ complete, team_time_seconds, team_cap_id, members,
  is_combination_best_verified, is_combination_best_unverified, is_world_record }`.
  Used to render a run's per-member breakdown and to gate what the demo watcher
  auto-uploads for team maps.
- A cap may belong to a team run: `/caps` rows and the Cap Detail `cap`
  (`/caps/<id>/detail`) carry **`team_run_id`** (`string | null`), and
  `GET /caps?btpog_ids=<id>&columns=cap_type,team_run_id` returns it alongside
  `cap_type`.

## Avatar URLs

Discord avatars are served at:

```
https://gateway.utbt.net/users/{userId}/avatar
```

Fallback on error: `https://cdn.discordapp.com/embed/avatars/{userId % 5}.png`.
`PlayerInfo` handles both — never write an avatar `<img>` directly.

Team images are served by the API and built by `teamAvatarUrl(team)`, which returns
`null` when `team.has_avatar` is false and appends `avatar_updated` as a cache-busting
`?v=`. `TeamAvatar` renders it with an initials fallback. This is a *team* crest, not a
player avatar, so the `PlayerInfo`-only rule does not apply to it.

Map screenshots are served by the API:

```
{API_BASE_URL}/screenshots/{encodeURIComponent(mapName)}.png
```

Fallback: `default.png` on the same path. `MapThumbnail` handles both; it also
accepts an optional `version` prop (use the map's `screenshot_updated`) appended
as a cache-busting `?v=`. The API serves screenshots `Cache-Control: no-cache`, so a
replacement is picked up on the next revalidation even without `version` — pass it
anyway wherever you have it, since it makes the swap instant and skips the round trip.
Map payloads expose `has_screenshot` + `screenshot_updated`; both need to be in the
`columns` list of any fetch whose UI shows them (`MAP_METADATA_COLUMNS` in
`MapDetailPage`, `AUTHORED_MAP_COLUMNS` in `AuthoredMapsCard`). The legacy
`https://utbt.net/images/screenshots/{mapName}.png` URL keeps serving the same
files for previously shipped builds — new code must use the API URL.

### Changing a map screenshot

`uploadOwnMapScreenshot` (`POST /maps/{mapName}/screenshot`) is the **only** upload
path, used by mappers and staff alike — the admin dashboard calls it too, so there is
one crop UI and one contract. `deleteMapScreenshot` stays in the staff slice; there is
no mapper-facing delete.

The API authorizes the upload itself: the caller must be the map's linked
`author_ref` (a matching `author_str` name grants nothing) and the map must still be
active, otherwise it answers 403. Staff bypass both conditions. The renderer mirrors
that check to decide whether to *show* the control (`MapDetailPage`,
`AuthoredMapsCard`, `MapsManagementSection`) — never treat the client-side check as
the authorization.

`MapScreenshotModal` is the single UI for all three surfaces. Screenshots render as
squares, so it crops client-side: drag to pan, slider to zoom, then a canvas exports
a square PNG of at most 1024 px. The crop maths run off the frame's **measured** width, not
the 320 px maximum — on a narrow phone the box shrinks, and a hardcoded size would
export a region wider than the one on screen. That measurement is keyed on `open`,
because `ui/modal.tsx` returns `null` while closed and a mount-only observer would
never see the element. Zoom is capped so
the crop never falls below the 256 px minimum the API enforces, and the API
centre-crops anything that arrives uncropped. `onUploaded` hands back the updated map
so the caller can refresh `has_screenshot` + `screenshot_updated` without a full page
reload.

Stored screenshots are always square. Surfaces that are **not** square must not
centre-crop them a second time: pass `fit="blend"` to `MapThumbnail` (contains the
square and fills the rest with a blurred copy of it) or make the box `aspect-square`.
The heroes use `blend`; the homepage poster grid is square, because a blur per tile
would blow the CSS runtime budget.

Region flags (server list):

```
https://flagcdn.com/w40/{2letterCode}.png
```

`getRegionFlag(region)` in `server-utils.ts` returns the URL.

> Allowed remote hosts are pinned in the renderer CSP (`lib/main/app.ts`
> `connect-src` / `img-src` / `media-src`). A new remote host won't load until
> it's added there.

## Map download service

External service that packages a map + its dependencies into a zip laid out for
direct extraction into a UT99 install:

```
GET https://api.utmapdownload.com/download?mapName={mapName}
```

The service caches packages — the first request for a map can take many seconds
while it builds the zip. Use `downloadMapZip(mapName, timeoutMs?)` in
`app/utils/api.ts` (default 30s `AbortController` timeout). Pair with
`window.conveyor.maps.extractToInstall(mapName, bytes)` to extract into the
configured install dir without overwriting existing files.

## IPC (`window.conveyor.*`)

Server lists, patrons, game launch, ini read/write, and map/demo file writes go
through the main process over a typed IPC bridge, not over HTTP from the
renderer. The full channel inventory + how to add one lives in
[`lib/conveyor/README.md`](../lib/conveyor/README.md). Don't sprinkle
`window.conveyor.*` calls through the renderer — wrap them in a hook or thin
utility if used in more than one place.

## Map favorites — dual storage

Map favorites stay in sync between two stores:

1. **The backend** — source of truth. Fetched via `fetchUserFavorites`.
2. **`UTBT.ini`** — what the game actually reads. Read/written via the
   `favorites` IPC namespace.

Sync logic lives in `Main.tsx` (via the `useFavorites` hook):

- On login: fetch favorites → diff against ini → if mismatch, prompt the user via
  `FavoritesSyncModal` (db-wins / ini-wins / merge).
- On toggle: optimistic update → write to the backend → mirror to ini.
- On game close: re-read ini (the game may have changed favorites) → replace
  backend.

Don't bypass this dance — favorites toggles must go through `Main.tsx`'s
`toggleFavorite`, which already wires persistence + rollback. See
`agents/state-patterns.md` for the persistence framing.

## Patreon members — cached tier lookup

Patreon supporters get a heart next to their name everywhere `PlayerInfo` renders
(and on the profile hero). The data comes from the gateway `/patreon` endpoint
via `fetchGatewayPatrons()` in `app/platform/gateway.ts` (IPC on desktop, direct
gateway fetch on web — same shape either way), returning Discord user ids bucketed
by tier — the same id the launcher uses as `userId`, so matching is a direct
lookup. The server list uses the same seam (`fetchGatewayServers()` → gateway
`/server-info`).

`app/utils/patreon.ts` owns it: a module-level store (`useSyncExternalStore`) so
all `PlayerInfo` instances share one fetch. `loadPatreonMembers()` is
single-flight and caches the id→tier map in `localStorage` under `utbt:patreon:v1`
with a 1h TTL — members rarely change, so it isn't refetched per render.
Components read it via `usePatreonTier(userId)` (returns `0|1|2|3`, lazy-loads on
first use). `Main.tsx` warm-loads it once on mount. Clear the localStorage key to
force a refetch.

## Server favorites — server-side, per account

Server favorites are their own account resource on the API, not UI state: they
follow the signed-in account across the desktop launcher and the website with no
local tier at all. Fetchers live in `app/utils/api.ts`
(`fetchUserFavoriteServers` / `addFavoriteServer` / `removeFavoriteServer`,
against `/user_favorite_servers`); `app/hooks/useServerFavorites.ts` owns the
set and the optimistic toggle, and `Main.tsx` exposes it as `favoriteServerIds`
+ `favoriteServersLoadFailed` + `toggleServerFavoriteOrLogin`.

Two rules the hook enforces, because getting either wrong makes the launcher
delete a favorite the user still wants:

- **Toggles serialise per server id.** A second click on a star waits for the
  first write to settle, so a double click resolves to one net state instead of
  racing a POST against a DELETE. A failed write is undone by reversing that one
  operation against the live set — never by restoring a snapshot, which would
  wipe another server's toggle that succeeded in the meantime.
- **A failed read is not an empty list.** `fetchUserFavoriteServers` throws on a
  non-OK response like its sibling writers; the hook catches it and raises
  `favoritesLoadFailed`, and Home's card says so instead of rendering the "you
  have no favorites" empty state with every star dark.

**Keyed by the server's API `id`**, never a hostname or `ip:port` — those change,
and the API rejects anything that is not a resolved server id. `id` is on every
row of the server list (`fetchGatewayServers()` → `Server.id`), so the star in
the Servers tab and the Home "Your Favorite Servers" card both key off the same
value.

Signed out there are no favorites: the set is empty, the star raises the sign-in
modal instead of writing, and Home's card shows a sign-in prompt. Home renders
the favorites that appear in the current live server list, so a favorite that is
not currently listed is simply absent rather than shown as a stale row. Joining
is desktop-only (`capabilities.game`); the web card is the same list without the
join/spectate buttons.
