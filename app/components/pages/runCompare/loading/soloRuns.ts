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

export function useSoloRuns(capIds: readonly string[], accessToken: string): LoadedSoloRuns {
    const [loaded, setLoaded] = useState<LoadedSoloRuns>(() => new Map())
    const requested = useRef({ accessToken, capIds: new Set<string>() })
    const key = capIds.join(',')

    useEffect(() => {
        if (requested.current.accessToken !== accessToken) requested.current = { accessToken, capIds: new Set() }
        const inFlight = requested.current.capIds
        const missing = key.split(',').filter(capId => capId && !inFlight.has(capId))
        if (missing.length === 0) return
        for (const capId of missing) inFlight.add(capId)
        const controller = new AbortController()
        let settled = false
        Promise.all(missing.map(async capId => [capId, await loadSoloRun(accessToken, capId, controller.signal)] as const))
            .then(results => {
                if (controller.signal.aborted) return
                settled = true
                setLoaded(previous => new Map([...previous, ...results]))
            })
        return () => {
            if (settled) return
            controller.abort()
            for (const capId of missing) inFlight.delete(capId)
        }
    }, [key, accessToken])

    return loaded
}
