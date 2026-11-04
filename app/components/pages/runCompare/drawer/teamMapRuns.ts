import { useEffect, useState } from 'react'
import { fetchTeamMapLeaderboard, type TeamLeaderboardEntry } from '@/app/utils/api'
import { MAP_RUNS_TTL_MS } from './mapRuns'

export type TeamMapRuns =
    | { status: 'loading' }
    | { status: 'ready'; entries: TeamLeaderboardEntry[] }

const LOADING: TeamMapRuns = { status: 'loading' }
const cache = new Map<string, { runs: TeamMapRuns; fetchedAt: number }>()

function cached(map: string): TeamMapRuns | null {
    const entry = cache.get(map)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > MAP_RUNS_TTL_MS) {
        cache.delete(map)
        return null
    }
    return entry.runs
}

export async function loadTeamMapRuns(accessToken: string, map: string): Promise<{ runs: TeamMapRuns; complete: boolean }> {
    try {
        const entries = await fetchTeamMapLeaderboard(accessToken, map)
        return { runs: { status: 'ready', entries }, complete: entries.length > 0 }
    } catch {
        return { runs: { status: 'ready', entries: [] }, complete: false }
    }
}

export function useTeamMapRuns(map: string | null, accessToken: string): TeamMapRuns {
    const [loaded, setLoaded] = useState<{ map: string; runs: TeamMapRuns } | null>(null)
    const hit = map ? cached(map) : null

    useEffect(() => {
        if (!map || cached(map)) return
        let cancelled = false
        loadTeamMapRuns(accessToken, map).then(({ runs, complete }) => {
            if (complete) cache.set(map, { runs, fetchedAt: Date.now() })
            if (!cancelled) setLoaded({ map, runs })
        })
        return () => { cancelled = true }
    }, [map, accessToken])

    if (hit) return hit
    return loaded && loaded.map === map ? loaded.runs : LOADING
}
