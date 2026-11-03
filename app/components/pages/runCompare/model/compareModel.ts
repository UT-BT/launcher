import { displayMapName } from '@/app/utils/format'
import type { LoadedSoloRuns, SoloRun } from '../loading/soloRuns'
import { MAX_COMPARE_RUNS, parseCompareQuery, serializeCompareQuery, type CompareNotice, type CompareParam } from '../url/compareUrl'

export type LoadDropReason = 'not-found' | 'different-map' | 'disallowed'

export type CompareDrop = CompareNotice | { param: 'runs'; reason: LoadDropReason; value: string }

export interface CompareModelInput {
    query: string
    runs: LoadedSoloRuns
}

export interface CompareModel {
    loading: boolean
    runs: SoloRun[]
    map: string | null
    drops: CompareDrop[]
    noticeLine: string | null
    title: string | null
    query: string
    seekSeconds: number | null
}

const NOUNS: Record<CompareParam, [string, string]> = {
    runs: ['run', 'runs'],
    ref: ['reference', 'references'],
    data: ['data-only entry', 'data-only entries'],
    off: ['offset', 'offsets'],
    pair: ['pairing', 'pairings'],
    drive: ['driving pair', 'driving pairs'],
    sync: ['sync mode', 'sync modes'],
    t: ['start time', 'start times'],
}

function dropLabel(drop: CompareDrop, plural: boolean): string {
    const [one, many] = NOUNS[drop.param]
    const noun = plural ? many : one
    if (drop.param === 'runs') {
        switch (drop.reason) {
            case 'malformed': return plural ? 'malformed run ids' : 'malformed run id'
            case 'over-cap': return `${noun} past the limit of ${MAX_COMPARE_RUNS}`
            case 'not-found': return `${noun} that could not be loaded`
            case 'different-map': return `${noun} on another map`
            case 'disallowed': return `disallowed ${noun}`
        }
    }
    if (drop.param === 'sync') return `unknown ${noun}`
    if (drop.param === 't') return `invalid ${noun}`
    switch (drop.reason) {
        case 'malformed': return `malformed ${noun}`
        case 'duplicate': return `repeated ${noun}`
        default: return `${noun} outside the comparison`
    }
}

function joinAnd(parts: string[]): string {
    return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function noticeLineFor(drops: readonly CompareDrop[]): string | null {
    if (drops.length === 0) return null
    const counts = new Map<string, { drop: CompareDrop; count: number }>()
    for (const drop of drops) {
        const key = `${drop.param}:${drop.reason}`
        const seen = counts.get(key)
        if (seen) seen.count += 1
        else counts.set(key, { drop, count: 1 })
    }
    const parts = [...counts.values()].map(({ drop, count }) => `${count} ${dropLabel(drop, count > 1)}`)
    return `Dropped ${joinAnd(parts)}.`
}

function nameOf(run: SoloRun): string {
    return run.alias?.trim() || run.user
}

export function compareTitle(runs: readonly SoloRun[], map: string | null): string | null {
    if (runs.length === 0 || !map) return null
    const where = `on ${displayMapName(map)}`
    const [first, second] = runs.map(nameOf)
    if (runs.length === 1) return `${first} ${where}`
    if (runs.length === 2) return `${first} vs ${second} ${where}`
    return `${first}, ${second} and ${runs.length - 2} more ${where}`
}

function loadDrop(run: SoloRun | null, map: string | null): LoadDropReason | null {
    if (!run) return 'not-found'
    if (run.disallowed) return 'disallowed'
    if (map !== null && run.map !== map) return 'different-map'
    return null
}

export function composeCompareModel({ query, runs: loaded }: CompareModelInput): CompareModel {
    const decoded = parseCompareQuery(query)
    const seekSeconds = decoded.state.t

    if (decoded.state.runs.some(capId => !loaded.has(capId))) {
        return { loading: true, runs: [], map: null, drops: [], noticeLine: null, title: null, query, seekSeconds }
    }

    const kept: SoloRun[] = []
    const loadDrops: CompareDrop[] = []
    let map: string | null = null
    for (const capId of decoded.state.runs) {
        const run = loaded.get(capId) ?? null
        const reason = loadDrop(run, map)
        if (reason) {
            loadDrops.push({ param: 'runs', reason, value: capId })
            continue
        }
        map ??= run!.map
        kept.push(run!)
    }

    const restated = parseCompareQuery(serializeCompareQuery({ ...decoded.state, runs: kept.map(run => run.capId), t: null }))
    const drops = [...decoded.notices, ...loadDrops, ...restated.notices]

    return {
        loading: false,
        runs: kept,
        map,
        drops,
        noticeLine: noticeLineFor(drops),
        title: compareTitle(kept, map),
        query: serializeCompareQuery(restated.state),
        seekSeconds,
    }
}
