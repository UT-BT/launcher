# Pick/ban UI

The client side of pick/ban: the polled session store, the view model, captain and manager
play, the match pick/ban page (`match-pickban`), the chromeless stream view, the visual core
with its motion and sound, and the Red/Blue and veto presentation. Read it before touching
anything under `app/components/pages/events/pickban/` or
`app/components/pages/MatchPickBanPage.tsx`. The server contract (state read, ETag and clock
sampling, payload and phase/timing semantics, commands and their bodies, refusal codes,
version pinning, sides and veto rules) is in [pick-ban-api.md](pick-ban-api.md).

## Where the code lives

Paths below are relative to `app/components/pages/events/pickban/` unless they start with `app/`.

| Path | Holds |
|---|---|
| `app/components/pages/MatchPickBanPage.tsx` | the `match-pickban` page, which stacks the layers below |
| `pickBanSession.ts`, `usePickBanSession.ts`, `clockOffset.ts`, `mergePickBanState.ts` | store: polled state, clock offset, commands |
| `pickBanView.ts`, `chooserReasonCopy.ts`, `pickBanCopy.ts`, `pickBanStatus.ts` | view model: the pure render model every screen reads, and its words |
| `captainPlay.ts`, `useCaptainPlay.ts`, `captainVeto.ts` | captain play: transient selection, lock-in, hover, refusal words |
| `managerDock.ts`, `editFinal.ts`, `useManagerDock.ts` | manager play: Match Control, act-for, Edit final draft |
| `components/` | visual core: the pieces both screens are built from, and their motion |
| `stream/` | the fixed 1920×1080 stream view (`mountStreamRoot.tsx` mounts it before the app shell) |
| `pickBanSound*.ts`, `usePickBanSound.ts` | sound cues timed to the animation |
| `pickBanFixtures.ts` | synthetic states shared by Vitest and Playwright |

The page stacks the layers: `usePickBanSession` → `usePickBanView` → `useCaptainPlay(view,
session.sendCommand)` → `useManagerDock(captain.view, session)` → render `manager.view`, so
both the captain's and the manager's optimistic state show. Decisions live in pure `.ts`
modules, each with a `.test.ts` that runs without a DOM; put new ones there, and keep
components to rendering.

## Session store

`createPickBanSessionStore` is `createPoller` (see [state-patterns.md](../state-patterns.md))
plus the data, exposed as a `useSyncExternalStore` store. Snapshot:
`{ state, clockOffsetMs, loading, error, reconnecting }`.

- **Loading.** `loading` is true only until the first answer. Show a skeleton only while
  `loading && !state`; later polls refresh silently.
- **Failures.** A failed poll keeps `state`. `reconnecting` turns on after
  `RECONNECTING_AFTER_FAILURES` (3) failures in a row; show the reconnecting indicator only
  then. `error` holds the last failure, which is how a first load that never succeeded is
  reported.
- **Structural sharing.** Every fresh payload goes through `mergePickBanState`: pool cards
  are matched by map name, plan steps by `index`, members by `id`, so each unchanged card,
  step and member keeps its object identity, and a 304 keeps the whole state object. Use the
  same values as React keys so nothing remounts or replays an animation on refresh.
- **No rollback.** A payload with a lower `version` of the same session than the one held
  is ignored, so a slow poll never undoes a command's optimistic result.
- **Cadence.** `pickBanPollIntervalMs(status, error, alwaysPoll)` decides every cycle: 1 s
  (`ACTIVE_POLL_MS`) while `lobby`, `running` or `paused`; 10 s (`IDLE_POLL_MS`) once the
  session is terminal, even with `alwaysPoll`. With no session yet it polls every second,
  except after a first load refused with 401, 403 or 404, which slows to 10 s unless
  `alwaysPoll` is set. The page stops polling while the document is hidden and polls at once
  when it shows. The stream view passes `alwaysPoll: true`: an OBS browser source is
  routinely reported hidden, and a source added before the lobby opens (a routine 404) must
  pick the session up within a second of Open.
- **Clock.** Pass `clockOffsetMs` to the view model with `Date.now()`; never compare server
  timestamps against the raw local clock.
- **Commands.** `sendCommand(command, input)` and `sendManagerCommand(command, input)` add
  the current `version`. `sendManagerCommandAt(version, command, input)` sends the version it
  is given, for a command that must fail with `version_conflict` if anything changed since
  the manager looked (Reopen, Edit final). A command applies the returned state at once
  (the actor never waits for a poll), resamples the clock and reschedules the poller. A
  refused command polls at once, then rethrows the `ApiError`. Without a token a command
  throws before sending.
- **One command at a time.** Commands, participant and manager, run in a queue: each reads
  the `version` only after the previous one settled. Every command bumps the version, hovers
  included, so this is what lets a Lock In pressed while a hover is in flight carry the
  version that hover answered with. A refused command doesn't hold up the next one.

**Hooks** (`usePickBanSession.ts`):

- `usePickBanSession({ accessToken, slug, matchId, alwaysPoll })` keeps one store per slug,
  match and `alwaysPoll`. It reads the token through a ref, so a token change triggers a
  poll instead of resetting the state.
