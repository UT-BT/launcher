import { useEffect, useRef, useState } from 'react'
import { fetchKitInfo } from './panels/kit/kitFetch'
import type { StreamKitState } from './streamPanels'

type ReadKitStates = Readonly<Record<string, Exclude<StreamKitState, 'loading'>>>

function readKey(eventSlug: string, streamerId: string): string {
    return `${eventSlug}/${streamerId}`
}

export function useStreamKitState(eventSlug: string, streamerId: string | null, accessToken: string, needed: boolean): StreamKitState {
    const tokenRef = useRef(accessToken)
    tokenRef.current = accessToken
    const [reads, setReads] = useState<ReadKitStates>({})
    const current = streamerId ? reads[readKey(eventSlug, streamerId)] : undefined

    useEffect(() => {
        if (!needed || !streamerId || current) return
        const controller = new AbortController()
        const key = readKey(eventSlug, streamerId)
        const settle = (state: Exclude<StreamKitState, 'loading'>) => {
            if (!controller.signal.aborted) setReads(previous => ({ ...previous, [key]: state }))
        }
        fetchKitInfo(tokenRef.current, eventSlug, streamerId, controller.signal)
            .then(info => settle(info.downloadedVersion === null ? 'none' : 'downloaded'))
            .catch(() => settle('unknown'))
        return () => controller.abort()
    }, [needed, eventSlug, streamerId, current])

    return current ?? 'loading'
}
