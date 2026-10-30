# Pick/ban API contract

The server contract for a match's live map pick/ban and its per-stage setup: endpoints,
the state payload and its timing rules, commands and refusals, the manager queue, Red/Blue
sides and the Hard-map veto. Read it before changing anything that reads or sends pick/ban
data. The client side (session store, view model, captain and manager docks, visual core,
motion, sound, the match page and the stream view) is in [pick-ban-ui.md](pick-ban-ui.md).
The response envelope and `ApiError` are in [api.md](../api.md).

## Where the code lives

Paths below that don't start with `app/` are under `app/components/pages/events/`.

| Path | Holds |
|---|---|
| `app/utils/api.ts`, the pick/ban block after the predictions fetchers | every pick/ban fetcher and command sender, the payload types, the refusal code lists |
| `app/utils/fixtures/streamSides/`, `app/utils/fixtures/pickBanVeto/` | API payloads byte for byte, sha-pinned by their `*Fixtures.test.ts` ([Contract fixtures](#contract-fixtures)) |
| `pickban/pickBanFixtures.ts` | synthetic state builders (`pickBanState`, `started`, `locked`, `asCaptain`, …) shared by Vitest and Playwright |
| `pickban/pickBanSession.ts`, `clockOffset.ts`, `mergePickBanState.ts` | the client end of the state read: ETag polling, clock sampling, structural merge; the rest of `pickban/` is in [pick-ban-ui.md](pick-ban-ui.md) |
| `manage/pickban/` | Manage → Picks & Bans (lazy): setup editor and manager queue; pure and tested: `pickBanEditor.ts` (mirrors the server's setup rules), `pickBanQueue.ts` |
| `maps/` | the public Maps tab; `mapsShared.ts` holds `stagesWithPools` |
| `pickBanTags.ts` | tag matching shared by the pool editor and the Maps tab |
| `app/utils/sideLabels.ts`, `app/components/stream/sceneSideTags.ts` | Red/Blue words in the app and on scenes |

## Endpoints

Every path is under `/tournaments/<slug>`.

| Fetcher | Request | Caller |
|---|---|---|
| `fetchPickBanConfig` | `GET /pick-ban/config` | anyone, anonymous included, whenever the event is visible |
| `setPickBanStageConfig` | `PUT /admin/pick-ban/stages/<stageKey>/config` | managers |
| `setPickBanStagePool` | `PUT /admin/pick-ban/stages/<stageKey>/pool` with `{ pool }` | managers |
| `copyPickBanStagePool` | `POST /admin/pick-ban/stages/<stageKey>/pool/copy` with `{ from_stage_key }` | managers |
| `fetchPickBanState` | `GET /matches/<matchId>/pick-ban` | anyone who can see the match, anonymous included |
| `sendPickBanCommand` | `POST /matches/<matchId>/pick-ban/<command>` | captains and acting captains |
| `sendPickBanManagerCommand` | `POST /admin/matches/<matchId>/pick-ban/<command>` (`PUT` for `side-chooser` and `sides`) | managers (`capabilities.can_manage`) |
| `fetchPickBanQueue` | `GET /admin/pick-ban/queue` | managers |

`postPickBanCommand` is the untyped transport under both senders and picks the method.
Bodies are typed per command in `PickBanParticipantCommandBodies` and
`PickBanManagerCommandBodies`. The streamer roster and `setMatchStreamer`, which the queue
uses, are in [admin.md](admin.md).

## Stage setup

Each stage of an event's format carries an optional pick/ban block and a tagged map pool.
`fetchPickBanConfig` lists every stage in format order, stages not drawn yet included, so
they can be set up ahead of time. Without a format attached it answers `{ stages: [] }`.
Each `PickBanStageConfig` has:

- `key`, `name` and `best_of` (the stage's effective match default).
- `pick_ban`: the block, or `null`. It holds `preset_id` (`PICK_BAN_PRESET_IDS`, `null` for
  a custom sequence), `sequence` (`steps` of `{ actor: 'A' | 'B', action: 'ban' | 'pick' }`,
  `ban_down`, optional `ban_down_order`), `exclusions` (`{ tag, min_pre_cup_seed, mode? }`)
  and `pacing` in seconds.
- `counts` (`lettered_picks`, `lettered_bans`, `maps_yielded`, `full_sequence_minimum`,
  `absolute_minimum`) and `sequence_mismatch` (`maps_yielded !== best_of`). Without a block
  they are `null` and `false`.
- `pool`: `{ map, tags, screenshot_version }` in saved order. `screenshot_version` is the
  map's `screenshot_updated`; pass it to `MapThumbnail`'s `version` prop.
- `pool_status`: `{ normal, exempt }`, each `{ size, status }` with status `full_sequence`,
  `bans_dropped` or `too_small`. `exempt` is the pool minus every map carrying an exclusion
  tag, and `null` without exclusion rules. With a `choice` rule the two are the veto's
  outcomes: `normal` if the tagged maps are played, `exempt` if they are vetoed.

**Counts.** Maps yielded = lettered picks, plus 1 with a ban-down. The full-sequence minimum
adds the lettered bans. The absolute minimum drops every ban, so it equals maps yielded. The
pool status is `full_sequence` at or above the full minimum, `bans_dropped` down to the
absolute minimum, and `too_small` below it.

**Ban-down order.** Ban-down step *k* is taken by `ban_down_order[k % length]`. Without
`ban_down_order` the ban-down alternates. The key is sent only when a sequence sets it.

**Exclusion modes.** `mode` is `auto` or `choice` (`PICK_BAN_EXCLUSION_MODES`). A rule
without `mode` is `auto`, so send `mode` only for `choice`. A `choice` rule is the
[Hard-map veto](#hard-map-veto). A stage has at most one.

**Pacing.** A block's pacing has `intro`, `spotlight`, `ban_down_spotlight` and
`decider_spotlight`, each a whole number of seconds from 0 to 60. The API also sends
`side_spotlight` and `veto_spotlight` (`PickBanContractPacing`).

**Writes.**

- `setPickBanStageConfig` replaces one stage's block. Its input is
  `{ preset_id, exclusions?, pacing? }` or `{ sequence, exclusions?, pacing? }`, never both.
  Choosing a preset copies its steps into the block, so a later change to the shipped
  presets never reshapes a configured stage.
- `setPickBanStagePool` replaces the stage's whole pool (`[{ map, tags }]`, array order).
  It is idempotent.
- `copyPickBanStagePool` copies another stage's saved pool, tags included. It writes at
  once.

**Errors.** A rejected block answers 422 with `field.path: reason` entries joined by `; `.
Paths are relative to the block (`preset_id`, `sequence`, `sequence.ban_down_order`,
`pacing.intro`, `exclusions[0].tag`, `exclusions[0].mode`), or prefixed
`stages[<index>].pick_ban.` when the whole-format validation rejected it. A rejected pool
is one sentence: `Map '<name>' …`, a `pool[<n>]` path, or a bare tag reason.

### The setup editor

Manage → Pick/Ban (`manage/pickban/`) edits both halves, one card per stage.
`pickBanEditor.ts` mirrors the server's rules so problems show while typing.

- `PICK_BAN_PRESET_SEQUENCES` and `sequenceCounts` must match the API. A unit test pins every
  preset's counts to the API's numbers, so change both together.
- Tags are trimmed, non-empty, at most 32 characters and matched case-insensitively. "Hard"
  is just a tag. The match is `tagKey` / `sameTag` in `pickBanTags.ts`, kept outside the lazy
  editor so the Maps tab can share it.
- An exclusion threshold is a whole number of at least 1. Pacing keys without an input
  (`side_spotlight`, `veto_spotlight`) are sent back as loaded.
- `configInput` sends `preset_id` only while the draft's steps equal the shipped preset's.
  Otherwise it sends the steps as `sequence`, so saving pacing or exclusions never swaps in
  a preset that changed after the stage copied it. `presetDrifted` flags that case, and
  editing a preset's ban-down order makes the draft custom (`withBanDownOrder`).
- The draft holds a veto rule as `veto: true`, and `configInput` adds `mode: 'choice'` only
  for it. `canMakeVetoRule` / `withVetoRule` keep it to one rule, and `validateConfigDraft`
  flags a second at `exclusions[n].mode`. `ban_down_order` is sent only while `ban_down` is
  on and the order isn't empty.
- Warnings (pool too small or dropping bans, for normal and exempt matches, and a sequence
  whose map count differs from the best-of) come from the draft while the stage has
  unsaved edits and from `pool_status` / `sequence_mismatch` otherwise. A test asserts both
  paths agree, so saving never changes what the card says.
- `configErrors` strips this stage's prefix and places each 422 entry next to its field;
  anything it can't place becomes the card's error. `poolError` pins a map-named or
  `pool[<n>]` error to that row.
- Unsaved edits live in `EventDetailPage` as `pickBanDrafts` (keyed by stage key) behind
  `useUnsavedChanges`. A stage has a draft only while it differs from its saved state
  (`settledDraft`), and drafts for stages the format no longer has are pruned on load.
  Saving sends the block and the pool separately, only the half that changed; a failed half
  stays unsaved.
- A full-format save sends every stage's block back, so a stale Format draft would revert
  the setup. After a block save the panel re-fetches the config, writes the new block into
  an open Format draft (`withStagePickBan`) and refreshes the bracket. Every save or copy
  hands the new config up (`onPickBanConfigChange`), so the Maps tab appears without a
  reload.

The Manage panel's sub-tabs are the `MANAGE_TABS` registry in `ManagePanel.tsx`. The
Pick/Ban panel is lazy, and the match queue sits under its stage cards.

## Public Maps tab

`EventDetailPage` fetches the config once in the background, never blocking its `loading`
state. A failed fetch leaves it `null`, which hides the tab rather than showing a broken
one. `stagesWithPools` (`maps/mapsShared.ts`) drops every stage with an empty pool and keeps
the API's stage and pool order; it decides both the tab's visibility and its content.
`MapsTab` renders each stage's maps with `MapThumbnail`, `MapNavLink` and one badge per tag,
and `tagBadgeVariant` gives a tag spelled `Hard` (any case) the warning variant.

## State read

`fetchPickBanState(token?, slug, matchId, { etag, signal })` returns a `PickBanStateRead`:
`{ kind: 'fresh', state, etag, serverNow }` on a 200, `{ kind: 'unchanged', serverNow }` on
a 304.

- **Per viewer.** `viewer` and `capabilities` depend on the token. Every key is present, and
  every timestamp is ISO with an explicit offset.
- **Which session.** The match's current session, else its latest cancelled or voided one,
  else `status: 'none'`, a preview of what Open would create. The queue's `session_status`
  follows the same rule.
- **Not readable.** 401, 403 or 404 means this viewer can't read it now. It can become
  readable later (a stream source added before the lobby opens sees 404 until Open), so
  keep polling.
- **ETag.** Send the last `ETag` back verbatim as `If-None-Match`. A 304 means nothing
  changed: keep the previous state object, same identity. `server_now` is left out of the
  ETag, so an idle session answers 304.
- **Server clock.** Every response carries `X-Server-Now` (ISO UTC). Sample the clock from
  the body's `server_now` on a 200 and from that header on a 304, and skip a missing sample.
  `pickban/clockOffset.ts` turns a sample into `serverNow − midpoint(sent, received)` and
  keeps the median of the last `CLOCK_SAMPLE_WINDOW` samples, so one slow response can't
  move it. Compare server timestamps only against `Date.now()` plus that offset.
- **Cross-origin.** The web build reads both headers because the API lists them in
  `Access-Control-Expose-Headers`. Without that every poll is a full 200 and a 304 skips its
  clock sample, and the client still works.
- **Version.** `version` rises with every command on a session, a hover included. A poll
  that answers an older `version` of the same session `id` than a command response already
  applied is stale.
- **Typing.** `PickBanState` types `phase` as `PickBanPhase` and `pacing` as
  `PickBanPacing`, and keeps the veto keys optional (`veto`, `capabilities.can_veto`,
  `side.chooser_basis`, `pool[].pending_choice`, `exclusion.vetoed_by`, `mode`). The wire
  sends them all. `PickBanViewState` (`pickban/pickBanView.ts`) widens `phase` to
  `PickBanContractPhase`, and the [fixture types](#contract-fixtures) require the full shape.

## Timeline

`phase` is the server's phase at read time. Between polls the client re-derives it from the
absolute timestamps (`pickban/pickBanView.ts`), so a reveal or phase change lands on its
timestamp, not on the next poll.

The order is `lobby`, `intro`, `veto_choice`, `veto_spotlight`, `side_choice`,
`side_spotlight`, then each plan step's `awaiting` and `spotlight`, then `complete`. The
veto and side phases run only when they apply (`PICK_BAN_VETO_PHASES` and
`PICK_BAN_SIDE_PHASES`; `PickBanContractPhase` is the full union). Every window includes its start
and excludes its end.

- **Reveal lead.** A lock-in is recorded at the step's `at` and revealed at its `reveal_at`,
  1.5 s later. Never show a step before its `reveal_at`, so every screen reveals at the same
  moment. A step is executed once its `map` is set. The intro likewise starts 1.5 s after
  Start and runs from `intro_ends_at − pacing.intro` to `intro_ends_at`.
- **Spotlights.** A revealed step's spotlight lasts `pacing.spotlight` for a lettered step,
  `ban_down_spotlight` for the ban-down and `decider_spotlight` for the decider, by
  `segment`. `spotlight_ends_at` belongs to the last executed step and stays set after it
  has passed.
- **Veto.** `veto_choice` opens when the intro ends, while `veto.active` and `veto.outcome`
  is `null`. It has no timer. `veto_spotlight` runs from `veto.resolved_at` to
  `phase_ends_at` while the server's phase is `veto_spotlight`, else to `veto.reveal_at +
  pacing.veto_spotlight`. The outcome reveals at `reveal_at`, 1.5 s after `resolved_at`.
- **Step 0.** `side_choice` opens when the intro (or the veto spotlight) ends, while
  `side.red` is `null` and `side.chooser` is known. It has no timer. `side_spotlight` runs
  from `side.set_at` to `phase_ends_at`, only while the server's phase is `side_spotlight`
  and `side.source` is `step0`. Lettered step 1 opens when it ends.
- **Status versus phase.** `status` turns `complete` the moment the last step is recorded,
  but the phase stays `spotlight` until the last spotlight ends. Show the final summary on
  the derived phase `complete`, never on `status`.
- **Paused.** While `paused`, every timer and pending reveal freezes at `paused_at`. On
  resume, the server shifts the pending timestamps by the pause length.
- **Automatic steps.** The server locks a step by itself when it is the decider, or when only
  one eligible map is left for it (an exact-fit plan's last lettered pick or ban). Such a step
  is always the last plan step, so it completes the session. It is recorded in the same
  command as the last human step and revealed when that step's spotlight ends. A plan that is
  only an automatic step records it at Start and reveals it as the intro ends. `automatic`
  is `true` only for an executed step with `acted_by: null`. An automatic lettered step keeps
  its `actor` and `side`, with `acted_by_admin: false`, and is never the viewer's own step.

## Payload

- **Members.** Each `teams.<side>.members[]` entry carries the member's selected `title`
  (`RawActiveTitle` or `null`); render it through `PlayerInfo` with `toActiveTitle`.
- **Pool cards** carry `excluded` and `exclusion`: the rule plus `triggered_by`
  (`{ side, team_id, pre_cup_seed }[]`) and `vetoed_by`, the side that vetoed (`null` for
  `auto`).
- **Skipped bans.** When the eligible pool is too small for the full sequence, the plan drops
  lettered bans. `dropped_bans` counts them, and `skipped_bans` lists them in sequence order
  as `{ actor, before_index }`, where `before_index` is the `plan[].index` the dropped ban
  would have preceded. Read them from the payload; never re-derive them from
  `sequence.steps`.
- **Results.** `results_present` is `true` whenever the match has results entered, in every
  status. While it holds, Start, Restart, Reopen, Edit final and a Cancel that would clear
  written map slots are refused with `results_present` (409).
- **Final maps.** `final_maps` is `null` unless the session is `complete`. Then it is the
  play-order list of `{ map_number, map, side, decider }` that is played: the
  manager-edited list when `edited` is `true`, else the maps as the steps decided them.
  `side` is `null` for the decider. After an Edit final, `plan` still shows what was locked
  in; only `final_maps` carries the corrected list.
- **Start readiness.** In the lobby, `blocking_reason` (all of them in `blocking_reasons`) is
  why Start would be refused right now: one of the seven `PickBanBlockingReason` codes.
- **Sequence origin.** `sequence` adds `preset_id` and `from_stage_key`, where the session's
  sequence was copied from.

## Capabilities

Gate controls on `capabilities`, never on `viewer.roster_captain`.

| Key | Set for |
|---|---|
| `can_manage` | a manager |
| `acting_side` | the side the viewer acts for as captain or acting captain; `null` for a captain replaced by an acting captain |
| `can_ready` | the viewer who may toggle Ready in the lobby |
| `can_lock_now` | the viewer who may lock now. Trust it only for a payload read while `awaiting`; otherwise re-derive it when the intro or a spotlight ends, so a captain can act without waiting for a poll |
| `can_choose_side` | the chooser team's captain or acting captain while `side_choice` is open |
| `can_veto` | an eligible team's captain or acting captain while `veto_choice` is open |

`viewer.side` is set for a player in the match. A manager with `viewer.side` set plays in
the match and never acts for a team: the server refuses their act-for `lock` and `veto`
with `plays_in_match` (403).

## Red/Blue sides

The vocabulary in `api.ts`: `SideColor` (`SIDE_COLORS`), `MatchSideSource`
(`MATCH_SIDE_SOURCES`: `step0`, `admin`, `caster`, `backfill`) and `MatchSideStatus`
`{ confirmed, source }`. Red is letter A and acts first; Blue is B.

`PickBanState.side` is a `PickBanSideBlock`:

- `red`: `team_a`, `team_b` or `null` while unset. `a_side` names the team that is A; while
  it is unset, A is `team_a`.
- `source`, `confirmed`, `set_at`, and `changed_mid_veto` (an admin changed the sides
  mid-session; the remaining steps follow the new colours).
- `chooser`: the side that picks its colour in step 0. `chooser_reason` is one of
  `PICK_BAN_CONTRACT_CHOOSER_REASONS` (`direct_qualifier`, `lower_playoff_record`,
  `lower_group_placing`, `lower_pre_cup_seed`, `admin`; `PICK_BAN_CHOOSER_REASONS` is the
  same list). `chooser_basis` (`{ chooser, other }`) gives the numbers behind the reason,
  the chooser first: group finishing positions, pre-cup seeds, or `{ wins, losses }`
  playoff records. It is `null` for `direct_qualifier` and `admin`.
  `pickban/chooserReasonCopy.ts` words a reason with its numbers.
- `cards`: Red then Blue, each `{ color, letter, steps: [{ n, action, segment }] }`. Empty
  while the match has no plan.

Step 0 runs only while the side is unset and a chooser is known. A side an admin sets in
the lobby skips step 0. Start is blocked by `side_chooser_undetermined` while no chooser is
known.

## Hard-map veto

A `choice` exclusion rule lets each eligible team keep or remove the tagged maps before
step 0. `PickBanState.veto` is a `PickBanVeto`, or `null` when the stage has no `choice`
rule:

- `active`: a choice rule exists and at least one side is eligible. With nobody eligible
  the outcome is `played` from Start, with no veto phase and no spotlight.
- `tag`, `min_pre_cup_seed`, `maps` (the pool maps carrying the tag) and `eligible` (sides).
- `choices`: per eligible side, `veto` or `play` (`VetoChoice`), `null` before it chooses.
- `outcome` (`vetoed` or `played`, `null` while unresolved) and `vetoed_by`.
- `pool_sizes` `{ vetoed, played }`, `resolved_at` and `reveal_at`.

Each eligible team chooses once. The first `veto` removes the maps for both teams; the maps
stay in only once every eligible team chose `play`. While the veto is unresolved, `plan`
and `side.cards` are empty and every pool card carrying the tag has `pending_choice: true`.
The plan appears when it resolves, sized by the outcome. A vetoed map becomes an exclusion
with `mode: 'choice'` and `vetoed_by`.

## Commands

Every command answers the full new state for the caller, so the actor never waits for a
poll. Every body except `open`'s carries the expected `version`, and a stale one answers
`version_conflict`. Send the latest version, since captain hovers bump it constantly while a
session runs. Pin the version the manager saw only where acting on a changed session would
be wrong: Reopen and Edit final. The session store sends one command at a time and fills in
the version ([pick-ban-ui.md](pick-ban-ui.md)).

**Participant commands** (captain or acting captain):

| Command | Body | Accepted when |
|---|---|---|
| `ready` / `unready` | `{ version }` | lobby |
| `hover` | `{ map, version }`, `map: null` clears | the side's step is awaited |
| `lock` | `{ map, plan_index, version }` | the side's step is awaited; `plan_index` is that step |
| `side` | `{ choice: 'red' \| 'blue', version }` | `side_choice`, chooser team; the colour holds for the whole match |
| `veto` | `{ choice: 'veto' \| 'play', version }` | `veto_choice`, an eligible team that hasn't chosen |

**Manager commands.** The windows are what `affordances.manager` in
`pickban/pickBanView.ts` mirrors.

| Command | Body | Accepted when |
|---|---|---|
| `open` | none | status `none`, `cancelled` or `voided` |
| `start` | `{ version }` | lobby, with no blocking reason |
| `pause` / `resume` | `{ version }` | running / paused |
| `undo` | `{ version }` | running or paused. Takes back the last human step; with none but a resolved veto, the step-0 side choice if step 0 set the side, else the veto outcome |
| `undo` (Reopen) | `{ version }`, pinned | complete, with a human step in the plan |
| `restart` | `{ version }` | running, paused or complete |
| `cancel` | `{ version }` | lobby, running, paused or complete |
| `side-chooser` (`PUT`) | `{ side, version }` | lobby, unless an admin set the side |
| `sides` (`PUT`) | `{ red, version }` | lobby, or running before the first step |
| `swap` | `{ version }` | the `sides` window, once the side is confirmed |
| `side` | `{ choice, version }` | running in `side_choice`; acts for the chooser team |
| `veto` | `{ side, choice, version }` | running in `veto_choice`; acts for an eligible team that hasn't chosen |
| `lock` | `{ side, map, plan_index, version }` | running with a step awaited; acts for that side |
| `hand-over` | `{ side, user_id, version }` | lobby, running or paused |
| `override-sequence` | `{ preset_id, version }` or `{ from_stage_key, version }` | lobby |
| `edit-final` | `{ maps, version }`, pinned | complete, after the last spotlight |

**Hover** is the selection preview: the map the side has selected but not locked in. It is
refused with the same codes as `lock`, and each user may send only a few a second (a 429
past that). Lock, Pause, Undo, Swap, a hand-over of that side, Restart and Cancel clear it.
Every viewer reads it as `selection_preview` (`{ side, map, at }` or `null`). A manager never
sends `hover`.

**Hand-over** gives a side's controls to `user_id`, an active roster member of that side's
team (`invalid_request` otherwise), or back to the captain with `user_id: null`.

**Reopen** is `undo` sent while the session is `complete`. It removes the last human step,
plus the automatic step after it, and returns the session to `running`, awaiting that step.
The map slots the session wrote go back to what they held before, and an edited final list
is discarded (`edited` back to `false`, `final_maps` to `null`). It is refused with
`results_present` while results exist, then with `nothing_to_undo` (409) when no human step
was ever made.

**Edit final** takes the whole final list in play order, each entry a
`PickBanEditFinalEntry` `{ map, picked_by, decider }`. Outside `complete` it is refused with
`wrong_status`, and while results exist with `results_present` (409). It is refused with
`invalid_request` (422) unless every rule holds:

- the list isn't empty
- every map is a non-excluded card of `pool`, matched exactly (case-sensitive), and none
  repeats
- at most one entry is the decider, and it is the last
- the decider has `picked_by: null`, and every other entry has `team_a` or `team_b`

The length isn't tied to the best-of, and a decider isn't required. Each 422's message names
the field and the broken rule. The answer has `edited: true`, and `plan` stays as played.
`pickban/editFinal.ts` checks the same rules before Save is enabled.

## Refusals

A refusal is an `ApiError` whose `.reason` is a stable code: 403 for authorization, 409 for
a state conflict, 422 for validation. `pickBanErrorCode(err)` narrows it to
`PickBanErrorCode`. `PICK_BAN_ERROR_CODES` lists every code, including
`PICK_BAN_SIDE_ERROR_CODES` and `PICK_BAN_VETO_ERROR_CODES`. Show `err.message` and branch on
the code only where a screen reacts to a specific one. The worded messages live in
`pickban/captainPlay.ts` (captain Ready and Lock), `pickban/captainVeto.ts`
(`vetoRejection`), `pickban/managerDock.ts`, and `blockingReasonLabel` in
`pickban/pickBanStatus.ts` for Start's blocking reasons; each falls back to `err.message`.

Codes whose meaning isn't in the name:

- `session_exists`: Open while a session is already open. `match_live`: Open on a live
  match.
- `no_session`: no current session. `wrong_status`: the command doesn't apply in the
  session's status (as a blocking reason, a current session that isn't in the lobby).
- `intro_active`, `spotlight_active`, `side_choice_active`, `veto_choice_active`: a lettered
  lock during that phase. A lock during `veto_spotlight` is `spotlight_active`.
- `side_not_open`: `side` outside `side_choice` (the veto phases included), and `sides` or
  `side-chooser` outside their windows.
- `veto_not_open`: `veto` outside `veto_choice`. `already_chosen`: a side that already chose.
- `plays_in_match`: an act-for from a manager who plays in the match.
- `side_locked` (`MATCH_EDITOR_SIDE_ERROR_CODES`, 409, not in `PICK_BAN_ERROR_CODES`): the
  match editor changed or cleared the Red side while the match's session is running or
  paused.

## Manager queue

`fetchPickBanQueue(token, slug)` unwraps `{ matches }`, and a response without `matches`
reads as `[]`. Each `PickBanQueueEntry` is one match of the event, sorted by
`scheduled_at` with unscheduled matches last:

- `match_id`, `stage_key` / `stage_name`, `round_no` / `round_label`, `scheduled_at`
  (`null` when unscheduled), and `teams.team_a` / `team_b` (`{ id, name }`, or `null` for an
  undecided side).
- `session_status`: the same session rule as the state read, so the queue and a match's own
  page never disagree.
- `ready_count` (sides marked Ready) and `online_count` (roster members online), both read
  off that session.
- `startable` and `blocking_reason` (`PickBanErrorCode | null`): whether Open then Start
  would succeed now, from Start's own checks plus `no_session` and `wrong_status`. It is
  informational and gates none of the row's actions.
- `streamer` (`EventStreamer | null`); a missing key reads as no streamer.

The queue carries no match `status`, so never assume a started pick/ban's match is still
`scheduled`.

The client (`manage/pickban/`): `pickBanQueue.ts` is the pure row model. `toQueueRow` falls
back to `Round <n>` and `TBD`, and takes `playerLink` / `streamLink` from `buildMatchLinks`
(the public site origin on both targets). `canOpenLobby` mirrors the manager `open`
window. `withQueueStreamer` writes a saved assignment into the loaded entries, and
`streamerChoices` keeps a current streamer who left the roster. `PickBanQueuePanel.tsx` is a
responsive `DataTable` polling every 20 s through `createPoller`, plus `poller.refresh()`
right after Open so the row picks up its new session at once. Its streamer picker
(`manage/StaffPicker.tsx`, shared with Manage → Matches) re-fetches the roster each time it
opens and applies `setMatchStreamer`'s answer without a refetch. A 422 `invalid_request`
(a user not on the roster) shows in its own banner, so the next poll doesn't clear it.

## Red/Blue outside the session

- **Matches.** `MyMatchEntry.side_color` is the viewer's colour once the side is confirmed,
  else `null` (also for non-players). `EventMatch` carries `red_team_id` and
  `red_side_source`. `EventMatchInput.red_team_id` (uuid or `null`) sets or clears the side
  in the same PATCH as the bracket slots, and leaving it out leaves the side alone;
  `manage/matchEditorForm.ts` sends it only when the Red select changed.
- **Stream reads.** The hot state's and the desk's `match` carry `side_status`
  (`MatchSideStatus`) next to `sides`. The desk's `match` also carries `side_controls`
  (`StreamSideControls`: `can_swap`, `blocked_reason` `'pick_ban_in_progress' | null`); a
  `false` `can_swap` hides the control. The preview read has no side status, so take it
  from the hot state's `match`. The Cams switch,
  `PUT /tournaments/<slug>/stream/matches/<matchId>/sides`, takes `MatchSidesBody`
  `{ red_team_id }` and answers `MatchSides`
  `{ red_team_id, blue_team_id, a_match_side, confirmed, source }`. Its refusals are
  `MATCH_SIDES_ERROR_CODES` (`not_authorized`, `pick_ban_in_progress`, `invalid_side`).
  Scenes label sides through `app/components/stream/sceneSideTags.ts`; the rest of the
  stream kit is in [stream-kit.md](stream-kit.md).
- **Labels.** Red/Blue words come from `app/utils/sideLabels.ts`; the wording rules are in
  [pick-ban-ui.md](pick-ban-ui.md).

## Projected predictor standings

Prediction leaderboard rows carry `pending` and `pending_count`, and the leaderboard says
`projected`. The stream feed's `top_predictors` rows carry `pending`. The Predictor
Standings read (`app/components/stream/scenes/standings/predictorStandingsRead.ts`,
`predictorStandingsReadPath(slug, matchId)`, `matchId` `null` for the match-less read)
answers `PredictorStandings` `{ server_now, any_pending, focus_market, total, items }`,
every bettor. Each `PredictorStandingsRow` has `movement` (the rank change from this match's
result, `null` when it isn't official or for a newcomer) and `new`. Predictions themselves
are in [events.md](events.md).

## Contract fixtures

Two fixture sets hold payloads byte-identical to what the API sends, pinned by sha256 in
their tests. A contract change edits the files and their pins together with the API.

- `app/utils/fixtures/streamSides/`: the Red/Blue and standings payloads (pick/ban lobby,
  undetermined chooser, admin-set, side choice and side spotlight with `veto: null`; stream
  state, desk, sides PUT, my matches, admin match, leaderboard, predictor standings, betting;
  and the refusals). Load them through `streamSidesFixture`, `streamSidesErrorFixture` or
  `streamSidesFixtureResponse` (`streamSidesFixtures.ts`).
- `app/utils/fixtures/pickBanVeto/`: the veto payloads (lobby, veto choice, both spotlights,
  the side step after a veto, no eligible team, a direct qualifier, the stage config, and
  the refusals `veto_not_open`, `already_chosen`, `veto_choice_active` and `side_locked`).
  Load them through `pickBanVetoFixture`, `pickBanVetoErrorFixture` or
  `pickBanVetoFixtureResponse` (`pickBanVetoFixtures.ts`).

Their types (`ContractPickBanState`, `ContractVetoPickBanState`, `ContractPickBanConfig`)
require the full wire shape that `PickBanState` keeps optional or narrower.
