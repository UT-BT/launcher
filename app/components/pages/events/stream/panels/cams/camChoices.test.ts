import { describe, expect, it } from 'vitest'
import { streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import type { StreamMatch } from '../../streamDesk'
import {
    NO_STORED_CAM_PASSWORDS,
    NO_STORED_CAM_SERVERS,
    camTeamIds,
    readCamPasswords,
    readCamServerChoices,
    storeCamPassword,
    storeCamServerChoice,
} from './camChoices'
import { DETECTED_CHOICES, NO_PASSWORDS } from './camToolView'

const RED_FIRST = '217b72f5-4186-56fd-ab7e-7631df450700'
const BLUE_FIRST = '3c889e6c-37c4-5552-a789-30ff137a5ee8'

function deskMatch(): StreamMatch {
    const match = streamSidesFixture('desk').match
    if (!match) throw new Error('the desk fixture has a match')
    return match
}

function flipped(match: StreamMatch): StreamMatch {
    const { a, b } = match.teams
    return { ...match, sides: { a: match.sides.b, b: match.sides.a }, teams: { a: b, b: a } }
}

describe('camTeamIds', () => {
    it('maps each stream letter to its team through the sides mapping', () => {
        const match = deskMatch()

        expect(camTeamIds(match)).toEqual({ A: RED_FIRST, B: BLUE_FIRST })
        expect(camTeamIds(flipped(match))).toEqual({ A: BLUE_FIRST, B: RED_FIRST })
    })

    it('has no team for a letter whose team is not set yet, or without a match', () => {
        const match = deskMatch()

        expect(camTeamIds({ ...match, teams: { ...match.teams, b: null } })).toEqual({ A: RED_FIRST, B: null })
        expect(camTeamIds(null)).toEqual({ A: null, B: null })
    })
})

describe('cam server choices', () => {
    it('reads detection for both letters when nothing is stored', () => {
        expect(readCamServerChoices(NO_STORED_CAM_SERVERS, deskMatch())).toEqual(DETECTED_CHOICES)
    })

    it("keeps a server chosen for a team with that team after Red and Blue swap", () => {
        const match = deskMatch()
        const stored = storeCamServerChoice(NO_STORED_CAM_SERVERS, match, 'A', { mode: 'list', address: '203.0.113.10:7777' })

        expect(readCamServerChoices(stored, match)).toEqual({ A: { mode: 'list', address: '203.0.113.10:7777' }, B: { mode: 'detected' } })
        expect(readCamServerChoices(stored, flipped(match))).toEqual({ A: { mode: 'detected' }, B: { mode: 'list', address: '203.0.113.10:7777' } })
    })

    it('keeps the other team\'s choice when one team changes', () => {
        const match = deskMatch()
        const first = storeCamServerChoice(NO_STORED_CAM_SERVERS, match, 'A', { mode: 'typed', address: 'bt.example.net:7790' })
        const second = storeCamServerChoice(first, flipped(match), 'A', { mode: 'list', address: '203.0.113.20:7788' })

        expect(readCamServerChoices(second, match)).toEqual({
            A: { mode: 'typed', address: 'bt.example.net:7790' },
            B: { mode: 'list', address: '203.0.113.20:7788' },
        })
    })

    it('starts from detection again for another match', () => {
        const match = deskMatch()
        const stored = storeCamServerChoice(NO_STORED_CAM_SERVERS, match, 'A', { mode: 'list', address: '203.0.113.10:7777' })
        const next = { ...match, id: 'another-match' }

        expect(readCamServerChoices(stored, next)).toEqual(DETECTED_CHOICES)
        expect(readCamServerChoices(storeCamServerChoice(stored, next, 'B', { mode: 'detected' }), match)).toEqual(DETECTED_CHOICES)
    })

    it('drops letter-keyed choices stored before choices followed the team', () => {
        const match = deskMatch()
        const legacy = { matchId: match.id, choices: { A: { mode: 'list', address: '203.0.113.10:7777' }, B: { mode: 'typed', address: 'bt.example.net:7790' } } }
        const letterKeyed = { matchId: match.id, teams: { A: { mode: 'list', address: '203.0.113.10:7777' } } }

        expect(readCamServerChoices(legacy, match)).toEqual(DETECTED_CHOICES)
        expect(readCamServerChoices(letterKeyed, match)).toEqual(DETECTED_CHOICES)
        expect(storeCamServerChoice(legacy, match, 'B', { mode: 'detected' })).toEqual({ matchId: match.id, teams: { [BLUE_FIRST]: { mode: 'detected' } } })
    })

    it('ignores stored values that are not choices', () => {
        const match = deskMatch()
        const broken = { matchId: match.id, teams: { [RED_FIRST]: { mode: 'list' }, [BLUE_FIRST]: 'detected' } }

        expect(readCamServerChoices(broken, match)).toEqual(DETECTED_CHOICES)
        expect(readCamServerChoices(null, match)).toEqual(DETECTED_CHOICES)
        expect(readCamServerChoices('A', match)).toEqual(DETECTED_CHOICES)
    })

    it('stores nothing for a letter with no team yet', () => {
        const match = deskMatch()
        const noTeamB = { ...match, teams: { ...match.teams, b: null } }

        expect(storeCamServerChoice(NO_STORED_CAM_SERVERS, noTeamB, 'B', { mode: 'list', address: '203.0.113.10:7777' })).toEqual({ matchId: match.id, teams: {} })
        expect(readCamServerChoices(NO_STORED_CAM_SERVERS, null)).toEqual(DETECTED_CHOICES)
    })
})

describe('cam server passwords', () => {
    it('reads empty passwords when nothing is stored', () => {
        expect(readCamPasswords(NO_STORED_CAM_PASSWORDS, deskMatch())).toEqual(NO_PASSWORDS)
    })

    it("keeps a team's password with that team after Red and Blue swap", () => {
        const match = deskMatch()
        const stored = storeCamPassword(NO_STORED_CAM_PASSWORDS, match, 'B', 'azure')

        expect(readCamPasswords(stored, match)).toEqual({ A: '', B: 'azure' })
        expect(readCamPasswords(stored, flipped(match))).toEqual({ A: 'azure', B: '' })
    })

    it("keeps a team's password into its next match", () => {
        const match = deskMatch()
        const stored = storeCamPassword(NO_STORED_CAM_PASSWORDS, match, 'A', 'cup2026')

        expect(readCamPasswords(stored, { ...match, id: 'another-match' })).toEqual({ A: 'cup2026', B: '' })
    })

    it('drops letter-keyed passwords stored before passwords followed the team', () => {
        const match = deskMatch()
        const legacy = { A: 'cup2026', B: 'azure' }

        expect(readCamPasswords(legacy, match)).toEqual(NO_PASSWORDS)
        expect(readCamPasswords({ teams: legacy }, match)).toEqual(NO_PASSWORDS)
        expect(storeCamPassword(legacy, match, 'A', 'crimson')).toEqual({ teams: { [RED_FIRST]: 'crimson' } })
    })

    it('stores nothing for a letter with no team yet', () => {
        const match = deskMatch()

        expect(storeCamPassword(NO_STORED_CAM_PASSWORDS, { ...match, teams: { ...match.teams, a: null } }, 'A', 'x')).toEqual(NO_STORED_CAM_PASSWORDS)
    })
})
