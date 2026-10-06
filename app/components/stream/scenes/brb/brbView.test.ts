import { describe, expect, it } from 'vitest'
import { streamDrawnMapScore, streamHotState, streamMatch, streamMaps, streamMapScore, streamScore } from '../../data/streamFixtures'
import { BRB_DEFAULT_MESSAGE, brbView, seriesScoreOf } from './brbView'

const MAPS = streamMaps(['CTF-Face', 'CTF-Coret', 'CTF-Dq', 'CTF-Niven'], ['a', 'b', 'a', 'b'])

describe('brbView', () => {
    it('shows the streamer message', () => {
        const state = streamHotState({ desk: { brb_message: 'Back in five, grabbing water', webcam_enabled: false } })
        expect(brbView(state).message).toBe('Back in five, grabbing water')
    })

    it('trims the message', () => {
        const state = streamHotState({ desk: { brb_message: '  Snack break  ', webcam_enabled: false } })
        expect(brbView(state).message).toBe('Snack break')
    })

    it.each([null, '', '   '])('falls back to the default line for %j', message => {
        const state = streamHotState({ desk: { brb_message: message, webcam_enabled: false } })
        expect(brbView(state).message).toBe(BRB_DEFAULT_MESSAGE)
    })

    it('falls back to the default line without a state', () => {
        expect(brbView(null).message).toBe(BRB_DEFAULT_MESSAGE)
    })

    it('has no score without a match', () => {
        expect(brbView(streamHotState({ reason: 'none', match: null })).score).toBeNull()
    })

    it('carries the series score of the match', () => {
        const score = streamScore([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [0, 2], 'b'), streamMapScore(2, [2, 0], 'a')], { current_map: 3 })
        const match = streamMatch({ maps: MAPS, score })
        expect(brbView(streamHotState({ match })).score).toEqual({
            a: { name: 'Crimson Cats', wins: 2, flags: ['won', 'won', 'open'] },
            b: { name: 'Azure Owls', wins: 1, flags: ['won', 'open', 'open'] },
            caption: 'Series · map 4 · Bo4 · first to 2',
        })
    })
})

describe('seriesScoreOf', () => {
    it('omits the map once the series is won', () => {
        const score = streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [2, 1], 'a')], { winner: 'a' })
        const view = seriesScoreOf(streamMatch({ maps: MAPS, score }))
        expect(view.caption).toBe('Series · Bo4 · first to 2')
        expect(view.a.wins).toBe(2)
    })

    it('numbers the first map 1, never 0', () => {
        expect(seriesScoreOf(streamMatch({ maps: MAPS })).caption).toBe('Series · map 1 · Bo4 · first to 2')
    })

    it('counts the drawn maps and shrinks the pips to what the race still needs', () => {
        const score = streamScore([streamMapScore(0, [2, 0], 'a'), streamDrawnMapScore(1), streamMapScore(2), streamMapScore(3)])
        const view = seriesScoreOf(streamMatch({ maps: MAPS, score }))
        expect(view.caption).toBe('Series · map 3 · 1 map drawn · Bo4 · first to 2')
        expect(view.a.flags).toEqual(['won', 'open'])
    })

    it('reads a decided series without a winner as drawn', () => {
        const score = streamScore(
            [streamMapScore(0, [2, 0], 'a'), streamDrawnMapScore(1), streamMapScore(2, [0, 2], 'b'), streamDrawnMapScore(3, [0, 0])],
            { live_decided: true, series_state: 'drawn' },
        )
        expect(seriesScoreOf(streamMatch({ maps: MAPS, score })).caption).toBe('Series drawn · 2 maps drawn · Bo4 · first to 2')
    })

    it('reads a level knockout with no map left as level, not drawn', () => {
        const score = streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [0, 2], 'b'), streamDrawnMapScore(2)], { series_state: 'unresolved' })
        const view = seriesScoreOf(streamMatch({ best_of: 3, maps: MAPS.slice(0, 3), stage: { key: 'playoffs', name: 'Playoffs' }, score }))
        expect(view.caption).toBe('Series level · 1 map drawn · Bo3 · first to 2')
    })

    it('names an open team slot', () => {
        const match = streamMatch({ teams: { a: null, b: null } })
        expect(seriesScoreOf(match).a.name).toBe('Team A')
        expect(seriesScoreOf(match).b.name).toBe('Team B')
    })
})
