import type { LeaderboardEntry, ReplayVideo } from '@/app/utils/api'

export type RunRow = {
    entry: LeaderboardEntry
    video: ReplayVideo | null | undefined
}

export const REPLAY_CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry { rows: RunRow[]; fetchedAt: number }
const replayCache = new Map<string, CacheEntry>()

export function replayRowsFromLeaderboard(entries: LeaderboardEntry[]): RunRow[] {
    return entries.filter(e => e.id).map(e => ({ entry: e, video: undefined }))
}

export function cacheReplayRows(mapName: string, rows: RunRow[]): void {
    replayCache.set(mapName, { rows, fetchedAt: Date.now() })
}

export function cachedReplayRows(mapName: string, excludeCapId?: string): RunRow[] | null {
    const cached = replayCache.get(mapName)
    if (!cached) return null
    if (Date.now() - cached.fetchedAt > REPLAY_CACHE_TTL_MS) {
        replayCache.delete(mapName)
        return null
    }
    return withoutCap(cached.rows, excludeCapId)
}

export function withoutCap(rows: RunRow[], excludeCapId?: string): RunRow[] {
    return excludeCapId ? rows.filter(r => r.entry.id !== excludeCapId) : rows
}

export function withReplayVideo(rows: RunRow[], capId: string, video: ReplayVideo | null): RunRow[] {
    return rows.map(r => r.entry.id === capId ? { ...r, video } : r)
}

export function cacheReplayVideo(mapName: string, capId: string, video: ReplayVideo | null): void {
    const cached = replayCache.get(mapName)
    if (!cached) return
    cached.rows = withReplayVideo(cached.rows, capId, video)
}
