import { describe, expect, it } from 'vitest'
import { ApiError, type StreamSideControls } from '@/app/utils/api'
import { streamSidesErrorFixture, streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import type { StreamMatch } from '../../streamDesk'
import { camSidesView, nextSidesSwappedNotice, sidesSwapErrorMessage } from './camSidesView'

const T01 = '217b72f5-4186-56fd-ab7e-7631df450700'
const T04 = '3c889e6c-37c4-5552-a789-30ff137a5ee8'
const BLOCKED_REASON = 'Finish pick/ban first, or ask an admin.'

function deskMatch(patch: Partial<StreamMatch> = {}): StreamMatch {
    const match = streamSidesFixture('desk').match
    if (!match) throw new Error('the desk fixture has a match')
    return { ...match, ...patch }
}

function flipped(match: StreamMatch): StreamMatch {
    const { a, b } = match.teams
    return { ...match, sides: { a: match.sides.b, b: match.sides.a }, teams: { a: b, b: a } }
}

function controls(can_swap: boolean, blocked_reason: StreamSideControls['blocked_reason']): Partial<StreamMatch> {
    return { side_controls: { can_swap, blocked_reason } }
}

function apiError(name: 'errorPickBanInProgress' | 'errorInvalidSide', status: number): ApiError {
    const body = streamSidesErrorFixture(name)
    return new ApiError(status, body.error, 'Request failed', body.code)
}

describe('camSidesView', () => {
    it('names the Red team from side A and the Blue team from side B', () => {
        const view = camSidesView(deskMatch(controls(true, null)))

        expect(view?.red).toEqual({ id: T01, name: 'T01' })
        expect(view?.blue).toEqual({ id: T04, name: 'T04' })
        expect(camSidesView(flipped(deskMatch()))?.red).toEqual({ id: T04, name: 'T04' })
    })

    it('shows nothing without a match', () => {
        expect(camSidesView(null)).toBeNull()
    })

    it.each([
        { can_swap: true, blocked_reason: null, swap: { disabledReason: null } },
        { can_swap: true, blocked_reason: 'pick_ban_in_progress' as const, swap: { disabledReason: BLOCKED_REASON } },
        { can_swap: false, blocked_reason: null, swap: null },
        { can_swap: false, blocked_reason: 'pick_ban_in_progress' as const, swap: null },
    ])('with can_swap $can_swap and blocked_reason $blocked_reason the swap is $swap', ({ can_swap, blocked_reason, swap }) => {
        const view = camSidesView(deskMatch(controls(can_swap, blocked_reason)))

        if (swap === null) expect(view?.swap).toBeNull()
        else expect(view?.swap).toMatchObject(swap)
    })

    it('still gives a reason for a blocked reason it does not know', () => {
        const blocked = controls(true, 'teams_changed' as StreamSideControls['blocked_reason'])

        expect(camSidesView(deskMatch(blocked))?.swap?.disabledReason).toBe('Swapping Red and Blue is blocked right now. Ask an admin.')
    })

    it('sends the Blue team as the new Red team', () => {
        expect(camSidesView(deskMatch(controls(true, null)))?.swap?.body).toEqual({ red_team_id: T04 })
        expect(camSidesView(flipped(deskMatch(controls(true, null))))?.swap?.body).toEqual({ red_team_id: T01 })
    })

    it('names both teams and their new colours in the confirm dialog', () => {
        const swap = camSidesView(deskMatch(controls(true, null)))?.swap

        expect(swap?.confirmTitle).toBe('Swap Red and Blue?')
        expect(swap?.confirmMessage).toBe('T01 becomes Blue, T04 becomes Red. Everything on stream follows.')
    })

    it('hides the swap while a team is not set', () => {
        const match = deskMatch(controls(true, null))

        expect(camSidesView({ ...match, teams: { ...match.teams, b: null } })?.swap).toBeNull()
        expect(camSidesView({ ...match, teams: { ...match.teams, a: null } })?.red).toBeNull()
    })

    it('says Sides TBC only while the side is not confirmed', () => {
        expect(camSidesView(deskMatch())?.tbc).toBe(false)
        expect(camSidesView(deskMatch({ side_status: { confirmed: false, source: null } }))?.tbc).toBe(true)
    })

    it('hides the swap and says nothing about TBC when the desk does not send the side yet', () => {
        const { side_status: _status, side_controls: _controls, ...older } = deskMatch()
        const view = camSidesView(older as StreamMatch)

        expect(view?.swap).toBeNull()
        expect(view?.tbc).toBe(false)
    })
})

describe('sidesSwapErrorMessage', () => {
    it('words each refusal of the swap', () => {
        expect(sidesSwapErrorMessage(apiError('errorPickBanInProgress', 409))).toBe(BLOCKED_REASON)
        expect(sidesSwapErrorMessage(apiError('errorInvalidSide', 400))).toBe('The teams in this match changed. Check them and try again.')
        expect(sidesSwapErrorMessage(new ApiError(403, 'nope', 'Request failed', 'not_authorized')))
            .toBe("Only this match's streamer, its match admin or a bracket manager can swap Red and Blue.")
    })

    it("falls back to the server's message, then to a generic one", () => {
        expect(sidesSwapErrorMessage(new ApiError(500, 'Database is down', 'Request failed', 'server_error'))).toBe('Database is down')
        expect(sidesSwapErrorMessage('boom')).toBe('Could not swap Red and Blue.')
    })
})

describe('nextSidesSwappedNotice', () => {
    it('says Sides swapped when the mapping of this match flips, naming the new colours', () => {
        const before = deskMatch()

        expect(nextSidesSwappedNotice(null, before, flipped(before))).toEqual({ matchId: before.id, red: 'T04', blue: 'T01' })
    })

    it('says it again when the mapping flips back', () => {
        const before = deskMatch()
        const once = nextSidesSwappedNotice(null, before, flipped(before))

        expect(nextSidesSwappedNotice(once, flipped(before), before)).toEqual({ matchId: before.id, red: 'T01', blue: 'T04' })
    })

    it('keeps the notice while the mapping holds', () => {
        const before = deskMatch()
        const notice = nextSidesSwappedNotice(null, before, flipped(before))
        const later = { ...flipped(before), status: 'live' as const }

        expect(nextSidesSwappedNotice(notice, flipped(before), later)).toBe(notice)
    })

    it('says nothing on the first read, for an unchanged mapping or a confirmation alone', () => {
        const before = deskMatch({ side_status: { confirmed: false, source: null } })

        expect(nextSidesSwappedNotice(null, null, before)).toBeNull()
        expect(nextSidesSwappedNotice(null, before, deskMatch())).toBeNull()
    })

    it('clears the notice when the desk moves to another match', () => {
        const before = deskMatch()
        const notice = nextSidesSwappedNotice(null, before, flipped(before))
        const next = { ...flipped(before), id: 'another-match', sides: before.sides }

        expect(nextSidesSwappedNotice(notice, flipped(before), next)).toBeNull()
        expect(nextSidesSwappedNotice(notice, flipped(before), null)).toBeNull()
    })
})
