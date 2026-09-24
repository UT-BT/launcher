import { describe, expect, it } from 'vitest'
import { ApiError, PICK_BAN_ERROR_CODES, type PickBanStageConfig, type PickBanState } from '@/app/utils/api'
import { buildPickBanView, type PickBanView } from './pickBanView'
import {
    IDLE_MANAGER_PLAY,
    beginActForLock,
    beginManagerCommand,
    confirmManagerCommand,
    dismissManagerConfirm,
    dismissManagerRejection,
    managerCommandRejected,
    managerCommandSucceeded,
    managerDockOf,
    selectActForMap,
    sequenceChoices,
    settleManagerPlay,
    withManagerPlay,
    type ManagerRequest,
} from './managerDock'
import {
    ELIGIBLE_MAPS,
    INTRO_MS,
    LEAD_MS,
    T0,
    asActingCaptain,
    asCaptain,
    asManager,
    asSpectator,
    asTeammate,
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
        expect(managerDockOf(viewAt(asManager(lobby), T0 - 300_000), play)?.startBlockedBy).toBe('Team A undetermined')
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
            buttons: [{ command: 'restart' }, { command: 'cancel' }],
        })
    })
})

describe('opening a lobby', () => {
    it('offers only Open while the match has no session, sends it without a body and holds every button while it runs', () => {
        const view = viewAt(asManager(pickBanState({ id: null, status: 'none', phase: null })), T0)

        expect(managerDockOf(view, IDLE_MANAGER_PLAY)?.buttons).toEqual([{ command: 'open', label: 'Open lobby', disabled: false }])

        const submission = beginManagerCommand(IDLE_MANAGER_PLAY, view, { command: 'open' })
        expect(submission?.request).toEqual({ command: 'open' })
        expect(managerDockOf(view, submission!.play)).toMatchObject({ busy: true, buttons: [{ command: 'open', disabled: true }] })
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
            startBlockedBy: 'Map pool is too small',
            buttons: [
                { command: 'start', label: 'Start', disabled: true },
                { command: 'swap', disabled: false },
                { command: 'cancel', disabled: false },
            ],
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, tooSmall, { command: 'start' })).toBeNull()

        expect(managerDockOf(blocked('a_undetermined'), IDLE_MANAGER_PLAY)?.startBlockedBy).toBe('Team A undetermined')
        expect(managerDockOf(blocked('pre_cup_seed_missing'), IDLE_MANAGER_PLAY)?.startBlockedBy).toBe('A team is missing its pre-cup seed')
        expect(managerDockOf(blocked('match_finished'), IDLE_MANAGER_PLAY)?.startBlockedBy).toBe('Match already finished')

        const ready = blocked(null)
        expect(managerDockOf(ready, IDLE_MANAGER_PLAY)).toMatchObject({
            startBlockedBy: null,
            buttons: [{ command: 'start', disabled: false }, { command: 'swap' }, { command: 'cancel' }],
        })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, ready, { command: 'start' })?.request).toEqual({ command: 'start' })
    })
})

