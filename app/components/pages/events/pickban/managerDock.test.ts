import { describe, expect, it } from 'vitest'
import { ApiError, PICK_BAN_ERROR_CODES, type PickBanStageConfig, type PickBanState } from '@/app/utils/api'
import { buildPickBanView, type PickBanView } from './pickBanView'
import { moveFinalEntry } from './editFinal'
import {
    IDLE_MANAGER_PLAY,
    beginActForLock,
    beginManagerCommand,
    changeFinalEditor,
    closeFinalEditor,
    confirmManagerCommand,
    dismissManagerConfirm,
    dismissManagerRejection,
    managerCommandRejected,
    managerCommandSucceeded,
    managerDockOf,
    openFinalEditor,
    selectActForMap,
    sequenceChoices,
    settleManagerPlay,
    withManagerPlay,
    type ManagerDock,
    type ManagerRequest,
} from './managerDock'
import {
    ELIGIBLE_MAPS,
    INTRO_MS,
    LEAD_MS,
    SPOTLIGHT_MS,
    T0,
    asActingCaptain,
    asCaptain,
    asManager,
    asSpectator,
    asTeammate,
    finalMapOf,
    iso,
    locked,
    lockedInTurn,
    paused,
    pickBanState,
    readAt,
    started,
    undone,
    unlockAt,
} from './pickBanFixtures'

const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT, GOLF] = ELIGIBLE_MAPS
const INTRO_END = T0 + LEAD_MS + INTRO_MS
const AWAITING_A = INTRO_END + 1_000

function viewAt(state: PickBanState, serverTime: number): PickBanView {
    return buildPickBanView(state, { clockOffsetMs: 0, now: serverTime })
}

function completedRun(): PickBanState {
    return lockedInTurn(started(), ELIGIBLE_MAPS.slice(0, 6))
}

function stageConfig(key: string, name: string, bestOf: number, configured: boolean): PickBanStageConfig {
    const { sequence, pacing } = pickBanState()
    return {
        key,
        name,
        best_of: bestOf,
        pick_ban: configured ? { preset_id: null, sequence: sequence!, exclusions: [], pacing } : null,
        counts: null,
        sequence_mismatch: false,
        pool: [],
        pool_status: null,
    }
}

function commandsOf(dock: ManagerDock | null | undefined): string[] | undefined {
    return dock ? [dock.primary, dock.sides?.swap, ...dock.history, ...dock.danger].flatMap((button) => (button ? [button.command] : [])) : undefined
}

function undeterminedLobby(): PickBanState {
    const { team_a, team_b } = pickBanState().teams
    return pickBanState({
        a_side: null,
        teams: { team_a: { ...team_a!, ab: null }, team_b: { ...team_b!, ab: null } },
        blocking_reason: 'a_undetermined',
        blocking_reasons: ['a_undetermined'],
    })
}

describe('who gets the dock', () => {
    it('is absent for captains, teammates and spectators, in the lobby and mid-run', () => {
        const lobby = pickBanState()
        const running = readAt(started(), AWAITING_A)

        for (const state of [lobby, running]) {
            expect(managerDockOf(viewAt(asCaptain(state, 'team_a'), AWAITING_A), IDLE_MANAGER_PLAY)).toBeNull()
            expect(managerDockOf(viewAt(asTeammate(state, 'team_b'), AWAITING_A), IDLE_MANAGER_PLAY)).toBeNull()
            expect(managerDockOf(viewAt(asSpectator(state), AWAITING_A), IDLE_MANAGER_PLAY)).toBeNull()
            expect(managerDockOf(viewAt(asManager(state), AWAITING_A), IDLE_MANAGER_PLAY)).not.toBeNull()
        }
    })
})

describe('running a whole session', () => {
    it('opens, chooses A, starts and acts for both sides until the pick/ban is complete', () => {
        let play = IDLE_MANAGER_PLAY
        const send = (state: PickBanState, serverTime: number, request: ManagerRequest) => {
            const submission = beginManagerCommand(play, viewAt(asManager(state), serverTime), request)
            expect(submission?.request).toEqual(request)
            play = managerCommandSucceeded(submission!.play)
        }

        send(pickBanState({ id: null, status: 'none', phase: null }), T0 - 600_000, { command: 'open' })

        const lobby = undeterminedLobby()
        expect(managerDockOf(viewAt(asManager(lobby), T0 - 300_000), play)?.primary?.blocked?.reason).toBe('Team A undetermined')
        send(lobby, T0 - 300_000, { command: 'choose-a', body: { side: 'team_a' } })

        send(pickBanState(), T0 - 1_000, { command: 'start' })

        let state = started()
        const actors: string[] = []
        const locks: ManagerRequest[] = []
        for (const map of ELIGIBLE_MAPS.slice(0, 6)) {
            const at = unlockAt(state) + 1_000
            const view = viewAt(asManager(readAt(state, at)), at)
            actors.push(managerDockOf(view, play)!.actFor!.teamName)

            const submission = beginActForLock(selectActForMap(play, view, map), view)!
            locks.push(submission.request!)
            play = managerCommandSucceeded(submission.play)
            state = locked(state, map, at + 100, { byAdmin: true })
        }

        expect(actors).toEqual(['Crimson Cats', 'Azure Owls', 'Azure Owls', 'Crimson Cats', 'Azure Owls', 'Crimson Cats'])
        expect(locks).toEqual([
            { command: 'lock', body: { side: 'team_a', map: ALPHA, plan_index: 0 } },
            { command: 'lock', body: { side: 'team_b', map: BRAVO, plan_index: 1 } },
            { command: 'lock', body: { side: 'team_b', map: CHARLIE, plan_index: 2 } },
            { command: 'lock', body: { side: 'team_a', map: DELTA, plan_index: 3 } },
            { command: 'lock', body: { side: 'team_b', map: ECHO, plan_index: 4 } },
            { command: 'lock', body: { side: 'team_a', map: FOXTROT, plan_index: 5 } },
        ])
        expect(state.status).toBe('complete')
        const done = viewAt(asManager(state), T0 + 3_600_000)
        expect(done.summary.map((entry) => entry.map)).toEqual([CHARLIE, DELTA, GOLF])
        expect(managerDockOf(done, play)).toMatchObject({
            actFor: null,
            primary: null,
            history: [{ command: 'reopen' }, { command: 'edit-final' }],
            danger: [{ command: 'restart' }, { command: 'cancel' }],
        })
    })
})

