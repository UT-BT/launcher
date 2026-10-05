import { describe, expect, it } from 'vitest'
import { STREAM_T0, streamHotState, streamMatch, streamScore, streamMapScore } from '../data/streamFixtures'
import { feedMatch, streamFeed } from '../ticker/feedFixtures'
import { endingModel } from './endingModel'

const NOW = STREAM_T0
const HOUR = 3_600_000

const STATE = streamHotState({ streamer: { id: '77', display_name: 'Bramble', channel: 'https://twitch.tv/bramble_bt' } })

describe('endingModel credits', () => {
    it('credits the streamer and the casters from users and free text', () => {
        const state = streamHotState({
            streamer: STATE.streamer,
            match: streamMatch({
                casters: [
                    { id: '5', display_name: 'Echo', avatar: 'https://example.test/users/5/avatar' },
                    { id: null, display_name: 'Tilde', avatar: null },
                ],
            }),
        })

        const model = endingModel({ state, feed: null, now: NOW })

        expect(model.streamer).toEqual({ key: 'streamer', userId: '77', name: 'Bramble' })
        expect(model.casters).toEqual([
            { key: 'caster-0', userId: '5', name: 'Echo' },
            { key: 'caster-1', userId: null, name: 'Tilde' },
        ])
    })

    it('drops casters without a name and trims free text', () => {
        const state = streamHotState({
            streamer: STATE.streamer,
            match: streamMatch({
                casters: [
                    { id: '5', display_name: null, avatar: null },
                    { id: null, display_name: '  Tilde  ', avatar: null },
                    { id: null, display_name: '   ', avatar: null },
                ],
            }),
        })

        expect(endingModel({ state, feed: null, now: NOW }).casters).toEqual([{ key: 'caster-1', userId: null, name: 'Tilde' }])
    })

    it('falls back to the channel when the streamer has no display name', () => {
        const state = streamHotState({ streamer: { id: '77', display_name: null, channel: 'https://twitch.tv/bramble_bt' } })
        expect(endingModel({ state, feed: null, now: NOW }).streamer).toEqual({ key: 'streamer', userId: '77', name: 'twitch.tv/bramble_bt' })
    })

    it('has no casters without a match', () => {
        expect(endingModel({ state: streamHotState({ match: null, reason: 'none' }), feed: null, now: NOW }).casters).toEqual([])
    })

    it('shows the final series as the kicker only once a winner exists', () => {
        const won = streamMatch({ score: streamScore([streamMapScore(0, [3, 1], 'a'), streamMapScore(1, [3, 0], 'a')], { winner: 'a' }) })
        const live = streamMatch({ score: streamScore([streamMapScore(0, [1, 0], null)]) })

        expect(endingModel({ state: streamHotState({ match: won }), feed: null, now: NOW }).kicker).toBe('Crimson Cats 2–0 Azure Owls')
        expect(endingModel({ state: streamHotState({ match: live }), feed: null, now: NOW }).kicker).toBeNull()
    })

    it('shows a drawn series as the kicker too', () => {
        const drawn = streamMatch({ score: streamScore([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [0, 2], 'b')], { live_decided: true }) })

        expect(endingModel({ state: streamHotState({ match: drawn }), feed: null, now: NOW }).kicker).toBe('Crimson Cats 1–1 Azure Owls')
    })
})

describe('endingModel next matches', () => {
    const channelOf = (url: string | null) => ({ stream_url: url })

    it('lists streamed matches in time order with their channels', () => {
        const feed = streamFeed(NOW, {
            upcoming: [
                feedMatch('late', 'Burrow Gang', 'Flagrunners', NOW + 4 * HOUR, channelOf('https://twitch.tv/other')),
                feedMatch('soon', 'Strafe Society', 'Quad Damage', NOW + 3 * HOUR - 10 * 60_000, channelOf('https://twitch.tv/utbt')),
            ],
        })

        const next = endingModel({ state: STATE, feed, now: NOW }).next

        expect(next.map(match => match.key)).toEqual(['soon', 'late'])
        expect(next[0]).toEqual({
            key: 'soon',
            when: '21:30 UTC',
            relative: 'in 2h 50m',
            teams: ['Strafe Society', 'Quad Damage'],
            where: 'Group Stage · Round 4',
            channel: 'twitch.tv/utbt',
            thisChannel: false,
        })
    })

    it('leaves out matches without a channel or a time', () => {
        const feed = streamFeed(NOW, {
            upcoming: [
                feedMatch('quiet', 'a', 'b', NOW + HOUR),
                feedMatch('untimed', 'c', 'd', null, channelOf('https://twitch.tv/utbt')),
                feedMatch('streamed', 'e', 'f', NOW + 2 * HOUR, channelOf('https://twitch.tv/utbt')),
            ],
        })

        expect(endingModel({ state: STATE, feed, now: NOW }).next.map(match => match.key)).toEqual(['streamed'])
    })

    it("adds the streamer's next match beyond the feed window and marks this channel", () => {
        const own = feedMatch('own', 'Moonhoppers', 'Kinetic Kin', NOW + 30 * HOUR, channelOf('https://twitch.tv/bramble_bt'))
        const feed = streamFeed(NOW, {
            upcoming: [feedMatch('soon', 'a', 'b', NOW + HOUR, channelOf('https://twitch.tv/utbt'))],
            next_match: own,
        })

        const next = endingModel({ state: STATE, feed, now: NOW }).next

        expect(next.map(match => [match.key, match.thisChannel])).toEqual([
            ['soon', false],
            ['own', true],
        ])
        expect(next[1].when).toBe('Thu 1 Oct, 00:40 UTC')
    })

    it('lists a match once when it is both upcoming and next', () => {
        const own = feedMatch('own', 'a', 'b', NOW + HOUR, channelOf('https://twitch.tv/other'))
        const feed = streamFeed(NOW, { upcoming: [own], next_match: own })

        const next = endingModel({ state: STATE, feed, now: NOW }).next

        expect(next.map(match => [match.key, match.thisChannel])).toEqual([['own', true]])
    })

    it('leaves out the match that just ended and matches already past', () => {
        const state = streamHotState({ streamer: STATE.streamer, match: streamMatch({ id: 'current' }) })
        const feed = streamFeed(NOW, {
            upcoming: [
                feedMatch('current', 'a', 'b', NOW + HOUR, channelOf('https://twitch.tv/utbt')),
                feedMatch('past', 'c', 'd', NOW - HOUR, channelOf('https://twitch.tv/utbt')),
                feedMatch('ahead', 'e', 'f', NOW + 2 * HOUR, channelOf('https://twitch.tv/utbt')),
            ],
        })

        expect(endingModel({ state, feed, now: NOW }).next.map(match => match.key)).toEqual(['ahead'])
    })

    it('keeps the next three', () => {
        const upcoming = [1, 2, 3, 4, 5].map(n => feedMatch(`m${n}`, 'a', 'b', NOW + n * HOUR, channelOf('https://twitch.tv/utbt')))

        expect(endingModel({ state: STATE, feed: streamFeed(NOW, { upcoming }), now: NOW }).next.map(match => match.key)).toEqual(['m1', 'm2', 'm3'])
    })

    it('is empty without a feed', () => {
        expect(endingModel({ state: STATE, feed: null, now: NOW }).next).toEqual([])
    })
})
