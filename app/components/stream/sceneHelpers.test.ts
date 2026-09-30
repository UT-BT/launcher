import { describe, expect, it } from 'vitest'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { STREAM_T0, streamMapScore, streamMatch, streamScore } from './data/streamFixtures'
import {
    formatLabel,
    mapNumber,
    relativeTimeText,
    sceneTimeText,
    seriesFlags,
    seriesTarget,
    sideTone,
    sideToneClasses,
    stageLine,
    utcTimeText,
} from './sceneHelpers'

const at = (text: string) => Date.parse(text)
const NOW = STREAM_T0

describe('sceneTimeText', () => {
    it('reads as UTC plus relative time', () => {
        expect(sceneTimeText('2026-09-29T20:00:00+00:00', NOW)).toBe('20:00 UTC · in 1h 20m')
        expect(sceneTimeText('2026-09-29T16:00:00+00:00', NOW)).toBe('16:00 UTC · 2h 40m ago')
    })

    it('reads zone-less API timestamps as UTC', () => {
        expect(sceneTimeText('2026-09-29 20:00:00', NOW)).toBe('20:00 UTC · in 1h 20m')
    })

    it('has no text without a time', () => {
        expect(sceneTimeText(null, NOW)).toBeNull()
        expect(sceneTimeText('not a time', NOW)).toBeNull()
    })
})

describe('utcTimeText', () => {
    it('shows the UTC clock time on the same UTC day', () => {
        expect(utcTimeText(at('2026-09-29T09:05:00Z'), NOW)).toBe('09:05 UTC')
    })

    it('adds the weekday and date when the time is on another UTC day', () => {
        expect(utcTimeText(at('2026-09-30T01:30:00Z'), NOW)).toBe('Wed 30 Sep, 01:30 UTC')
        expect(utcTimeText(at('2026-09-28T23:59:00Z'), NOW)).toBe('Mon 28 Sep, 23:59 UTC')
        expect(utcTimeText(at('2026-10-01T20:00:00Z'), NOW)).toBe('Thu 1 Oct, 20:00 UTC')
    })
})

describe('relativeTimeText', () => {
    it('counts minutes, hours and days ahead, rounding up so a start never reads as passed', () => {
        expect(relativeTimeText(NOW + 5 * 60_000, NOW)).toBe('in 5m')
        expect(relativeTimeText(NOW + 4 * 60_000 + 1_000, NOW)).toBe('in 5m')
        expect(relativeTimeText(NOW + 60 * 60_000, NOW)).toBe('in 1h')
        expect(relativeTimeText(NOW + 80 * 60_000, NOW)).toBe('in 1h 20m')
        expect(relativeTimeText(NOW + 26 * 3_600_000, NOW)).toBe('in 1d 2h')
        expect(relativeTimeText(NOW + 48 * 3_600_000, NOW)).toBe('in 2d')
    })

    it('counts whole weeks from seven days out', () => {
        expect(relativeTimeText(NOW + 7 * 86_400_000, NOW)).toBe('in 1 week')
        expect(relativeTimeText(NOW + 13 * 86_400_000, NOW)).toBe('in 2 weeks')
        expect(relativeTimeText(NOW - 15 * 86_400_000, NOW)).toBe('2 weeks ago')
    })

    it('counts time passed, rounding down', () => {
        expect(relativeTimeText(NOW - 2 * 60_000 - 59_000, NOW)).toBe('2m ago')
        expect(relativeTimeText(NOW - 160 * 60_000, NOW)).toBe('2h 40m ago')
        expect(relativeTimeText(NOW - 25 * 3_600_000, NOW)).toBe('1d 1h ago')
    })

    it('reads as now within a minute either way', () => {
        expect(relativeTimeText(NOW, NOW)).toBe('now')
        expect(relativeTimeText(NOW + 59_000, NOW)).toBe('now')
        expect(relativeTimeText(NOW - 59_000, NOW)).toBe('now')
    })
})

describe('seriesTarget and seriesFlags', () => {
    it('needs a majority of maps in a first-to series', () => {
        expect(seriesTarget(streamMatch({ best_of: 5 }))).toBe(3)
        expect(seriesTarget(streamMatch({ best_of: 4 }))).toBe(3)
        expect(seriesTarget(streamMatch({ best_of: 3 }))).toBe(2)
        expect(seriesTarget(streamMatch({ best_of: 1 }))).toBe(1)
    })

    it('plays every map in an all-maps series', () => {
        expect(seriesTarget(streamMatch({ best_of: 2, mode: 'all_maps' }))).toBe(2)
    })

    it('fills one flag per map won, out of the maps needed', () => {
        const match = streamMatch({
            best_of: 5,
            score: streamScore([
                streamMapScore(0, [2, 1], 'a'),
                streamMapScore(1, [0, 2], 'b'),
                streamMapScore(2, [2, 0], 'a'),
                streamMapScore(3, [1, 0]),
                streamMapScore(4),
            ]),
        })

        expect(seriesFlags(match)).toEqual({
            a: ['won', 'won', 'open'],
            b: ['won', 'open', 'open'],
        })
    })

    it('never shows more flags than the target, even if the series block says so', () => {
        const match = streamMatch({ best_of: 1, score: streamScore([streamMapScore(0, [2, 0], 'a')], { series: { a: 4, b: 0 } }) })

        expect(seriesFlags(match)).toEqual({ a: ['won'], b: ['open'] })
    })
})

describe('formatLabel', () => {
    it('reads as best-of plus the target, with no unit', () => {
        expect(formatLabel(streamMatch({ best_of: 4, caps_to_win: 2 }))).toBe('Bo4 · first to 2')
        expect(formatLabel(streamMatch({ best_of: 5, caps_to_win: 3 }))).toBe('Bo5 · first to 3')
        expect(formatLabel(streamMatch({ best_of: 1, caps_to_win: 1 }))).toBe('Bo1 · first to 1')
    })

    it('drops the target when the match has none', () => {
        expect(formatLabel(streamMatch({ best_of: 3, caps_to_win: null }))).toBe('Bo3')
        expect(formatLabel(streamMatch({ best_of: 4, caps_to_win: null }))).toBe('Bo4')
    })
})

describe('mapNumber', () => {
    it('turns the 0-based ordinal into the 1-based map number', () => {
        expect(mapNumber(0)).toBe(1)
        expect(mapNumber(3)).toBe(4)
    })
})

describe('stageLine', () => {
    it('joins the stage, group and round', () => {
        expect(stageLine(streamMatch())).toBe('Group Stage · Group B · Round 4')
    })

    it('skips what the match does not have', () => {
        expect(stageLine(streamMatch({ stage: { key: 'playoffs', name: 'Playoffs' }, group: null, round: { no: 2, label: 'Semifinal' } }))).toBe('Playoffs · Semifinal')
        expect(stageLine(streamMatch({ group: null, round: { no: null, label: null } }))).toBe('Group Stage')
    })
})

describe('sideTone', () => {
    it('keeps Team A crimson and Team B azure', () => {
        expect(sideTone('a')).toBe('a')
        expect(sideTone('b')).toBe('b')
        expect(sideToneClasses('a')).toBe(PICK_BAN_TONES.a)
        expect(sideToneClasses('b').text).toBe('text-pickban-b')
    })
})