describe('opening a lobby', () => {
    it('offers only Open while the match has no session, sends it without a body and holds every button while it runs', () => {
        const view = viewAt(asManager(pickBanState({ id: null, status: 'none', phase: null })), T0)

        expect(managerDockOf(view, IDLE_MANAGER_PLAY)).toMatchObject({
            status: 'none',
            phase: null,
            primary: {
                command: 'open',
                label: 'Open Lobby',
                hint: 'Opens the lobby, so both captains can gather and ready up.',
                disabled: false,
                blocked: null,
                readiness: null,
            },
            done: null,
            sides: null,
            sequence: null,
            history: [],
            danger: [],
        })

        const submission = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'open' })
        expect(submission?.request).toEqual({ command: 'open' })
        expect(managerDockOf(view, submission!.play)).toMatchObject({ busy: true, submitting: 'open', primary: { command: 'open', disabled: true } })
        expect(beginManagerCommand(submission!.play, view, { command: 'open' })).toBeNull()
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'start' })).toBeNull()

        expect(managerDockOf(view, managerCommandSucceeded(submission!.play))).toMatchObject({ busy: false })
    })
})

describe('starting', () => {
    it('keeps Start disabled with the specific blocking reason in words, and refuses to send it', () => {
        const blocked = (reason: PickBanState['blocking_reason']) =>
            viewAt(asManager(pickBanState({ blocking_reason: reason, blocking_reasons: reason ? [reason] : [] })), T0)

        const tooSmall = blocked('pool_too_small')
        expect(managerDockOf(tooSmall, IDLE_MANAGER_PLAY)).toMatchObject({
            primary: {
                command: 'start',
                label: 'Start',
                disabled: true,
                blocked: {
                    reason: 'Map pool is too small',
                    fix: 'Add maps to the stage’s pool in Manage, or choose a shorter sequence under Sequence.',
                },
            },
            sides: { swap: { command: 'swap', disabled: false } },
            history: [],
            danger: [{ command: 'cancel', disabled: false }],
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, tooSmall, { command: 'start' })).toBeNull()

        const blockedBy = (reason: PickBanState['blocking_reason']) => managerDockOf(blocked(reason), IDLE_MANAGER_PLAY)?.primary?.blocked
        expect(blockedBy('a_undetermined')).toEqual({
            reason: 'Team A undetermined',
            fix: 'The stage seeds are missing or tied, so choose who is Team A under Sides.',
        })
        expect(blockedBy('pre_cup_seed_missing')).toMatchObject({ reason: 'A team is missing its pre-cup seed' })
        expect(blockedBy('sequence_mismatch')).toEqual({
            reason: 'Sequence does not match the best-of',
            fix: 'Choose a sequence that fits the match’s best-of under Sequence.',
        })
        expect(blockedBy('match_finished')).toEqual({ reason: 'Match already finished', fix: null })

        const ready = blocked(null)
        expect(managerDockOf(ready, IDLE_MANAGER_PLAY)).toMatchObject({
            primary: { command: 'start', disabled: false, blocked: null },
            sides: { swap: { command: 'swap' } },
            danger: [{ command: 'cancel' }],
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, ready, { command: 'start' })?.request).toEqual({ command: 'start' })
    })

    it('shows each team’s Ready mark beside Start, A first', () => {
        const readyAt = iso(T0 - 30_000)
        const oneReady = pickBanState({ ready: { team_a: null, team_b: { id: '2000', display_name: 'Cleo', at: readyAt } } })

        expect(managerDockOf(viewAt(asManager(oneReady), T0), IDLE_MANAGER_PLAY)?.primary?.readiness).toEqual([
            { side: 'team_a', ab: 'A', name: 'Crimson Cats', ready: false },
            { side: 'team_b', ab: 'B', name: 'Azure Owls', ready: true },
        ])
        expect(managerDockOf(viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A), IDLE_MANAGER_PLAY)?.primary).toMatchObject({
            command: 'pause',
            blocked: null,
            readiness: null,
        })
    })
})

describe('status line', () => {
    const phase = (state: PickBanState, serverTime: number) => managerDockOf(viewAt(asManager(readAt(state, serverTime)), serverTime), IDLE_MANAGER_PLAY)

    it('says where the session is, step by step', () => {
        const firstBan = locked(readAt(started(), AWAITING_A), BRAVO, AWAITING_A + 100)
        const revealAt = AWAITING_A + 100 + LEAD_MS

        expect(phase(pickBanState(), T0)).toMatchObject({ status: 'lobby', phase: 'Waiting for Start' })
        expect(phase(started(), T0 + 500)).toMatchObject({ status: 'running', phase: 'Starting' })
        expect(phase(started(), T0 + LEAD_MS + 1_000)).toMatchObject({ status: 'running', phase: 'Intro' })
        expect(phase(started(), AWAITING_A)).toMatchObject({ status: 'running', phase: 'Step 1 of 7 · Crimson Cats (ban)' })
        expect(phase(firstBan, revealAt + 1_000)).toMatchObject({ status: 'running', phase: 'Step 1 of 7 · Revealing' })
        expect(phase(paused(firstBan, unlockAt(firstBan) + 1_000), unlockAt(firstBan) + 5_000)).toMatchObject({ status: 'paused', phase: 'Step 2 of 7' })
        expect(phase(pickBanState({ id: null, status: 'none', phase: null }), T0)).toMatchObject({ status: 'none', phase: null })
    })

    it('says the final maps are in once the session is complete, and when they were edited', () => {
        const complete = (edited: boolean) => managerDockOf(viewAt(asManager({ ...completedRun(), edited }), T0 + 3_600_000), IDLE_MANAGER_PLAY)

        expect(complete(false)).toMatchObject({ status: 'complete', phase: 'Final maps written', done: 'The final maps are in the match.' })
        expect(complete(true)).toMatchObject({ phase: 'Final maps edited', done: 'The edited final maps are in the match.' })
        expect(phase(pickBanState(), T0)?.done).toBeNull()
    })
})