- `usePickBanView(state, clockOffsetMs)` builds the view on every render and re-renders
  itself at the view's `nextBoundaryAt`, so reveals and phase changes land on their
  timestamps rather than when a poll arrives. It does not re-render per frame: drive
  countdowns and progress bars from `countdown.endsAt` on animation frames, as
  `CountdownText` and `CountdownBar` (`components/Countdown.tsx`) do.

## View model

`buildPickBanView(state, { clockOffsetMs, now })` (`pickBanView.ts`) is the only reader of
the payload: every screen renders from the `PickBanView` it returns. Read the interface for
the fields; the rules that aren't visible from it:

- **Its own clock.** It re-derives the phase from the payload's timestamps at
  `now + clockOffsetMs`, frozen at `paused_at` while paused, so reveals and phase ends happen
  without a poll. `countdown.endsAt` and `nextBoundaryAt` are local-clock epoch ms; a frozen
  countdown has `endsAt: null` and a fixed `remainingMs`. The timing rules it applies are in
  [pick-ban-api.md](pick-ban-api.md).
- **`phase` vs `stagePhase`.** `phase` is `'paused'` while paused (`'none'` without a
  session); `stagePhase` keeps the phase the pause froze, so the paused overlay sits over it.
  The veto and side steps map onto the stage: `veto_choice` and `side_choice` show as
  `awaiting` with no `turn` and no countdown, `veto_spotlight` and `side_spotlight` as
  `spotlight` with no `spotlight` entry, counting down to their end. Their own phase is in
  `veto.phase` / `side.phase`.
- **Labels.** `actorLabel` is the team's name, its colour ("Red") while the team is
  undecided, or "Decider"; `actionLabel` adds the colour and verb ("Crimson Cats (Red) bans").
  `match.title` is "<A> vs <B>" with "TBD" for a missing team. Render these; never rebuild a
  label from a name and a letter.
- **Cards.** `selected` is always `false` here (captain and manager play layer it on).
  `selectable` marks available cards while the viewer can lock or act for a side, `previewed`
  the awaited side's `selection_preview`. `exclusionReason` is a sentence naming the team and
  seed that triggered the exclusion. A card waiting on the team-chosen veto has
  `pendingChoice` and `pendingLabel` ("Hard?"); one a team vetoed is `excluded` with
  `vetoedBy` / `vetoedByName`.
- **Reveal lead.** While a lock-in is inside its reveal lead, only the side that locked it
  sees the step `locked_in` and the card `lockedIn`; everyone else still sees it awaited. An
  automatic step is never the viewer's own (never `locked_in`, `viewerActs: false`), like the
  decider. `canLock` is re-derived when a spotlight or the intro ends, so a captain can act
  without waiting for a poll; the server's `can_lock_now` only overrides it for a payload
  read while awaiting.
- **`revealing`** (card and timeline entry) is true only while that step's reveal entrance
  runs. Flash a card or chip on the render where it turns true, so a late poll or a page
  opened mid-spotlight shows the new state without the flash.
- **Summary** reserves a slot per map from the start, in play order, filled as steps reveal.
  Once a manager edited the final list (`edited` and `final_maps` set) it is built from
  `final_maps` instead, all at once with no reveal gating.
- **Teams.** `teams.left` is side A, `teams.right` side B (left falls back to `team_a` while A
  is undetermined), each with its `color`.
- **`side`.** `red` falls back to side A; `viewerColor` is the viewer's colour once confirmed;
  `chooserLine` comes from `chooserReasonCopy.ts` (shared by the page, the manager dock and the
  stream; it adds the numbers when `chooser_basis` fits the reason); `introLine` is per source
  ("Sides set by admin"); `notice` shows when `changed_mid_veto` is set; `cards` carry each
  colour's `lead` ("Ban 1st, pick 2nd") and step labels, empty without a plan.
  `viewerChooses` stays true for the chooser through `side_choice` even while a pause closes
  it; `canChoose` doesn't.
