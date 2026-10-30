# Event scheduling

Captain-arranged match times: the proposal/slot contract, the slot picker, the Schedule tab (My Matches
and the public All Matches view), streamer and match-admin assignment with Manage → Matches, manager
oversight, and the per-event to-dos behind the "Needs your attention" panel and the sidebar badge. Read it
before touching `app/components/pages/events/schedule/`, `manage/ScheduleOversightPanel.tsx`,
`manage/matches/`, `EventTodoPanel.tsx` or `app/utils/eventAttention.ts`.

Brackets, `MatchCard` and the pick/ban entry points are in [events.md](events.md); sidebar badge rendering
is in [navigation.md](../navigation.md).

## Where the code lives

Paths starting `events/` are under `app/components/pages/`.

| Path | Holds |
|---|---|
| `events/schedule/` | the Schedule tab (`ScheduleTabContainer`, `MyMatchesPanel`, `PublicSchedulePanel`) and the slot picker (`SlotPickerModal`, `SlotGrid`); pure and tested: `slotGeneration.ts`, `scheduleSections.ts`, `publicSchedule.ts`, `scheduleShared.tsx` (labels, re-exported time helpers) |
| `events/eventsShared.tsx` | the participant and visibility rules and `autoScheduleView`, tested in `eventsShared.test.ts` |
| `events/manage/` | Manage → Schedule (`SchedulingWindowsPanel`, `ScheduleOversightPanel`), `DateTimeField`, `StaffPicker` |
| `events/manage/matches/` | Manage → Matches (lazy); pure rows, filters, summary and in-place staff patch in `matchesTable.ts` |
| `events/EventTodoPanel.tsx` | the "Needs your attention" card |
| `app/utils/eventAttention.ts` | pure to-dos and the per-event attention map, tested; `Main.tsx` runs its poller, `app/components/navigation/nav-items.ts` turns it into a `NavBadge` |
| `app/utils/timezone.ts`, `app/utils/signupWindow.ts` | display zone, slot formatting and `parseApiInstant`; the signups-closed rule |
| `app/utils/api.ts` | the schedule, proposal, oversight and staff-assignment fetchers |
| `e2e/schedule-responsive.spec.ts`, `e2e/manage-matches.spec.ts` | Playwright for the Schedule tab and Manage → Matches |

## Contract

### Schedule entries and proposals

A `ScheduleEntry` (`app/utils/api.ts`) is `{ tournament, match, slot_window, schedulable, reason,
whose_turn, proposal }`.

- **One open proposal per match**, `{ id, team_id, note, status, slots[], created_by, created_at,
  updated_at }`; each slot is `{ starts_at, expired }`.
- **`whose_turn` is a team id, not a role.** `null` means no proposal is open (either side may propose);
  otherwise it names the team expected to respond. `whoseTurnLabel(entry, myTeamId)`
  (`schedule/scheduleShared.tsx`) reads it against the viewer's team, or names the team by side when
  `myTeamId` is null (a manager).
- **`expired` is server-computed per fetch**: the slot fell inside the minimum lead time at the time of
  this read. Never cache it or recompute it.
- **`reason`** explains `schedulable: false`. `schedulabilityReason` maps the known codes
  (`bracket_not_published`, `teams_not_decided`, `team_not_registered`, `window_not_open`) with a generic
  fallback.
- **Timestamps.** Slot and proposal timestamps carry an explicit `+00:00`; bracket payloads
  (`match.scheduled_at` included) are zone-less and mean UTC. Read every one with `parseApiInstant`
  (`app/utils/timezone.ts`; `scheduleShared.tsx` and `predictionsShared.tsx` re-export it).
- **Every `EventMatch` carries `resolved_window: { opens_at, closes_at }`**, computed server-side; it is
  never a proposal field, so the public bracket shows only a booked time or this window.

### Reads