describe('run controls', () => {
    it('shows Swap only before the first step, Pause or Resume by status, and Undo once a step is in', () => {
        const commands = (state: PickBanState, serverTime: number) =>
            commandsOf(managerDockOf(viewAt(asManager(state), serverTime), IDLE_MANAGER_PLAY))

        const awaiting = readAt(started(), AWAITING_A)
        expect(commands(awaiting, AWAITING_A)).toEqual(['pause', 'swap', 'restart', 'cancel'])

        const firstBan = locked(awaiting, BRAVO, AWAITING_A + 100)
        const awaitingB = unlockAt(firstBan) + 1_000
        expect(commands(readAt(firstBan, awaitingB), awaitingB)).toEqual(['pause', 'undo', 'restart', 'cancel'])

        const onHold = paused(firstBan, awaitingB)
        expect(commands(onHold, awaitingB + 5_000)).toEqual(['resume', 'undo', 'restart', 'cancel'])
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, viewAt(asManager(onHold), awaitingB + 5_000), { command: 'resume' })?.request).toEqual({ command: 'resume' })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, viewAt(asManager(onHold), awaitingB + 5_000), { command: 'pause' })).toBeNull()
    })
})

describe('warnings', () => {
    const RESULTS_WARNING = 'Results are already entered for this match, so the Picks & Bans process can’t start or change the maps it wrote.'

    it('warns when results already exist, whatever else blocks Start', () => {
        const withResults = pickBanState({
            results_present: true,
            blocking_reason: 'a_undetermined',
            blocking_reasons: ['a_undetermined', 'results_present'],
        })

        expect(managerDockOf(viewAt(asManager(withResults), T0), IDLE_MANAGER_PLAY)).toMatchObject({
            primary: { blocked: { reason: 'Team A undetermined' } },
            resultsWarning: RESULTS_WARNING,
        })
        expect(managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY)?.resultsWarning).toBeNull()
    })

    it('warns on a complete session with results too, leaving Reopen, Restart and Cancel to the server’s refusal', () => {
        const done = (resultsPresent: boolean) =>
            managerDockOf(viewAt(asManager({ ...completedRun(), results_present: resultsPresent }), T0 + 3_600_000), IDLE_MANAGER_PLAY)

        expect(done(true)).toMatchObject({
            resultsWarning: RESULTS_WARNING,
            history: [{ command: 'reopen', disabled: false }, { command: 'edit-final', disabled: false }],
            danger: [{ command: 'restart', disabled: false }, { command: 'cancel', disabled: false }],
        })
        expect(done(false)?.resultsWarning).toBeNull()
    })

    it('flags a voided session prominently, keeps its results warning and offers Open again', () => {
        const voided = pickBanState({
            status: 'voided',
            phase: 'voided',
            end_reason: 'The match’s teams changed after the pick/ban opened, so it no longer applies.',
            results_present: true,
            warnings: [{ code: 'results_present', message: 'Results were already entered, so the map slots this pick/ban wrote were left in place.' }],
        })

        expect(managerDockOf(viewAt(asManager(voided), T0), IDLE_MANAGER_PLAY)).toMatchObject({
            voided: { kind: 'voided', reason: 'The match’s teams changed after the pick/ban opened, so it no longer applies.' },
            resultsWarning: RESULTS_WARNING,
            primary: { command: 'open', disabled: false },
            history: [],
            danger: [],
        })
        expect(managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY)?.voided).toBeNull()
    })
})

describe('lobby setup', () => {
    it('asks who is Team A while it is undetermined, with each team’s stage seed, and hides Swap', () => {
        const dock = managerDockOf(viewAt(asManager(undeterminedLobby()), T0), IDLE_MANAGER_PLAY)

        expect(dock).toMatchObject({
            sides: {
                tiles: [
                    { side: 'team_a', ab: null, name: 'Crimson Cats', stageSeed: 1 },
                    { side: 'team_b', ab: null, name: 'Azure Owls', stageSeed: 4 },
                ],
                chooseA: [
                    { side: 'team_a', name: 'Crimson Cats', stageSeed: 1, chosen: false },
                    { side: 'team_b', name: 'Azure Owls', stageSeed: 4, chosen: false },
                ],
                swap: null,
                basis: null,
            },
            primary: { command: 'start', disabled: true },
            danger: [{ command: 'cancel' }],
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, viewAt(asManager(undeterminedLobby()), T0), { command: 'choose-a', body: { side: 'team_b' } })?.request)
            .toEqual({ command: 'choose-a', body: { side: 'team_b' } })
    })

    it('keeps the chooser up while the seeds are tied, marking the chosen A and keeping each team in its place', () => {
        const { team_a, team_b } = pickBanState().teams
        const tiedAzureA = pickBanState({
            a_side: 'team_b',
            a_confirmed: true,
            teams: { team_a: { ...team_a!, ab: 'B', stage_seed: 2 }, team_b: { ...team_b!, ab: 'A', stage_seed: 2 } },
        })

        expect(managerDockOf(viewAt(asManager(tiedAzureA), T0), IDLE_MANAGER_PLAY)?.sides).toMatchObject({
            tiles: [{ side: 'team_b', ab: 'A' }, { side: 'team_a', ab: 'B' }],
            chooseA: [
                { side: 'team_a', name: 'Crimson Cats', stageSeed: 2, chosen: false },
                { side: 'team_b', name: 'Azure Owls', stageSeed: 2, chosen: true },
            ],
            swap: null,
            basis: 'A was set by a manager.',
        })
    })

    it('offers Swap once the seeds decide A, in the lobby and before the first step, saying why A is A', () => {
        const lobby = viewAt(asManager(pickBanState()), T0)

        expect(managerDockOf(lobby, IDLE_MANAGER_PLAY)?.sides).toMatchObject({
            tiles: [{ side: 'team_a', ab: 'A', stageSeed: 1 }, { side: 'team_b', ab: 'B', stageSeed: 4 }],
            chooseA: null,
            swap: { command: 'swap', label: 'Swap A and B', disabled: false },
            basis: 'A has the better stage seed.',
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, lobby, { command: 'swap' })?.request).toEqual({ command: 'swap' })

        const swapped = viewAt(asManager({ ...readAt(started(), AWAITING_A), a_confirmed: true }), AWAITING_A)
        expect(managerDockOf(swapped, IDLE_MANAGER_PLAY)?.sides).toMatchObject({ chooseA: null, swap: { command: 'swap' }, basis: 'A was set by a manager.' })

        const firstBan = locked(readAt(started(), AWAITING_A), BRAVO, AWAITING_A + 100)
        const afterFirstStep = viewAt(asManager(readAt(firstBan, unlockAt(firstBan) + 1_000)), unlockAt(firstBan) + 1_000)
        expect(managerDockOf(afterFirstStep, IDLE_MANAGER_PLAY)?.sides).toMatchObject({ chooseA: null, swap: null })
    })

    it('shows the sequence with where it came from, and offers the override in the lobby only', () => {
        const lobby = viewAt(asManager(pickBanState()), T0)
        const running = viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A)
        const override = { command: 'override-sequence', body: { from_stage_key: 'groups' } } as const

        expect(managerDockOf(lobby, IDLE_MANAGER_PLAY)?.sequence).toEqual({
            label: 'Bo3 · bans, picks, decider',
            detail: '7 steps · best of 3',
            changed: false,
            fromStageKey: null,
            currentKeys: ['stage:bracket', 'preset:bo3_ban_pick'],
            changeable: true,
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, lobby, override)?.request).toEqual(override)
        expect(managerDockOf(running, IDLE_MANAGER_PLAY)?.sequence).toMatchObject({ changeable: false })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, running, override)).toBeNull()
        expect(managerDockOf(viewAt(asManager(completedRun()), T0 + 3_600_000), IDLE_MANAGER_PLAY)?.sequence).toBeNull()

        const { sequence } = pickBanState()
        const fromGroups = viewAt(asManager(pickBanState({ sequence: { ...sequence!, preset_id: null, from_stage_key: 'groups' } })), T0)
        expect(managerDockOf(fromGroups, IDLE_MANAGER_PLAY)?.sequence).toMatchObject({
            label: 'Custom sequence',
            changed: true,
            fromStageKey: 'groups',
            currentKeys: ['stage:groups'],
        })
        const bo5Preset = viewAt(asManager(pickBanState({ sequence: { ...sequence!, preset_id: 'bo5_ban_pick', from_stage_key: null } })), T0)
        expect(managerDockOf(bo5Preset, IDLE_MANAGER_PLAY)?.sequence).toMatchObject({
            label: 'Bo5 · bans, picks, bans, decider',
            changed: true,
            fromStageKey: null,
            currentKeys: ['preset:bo5_ban_pick'],
        })
    })

    it('lists every preset, then each stage with a block, marking the one the session runs', () => {
        const stages = [stageConfig('groups', 'Groups', 4, true), stageConfig('final', 'Final', 5, false)]

        expect(sequenceChoices(stages)).toEqual([
            { key: 'preset:bo4_picks', label: 'Bo4 · four picks', body: { preset_id: 'bo4_picks' }, current: false },
            { key: 'preset:bo3_ban_pick', label: 'Bo3 · bans, picks, decider', body: { preset_id: 'bo3_ban_pick' }, current: false },
            { key: 'preset:bo5_ban_pick', label: 'Bo5 · bans, picks, bans, decider', body: { preset_id: 'bo5_ban_pick' }, current: false },
            { key: 'stage:groups', label: 'Groups (Bo4)', body: { from_stage_key: 'groups' }, current: false },
        ])

        const current = (choiceStages: PickBanStageConfig[]) => {
            const { sequence } = managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY)!
            return sequenceChoices(choiceStages, sequence).filter((choice) => choice.current).map((choice) => choice.key)
        }
        expect(current([...stages, stageConfig('bracket', 'Bracket', 3, true)])).toEqual(['stage:bracket'])
        expect(current(stages)).toEqual(['preset:bo3_ban_pick'])
    })

    it('keys each override option uniquely, even when two stages share a name and best-of', () => {
        const keys = sequenceChoices([stageConfig('group-a', 'Groups', 4, true), stageConfig('group-b', 'Groups', 4, true)]).map((choice) => choice.key)

        expect(new Set(keys).size).toBe(keys.length)
    })
})

