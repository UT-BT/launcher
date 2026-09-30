import { describe, expect, it } from 'vitest'
import { STREAM_T0 } from '../data/streamFixtures'
import { feedMatch, feedPredictor, feedResult, streamFeed } from './feedFixtures'
import { tickerRotation, tickerSets } from './tickerModel'
import { TICKER_SET_MS } from './tickerTiming'

const NOW = STREAM_T0
const HOUR = 3_600_000

const FULL = streamFeed(NOW, {
    results: [
        feedResult('r1', 'Kinetic Kin', 'Triple Jump', NOW - 4 * HOUR, [3, 1]),
        feedResult('r2', 'Warp Rabbits', 'Ledge Lords', NOW - 3 * HOUR, [3, 1]),
        feedResult('r3', 'Moonhoppers', 'Double Dash', NOW - 2 * HOUR, [2, 2]),
        feedResult('r4', 'Hop Theory', 'Flagrunners', NOW - HOUR, [3, 0]),
    ],
    upcoming: [
        feedMatch('u1', 'Strafe Society', 'Quad Damage', NOW + 3 * HOUR - 10 * 60_000, { stream_url: 'https://twitch.tv/utbt' }),
        feedMatch('u2', 'Burrow Gang', 'Flagrunners', NOW + 4 * HOUR, { stream_url: 'https://www.twitch.tv/bramble_bt/' }),
        feedMatch('u3', 'Ctrl+Hop', 'Velvet Carrots', NOW + 5 * HOUR),
        feedMatch('u4', 'Late Comers', 'Night Owls', NOW + 6 * HOUR),
    ],
    top_predictors: [feedPredictor(1, '1', 'Harbinger', 18420), feedPredictor(2, '2', 'Nimbus', 12905), feedPredictor(3, '3', 'Tessel', -310)],
    next_match: feedMatch('u2', 'Burrow Gang', 'Flagrunners', NOW + 4 * HOUR, { stream_url: 'https://www.twitch.tv/bramble_bt/' }),
})

