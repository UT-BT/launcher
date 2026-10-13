import { describe, expect, it } from 'vitest'
import {
    SIDES_TBC,
    otherSideColor,
    sideColorName,
    sideColorOfLetter,
    sideColorTag,
    sideColorTitle,
    sideColorTone,
    sideLetterOf,
    sideTagOf,
    withSideColor,
    youreSideLabel,
} from './sideLabels'
import { streamSidesFixture } from './fixtures/streamSidesFixtures'

describe('Red/Blue labels', () => {
    it('names each colour for copy and for a tag', () => {
        expect(sideColorName('red')).toBe('Red')
        expect(sideColorName('blue')).toBe('Blue')
        expect(sideColorTag('red')).toBe('RED')
        expect(sideColorTag('blue')).toBe('BLUE')
    })

    it('pairs Red with side A, which acts first, and Blue with side B', () => {
        expect(sideLetterOf('red')).toBe('A')
        expect(sideLetterOf('blue')).toBe('B')
        expect(sideColorOfLetter('A')).toBe('red')
        expect(sideColorOfLetter('B')).toBe('blue')
        expect(otherSideColor('red')).toBe('blue')
        expect(otherSideColor('blue')).toBe('red')
    })

    it('leads with the colour and keeps the letter secondary', () => {
        expect(sideColorTitle('red')).toBe('Red · Side A')
        expect(sideColorTitle('blue')).toBe('Blue · Side B')
    })

    it('keeps the stream tones: Red is the A tone and Blue the B tone', () => {
        expect(sideColorTone('red')).toBe('a')
        expect(sideColorTone('blue')).toBe('b')
    })

    it('tags a team name with its colour, once', () => {
        expect(withSideColor('T04', 'red')).toBe('T04 (Red)')
        expect(withSideColor('T01', 'blue')).toBe('T01 (Blue)')
        expect(withSideColor('Blue', 'blue')).toBe('Blue')
        expect(withSideColor('Decider', null)).toBe('Decider')
    })

    it('says Sides TBC instead of a colour until the side is confirmed', () => {
        expect(sideTagOf('red', true)).toBe('RED')
        expect(sideTagOf('blue', true)).toBe('BLUE')
        expect(sideTagOf('red', false)).toBe(SIDES_TBC)
        expect(sideTagOf(null, true)).toBe(SIDES_TBC)
        expect(SIDES_TBC).toBe('Sides TBC')
    })
})

describe('the player’s own colour', () => {
    it('tells a player which colour to join', () => {
        expect(youreSideLabel('red')).toBe('You’re Red')
        expect(youreSideLabel('blue')).toBe('You’re Blue')
    })

    it('says nothing while the side is unconfirmed or the viewer does not play', () => {
        expect(youreSideLabel(null)).toBeNull()
    })

    it('labels each My Matches card from its side_color: a red player, a blue player, and nothing for the rest', () => {
        const entries = streamSidesFixture('meMatches').items

        expect(entries.map((entry) => [entry.roles, youreSideLabel(entry.side_color)])).toEqual([
            [['player'], 'You’re Red'],
            [['streamer'], null],
            [['player'], 'You’re Blue'],
            [['match_admin'], null],
            [['player'], null],
        ])
    })
})