describe('handing over', () => {
    it('lists each side’s roster with who has control, and hands over or gives control back to the captain', () => {
        const lobby = viewAt(asManager(pickBanState()), T0)

        const [crimson, azure] = managerDockOf(lobby, IDLE_MANAGER_PLAY)!.sides!.tiles
        expect(crimson).toMatchObject({ side: 'team_a', ab: 'A', name: 'Crimson Cats' })
        expect(crimson.handOver!.map(({ member, controls, userId }) => [member.display_name, controls, userId])).toEqual([
            ['Ada', true, null],
            ['Ben', false, '1001'],
        ])
        expect(azure.handOver!.map(({ member }) => member.display_name)).toEqual(['Cleo', 'Dex'])

        const handover = { command: 'hand-over', body: { side: 'team_a', user_id: '1001' } } as const
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, lobby, handover)?.request).toEqual(handover)

        const handedOver = viewAt(asManager(asActingCaptain(pickBanState(), 'team_a')), T0)
        expect(managerDockOf(handedOver, IDLE_MANAGER_PLAY)!.sides!.tiles[0].handOver!.map(({ controls, userId }) => [controls, userId])).toEqual([
            [false, null],
            [true, '1001'],
        ])

        const firstBan = locked(readAt(started(), AWAITING_A), BRAVO, AWAITING_A + 100)
        const running = viewAt(asManager(readAt(firstBan, unlockAt(firstBan) + 1_000)), unlockAt(firstBan) + 1_000)
        expect(managerDockOf(running, IDLE_MANAGER_PLAY)?.sides?.tiles.map((tile) => tile.handOver?.length)).toEqual([2, 2])
        expect(managerDockOf(viewAt(asManager(completedRun()), T0 + 3_600_000), IDLE_MANAGER_PLAY)?.sides).toBeNull()
    })
})

