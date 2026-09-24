import { describe, expect, it } from 'vitest'
import { ApiError, type PickBanState } from '@/app/utils/api'
import { buildPickBanView, type PickBanView } from './pickBanView'
import {
    IDLE_CAPTAIN_PLAY,
    beginLock,
    beginReadyToggle,
    captainDockOf,
    commandRejected,
    commandSucceeded,
    dismissRejection,
    selectMap,
    withCaptainPlay,
} from './captainPlay'
import {
    BAN_DOWN_SPOTLIGHT_MS,
    ELIGIBLE_MAPS,
    INTRO_MS,
    LEAD_MS,
    SPOTLIGHT_MS,
    T0,
    asActingCaptain,
    asCaptain,
    asManager,
    asReplacedCaptain,
    asSpectator,
    asTeammate,
    locked,
    lockedInTurn,
    paused,
    pickBanState,
    readAt,
    resumed,
    started,
    unlockAt,
} from './pickBanFixtures'

const [ALPHA, BRAVO, , , , FOXTROT] = ELIGIBLE_MAPS
const INTRO_END = T0 + LEAD_MS + INTRO_MS
const AWAITING_A = INTRO_END + 1_000

function viewAt(state: PickBanState, serverTime: number): PickBanView {
    return buildPickBanView(state, { clockOffsetMs: 0, now: serverTime })
}

function captainAView(): PickBanView {
    return viewAt(asCaptain(readAt(started(), AWAITING_A), 'team_a'), AWAITING_A)
}

describe('selecting a map', () => {
    it('marks the chosen card selected on the viewer’s own turn and offers Lock in', () => {
        const view = captainAView()

        const play = selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO)
        const played = withCaptainPlay(view, play)

        expect(played.cards.filter((card) => card.selected).map((card) => card.map)).toEqual([BRAVO])
        expect(captainDockOf(view, play)?.controls).toMatchObject({ kind: 'choose', action: 'ban', selectedMap: BRAVO, canLockIn: true })
        expect(captainDockOf(view, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({ kind: 'choose', selectedMap: null, canLockIn: false })
        expect(withCaptainPlay(view, selectMap(play, view, ALPHA)).cards.filter((card) => card.selected).map((card) => card.map)).toEqual([ALPHA])
    })
})

describe('locking in', () => {
    it('shows Locked in at once, before the command answers, and asks for the awaited plan index', () => {
        const view = captainAView()

        const submission = beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)
        expect(submission).toMatchObject({ command: 'lock', body: { map: BRAVO, plan_index: 0 } })

        const played = withCaptainPlay(view, submission!.play)
        expect(played.cards.filter((card) => card.lockedIn).map((card) => card.map)).toEqual([BRAVO])
        expect(played.cards.some((card) => card.selectable || card.selected)).toBe(false)
        expect(played.turn).toMatchObject({ stepIndex: 0, lockedIn: true })
        expect(played.timeline[0].status).toBe('locked_in')
        expect(played.affordances.canLock).toBe(false)
        expect(captainDockOf(view, submission!.play)?.controls).toEqual({ kind: 'locked_in', map: BRAVO })
    })

    it('refuses a second submission while the first is in flight, and a lock-in with nothing selected', () => {
        const view = captainAView()
        const first = beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)

        expect(beginLock(first!.play, view)).toBeNull()
        expect(beginLock(IDLE_CAPTAIN_PLAY, view)).toBeNull()
    })

    it('hands over to the returned state once the command answers, which keeps the step Locked in until its reveal', () => {
        const awaiting = asCaptain(readAt(started(), AWAITING_A), 'team_a')
        const view = viewAt(awaiting, AWAITING_A)
        const settled = commandSucceeded(beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)!.play)
        const answered = asCaptain(locked(awaiting, BRAVO, AWAITING_A + 200), 'team_a')

        const inLead = viewAt(answered, AWAITING_A + 400)
        expect(captainDockOf(inLead, settled)?.controls).toEqual({ kind: 'locked_in', map: BRAVO })
        expect(withCaptainPlay(inLead, settled).cards.filter((card) => card.lockedIn).map((card) => card.map)).toEqual([BRAVO])

        const revealed = withCaptainPlay(viewAt(answered, AWAITING_A + 200 + LEAD_MS), settled)
        expect(revealed.cards.find((card) => card.map === BRAVO)).toMatchObject({ state: 'banned', lockedIn: false })
    })

    it('drops Locked in and explains why when the lock-in is refused, keeping the selection to try again', () => {
        const view = captainAView()
        const submission = beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)!

        const refused = commandRejected(submission.play, new ApiError(409, 'Version mismatch', 'Request failed', 'version_conflict'))

        const dock = captainDockOf(view, refused)
        expect(withCaptainPlay(view, refused).cards.some((card) => card.lockedIn)).toBe(false)
        expect(dock?.controls).toEqual({ kind: 'choose', action: 'ban', mapNumber: null, selectedMap: BRAVO, canLockIn: true })
        expect(dock?.rejection).toBe(
            'Your lock-in didn’t count: the session changed just before it arrived. Check the board and lock in again if it’s still your turn.',
        )
        expect(beginLock(refused, view)).not.toBeNull()
    })

    it('shows the loser of a race with an admin’s act-for the one step that counted, with the reason theirs didn’t', () => {
        const awaiting = asCaptain(readAt(started(), AWAITING_A), 'team_a')
        const view = viewAt(awaiting, AWAITING_A)
        const submission = beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)!
        const refused = commandRejected(submission.play, new ApiError(409, undefined, 'Request failed', 'not_your_turn'))
        const refreshed = viewAt(asCaptain(locked(awaiting, ALPHA, AWAITING_A + 100, { byAdmin: true }), 'team_a'), AWAITING_A + 600)

        expect(withCaptainPlay(refreshed, refused).cards.filter((card) => card.lockedIn).map((card) => card.map)).toEqual([ALPHA])
        expect(captainDockOf(refreshed, refused)?.controls).toEqual({ kind: 'locked_in', map: ALPHA })
        expect(captainDockOf(refreshed, refused)?.rejection).toBe('Your lock-in didn’t count: it isn’t your team’s turn any more.')
    })
})