| Fetcher | Route | Returns |
|---|---|---|
| `fetchMySchedule(token)` | `GET /me/schedule` | `ScheduleEntry[]`, cross-event, **only `pending` matches**: a booked match drops out |
| `fetchMyEventMatches(token, slug)` | `GET /tournaments/<slug>/me/matches` | `MyMatchEntry[]`, the caller's booked and assigned matches |
| `fetchMatchSchedule(token, slug, matchId)` | `GET /tournaments/<slug>/matches/<matchId>/schedule` | `{ schedule: ScheduleEntryDetail }` |
| `fetchEventScheduleOversight(token, slug)` | `GET /tournaments/<slug>/admin/schedule` | `ScheduleOversightEntry[]`, every `pending` match (managers) |
| `fetchEventAuditLog(token, slug, { matchId })` | `GET /tournaments/<slug>/admin/audit?match_id=` | one match's audit trail |

- **There is no per-event scheduling route.** `EventDetailPage` fetches `/me/schedule` and filters to
  `item.tournament.slug === eventSlug` itself. `Main.tsx` reads the same fetcher for the sidebar badge, so
  keep its shape exactly this.
- **`MyMatchEntry`** is `{ match, stage: {key, name}, roles: ('player' | 'streamer' | 'match_admin')[],
  streamer: EventStreamer | null, match_admin?: EventMatchAdmin | null, side_color: 'red' | 'blue' | null
  }`, sorted by `scheduled_at` (unbooked last), then stage, round and match order. A `player` entry is one
  of the caller's team's `scheduled` or `live` matches; `streamer` and `match_admin` entries are matches
  assigned to the caller, `pending`, `scheduled` or `live`. One match can carry several roles.
  `side_color` is set only for a player once the side is confirmed.
- **`EventStreamer`** is `{ id, display_name, twitch_url }`; **`EventMatchAdmin`** is `{ id,
  display_name, role, event_manager }` (`role` is the staff role number, `ROLE_LABELS` in
  `app/utils/roles.ts`, `0` without one). `display_name` is null for a user with no alias:
  `streamerName` / `matchAdminName` (`eventsShared.tsx`) render "Unnamed streamer" / "Unnamed admin".
- **`ScheduleEntryDetail`** is distinct from `ScheduleEntry`: its `match` is a `ScheduleMatchDetail` whose
  `team_a` / `team_b` add `booked: { match_id, starts_at, ends_at }[]`, each team's **other** booked
  matches, computed server-side. Never recompute a booking calendar. `ScheduleMatchDetail` is otherwise a
  superset of `EventMatch`, so the `scheduleShared.tsx` helpers accept it.
- **`ScheduleOversightEntry`** adds `overdue` (window closed, nothing booked) and `stalled_since` (when the
  open proposal last moved, or null). `overdue` and `schedulable: false` can both be true and answer
  different questions.

### Writes

All three share the per-match base `/tournaments/<slug>/matches/<matchId>` and return
`{ schedule: ScheduleEntryDetail }`, so the modal replaces its state with the response and never refetches
after a write.

- `proposeMatchSlots(token, slug, matchId, { team_id?, note?, slots })` → `POST .../proposal`: creates or
  supersedes the one open proposal. The same route serves a pending match and a booked one (opening a
  reschedule, subject to the server's 12-hour captain freeze and market-bet gate).
- `withdrawMatchProposal(token, slug, matchId)` → `DELETE .../proposal`, no body. Only the proposing team
  or a manager may; the route takes no `team_id`.
- `acceptMatchProposal(token, slug, matchId, { team_id?, slot_index })` → `POST .../proposal/accept`:
  books one slot of the live offer.
- **`team_id`** is required by the server only for a manager acting without a roster spot; a rostered
  player's team is implied. The modal sends it whenever it knows it (the viewer's team, or the manager's
  "Acting as" choice).
- **Accept errors.** `ApiError.reason` `slot_no_longer_valid` (the slot fell inside the lead time or
  outside the window since the offer) or `slot_conflicts_with_booking` marks that `slot_index` dead with
  the server's message instead of refetching. Any other error shows inline.

## Slot picker

`schedule/SlotPickerModal.tsx` is the one place to propose, counter, withdraw and accept. It opens from a
My Matches / to-do card, or from a bracket `MatchCard` that is `pending` with both teams decided
(`schedulerEligible`, `bracketShared.tsx`; `BracketTab` threads `onScheduleMatch(matchId)` to the card's
`onClick`). `EventDetailPage` owns the open state (`schedulerMatchId`) so every entry point opens the same
instance, and passes the loaded `bracket` only to look up the match's stage.

