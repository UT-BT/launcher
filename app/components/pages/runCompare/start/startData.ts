import { useEffect, useState } from 'react'
import { fetchMapsFuzzy, fetchWorldRecords } from '@/app/utils/api'
import { mapPicks, recordPicks, RECORDS_FETCHED, SEARCH_LIMIT, type MapPick, type RecordPick } from './startModel'

export const SEARCH_DEBOUNCE_MS = 250
export const RECORDS_TTL_MS = 5 * 60 * 1000

export type MapSearch =
    | { status: 'idle' }
    | { status: 'searching' }
    | { status: 'ready'; maps: MapPick[] }

const IDLE: MapSearch = { status: 'idle' }
const SEARCHING: MapSearch = { status: 'searching' }

let latestRecords: { picks: RecordPick[]; fetchedAt: number } | null = null

function freshRecords(): RecordPick[] | null {
    if (!latestRecords || Date.now() - latestRecords.fetchedAt > RECORDS_TTL_MS) return null
    return latestRecords.picks
}

function isAbort(error: unknown): boolean {
    return (error as { name?: string } | null)?.name === 'AbortError'
}

export function useMapSearch(term: string | null, accessToken: string): MapSearch {
    const [found, setFound] = useState<{ term: string; maps: MapPick[] } | null>(null)

    useEffect(() => {
        if (term === null) return
        const controller = new AbortController()
        const timer = setTimeout(() => {
            fetchMapsFuzzy(accessToken, term, SEARCH_LIMIT, controller.signal)
                .then(rows => setFound({ term, maps: mapPicks(rows) }))
                .catch(error => {
                    if (!isAbort(error)) setFound({ term, maps: [] })
                })
        }, SEARCH_DEBOUNCE_MS)
        return () => {
            controller.abort()
            clearTimeout(timer)
        }
    }, [term, accessToken])

    if (term === null) return IDLE
    return found && found.term === term ? { status: 'ready', maps: found.maps } : SEARCHING
}

export function useLatestRecords(accessToken: string): RecordPick[] | null {
    const [picks, setPicks] = useState<RecordPick[] | null>(freshRecords)

    useEffect(() => {
        if (picks !== null) return
        let cancelled = false
        fetchWorldRecords(accessToken, { sortBy: 'date', sort: 'desc', limit: RECORDS_FETCHED })
            .then(records => recordPicks(records))
            .catch((): RecordPick[] => [])
            .then(next => {
                if (next.length > 0) latestRecords = { picks: next, fetchedAt: Date.now() }
                if (!cancelled) setPicks(next)
            })
        return () => { cancelled = true }
    }, [picks, accessToken])

    return picks
}
