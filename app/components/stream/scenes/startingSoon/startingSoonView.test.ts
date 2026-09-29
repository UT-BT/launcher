import { describe, expect, it } from 'vitest'
import { STREAM_T0, streamIso, streamMatch, streamMember, streamTeam, streamTitle, streamUserRef } from '../../data/streamFixtures'
import { feedMatch, feedResult, soonBetting, soonBettingDisabled, soonFeed } from './startingSoonFixtures'
import { countdownCueDue, countdownMarkOf, startingSoonView, type CountdownMark } from './startingSoonView'

const MINUTE = 60_000
const SECOND = 1_000
const NOW = STREAM_T0
const TARGET = STREAM_T0 + 80 * MINUTE

function viewAt(now: number, overrides: Parameters<typeof streamMatch>[0] = {}) {
    return startingSoonView({ match: streamMatch(overrides), betting: soonBetting(), feed: soonFeed(), now })
}

describe('the countdown', () => {
    it('counts down to the scheduled time', () => {
        const { countdown, kicker } = viewAt(NOW)
        expect(countdown).toEqual({ state: 'future', label: 'Match starts in', headline: '1:20:00', utc: '20:00 UTC', relative: 'in 1h 20m' })
        expect(kicker).toBe('20:00 UTC · in 1h 20m')
    })

    it('counts down to the override when the streamer moved the start', () => {
        const { countdown, kicker } = viewAt(NOW, { countdown_at: streamIso(TARGET + 25 * MINUTE) })
        expect(countdown.headline).toBe('1:45:00')
        expect(countdown.utc).toBe('20:25 UTC')
        expect(kicker).toBe('20:25 UTC · in 1h 45m')
    })

    it('falls back to the scheduled time without a countdown target', () => {
        expect(viewAt(NOW, { countdown_at: null }).countdown.headline).toBe('1:20:00')
    })

    it('rounds partial seconds up so it never shows zero before the start', () => {
        expect(viewAt(TARGET - 400).countdown.headline).toBe('0:00:01')
        expect(viewAt(TARGET - 61 * SECOND).countdown.headline).toBe('0:01:01')
        expect(viewAt(TARGET - 26 * 60 * MINUTE).countdown.headline).toBe('26:00:00')
    })

    it('reads "starting any moment" once the target has passed, instead of sitting at zero', () => {
        for (const now of [TARGET, TARGET + 5 * MINUTE]) {
            const { countdown, kicker } = viewAt(now)
            expect(countdown).toEqual({ state: 'passed', label: 'Match starts', headline: 'Any moment', utc: '20:00 UTC', relative: null })
            expect(kicker).toBe('20:00 UTC · starting any moment')
        }
    })

    it('says soon without any time', () => {
        const { countdown, kicker } = viewAt(NOW, { scheduled_at: null, countdown_at: null })
        expect(countdown).toEqual({ state: 'unscheduled', label: 'Match starts', headline: 'Soon', utc: null, relative: null })
        expect(kicker).toBeNull()
    })

    it('adds the date when the start is on another UTC day', () => {
        const { countdown } = viewAt(NOW, { countdown_at: '2026-09-30T01:30:00+00:00' })
        expect(countdown.utc).toBe('Wed 30 Sep, 01:30 UTC')
        expect(countdown.relative).toBe('in 6h 50m')
    })
})

