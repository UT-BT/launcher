import { fetchReplayVideo, type ReplayVideo } from './api'

export const REPLAY_VIDEO_CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry { video: ReplayVideo | null; fetchedAt: number }
const videoCache = new Map<string, CacheEntry>()

function readCache(capId: string): ReplayVideo | null | undefined {
    const cached = videoCache.get(capId)
    if (!cached) return undefined
    if (Date.now() - cached.fetchedAt > REPLAY_VIDEO_CACHE_TTL_MS) {
        videoCache.delete(capId)
        return undefined
    }
    return cached.video
}

export async function resolveCompareVideo(capId: string): Promise<ReplayVideo | null> {
    const cached = readCache(capId)
    if (cached !== undefined) return cached
    const video = await fetchReplayVideo(capId)
    videoCache.set(capId, { video, fetchedAt: Date.now() })
    return video
}
