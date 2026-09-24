---
doc: data-sources
read_when:
  - "fetching data from the API (maps, records, players, caps, reviews, favorites)"
  - "adding or changing a helper in app/utils/api.ts"
  - "needing an avatar, map screenshot, region flag, or map-download URL"
  - "wiring map/server favorites or Patreon tier lookups"
  - "reading a match's pick/ban state, sending a pick/ban command, or rendering from the pick/ban view model"
keywords: [api.ts, fetch, endpoint, accessToken, avatar, MapThumbnail, favorites, patreon, downloadMapZip, world_records, caps, predictions, draw, odds, schedule, proposal, slot, whose_turn, resolved_window, countdown, nav badge, fetchMyTournaments, SlotPickerModal, SlotGrid, DateTimeField, slotGeneration, proposeMatchSlots, withdrawMatchProposal, acceptMatchProposal, fetchMatchSchedule, ApiError, expected_match_duration_minutes, fetchPickBanConfig, PickBanConfig, PickBanPoolMap, MapsTab, mapsShared, stagesWithPools, tagBadgeVariant, pick/ban, fetchPickBanState, ETag, If-None-Match, 304, X-Server-Now, server_now, clock offset, reveal_at, sendPickBanCommand, sendPickBanManagerCommand, pickBanErrorCode, fetchPickBanQueue, buildPickBanView, setPickBanStageConfig, setPickBanStagePool, copyPickBanStagePool, pickBanEditor, stage pool]
provides: "the client-side API contract the launcher consumes + asset URLs + favorites/patreon sync models"
not_here:
  - "IPC channels (window.conveyor.*) → lib/conveyor/README.md"
  - "how UI state persists in localStorage → state-patterns.md"
  - "the procedure to wire a new endpoint into the UI → skill: consume-api-data"