describe('the stage and teams', () => {
    it('carries the stage line and the format', () => {
        const view = viewAt(NOW)
        expect(view.stage).toBe('Group Stage · Group B · Round 4')
        expect(view.format).toBe('Bo4 · first to 2 team caps')
    })

    it('puts A on top and B below, with seeds and the lineup players and their titles', () => {
        const [a, b] = viewAt(NOW).teams
        expect(a).toMatchObject({ side: 'a', ab: 'A', name: 'Crimson Cats', seed: 1 })
        expect(a.players).toEqual([
            { id: '1000', name: 'Ada', title: streamTitle('Cap Machine') },
            { id: '1001', name: 'Ben', title: null },
        ])
        expect(b).toMatchObject({ side: 'b', ab: 'B', name: 'Azure Owls', seed: 4 })
        expect(b.players.map(player => player.name)).toEqual(['Cleo', 'Dex'])
    })

    it('shows the lineup rather than the whole roster', () => {
        const sub = streamMember('1002', 'Cyd', { title: streamTitle('Rookie', 1) })
        const a = streamTeam('a', { members: [...streamTeam('a').members, sub] })
        const view = viewAt(NOW, {
            teams: { a, b: streamTeam('b') },
            lineup: { a1: streamUserRef(sub), a2: streamUserRef(a.members[0]), b1: null, b2: null },
        })
        expect(view.teams[0].players.map(player => player.name)).toEqual(['Cyd', 'Ada'])
        expect(view.teams[0].players[0].title).toEqual(streamTitle('Rookie', 1))
        expect(view.teams[1].players.map(player => player.name)).toEqual(['Cleo', 'Dex'])
    })

    it('shows a lineup player who is not on the roster without a title', () => {
        const view = viewAt(NOW, { lineup: { a1: { id: '9000', display_name: 'Guest', avatar: null }, a2: null, b1: null, b2: null } })
        expect(view.teams[0].players).toEqual([{ id: '9000', name: 'Guest', title: null }])
    })

    it('shows an undecided team as TBD with no seed or players', () => {
        const view = viewAt(NOW, { teams: { a: streamTeam('a'), b: null }, lineup: { a1: null, a2: null, b1: null, b2: null } })
        expect(view.teams[1]).toEqual({ side: 'b', ab: 'B', name: null, seed: null, players: [] })
    })
})

describe('the odds bar', () => {
    it('shows each side as a percentage and decimal odds, with the totals', () => {
        expect(viewAt(NOW).odds).toEqual({
            a: { percent: '58%', odds: '1.72', share: 0.58 },
            b: { percent: '42%', odds: '2.38', share: 0.42 },
            draw: null,
            summary: '164 predictions · 12,450 coins in the pool',
        })
    })

    it('is hidden when predictions are not enabled', () => {
        const view = startingSoonView({ match: streamMatch(), betting: soonBettingDisabled(), feed: soonFeed(), now: NOW })
        expect(view.odds).toBeNull()
    })

    it('is hidden when the match has no market or the read has not landed', () => {
        const noMarket = startingSoonView({ match: streamMatch(), betting: { state: 'no_market', market: null, sides: null }, feed: null, now: NOW })
        expect(noMarket.odds).toBeNull()
        expect(startingSoonView({ match: streamMatch(), betting: null, feed: null, now: NOW }).odds).toBeNull()
    })

    it('adds the draw share on a three-way market and uses the singular for one prediction', () => {
        const betting = soonBetting({
            market: { pool: 250, predictions: 1 },
            sides: { a: { price: 0.5, odds: 2 }, b: { price: 0.3, odds: 3.33 }, draw: { price: 0.2, odds: 5 } },
        })
        const odds = startingSoonView({ match: streamMatch(), betting, feed: null, now: NOW }).odds
        expect(odds?.draw).toEqual({ percent: '20%', odds: '5.00', share: 0.2 })
        expect(odds?.a.odds).toBe('2.00')
        expect(odds?.summary).toBe('1 prediction · 250 coins in the pool')
    })
})

describe('also today', () => {
    it('lists results and upcoming matches in time order, leaving out this match', () => {
        const rows = viewAt(NOW).alsoToday
        expect(rows.map(row => row.time)).toEqual(['16:00 UTC', '17:30 UTC', '21:30 UTC', '22:00 UTC', '23:30 UTC'])
        expect(rows.map(row => row.id)).not.toContain('match-1')
    })

    it('keeps the two latest results and fills the rest with the next matches', () => {
        const upcoming = [1, 2, 3, 4, 5].map(n => feedMatch(`u${n}`, 100 + n * 30, `Home ${n}`, `Away ${n}`))
        const view = startingSoonView({ match: streamMatch(), betting: null, feed: soonFeed({ upcoming }), now: NOW })
        expect(view.alsoToday.map(row => row.id)).toEqual(['r2', 'r3', 'u1', 'u2', 'u3'])
    })

    it('shows more results when fewer matches are left', () => {
        const view = startingSoonView({ match: streamMatch(), betting: null, feed: soonFeed({ upcoming: [] }), now: NOW })
        expect(view.alsoToday.map(row => row.id)).toEqual(['r1', 'r2', 'r3'])
    })

    it('shows the score and Final for a result, and the channel for a match to come', () => {
        const [result, , next, other, unstreamed] = viewAt(NOW).alsoToday
        expect(result).toEqual({
            id: 'r2',
            time: '16:00 UTC',
            relative: '2h 40m ago',
            a: 'Warp Rabbits',
            b: 'Ledge Lords',
            score: '3–1',
            where: 'Group Stage · Round 4',
            note: { kind: 'final', text: 'Final' },
        })
        expect(next).toMatchObject({ relative: 'in 2h 50m', score: null, note: { kind: 'channel', text: 'twitch.tv/utbt' } })
        expect(other.note).toEqual({ kind: 'channel', text: 'twitch.tv/bramble_bt' })
        expect(unstreamed.note).toEqual({ kind: 'none', text: 'Not streamed' })
    })

    it('marks a forfeit and shows TBD for an undecided team', () => {
        const feed = soonFeed({
            results: [feedResult('f1', -30, 'Warp Rabbits', 'Ledge Lords', [2, 0], { status: 'forfeit' })],
            upcoming: [feedMatch('u9', 60, 'Burrow Gang', null)],
        })
        const [forfeit, tbd] = startingSoonView({ match: streamMatch(), betting: null, feed, now: NOW }).alsoToday
        expect(forfeit.note).toEqual({ kind: 'final', text: 'Forfeit' })
        expect(tbd).toMatchObject({ a: 'Burrow Gang', b: 'TBD' })
    })

    it('is empty until the feed lands', () => {
        expect(startingSoonView({ match: streamMatch(), betting: null, feed: null, now: NOW }).alsoToday).toEqual([])
    })
})