describe('acting for a team', () => {
    const awaitingA = () => asManager(readAt(started(), AWAITING_A))

    it('offers the awaited side’s select-then-Lock in flow and sends a lock for that side and plan index', () => {
        const view = viewAt(awaitingA(), AWAITING_A)

        expect(managerDockOf(view, IDLE_MANAGER_PLAY)?.actFor).toEqual({
            side: 'team_a',
            ab: 'A',
            teamName: 'Crimson Cats',
            dock: { controls: { kind: 'choose', action: 'ban', mapNumber: null, selectedMap: null, canLockIn: false }, rejection: null },
        })
        expect(beginActForLock(IDLE_MANAGER_PLAY, view)).toBeNull()

        const play = selectActForMap(IDLE_MANAGER_PLAY, view, BRAVO)
        expect(withManagerPlay(view, play).cards.filter((card) => card.selected).map((card) => card.map)).toEqual([BRAVO])
        expect(managerDockOf(view, play)?.actFor?.dock.controls).toMatchObject({ kind: 'choose', selectedMap: BRAVO, canLockIn: true })

        const submission = beginActForLock(play, view)
        expect(submission?.request).toEqual({ command: 'lock', body: { side: 'team_a', map: BRAVO, plan_index: 0 } })
        expect(beginActForLock(submission!.play, view)).toBeNull()
    })

    it('shows Locked in at once and keeps it until the step is revealed', () => {
        const awaiting = awaitingA()
        const view = viewAt(awaiting, AWAITING_A)
        const submission = beginActForLock(selectActForMap(IDLE_MANAGER_PLAY, view, BRAVO), view)!

        const optimistic = withManagerPlay(view, submission.play)
        expect(optimistic.cards.filter((card) => card.lockedIn).map((card) => card.map)).toEqual([BRAVO])
        expect(optimistic.cards.some((card) => card.selectable || card.selected)).toBe(false)
        expect(optimistic.turn).toMatchObject({ stepIndex: 0, lockedIn: true })
        expect(optimistic.timeline[0].status).toBe('locked_in')
        expect(managerDockOf(view, submission.play)?.actFor?.dock.controls).toEqual({ kind: 'locked_in', map: BRAVO })

        const settled = managerCommandSucceeded(submission.play)
        const answered = asManager(locked(awaiting, BRAVO, AWAITING_A + 200, { byAdmin: true }))
        const inLead = viewAt(answered, AWAITING_A + 400)
        expect(withManagerPlay(inLead, settled).cards.filter((card) => card.lockedIn).map((card) => card.map)).toEqual([BRAVO])
        expect(managerDockOf(inLead, settled)?.actFor?.dock.controls).toEqual({ kind: 'locked_in', map: BRAVO })

        const revealed = viewAt(answered, AWAITING_A + 200 + LEAD_MS)
        expect(withManagerPlay(revealed, settled).cards.find((card) => card.map === BRAVO)).toMatchObject({ state: 'banned', lockedIn: false })
        expect(managerDockOf(revealed, settled)?.actFor?.dock.controls).toMatchObject({ kind: 'locked', reason: 'spotlight' })
    })

    it('forgets its Locked in once the manager undoes that step, so a later lock-in by the team isn’t shown as theirs', () => {
        const awaiting = awaitingA()
        const view = viewAt(awaiting, AWAITING_A)
        const lockedIn = managerCommandSucceeded(beginActForLock(selectActForMap(IDLE_MANAGER_PLAY, view, BRAVO), view)!.play)
        const answered = asManager(locked(awaiting, BRAVO, AWAITING_A + 200, { byAdmin: true }))

        const undoing = beginManagerCommand(lockedIn, viewAt(answered, AWAITING_A + 400), { command: 'undo' })!
        const afterUndo = managerCommandSucceeded(undoing.play)
        const reLocked = asManager(locked(undone(answered, AWAITING_A + 600), CHARLIE, AWAITING_A + 800))

        const inLead = viewAt(reLocked, AWAITING_A + 1_000)
        expect(managerDockOf(inLead, afterUndo)?.actFor?.dock.controls).toMatchObject({ kind: 'waiting' })
        expect(withManagerPlay(inLead, afterUndo).cards.some((card) => card.lockedIn)).toBe(false)
    })

    it('forgets its Locked in once it sees the step awaited again, whoever undid it', () => {
        const awaiting = awaitingA()
        const view = viewAt(awaiting, AWAITING_A)
        const lockedIn = managerCommandSucceeded(beginActForLock(selectActForMap(IDLE_MANAGER_PLAY, view, BRAVO), view)!.play)
        const answered = asManager(locked(awaiting, BRAVO, AWAITING_A + 200, { byAdmin: true }))
        expect(settleManagerPlay(lockedIn, viewAt(answered, AWAITING_A + 400))).toBe(lockedIn)

        const undoneElsewhere = undone(answered, AWAITING_A + 600)
        const settled = settleManagerPlay(lockedIn, viewAt(undoneElsewhere, AWAITING_A + 700))
        const reLocked = viewAt(asManager(locked(undoneElsewhere, CHARLIE, AWAITING_A + 800)), AWAITING_A + 1_000)
        expect(managerDockOf(reLocked, settled)?.actFor?.dock.controls).toMatchObject({ kind: 'waiting' })
    })

    it('locks the strip with the countdown and who is up next through the intro, a reveal and a pause', () => {
        const introAt = T0 + LEAD_MS + 1_000
        const actFor = (state: PickBanState, serverTime: number) =>
            managerDockOf(viewAt(asManager(readAt(state, serverTime)), serverTime), IDLE_MANAGER_PLAY)?.actFor?.dock.controls

        expect(actFor(started(), T0 + 500)).toMatchObject({ kind: 'locked', reason: 'intro', next: null })
        expect(actFor(started(), introAt)).toMatchObject({
            kind: 'locked',
            reason: 'intro',
            countdown: { remainingMs: INTRO_MS - 1_000, frozen: false },
            next: { stepIndex: 0, actorLabel: 'Crimson Cats' },
        })

        const firstBan = locked(readAt(started(), AWAITING_A), BRAVO, AWAITING_A + 100)
        const revealAt = AWAITING_A + 100 + LEAD_MS
        expect(actFor(firstBan, AWAITING_A + 500)).toMatchObject({ kind: 'waiting', turn: { stepIndex: 0 } })
        expect(actFor(firstBan, revealAt + 2_000)).toMatchObject({
            kind: 'locked',
            reason: 'spotlight',
            countdown: { remainingMs: SPOTLIGHT_MS - 2_000, frozen: false },
            next: { stepIndex: 1, actorLabel: 'Azure Owls' },
        })
        expect(actFor(paused(firstBan, revealAt + 2_000), revealAt + 5_000)).toMatchObject({
            kind: 'locked',
            reason: 'paused',
            countdown: { remainingMs: SPOTLIGHT_MS - 2_000, frozen: true },
            next: { stepIndex: 1 },
        })
    })

    it('keeps the strip up from Start to the last lock-in, so the controls below it never jump', () => {
        let state = started()
        const kinds: (string | undefined)[] = []
        const sample = (serverTime: number) =>
            kinds.push(managerDockOf(viewAt(asManager(readAt(state, serverTime)), serverTime), IDLE_MANAGER_PLAY)?.actFor?.dock.controls?.kind)

        sample(T0 + 500)
        sample(T0 + LEAD_MS + 1_000)
        for (const map of ELIGIBLE_MAPS.slice(0, 5)) {
            const at = unlockAt(state) + 1_000
            sample(at)
            state = locked(state, map, at + 100)
            sample(at + 500)
            sample(at + 100 + LEAD_MS + 1_000)
        }

        expect(kinds).not.toContain(undefined)
        expect(new Set(kinds)).toEqual(new Set(['locked', 'choose', 'waiting']))
        expect(managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY)?.actFor).toBeNull()
        expect(managerDockOf(viewAt(asManager(completedRun()), T0 + 3_600_000), IDLE_MANAGER_PLAY)?.actFor).toBeNull()
    })

    it('leaves a manager’s own turn as captain to the captain controls', () => {
        const captain = asCaptain(readAt(started(), AWAITING_A), 'team_a')
        const managingCaptain = { ...captain, capabilities: { ...captain.capabilities, can_manage: true } }

        expect(managerDockOf(viewAt(managingCaptain, AWAITING_A), IDLE_MANAGER_PLAY)?.actFor?.dock.controls).toMatchObject({
            kind: 'waiting',
            turn: { stepIndex: 0, viewerActs: true },
        })
    })
})