- Refetches every 30 s while open; `useNow(60_000)` re-judges picked slots every minute.
- **Acting as.** A manager with no team of their own gets an "Acting as" select. Until they pick a side,
  propose and accept are disabled (the server refuses them without `team_id`); withdraw stays enabled.
  Withdraw shows for the proposing team or any manager.
- A team's other bookings are listed above the grid ("<team> already has … booked.").

### Slot generation (pure)

`schedule/slotGeneration.ts` mirrors the server's validation constants (`MAX_PROPOSAL_SLOTS = 5`,
`MIN_LEAD_HOURS = 2`, `SLOT_BOUNDARY_MINUTES = 15`) and its half-open overlap rule for booking
conflicts. Keep them in sync with the server; keep the logic here (unit-tested), not in components.

- **Match duration.** `effectiveMatchDurationMinutes(stage)` uses the stage's
  `expected_match_duration_minutes`, else `DEFAULT_MATCH_DURATION_MINUTES_BY_KIND` (`groups: 75`,
  `swiss: 60`, `single_elim: 60`), a mirror of the server's per-kind default. The picker needs a duration
  to size a slot and check it against bookings.
- **`pickerBounds`**: earliest start is `max(opens_at, now + lead time rounded up to a 15-minute mark)`;
  latest is `closes_at` minus the duration, so a picked start finishes inside the window.
- **`slotAvailability`** judges one instant, returning the first failing reason in this order:
  `off_boundary`, `outside_window` (against `closes_at` alone, as the server enforces, since it also judges
  slots the grid didn't generate, e.g. a stale slot of the team's own earlier offer), `inside_lead_time`,
  `conflicts_with_booking` (either team's `booked`); else `{ available: true }`.
- **`candidateDays`** walks every 15-minute instant between the bounds (capped at
  `UNBOUNDED_WINDOW_HORIZON_DAYS` when `closes_at` is null) and buckets them by calendar day **in the
  display timezone**: day boundaries come from `startOfNextZonedDay`, slots step in epoch ms, so a DST day
  has 92 or 100 slots.

### Grid

`schedule/SlotGrid.tsx` is a day strip + time grid, never a free-form input, so an invalid time can't be
typed. A 7-day paged strip lists every day of the window (days with no open slot disabled); the chosen day
shows 30-minute starts, or every 15 minutes with "Quarter hours". Unavailable slots are struck through with
the reason as a tooltip. Clicking toggles a slot into the proposal (up to 5), shown as removable chips; a
chip that has since become invalid turns red and blocks submit until removed.

### Times and zones

Every time renders in the viewer's resolved-or-pinned zone (`useDisplayTimezone()`), never a typed
abbreviation. `formatSlotTime(iso, timezone)` passes the IANA zone to `Intl.DateTimeFormat`. Manager
date-time fields use `manage/DateTimeField.tsx` (native date input + 15-minute time `<select>`, value a
`YYYY-MM-DDTHH:mm` wall-clock string in the display zone; `toZonedInput` / `fromZonedInput` convert), so
the scheduling-window panel and the match editor's "Scheduled" field use the display zone, never the
machine's. `CapLinkPicker`'s search range and the predictions market card still use the local-zone
`toLocalInput` / `toIso` / `formatMatchTime` in `bracketShared.tsx`.

## Schedule tab

### Visibility and audiences

`eventsShared.tsx` holds three rules:

- `isScheduleParticipant(hasTeam, canManageBracket, isStreamer)`: a rostered member, a bracket manager
  (even with no roster spot) or an assigned streamer.
- `hasPublishedStages(bracket)`: `bracket.published` and at least one stage `published`.
- `scheduleTabVisible(participant, bracket)` = `participant || hasPublishedStages(bracket)`: a signed-out
  visitor or spectator sees the tab and the public schedule once the bracket is live; participants see it
  earlier.

**`fetchMySchedule` and `fetchMyEventMatches` run only for a participant with a real access token**,
whatever `hasPublishedStages` says. `EventDetailPage` computes `canManageBracket` (`can_manage_bracket`
or `can_manage`) once, before its hooks; the participant rule, the tab list, the Manage gate and My
Matches' viewer all read that value.

### Container and default view

`ScheduleTabContainer` renders a `Segmented` toggle between **All Matches** (`PublicSchedulePanel`) and **My
Matches** (`MyMatchesPanel`, rendered by `EventDetailPage` and passed in as `myMatchesPanel`). Only a
participant gets the toggle; anyone else gets All Matches alone.

- `awaitingCount` is the Schedule tab bubble's count, `scheduleTodoSummary(counts).count` (answer and
  propose to-dos), so the My Matches segment and the bubble agree.