describe('the countdown-zero cue', () => {
    const match = streamMatch()
    const mark = (now: number, overrides: Parameters<typeof streamMatch>[0] = {}): CountdownMark => countdownMarkOf(streamMatch(overrides), now)
    const due = (previous: CountdownMark | null, next: CountdownMark) => countdownCueDue(previous, next)

    it('fires when a running countdown crosses zero', () => {
        expect(due(mark(TARGET - 600), mark(TARGET + 400))).toBe(true)
        expect(due(mark(TARGET - SECOND), mark(TARGET))).toBe(true)
    })

    it('fires once: the ticks after the crossing stay quiet', () => {
        const ticks = [-2, -1, 0, 1, 2, 3].map(seconds => countdownMarkOf(match, TARGET + seconds * SECOND - 300))
        const fired = ticks.filter((tick, index) => due(index === 0 ? null : ticks[index - 1], tick))
        expect(fired).toHaveLength(1)
    })

    it('stays quiet when a clock correction dips back under zero and crosses it again', () => {
        const crossed = mark(TARGET + 400)
        expect(countdownCueDue(mark(TARGET - 600), crossed)).toBe(true)
        expect(countdownCueDue(mark(TARGET - 200), mark(TARGET + 800), crossed)).toBe(false)
    })

    it('never fires on the first tick, so a reload after zero stays quiet', () => {
        expect(due(null, mark(TARGET + 200))).toBe(false)
        expect(due(null, mark(TARGET + 10 * MINUTE))).toBe(false)
    })

    it('stays quiet while the countdown is still running or long past', () => {
        expect(due(mark(TARGET - 3 * SECOND), mark(TARGET - 2 * SECOND))).toBe(false)
        expect(due(mark(TARGET + 5 * MINUTE), mark(TARGET + 5 * MINUTE + SECOND))).toBe(false)
    })

    it('stays quiet when the clock jumps far past zero, e.g. after a sleep', () => {
        expect(due(mark(TARGET - SECOND), mark(TARGET + 10 * MINUTE))).toBe(false)
    })

    it('stays quiet when the match or the target changes under it', () => {
        expect(due(mark(TARGET - SECOND), mark(TARGET + 200, { id: 'match-2' }))).toBe(false)
        const earlier = streamIso(TARGET - 10 * MINUTE)
        expect(due(mark(TARGET - 11 * MINUTE), mark(TARGET - 9 * MINUTE, { countdown_at: earlier }))).toBe(false)
    })

    it('fires again when a delayed countdown reaches its new zero', () => {
        const delayed = streamIso(TARGET + 15 * MINUTE)
        expect(due(mark(TARGET + 15 * MINUTE - 600, { countdown_at: delayed }), mark(TARGET + 15 * MINUTE + 400, { countdown_at: delayed }))).toBe(true)
    })

    it('never fires without a time', () => {
        const none = { scheduled_at: null, countdown_at: null }
        expect(due(mark(TARGET - SECOND, none), mark(TARGET + SECOND, none))).toBe(false)
    })
})
