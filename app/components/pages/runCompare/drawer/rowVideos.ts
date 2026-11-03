import { useEffect, useRef } from 'react'
import { resolveCompareVideo } from '@/app/hooks/useVideoCompareAvailability'
import type { ReplayVideo } from '@/app/utils/api'
import { VIDEO_READ_CONCURRENCY } from '../loading/replayVideos'

type ReadVideo = (capId: string) => Promise<ReplayVideo | null>

export interface RowVideoPool {
    wake: () => void
    stop: () => void
}

export function startRowVideoPool(
    order: () => readonly string[],
    read: ReadVideo,
    onRead: (capId: string, video: ReplayVideo | null) => void,
    concurrency = VIDEO_READ_CONCURRENCY,
): RowVideoPool {
    const taken = new Set<string>()
    let running = 0
    let stopped = false

    const next = () => {
        if (stopped) return
        const capId = order().find(candidate => !taken.has(candidate))
        if (capId === undefined) return
        taken.add(capId)
        running += 1
        read(capId)
            .catch(() => null)
            .then(video => {
                running -= 1
                if (stopped) return
                onRead(capId, video)
                next()
            })
    }

    const wake = () => {
        while (!stopped && running < concurrency) {
            const before = running
            next()
            if (running === before) return
        }
    }

    wake()
    return { wake, stop: () => { stopped = true } }
}

export function useRowVideoReads(order: readonly string[], onRead: (capId: string, video: ReplayVideo | null) => void): void {
    const latest = useRef(order)
    latest.current = order
    const report = useRef(onRead)
    report.current = onRead
    const pool = useRef<RowVideoPool | null>(null)
    const key = order.join(',')

    useEffect(() => {
        const started = startRowVideoPool(() => latest.current, resolveCompareVideo, (capId, video) => report.current(capId, video))
        pool.current = started
        return () => {
            started.stop()
            pool.current = null
        }
    }, [])

    useEffect(() => {
        pool.current?.wake()
    }, [key])
}
