import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchTeamComparison, type TeamComparison } from '@/app/utils/api'
import { comparisonKey, readComparisons, requestOf, type ComparisonRequest, type ReadComparison } from './comparisons'

export type LoadedTeamComparisons = ReadonlyMap<string, TeamComparison | null>

export const TEAM_COMPARISON_TTL_MS = 5 * 60 * 1000

const cache = new Map<string, { comparison: TeamComparison; fetchedAt: number }>()

function cached(key: string, now = Date.now()): TeamComparison | null {
    const entry = cache.get(key)
    if (!entry) return null
    if (now - entry.fetchedAt > TEAM_COMPARISON_TTL_MS) {
        cache.delete(key)
        return null
    }
    return entry.comparison
}

function cachedHits(pairs: readonly string[]): [string, TeamComparison][] {
    return pairs.flatMap((pair): [string, TeamComparison][] => {
        const comparison = cached(pair)
        return comparison ? [[pair, comparison]] : []
    })
}

export function readTeamComparisons(
    requests: readonly ComparisonRequest[],
    read: ReadComparison<TeamComparison>,
    onRead: (key: string, comparison: TeamComparison | null) => void,
): () => void {
    return readComparisons(requests, read, (key, comparison) => {
        const { runner, reference } = requestOf(key)
        const matches = comparison?.runner.team_cap_id === runner && comparison.reference.team_cap_id === reference
        if (matches) cache.set(key, { comparison, fetchedAt: Date.now() })
        onRead(key, matches ? comparison : null)
    })
}

export function useTeamComparisons(requests: readonly ComparisonRequest[]): LoadedTeamComparisons {
    const [loaded, setLoaded] = useState<LoadedTeamComparisons>(() => new Map())
    const known = useRef(new Set<string>())
    const key = requests.map(comparisonKey).join(',')

    useEffect(() => {
        const pairs = key.split(',').filter(pair => pair && !known.current.has(pair))
        const hits = cachedHits(pairs)
        hits.forEach(([pair]) => known.current.add(pair))
        if (hits.length > 0) setLoaded(previous => new Map([...previous, ...hits]))
        const missing = pairs.filter(pair => !known.current.has(pair)).map(requestOf)
        if (missing.length === 0) return
        return readTeamComparisons(missing, fetchTeamComparison, (pair, comparison) => {
            known.current.add(pair)
            setLoaded(previous => new Map(previous).set(pair, comparison))
        })
    }, [key])

    return useMemo(() => {
        const hits = cachedHits(key.split(',').filter(pair => pair && !loaded.has(pair)))
        return hits.length === 0 ? loaded : new Map([...loaded, ...hits])
    }, [key, loaded])
}
