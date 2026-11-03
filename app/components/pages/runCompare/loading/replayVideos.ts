import { useEffect, useRef, useState } from 'react'
import { resolveCompareVideo } from '@/app/hooks/useVideoCompareAvailability'
import type { ReplayVideo } from '@/app/utils/api'
import type { LoadedVideos } from '../model/raceModel'

export const VIDEO_READ_CONCURRENCY = 3

type ReadVideo = (capId: string) => Promise<ReplayVideo | null>

export function readVideosInOrder(
    capIds: readonly string[],
    read: ReadVideo,
    onRead: (capId: string, video: ReplayVideo | null) => void,
    concurrency = VIDEO_READ_CONCURRENCY,
): () => void {
    const queue = [...capIds]
    let cancelled = false
    const next = () => {
        const capId = queue.shift()
        if (capId === undefined || cancelled) return
        read(capId).then(video => {
            if (cancelled) return
            onRead(capId, video)
            next()
        })
    }
    for (let i = 0; i < concurrency; i += 1) next()
    return () => { cancelled = true }
}

export function useReplayVideos(order: readonly string[]): LoadedVideos {
    const [videos, setVideos] = useState<LoadedVideos>(() => new Map())
    const known = useRef(videos)
    known.current = videos
    const key = order.join(',')

    useEffect(() => {
        const missing = key.split(',').filter(capId => capId && !known.current.has(capId))
        if (missing.length === 0) return
        return readVideosInOrder(missing, resolveCompareVideo, (capId, video) => {
            setVideos(previous => new Map(previous).set(capId, video))
        })
    }, [key])

    return videos
}
