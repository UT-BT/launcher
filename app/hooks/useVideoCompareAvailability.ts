import { useEffect, useRef, useState } from 'react'
import { fetchDemoStatus, getFirstPersonVideoUrl } from '@/app/utils/api'

const CACHE_TTL_MS = 5 * 60 * 1000
interface CacheEntry { url: string | null; fetchedAt: number }
const statusCache = new Map<string, CacheEntry>()

function readCache(capId: string): string | null | undefined {
    const c = statusCache.get(capId)
    if (!c) return undefined
    if (Date.now() - c.fetchedAt > CACHE_TTL_MS) {
        statusCache.delete(capId)
        return undefined
    }
    return c.url
}

export async function resolveCompareVideoUrl(capId: string): Promise<string | null> {
    const cached = readCache(capId)
    if (cached !== undefined) return cached
    const status = await fetchDemoStatus(capId)
    const url = getFirstPersonVideoUrl(status)
    statusCache.set(capId, { url, fetchedAt: Date.now() })
    return url
}

export interface VideoCompareAvailability {
    urlA: string | null | undefined
    urlB: string | null | undefined
    bothReady: boolean
    checking: boolean
}

export function useVideoCompareAvailability(
    capIdA: string | undefined,
    capIdB: string | null | undefined,
    enabled: boolean,
): VideoCompareAvailability {
    const [urlA, setUrlA] = useState<string | null | undefined>(undefined)
    const [urlB, setUrlB] = useState<string | null | undefined>(undefined)
    const requestRef = useRef(0)

    useEffect(() => {
        if (!enabled || !capIdA || !capIdB) {
            setUrlA(undefined)
            setUrlB(undefined)
            return
        }
        const myRequest = ++requestRef.current
        let cancelled = false

        setUrlA(readCache(capIdA))
        setUrlB(readCache(capIdB))

        resolveCompareVideoUrl(capIdA).then(url => {
            if (!cancelled && requestRef.current === myRequest) setUrlA(url)
        })
        resolveCompareVideoUrl(capIdB).then(url => {
            if (!cancelled && requestRef.current === myRequest) setUrlB(url)
        })

        return () => { cancelled = true }
    }, [capIdA, capIdB, enabled])

    return {
        urlA,
        urlB,
        bothReady: typeof urlA === 'string' && typeof urlB === 'string',
        checking: urlA === undefined || urlB === undefined,
    }
}
