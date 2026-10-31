import { useEffect, useState } from 'react'
import { fetchCapComparisonMotion, type CapComparisonMotion } from '@/app/utils/api'
import { zoomPair } from './speedZoom'

export interface RunMotion {
    motion: CapComparisonMotion | null
    loading: boolean
}

export function useRunMotion(runnerCapId: string | null, referenceCapId: string | null, enabled: boolean): RunMotion {
    const pair = runnerCapId && referenceCapId ? zoomPair(runnerCapId, referenceCapId) : null
    const [loaded, setLoaded] = useState<{ pair: string; motion: CapComparisonMotion | null } | null>(null)
    const loadedPair = loaded?.pair ?? null

    useEffect(() => {
        if (!enabled || !pair || loadedPair === pair) return
        const [runner, reference] = pair.split('|')
        const controller = new AbortController()
        fetchCapComparisonMotion(runner, reference, controller.signal).then(motion => {
            if (!controller.signal.aborted) setLoaded({ pair, motion })
        })
        return () => controller.abort()
    }, [pair, enabled, loadedPair])

    const current = loaded !== null && loaded.pair === pair
    return { motion: current ? loaded.motion : null, loading: enabled && pair !== null && !current }
}