describe('locked controls', () => {
    const FIRST_LOCK = INTRO_END + 2_000
    const REVEAL = FIRST_LOCK + LEAD_MS
    const firstBan = () => locked(started(), ALPHA, FIRST_LOCK)

    it('locks the first captain out through the intro, counting down to the moment they can act', () => {
        const view = viewAt(asCaptain(started(), 'team_a'), T0 + LEAD_MS + 1_000)

        expect(captainDockOf(view, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({
            kind: 'locked',
            reason: 'intro',
            countdown: { endsAt: INTRO_END, remainingMs: INTRO_MS - 1_000, totalMs: INTRO_MS, frozen: false },
            next: { stepIndex: 0, viewerActs: true, action: 'ban' },
        })
        expect(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO)).toBe(IDLE_CAPTAIN_PLAY)
    })

    it('locks both captains through a spotlight, telling each whether they act next', () => {
        const next = viewAt(asCaptain(firstBan(), 'team_b'), REVEAL + 1_000)
        const previous = viewAt(asCaptain(firstBan(), 'team_a'), REVEAL + 1_000)
        const countdown = { endsAt: REVEAL + SPOTLIGHT_MS, remainingMs: SPOTLIGHT_MS - 1_000, totalMs: SPOTLIGHT_MS, frozen: false }

        expect(captainDockOf(next, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({
            kind: 'locked', reason: 'spotlight', countdown, next: { stepIndex: 1, viewerActs: true },
        })
        expect(captainDockOf(previous, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({
            kind: 'locked', reason: 'spotlight', countdown, next: { stepIndex: 1, viewerActs: false, actionLabel: 'Azure Owls bans' },
        })
        expect(selectMap(IDLE_CAPTAIN_PLAY, next, BRAVO)).toBe(IDLE_CAPTAIN_PLAY)
    })

    it('locks the controls while paused, with the countdown frozen where the pause caught it', () => {
        const duringSpotlight = viewAt(asCaptain(paused(firstBan(), REVEAL + 3_000), 'team_b'), REVEAL + 60_000)
        const whileAwaiting = viewAt(asCaptain(paused(readAt(started(), AWAITING_A), AWAITING_A), 'team_a'), AWAITING_A + 60_000)

        expect(captainDockOf(duringSpotlight, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({
            kind: 'locked', reason: 'paused', countdown: { endsAt: null, remainingMs: SPOTLIGHT_MS - 3_000, frozen: true },
        })
        expect(captainDockOf(whileAwaiting, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({
            kind: 'locked', reason: 'paused', countdown: null, next: { stepIndex: 0, viewerActs: true },
        })
        expect(selectMap(IDLE_CAPTAIN_PLAY, whileAwaiting, BRAVO)).toBe(IDLE_CAPTAIN_PLAY)
    })

    it('keeps a selection made before a pause for when play resumes', () => {
        const awaiting = readAt(started(), AWAITING_A)
        const view = viewAt(asCaptain(awaiting, 'team_a'), AWAITING_A)
        const play = selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO)
        const pausedView = viewAt(asCaptain(paused(awaiting, AWAITING_A + 500), 'team_a'), AWAITING_A + 1_000)
        const resumedView = viewAt(asCaptain(resumed(paused(awaiting, AWAITING_A + 500), AWAITING_A + 30_000), 'team_a'), AWAITING_A + 31_000)

        expect(withCaptainPlay(pausedView, play).cards.some((card) => card.selected)).toBe(false)
        expect(beginLock(play, pausedView)).toBeNull()
        expect(captainDockOf(resumedView, play)?.controls).toMatchObject({ kind: 'choose', selectedMap: BRAVO, canLockIn: true })
    })

    it('shows the other captain whose turn it is instead of any control', () => {
        const view = viewAt(asCaptain(readAt(started(), AWAITING_A), 'team_b'), AWAITING_A)

        expect(captainDockOf(view, IDLE_CAPTAIN_PLAY)?.controls).toMatchObject({
            kind: 'waiting', turn: { stepIndex: 0, viewerActs: false, actionLabel: 'Crimson Cats bans' },
        })
        expect(view.cards.some((card) => card.selectable)).toBe(false)
        expect(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO)).toBe(IDLE_CAPTAIN_PLAY)
    })
})

describe('who gets controls', () => {
    const moments: [string, PickBanState, number][] = [
        ['lobby', pickBanState(), T0],
        ['intro', started(), T0 + LEAD_MS + 1_000],
        ['awaiting', readAt(started(), AWAITING_A), AWAITING_A],
        ['spotlight', locked(started(), ALPHA, AWAITING_A), AWAITING_A + LEAD_MS + 1_000],
        ['paused', paused(readAt(started(), AWAITING_A), AWAITING_A), AWAITING_A + 5_000],
    ]

    it.each(moments)('gives a spectator, a teammate, a replaced captain and a manager no captain controls in the %s', (_moment, state, serverTime) => {
        for (const viewer of [asSpectator(state), asTeammate(state, 'team_a'), asReplacedCaptain(state, 'team_a'), asManager(state)]) {
            const view = viewAt(viewer, serverTime)
            expect(captainDockOf(view, IDLE_CAPTAIN_PLAY)).toBeNull()
            expect(captainDockOf(view, selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO))).toBeNull()
            expect(beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)).toBeNull()
        }
    })

    it.each(moments)('gives an acting captain the captain’s controls in the %s', (_moment, state, serverTime) => {
        const captain = captainDockOf(viewAt(asCaptain(state, 'team_a'), serverTime), IDLE_CAPTAIN_PLAY)
        const acting = captainDockOf(viewAt(asActingCaptain(state, 'team_a'), serverTime), IDLE_CAPTAIN_PLAY)

        expect(captain?.controls).toBeTruthy()
        expect(acting).toEqual(captain)
    })

    it('lets an acting captain select and lock in on their side’s turn', () => {
        const view = viewAt(asActingCaptain(readAt(started(), AWAITING_A), 'team_a'), AWAITING_A)

        expect(beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)?.body).toEqual({ map: BRAVO, plan_index: 0 })
    })

    it('drops the controls once the last step is in, keeping only the actor’s Locked in until it reveals', () => {
        const before = lockedInTurn(started(), ELIGIBLE_MAPS.slice(0, 5))
        const finalLock = unlockAt(before) + 2_000
        const state = locked(before, FOXTROT, finalLock)
        const banReveal = finalLock + LEAD_MS

        const dockAt = (side: 'team_a' | 'team_b', serverTime: number) => captainDockOf(viewAt(asCaptain(state, side), serverTime), IDLE_CAPTAIN_PLAY)

        expect(dockAt('team_a', finalLock + 500)?.controls).toEqual({ kind: 'locked_in', map: FOXTROT })
        expect(dockAt('team_b', finalLock + 500)).toBeNull()
        for (const serverTime of [banReveal + 500, banReveal + BAN_DOWN_SPOTLIGHT_MS + 500]) {
            expect(dockAt('team_a', serverTime)).toBeNull()
            expect(dockAt('team_b', serverTime)).toBeNull()
        }
    })

    it('shows no controls once the pick/ban is over', () => {
        const cancelled = pickBanState({ status: 'cancelled', phase: 'cancelled', end_reason: 'Postponed.' })
        const complete = lockedInTurn(started(), [ALPHA, BRAVO, ...ELIGIBLE_MAPS.slice(2, 6)])

        expect(captainDockOf(viewAt(asCaptain(cancelled, 'team_a'), T0), IDLE_CAPTAIN_PLAY)).toBeNull()
        expect(captainDockOf(viewAt(asCaptain(complete, 'team_a'), T0 + 3_600_000), IDLE_CAPTAIN_PLAY)).toBeNull()
    })
})

describe('ready toggle', () => {
    const readyA = { team_a: { id: '1000', display_name: 'Ada', at: '2026-09-26T19:55:00+00:00' }, team_b: null }

    it('offers Ready to a captain whose side isn’t ready, and Unready once it is', () => {
        const notReady = viewAt(asCaptain(pickBanState(), 'team_a'), T0)
        const ready = viewAt(asCaptain(pickBanState({ ready: readyA }), 'team_a'), T0)

        expect(captainDockOf(notReady, IDLE_CAPTAIN_PLAY)?.controls).toEqual({ kind: 'ready', ready: false, busy: false })
        expect(beginReadyToggle(IDLE_CAPTAIN_PLAY, notReady)).toMatchObject({ command: 'ready', body: {} })
        expect(captainDockOf(ready, IDLE_CAPTAIN_PLAY)?.controls).toEqual({ kind: 'ready', ready: true, busy: false })
        expect(beginReadyToggle(IDLE_CAPTAIN_PLAY, ready)).toMatchObject({ command: 'unready', body: {} })
    })

    it('holds the toggle while the command is in flight, and frees it once it answers', () => {
        const view = viewAt(asCaptain(pickBanState(), 'team_a'), T0)
        const submission = beginReadyToggle(IDLE_CAPTAIN_PLAY, view)!

        expect(captainDockOf(view, submission.play)?.controls).toEqual({ kind: 'ready', ready: false, busy: true })
        expect(beginReadyToggle(submission.play, view)).toBeNull()

        const answered = viewAt(asCaptain(pickBanState({ ready: readyA, version: 2 }), 'team_a'), T0)
        expect(captainDockOf(answered, commandSucceeded(submission.play))?.controls).toEqual({ kind: 'ready', ready: true, busy: false })
    })

    it('explains a refused toggle in lobby terms', () => {
        const view = viewAt(asCaptain(pickBanState(), 'team_a'), T0)
        const submission = beginReadyToggle(IDLE_CAPTAIN_PLAY, view)!

        const raced = commandRejected(submission.play, new ApiError(409, undefined, 'Request failed', 'version_conflict'))
        const started = commandRejected(submission.play, new ApiError(409, undefined, 'Request failed', 'wrong_status'))

        expect(captainDockOf(view, raced)).toEqual({
            controls: { kind: 'ready', ready: false, busy: false },
            rejection: 'The lobby changed at the same moment. Try again.',
        })
        expect(captainDockOf(view, started)?.rejection).toBe('The pick/ban has already started, so Ready no longer applies.')
    })

    it('gives no toggle to anyone without control of a side', () => {
        const state = pickBanState()

        for (const viewer of [asSpectator(state), asTeammate(state, 'team_a'), asReplacedCaptain(state, 'team_a'), asManager(state)]) {
            expect(beginReadyToggle(IDLE_CAPTAIN_PLAY, viewAt(viewer, T0))).toBeNull()
        }
    })

    it('locks the controls for the moment between Start and the intro', () => {
        const view = viewAt(asCaptain(started(), 'team_a'), T0 + 500)

        expect(view.stagePhase).toBe('lobby')
        expect(captainDockOf(view, IDLE_CAPTAIN_PLAY)?.controls).toEqual({ kind: 'locked', reason: 'intro', countdown: null, next: null })
        expect(beginReadyToggle(IDLE_CAPTAIN_PLAY, view)).toBeNull()
    })
})

describe('refusals', () => {
    const lockRefusal = (error: unknown) => {
        const view = captainAView()
        const submission = beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)!
        return captainDockOf(view, commandRejected(submission.play, error))?.rejection
    }
    const refusal = (status: number, code: string, message?: string) => new ApiError(status, message, 'Request failed', code)

    it.each([
        ['map_unavailable', 409, 'That map can’t be chosen any more. Select another.'],
        ['spotlight_active', 409, 'Wait for the reveal to finish, then lock in.'],
        ['intro_active', 409, 'Wait for the intro to finish, then lock in.'],
        ['paused', 409, 'The session is paused. Lock in once an admin resumes it.'],
        ['wrong_status', 409, 'The pick/ban isn’t running any more.'],
        ['not_authorized', 403, 'You no longer control your team’s choices in this pick/ban.'],
        ['no_session', 409, 'This match has no pick/ban session any more.'],
    ])('explains a lock-in refused with %s', (code, status, message) => {
        expect(lockRefusal(refusal(status, code))).toBe(message)
    })

    it('falls back to the server’s own words for a refusal it has no wording for', () => {
        expect(lockRefusal(refusal(422, 'invalid_request', 'plan_index must match the current step.'))).toBe('plan_index must match the current step.')
        expect(lockRefusal(refusal(500, 'boom', 'Internal error.'))).toBe('Internal error.')
    })

    it('says so when the server couldn’t be reached', () => {
        expect(lockRefusal(new TypeError('Failed to fetch'))).toBe('Couldn’t reach the server. Check your connection and try again.')
    })

    it('clears the message once the captain acts again', () => {
        const view = captainAView()
        const refused = commandRejected(beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)!.play, refusal(409, 'map_unavailable'))

        expect(captainDockOf(view, selectMap(refused, view, ALPHA))?.rejection).toBeNull()
        expect(captainDockOf(view, beginLock(refused, view)!.play)?.rejection).toBeNull()
        expect(captainDockOf(view, dismissRejection(refused))?.rejection).toBeNull()
    })

    it('keeps the message on screen after the refresh takes the viewer’s controls away', () => {
        const view = captainAView()
        const refused = commandRejected(beginLock(selectMap(IDLE_CAPTAIN_PLAY, view, BRAVO), view)!.play, refusal(403, 'not_authorized'))
        const replaced = viewAt(asReplacedCaptain(readAt(started(), AWAITING_A), 'team_a'), AWAITING_A + 1_000)

        expect(captainDockOf(replaced, refused)).toEqual({
            controls: null,
            rejection: 'You no longer control your team’s choices in this pick/ban.',
        })
        expect(captainDockOf(replaced, dismissRejection(refused))).toBeNull()
    })
})
