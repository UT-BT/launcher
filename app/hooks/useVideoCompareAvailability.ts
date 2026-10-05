import { useEffect, useRef, useState } from 'react'
import { fetchReplayVideo, type ReplayVideo } from '@/app/utils/api'

const CACHE_TTL_MS = 5 * 60 * 1000
interface CacheEntry { video: ReplayVideo | null; fetchedAt: number }
const videoCache = new Map<string, CacheEntry>()

function readCache(capId: string): ReplayVideo | null | undefined {
    const c = videoCache.get(capId)
    if (!c) return undefined
    if (Date.now() - c.fetchedAt > CACHE_TTL_MS) {
        videoCache.delete(capId)
        return undefined
    }
    return c.video
}

export async function resolveCompareVideo(capId: string): Promise<ReplayVideo | null> {
    const cached = readCache(capId)
    if (cached !== undefined) return cached
    const video = await fetchReplayVideo(capId)
    videoCache.set(capId, { video, fetchedAt: Date.now() })
    return video
}

export interface VideoCompareAvailability {
    videoA: ReplayVideo | null | undefined
    videoB: ReplayVideo | null | undefined
    bothReady: boolean
    checking: boolean
}

export function useVideoCompareAvailability(
    capIdA: string | undefined,
    capIdB: string | null | undefined,
    enabled: boolean,
): VideoCompareAvailability {
    const [videoA, setVideoA] = useState<ReplayVideo | null | undefined>(undefined)
    const [videoB, setVideoB] = useState<ReplayVideo | null | undefined>(undefined)
    const requestRef = useRef(0)

    useEffect(() => {
        if (!enabled || !capIdA || !capIdB) {
            setVideoA(undefined)
            setVideoB(undefined)
            return
        }
        const myRequest = ++requestRef.current
        let cancelled = false

        setVideoA(readCache(capIdA))
        setVideoB(readCache(capIdB))

        resolveCompareVideo(capIdA).then(video => {
            if (!cancelled && requestRef.current === myRequest) setVideoA(video)
        })
        resolveCompareVideo(capIdB).then(video => {
            if (!cancelled && requestRef.current === myRequest) setVideoB(video)
        })

        return () => { cancelled = true }
    }, [capIdA, capIdB, enabled])

    return {
        videoA,
        videoB,
        bothReady: videoA != null && videoB != null,
        checking: videoA === undefined || videoB === undefined,
    }
}
