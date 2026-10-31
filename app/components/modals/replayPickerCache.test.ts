import { describe, expect, it, vi } from 'vitest'
import type { LeaderboardEntry, ReplayVideo } from '@/app/utils/api'
import {
    cacheReplayRows,
    cacheReplayVideo,
    cachedReplayRows,
    REPLAY_CACHE_TTL_MS,
    replayRowsFromLeaderboard,
} from './replayPickerCache'

function entry(id: string): LeaderboardEntry {
    return {
        map: 'CTF-BT-Test',
        user: `u-${id}`,
        cap_time_seconds: 60,
        added: '2026-01-01T00:00:00Z',
        alias: `Player ${id}`,
        cap_type: 2,
        verified: true,
        id,
    }
}

const video: ReplayVideo = { source: 'utrecorder', mp4_url: 'https://example.test/a.mp4', view_url: null, fps: 60 }

function ids(rows: { entry: LeaderboardEntry }[] | null): string[] | null {
    return rows ? rows.map(r => r.entry.id) : null
}

describe('replayRowsFromLeaderboard', () => {
    it('keeps every entry with an id, video unresolved', () => {
        const rows = replayRowsFromLeaderboard([entry('a'), { ...entry(''), id: '' }, entry('b')])
        expect(ids(rows)).toEqual(['a', 'b'])
        expect(rows.every(r => r.video === undefined)).toBe(true)
    })
})

describe('cachedReplayRows', () => {
    it('misses a map that was never cached', () => {
        expect(cachedReplayRows('never-cached')).toBeNull()
    })

    it('never lists the excluded cap in compare mode, even when a normal open filled the cache', () => {
        cacheReplayRows('normal-first', replayRowsFromLeaderboard([entry('a'), entry('b'), entry('c')]))
        expect(ids(cachedReplayRows('normal-first', 'b'))).toEqual(['a', 'c'])
    })

    it('lists the excluded cap again on a normal open after compare mode', () => {
        cacheReplayRows('compare-first', replayRowsFromLeaderboard([entry('a'), entry('b'), entry('c')]))
        expect(ids(cachedReplayRows('compare-first', 'b'))).toEqual(['a', 'c'])
        expect(ids(cachedReplayRows('compare-first'))).toEqual(['a', 'b', 'c'])
    })

    it('excludes a different cap per compare open', () => {
        cacheReplayRows('two-compares', replayRowsFromLeaderboard([entry('a'), entry('b')]))
        expect(ids(cachedReplayRows('two-compares', 'a'))).toEqual(['b'])
        expect(ids(cachedReplayRows('two-compares', 'b'))).toEqual(['a'])
    })

    it('expires after the TTL', () => {
        vi.useFakeTimers()
        try {
            vi.setSystemTime(1_000)
            cacheReplayRows('expiring', replayRowsFromLeaderboard([entry('a')]))
            vi.setSystemTime(1_000 + REPLAY_CACHE_TTL_MS)
            expect(ids(cachedReplayRows('expiring'))).toEqual(['a'])
            vi.setSystemTime(1_001 + REPLAY_CACHE_TTL_MS)
            expect(cachedReplayRows('expiring')).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })
})

describe('cacheReplayVideo', () => {
    it('stores a resolved video without dropping the cap a compare open excluded', () => {
        cacheReplayRows('videos', replayRowsFromLeaderboard([entry('a'), entry('b')]))
        cacheReplayVideo('videos', 'a', video)
        cacheReplayVideo('videos', 'b', null)
        const rows = cachedReplayRows('videos')
        expect(ids(rows)).toEqual(['a', 'b'])
        expect(rows?.map(r => r.video)).toEqual([video, null])
    })

    it('does nothing for a map that is not cached', () => {
        cacheReplayVideo('not-cached', 'a', video)
        expect(cachedReplayRows('not-cached')).toBeNull()
    })
})
