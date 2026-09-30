import { describe, expect, it } from 'vitest'
import { streamMapScore, streamScore } from '../../data/streamFixtures'
import {
    bracketConsequence,
    decidedMatch,
    groupConsequence,
    inProgressMatch,
    nextMatch,
    officialMatch,
    officialRead,
    postMatchRead,
    swissConsequence,
} from './postMatchFixtures'
import { isMatchFinished, postMatchView, type PostMatchView } from './postMatchView'

function resultOf(view: PostMatchView) {
    if (view.phase !== 'result') throw new Error(`expected a result, got ${view.phase}`)
    return view
}

describe('postMatchView', () => {
    it('shows the live-decided winner, series and caps per map as unofficial', () => {
        const view = resultOf(postMatchView(decidedMatch(), null))

        expect(view.official).toBe(false)
        expect(view.winner).toBe('a')
        expect(view.teams).toEqual({ a: 'Crimson Cats', b: 'Azure Owls' })
        expect(view.series).toEqual({ a: 3, b: 1 })
        expect(view.maps.map(map => [map.number, map.map, map.pickedBy, map.caps.a, map.caps.b, map.winner])).toEqual([
            [1, 'CTF-BT-II-Synchronize-VF2', 'a', 2, 1, 'a'],
            [2, 'CTF-BT-II-MountainBase', 'b', 0, 2, 'b'],
            [3, 'CTF-BT-II-FuriumMineCE2', 'b', 2, 1, 'a'],
            [4, 'CTF-BT-II-FaithCB', 'a', 2, 0, 'a'],
        ])
        expect(view.consequence).toEqual([])
    })

    it('stays unofficial while the read says the result is not official yet', () => {
        const view = resultOf(postMatchView(decidedMatch(), postMatchRead({ official: false })))

        expect(view.official).toBe(false)
        expect(view.consequence).toEqual([])
    })

    it('drops the marker and shows the consequence once the official result is in', () => {
        const view = resultOf(postMatchView(officialMatch(), officialRead(groupConsequence())))

        expect(view.official).toBe(true)
        expect(view.consequence).toEqual([
            { side: 'a', team: 'Crimson Cats', text: '2nd in Group B on 10 pts' },
            { side: 'b', team: 'Azure Owls', text: '3rd in Group B on 6 pts' },
        ])
    })

    it('takes the caps from the official score once it replaces the live count', () => {
        const scores = [
            streamMapScore(0, [2, 0], 'a'),
            streamMapScore(1, [0, 2], 'b'),
            streamMapScore(2, [2, 0], 'a'),
            streamMapScore(3, [2, 1], 'a'),
        ]
        const match = officialMatch({ score: streamScore(scores, { winner: 'a', live_decided: true, current_map: null }) })
        const view = resultOf(postMatchView(match, officialRead()))

        expect(view.maps.map(map => [map.caps.a, map.caps.b])).toEqual([[2, 0], [0, 2], [2, 0], [2, 1]])
    })

    it('hides the consequence before the official result, even when the read carries one', () => {
        const view = resultOf(postMatchView(decidedMatch(), postMatchRead({ official: false, consequence: groupConsequence() })))

        expect(view.official).toBe(false)
        expect(view.consequence).toEqual([])
    })

    it('marks a finished match official before the read catches up, without a consequence yet', () => {
        const view = resultOf(postMatchView(officialMatch(), postMatchRead({ official: false })))

        expect(view.official).toBe(true)
        expect(view.consequence).toEqual([])
    })

    it('ignores a read for another match', () => {
        const view = resultOf(postMatchView(decidedMatch(), officialRead(groupConsequence(), { match_id: 'match-2' })))

        expect(view.official).toBe(false)
        expect(view.consequence).toEqual([])
    })

    it('shows an all_maps draw as a decided result with no winner', () => {
        const scores = [
            streamMapScore(0, [2, 1], 'a', { source: 'live' }),
            streamMapScore(1, [0, 2], 'b', { source: 'live' }),
        ]
        const match = decidedMatch({
            mode: 'all_maps',
            best_of: 2,
            maps: decidedMatch().maps.slice(0, 2),
            score: streamScore(scores, { winner: null, live_decided: true, current_map: null }),
        })
        const view = resultOf(postMatchView(match, officialRead(groupConsequence(null))))

        expect(view.winner).toBeNull()
        expect(view.series).toEqual({ a: 1, b: 1 })
        expect(view.maps).toHaveLength(2)
        expect(view.consequence.map(line => line.text)).toEqual(['2nd in Group B on 10 pts', '3rd in Group B on 6 pts'])
    })

    it('leaves the dead rubbers of a first_to series out of the result', () => {
        const scores = [
            streamMapScore(0, [2, 0], 'a', { source: 'live' }),
            streamMapScore(1, [2, 1], 'a', { source: 'live' }),
            streamMapScore(2, [2, 0], 'a', { source: 'live' }),
            streamMapScore(3),
        ]
        const view = resultOf(postMatchView(decidedMatch({ score: streamScore(scores, { winner: 'a', live_decided: true, current_map: null }) }), null))

        expect(view.series).toEqual({ a: 3, b: 0 })
        expect(view.maps.map(map => map.number)).toEqual([1, 2, 3])
    })

    it('shows a neutral in-progress state until the match is decided', () => {
        const view = postMatchView(inProgressMatch(), officialRead())

        expect(view.phase).toBe('in-progress')
        expect(view.series).toEqual({ a: 1, b: 1 })
        expect(view.maps.map(map => [map.number, map.state, map.caps.a, map.caps.b])).toEqual([
            [1, 'decided', 2, 1],
            [2, 'decided', 0, 2],
            [3, 'live', 1, 1],
            [4, 'upcoming', 0, 0],
        ])
    })

    it('numbers each map from its 0-based ordinal, not its place in the list', () => {
        const view = postMatchView(inProgressMatch({ score: streamScore([streamMapScore(2, [1, 1]), streamMapScore(3)], { current_map: 2 }) }), null)

        expect(view.maps.map(map => [map.ordinal, map.number, map.state])).toEqual([[2, 3, 'live'], [3, 4, 'upcoming']])
    })

    it('keeps a map without a picked map name', () => {
        const view = postMatchView(inProgressMatch({ maps: decidedMatch().maps.slice(0, 3) }), null)

        expect(view.maps[3]).toMatchObject({ number: 4, map: null, pickedBy: null })
    })

    it('falls back to side names when a team is missing', () => {
        const view = resultOf(postMatchView(decidedMatch({ teams: { a: null, b: null } }), null))

        expect(view.teams).toEqual({ a: 'Team A', b: 'Team B' })
    })
})

