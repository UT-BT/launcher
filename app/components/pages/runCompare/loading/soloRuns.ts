import { useEffect, useRef, useState } from 'react'
import { fetchCapDetail, type ActiveTitle, type CapCheckpoint, type CapDetail } from '@/app/utils/api'

export interface SoloRun {
    capId: string
    user: string
    alias: string | null
    title: ActiveTitle | null
    timeSeconds: number
    map: string
    side: number | null
    hasGhost: boolean
    zoneCheckpoints: string | null
    checkpoints: CapCheckpoint[]
    disallowed: boolean
}

export type LoadedSoloRuns = ReadonlyMap<string, SoloRun | null>

export function soloRunFromDetail(detail: CapDetail): SoloRun {
    const { cap } = detail
    return {
        capId: cap.id,
        user: String(cap.user),
        alias: cap.alias ?? null,
        title: cap.active_title ?? null,
        timeSeconds: cap.cap_time_seconds,
        map: cap.map,
        side: cap.team === 0 || cap.team === 1 ? cap.team : null,
        hasGhost: cap.has_ghost === true,
        zoneCheckpoints: cap.zone_checkpoints ?? null,
        checkpoints: detail.checkpoints,
        disallowed: cap.disallowed === true,
    }
}

export async function loadSoloRun(accessToken: string, capId: string, signal?: AbortSignal): Promise<SoloRun | null> {
    const detail = await fetchCapDetail(accessToken, capId, signal)
    return detail && detail.cap.id === capId ? soloRunFromDetail(detail) : null
}

type LoadRun<T> = (accessToken: string, id: string, signal?: AbortSignal) => Promise<T | null>

export function useRunReads<T>(ids: readonly string[], accessToken: string, load: LoadRun<T>): ReadonlyMap<string, T | null> {
    const [loaded, setLoaded] = useState<ReadonlyMap<string, T | null>>(() => new Map())
    const requested = useRef({ accessToken, ids: new Set<string>() })
    const key = ids.join(',')

    useEffect(() => {
        if (requested.current.accessToken !== accessToken) requested.current = { accessToken, ids: new Set() }
        const inFlight = requested.current.ids
        const missing = key.split(',').filter(id => id && !inFlight.has(id))
        if (missing.length === 0) return
        for (const id of missing) inFlight.add(id)
        const controller = new AbortController()
        let settled = false
        Promise.all(missing.map(async id => [id, await load(accessToken, id, controller.signal).catch(() => null)] as const))
            .then(results => {
                if (controller.signal.aborted) return
                settled = true
                setLoaded(previous => new Map([...previous, ...results]))
            })
        return () => {
            if (settled) return
            controller.abort()
            for (const id of missing) inFlight.delete(id)
        }
    }, [key, accessToken, load])

    return loaded
}

export function useSoloRuns(capIds: readonly string[], accessToken: string): LoadedSoloRuns {
    return useRunReads(capIds, accessToken, loadSoloRun)
}