- **`veto`** is `null` when the stage has no choice rule. `poolLine` ("13 or 9 maps") is set
  while the veto is unresolved; `canVeto` and `viewerChooses` split like the side's;
  `waiting` is worded per viewer. During `veto_spotlight`, `reveal.revealAt` moves by a few ms
  whenever a poll resamples the clock offset, so key anything that must stay mounted for one
  reveal by `reveal.id` (the payload's `resolved_at`).
- **`affordances`.** `actingSide`/`actingAb`, `canReady`, `isReady`, `canLock`, and `manager`
  (`null` without `can_manage`): one flag per dock control, mirroring the command windows in
  [pick-ban-api.md](pick-ban-api.md), plus
  `startBlockedBy`, `resultsPresent`, `lockForSide`, `actForSide`, `actForSideChoice`,
  `actForVeto` and `undoTarget`. `lockForSide` is false for a manager who plays in the match
  (`viewer.side` set), and then every act-for stays empty. `undoTarget` is `step` once a human
  (non-automatic) step is in, else after a resolved veto `side` (step 0 set it) or `veto`,
  else `null`. `reopen` needs a complete session with a human step; `editFinal` also waits for
  the view's own phase to reach `complete` (after the last spotlight), so the editor never
  opens on an unrevealed slot.
- **`scene`** is what the centre stage shows. Its `key` (`lobby`, `intro`, `veto-choice`,
  `veto-reveal`, `side-choice`, `side-reveal`, `turn-<index>`, `reveal-<index>`, `complete`,
  `none`, `cancelled`, `voided`) stays the same across every poll within one moment;
  `position` orders scenes through a run; `elapsedMs` is how long ago it began on the server
  timeline (frozen while paused, `null` in the lobby and end states). `entranceMs` is a share
  of the pacing, capped per kind (`INTRO_ENTRANCE_MAX_MS`, `REVEAL_ENTRANCE_MAX_MS`: the
  decider's cap highest, ban-down's lowest), so each entrance fits its spotlight;
  `entranceMsFor(pacing, 'intro' | segment)` and `introStartsAt(state)` give the sound cues
  the same numbers.
- **Direction.** `sceneDirection(previous, next)` is `1` forward, `-1` when the position goes
  back (undo, restart, reopen), `0` for the same key. `playsEntrance(scene, direction)` is
  false only for a forward scene that arrives after its entrance would have finished, so it
  appears settled and never plays out of step with other screens; an undo always animates.

## Captain play

`CaptainPlay` is the captain's transient state on top of the polled data: the selected map
tied to the plan index it was chosen for, the command in flight, the lock-in being sent and
the last refusal. It lives in the page's state for as long as the page is mounted; never
persist it or put it in nav state. Screens never read its fields; they go through
`captainPlay.ts`:

- `withCaptainPlay(view, play)` layers the play onto the view. A lock-in in flight shows as
  "Locked In" on the card, turn and step at once, with nothing selectable. A selection shows
  only while its plan index is the awaited step and its card is still `selectable`, so a step
  that moved on, an undo or a map that became unavailable drops it with no bookkeeping. While
  the captain has their own selection, or a lock-in is in flight, it clears every card's
  `previewed`: the server's preview only echoes an earlier selection and would keep the old
  map highlighted until the next poll.
- `captainDockOf(view, play)` is the dock model: controls `ready`, `choose`, `locked_in`,
  `locked` (start lead, intro, spotlight or pause, with the view's `countdown` and the next
  `turn`) or `waiting`, plus the refusal message. It is `null` for anyone without
  `affordances.actingSide` (spectator, teammate, replaced captain, manager) and once the
  session is complete, except for the actor's own "Locked in" during its reveal lead, or a
  refusal still showing after a refresh took the controls away.
- `selectMap`, `beginLock` and `beginReadyToggle` return the next play; the begin functions
  also return the command and body. They return `null` while a command is in flight or when
  the controls aren't open: that is the double-submit guard. `useCaptainPlay` also keeps the
  latest play in a ref, so a second click in the same tick is refused before React
  re-renders.
- `commandSucceeded` clears the selection and lock-in (the returned state takes over).
  `commandRejected(play, error)` keeps the selection for another try and words the refusal
  from the stable code (separate tables for `lock` and `ready`/`unready`). Any code without
  wording falls back to `unwordedRejection`: the unreachable-network words for a `TypeError`
  or timeout, else the error's own message.

### Selection preview (hover)

While the viewer's side is choosing, everyone else and the stream see which map it has
selected. A manager never sends `hover`.

- `hoverOf(play, view)` is the body (`{ map }`) for the captain's selection, or `null`. It is
  `null` unless the dock is `choose` (only a captain or acting captain on their side's turn),
  once Lock In is pressed, and for a map the board already shows as `previewed`.
- `createHoverSender(target, send)` debounces it by `HOVER_DEBOUNCE_MS` (300 ms) and asks
  `target()` for the body when the timer fires, so a Lock In, a pause or an already-previewed
  map in between sends nothing. It never sends the map whose hover is still in flight. A
  failed hover is swallowed (no message, no busy state, never blocks Lock In) and retried
  once after the debounce.
- `sync()` runs after every view or play change and requests a hover only when `target()`
  goes from `null` to a body. That re-sends a preview that went away while the captain kept
  the selection (a pause clears it on the server; a refused or rate-limited hover never set
  it), at most once per return to the turn. Nothing can loop: a re-send needs a new
  selection, a return to the turn, or the first failure of a fresh request.
- `useCaptainPlay`: `select` requests a hover, `lockIn` cancels a pending one first (the
  store's queue covers one already in flight), and unmount cancels too.

### Step 0 side choice and the Hard-map veto

Neither goes through captain play. The view's `side` and `veto` blocks say when they run and
what this viewer may do ([View model](#view-model)); the page handles both:

- While `side.phase` or `veto.phase` is set, anyone with `affordances.actingSide` gets the
  captain dock with `side={view.side}` or `veto={view.veto}`, even when `captainDockOf` is
  `null` (no lettered turn is open yet).
- During the veto phases the page drops the dock's lettered `controls`, so its rows never
  announce step 1 before the side choice. During `side_spotlight` the usual `locked`
  controls (reason `spotlight`) show the countdown to step 1.
- The selected side or veto card is `useState` inside `CaptainDock`, so it is dropped when
  the phase ends. Lock In sends `sendCommand('side', { choice })` or
  `sendCommand('veto', { choice })`.
- The page keeps `{ choosing, rejection }` per flow in `useState`; `choosing` disables the
  cards and spins the button. Side refusals are worded by the page's
  `SIDE_CHOICE_REJECTIONS`, veto refusals by `vetoRejection(error, tag)` (`captainVeto.ts`,
  worded with the veto's `tag`), both falling back to `unwordedRejection`. Dismiss clears
  both and the captain's own refusal.
- While a choice is closed for its chooser (a pause), `side.viewerChooses` /
  `veto.viewerChooses` keep that captain's dock on the choice with locked controls rather
  than the waiting row.

## Manager play

`managerDock.ts` is the same idea for a viewer with `can_manage`, on its own path so a
manager never goes through the captain's select. `ManagerPlay` holds the act-for selection
and lock-in, the command in flight, the request awaiting confirmation, the open Edit final
draft, and the last refusal with the command it answered.

- **Gating.** Every control's window comes from `affordances.manager`, so the dock model and
  `beginManagerCommand` always agree. Start is also refused while `startBlockedBy` is set.
- **Actions vs requests.** `ManagerAction` is what the dock asks for, `ManagerRequest` what
  goes over the wire. `reopen` is sent as `undo` pinned to the view's `version` when its
  confirmation opened; `edit-final` as the draft's list pinned to the version the draft was
  seeded from. A pinned request goes through `sendManagerCommandAt`, so another manager's
  edit or a reopen that completed meanwhile answers `version_conflict` instead of being
  overwritten. Restart and Cancel send the latest version, because captain hovers bump it
  constantly while a session runs. Reopen only applies to a complete session and Undo only
  to a running or paused one, so neither can run as the other.
- **Confirmation.** For `reopen`, `restart`, `cancel`, `edit-final`, act-for `side` and
  act-for `veto`, `beginManagerCommand` returns a play holding the resolved request and no
  request; `confirmManagerCommand` sends exactly that request and `dismissManagerConfirm`
  drops it. Asking again just asks again; only the confirmation sends.
- **Act for a team.** `selectActForMap` then `beginActForLock` sends `lock` with side, map
  and plan index. `dock.actFor` is a `CaptainDock` model, rendered by `CaptainDock` with
  `actingFor` in the captain dock's slot under the stage. It mirrors the captain's controls
  (`choose`, `locked_in`, `locked` through the start lead, intro, spotlight or pause,
  `waiting` during someone else's reveal lead or the viewer's own turn as captain), so the
  strip stays put from Start to the last lock-in. The captain dock wins when the viewer is
  also an acting captain. A manager who plays in the match (`lockForSide` false) gets no
  act-for controls, only `playingNote`; the server refuses their `lock` with
  `plays_in_match`.
- **Optimistic lock-in.** `withManagerPlay` shows the act-for lock-in as "Locked In" until
  its step reveals (the returned state only marks a lock-in for the side's own captain).
  `settleManagerPlay(play, view)` drops it once its step is awaited again (an undo, by
  anyone), and any later manager command drops it too, so a step the team locks after an
  undo is never shown as the manager's. It also drops a confirmation the session no longer
  allows (so a Reopen confirmed after someone else reopened never undoes another step) and
  an open Edit final draft once Edit final no longer applies.
- **Refusals.** `managerCommandRejected` words a refusal in this order: a per-command wording
  (`hand-over`/`invalid_request`, `edit-final`/`invalid_request` followed by the server's own
  detail, `edit-final`/`version_conflict`, and `side_not_open` for `side`, `sides` and
  `side-chooser` by what it tried), then the general table, then a Start blocking reason via
  `blockingReasonLabel`, else `unwordedRejection`. A refused act-for `lock` shows in the
  act-for dock, a refused save inside the editor, everything else in the panel. Nothing
  retries by itself.
- **Sequence override.** `sequenceChoices(stages, sequence)` lists every preset, then each
  stage that has a block, keyed `preset:<id>` / `stage:<key>` so two stages with the same
  name and best-of never collide. The first of the dock sequence's `currentKeys` that is
  listed is marked `current`.

`managerDockOf(view, play)` (`null` without `affordances.manager`) builds Match Control:
status line (`phase`), primary call to action with Start's blocking reason, fix and each
team's Ready mark, Sides board, Map Veto card, Sequence card, History and Dangerous Actions
buttons, results warning, voided banner, final editor, pending confirmation, act-for and
refusal. Each button carries `label`, `hint` and `disabled` (all disabled while a command is
in flight). Read the module for wording; the non-obvious rules:

- For a manager who plays in the match the awaiting status line omits whose turn it is.
- Set sides stays visible outside its window, disabled, with a `reason`; Swap is enabled only
  once the side is confirmed. The Chooser's `undetermined` is when Start is blocked by
  `side_chooser_undetermined`.
- Undo's label follows `undoTarget`: Undo Last Step, Undo Side Choice or Undo Veto.
- `resultsWarning` shows in any status; Reopen, Restart, Cancel and Edit final stay enabled
  and the server's refusal is worded if one comes.

### Edit final

`editFinal.ts` is the editor's model. `finalDraftOf(view)` seeds a draft from `view.summary`
in play order and records `view.version` to save against; Edit final only applies once the
last spotlight is over, so every slot is revealed. The change functions (`setFinalMap`,
`setFinalSide`, `setFinalDecider`, `moveFinalEntry`, `addFinalEntry`, `removeFinalEntry`)
each return a new draft. `finalEditorOf(draft, view)` is the render model, with one worded
problem per broken rule and a request `body` only when there are none. The rules mirror the
server's: at least one map; every map chosen and in the eligible pool; no map twice; at most
one decider, and only the last; every other entry with a picked-by side. The decider goes
out with `picked_by: null`.

The editor is `outdated` once the view's `version` moves past the draft's: that replaces a
`version_conflict` refusal and holds Save until the draft is reloaded (`openFinalEditor`
again, which also drops the refusal). A successful save closes the editor.

### `useManagerDock`

`useManagerDock(view, { sendManagerCommand, sendManagerCommandAt })` wires the model the
same way `useCaptainPlay` does (latest play in a ref) and runs `settleManagerPlay` whenever
the view changes. It hands each request to the store through a per-command switch, so every
body is checked against `PickBanManagerCommandBodies` without a cast. The page passes it the
captain-played view and the session itself, which carries both senders.

## The match pick/ban page

`MatchPickBanPage` (`match-pickban`, `/events/:eventSlug/matches/:matchId`) is a lazy
detail page keyed by `entry.id`, reading `eventSlug` and `matchId` from the entry's params.
It needs no login, reads with the viewer's token when there is one, and the web build opens
it from a deep link. The Manage → Pick/Ban queue's Open Page is a `NavLink` to it.

- **States.** Skeleton while `loading && !state`. If the first load fails,
  `PickBanUnavailable` says the pick/ban isn't available (401, 403, 404) or that it is
  retrying while the store keeps polling. That card and `matchSubtitle` (`pickBanCopy.ts`)
  are shared with the stream view so the copy never drifts.
- **Polls are invisible.** New data changes the page in place; a 304 changes nothing. A
  fixed "Reconnecting…" toast shows only while `reconnecting` is set and no captain or
  act-for dock is shown; those docks carry their own reconnecting line so the toast never
  covers Lock In.
- **Fixed layout.** Nothing is ever inserted above the stage, and the stage keeps one height
  per width in every state (see the visual core below). Cancelled and voided reasons show in
  the stage's own notice; paused is an overlay over whatever the pause froze. Skipped bans
  and warnings are notes under the step track, excluded maps and their reasons are listed in
  words under it, and the side strip and both docks sit outside the stage.
- **Docks.** The captain dock (or the manager's act-for dock) sits right under the stage.
  The pool cards get `onSelect` only while that dock is `choose`. `ManagerDock` is `lazy()`
  behind `manager.dock` with a `null` fallback, so only managers fetch it, and sits below the
  step track so nothing it shows or hides moves the stage, timeline or grid.
- **Title.** `useDocumentTitle` sets `<A> vs <B> — Picks & Bans` once the payload is in.
- **Header.** Back to Event (a `NavLink` calling the `onBackToEvent` prop), then the sound
  control, the Animations toggle and Copy Link (`buildMatchLinks(...).playerLink` through
  `useCopyFeedback`). The summary's Back to Bracket is a `NavLink` to `event-detail` with
  `eventTab: 'bracket'`. The header buttons and Back to Bracket share the page's
  `HEADER_BUTTON` class (44px below `sm`, 32px from it).
- **Sides strip.** Under the banner: a player in the match sees `YoureSide` and "Join Red in
  UT for every map of this match." once the side is confirmed; everyone else sees the sides
  line in the lobby (and through the intro when the side was set before Start); the view's
  `side.notice` ("Sides changed by admin") shows here too.
- **Preferences.** Sound (`utbt:pickBanSound:v1`) and animations (`utbt:pickBanMotion:v1`)
  are account-synced keys; the page subscribes to both, so a value arriving from the sign-in
  sync updates the controls, the player and the motion at once.

## Shareable match links

`buildMatchLinks(eventSlug, matchId)` (`app/components/navigation/matchLinks.ts`) returns
absolute links: `playerLink` (the match page) and `streamLink` (the chromeless stream view,
`/events/:eventSlug/matches/:matchId/stream`). Both always use `VITE_SITE_ORIGIN` (default
`https://utbt.net`), never `window.location.origin`: the desktop build has no usable site
origin at runtime, so a copied link must point at the public site on both targets.

The stream path is not a nav view. It is mounted before the app shell, the boot auth check
and the consent banner, so it never requires a login, and it has no entry in `routes.ts` or
the route contract. `parseStreamPath(pathname)` (same file) is the check
`app/renderer-web.tsx` runs before deciding whether to mount the shell; `matchStreamPath`
builds the bare path. The mount itself and the stream URL parameters (`sound=0`, `volume=`,
`motion=0`) are in [web-target.md](../web-target.md).

## Visual core

`components/` holds the pieces a pick/ban screen is built from; the match page uses them and
the stream layout reuses `MapTile`, `StepTrack`, `Chevrons`, the `StageScenes.tsx` helpers,
`RevealEffects` and the choreography. Contracts every piece keeps:

- **View model only.** Each takes slices of `PickBanView`, never the raw payload. Who acts
  and what they do come from the view's `actorLabel` / `actionLabel`; no component rebuilds
  a team label from a name and a letter.
- **Container queries, not viewport breakpoints** (`/banner`, `/arena`, `/board`, `/tile`,
  `/slot`, the `stage` size container), so the pieces look the same in a phone column, beside
  the sidebar at 4K and on the stream's fixed stage. Tiles and slots size text in `cqw`.
- **Deterministic height.** `MapBoard` gets its column count per container width from
  `boardColumnVars(count)` (`boardColumns.ts`) as CSS variables, so a tile's size is pure CSS,
  never measured, and the board's height depends only on its width and the pool size. From
  `@3xl/board` a tile is also capped by the window height so the maps and the dock under them
  fit one screen on desktop.
- **One stage height per width.** `PickBanStage` renders each `view.scene` (intro, reveal,
  final lineup, cancelled/voided notice) as one keyed presence child in a `@container-size/stage`
  box over the board. The board fades out and is `inert` under it but keeps its space. A new
  scene mounts in the render that reached its moment (a reveal starts exactly at
  `reveal_at`); on an undo (`sceneDirection` -1) the old scene plays its entrance backwards.
  `playsEntrance` makes a scene joined mid-way appear settled instead of replaying.
- **Stable keys.** Member id, map name, plan index, map number; the two team plates sit in
  fixed left and right slots. A poll never remounts anything.
- **Typeface.** Display text is set in `font-pickban`, whose faces `PickBanStage` loads
  (`broadcastFonts.css`); tones come from `broadcastTone.ts` in the broadcast module
  ([stream-kit.md](stream-kit.md)).

| Piece | Role and gotchas |
|---|---|
| `MatchBanner` | page header: team plates in side colours around the status chip; members through `PlayerInfo` |
| `PickBanStage`, `StageCaption`, `StageScenes.tsx` | the stage, the caption line over the board, the intro/reveal/notice/paused scenes |
| `MapTile`, `MapBoard` | one square map tile (page and stream); the page pool. The page never passes an excluded map; the stream board passes team-vetoed ones |
| `StepTrack` | one slot per plan step, `size` `'page'` or `'broadcast'`; the current-step ring is a shared layout element, so it glides forward and back on an undo |
| `ExcludedMaps` | excluded maps off the board with their reasons; exports `eligibleCardsOf`, `excludedCardsOf`, `exclusionReasonsOf` |
| `CaptainDock` | captain controls under the stage, `sticky bottom-3` so it only pins on phones where the board is taller than the window; also renders act-for (`actingFor`). Its refusal alert is exported as `Rejection` for the manager dock. Match page only |
| `ManagerDock`, `EditFinalEditor` | Match Control below the step track. Every dock modal is `ui/modal` with `portal`: the dock sits inside the page's `@container`, which would otherwise trap a fixed overlay. Only one modal is ever open (the editor hides while its Save confirmation shows); a dropdown or the editor closes itself once the session stops allowing it. The Sequence dropdown loads `fetchPickBanConfig` when the lobby dock mounts. `EditFinalEditor` lays out by its own `@container/final`, so it follows the modal's width |
| `PickBanStatusChip` | a session status in `pickBanStatus.ts`'s words and colours; shared with the Manage queue so a status reads the same everywhere |
| `YoureSide` | "You’re **Red**" chip in the colour's tone; also on My Matches cards |
| `CountdownText` / `CountdownBar` | painted on animation frames from `countdown.endsAt` straight into the DOM; a frozen countdown holds at `remainingMs`; with animations off the bar steps once a second |
| `usePickBanPreload(cards, sizes?)` | fetches and decodes every non-excluded screenshot (following `MapThumbnail`'s fallback chain) and the fonts, keyed on the URL list. Call it from the lobby on so nothing pops in mid-reveal; the stream passes `['card', 'hero']` |

## Motion

- **`PickBanMotion`** wraps every root that renders the core (the page, the stream view). It
  is a `MotionConfig` with `reducedMotion="never"` and `skipAnimations={!animate}`: pick/ban
  reveals are the show, and Windows reports "reduce" whenever its Animation effects are off,
  so only the page's Animations toggle or the stream's `motion=0` turns motion off. Its
  wrapper carries `data-motion="on"` while animating, which exempts the subtree from
  `shared.css`'s reduced-motion rule. `usePickBanAnimate()` reads the value. With animations
  off every transition is instant and shows the same information.
- **Timeline-driven.** All motion follows the view model (`view.scene`, card states,
  timeline statuses), never a poll arriving, so two screens play a reveal at the same moment.
- **Beats.** `choreography(entranceMs)` (`components/stageMotion.ts`) times every beat as a
  share of the scene's `entranceMs`. The hits inside an entrance (`IMPACT`, `STAMP_HIT`,
  `DECIDER_IMPACT`, `VS_HIT`) live in `pickBanBeats.ts`, which the sound cues read too, so a
  sound's hit and the picture's can't drift apart. Shared curves and presets (`SCENE_VARIANTS`,
  `staggeredCard`, `CHIP_MOTION`, `STAMP_MOTION`, `FADE_MOTION`, `INDICATOR_TRANSITION`) are in
  the broadcast module ([stream-kit.md](stream-kit.md)).
- **Cost.** Animate `transform` and `opacity`; the only filter is the one-shot ban
  desaturate. The only loops are the turn chevrons and the decider reveal's slow ray turn.
  The general animation rules (framer-motion only from lazily loaded modules, no
  `animate-in` utilities) are in [styling.md](../styling.md).

## Sound

Five bundled cues, one pre-mixed file each: `intro` as the intro begins, `pick` for a pick
(lettered, or locked automatically as the last map standing), `ban` for a lettered ban or a
team's Hard-map veto, `ban_down` for a ban-down step, `decider` for the decider. "Hard maps
stay in" makes no sound.

- **Files.** `pickBanSounds.ts` is the one place that names them (`SOUND_URLS`,
  `app/assets/sounds/*.mp3`). `SOUND_HIT_MS` is how far into each file its hit sits; each
  equals the animation's hit at the default pacing, and a test pins that. Replacing a file:
  update `app/assets/sounds/CREDITS.md` (one source needs CC BY attribution), keep every hit
  time, and re-measure all six files (the five cues plus the stinger's `stinger-whoosh.mp3`):
  they are centred and loudness-matched at about -15.7 LUFS integrated with the sample peak at
  or below -1 dBFS. `e2e/audio-balance.broadcast.spec.ts` guards left/right balance and
  sub-bass energy, which plays as crackle on most speakers.
- **What is due.** `cuesToPlay(state, clock, played)` (`pickBanSoundCues.ts`) sounds nothing
  unless the status is `running` or `complete`. Reveal cues come from `revealedStepsAt`, the
  same reveal gate and pause-frozen clock the view model uses, keyed by plan index plus the
  step's raw `reveal_at`. The intro is keyed `intro:<started_at>` (a restart plays it again);
  a veto is keyed `veto:<resolved_at>` with its hit at the veto's `reveal_at`. A refresh,
  remount or 304 never replays a cue; an undo followed by a new lock at the same index gets a
  fresh key and sounds. When nothing is newly due it returns the same `played` set.
- **When.** The animation hits at the reveal (or intro start) plus a beat share of
  `entranceMsFor(pacing, segment)`. `soundScheduleAt(hitAt, fileHitMs, clock)` starts the file
  `fileHitMs` before that: delayed while the start is ahead, or at once at an offset into the
  file once it has passed, so the hit still lands. More than `STALE_HIT_MS` (100 ms) past the
  hit it returns `null` and the cue is marked played silently (a backgrounded tab, a late
  poll).
- **`usePickBanSound({ state, clockOffsetMs, muted, volume })`** runs a
  `requestAnimationFrame` loop only while unmuted. Its first tick only primes the played set,
  so a fresh load or an unmute never plays a backlog; muting clears the set. It returns
  `{ unlock, preview }`. Both the page and the stream view call it.
- **Player** (`pickBanSoundPlayer.ts`, Web Audio). Decodes every file up front regardless of
  mute; a cue due before its file is decoded is skipped, and so is one due while the context
  isn't running, rather than played late. One master gain at the square of the volume (so
  the slider moves evenly in loudness), ramped over 60 ms so a change never clicks. Every
  `pointerdown`, `pointerup`, `touchend` and `keydown` resumes a suspended context (a touch's
  `pointerdown` doesn't count as activation). `preview(kind)` decodes if needed, resumes
  (call it from a gesture), fades out the previous preview and plays only the latest.
  `createSoundPlayer(urls, volume)` is the generic player; the stream scene cues reuse it.
- **Preference.** `pickBanSoundPreference.ts` keeps `{ enabled, volume }` in
  `utbt:pickBanSound:v1` (account-synced), default `DEFAULT_SOUND_PREFERENCE` (off at 0.4).
  `parsePickBanSoundPreference` enables only on `enabled === true`, clamps the volume to 0..1
  and falls back to 0.4 for a non-number, ignoring any other field. The stream view takes
  sound from its URL instead ([web-target.md](../web-target.md)).
- **Control.** `PickBanSoundControl` is the page header's "Sound On/Off" button opening a
  small disclosure panel (`aria-expanded`, a labelled group, deliberately not a Radix menu
  so the slider keeps its own keys) with the Sound switch and a 0–100% Volume slider. It
  holds no sound state. Turning sound on calls `unlock()` from that click. The slider keeps a
  local draft and commits (save, then a `pick` preview while enabled) only on release:
  pointer up or cancel, key up, or blur. Escape (focus back on the button), an outside
  pointer or focus leaving closes the panel.

## Stream broadcast layout

`stream/` renders the stream view for a 1920×1080 OBS source inside `BroadcastStage`, fixed
in pixels. `StreamView` reads anonymously with `alwaysPoll: true` (see the session store's
cadence), fetches the event name once for the header (blank if that fails), preloads
`['card', 'hero']`, and has no sound control: sound and motion come from its URL
([web-target.md](../web-target.md), which also owns how the view is mounted). `StreamBroadcast` stacks
`BroadcastHeader`, `BroadcastCaption`, `BroadcastBoard`, a `StepTrack` with
`size="broadcast"`, and the moment overlays from `BroadcastMoments.tsx` and
`BroadcastEndings.tsx`.

- `broadcastMomentOf(view)` (`stream/broadcastMoment.ts`) picks the overlay: the veto reveal
  during the veto spotlight, the side choice or side reveal while step 0 runs, else by
  `stagePhase` the intro, a map reveal, the lineup, a cancelled/voided notice, or none.
- `broadcastBackdropLit(view)` picks the lit half: the team that just took its colour, the
  team that vetoed, else the acting side.
- `plateSideTagOf` gives each header plate its RED/BLUE tag once the side is confirmed and
  outside the side choice.
- `broadcastBoardOf(cards)`: maps a team vetoed stay on the board as greyed tiles stamped
  VETOED; automatic exclusions leave the board for one muted line per tag
  ("Hard maps are out: …"). `boardLayout(count, width, height, gap, maxTile)` picks the column
  count that keeps tiles largest, capped at 320px.
- Overlays are keyed by `view.scene.key` and entered with `SCENE_VARIANTS`,
  `useSceneDirection` and `playsEntrance`, the same as the page, so a source loaded mid-scene
  doesn't replay it.

Broadcast-wide styling (the broadcast module, transparent stage, screenshot conventions) is
in [stream-kit.md](stream-kit.md).

## Red/Blue sides

A match has one Red and one Blue team for the whole series; Red is side A (the crimson
`pickban-a` tone) and acts first, Blue is side B (azure `pickban-b`). The contract is in
[pick-ban-api.md](pick-ban-api.md).

- **Wording.** Player- and caster-facing text leads with Red/Blue and keeps A/B secondary:
  "Crimson Cats (Red) bans", a side card titled "Red · Side A", the reveal "T04 → RED · bans
  first", "You’re **Red**". Admin tools show both. Until the side is confirmed, show
  "Sides TBC" rather than a colour.
- **Labels.** Build them with `app/utils/sideLabels.ts`: `sideColorName`, `sideColorTag`
  (`RED`), `sideColorTitle` (`Red · Side A`), `sideLetterOf` / `sideColorOfLetter`,
  `otherSideColor`, `withSideColor(name, color)` (`T04 (Red)`, just the colour when the name
  already is one), `sideTagOf(color, confirmed)` (the tag or `SIDES_TBC`), `youreSideLabel`.
  `sideColorTone(color)` maps a colour to its `PICK_BAN_TONES` key (`a` or `b`).
- **On stream** scenes say RED and BLUE (`sideColorTag`), never "Side A"; the colour bar and
  wash already carry the side. The OBS scene pages get one tag per stream side from
  `app/components/stream/sceneSideTags.ts` (from the hot state's `side_status`, neutral
  "Sides TBC" while unconfirmed) drawn by `SceneSideTagChip`; a confirmed side adds nothing
  to the overlay name tags, an unconfirmed one adds a "Sides TBC" note. In the pick/ban
  broadcast the intro adds `side.introLine` ("Sides set by admin") when step 0 is skipped.

## Hard-map veto presentation

A team-chosen veto removes the tagged maps for both teams. It runs before the side step,
while no team has a colour, so its controls use the `PICK_BAN_TONES.gold` tone, never Red or
Blue. Words use the veto's `tag` from the data rather than a hard-coded "Hard".

- **Captain dock.** Two veto cards in a `radiogroup`, built like the side cards: "Veto Hard
  maps" (with the maps it removes) and "Play Hard maps", each with its map count. Lock In
  turns gold once a card is selected and reads "Lock In Veto" or "Lock In Play". The other
  captain, or one who has chosen, gets the usual locked row.
- **Pending.** While teams decide, each tagged tile keeps its look plus a neutral top-left
  badge from the card's `pendingLabel` ("Hard?").
- **Before the plan exists** the step track's place shows the view's `veto.poolLine`
  ("13 or 9 maps") with "The steps appear once the Hard maps are decided."
- **Vetoed.** On the page the maps leave the board into the `ExcludedMaps` row, each with a
  gold outlined "VETOED · T15" stamp. On stream they stay on the board, greyed under a
  slanted gold VETOED stamp with "By T15". When the maps stay in, the cards are plain again.
- **Stream veto moment.** `BroadcastVetoReveal` shows the tagged maps as gold-bordered cards
  that, from `reveal_at`, get stamped VETOED or badged "In play" one after another
  (`vetoRevealMotion(leadS)` in `StageScenes.tsx`), with the outcome, map count, countdown
  and what comes next. After a veto, the step-0 side choice also shows the chooser line.

## Tests

- `e2e/pickban-watch.spec.ts` serves the read from fixtures with a real-time server clock and
  pins the page's invariants: phone width in lobby, live and complete; an early lock-in
  revealed at its `reveal_at` on two screens at once; one stage height per width from 360px
  to 3840px with every state fitting; the countdown bar gliding (stepping with animations
  off); undo and pause animating (instant with animations off); polls, 304s included, never
  remounting or shifting the page.
- `e2e/pickban-captain.spec.ts`: veto, side choice and manager act-for flows, including phone
  widths.
- `e2e/pickban-stream.broadcast.spec.ts` and `e2e/pickban-veto.broadcast.spec.ts`: stream
  screenshots of the lobby, turn, step 0 and veto moments.
