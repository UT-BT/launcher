import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PickBanState } from '@/app/utils/api'
import { createPickBanSessionStore, type PickBanSessionSnapshot, type PickBanSessionStore } from './pickBanSession'
import { buildPickBanView, type PickBanView } from './pickBanView'

export interface UsePickBanSessionOptions {
    accessToken: string | undefined
    slug: string
    matchId: string
    alwaysPoll?: boolean
}

export interface UsePickBanSessionResult extends PickBanSessionSnapshot {
    refresh: PickBanSessionStore['refresh']
    sendCommand: PickBanSessionStore['sendCommand']
    sendManagerCommand: PickBanSessionStore['sendManagerCommand']
}

export function usePickBanSession({
    accessToken,
    slug,
    matchId,
    alwaysPoll = false,
}: UsePickBanSessionOptions): UsePickBanSessionResult {
    const tokenRef = useRef(accessToken)
    tokenRef.current = accessToken

    const store = useMemo(
        () => createPickBanSessionStore({ slug, matchId, alwaysPoll, accessToken: () => tokenRef.current }),
        [slug, matchId, alwaysPoll],
    )

    useEffect(() => {
        store.start()
        return () => store.stop()
    }, [store])

    const pollingToken = useRef(accessToken)
    useEffect(() => {
        if (pollingToken.current === accessToken) return
        pollingToken.current = accessToken
        void store.refresh()
    }, [store, accessToken])

    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

    return useMemo(
        () => ({
            ...snapshot,
            refresh: store.refresh,
            sendCommand: store.sendCommand,
            sendManagerCommand: store.sendManagerCommand,
        }),
        [snapshot, store],
    )
}

export function usePickBanView(state: PickBanState | null, clockOffsetMs: number): PickBanView | null {
    const [boundariesPassed, setBoundariesPassed] = useState(0)
    const view = state ? buildPickBanView(state, { clockOffsetMs, now: Date.now() }) : null
    const nextBoundaryAt = view?.nextBoundaryAt ?? null

    useEffect(() => {
        if (nextBoundaryAt === null) return
        const timer = setTimeout(() => setBoundariesPassed((count) => count + 1), Math.max(0, nextBoundaryAt - Date.now()))
        return () => clearTimeout(timer)
    }, [nextBoundaryAt, boundariesPassed])

    return view
}