- `autoScheduleView(awaitingCount, hasPickBanSession)` picks the default: `'mine'` when the team has a time
  to answer or propose, or an open pick/ban session, else `'all'`. It is settled **once per mount**, when
  the participant's schedule has loaded, then held even if the count drops; until then the container
  shows `ScheduleLoading` ("Loading schedule…").
- An explicit click is stored in nav state `event.scheduleView` (`'all' | 'mine'`, default `null`) and
  wins from then on. `null` means "no choice yet", so keep it distinct from the automatic default.

### My Matches

`scheduleSections(pending, mine, viewer)` (`schedule/scheduleSections.ts`, pure) splits the two reads:

- **Upcoming**: `player` entries that are `scheduled` or `live`, live first, then soonest, unbooked last,
  ties in server order.
- **Needs a time**: the `/me/schedule` list minus matches Upcoming already shows (the two reads can catch
  a match mid-change).
- **Match Admin** (`refereeing`): `match_admin` entries, live first then soonest; shown only when non-empty.
- **Streaming**: `streamer` entries, same order.
- Player sections show for a team member or bracket manager, or whenever they hold a match (`showPlayer`);
  Streaming shows for `is_streamer` or whenever a match is assigned (`showStreaming`). A streamer with no
  team sees only Streaming.

Cards: `matchTimeLabel` reads "Live Now", a booked time via `formatSlotTime`, or "No time booked yet". An
Upcoming card names its streamer through `PlayerInfo`, shows "Match admin" beside "Streamed by", and shows
"You're Red / Blue" (`YoureSide`) from `side_color`. `pickBanCallToAction(match, session)` reads the
match's `pick_ban_status`, or the viewer's own `pick_ban_session` when it is for that match (fresher),
through `pickBanAction` as rostered: `'join'` (the Join banner), `'view'` ("View Picks & Bans") or `'page'`
(a quiet "Visit Picks & Bans Page" link, since the page previews the pool before a lobby opens). A
Streaming card shows time, teams, stage, round and the pick/ban chip, with **Copy Stream Link**
(`buildMatchLinks(slug, matchId).streamLink`, a 1920×1080 OBS browser source; see
[stream-kit.md](stream-kit.md)) and **Open Picks & Bans**; empty reads "No matches assigned to you yet."

Loading: `EventDetailPage` loads `/me/schedule` and `/me/matches` together (`Promise.allSettled`) once the
viewer is a participant and on page refresh; `MyMatchesPanel` refreshes them on mount and every 30 s while
shown. A failed refresh keeps the last good list; only a first load where both reads fail shows "The
schedule could not be loaded."

### All Matches (public schedule)

`schedule/publicSchedule.ts` (pure) derives everything from the already-loaded `fetchEventBracket`; it
needs no fetch of its own.

- `scheduledRows(bracket)`: nothing while `bracket.published` is false; else every published stage's
  published, non-cancelled, non-bye matches with a `scheduled_at` (read with `parseApiInstant`). A row
  keeps the match, stage name + ordinal, group id + name + ordinal, and the start instant.
- `bucketByStatus(rows)`: `live` (soonest first), `upcoming` (not live or played, soonest first), `played`
  (`complete` / `forfeit`, most recent first); ties break by stage ordinal, then the bracket's `matchOrder`.
- `groupByDay(rows, timezone, now)`: per-day sections in the display zone, keeping the given order, naming
  "Yesterday" / "Today" / "Tomorrow" by calendar day (`zonedDayKey` with a day offset, never ±24 h, so DST
  days neither split nor merge) and a short weekday-day-month date otherwise.
