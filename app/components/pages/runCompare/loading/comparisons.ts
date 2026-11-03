import { useEffect, useRef, useState } from 'react'
import { fetchCapComparison, type CapComparison } from '@/app/utils/api'

export interface ComparisonRequest {
    runner: string
    reference: string
}

export type LoadedComparisons = ReadonlyMap<string, CapComparison | null>

export type ReadComparison = (runner: string, reference: string, signal: AbortSignal) => Promise<CapComparison | null>

export function comparisonKey({ runner, reference }: ComparisonRequest): string {
    return `${runner}:${reference}`
}

function requestOf(key: string): ComparisonRequest {
    const [runner, reference] = key.split(':')
    return { runner, reference }
}

export function readComparisons(
    requests: readonly ComparisonRequest[],
    read: ReadComparison,
    onRead: (key: string, comparison: CapComparison | null) => void,
): () => void {
    const controller = new AbortController()
    for (const request of requests) {
        const key = comparisonKey(request)
        read(request.runner, request.reference, controller.signal)
            .catch(() => null)
            .then(comparison => {
                if (!controller.signal.aborted) onRead(key, comparison)
            })
    }
    return () => controller.abort()
}

export function useComparisons(requests: readonly ComparisonRequest[]): LoadedComparisons {
    const [loaded, setLoaded] = useState<LoadedComparisons>(() => new Map())
    const known = useRef(new Set<string>())
    const key = requests.map(comparisonKey).join(',')

    useEffect(() => {
        const missing = key.split(',').filter(pair => pair && !known.current.has(pair)).map(requestOf)
        if (missing.length === 0) return
        return readComparisons(missing, fetchCapComparison, (pair, comparison) => {
            known.current.add(pair)
            setLoaded(previous => new Map(previous).set(pair, comparison))
        })
    }, [key])

    return loaded
}