describe('the consequence line', () => {
    const playoffs = { key: 'playoffs', name: 'Playoff Stage' }

    function linesOf(consequence: Parameters<typeof officialRead>[0], match = officialMatch()) {
        return resultOf(postMatchView(match, officialRead(consequence))).consequence.map(line => `${line.side}: ${line.text}`)
    }

    it('says where the bracket winner advances to, and that the loser is out', () => {
        const match = officialMatch({ stage: playoffs, group: null, round: { no: 1, label: 'Quarter-final' } })

        expect(linesOf(bracketConsequence({ next_match: nextMatch(playoffs, 'Semi-final') }, {}), match)).toEqual([
            'a: Advances to the Semi-final',
            'b: Eliminated',
        ])
    })

    it('names the stage when the next match is in another stage', () => {
        const finals = { key: 'finals', name: 'Final Stage' }

        expect(linesOf(bracketConsequence({ next_match: nextMatch(finals, 'Round 1') }, {}))).toEqual([
            'a: Advances to the Final Stage · Round 1',
            'b: Eliminated',
        ])
    })

    it('sends a semi-final loser to the third-place match', () => {
        const match = officialMatch({ stage: playoffs, group: null, round: { no: 2, label: 'Semi-final' } })
        const consequence = bracketConsequence(
            { next_match: nextMatch(playoffs, 'Final') },
            { outcome: 'next_match', next_match: nextMatch(playoffs, '3rd Place Match') },
        )

        expect(linesOf(consequence, match)).toEqual(['a: Advances to the Final', 'b: Drops to the 3rd Place Match'])
    })

    it('keeps an unpublished next match vague', () => {
        expect(linesOf(bracketConsequence({ next_match: null }, { outcome: 'next_match', next_match: null }))).toEqual([
            'a: Advances to the next round',
            'b: Plays on in the next round',
        ])
    })

    it('crowns the winner of a final', () => {
        const match = officialMatch({ stage: playoffs, group: null, round: { no: 3, label: 'Grand Final' } })

        expect(linesOf(bracketConsequence({ outcome: 'finished' }, {}), match)).toEqual(['a: Wins the Grand Final', 'b: Eliminated'])
    })

    it('falls back to the stage name for a final without a round label', () => {
        const match = officialMatch({ stage: playoffs, group: null, round: { no: 3, label: null } })

        expect(linesOf(bracketConsequence({ outcome: 'finished' }, {}), match)).toEqual(['a: Wins the Playoff Stage', 'b: Eliminated'])
    })

    it('uses ordinals and a singular point in the group line', () => {
        const consequence = groupConsequence()
        if (consequence.kind !== 'group') throw new Error('group expected')
        consequence.teams = { a: consequence.teams.a && { ...consequence.teams.a, position: 1, points: 1 }, b: consequence.teams.b && { ...consequence.teams.b, position: 12, points: 0 } }

        expect(linesOf(consequence)).toEqual(['a: 1st in Group B on 1 pt', 'b: 12th in Group B on 0 pts'])
    })

    it('gives each Swiss team its record and status', () => {
        expect(linesOf(swissConsequence({}, {}))).toEqual(['a: Qualified at 3–1', 'b: Eliminated at 1–3'])
        expect(linesOf(swissConsequence({ wins: 2, losses: 1, status: 'active' }, { wins: 1, losses: 2, status: 'active' }))).toEqual([
            'a: Now 2–1 · plays on',
            'b: Now 1–2 · plays on',
        ])
    })

    it('skips a side the consequence has no team for', () => {
        const consequence = groupConsequence()
        consequence.teams.b = null

        expect(linesOf(consequence)).toEqual(['a: 2nd in Group B on 10 pts'])
    })
})

describe('isMatchFinished', () => {
    it('is true once the match row holds the admin result, and false while it is still live', () => {
        expect(['complete', 'forfeit', 'bye'].map(status => isMatchFinished({ status }))).toEqual([true, true, true])
        expect(['scheduled', 'live', 'cancelled'].map(status => isMatchFinished({ status }))).toEqual([false, false, false])
    })
})
