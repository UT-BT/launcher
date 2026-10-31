# Stream kit

The broadcast tools for an event's streamer, renderer side: the Stream tab on the event
page, the OBS scene pages at `/stream/<slug>/<streamerId>/<scene>`, and the broadcast
module they share with the pick/ban stream view. The cam tool and kit extraction in the
main process are in [lib/main/README.md](../../lib/main/README.md), the
`window.conveyor.streamKit` channels in [lib/conveyor/README.md](../../lib/conveyor/README.md),
and the generic pre-shell route mechanism in [web-target.md](../web-target.md).

## Where the code lives

Paths starting `events/stream/` are under `app/components/pages/`.

| Path | Holds |
|---|---|
| `events/stream/` | the Stream tab: `StreamTab`, the panel registry (`streamPanels.ts`), the access gate (`streamTabAccess.ts`), the desk store (`streamDesk.ts`) and its context, `useStreamKitState` |
| `events/stream/panels/` | one component per panel (Match, Cams, Score, Studio, Setup, Guide) and the Setup sections |
| `events/stream/panels/match/`, `studio/`, `channel/` | the desk-writing sections (current match, countdown, lineup, score; casters, BRB, webcam; Twitch channel), built on pure view and action modules and a write hook (`useMatchWrite`, `useShowWrite`, `useChannelWriter`) |
| `events/stream/panels/cams/` | the cam tool's view model (`camToolView.ts`), its hooks and the Red/Blue switch |
| `events/stream/panels/kit/`, `guide/` | OBS kit fetch, folder and banner; the Guide's steps and deep links |
| `app/components/stream/` | the scene pages: registry (`streamSceneRegistry.ts`, re-exported with the route helpers by `streamScenes.ts`), URL options, the pre-shell root (`mountStreamSceneRoot.tsx`), side tags, cues, text helpers |
| `app/components/stream/data/` | the per-page stores, cadence and hooks every scene reads through; `streamFixtures.ts` |
| `app/components/stream/scenes/` | one `<Name>Scene.tsx` per scene; its parts, tested view model, read path and fixtures in `scenes/<scene>/` ([Adding a scene](#adding-a-scene)) |
| `app/components/stream/frame/`, `ticker/`, `ending/`, `stinger/` | the scene frames, the ticker strip, the Ending views, the stinger page |
| `app/components/broadcast/` | tones, motion, stage, fonts and plates shared by the scenes and the pick/ban stream view |
| `e2e/stream-*.spec.ts`, `e2e/*.broadcast.spec.ts` | Stream tab specs; scene screenshot specs on `e2e/streamHarness.ts` ([Screenshot checks](#screenshot-checks)) |

The stream fetchers are not in `app/utils/api.ts`: each sits next to the panel or scene
that owns it and calls `apiRequest`. Put a new one beside its UI the same way.

## API contract

All paths hang off `/tournaments/<slug>/stream`. The desk read and every write take the
bearer token; the scene reads are anonymous, because a browser source has no login. The
envelope rules in [api.md](../api.md) apply. Desk and write errors go through
`streamDeskError` (`streamDesk.ts`), scene-read errors through `readConditional`
(`stream/data/conditionalRead.ts`); both put the server's `error` in the message and its
`code` in `ApiError.reason`, which the per-write wording keys on.

### Desk read

`fetchStreamDesk(token, slug, streamerId, { etag, signal })` → `GET .../<streamerId>/desk`
answers `{ server_now, event, streamer, desk: { brb_message, webcam_enabled,
current_match_id }, reason, match, assigned_matches[], next_match }`. It is ETag-aware
(`If-None-Match`; a 304 reads as `unchanged`), and `X-Server-Now` feeds the same median
clock offset as pick/ban (`pickban/clockOffset.ts`).

- `reason` is `'current' | 'live' | 'holding-finished' | 'next' | 'none'`; `match` is the
  full `StreamMatch` or `null`. Render both as given: the launcher never picks the current
  match itself.
- `match.live_since` is when the match went live and `live_source` says how: `'manual'`
  (Match live was pressed; the stored `live_at`) or `'pick_ban'` (a completed pick & ban).
  Both are null before either. The Score panel shows it, so nobody has to press Match live
  after a pick & ban.
- `match.score` carries `current_map`, `series` (derived from the map winners), `winner`,
  `live_decided`, `live_counting` and one entry per map with `caps`, `decided`, `winner`,
  `source` (`'official' | 'live' | 'manual'`), `closed_by`, `pins` (`a` / `b`, null = not
  pinned) and `winner_override` (`'auto' | 'a' | 'b' | 'none'`; `none` is a draw).
- Map ordinals are 0-based. Show `mapNumber(ordinal)` (`stream/sceneHelpers.ts`), never
  `index + 1` or the raw ordinal.
- `match.sides`, `side_status` and `side_controls` follow the Red/Blue contract in
  [pick-ban-api.md](pick-ban-api.md).

### Desk writes

After any write, call `refresh()` from `useStreamTab()` so the panel re-renders from the
desk. The write hooks (`useMatchWrite`, `useShowWrite`, `useChannelWriter`) do it in
`finally`, on success and failure alike.

| Purpose | Call (file under `panels/`) |
|---|---|
| Current match | `setCurrentMatch` → `PUT .../<streamerId>/desk/current` `{ match_id \| null }`; `moveToNextMatch` → `POST .../desk/next` (`match/currentMatchActions.ts`) |
| BRB text, webcam frame | `setBrbMessage` → `PUT .../desk/brb` `{ message }`; `setWebcamFrame` → `PUT .../desk/webcam` `{ enabled }` (`studio/showActions.ts`) |
| Casters | `setMatchCasters` → `PUT .../matches/<matchId>/casters` `{ casters }`: up to 4 in order, each `{ user }` (a UTBT player id) or `{ name }` (free text, 40 characters) (`studio/showActions.ts`, limits in `studio/casterList.ts`) |
| Channel | `setMatchChannel` → `PUT .../matches/<matchId>/channel` `{ choice: 'mine' \| 'utbt' \| 'other', url? }` (`url` only with `other`), reads `channel.stream_url`; `fetchOwnTwitchChannel` (`GET /users/me`, reads `twitch_url`) and `setOwnTwitchChannel` (`PUT /users/me/twitch` `{ twitch }`) (`channel/channelActions.ts`) |
| Lineup | `fetchStreamLineup` / `saveStreamLineup` → `GET` / `PUT .../matches/<matchId>/lineup` `{ a1, a2, b1, b2, only_if_empty? }`, answers `{ match_id, lineup, effective }` (`match/lineupActions.ts`) |
| Live, score, countdown | `markMatchLive` / `clearMatchLive` → `POST` / `DELETE .../matches/<matchId>/live`; `setMapScore` / `resetMapScore` → `PUT` / `DELETE .../score/maps/<ordinal>` `{ a, b, winner }`; `resetAllMapScores` → `DELETE .../score/maps`; `setLiveCounting` → `PUT .../score/live-counting` `{ enabled }`; `moveCountdown` / `clearCountdown` → `PUT` / `DELETE .../countdown` `{ at }` (UTC ISO) or `{ add_minutes }`. Each answers the match's `broadcast` block (`live_at`, `countdown_override_at`, `countdown_at`, `score_state`, `live_counting`) (`match/scoreActions.ts`) |
| Red and Blue | `setMatchSides` → `PUT .../matches/<matchId>/sides` `{ red_team_id }`, answers `MatchSides` (`cams/sidesActions.ts`) |
| OBS kit | `fetchKitInfo` → `GET .../<streamerId>/kit/info` (`current_version`, `downloaded_version`, `default_folder`); `fetchKitZip` / `kitDownloadUrl` → `GET .../<streamerId>/kit?folder=<folder>`, a zip, with a 120 s timeout (`kit/kitFetch.ts`) |

### Scene reads

- **Hot state.** `fetchStreamHotState` (`stream/data/streamHotState.ts`) →
  `GET .../<streamerId>/state`: the desk's `reason` + `match` shape plus
  `desk.brb_message` and `desk.webcam_enabled`, ETag-aware through `readConditional`, with
  the same clock offset.
- **Composite reads**, each path built next to its scene with `streamMatchReadPath` /
  `streamApiPath`:
  - `GET .../matches/<matchId>/betting` (Predictions and Starting Soon), `.../preview`,
    `.../standings`, `.../post-match` (`scenes/<scene>/<scene>Read.ts`);
  - `GET .../matches/<matchId>/next-map/<ordinal>` and the predictor standings reads (below);
  - `GET .../feed?streamer=<streamerId>` (`ticker/streamFeed.ts`): `results`, `upcoming`,
    `top_predictors` (bettors only, nullable) and `next_match`.
- The pick/ban scene renders the pick/ban stream view, which reads the pick/ban state on
  its own ([pick-ban-ui.md](pick-ban-ui.md)); it has no composite read. The Intermission
  scene reads the hot state only.

**Series semantics** (hot state `match.score`). Read these as given; never work them out
from the map list.
- A map that is `decided` with a null `winner` is drawn (`mapDrawn`).
- `series_state` is `won`, `drawn`, `open` or `unresolved`: every map decided but no
  result, such as a level knockout waiting for a decider. Never call `unresolved` a draw.
- `drawn_maps` counts the drawn maps that count towards the series (a draw after the race
  was already won does not). `seriesTarget` / `seriesFlags` take them out of the race: a
  four-map first-to series with one drawn map is first to two.
- A feed result with a level score is a draw. A feed `next_match` can have a null
  `scheduled_at`: the ticker shows "time TBD" for it, while "Coming up" skips unscheduled
  matches.

**Betting read.** A side's `odds` and a backer's `multiplier` can be null; show a dash.
Each side lists every position ordered by potential payout (highest first, stake breaking
ties), with exactly one `biggest: true` across the market.

**Next Map read.** `nextMapReadPath(slug, matchId, ordinal)` (`scenes/nextMap/nextMapRead.ts`)
answers `map` (name, mapper, `video { available, version, url }`, `screenshot_version`;
null when the slot has no map), `team_wr` (time and holders), `lineup` (per-slot PB with
`verified`) and `cup_history` (`times_played`, `fastest_run`). The scene asks for the
score block's `current_map` (the first undecided map; null once the series is decided) and
only once the hot state has a map row for that ordinal, so nothing is read before pick/ban
places the map (`nextMapReadOrdinal`). The name, pick and tone come from the hot state;
the read only adds details and is ignored when its match, ordinal or map name disagrees.
Build the video URL with `mapVideoUrl(name, video.version)` ([api.md](../api.md)), never
the read's `url`. With no video, or when the `<video>` errors, show the screenshot; a new
version retries the video.

**Predictor standings read.** `predictorStandingsReadPath(slug, matchId)`
(`scenes/standings/predictorStandingsRead.ts`) is
`GET .../matches/<matchId>/predictor-standings` while the hot state has a match and the
match-less `GET .../predictor-standings` when it has none, so the board still shows
between matches (without movement). Render every row in the order sent (ties share a
rank) and derive nothing except the won/decided record,
`positions_won / (positions_won + positions_lost)`. The "Projected" kicker follows
`any_pending`, a row's Pending chip its `pending`, and the ▲n / ▼n / – / New cell
`movement` and `new`; the cell stays empty when the read sends neither (no focus market,
a voided one, or the match-less read). An empty `items` shows "No predictions yet".

## Stream tab

### Visibility and `?tab=stream`

`StreamTab` (lazy) is in `BASE_TABS` of `EventDetailPage.tsx`, so `?tab=stream` is a
valid initial tab, but the tab shows only when `streamTabVisible`
(`events/stream/streamTabAccess.ts`) passes: signed in AND (on the global streamer roster
OR able to manage the bracket). Both facts come from the viewer's event status read, so
until it lands the tab reads as `info` and switches to Stream once it resolves; a viewer
who fails the rule stays on `info`. This is derived per render and never rewrites the URL.

### Panels and the default panel

`streamPanels.ts` is the registry: **Match · Cams · Score · Studio │ Setup · Guide**, the
first four in group `live`, the last two in group `setup`. `StreamTab` draws a
`role="separator"` divider where the group changes, and all six buttons fit at 390 px.
Each panel is a lazy chunk.

The default panel is `initialStreamPanel(remembered, kit)` (pure):
- a valid remembered id wins; any other id or `null` falls through to the kit state;
- kit `loading` opens nothing: the tab reads "Loading your stream desk…" with no button
  pressed, so it never flashes one panel then another;
- `none` (no kit downloaded yet) opens Setup; `downloaded` and `unknown` (the kit read
  failed) open Match.

`useStreamKitState(eventSlug, streamerId, accessToken, needed)` reads the kit info of the
streamer being operated as, only while nothing is remembered, once per event and
streamer. The resolved default is never written to nav state: only a click counts as
remembered.

`e2e/stream-tab.spec.ts` checks the order and divider, the default-panel rule, and that
each panel opens without horizontal overflow at 390 and 1920 px.

### State

| Where | Key | Holds |
|---|---|---|
| nav state | `event.streamAs` | The streamer a manager is operating as (`string \| null`) |
| nav state | `event.streamPanel` | The panel last clicked (`null` = nothing chosen yet) |
| nav state | `event.guideOpen` | The open Guide steps |
| nav state | `event.camServers` | `{ matchId, teams: { <teamId>: choice } }`, a choice being `{ mode: 'detected' }` or `{ mode: 'list' \| 'typed', address }` |
| nav state | `event.camPasswords` | `{ teams: { <teamId>: password } }` |
| localStorage | `utbt:streamKitFolder:v1` | The kit folder (`panels/kit/kitFolder.ts`) |
| launcher config | `camFps`, `camVolume` | Cam FPS and volume, through `window.conveyor.streamKit` |

Nav-state keys restore on Back/Forward and start from defaults on a fresh open
([state-patterns.md](../state-patterns.md)). `?tab=stream` only selects the tab. The Guide
reads a `#guide-<stepId>` hash when the Guide panel mounts and opens that step; it does
not make a fresh load open the Guide.

Cam FPS (`60` / `120`, default 120) and Cam volume (whole percent, default 50) are main-
process config, read and saved through `getCamFps` / `setCamFps` / `getCamVolume` /
`setCamVolume`: they survive restarts, are per device, and are not in `usePageState`,
`useNavState` or `utbt:*` storage. Cam passwords are the opposite: nav state only, never
written to disk, gone once the launcher closes.

### Desk store and context

`StreamTab` builds one identity (`eventSlug`, `streamerId`, `isManager`, `accessToken`)
and wraps the open panel in `StreamTabProvider` (`StreamTabContext.tsx`), which owns one
`createStreamDeskStore` per event and streamer. The store polls the desk every
`DESK_POLL_MS` (2 s) through `createPoller` with `If-None-Match` and keeps the clock
offset. Panels read it with `useStreamTab()`: the identity plus `desk`, `deskLoading`,
`deskError`, `clockOffsetMs` and `refresh()`. The token is read through a ref, so a new
token doesn't reset the store; nothing is persisted.

**Polling inside OBS.** An OBS dock or browser source can report
`document.visibilityState === 'hidden'` while on air, and a poller that rests when hidden
would freeze. The desk store uses `deskPollEnvironment()` (`streamDesk.ts`) as its
`createPoller` environment: `insideObs(window)` detects the `window.obsstudio` object OBS
injects, and `deskPollActive(pageHidden, inObs)` keeps polling whenever it is in OBS;
outside OBS it rests while hidden like any poller ([state-patterns.md](../state-patterns.md)).
A panel that polls on its own (the Lineup section) passes the same environment.

### Roster and operating identity

`streamTabAccess.ts` decides who the tab operates as: a roster streamer streams as
themself ("Streaming as"); a manager picks from the event's streamers ("Operating as"),
needs no roster row, and starts as themself when they also stream. With no streamers, the
tab and the dropdown say so through `events/streamerRoster.ts` (`ROSTER_EMPTY_TEXT`,
`ROSTER_FAILED_TEXT`, `streamerListNote`). A roster streamer with no assigned match in the
event sees one "You're set up, just not scheduled yet" box instead of the current-match
controls. The roster itself is managed in Admin → Streamers ([admin.md](admin.md)).

### Panel pieces

- `StreamCard` (`title`, `description?`, `className?`) is the one labelled section every
  panel section sits in; `StreamPlaceholder` and `StreamLoading` (`StreamCard.tsx`) are the
  dashed empty note and the "Loading …" line.
- Panel action buttons use `ACTION_SHAPE`, `ACCENT_ACTION`, `MUTED_ACTION`
  (`panels/match/scoreControlStyles.ts`); the channel sections use
  `panels/channel/channelControlStyles.ts`.
- The Match panel's sections load lazily from `match/matchSections.ts`; add a section there.

### Score editor

`match/ScoreSection.tsx` (model `scoreView.ts`) edits one map at a time and always sends
the whole map state: stepping or typing a side sends that side's new pin plus the other
side's stored pin and the stored winner override; the Winner select keeps the stored pins.
- A typed value goes out on blur or Enter (Escape restores). Only whole numbers 0-20 are
  accepted, and a value typed on a live side is a pin even if it equals the live count.
- A row is locked (inputs, steppers and Winner disabled, Reset hidden) for an official
  map, every map of a finished match, and the undecided maps once the series is decided
  (`live_decided`).
- `scoreWriteMessage` words the refusals `no_effect` (per write kind), `official_map`,
  `invalid_request` and `unknown_map`; any other error shows the server's message.

### Countdown in local time

The Countdown section labels its input "New time in <zone> (<abbr>)" with the browser's
own zone (not the display-time-zone override) and shows the UTC result under it.
`localTime.ts` is pure and every function takes an explicit IANA zone:
`utcFromLocalInput` returns `ok` (with `ambiguous`), `gap` or `invalid`. A time that does
not exist (clocks go forward) is refused and disables Set countdown; a time that happens
twice uses the first, with a notice. The body is always `{ at: <UTC ISO> }`; the +5 / +10
/ +15 buttons send `{ add_minutes }`.

### Casters

`panels/studio/CastersSection.tsx` holds up to four casters, reorderable: a "UTBT Player
Lookup" (`PlayerSearchInput` from `pages/teams/`, which saves at once and gets the added
UTBT casters as `excludeIds`) and a "Non-UTBT Player" free-text field. The lookup sits in
a labelled `role="group"`, since `PlayerSearchInput` has no label prop.

### Lineup and uncertified servers

Lineup detection and the Cams server picker read `certified_records` from the server list.
`UncertifiedServerWarning` shows "Uncertified server: caps here won't count for the live
score or records." under a team whose server is uncertified (lineup: the server most of
the team's found players are on; cams: the effective server, whether detected, picked, or
typed and listed). An unknown or still-loading server shows nothing, and the warning never
blocks launching cams.

### Setup: kit and scene links

`KitSection` downloads the OBS kit. With the `camTool` capability (desktop) it passes
`kitDownloadUrl` and the token to `streamKit.extractKit`, which unpacks into the chosen
folder; on the web it fetches the zip with `fetchKitZip` and saves it. A successful
download reloads the kit info. `ScenesSection` lists every scene's URL with a copy button and a live
preview iframe at `?preview=1` (`sceneLinks.ts`): `streamSceneUrl` (the site origin) for
copying, and on the web a same-origin path for the preview.

### Cams panel

The cam tool needs the `camTool` capability; on the web the panel shows a notice pointing
at the desktop launcher (`camsGate.ts`). The tool reads no stream route of its own: its
server list is `gateway.fetchServers()` from `usePlatform()`, polled every 30 s
(`cams/camToolHooks.ts`), and the rest goes through `window.conveyor.streamKit`.

- **Cam FPS.** A `60` / `120` group (`aria-pressed`). A click saves at once and the value
  goes on every launch and restart request; Launch waits for the preference to load. If
  saving fails, an amber line says it will reset when the launcher restarts, but the
  choice still applies to this session. What the plan writes into each cam's ini is in
  [lib/main/README.md](../../lib/main/README.md).
- **Cam volume.** A 0-100 % slider in steps of 5 for the game and announcer volume of all
  four cams. Dragging moves a draft; the value saves on pointer or key release or blur,
  goes on every launch and restart request (it takes effect when a cam starts), and fails
  the same way as Cam FPS.
- **Server passwords.** Each team's picker has a masked password field for a locked
  server. A blank field takes the other team's password when both resolve to the same
  address (placeholder "Same as Team A"); otherwise each team sends its own. The request
  carries `passwords: { A, B }`, null for none. A password the game can't take
  (whitespace, `?`, `#`, `"`, or over 64 characters) blocks Launch with a message for that
  team and is never shared.
- **Choices follow the team, not the letter.** `cams/camChoices.ts` stores servers and
  passwords under team ids and converts to the per-letter `{ A, B }` the view model takes:
  `camTeamIds(match)` maps each letter to a team through the desk's `sides` mapping,
  `readCamServerChoices` / `readCamPasswords` read, `storeCamServerChoice` /
  `storeCamPassword` write one letter. So a Red/Blue swap moves each team's server and
  password to its new letter. Server choices for another match read as detection;
  passwords carry over to the team's next match. Both readers take the stored value as
  `unknown` and keep only well-shaped entries under `teams`. A letter with no team yet
  can't store a server, and its picker is disabled.
- **Red and Blue card.** It sits above the cam tool (on the web, above the notice), so a
  web caster can still fix the colours. `camSidesView(match)` (`cams/camSidesView.ts`)
  builds it from the desk's `match`: `red` / `blue` are the teams on sides A and B (Red is
  A); `tbc` is true while `side_status.confirmed` is false (a "Sides TBC" tag); `swap` is
  null (button hidden) unless `side_controls.can_swap` and both teams are set, and is
  disabled with a reason when `side_controls.blocked_reason` is set
  (`pick_ban_in_progress`: "Finish pick/ban first, or ask an admin."). Confirming sends
  `setMatchSides` with the current Blue team as `red_team_id`. `sidesSwapErrorMessage`
  words `pick_ban_in_progress`, `not_authorized` and `invalid_side`; anything else shows
  the server's message. `nextSidesSwappedNotice` compares each desk read with the one
  before: when the same match's `sides` flip, after anyone's swap, `SidesSwappedNotice`
  (`cams/CamSides.tsx`) says who is Red and Blue now until dismissed or the desk moves to
  another match. A desk without `side_status` / `side_controls` shows no tag and no button.

## Scene pages

### Route, registry and options

`/stream/:eventSlug/:streamerId/:scene` is the OBS browser-source family.
`parseStreamScenePath` (`stream/streamScenes.ts`) matches exactly five segments starting
`/stream/`; `renderer-web.tsx` then dynamically imports `stream/mountStreamSceneRoot.tsx`
before `App` mounts. Scenes are web pages only; OBS loads them from the site. The
pre-shell mechanism, noindex (`markPageNoIndex` + `robots.txt`) and the bundle checks on
the scene root and every `stream/scenes/*Scene.tsx` are in [web-target.md](../web-target.md).

- `STREAM_SCENES` (`streamSceneRegistry.ts`) is the registry: id, label, `transparent`, and
  `obsName` where the imported OBS collection names the scene differently (the overlay is
  "Match" there). `NEWEST_STREAM_SCENE_ID` beside it is the scene the kit re-import banner
  names. Every scene list and count derives from it: the Scenes card, the Guide's count and
  scene names (`countWord` and `joinWithAnd` in `app/utils/wording.ts`), the kit banner, the
  route contract and the scene specs. The file reads no `import.meta`, so Playwright specs
  import it directly. An unknown id (`/stream/cup/42/scoreboard`) is still claimed by the
  stream root and renders `UnknownScene`, never the app. `streamScenePath` /
  `streamSceneUrl` (`streamScenes.ts`) build links.
- `mountStreamSceneRoot` maps each id to a lazy `stream/scenes/<Name>Scene.tsx`, wraps it
  in `StreamDataProvider` and `PickBanMotion`, and for a transparent scene clears the
  document, body and root backgrounds.

URL options (`streamSceneOptionsOf`, `stream/streamSceneOptions.ts`) become the scene's
`options`:
- `?sound=0` mutes cues and `?volume=<0-100>` sets their volume (`sound`);
- `?motion=0` turns animation off (`animate`);
- `?preview=1` (`isStreamPreview`) marks a preview. A preview is never active: it stays on
  the hidden cadence whatever OBS reports, so the Setup panel's page of previews stays cheap.

### Data hooks and cadence

`StreamDataProvider` (`stream/data/`) builds one cadence store, one hot-state store and
one read registry per page. Scenes read only through the hooks in `data/useStreamData.ts`,
never `fetch`:

| Hook | Gives |
|---|---|
| `useSceneMatch()` | The resolved phase: `loading`, `idle` (no hot state, `reason: 'none'` or no match) or `match` |
| `useStreamHotState()` | The hot-state snapshot, `clockOffsetMs`, `reconnecting` |
| `useSceneRead<T>(path \| null)` | One composite read, shared and deduplicated per path (`sceneReadRegistry.ts`); `null` reads nothing |
| `useSceneNow(stepMs)` | The server-corrected clock, ticking every second by default (pass a coarser step to save renders) |
| `useSceneCadence()`, `useStreamData()` | The cadence, and the raw stores |

Both store kinds are `createPoller` with `alwaysPoll: true` (they ignore Page Visibility
entirely), merge structurally, keep the last good value on failure, and set
`reconnecting` after `RECONNECTING_AFTER_FAILURES` (3) failures in a row.

**Cadence** (`data/sceneCadence.ts`). A scene is active outside OBS (a plain browser), or
when OBS says the source is active or visible; a preview never is.

| Read | Active | Hidden |
|---|---|---|
| Hot state | `HOT_STATE_ACTIVE_MS` 2 s | `HOT_STATE_HIDDEN_MS` 30 s |
| Composite reads | `COMPOSITE_ACTIVE_MS` 30 s | `COMPOSITE_HIDDEN_MS` 120 s |

OBS reports through the `obsSourceActiveChanged` and `obsSourceVisibleChanged` window
events (`detail.active` / `detail.visible`). Turning active refetches the hot state and
every mounted composite read at once, so a scene cut to in OBS is fresh on its first
frames.

### Frames and reusable pieces

Reuse these before drawing anything new in a scene:

| Piece | Use it for |
|---|---|
| `SceneFrame` (`stream/frame/SceneFrame.tsx`) | An opaque scene: branding and stage line, title and optional kicker in a 152 px header, the body in `<main>`, the 64 px ticker strip (`data-scene-ticker`) and the reconnecting badge. `backdrop={false}` makes it transparent with the same header; `ticker={false}` drops the strip |
| `OverlayFrame` | A fully transparent scene with no header: stage, fonts and reconnecting badge only |
| `BlankFrame` / `IdleFrame` (`frame/IdleFrame.tsx`) | Before a match: `BlankFrame` while the first read is `loading` (empty, `aria-busy`, no flash), `IdleFrame` when there is nothing to show (logo, event name, utbt.net) |
| `sceneHelpers.ts` | Pure text and series helpers, so every scene words stages, formats, map numbers, series targets, draws and times the same way |
| `sceneSideTags(side_status)` + `SceneSideTagChip` | The RED / BLUE or "Sides TBC" tag by a team name (wording rules in [pick-ban-ui.md](pick-ban-ui.md)) |
| `useSceneCues(sound)` | Sound cues (`map-win`, `match-winner`, `countdown-zero`); scenes wrap it in a small hook (`useMapReveal`, `useWinnerCue`, `useCountdownCue`) |
| `SceneMapTile`, `SeriesScoreCard`, `SeriesTable` | Map art with tone framing; the series score with won/open flags (`sideTags` adds side chips); the per-map series table (Intermission and Post-match each have their own) |
| `ending/`, `stinger/` | The Ending scene's credits and next-matches views; the stinger page (`stinger/stingerPage.tsx`, timed by `stingerTimeline.ts`) |

The Caster Cam scene is registered transparent and draws the `SceneFrame` backdrop only
while the desk's webcam frame is off. Pick & Ban is the one scene that renders the
pick/ban stream view instead of a frame.

### Adding a scene

Copy Predictor Standings (#290), the newest scene: `PredictorStandingsScene.tsx` plus
`scenes/standings/predictorStandings*.ts`.

1. **Register.** Add the id, label and `transparent` flag to `STREAM_SCENES`
   (`stream/streamSceneRegistry.ts`), plus `obsName` if the kit's OBS scene is named
   differently. The Scenes card, the Guide text, the scene specs and their counts follow.
2. **Scene file.** `stream/scenes/<Name>Scene.tsx`: a default export taking
   `StreamSceneProps` (`eventSlug`, `streamerId`, `options`; `streamSceneOptions.ts`). The
   name must end in `Scene.tsx` for the bundle check. Add it to the `SCENES` map in
   `mountStreamSceneRoot.tsx`.
3. **Pure parts.** The shaping in `scenes/<scene>/<scene>View.ts` and the read path and type
   in `<scene>Read.ts`, both tested with Vitest; synthetic fixtures in `<scene>Fixtures.ts`.
4. **Frame and phases.** `useSceneMatch()`: `loading` renders `BlankFrame`, no hot state
   renders `IdleFrame`, otherwise the stage, keyed by match id, reads through
   `useSceneRead(<scene>ReadPath(...))` inside a frame. The frame stamps
   `data-stream-scene`, which the specs wait on.
5. **OBS kit.** The kit zip comes from the API: OBS gets a source for the scene only once
   the served kit includes it and raises `current_version`. Then point
   `NEWEST_STREAM_SCENE_ID` at the scene, so the re-import banner names it.
6. **Specs.** `e2e/stream-scenes.spec.ts` (loads with no app shell, noindex) and
   `e2e/stream-scenes-panel.spec.ts` (a URL row per scene) already loop over the registry;
   write `e2e/<scene>-scene.broadcast.spec.ts` on `openScene` /
   `expectSceneScreenshot` with committed baselines ([Screenshot checks](#screenshot-checks)).
7. **Verify.** `npm test`, `npx playwright test e2e/stream-scenes.spec.ts
   e2e/stream-scenes-panel.spec.ts` and `npx playwright test --project=broadcast
   e2e/<scene>-scene.broadcast.spec.ts` pass; `npm run build:web` then
   `npm run check:bundle` reports the scene's own chunk `ok`.

## Broadcast module

`app/components/broadcast/` is what the pick/ban stream view and every scene share. Import
from here, never from a scene or from `pickban/`, and never re-derive tones, curves, the
stage or the fonts.

- **Surface.** `BROADCAST_SURFACE` (`broadcastTone.ts`) is the root class of an opaque
  scene. It is a fixed dark surface, deliberately not a theme token: a broadcast looks the
  same under every theme, Light included.
- **Tones.** Team A crimson, team B azure, decider gold and a neutral, always through
  `PICK_BAN_TONES` (class sets) and `PICK_BAN_HUES` + `tint(hue, percent)` (a `color-mix`
  for gradients, glows and shadows). Map a stream side with `sideTone` / `teamTone`, a
  pick/ban step with `stepTone`. Never hand-write `pickban-*` classes or hex values.
- **Motion.** Every enter, exit and reveal uses the curves (`EASE_OUT`, `EASE_IN`,
  `EASE_OVERSHOOT`, `SLAM`) and presets (`SCENE_VARIANTS`, `staggeredCard`, `CHIP_MOTION`,
  `STAMP_MOTION`, `FADE_MOTION`, `REVEAL_*`, `INDICATOR_TRANSITION`) in
  `broadcastMotion.ts`, not new numbers. `pages/events/pickban/components/stageMotion.ts`
  keeps only the pick/ban choreography. Scenes get `animate` from `motion=0` through `PickBanMotion`.
- **Fonts.** `useBroadcastFonts()` loads the four Barlow Condensed faces
  (`BROADCAST_FONTS`) so the first frame doesn't paint a fallback. Every frame calls it;
  call it in any new root.
- **Stage.** `BroadcastStage` is a fixed 1920×1080 box scaled to the window
  (`computeStageScale`, `stageScale.ts`). It is opaque by default (black letterbox,
  `bg-background`); `transparent` leaves the stage and letterbox clear so OBS composites
  the page over the game. A transparent scene must not paint a full-frame fill.
- **Pieces.** `BroadcastBackdrop` (the two-side tinted grid behind an opaque scene),
  `TeamPlate` (the angled team plate; members through `PlayerInfo`; `ab` only picks the
  colour, and `tag` leads with a solid RED / BLUE chip) and `ReconnectingBadge` (frames
  render it for you).

### Scene stylesheet

Scene-only classes stay out of the app's startup CSS:
- `app/styles/theme.css` holds the `@custom-variant dark` and the `@theme` block (theme
  colours, `pickban-*`, `font-pickban`), shared by both stylesheets.
- `app/styles/globals.css` imports it and excludes `app/components/stream` from class
  scanning (`@source not`).
- `app/components/stream/streamScenes.css` builds only the theme and utilities layers (no
  preflight) and scans only the stream folder. It is imported by
  `mountStreamSceneRoot.tsx`, `stinger/stingerPage.tsx` and the scene-frame test harness
  (`e2e/sceneFrameHarness.ts`); import it from any new scene entry point, or its classes
  won't exist there.

On the web the scene pages still load the app stylesheet (the entry links it), so a class
used in a file outside `stream/` (`broadcast/`, `pickban/`, shared components) comes from
the app CSS, and a class used only under `stream/` comes from the scene CSS.

## Scene layouts

Every scene is drawn on the fixed 1920×1080 stage; an opaque `SceneFrame` body is
1792×824. No scene draws an A/B chip or a "Team A" label: a side is its colour bar, wash
and tone, and the team's name.

The list scenes (Predictions, Predictor Standings) never scroll or page, so every OBS
source shows the same frame. Each fits itself through a pure function of the counts,
stepping row heights 44 → 40 → 36 → 33 → 30 and folding the tail into a "+ N more" line
only past the 30 px floor. Because the fit depends only on counts, the geometry never
changes as a market moves from closed to settled, and number columns are sized from the
longest value on screen so a changing value doesn't shift a column.

Per scene, what a change needs to know (the numbers live in the files named):

- **Match overlay (layout 06)** (`scenes/overlay/`, positions in `overlayLayout.ts`, view
  in `overlayView.ts`, null when idle). Every part sits on the frame's edges or its centre
  and clear of the four cam timer zones (checked by the spec). Four name tags on the outer
  edges flush against the horizontal seam, seam rails in the team colours, and a centre
  cross of two score rows around a solid map strip. The rails are children of the hub's
  seam row, anchored to its edges, so they always end against the centre box however many
  maps the strip holds, with no measuring; the hub's drop shadow sits on the rows and
  strip, not the hub, so the rails cast none. Name-tag masks are nested rather than
  composited so older browser sources render them, and 300 px is the widest tag that
  clears the lower cams' timer zones. Win pips come from `seriesFlags`, so each counted
  drawn map takes one pip off. The strip never turns
  see-through; past its maximum width it collapses played and skipped cells to number and
  score, then steps the upcoming-name cap down, then shows number badges only. The
  `FT{caps_to_win}` chip sits outside the clipped cell box so it is never cut off.
- **Next Map** (`scenes/nextMap/`, opaque). A 1280×720 hero (video, or the screenshot with
  a slow pan) with the "Map N" chip in the picker's tone, and a column of the series card
  (with side tags), Team WR, Lineup PBs and Cup history. It shows "Maps to be decided"
  until the hot state has the map row, "Series complete" / "Series drawn" once decided,
  and "Series level" while a knockout waits for a decider. The `<video>` is `muted`,
  `loop`, `playsInline`, `preload="auto"`, from the API host, and needs no desktop
  capability. It never follows Page Visibility or the OBS events: the kit's browser source
  stays alive while hidden, so the video is buffered and looping when the scene is cut
  to. The screenshot's pan is one stage-level framer-motion loop, inside the
  [styling.md](../styling.md) animation budget. Under `motion=0` the video stays paused on
  its first frame and the pan stops.
- **Predictions** (`scenes/betting/`, fit in `bettingLayout.ts`). Before the market closes
  it shows the odds plates. After that it names every bettor in groups A | Draw | B (no
  Draw group on a two-way market) in the served order, at most 4 columns across all
  groups; a group nobody backed keeps a column reading "No bettors on this outcome". Past
  the floor the spare columns go to the group with the most bettors per column, and an
  overflowing group cuts the lowest potential payouts (the biggest bet replaces the last
  row if it would be cut). Once the result is official (not voided or refunded) a losing
  group re-sorts by stake, biggest loss first; the winning group keeps the served order.
  A voided market refunds every row and lights nobody.
- **Predictor Standings** (`scenes/standings/predictorStandings*`, fit in
  `predictorStandingsFit.ts`). Every predictor at once, filled column by column in rank
  order: at each row height try 3 columns then 4; past the floor the tail folds into
  "+ N more predictors" in the last slot. The movement cell keeps at least the arrow width
  even when every row's is empty, and the chip cell is dropped when nobody is pending.

## Screenshot checks

Scenes are checked visually at 1920×1080 with Playwright (`playwright.config.ts`):

- **Project.** Specs named `*.broadcast.spec.ts` run only in the `broadcast` project
  (Desktop Chrome, 1920×1080, `deviceScaleFactor: 1`); the other projects ignore them.
- **Baselines** are committed under `e2e/__screenshots__/<spec file>/`, named
  `<name>-broadcast-<platform>.png`, per platform because font and gradient rasterisation
  differ. A platform with no baseline fails its first run and writes one: commit it.
  Update with `npx playwright test --project=broadcast --update-snapshots` (add a spec
  path for one file) and review the changed images. Comparison defaults are in the config.
- **Determinism** (`e2e/streamHarness.ts`, used by every scene spec): `openScene` freezes
  the clock at `STREAM_T0`; `serveStreamApi` serves the hot state, reads, pick/ban state,
  screenshots and avatars from fixtures (no live network; images as generated SVGs); the
  scene opens with `SCENE_OPTIONS` (`sound=0&motion=0`); analytics consent is denied so no
  banner shows; `expectSceneScreenshot` runs `settleScene` (all four Barlow faces and
  every image loaded) and masks the time-driven ticker strip in magenta.
- **Transparency** is asserted, not eyeballed: the overlay spec screenshots with
  `omitBackground`, composites over `e2e/overlay-quadrants.jpg` and checks that every part
  sits on an edge or the centre, that nothing differs from the image beyond a 40 px shadow
  margin outside a part's box, and that the four timer zones have no alpha at all.
- **Video scenes** (Next Map) serve `e2e/next-map-flythrough.webm` with range support
  through `page.route`, added after `serveStreamApi`, and wait for the video's
  `readyState`; the baseline runs with `motion=0`, so it is the first frame.
- **Sound** has its own guard, `e2e/audio-balance.broadcast.spec.ts`, which decodes the
  shipped cue files ([pick-ban-ui.md](pick-ban-ui.md) has the sound rules).
- **Fixtures** live beside the scene code (`stream/data/streamFixtures.ts`,
  `stream/scenes/<scene>/<scene>Fixtures.ts`): synthetic teams, players and maps only.
