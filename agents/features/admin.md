# Admin dashboard

The staff admin page (`app/components/pages/admin/`): who may open which section, the
server rules behind its slice of `app/utils/api.ts`, and the sections whose contract is
not visible in the code. Admin → Map Uploads has its own doc: [map-uploads.md](map-uploads.md).

## Where the code lives

Paths starting `admin/` are under `app/components/pages/`.

| Path | Holds |
|---|---|
| `admin/AdminPage.tsx` | the page (lazy in `Main.tsx`): resolves the open section, falls back to the first visible one, guards it |
| `admin/registry.tsx`, `admin/types.ts` | `ADMIN_GROUPS`, `ADMIN_SECTIONS`, the `AdminSectionId` union and `AdminSectionProps`; `registry.test.ts` pins groups, order and roles |
| `admin/AdminLayout.tsx`, `admin/AdminGuard.tsx` | the grouped section nav (a `<select>` below `lg`); the Restricted card |
| `admin/components/` | the kit every section is built from: `SectionShell`, `TableControls` + `useAdminTable`, `AdminCardFace`, `controls.tsx`, `useAdminFilterPresets`, `AuthorPicker`, `TagEditor` |
| `admin/sections/` | one `<Name>Section.tsx` per section, its modals, and pure helpers with tests (`streamerRoster.ts`, `mapVideoFile.ts`) |
| `admin/sections/mapUploads/` | Map Uploads ([map-uploads.md](map-uploads.md)) |
| `app/utils/roles.ts` | `ROLE`, `isStaff` and the role allow-lists |
| `app/utils/api.ts`, `app/utils/chartBuckets.ts` | the admin fetchers, each next to its domain; the Overview chart's ranges and buckets |
| `e2e/admin-streamers.spec.ts`, `e2e/admin-maps-video.spec.ts` | Playwright with a mocked staff session |
| `e2e/mobile/admin-cards.spec.ts` | the phone cards of the tiered admin tables ([Tables on phones](#tables-on-phones)) |

## Access

- The server authorises every `/admin/*` route and audit-logs every mutation. The client
  role checks (`isStaff` in `app/utils/roles.ts`, each section's `roles`) only decide what
  to show; never treat them as the security boundary.
- Sections are registered in `app/components/pages/admin/registry.tsx` with `roles` set to
  `ADMIN_DASHBOARD_ROLES` (Moderator, Admin) or `ADMIN_ONLY_ROLES` (Admin).
- `utbt_role` is not a hierarchy: Cup Admin (3) is a sibling of Moderator and Admin and
  gets no dashboard section. Check set membership (`roles.includes(role)`), never `role >= n`.
- The open section is `activeSection` in the `utbt:adminState:v1` page state. Sections
  switch each other through the `onNavigate(sectionId)` prop, in place, with no new
  history entry. How the Admin nav item and the page itself are gated:
  [navigation.md](../navigation.md).

## API slice

- Every admin fetcher is in `app/utils/api.ts` next to its domain (overview, users,
  titles, caps, streamers, maps, map uploads, map authors, patches, game hosts,
  anti-cheat, audit) and takes the staff bearer `userProfile.accessToken`.
- Maps are created only from an uploaded archive ([map-uploads.md](map-uploads.md));
  `updateMap` only edits an existing map.
- The admin form pieces (`AuthorPicker`, `TagEditor`, `ConfirmDialog`, the controls in
  `admin/components/`) are described in [shared-components.md](../shared-components.md).

## Overview activity chart

`fetchAdminActivity(token, { start, end })` (`GET /admin/overview/activity`) takes two
inclusive UTC days (`YYYY-MM-DD`); that is the only shape the Overview section sends.
`RANGE_PRESETS` (`app/utils/chartBuckets.ts`) are shortcuts that fill those two dates.

- **The server picks the bucket** (`hour` / `day` / `week` / `month`) from the span.
  `bucketForSpanDays` mirrors the same ladder only to label the chart before the
  response lands.
- **Edges snap outward** to whole buckets, so the first bucket is never a short one. The
  response carries the effective `start`/`end`, the `requestedStart`/`requestedEnd`, and
  `partialFrom`.
- **`points` covers every bucket** in the effective range, empty ones included, so a zero
  and a missing bucket are never conflated.
- **The last bucket is usually still filling** and carries `partial: true`.
  `splitPartialSeries` moves partial buckets onto a second, dashed series so an
  in-progress period does not read as a crash.
- **`dayResolutionSeries`** names series whose real resolution is coarser than `bucket`
  (`new_users` at hourly granularity); **`unavailableSeries`** names series the range
  cannot answer at all (session history is not kept far enough back for an old hourly
  range). Each chart labels itself from these lists instead of drawing a flat zero.
- **Validate before fetching** with `validateRange`: the server answers 400 for a
  reversed range, a start in the future, an empty `start=`/`end=`, or a span over
  `MAX_RANGE_YEARS`, and that message surfaces through `ApiError`.
- **Format every bucket label with `timeZone: 'UTC'`** (as `formatWeekRange` and the
  Overview formatters do). Bucket timestamps are UTC instants; the viewer's zone shifts
  labels by a day (east of UTC a Monday-start week renders as an 8-day span) and
  contradicts the `UTC` marker on the date inputs.
- The date inputs commit after `DATE_COMMIT_DELAY_MS` or on blur/Enter, because a native
  date input fires `change` on every year-spinner step and each commit is a fresh set of
  aggregate queries. Preset buttons apply at once.
- A single-bucket range (`Today` just after UTC midnight) draws nothing as a line;
  `needsPointMarkers` turns on dots for it.

## Tables on phones

Admin tables are tiered DataTables ([shared-components.md](../shared-components.md#column-tiers-and-phone-cards)):
on a phone they render cards, never a table that scrolls sideways. The card face holds the
table's required columns plus its main action; every other column is in the expand panel.

- **Tiers live with the columns.** An `AdminColumn` must declare `tier` next to its `label` and
  `required` flag. `tbl.responsiveColumns(id => ({ width, priority, sortKey, cell }))` builds
  every `ResponsiveColumn` in the user's order, flags hidden ones `hiddenByUser`, and takes `required`, `tier` and
  `label` from the admin columns (`adminResponsiveColumns`, unit-tested in
  `useAdminTable.test.ts`). Each `cell(row)` is the cell content: the table rows render it
  inside their `DataTableCell`, and the panel renders it beside its label.
- **The face** is `AdminCardFace`: the essential cells in column order, the last one (the
  action) pushed right, plus an optional `lead` (Caps' selection checkbox).
  `adminCardsPlaceholder(loading, empty, message)` is the skeleton or empty card.
- **Card mode.** Pass `tbl.onCompactChange` as the shell's `onCompactChange`; `TableControls`
  then hides the Columns menu while cards show. Sortable tables pass the header's state and
  toggle as `cards.sort`, so the card sort and the header share one sort.
- **Body taps** open the detail page where a row has one: the player (User Management, Usage &
  Health's recent users), the cap (Caps Management, and the Anti-Cheat shared-identifier detail,
  which closes on the way), the article (News), the draft (Map Uploads drafts), the publish
  (Recent publishes), the map (Maps Management). Anti-Cheat cards open what today's row click
  opens: the identifier's detail (Shared HWID / IP) or the cap stats (High Cap Delta, Low FPS
  WRs). The other tables have no body action.
- **Row selection on cards.** Tables with a selection column lead each card face with the row
  checkbox in a 44 px `<label>` hit area, and show a select-all checkbox above the cards while
  they show (Caps Management, High Cap Delta, Low FPS WRs, Difficulty Sync, Map Authors'
  review list). The bulk bar and the selected tint work as on the table. High Cap Delta and
  Low FPS WRs have the selection column in the Flagged view only, on cards as on the table.
- **Tables outside `useAdminTable`** (Difficulty Sync, Map Authors) declare
  `ResponsiveColumn`s with `label`, `tier` and `cell` directly. The ones that had no responsive
  config pass `density: false`, so their desktop rows keep today's padding.

| Table | Card face | Notes |
|---|---|---|
| User Management | player, Manage | sortable |
| Title Management | title, actions | sortable |
| Patch Releases | channel, tag, status, actions | sortable |
| News | title, actions | |
| Caps Management | selection, player, actions | sortable; "Select all on this page" sits above the cards, and the bulk bar works as on the table |
| Usage & Health, recent signed-in users | player | |
| Map Uploads: drafts, recent publishes, drift | [map-uploads.md](map-uploads.md) | |
| Audit Logs | summary | the panel adds the entry's details below time, actor and action |
| Maps Management | map, Edit | sortable |
| Difficulty Sync preview | selection, map, difficulty change | |
| Map Authors: unlinked names, linked players | name, map count, Review / Unlink | |
| Map Authors: review maps, re-credit preview | (selection,) map, status | no panel; they stay tables wherever both columns fit, as on a 390 px phone |
| Anti-Cheat: Shared HWID / IP | type, identifier | |
| Anti-Cheat: shared-identifier detail | player | |
| Anti-Cheat: High Cap Delta | selection, player, actions | sortable (Delta, Added; descending only, as the header) |
| Anti-Cheat: Low FPS WRs | selection, player, actions | |
| Anti-Cheat: cap stats percentiles | percentile, FPS, ping | every column on the face, labelled; no panel |

**Audit Logs details.** On the table a row click opens the details in a `DataTableExpandRow`
(the full-width row under it); on cards they open in the card's panel through
`cards.panel`, which skips the actor and action fields because the panel's grid above it
always lists them. Both render `ExpandedDetail`, with Roll back.

Hidden columns: `tbl.responsiveColumns` returns every column, and marks the ones a user hid
through the Columns menu `hiddenByUser`. The table skips them; the card panel and the card sort
still list them, since the Columns menu is hidden on cards.

## Map authors

The map-author fetchers back `MapAuthorsModal`, opened from Maps Management.

- A map credited to a plain name (`author_str`) scores for nobody. Linking the name to a
  player (`author_ref`) is what makes that player's mapper achievements count.
- `Map.author_ref` is a **string**: a Discord id too large for a JS number.
- Author names contain `&`, `/` and `.`. The fetchers send them as query parameters through
  `URLSearchParams` or in the JSON body; never interpolate one into a path.
- `linkMapAuthor` sends `expectedMaps` set to exactly the maps the preview rendered. The
  server answers 409 if that set changed since, so a stale preview never re-credits maps
  the admin did not see. `maps` is the subset the admin ticked in the Review step; only
  those are re-credited, and unticked maps keep their `author_str`.

## Map fly-through videos

- `uploadMapVideo(token, mapName, file, filename)` is `POST /admin/maps/<name>/video`
  (multipart field `file`); `deleteMapVideo` is `DELETE` on the same path. Both answer the
  updated `AdminMapRow` with `has_video` and `video_updated_at`.
- The upload is a plain `fetch` with no timeout, because the files are large; do not move
  it onto `apiGet` and its 20 s default.
- `checkMapVideoFile` (`admin/sections/mapVideoFile.ts`) refuses anything that is not
  `.webm` / `video/webm`, is empty, or is over 150 MiB, before any request is sent.
- `MapVideoControl` sits in the Edit map form under Screenshot; its preview uses
  `mapVideoUrl(name, video_updated_at)` ([api.md](../api.md) has the asset URLs). Remove is
  behind a `ConfirmDialog`.
- A video does not affect the mapvote, so a change reloads the row through `onReload`, not
  `onSaved`, and raises no "regenerate mapvote" banner.

## Server operations (Moderators and Admins)

- `fetchAdminServerOperations` returns every registered game server with the host it is
  linked to and a `probe` block (`answering`, `map_name`, `num_players`, `max_players`,
  `updated_at`, `seconds_stale`).
- `answering` is computed by the server. Do not re-derive it from `seconds_stale`.
- A server with no host link is shown as unlinked, never hidden.
- Moderators and Admins both read this section; only Admins also see Game Hosts next to it
  in the Infrastructure group.

- `fetchAdminHostMetrics(token, hostId, window)` returns `{ window, bucket, points[] }`.
  `bucket` is `sample` for 24h and `hour` for longer windows. Hourly points are averages,
  so short spikes are smoothed away; the UI says so instead of implying the spike never
  happened. The chart sits in `HostMetricsModal`, opened from the host's action menu.
- `fetchAdminHealthEvents` is the append-only feed of state changes (`host.unreachable`,
  `host.recovered`, `server.process_down`, `server.process_up`).
- A server carries two independent liveness readings: `probe` (does it answer players) and
  `runtime` (is the process alive on its host). Render both and never reconcile them.
  `runtime.process_up` true with `probe.answering` false is a hung server, and that
  disagreement is the point.
- `runtime.known` false means the server was never polled and `runtime.stale` true means
  the poller has not been round recently. Neither means down; do not draw them as down.
- Game Hosts row actions go through `ActionMenu`
  (`admin/components/`). An action a row cannot take is shown disabled, with the reason
  as its title.

- Alerts: `fetchAdminAlerts`, `acknowledgeAdminAlert`, `unacknowledgeAdminAlert`,
  `resolveAdminAlert`, shown in `AlertsPanel` at the top of Server Operations. Hosts raise
  them (map switch failed, anti-cheat did not start, map vote data not serving) and so does
  the server's own polling (host unreachable, server process down).
- Alerts are deduplicated by the server: one open alert per target, with `occurrences`
  counting repeats. Never render each occurrence as its own row.
- `status` is `open`, `acknowledged` or `resolved`. Resolving claims it was dealt with; it
  fixes nothing, and a recurrence opens a fresh alert, so resolving early costs nothing.
  Acknowledge and resolve are audited, and resolve takes a reason.

## Game hosts (Admin only)

- A host holds exactly one token. `issueAdminHostToken` (`PUT /admin/hosts/<id>/token`)
  replaces an existing one and the server revokes the old token in the same transaction;
  the response says `replaced`.
- The plaintext `token` comes back once and can never be read again: show it, let the
  admin copy it, and keep it out of every store, log and state that outlives the modal.
- Replace and remove are destructive: each sits behind a `ConfirmDialog` that states the
  consequence (players on that host lose their personal bests in the mapvote until the
  host runs with a new token; the map list keeps working).
- Server chips in the section are buttons that open the server's registry entry for
  editing through `updateAdminServer`.

## Streamer roster (Admin → Streamers)

The roster is the one global list of people who may stream, for every event. Being on it
is what gives a user the Stream tab ([stream-kit.md](stream-kit.md)) and lets a manager
assign them to matches. Section id `streamers`, Moderators and Admins only. Every answer is
`{ items: [...] }`; the fetchers return the array.

| Route | Function | Contract |
|---|---|---|
| `GET /admin/streamers` | `fetchStreamerRoster` | `RosterStreamer[]`. `twitch_url` is null when the profile has none. `upcoming_assignments` are unfinished matches across all events, scheduled first, unscheduled last |
| `PUT /admin/streamers/<userId>`, body `{ note }` | `putRosterStreamer(token, userId, note)` | Adds the user, or sets their note if already on. The note is trimmed, empty becomes null, and over 200 characters is refused. Answers the roster |
| `DELETE /admin/streamers/<userId>` | `removeRosterStreamer` | Answers the roster. Assignments stay: a removed streamer keeps their matches until a manager reassigns them, loses the Stream tab, and a manager can still operate as them to rescue the broadcast |
| `GET /admin/streamers/suggestions` | `fetchRosterSuggestions` | People who ticked "streaming" on an event sign-up and are not on the roster |

`StreamersSection` (`admin/sections/`):

- Adds through `PlayerSearchInput` with `excludeIds` set to the roster, or with one click
  from the Suggestions list.
- Lists members with `PlayerInfo`, the Twitch link or an amber "No Twitch channel" chip,
  who added them and when, the upcoming-match count, and a note input capped at
  `ROSTER_NOTE_MAX_LENGTH` (200).
- Remove opens a `ConfirmDialog` listing each upcoming assignment through
  `assignmentLine` ("Event · Label · local time", or "Unscheduled").
- Every row, suggestion and the search share one busy state so two writes never race.
  Each write replaces the roster with the one it answers, then re-reads the suggestions.
- Pure helpers and their tests: `sections/streamerRoster.ts`.

## Adding an admin section

Copy Streamers (#261): one section file, one registry row, a pure helper with its test, the
registry test and a Playwright spec. For a section large enough to need its own folder,
per-entry state and its own doc, copy Map Uploads (#283). Game Hosts (#242) is the
Admin-only example.

1. **Id.** Add the kebab-case id to `AdminSectionId` in `admin/types.ts`.
2. **Component.** `admin/sections/<Name>Section.tsx` exports `<Name>Section` taking
   `AdminSectionProps` (`userProfile`, `onNavigate`, `onMapSelect`), built on `SectionShell`
   and the admin kit ([shared-components.md](../shared-components.md)). A table declares its
   tiers and renders phone cards ([Tables on phones](#tables-on-phones)). Several files go in
   `sections/<name>/`, as `mapUploads/` does.
3. **Registry row** in `ADMIN_SECTIONS` (`admin/registry.tsx`):
   `{ id, label, icon, group, roles, Component }`. `icon` is a `lucide-react` icon. `group` is
   an `ADMIN_GROUPS` id; within a group, array order is nav order, and a group with no section
   the role can see is hidden. A new group is an `AdminGroupId` member plus an `ADMIN_GROUPS`
   entry. `roles` is an allow-list, `ADMIN_DASHBOARD_ROLES` or `ADMIN_ONLY_ROLES`
   ([Access](#access)).
4. **Persistence.** None to add. The open section is `activeSection` in `utbt:adminState:v1`
   (`ADMIN_PREF_KEYS` in `Main.tsx`), and `AdminPage` falls back to the role's first visible
   section when the stored id is gone or hidden. Open the section from another one with
   `onNavigate('<id>')`, which adds no history entry (Maps Management's Add Map does this).
5. **Data.** The section owns its reads: fetchers in `app/utils/api.ts` beside their
   domain, called from the section with `userProfile.accessToken`. `AdminPage` renders only
   the open section, so leaving unmounts it and its `useState` data refetches on return.
   State Back/Forward should restore is `useNavState('admin.<section>.<field>')`; columns and
   saved filters go through `useAdminTable` / `useAdminFilterPresets` with
   `utbt:admin:<section>:…` keys ([state-patterns.md](../state-patterns.md)). Server rules
   the code can't show get a heading in this doc, or their own doc when large.
6. **Tests.** In `admin/registry.test.ts`, a `describe` for the section pinning its group (and
   position when it matters) and its visibility: shown to each role in `roles`, hidden from
   the rest (`ROLE.CUP_ADMIN` and `ROLE.USER` always). A `.test.ts` beside each pure helper. A Playwright spec
   copied from `e2e/admin-streamers.spec.ts`: an init script stores
   `{ activeSection: '<id>' }` under `utbt:adminState:v1` and a staff session under
   `utbt:webAuth:v1`, `page.route` answers `/users/me` with the role and the section's
   reads; it covers the role gate and fits 390 px and 1920 px (`horizontalOverflow` ≤ 1).
   A sub-view for the section in the `admin` mobile manifest entry (`e2e/mobile/manifest/admin.ts`),
   with the section's reads in the synthetic `admin` set (`e2e/mobile/fixtures/synthetic/admin.ts`):
   `routes.contract.test.ts` fails until it exists ([testing.md](../testing.md#role-gated-entries)).
7. **Verify.** `npm run typecheck:web`, `npm test` and the new spec pass; `npm run build:web`
   then `npm run check:bundle` passes (every section sits in the one lazy admin chunk).