describe('refusals', () => {
    const refusal = (code: string) => new ApiError(409, 'The server’s own words', 'Request failed', code)
    const lobby = () => viewAt(asManager(pickBanState()), T0)

    it('words a refused command by its specific reason and frees the dock', () => {
        const view = lobby()
        const starting = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'start' })!.play

        const refused = managerCommandRejected(starting, refusal('pool_too_small'))
        expect(managerDockOf(view, refused)).toMatchObject({ busy: false, rejection: 'Map pool is too small.' })
        expect(managerDockOf(view, managerCommandRejected(starting, refusal('results_present')))?.rejection).toBe('Results already entered.')
        expect(managerDockOf(view, managerCommandRejected(starting, refusal('version_conflict')))?.rejection).toBe(
            'The session changed just before your click. Check it and try again.',
        )
        expect(managerDockOf(view, managerCommandRejected(starting, refusal('wrong_status')))?.rejection).toBe(
            'The session moved on just before your click, so that no longer applies.',
        )
        expect(managerDockOf(view, managerCommandRejected(starting, new TypeError('Failed to fetch')))?.rejection).toBe(
            'Couldn’t reach the server. Check your connection and try again.',
        )
        expect(managerDockOf(view, dismissManagerRejection(refused))?.rejection).toBeNull()
    })

    it('says a refused hand-over needs an active roster member, keeping the general words for other invalid requests', () => {
        const view = lobby()
        const handingOver = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'hand-over', body: { side: 'team_a', user_id: '1001' } })!.play
        const starting = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'start' })!.play

        expect(managerDockOf(view, managerCommandRejected(handingOver, refusal('invalid_request')))?.rejection).toBe(
            'That player can’t take control: pick an active roster member of that side’s team.',
        )
        expect(managerDockOf(view, managerCommandRejected(starting, refusal('invalid_request')))?.rejection).toBe(
            'The server didn’t accept that request. Refresh the page and try again.',
        )
    })

    it('has its own words for every stable code, never the server’s message', () => {
        const starting = beginManagerCommand(IDLE_MANAGER_PLAY, lobby(), { command: 'start' })!.play
        const worded = PICK_BAN_ERROR_CODES.map((code) => managerCommandRejected(starting, refusal(code)).rejection)

        expect(worded).not.toContain('The server’s own words')
        expect(new Set(worded).size).toBe(PICK_BAN_ERROR_CODES.length)
    })

    it('shows a refused act-for lock-in beside Lock in, dropping Locked in but keeping the selection', () => {
        const view = viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A)
        const submission = beginActForLock(selectActForMap(IDLE_MANAGER_PLAY, view, BRAVO), view)!

        const refused = managerCommandRejected(submission.play, refusal('map_unavailable'))
        const dock = managerDockOf(view, refused)
        expect(dock?.rejection).toBeNull()
        expect(dock?.actFor?.dock).toEqual({
            controls: { kind: 'choose', action: 'ban', mapNumber: null, selectedMap: BRAVO, canLockIn: true },
            rejection: 'That map can’t be chosen any more. Select another.',
        })
        expect(withManagerPlay(view, refused).cards.some((card) => card.lockedIn)).toBe(false)
    })
})

describe('restarting and cancelling', () => {
    const running = () => viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A)

    it('asks for confirmation, saying what will be lost, before Restart is sent', () => {
        const view = running()

        const asked = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'restart' })
        expect(asked?.request).toBeNull()
        expect(managerDockOf(view, asked!.play)?.confirm).toEqual({
            command: 'restart',
            title: 'Restart the Picks & Bans process?',
            message: 'Every pick and ban so far is undone and both teams go back to the lobby. Both Ready marks clear, and any maps this Picks & Bans process wrote into the match are removed.',
            confirmLabel: 'Restart',
            dismissLabel: 'Keep It',
        })

        const confirmed = confirmManagerCommand(asked!.play, view)
        expect(confirmed?.request).toEqual({ command: 'restart' })
        expect(managerDockOf(view, confirmed!.play)).toMatchObject({ busy: true, confirm: null })
        expect(confirmManagerCommand(IDLE_MANAGER_PLAY, view)).toBeNull()
    })

    it('asks before Cancel too, and sends nothing when the confirmation is dismissed', () => {
        const view = running()

        const asked = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'cancel' })!
        expect(managerDockOf(view, asked.play)?.confirm).toMatchObject({
            command: 'cancel',
            title: 'Cancel the Picks & Bans process?',
            message: 'This ends the Picks & Bans process for good. Its picks and bans won’t count, and any maps it wrote into the match are removed. You can open a new lobby afterwards.',
            confirmLabel: 'Cancel Picks & Bans',
        })

        const dismissed = dismissManagerConfirm(asked.play)
        expect(managerDockOf(view, dismissed)).toMatchObject({ busy: false, confirm: null })
        expect(confirmManagerCommand(dismissed, view)).toBeNull()
    })

    it('drops a pending confirmation the session no longer allows, so it never comes back later', () => {
        const asked = beginManagerCommand(IDLE_MANAGER_PLAY, running(), { command: 'restart' })!.play
        const lobby = viewAt(asManager(pickBanState()), T0)

        expect(managerDockOf(lobby, asked)?.confirm).toBeNull()
        expect(confirmManagerCommand(asked, lobby)).toBeNull()

        const settled = settleManagerPlay(asked, lobby)
        expect(managerDockOf(running(), settled)?.confirm).toBeNull()
        expect(settleManagerPlay(asked, running())).toBe(asked)
    })
})

