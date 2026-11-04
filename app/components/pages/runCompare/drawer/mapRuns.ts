import { useEffect, useState } from 'react'
import { fetchMap, fetchMapLeaderboard, type LeaderboardEntry } from '@/app/utils/api'

export type MapRuns =
    | { status: 'loading' }
    | { status: 'ready'; entries: LeaderboardEntry[] }
    | { status: 'team' }

export const MAP_RUNS_TTL_MS = 5 * 60 * 1000

const LOADING: MapRuns = { status: 'loading' }
const cache = new Map<string, { runs: MapRuns; fetchedAt: number }>()

function cached(map: string): MapRuns | null {
    const entry = cache.get(map)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > MAP_RUNS_TTL_MS) {
        cache.delete(map)
        return null
    }
    return entry.runs
}

export async function loadMapRuns(accessToken: string, map: string): Promise<{ runs: MapRuns; complete: boolean }> {
    const [metadata, entries] = await Promise.all([
        fetchMap(accessToken, map, ['name', 'required_players']),
        fetchMapLeaderboard(accessToken, map),
    ])
    if ((metadata?.required_players ?? 1) > 1) return { runs: { status: 'team' }, complete: true }
    return { runs: { status: 'ready', entries }, complete: metadata !== null && entries.length > 0 }
}

export function useMapRuns(map: string | null, accessToken: string): MapRuns {
    const [loaded, setLoaded] = useState<{ map: string; runs: MapRuns } | null>(null)
    const hit = map ? cached(map) : null

    useEffect(() => {
        if (!map || cached(map)) return
        let cancelled = false
        loadMapRuns(accessToken, map).then(({ runs, complete }) => {
            if (complete) cache.set(map, { runs, fetchedAt: Date.now() })
            if (!cancelled) setLoaded({ map, runs })
        })
        return () => { cancelled = true }
    }, [map, accessToken])

    if (hit) return hit
    return loaded && loaded.map === map ? loaded.runs : LOADING
}