- `rowTimeLabel(startsAt, timezone, now)`: the time alone today, else date + time.
- `unscheduledCount(bracket)`: published `schedulerEligible` matches with no `scheduled_at`.
- `nextUp`: the soonest upcoming row that has not started (gets the countdown).

`PublicSchedulePanel` renders Live Now, one section per upcoming day (a booked match whose start passed
yesterday and isn't live yet shows under "Yesterday"), the "N matches still need a time." line (once, below
the list or empty state), and a collapsed Played section ("Show played matches (N)", one section per played
day, newest first) whose open state is nav state `event.schedulePlayedOpen` (default `false`). Rows under a
day show only their time; a Live Now row uses `rowTimeLabel`. A row is the viewer's own when `sideOf`
finds their team. Each row has one status chip: "Live Now", "Starts in <countdown>" on the `nextUp` row,
"Scheduled", or `MatchStatusChip` once played. Actions are `Button`s, never clickable chips: a Picks &
Bans button from `pickBanAction` ("Join" for the viewer's open session, "Watch" for everyone else while
open, "View" once complete, none before a lobby) and Watch Stream when `stream_url` is set. No odds here;
those stay on `MatchCard` and the Predictions tab.

Shared with My Matches (`scheduleShared.tsx`): `ScheduleSection` (title, optional count, optional blurb),
`TeamPair` (team A "vs" team B through the roster-hover `TeamName`), `ScheduleLoading`.

**Bracket refresh.** While All Matches is shown, `ScheduleTabContainer` refreshes the bracket every 60 s
through a `createPoller` with `pollOnStart: false` calling `onBracketRefresh`. Opening the view makes no
read of its own (it shows the bracket the page holds); the poller rests while hidden and reads once on
becoming visible. A `?tab=schedule` landing costs only the page's bracket read, then one bracket read
per minute.

## Streamers, match admins and Manage → Matches

Bracket managers assign people per match. For managers only, every bracket match also carries `streamer`
and `match_admin` (optional on `EventMatch`, absent for everyone else).

- `fetchEventStreamers(token, slug)` → `GET /tournaments/<slug>/admin/streamers` → `{ items }`: everyone
  on the streamer roster (managed in Admin → Streamers, [admin.md](admin.md)), plus anyone still assigned
  to one of this event's matches after leaving the roster.
- `setMatchStreamer(token, slug, matchId, userId | null)` → `PUT .../admin/matches/<matchId>/streamer` with
  `{ user_id }` (the key is required; `null` clears) → `{ streamer }`. A user not on the roster (even a
  removed streamer still holding the match) is refused with 422 `invalid_request`; show the server's
  message.
- `fetchEventMatchAdmins(token, slug)` → `GET /tournaments/<slug>/admin/match-admins` → `{ items }`: every
  staff member (Moderator, Admin, Cup Admin) and event manager, plus anyone still match admin of one of
  this event's matches who is no longer eligible. The picker badges each with their staff role, else
  "Event Manager", else "Not Eligible".
- `setMatchAdmin(token, slug, matchId, userId | null)` → `PUT .../admin/matches/<matchId>/match-admin` with
  `{ user_id }` → `{ match_admin }`; anyone neither staff nor a manager of this event gets 422
  `invalid_request`.

