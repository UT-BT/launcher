import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, sendPickBanCommand } from '@/app/utils/api'
import { pickBanVetoFixture, pickBanVetoFixtureResponse } from '@/app/utils/fixtures/pickBanVetoFixtures'
import { vetoRejection } from './captainVeto'

afterEach(() => {
    vi.unstubAllGlobals()
})

function refusal(code: string): ApiError {
    return new ApiError(409, 'Server words.', 'Request failed (409)', code)
}

describe('the captain veto command', () => {
    it('posts the choice with the version and answers the pick/ban state', async () => {
        const fetchMock = vi.fn().mockResolvedValue(pickBanVetoFixtureResponse('pickBanVetoSpotlightVetoed'))
        vi.stubGlobal('fetch', fetchMock)

        const next = await sendPickBanCommand('token', 'cup', 'm1', 'veto', { choice: 'veto', version: 5 })

        expect(next).toEqual(pickBanVetoFixture('pickBanVetoSpotlightVetoed'))
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/tournaments\/cup\/matches\/m1\/pick-ban\/veto$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body as string)).toEqual({ choice: 'veto', version: 5 })
    })

    it('words the refusals a contract fixture sends', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pickBanVetoFixtureResponse('errorAlreadyChosen')))

        const error = await sendPickBanCommand('token', 'cup', 'm1', 'veto', { choice: 'play', version: 5 }).catch((e: unknown) => e)

        expect(vetoRejection(error, 'Hard')).toBe('Your team has already made its Hard-map choice.')
    })
})

describe('veto refusals', () => {
    it('words each refusal a captain can meet', () => {
        expect(vetoRejection(refusal('veto_not_open'), 'Hard')).toBe('The Hard-map choice is closed: it has already been decided.')
        expect(vetoRejection(refusal('already_chosen'), 'Hard')).toBe('Your team has already made its Hard-map choice.')
        expect(vetoRejection(refusal('paused'), 'Hard')).toBe('The session is paused. Choose once an admin resumes it.')
        expect(vetoRejection(refusal('version_conflict'), 'Hard')).toBe('The session changed at the same moment. Try again.')
        expect(vetoRejection(refusal('not_authorized'), 'Hard')).toBe('Only an eligible team’s captain can make the Hard-map choice.')
        expect(vetoRejection(refusal('wrong_status'), 'Hard')).toBe('The Picks & Bans aren’t running any more.')
        expect(vetoRejection(refusal('no_session'), 'Hard')).toBe('This match has no Picks & Bans session any more.')
        expect(vetoRejection(refusal('already_chosen'), 'Tricky')).toBe('Your team has already made its Tricky-map choice.')
    })

    it('shows the server’s words for anything else', () => {
        expect(vetoRejection(refusal('something_new'), 'Hard')).toBe('Server words.')
        expect(vetoRejection(new TypeError('Failed to fetch'), 'Hard')).toBe('Couldn’t reach the server. Check your connection and try again.')
    })
})
