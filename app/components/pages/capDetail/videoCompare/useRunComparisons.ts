import { useEffect, useState } from 'react'
import { fetchCapComparison } from '@/app/utils/api'
import {
    comparisonKey,
    comparisonRequests,
    type ComparisonRequest,
    type CompareRunTiming,
    type RunComparisons,
} from './compareView'

export function useRunComparisons(runs: CompareRunTiming[], enabled: boolean): RunComparisons {
    const requestsKey = JSON.stringify(comparisonRequests(runs))
    const [loaded, setLoaded] = useState<RunComparisons>(() => new Map())

    useEffect(() => {
        if (!enabled) return
        const requests = JSON.parse(requestsKey) as ComparisonRequest[]
        if (requests.length === 0) return
        const controller = new AbortController()
        for (const { runnerCapId, referenceCapId } of requests) {
            fetchCapComparison(runnerCapId, referenceCapId, controller.signal).then(comparison => {
                if (controller.signal.aborted) return
                setLoaded(prev => new Map(prev).set(comparisonKey(runnerCapId, referenceCapId), comparison))
            })
        }
        return () => controller.abort()
    }, [requestsKey, enabled])

    return loaded
}