**Manage → Matches** (`manage/matches/MatchesPanel.tsx`, lazy) is where matches are run: one row per match
of every stage (`matchRows`, by scheduled time with unscheduled last, then stage, round, match order), with
a match-admin and a streamer `StaffPicker`, the status chip, the series score once live or finished, Edit
(the bracket's `MatchEditorModal`, see [events.md](events.md)) and a Picks & Bans link. The streamer
control also lives in the pick/ban match queue ([pick-ban-ui.md](pick-ban-ui.md)).

- Filters (`filterMatchRows`: stage, open / finished / all, needs a match admin / needs a streamer, search
  over team and staff names) persist in nav state `event.manage.matches.filter`; open matches by default.
- Summary pills (`matchesSummary`) count open matches and those missing an admin or streamer; a click
  applies that filter.
- Both people lists load on mount and again whenever a picker opens. An assignment patches the bracket in
  place (`withMatchStaff` → `onBracketChange`) with no refetch; saving the editor re-reads the bracket.
- The amber Caps need linking list sits above the filters ([events.md](events.md)).

## Manager oversight

`manage/ScheduleOversightPanel.tsx` (Manage → Schedule) lists `fetchEventScheduleOversight` entries,
overdue first, reusing `whoseTurnLabel(entry, null)` and `schedulabilityReason` (a manager isn't
necessarily rostered). `fetchMySchedule` can't be reused: it holds only the caller's team. Each card's
history loads lazily on expand via `fetchEventAuditLog` with `matchId`.

## Attention: to-dos, the panel and the badge

`app/utils/eventAttention.ts` turns schedule and membership data into per-event to-dos. It stops at
API-shaped data (`EventTodo`, `TodoCounts`, `EventAttention`, `EventAttentionMap`, `eventAttentionLines`)
and imports only API types; the conversion to a `NavBadge` lives in `nav-items.ts`.

**`eventTodos(schedule, myTeamId, invitations)`** (pure), one event's player to-dos by `kind`:

- **`answer-times`**: an entry with an open `proposal` whose `whose_turn` is my team: the opponent offered
  times and we owe the reply.
- **`propose-time`**: a `schedulable` entry for a match my team plays with no `proposal`. Once one side
  proposes it becomes `answer-times` for the other side and nothing for the proposer.
- **`invitation`**: a team invitation, listed only while I hold no team in that event.

An entry waiting on the opponent, or not schedulable yet, is not a to-do.

**On the event page.** `EventDetailPage` calls `eventTodos` with its filtered `/me/schedule`, `my.team.id`
and `my.invitations` (empty once `signupsClosed(event, now)`, `app/utils/signupWindow.ts`) and renders
**`EventTodoPanel`**: a "Needs your attention" card above the tabs, one row per to-do with its action
("Respond to offer" / "Propose a time" open the `SlotPickerModal`; "View invitation" switches to the Signup
tab). The viewer's own `pick_ban_session` comes first as its own row (lobby open, live or paused, with a
"Join lobby" or "Open Picks & Bans" `PickBanLink`). The panel renders nothing with nothing to do. The page
counts once with `todoCountsByKind(todos)`; the Schedule tab bubble and tooltip read
`scheduleTodoSummary(counts)` (answer and propose only) and the Signup tab reads `counts.invitations`.

**For the sidebar.** `computeEventAttention(schedule, memberships)` runs `eventTodos` per slug: schedule
entries grouped by `tournament.slug`, my team per slug from the **active** `fetchMyTournaments` rows
(`myTeamIdsByTournament`), invitations from the `invited` rows whose event's signups aren't closed. The
open-lobby slugs come from `openLobbySlugs` (active rows with a non-null `pick_ban_session`; only a live
event can have one). Each slug folds into an `EventAttention` (its `TodoCounts` plus `pickBanOpen`); a
slug with neither is left out. The page and the sidebar apply the same rules, so they can't disagree.

**Refresh.** `Main.tsx` runs a `createPoller` only while signed in: every 60 s, immediately on start,
resting while hidden, plus `pollNow` on window focus. Each refresh is exactly two reads,
`fetchMySchedule` and `fetchMyTournaments`, however many events the caller plays in (the lobby flag rides
on the membership rows, so no per-event `fetchMyEventStatus`). Sign-out or an account switch stops it and
aborts in-flight reads; a total failure resets the map to empty rather than leaving stale numbers.

**The badge.** `eventAttentionCount` sums `offersToAnswer + matchesToSchedule + invitations`; the open
lobby is not counted (it means "your match is starting", not a chore) and shows as the separate live dot.
`attentionNavBadge(attention, fallback?)` (`nav-items.ts`) builds the `NavBadge` with
`eventAttentionLines` as tooltip lines; on Events, `combinedEventAttention` sums across events and any
to-dos replace the "new events" count. Nothing is persisted or marked seen: each part disappears once the
caller acts or the lobby closes. Rendering and which destination gets which badge:
[navigation.md](../navigation.md).