describe('reopening', () => {
    const AFTER = T0 + 3_600_000
    const complete = () => viewAt(asManager(completedRun()), AFTER)

    it('offers Reopen on a complete session and sends undo once confirmed, saying what happens first', () => {
        const view = complete()
        expect(managerDockOf(view, IDLE_MANAGER_PLAY)?.history).toContainEqual({
            command: 'reopen',
            label: 'Reopen',
            hint: 'Takes back the last pick or ban, with any automatic step after it, and continues the Picks & Bans process from there.',
            disabled: false,
        })

        const asked = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'reopen' })
        expect(asked?.request).toBeNull()
        expect(managerDockOf(view, asked!.play)?.confirm).toEqual({
            command: 'reopen',
            title: 'Reopen the Picks & Bans process?',
            message: 'The last pick or ban is undone, with any automatic step after it, and the Picks & Bans process waits on that step again. The maps it wrote into the match are removed, and any edits to the final maps are discarded.',
            confirmLabel: 'Reopen',
            dismissLabel: 'Keep It',
        })

        const confirmed = confirmManagerCommand(asked!.play, view)
        expect(confirmed?.request).toEqual({ command: 'undo', version: completedRun().version })
        expect(managerDockOf(view, confirmed!.play)).toMatchObject({ busy: true, confirm: null })
    })

    it('sends Reopen with the version its confirmation opened on, so a newer edit is refused rather than discarded', () => {
        const seen = completedRun()
        const asked = beginManagerCommand(IDLE_MANAGER_PLAY, complete(), { command: 'reopen' })!.play
        const editedElsewhere = viewAt(asManager({
            ...seen,
            version: seen.version + 1,
            edited: true,
            final_maps: [finalMapOf(1, DELTA, 'team_a'), finalMapOf(2, CHARLIE, 'team_b'), finalMapOf(3, GOLF, null, true)],
        }), AFTER)

        expect(managerDockOf(editedElsewhere, asked)?.confirm).toMatchObject({ command: 'reopen' })
        expect(confirmManagerCommand(asked, editedElsewhere)?.request).toEqual({ command: 'undo', version: seen.version })
    })

    it('leaves a running or paused session to Undo, which sends at once', () => {
        const firstBan = locked(readAt(started(), AWAITING_A), BRAVO, AWAITING_A + 100)
        const at = unlockAt(firstBan) + 1_000
        const running = viewAt(asManager(readAt(firstBan, at)), at)
        const onHold = viewAt(asManager(paused(firstBan, at)), at + 5_000)

        for (const view of [running, onHold]) {
            expect(commandsOf(managerDockOf(view, IDLE_MANAGER_PLAY))).not.toContain('reopen')
            expect(beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'reopen' })).toBeNull()
            expect(beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'undo' })?.request).toEqual({ command: 'undo' })
        }
        expect(commandsOf(managerDockOf(complete(), IDLE_MANAGER_PLAY))).not.toContain('undo')
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, complete(), { command: 'undo' })).toBeNull()
    })

    it('drops a pending Reopen once the session is running again, rather than undoing another step', () => {
        const asked = beginManagerCommand(IDLE_MANAGER_PLAY, complete(), { command: 'reopen' })!.play
        const reopenedElsewhere = undone(asManager(completedRun()), AFTER)
        const running = viewAt(reopenedElsewhere, unlockAt(reopenedElsewhere) + 1_000)

        expect(managerDockOf(running, asked)?.confirm).toBeNull()
        expect(confirmManagerCommand(asked, running)).toBeNull()
        expect(managerDockOf(complete(), settleManagerPlay(asked, running))?.confirm).toBeNull()
    })
})