sections: [backend-api, errors, admin-api, event-brackets, event-scheduling, event-predictions, public-maps-tab-pick-ban-pools, event-pickban-sessions, event-pick-ban-setup, changing-a-map-screenshot, cap-detail-page-endpoints, world-records-page-endpoints, team-maps-and-team-runs, avatar-urls, map-download-service, map-favorites-dual-storage, patreon-members, server-favorites, account-state-and-badges]
last_verified: 2026-09-24
verify_against: [app/utils/api.ts, app/utils/chartBuckets.ts, app/components/pages/admin/components/controls.tsx, app/components/pages/admin/sections/HostsManagementSection.tsx, app/utils/patreon.ts, app/utils/server-utils.ts, app/hooks/useServerFavorites.ts, app/components/pages/events/manage/formatFields.tsx, app/components/pages/events/bracket/bracketShared.tsx, app/components/pages/events/bracket/BracketTab.tsx, app/components/pages/events/predictions/predictionsShared.tsx, app/components/pages/events/predictions/PredictionsTab.tsx, app/components/pages/events/schedule/scheduleShared.tsx, app/components/pages/events/schedule/ScheduleTab.tsx, app/components/pages/events/schedule/SlotPickerModal.tsx, app/components/pages/events/schedule/slotGeneration.ts, app/components/pages/events/schedule/SlotGrid.tsx, app/components/pages/events/manage/DateTimeField.tsx, app/components/pages/events/eventsShared.tsx, app/components/pages/EventDetailPage.tsx, app/utils/timezone.ts, app/components/pages/events/manage/ScheduleOversightPanel.tsx, app/components/pages/events/ManagePanel.tsx, app/components/main/Main.tsx, app/components/layout/AppLayout.tsx, app/components/pages/events/maps/MapsTab.tsx, app/components/pages/events/maps/mapsShared.ts, app/components/pages/events/pickban/pickBanView.ts, app/components/pages/events/pickban/pickBanSession.ts, app/components/pages/events/pickban/clockOffset.ts, app/components/pages/events/manage/pickban/pickBanEditor.ts, app/components/pages/events/manage/pickban/PickBanPanel.tsx]
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
| Events | `fetchEvents`, `fetchEvent`, `fetchEventTeams`, `fetchEventLfp`, `fetchMyEventStatus`, `fetchMyTournaments` (→ `/me/tournaments`, every tournament the caller has a team membership in, each row `{tournament, team, membership_status}` — the cross-event "which team is mine, per event" lookup `fetchMySchedule` entries don't carry themselves), `createEventTeam`, `inviteEventPartner`, `acceptEventInvite`, `declineEventInvite`, `updateEventTeam`, `deleteEventTeam`, `joinEventLfp`, `leaveEventLfp`, `setEventVolunteer`, `deleteEventVolunteer` (cup signups; an event is addressed by its `slug`) |
| Event scheduling | `fetchMySchedule`, manager-only: `fetchEventScheduleOversight`, `fetchEventAuditLog` (→ [Event scheduling](#event-scheduling)) |
| Event pick/ban setup | `fetchPickBanConfig`; manager-only: `setPickBanStageConfig`, `setPickBanStagePool`, `copyPickBanStagePool` (→ [Event pick/ban setup](#event-pickban-setup)) |
| Event brackets | `fetchEventBracket`, `fetchEventMatch` (→ [Event brackets](#event-brackets)); manager-only: `fetchEventFormats`, `setEventBracketPublished`, `setEventFormat`, `updateEventFormatSpec`, `setEventSeeds`, `updateEventStage`, `generateEventStage`, `generateEventRound`, `resetEventStage`, `updateEventGroup`, `createEventMatch`, `updateEventMatch`, `deleteEventMatch`, `setEventMatchResult`, `clearEventMatchResult`, `fetchEventCapCandidates`, `linkEventMatchMapCaps`; staff-only: `createEventFormat`, `updateEventFormat`, `deleteEventFormat`, `fetchEventFormat` |
| Admin (staff-only) | the moderator/admin dashboard slice — see [Admin API](#admin-api). `fetchAuditLog`/`fetchAuditLogCount` take `actors` (`staff` default / `players` / `all`): the default keeps player-written rows, such as a mapper replacing their own screenshot, out of the staff feed |
| Event pick/ban sessions | `fetchPickBanState` (ETag-aware), `sendPickBanCommand`, `sendPickBanManagerCommand`, `postPickBanCommand`, `pickBanErrorCode`; manager-only: `fetchPickBanQueue` (→ [Event pick/ban sessions](#event-pickban-sessions)) |

Most fetchers take `accessToken` first (Discord OAuth bearer). On the web build,
logged-out pages pass the `ANONYMOUS_TOKEN` sentinel (exported from `api.ts`)
instead — `apiRequest` strips it so the request goes out with no Authorization
header, and the API's public read endpoints accept that. Never send
`ANONYMOUS_TOKEN` into a mutation or "my X" fetcher; those require a real token.
The web login flow itself uses `POST /auth/discord/token` + `/auth/discord/refresh`
(see `agents/web-target.md` for the full contract).

### Errors

A failed request answers `{ success: false, error: "<human-readable reason>" }` — the
rate limiter is the one endpoint that uses `reason` instead, and a handful of
scheduling exceptions (see below) add a third field, `code`, alongside it. `apiErrorFor`
in `app/utils/api.ts` builds `ApiError`'s two distinct fields from those: `.message`
(and the `Error` itself) reads `error` then falls back to `reason`, exactly as before;
`.reason` reads `code` only — it is `undefined` on the ordinary `{error}` shape every
other endpoint still answers with. Surface `e.message` in the UI for a human-readable
explanation, falling back to `Request failed (<status>)` only when the body has none;
branch on `e.reason` only when you have a specific machine code to check for (see
`MatchNotSchedulableException`/`ProposalSlotStaleException`/
`ProposalSlotConflictsWithBookingException` in [Event scheduling](#event-scheduling)
below — the only exceptions that currently set it). **Don't use `res.statusText`**:
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

Each stage also carries `expected_match_duration_minutes` (`number | null`) — the
manager-set override, or `null` to use the server's per-kind default. The slot
picker (below) needs this to size a candidate slot and to check it against a
team's other bookings, so it mirrors the server's fallback table client-side rather
than leaving matches with no override undated:
`DEFAULT_MATCH_DURATION_MINUTES_BY_KIND` in `schedule/slotGeneration.ts`
(`groups: 75, swiss: 60, single_elim: 60`) — keep it in sync with
`scheduling_service.DEFAULT_MATCH_DURATION_MINUTES_BY_KIND` on the backend if that
table ever changes.

**Every `EventMatch` carries a `resolved_window: {opens_at, closes_at}`**
(offset ISO strings or null), computed server-side from the match/stage/
tournament dates — never a proposal or negotiation field, so a spectator
reading the bracket only ever sees a booked time or this window, never who
proposed what. `MatchCard` (`bracket/bracketShared.tsx`) renders a booked
`scheduled_at` with `formatSlotTime`/`useDisplayTimezone()` (below), and for a
still-`pending` match with both teams decided, derives a purely client-side
`schedulingWindowState` from the window bounds against `Date.now()` — "opens
`<date>`", "awaiting a time" or "window closed" — as its unscheduled
indicator. This is client math, not a signal from `scheduling_service.
is_overdue` (that boolean isn't on this payload and doesn't need to be, since
the ticket that needs a true overdue flag is the manager oversight surface,
already covered below). `EventDetailPage` separately scans every stage's
matches for the viewer's own `scheduled` ones and shows a live countdown
(`useNow`/`formatCountdown` from `predictions/predictionsShared.tsx`) to the
soonest still-future one — `nextOwnMatch` in `bracketShared.tsx`.

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

### Event scheduling

Captain-arranged match times. The Schedule tab's list (below) is read-only;
proposing, countering, withdrawing and accepting a slot all happen in one modal,
`schedule/SlotPickerModal.tsx`, reachable both from a card in that list and from a
pending, both-teams-decided match card on the bracket (`schedulerEligible` in
`bracket/bracketShared.tsx` gates the bracket entry point — `BracketTab` threads an
`onScheduleMatch(matchId)` callback down through each stage view to `MatchCard`'s
existing `onClick`). `EventDetailPage` owns the modal's open/closed state
(`schedulerMatchId`) so either entry point opens the same instance, and passes it
`bracket` (already loaded for the Bracket tab) purely to look up the opening
match's stage for its `kind`/`expected_match_duration_minutes`.

**The modal's own per-match fetch is a distinct type from the list's `ScheduleEntry`.**
`fetchMatchSchedule(token, slug, matchId)` (→ `GET
/tournaments/<slug>/matches/<matchId>/schedule` → `{ schedule }`) returns a
`ScheduleEntryDetail`, not a `ScheduleEntry` — its `match` is a `ScheduleMatchDetail`
whose `team_a`/`team_b` are `ScheduleMatchTeamRef`, which adds a `booked:
{match_id, starts_at, ends_at}[]` array over the plain `EventBracketTeamRef` the
bracket and the schedule list use. That is each team's *other* booked matches,
computed server-side — the launcher never recomputes a team's booking calendar
itself, only renders what this route hands it. `ScheduleMatchDetail` is otherwise
assignable to (a superset of) `EventMatch`, so the existing `whoseTurnLabel` /
`proposerName` / `schedulabilityReason` helpers (`scheduleShared.tsx`) accept it
unchanged.

**Writes go through three more fetchers, all on the same per-match base path:**
`proposeMatchSlots(token, slug, matchId, { team_id?, note?, slots })` (→ `POST
.../proposal`) creates or supersedes the match's one open proposal — the same route
whether the match is still pending or already booked, opening a reschedule (subject
to the 12-hour captain freeze and market-bet gate the server enforces);
`withdrawMatchProposal(token, slug, matchId)` (→ `DELETE .../proposal`, no body)
withdraws it — only the proposing team or a manager may, and the route does not
take a `team_id`, so the withdraw button's visibility is not gated on the acting-team
selector below; `acceptMatchProposal(token, slug, matchId, { team_id?, slot_index })`
(→ `POST .../proposal/accept`) books the match at one slot of the live offer. All
three return the same `{ schedule: ScheduleEntryDetail }` envelope, so the modal
never needs a second fetch after a write — it just replaces its state with the
response.

**`team_id` in the body is only for a manager acting without a roster spot.** A
rostered player's own team is unambiguous and the server accepts the field being
omitted for one — the modal still sends it whenever it knows the value (the
viewer's own team, or whichever side a manager has picked from the "Acting as"
selector that only renders when the viewer has no team of their own), matching
what the other optional-team-id-bearing routes on this page already expect. A
manager who hasn't picked a side yet has the propose/counter/accept controls
disabled, because `create_proposal`/`accept_proposal` both raise
`MissingRequiredFieldError` without it — `withdraw_match_proposal` does not, so
withdraw stays enabled.

**A failed accept can name the one slot that died, via `ApiError.reason` (see
[Errors](#errors) above).** `slot_no_longer_valid` (the chosen slot fell inside the
lead time or outside the window between the offer and the accept) and
`slot_conflicts_with_booking` (a fresh conflict appeared) are the two recognized
codes; the modal marks that `slot_index` dead with the server's message rather than
refetching and guessing which slot changed. Any other `ApiError` — including a
plain `slot_no_longer_valid`-shaped 409 from a route this modal doesn't call —
falls back to a generic inline error instead.

**Slot generation and the four unavailability reasons are pure functions**, deliberately
split out of any component so they're covered directly by vitest rather than by
component tests: `schedule/slotGeneration.ts` (+ its `.test.ts`) mirrors the
backend's exact validation constants (`MAX_PROPOSAL_SLOTS = 5`, `MIN_LEAD_HOURS = 2`,
`SLOT_BOUNDARY_MINUTES = 15`) and its half-open-interval overlap rule for a booking
conflict. `pickerBounds` gives the earliest pickable start (`max(opens_at, now + lead
time rounded up to a 15-minute mark)`) and the latest (`closes_at` minus the match
duration, so a picked start still finishes before the window closes; the later,
`closes_at`-only bound the server itself enforces is what `slotAvailability`'s
`outside_window` reason checks instead, since that function also judges slots the
grid did *not* generate — e.g. a stale slot of the team's own earlier offer).
`candidateDays` walks every 15-minute-aligned instant between those bounds (capped at
`UNBOUNDED_WINDOW_HORIZON_DAYS` when `closes_at` is null), pairs each with its
`slotAvailability` verdict, and buckets them by calendar day **in the display
timezone** — day boundaries come from `startOfNextZonedDay` (`app/utils/timezone.ts`),
while the slots themselves step in epoch milliseconds, so a DST day simply has 92 or
100 slots. `slotAvailability` judges one instant against the window, the boundary, the
lead time and both teams' booked windows, in that order, returning the first reason
that fails (`'outside_window' | 'off_boundary' | 'inside_lead_time' |
'conflicts_with_booking'`) or `{available: true}`.

**The picker is a day strip + time grid, not a free-form input** (`schedule/SlotGrid.tsx`).
A 7-day paged strip lists every day of the window (days with no open slot are
disabled); the chosen day shows its start times at 30-minute steps, or every 15 minutes
with the "Quarter hours" toggle. Booked-conflict slots are struck through with their
reason as a tooltip; clicking a slot toggles it into the proposal (up to 5), shown as
removable chips above the strip. Picked times are re-judged by `slotAvailability` on
every minute tick, so a chip that has since fallen inside the lead time turns red and
blocks submit until removed. Nothing is typed, so an invalid time can't be entered.
Component rendering, the modal's own poll (`REFRESH_MS = 30_000`, matching the
schedule list's own interval) and its open/close behaviour are not covered by tests —
only the pure functions above are.

**Manager date-time fields go through `manage/DateTimeField.tsx`**, a native date input
plus a 15-minute time `<select>`, whose value is a `YYYY-MM-DDTHH:mm` wall-clock string
in the display timezone. `toZonedInput` / `fromZonedInput` (`app/utils/timezone.ts`)
convert to and from API instants, so the scheduling-window panel and the match editor's
"Scheduled" field read and write in the same zone every time is displayed in — never the
machine's local zone. `CapLinkPicker`'s search range still uses the older
`toLocalInput`/`toIso` pair.

**`fetchMySchedule` is cross-event, like `fetchMyPredictions`.** There is no
per-event scheduling route; `EventDetailPage` fetches the caller's whole
`/me/schedule` and filters to `item.tournament.slug === eventSlug` itself,
the same trade-off `/me/predictions` already made. It only ever returns
`pending` matches — once a match is booked (or otherwise decided) it simply
stops appearing, so this tab never has to render a "scheduled" state.

**The Schedule tab is visible to a rostered team member or a bracket
manager** — `scheduleTabVisible` in `eventsShared.tsx`. A manager with no
roster spot in the event still sees the tab (the same "rehearse the event"
allowance the bracket and predictions surfaces give), but `fetchMySchedule`
is keyed to the caller's OWN team memberships, so a non-playing manager sees
an empty list here, not the whole event's negotiations — that full-event view
is a separate manager-oversight surface, not this tab.

**Slot timestamps carry an explicit UTC offset** (`+00:00`), unlike the
zone-less bracket payloads (`match.scheduled_at` included) — the same split
`agents/data-sources.md`'s prediction timestamps already document, and for
the same server-side reason (see `agents/match-proposals.md` on the backend).
`parseApiInstant` (`app/utils/timezone.ts`) handles it; `predictionsShared.tsx`
re-exports the same function rather than keeping its own copy.

**A slot's `expired` flag is server-computed, not client math.** It means
the slot has fallen inside the minimum lead time by the time of THIS fetch —
it is re-derived on every poll, never cached or recomputed locally.

**Every time renders in the viewer's resolved-or-pinned zone, never a typed
abbreviation.** `formatSlotTime` (`app/utils/timezone.ts` — `scheduleShared.tsx`
re-exports it, same as it does `parseApiInstant`) takes the IANA zone from
`useDisplayTimezone()` and passes it straight to `Intl.DateTimeFormat`'s
`timeZone` option — it does not attempt to render `PST`/`CET`/etc. as text.
`bracketShared.tsx`'s `MatchCard` uses the same function for a booked match's
time on the bracket, rather than the older naive `formatMatchTime` in the same
file (which still backs the predictions market card and the manage panel's
market-close timestamp — untouched, out of scope for the bracket's own
booked-time display).

**Outside the schedule tab, "a proposal is waiting on my team" reuses only the
sidebar badge's RENDERING, not its "new since last visit" persistence.**
`AppLayout`'s `getNavBadge: (view) => number | null` pill (see
`agents/navigation.md`) is fed, for the `events` item, by a second and
unrelated count: `Main.tsx` polls `fetchMySchedule` + `fetchMyTournaments`
together (on sign-in, on window focus, and every 60s while signed in) and
reduces them with `awaitingMyResponseCount`/`myTeamIdsByTournament`
(`scheduleShared.tsx`) — cross-referencing each pending entry's
`tournament.slug` + `whose_turn` against the caller's own *active* team id in
that tournament (`fetchMyTournaments`, → `/me/tournaments`, is what makes this
cheap: one extra request for every tournament the caller rosters a team in,
not an N+1 loop over every event on the platform). This count has no seen
marker — it is not persisted, not cleared by visiting Events, and disappears
on its own the moment the proposal is no longer waiting on the viewer. When
it is nonzero it replaces (rather than adds to) the ordinary "new events"
badge on that nav item, since the two counts mean different things and a
sum would misstate both; `getNavBadgeTooltip` on `AppLayout` lets `Main.tsx`
swap in wording that matches whichever count is actually showing.

**`whose_turn` is a team id, not a role.** `null` means no proposal is open
yet (either side may propose); otherwise it names the team expected to
respond next. `whoseTurnLabel` (`scheduleShared.tsx`) reads it against the
viewer's own team id when they have one in this event, and falls back to
naming the team by side for a manager who doesn't. `ManagePanel`'s Schedule
tab (`manage/ScheduleOversightPanel.tsx`, manager-only) reuses the same
`whoseTurnLabel`/`schedulabilityReason` helpers with `myTeamId: null`, since a
manager isn't necessarily rostered on either side.

**The manager oversight list is a different fetch from the player tab.**
`fetchEventScheduleOversight` (→ `GET /tournaments/<slug>/admin/schedule`)
returns every `pending` match in the event, not just the caller's own team's —
`fetchMySchedule` cannot be reused here. Each `ScheduleOversightEntry` is a
`ScheduleEntry` plus `overdue` (window closed with nothing booked) and
`stalled_since` (when the open proposal last moved, or `null`). `overdue` and
`schedulable: false` can both be true on the same match and answer different
questions — see `agents/scheduling.md` (oversight) on the backend.

**The per-match audit trail reuses the existing event-wide audit fetcher.**
`fetchEventAuditLog` already backed the Signups panel's activity feed; it now
also takes `matchId`, which the server maps to `?match_id=` on the same
`GET /tournaments/<slug>/admin/audit` route. `ScheduleOversightPanel` calls it
per match, lazily, only once a card's history is expanded.

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

### Public Maps tab (pick/ban pools)

`fetchPickBanConfig(accessToken, slug, signal)` (→ `GET
/tournaments/<slug>/pick-ban/config`) is a public read — it works anonymously and
is visible exactly when the event itself is, same as `fetchEvent`. `PickBanConfig`
is `{ stages: PickBanStageConfig[] }`; each stage carries a `pool:
PickBanPoolMap[]` (`{ map, tags, screenshot_version }`) already in stage order and
pool order, plus the pick/ban block/counts a manager-only surface consumes
elsewhere. `screenshot_version` is the pooled map's `screenshot_updated`, passed
straight to `MapThumbnail`'s `version` prop for cache-busting.

`EventDetailPage` fetches this once in the background alongside the bracket/
predictions/schedule fetches — it never blocks the page's initial `loading` state
— and a failed fetch leaves `pickBanConfig` null rather than surfacing an error,
which keeps the Maps tab hidden instead of showing a broken one.
`stagesWithPools` (`events/maps/mapsShared.ts`) is the pure filter behind both the
tab's visibility and its content: any stage whose `pool` is empty is dropped, and
the survivors keep the API's stage/pool order untouched. `MapsTab`
(`events/maps/MapsTab.tsx`) renders each surviving stage as its own section of map
cards (`MapThumbnail` + `MapNavLink` + one badge per tag); `tagBadgeVariant` flags
a tag spelled `Hard` (case-insensitive) as the single warning-tinted variant,
every other tag renders as the default chip.

### Event pick/ban sessions

A match's live map pick/ban. The fetchers sit in `app/utils/api.ts` after the pick/ban
config helpers. Everything else is pure logic in `app/components/pages/events/pickban/`,
and screens render only from its view model, never from the raw payload.

**The state read.** `fetchPickBanState(token?, slug, matchId, { etag, signal })` →
`GET /tournaments/<slug>/matches/<id>/pick-ban`. It is anonymous-friendly, and the payload
is **per viewer** (`viewer`, `capabilities`). Every key is always present, and every
timestamp is ISO with an explicit offset. The payload is the match's current session,
else its latest cancelled or voided one, else `status: 'none'`: a preview of what Open
would create. It returns a `PickBanStateRead`:

- `{ kind: 'fresh', state, etag, serverNow }` on a 200
- `{ kind: 'unchanged', serverNow }` on a 304

**ETag and clock sampling.**

- Send the last `ETag` back verbatim as `If-None-Match`. A 304 means nothing changed: keep
  the previous state **object**, same identity, so nothing re-renders.
- `server_now` is left out of the ETag, so an idle session answers 304.
- Every response carries `X-Server-Now` (ISO UTC). Sample the clock from the body's
  `server_now` on a 200 and from that header on a 304, and skip the sample when it is
  missing.
- `clockOffset.ts` turns each sample into `serverNow − midpoint(sent, received)` and keeps
  the median of the last `CLOCK_SAMPLE_WINDOW` (7) samples, so one slow response can't
  move it.
- The web build reads both headers cross-origin, so the API has to list them in
  `Access-Control-Expose-Headers`. Without them the client still works: every poll is a
  full 200, and a 304 simply skips its clock sample.

**Reading the payload.** `phase` is the server's phase at read time. The view model
re-derives it between polls from the absolute timestamps: `intro_ends_at`,
`spotlight_ends_at`, and each executed step's `at` / `reveal_at`.

- **Reveal lead.** A lock-in is recorded at `at` and revealed at `reveal_at`, 1.5 s later.
  The intro likewise starts 1.5 s after Start. The automatic decider is revealed when the
  ban before it ends its spotlight. **A step is never shown before its `reveal_at`**, so
  every screen animates at the same moment.
- **Spotlight lengths** come from `pacing`: `spotlight` for lettered steps,
  `ban_down_spotlight` for the ban-down and `decider_spotlight` for the decider.
- **Paused.** While `paused`, every timer and pending reveal freezes at `paused_at`. On
  resume, the server shifts the pending timestamps by the pause length.
- **Gate controls on `capabilities`, never on `viewer.roster_captain`.**
  `capabilities.acting_side` is the side the viewer acts for as captain or acting captain.
  A captain replaced by an acting captain has `acting_side: null`.

**Commands.** Every command returns the full new state for the caller, so the actor never
waits for a poll. Every body except Open's carries the expected `version`.

- **Participant commands:** `sendPickBanCommand(token, slug, matchId, command, body)` →
  `POST .../matches/<id>/pick-ban/{ready,unready,hover,lock}`.
- **Manager commands:** `sendPickBanManagerCommand(token, slug, matchId, command, body?)` →
  `POST /tournaments/<slug>/admin/matches/<id>/pick-ban/<command>`. `open` takes no body.
  `lock` takes a `side`, and `override-sequence` takes a `preset_id` or a
  `from_stage_key`.
- The body shapes are typed in `PickBanParticipantCommandBodies` and
  `PickBanManagerCommandBodies`. `hand-over` and `edit-final` are typed loosely until
  their bodies are settled.
- `postPickBanCommand` is the untyped transport under both. Screens call the session
  store's `sendCommand` / `sendManagerCommand` (see `agents/state-patterns.md`), which fill
  in the version themselves.
- **Refusals.** A refusal is an `ApiError` whose `.reason` is a stable code (403
  authorization, 409 state conflict, 422 validation). `pickBanErrorCode(err)` narrows it to
  `PickBanErrorCode`, and `PICK_BAN_ERROR_CODES` lists every code. Show `err.message`, and
  branch on the code only where a screen reacts to a specific one.

**Match queue (managers).** `fetchPickBanQueue(token, slug)` →
`GET /tournaments/<slug>/admin/pick-ban/queue`. Each `PickBanQueueEntry` is one match: its
stage, round, time and teams, its session status, its Ready and online counts, and whether
it is `startable` (with the `blocking_reason` when not). The type is **provisional**: check
it against the live route before building on it.

**Polling cadence** (`pickBanSession.ts`):

- Every second (`ACTIVE_POLL_MS`) while the status is `lobby`, `running` or `paused` and the
  document is visible.
- Every 10 seconds (`IDLE_POLL_MS`) for `none`, `complete`, `cancelled` and `voided`, and
  after a first load refused with 401, 403 or 404.
- Nothing while the document is hidden. It polls at once when the document shows again.
- The stream view passes `alwaysPoll` and ignores visibility.
- A failed poll keeps the last good state, and `reconnecting` turns on after
  `RECONNECTING_AFTER_FAILURES` (3) failures in a row.
- A poll that answers with an older `version` of the same session than a command response
  already applied is ignored, so an optimistic lock-in never flickers back.

**The view model.** `buildPickBanView(state, { clockOffsetMs, now })` in `pickBanView.ts` is
pure and tested without a DOM. It returns:

- the re-derived `phase` (`'none'` when there's no session), and a `countdown` whose
  `endsAt` is a **local-clock** epoch ms. A frozen countdown has `endsAt: null` and a fixed
  `remainingMs`.
- `turn`, with `actionLabel` and whether the viewer acts, and `spotlight`, the step being
  revealed
- `cards`: `available`, `banned`, `picked`, `decider` or `excluded`, with the acting side,
  step number, map number, exclusion reason and the `previewed`, `lockedIn` and
  `selectable` flags
- `timeline`: `upcoming`, `current`, `locked_in` or `revealed`
- `summary`, in play order (`map_number`), with a slot reserved for every map from the start
- `teams.left` (A) and `teams.right` (B), falling back to `team_a` on the left while A is
  undetermined
- `banners`: voided, cancelled, paused, skipped bans and warnings
- `affordances`: `canReady`, `isReady`, `canLock`, and `manager` (which dock controls apply
  to the current status, `startBlockedBy`, and `actForSide`)
- `nextBoundaryAt`: when the view next changes on its own

While a step is inside its reveal lead, the side that locked it sees it as `locked_in`, with
its card flagged `lockedIn`. Everyone else still sees the step being awaited. `canLock` is
re-derived when a spotlight or the intro ends, so a captain can act without waiting for the
next poll. The server's `can_lock_now` only overrides it for a payload read while awaiting.

### Event pick/ban setup

Each stage of an event's format carries an optional pick/ban **block** and a tagged
**map pool**. Manage → Pick/Ban (`manage/pickban/`) edits both, one card per stage.

`fetchPickBanConfig(token, slug)` → `{ stages[] }` lists **every stage in the format,
in format order**, including playoff and final stages that are not drawn yet, so they
can be set up ahead of time. It is a public read, visible whenever the event is, and
answers `{ stages: [] }` when no format is attached. Each stage carries:

- `key`, `name` and `best_of` (the stage's effective match default)
- `pick_ban` — the block, or `null` when the stage has none yet:
  `preset_id` (`bo4_picks` / `bo3_ban_pick` / `bo5_ban_pick`, or `null` for a custom
  sequence), `sequence` (`steps: [{actor: 'A' | 'B', action: 'ban' | 'pick'}]` plus
  `ban_down`), `exclusions` (`[{tag, min_pre_cup_seed}]`) and `pacing` in seconds
  (`intro`, `spotlight`, `ban_down_spotlight`, `decider_spotlight`)
- `counts` (`lettered_picks`, `lettered_bans`, `maps_yielded`, `full_sequence_minimum`,
  `absolute_minimum`) and `sequence_mismatch` (`maps_yielded !== best_of`); `null` and
  `false` without a block
- `pool` — `[{map, tags, screenshot_version}]` in saved order
- `pool_status` — `{normal, exempt}`, each `{size, status}` with status
  `full_sequence` / `bans_dropped` / `too_small`. `exempt` is the pool minus every map
  carrying an exclusion tag, and is `null` when the block has no exclusion rules.

Writes (bracket managers only):

| Helper | Does |
|---|---|
| `setPickBanStageConfig(token, slug, stageKey, input)` | Replaces one stage's block. `input` is `{preset_id, exclusions?, pacing?}` **or** `{sequence, exclusions?, pacing?}`, never both. Choosing a preset copies its steps into the block, so a later change to the shipped presets never reshapes a configured stage. |
| `setPickBanStagePool(token, slug, stageKey, pool)` | Replaces the stage's whole pool (`[{map, tags}]`, order = array order). Idempotent. |
| `copyPickBanStagePool(token, slug, stageKey, fromStageKey)` | Copies another stage's **saved** pool, tags included. It writes straight away, so the editor confirms first. |

**Rules the editor mirrors** (`manage/pickban/pickBanEditor.ts`, so problems show while
typing instead of after a round trip):

- The preset steps (`PICK_BAN_PRESET_SEQUENCES`) and the counts: maps yielded = lettered
  picks + 1 with a ban-down; full-sequence minimum adds the lettered bans; the absolute
  minimum drops every ban. Pool status is `full_sequence` at or above the full minimum,
  `bans_dropped` down to the absolute minimum, `too_small` below it. A unit test pins the
  counts of all three presets to the API's numbers — keep both in sync if a preset
  changes.
- Tags are trimmed, non-empty, at most 32 characters and matched case-insensitively
  ("Hard" is just a tag). Pacing is a whole number from 0 to 60 (defaults 5 / 10 / 4 / 10).
  An exclusion threshold is a whole number of at least 1.

**Warnings** (pool too small or dropping bans, for normal and for exempt matches, and a
sequence whose map count differs from the stage's best-of) come from the draft while a
stage has unsaved edits, and from `pool_status` / `sequence_mismatch` once it doesn't.
Both paths produce the same `PickBanWarning` list, and a test asserts they agree for
the same stage, so saving never changes what the card says.

**Errors.** A rejected block answers 422 with `field.path: reason` entries joined by
`; ` — the path is relative to the block (`preset_id`, `sequence`, `pacing.intro`,
`exclusions[0].tag`), or prefixed `stages[<index>].pick_ban.` when the whole-format
validation rejected it. `configErrors` strips this stage's prefix and places each entry
next to its field; anything it cannot place becomes the card's error. A rejected pool is
one sentence: `Map '<name>' …` is pinned to that map's row, and a bare tag reason reads
"A tag …".

**Keeping the Format tab honest.** A full-format save sends every stage's block back, so
a stale spec would silently revert the pick/ban setup. After a block is saved the tab
re-fetches the config, refreshes the bracket (whose `format.spec` the Format tab edits)
and writes the new block into an open format draft (`withStagePickBan`).

**Unsaved edits** live in `EventDetailPage` as `pickBanDrafts` (keyed by stage key), with
the same leave guard as the format draft (see `navigation.md` → leave guards). A stage
has a draft only while it differs from its saved state (`settledDraft`), so undoing an
edit clears it, and drafts for stages the format no longer has are dropped on load.
Saving sends the block and the pool separately, only for the part that changed; if one
half fails, the other half is kept and only the failed half stays unsaved.

The Manage panel's sub-tabs are one registry, `MANAGE_TABS` in `ManagePanel.tsx`: an
entry is `{id, label, eventManagersOnly?, hasUnsavedChanges?, render(context)}`, so a new
tab is a single entry. The Pick/Ban tab's panel is lazy, since only managers ever open
it. The match queue goes below the stage cards in `PickBanPanel`.

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
| Game hosts (admin only) | `fetchAdminHosts`, `createAdminHost`, `updateAdminHost`, `setAdminHostServers`, `issueAdminHostToken`, `removeAdminHostToken`, `updateAdminServer`. A host holds exactly one token; issuing when one exists replaces it, and the server revokes the old one in the same transaction. The plaintext comes back once and is never retrievable again - show it, let the admin copy it, and do not persist it anywhere in the renderer. Both replace and remove are destructive and are behind a ConfirmDialog that states the consequence. Server chips in that section are buttons - clicking one opens its registry entry (name, address, port, region, state, listed, certified, host) for editing |
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