describe('tickerSets', () => {
    it('builds the four sets in rotation order', () => {
        expect(tickerSets(FULL, NOW).map(set => [set.kind, set.tag])).toEqual([
            ['results', "Today's results"],
            ['upcoming', 'Coming up'],
            ['predictors', 'Top predictors'],
            ['next', 'Next on this channel'],
        ])
    })

    it('builds result items with the map score, keeping the latest two', () => {
        const items = tickerSets(FULL, NOW)[0].items
        expect(items.map(item => item.key)).toEqual(['r3', 'r4'])
        expect(items[0]).toEqual({ kind: 'result', key: 'r3', teams: ['Moonhoppers', 'Double Dash'], score: '2–2', where: 'Group Stage · Round 4' })
    })

    it('builds upcoming items with UTC plus relative time and the channel', () => {
        const items = tickerSets(FULL, NOW)[1].items
        expect(items.map(item => item.key)).toEqual(['u1', 'u2'])
        expect(items[0]).toEqual({
            kind: 'upcoming',
            key: 'u1',
            when: '21:30 UTC · in 2h 50m',
            teams: ['Strafe Society', 'Quad Damage'],
            channel: 'twitch.tv/utbt',
        })
        expect(items[1]).toMatchObject({ channel: 'twitch.tv/bramble_bt' })
    })

    it('has no channel for a match that is not streamed', () => {
        const feed = streamFeed(NOW, { upcoming: [feedMatch('quiet', 'a', 'b', NOW + HOUR)] })
        expect(tickerSets(feed, NOW)[0].items[0]).toMatchObject({ channel: null })
    })

    it('builds predictor items with signed profit', () => {
        const items = tickerSets(FULL, NOW)[2].items
        expect(items[0]).toEqual({ kind: 'predictor', key: '1', rank: 1, userId: '1', alias: 'Harbinger', profit: '+18,420' })
        expect(items[2]).toMatchObject({ profit: '−310' })
    })

    it("builds the streamer's next match", () => {
        expect(tickerSets(FULL, NOW)[3].items).toEqual([
            { kind: 'next', key: 'u2', teams: ['Burrow Gang', 'Flagrunners'], when: '22:40 UTC · in 4h', channel: 'twitch.tv/bramble_bt' },
        ])
    })

    it('shows an unscheduled next match as time TBD', () => {
        const feed = streamFeed(NOW, { next_match: feedMatch('tbd', 'Burrow Gang', 'Flagrunners', null, { status: 'pending', stream_url: 'https://twitch.tv/bramble_bt' }) })
        expect(tickerSets(feed, NOW)).toEqual([
            {
                kind: 'next',
                tag: 'Next on this channel',
                items: [{ kind: 'next', key: 'tbd', teams: ['Burrow Gang', 'Flagrunners'], when: 'time TBD', channel: 'twitch.tv/bramble_bt' }],
            },
        ])
    })

    it('names an undecided slot TBD', () => {
        const feed = streamFeed(NOW, { next_match: { ...feedMatch('m', 'x', 'y', NOW + HOUR), teams: { a: null, b: null } } })
        expect(tickerSets(feed, NOW)[0].items[0]).toMatchObject({ teams: ['TBD', 'TBD'] })
    })

    it('leaves out the predictors block without predictions', () => {
        expect(tickerSets({ ...FULL, top_predictors: null }, NOW).map(set => set.kind)).toEqual(['results', 'upcoming', 'next'])
        expect(tickerSets({ ...FULL, top_predictors: [] }, NOW).map(set => set.kind)).toEqual(['results', 'upcoming', 'next'])
    })

    it('leaves out every empty set', () => {
        expect(tickerSets(streamFeed(NOW), NOW)).toEqual([])
        expect(tickerSets(null, NOW)).toEqual([])
    })

    it('skips upcoming matches without a time', () => {
        const feed = streamFeed(NOW, { upcoming: [feedMatch('u', 'a', 'b', null)] })
        expect(tickerSets(feed, NOW)).toEqual([])
    })
})

describe('tickerRotation with an unscheduled next match', () => {
    const feed = { ...FULL, next_match: feedMatch('tbd', 'Burrow Gang', 'Flagrunners', null) }
    const sets = tickerSets(feed, NOW)
    const slot = Math.floor(NOW / TICKER_SET_MS)

    it('keeps the four sets and the interval', () => {
        expect(sets.map(set => set.kind)).toEqual(['results', 'upcoming', 'predictors', 'next'])
        expect(tickerRotation(sets, slot * TICKER_SET_MS)?.index).toBe(slot % 4)
        expect(tickerRotation(sets, (slot + 1) * TICKER_SET_MS)?.index).toBe((slot + 1) % 4)
        expect(TICKER_SET_MS).toBe(10_000)
    })
})

describe('tickerRotation', () => {
    const sets = tickerSets(FULL, NOW)
    const slot = Math.floor(NOW / TICKER_SET_MS)
    const at = (offset: number) => (slot + offset) * TICKER_SET_MS

    it('is a pure function of the clock', () => {
        expect(tickerRotation(sets, at(0))).toEqual(tickerRotation(sets, at(0) + TICKER_SET_MS - 1))
    })

    it('moves to the next set every interval and wraps', () => {
        const order = sets.map(set => set.kind)
        const offsets = [0, 1, 2, 3, 4, 5]
        expect(offsets.map(offset => tickerRotation(sets, at(offset))?.set.kind)).toEqual(
            offsets.map(offset => order[(slot + offset) % sets.length]),
        )
    })

    it('reports the index of the set on show', () => {
        expect(tickerRotation(sets, at(0))?.index).toBe(slot % sets.length)
    })

    it('renders nothing without sets', () => {
        expect(tickerRotation([], NOW)).toBeNull()
    })
})