describe('editing the final maps', () => {
    const AFTER = T0 + 3_600_000
    const complete = () => viewAt(asManager(completedRun()), AFTER)
    const VERSION = completedRun().version
    const EDITED: Extract<ManagerRequest, { command: 'edit-final' }> = {
        command: 'edit-final',
        body: {
            maps: [
                { map: DELTA, picked_by: 'team_a', decider: false },
                { map: CHARLIE, picked_by: 'team_b', decider: false },
                { map: GOLF, picked_by: null, decider: true },
            ],
        },
        version: VERSION,
    }
    const editedElsewhere = () => viewAt(asManager({
        ...completedRun(),
        version: VERSION + 1,
        edited: true,
        final_maps: [finalMapOf(1, CHARLIE, 'team_b'), finalMapOf(2, ALPHA, 'team_a'), finalMapOf(3, GOLF, null, true)],
    }), AFTER)
    const swapFirstTwo = (view: PickBanView) => changeFinalEditor(openFinalEditor(IDLE_MANAGER_PLAY, view), (draft) => moveFinalEntry(draft, 0, 1))

    it('is offered on a complete session only, and saves only from an open editor', () => {
        expect(managerDockOf(complete(), IDLE_MANAGER_PLAY)?.history).toContainEqual({
            command: 'edit-final',
            label: 'Edit Final Maps…',
            hint: 'Rewrites the match’s maps: their order, who picked each and the decider.',
            disabled: false,
        })
        expect(commandsOf(managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY))).not.toContain('edit-final')
        expect(commandsOf(managerDockOf(viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A), IDLE_MANAGER_PLAY))).not.toContain('edit-final')
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, complete(), { command: 'edit-final' })).toBeNull()
        expect(beginManagerCommand(swapFirstTwo(complete()), viewAt(asManager(pickBanState()), T0), { command: 'edit-final' })).toBeNull()
    })

    it('opens an editor on the final summary, saves the edited list through the confirmation and closes once it is in', () => {
        const view = complete()
        const opened = openFinalEditor(IDLE_MANAGER_PLAY, view)
        expect(managerDockOf(view, opened)?.finalEditor?.rows.map((row) => row.map)).toEqual([CHARLIE, DELTA, GOLF])

        const reordered = changeFinalEditor(opened, (draft) => moveFinalEntry(draft, 0, 1))
        expect(managerDockOf(view, reordered)?.finalEditor).toMatchObject({ saving: false, outdated: false, rejection: null, body: EDITED.body })

        const asked = beginManagerCommand(reordered, view, { command: 'edit-final' })!
        expect(asked.request).toBeNull()
        expect(managerDockOf(view, asked.play)?.confirm).toEqual({
            command: 'edit-final',
            title: 'Save the edited final maps?',
            message: 'The match’s maps are rewritten to your list, in its order, with the picks and decider you set. The final summary is marked Edited, and the timeline keeps the picks and bans as they were played.',
            confirmLabel: 'Save Final Maps',
            dismissLabel: 'Keep Editing',
        })
        expect(managerDockOf(view, dismissManagerConfirm(asked.play))?.finalEditor?.body).toEqual(EDITED.body)

        const saving = confirmManagerCommand(asked.play, view)!
        expect(saving.request).toEqual(EDITED)
        expect(managerDockOf(view, saving.play)).toMatchObject({ busy: true, confirm: null, finalEditor: { saving: true } })

        const saved = asManager({ ...completedRun(), version: VERSION + 1, edited: true })
        expect(managerDockOf(viewAt(saved, AFTER), managerCommandSucceeded(saving.play))?.finalEditor).toBeNull()
    })

    it('saves against the version the editor opened on, holding Save once the session has moved on until it is reloaded', () => {
        const opened = swapFirstTwo(complete())
        const newer = editedElsewhere()

        expect(managerDockOf(newer, opened)?.finalEditor).toMatchObject({ outdated: true, body: EDITED.body })
        expect(beginManagerCommand(opened, newer, { command: 'edit-final' })).toBeNull()

        const reloaded = openFinalEditor(opened, newer)
        expect(managerDockOf(newer, reloaded)?.finalEditor).toMatchObject({ outdated: false })
        expect(managerDockOf(newer, reloaded)?.finalEditor?.rows.map((row) => row.map)).toEqual([CHARLIE, ALPHA, GOLF])
        const saving = confirmManagerCommand(beginManagerCommand(reloaded, newer, { command: 'edit-final' })!.play, newer)!
        expect(saving.request).toMatchObject({ command: 'edit-final', version: VERSION + 1 })
    })

    it('keeps the draft when the save meets a newer session, saying the final maps changed, until the reload takes over', () => {
        const view = complete()
        const saving = confirmManagerCommand(beginManagerCommand(swapFirstTwo(view), view, { command: 'edit-final' })!.play, view)!.play
        const conflict = new ApiError(409, 'The server’s own words', 'Request failed', 'version_conflict')
        const refused = managerCommandRejected(saving, conflict)

        expect(managerDockOf(view, refused)).toMatchObject({
            rejection: null,
            finalEditor: { outdated: false, rejection: 'The final maps changed since you opened the editor.' },
        })
        expect(managerDockOf(view, refused)?.finalEditor?.rows.map((row) => row.map)).toEqual([DELTA, CHARLIE, GOLF])

        const newer = editedElsewhere()
        expect(managerDockOf(newer, refused)).toMatchObject({ rejection: null, finalEditor: { outdated: true, rejection: null } })
        expect(managerDockOf(newer, openFinalEditor(refused, newer))).toMatchObject({ rejection: null, finalEditor: { outdated: false, rejection: null } })
    })

    it('opens only while Edit final applies, and never while a command is in flight', () => {
        const running = viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A)
        expect(openFinalEditor(IDLE_MANAGER_PLAY, running)).toBe(IDLE_MANAGER_PLAY)

        const reopening = beginManagerCommand(IDLE_MANAGER_PLAY, complete(), { command: 'reopen' })!
        const busy = confirmManagerCommand(reopening.play, complete())!.play
        expect(openFinalEditor(busy, complete())).toBe(busy)
    })

    it('keeps the draft and shows a refusal inside the editor, and closing it drops both', () => {
        const view = complete()
        const saving = confirmManagerCommand(beginManagerCommand(swapFirstTwo(view), view, { command: 'edit-final' })!.play, view)!.play

        const detail = 'Field \'maps[1].picked_by\' must be null: the decider has no picking side.'
        const refused = managerCommandRejected(saving, new ApiError(422, detail, 'Request failed', 'invalid_request'))
        expect(managerDockOf(view, refused)).toMatchObject({
            busy: false,
            rejection: null,
            finalEditor: { saving: false, rejection: `The server didn’t accept that final list. ${detail}` },
        })
        expect(managerDockOf(view, refused)?.finalEditor?.rows.map((row) => row.map)).toEqual([DELTA, CHARLIE, GOLF])

        const closed = closeFinalEditor(refused)
        expect(managerDockOf(view, closed)).toMatchObject({ finalEditor: null, rejection: null })
    })

    it('closes the editor and drops a pending save once the session is no longer complete', () => {
        const view = complete()
        const opened = openFinalEditor(IDLE_MANAGER_PLAY, view)
        const asked = beginManagerCommand(opened, view, { command: 'edit-final' })!.play
        const reopenedElsewhere = undone(asManager(completedRun()), AFTER)
        const running = viewAt(reopenedElsewhere, unlockAt(reopenedElsewhere) + 1_000)

        expect(managerDockOf(running, asked)).toMatchObject({ finalEditor: null, confirm: null })
        expect(confirmManagerCommand(asked, running)).toBeNull()

        const settled = settleManagerPlay(asked, running)
        expect(managerDockOf(view, settled)).toMatchObject({ finalEditor: null, confirm: null })
        expect(settleManagerPlay(opened, view)).toBe(opened)
    })

    it('words a refused Reopen or edit that comes from results already entered', () => {
        const withResults = viewAt(asManager({ ...completedRun(), results_present: true }), AFTER)
        const resultsPresent = new ApiError(409, 'The server’s own words', 'Request failed', 'results_present')
        const reopening = confirmManagerCommand(beginManagerCommand(IDLE_MANAGER_PLAY, withResults, { command: 'reopen' })!.play, withResults)!.play
        const saving = confirmManagerCommand(beginManagerCommand(swapFirstTwo(withResults), withResults, { command: 'edit-final' })!.play, withResults)!.play

        expect(managerDockOf(withResults, managerCommandRejected(reopening, resultsPresent))?.rejection).toBe('Results already entered.')
        expect(managerDockOf(withResults, managerCommandRejected(saving, resultsPresent))?.finalEditor?.rejection).toBe('Results already entered.')
    })

    it('words a refused Reopen when no ban or pick was ever made', () => {
        const view = complete()
        const nothingToUndo = new ApiError(409, 'The server’s own words', 'Request failed', 'nothing_to_undo')
        const reopening = confirmManagerCommand(beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'reopen' })!.play, view)!.play

        expect(managerDockOf(view, managerCommandRejected(reopening, nothingToUndo))?.rejection).toBe('There’s no pick or ban to undo.')
    })
})