describe('run controls', () => {
    it('shows Swap only before the first step, Pause or Resume by status, and Undo once a step is in', () => {
        const commands = (state: PickBanState, serverTime: number) =>
            managerDockOf(viewAt(asManager(state), serverTime), IDLE_MANAGER_PLAY)?.buttons.map((button) => button.command)

        const awaiting = readAt(started(), AWAITING_A)
        expect(commands(awaiting, AWAITING_A)).toEqual(['swap', 'pause', 'restart', 'cancel'])

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
    const RESULTS_WARNING = 'Results are already entered for this match, so the pick/ban can’t start or change the maps it wrote.'

    it('warns when results already exist, whatever else blocks Start', () => {
        const withResults = pickBanState({
            results_present: true,
            blocking_reason: 'a_undetermined',
            blocking_reasons: ['a_undetermined', 'results_present'],
        })

        expect(managerDockOf(viewAt(asManager(withResults), T0), IDLE_MANAGER_PLAY)).toMatchObject({
            startBlockedBy: 'Team A undetermined',
            resultsWarning: RESULTS_WARNING,
        })
        expect(managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY)?.resultsWarning).toBeNull()
    })

    it('warns on a complete session with results too, leaving Restart and Cancel to the server’s refusal', () => {
        const done = (resultsPresent: boolean) =>
            managerDockOf(viewAt(asManager({ ...completedRun(), results_present: resultsPresent }), T0 + 3_600_000), IDLE_MANAGER_PLAY)

        expect(done(true)).toMatchObject({
            resultsWarning: RESULTS_WARNING,
            buttons: [{ command: 'restart', disabled: false }, { command: 'cancel', disabled: false }],
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
            buttons: [{ command: 'open', disabled: false }],
        })
        expect(managerDockOf(viewAt(asManager(pickBanState()), T0), IDLE_MANAGER_PLAY)?.voided).toBeNull()
    })
})

describe('lobby setup', () => {
    it('offers either team as A while it is undetermined, and marks the chosen A once it is set', () => {
        expect(managerDockOf(viewAt(asManager(undeterminedLobby()), T0), IDLE_MANAGER_PLAY)).toMatchObject({
            chooseA: [
                { side: 'team_a', name: 'Crimson Cats', chosen: false },
                { side: 'team_b', name: 'Azure Owls', chosen: false },
            ],
            buttons: [{ command: 'start', disabled: true }, { command: 'cancel' }],
        })

        const { team_a, team_b } = pickBanState().teams
        const azureA = pickBanState({ a_side: 'team_b', teams: { team_a: { ...team_a!, ab: 'B' }, team_b: { ...team_b!, ab: 'A' } } })
        expect(managerDockOf(viewAt(asManager(azureA), T0), IDLE_MANAGER_PLAY)?.chooseA).toEqual([
            { side: 'team_b', name: 'Azure Owls', chosen: true },
            { side: 'team_a', name: 'Crimson Cats', chosen: false },
        ])
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, viewAt(asManager(azureA), T0), { command: 'swap' })?.request).toEqual({ command: 'swap' })
    })

    it('offers the sequence override in the lobby only, from a preset or another stage’s sequence', () => {
        const lobby = viewAt(asManager(pickBanState()), T0)
        const running = viewAt(asManager(readAt(started(), AWAITING_A)), AWAITING_A)
        const override = { command: 'override-sequence', body: { from_stage_key: 'groups' } } as const

        expect(managerDockOf(lobby, IDLE_MANAGER_PLAY)).toMatchObject({ overrideSequence: true, chooseA: expect.any(Array) })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, lobby, override)?.request).toEqual(override)
        expect(managerDockOf(running, IDLE_MANAGER_PLAY)).toMatchObject({ overrideSequence: false, chooseA: null })
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, running, override)).toBeNull()

        expect(sequenceChoices([stageConfig('groups', 'Groups', 4, true), stageConfig('final', 'Final', 5, false)])).toEqual([
            { label: 'Bo4 · four picks', body: { preset_id: 'bo4_picks' } },
            { label: 'Bo3 · bans, picks, decider', body: { preset_id: 'bo3_ban_pick' } },
            { label: 'Bo5 · bans, picks, bans, decider', body: { preset_id: 'bo5_ban_pick' } },
            { label: 'Groups (Bo4)', body: { from_stage_key: 'groups' } },
        ])
    })
})

describe('handing over', () => {
    it('lists each side’s roster with who has control, and hands over or gives control back to the captain', () => {
        const lobby = viewAt(asManager(pickBanState()), T0)

        const [crimson, azure] = managerDockOf(lobby, IDLE_MANAGER_PLAY)!.handOver!
        expect(crimson).toMatchObject({ side: 'team_a', ab: 'A', name: 'Crimson Cats' })
        expect(crimson.members.map(({ member, controls, userId }) => [member.display_name, controls, userId])).toEqual([
            ['Ada', true, null],
            ['Ben', false, '1001'],
        ])
        expect(azure.members.map(({ member }) => member.display_name)).toEqual(['Cleo', 'Dex'])

        const handover = { command: 'hand-over', body: { side: 'team_a', user_id: '1001' } } as const
        expect(beginManagerCommand(IDLE_MANAGER_PLAY, lobby, handover)?.request).toEqual(handover)

        const handedOver = viewAt(asManager(asActingCaptain(pickBanState(), 'team_a')), T0)
        expect(managerDockOf(handedOver, IDLE_MANAGER_PLAY)!.handOver![0].members.map(({ controls, userId }) => [controls, userId])).toEqual([
            [false, null],
            [true, '1001'],
        ])

        expect(managerDockOf(viewAt(asManager(completedRun()), T0 + 3_600_000), IDLE_MANAGER_PLAY)?.handOver).toBeNull()
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
        expect(managerDockOf(revealed, settled)?.actFor).toBeNull()
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
        expect(managerDockOf(inLead, afterUndo)?.actFor).toBeNull()
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
        expect(managerDockOf(reLocked, settled)?.actFor).toBeNull()
    })

    it('leaves a manager’s own turn as captain to the captain controls', () => {
        const captain = asCaptain(readAt(started(), AWAITING_A), 'team_a')
        const managingCaptain = { ...captain, capabilities: { ...captain.capabilities, can_manage: true } }

        expect(managerDockOf(viewAt(managingCaptain, AWAITING_A), IDLE_MANAGER_PLAY)?.actFor).toBeNull()
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
            title: 'Restart the pick/ban?',
            message: 'Every ban and pick so far is undone and both teams go back to the lobby. Both Ready marks clear, and any maps this pick/ban wrote into the match are removed.',
            confirmLabel: 'Restart',
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
            title: 'Cancel the pick/ban?',
            message: 'This ends the pick/ban for good. Its bans and picks won’t count, and any maps it wrote into the match are removed. You can open a new lobby afterwards.',
            confirmLabel: 'Cancel pick/ban',
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
