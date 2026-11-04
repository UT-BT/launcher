export const MAX_COMPARE_RUNS = 10

export type CompareSync = 'race' | 'position'

export interface CompareOffset {
    capId: string
    ms: number
}

export interface ComparePair {
    runner: string
    reference: string
}

export interface CompareUrlState {
    runs: string[]
    refs: string[]
    data: string[]
    offsets: CompareOffset[]
    pairs: ComparePair[]
    drive: string | null
    sync: CompareSync
    t: number | null
}

export type CompareParam = 'runs' | 'ref' | 'data' | 'off' | 'pair' | 'drive' | 'sync' | 't'

export type CompareNoticeReason = 'malformed' | 'duplicate' | 'over-cap' | 'outside-set'

export interface CompareNotice {
    param: CompareParam
    reason: CompareNoticeReason
    value: string
}

export interface ParsedCompareUrl {
    state: CompareUrlState
    notices: CompareNotice[]
}

export const EMPTY_COMPARE_STATE: CompareUrlState = {
    runs: [],
    refs: [],
    data: [],
    offsets: [],
    pairs: [],
    drive: null,
    sync: 'race',
    t: null,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INTEGER = /^-?\d+$/
const SECONDS = /^\d+(\.\d+)?$/

function idOf(raw: string): string | null {
    const value = raw.trim()
    return UUID.test(value) ? value.toLowerCase() : null
}

function listOf(query: URLSearchParams, key: CompareParam): string[] {
    return query.getAll(key).flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean)
}

function singleOf(query: URLSearchParams, key: CompareParam): string | null {
    const value = query.get(key)?.trim()
    return value ? value : null
}

function parseRuns(query: URLSearchParams, notices: CompareNotice[]): string[] {
    const runs: string[] = []
    for (const raw of listOf(query, 'runs')) {
        const id = idOf(raw)
        if (!id) notices.push({ param: 'runs', reason: 'malformed', value: raw })
        else if (runs.includes(id)) notices.push({ param: 'runs', reason: 'duplicate', value: id })
        else if (runs.length >= MAX_COMPARE_RUNS) notices.push({ param: 'runs', reason: 'over-cap', value: id })
        else runs.push(id)
    }
    return runs
}

function parseIds(query: URLSearchParams, key: CompareParam, allowed: ReadonlySet<string>, notices: CompareNotice[]): string[] {
    const ids: string[] = []
    for (const raw of listOf(query, key)) {
        const id = idOf(raw)
        if (!id) notices.push({ param: key, reason: 'malformed', value: raw })
        else if (ids.includes(id)) notices.push({ param: key, reason: 'duplicate', value: id })
        else if (!allowed.has(id)) notices.push({ param: key, reason: 'outside-set', value: id })
        else ids.push(id)
    }
    return ids
}

function parseOffsets(query: URLSearchParams, allowed: ReadonlySet<string>, notices: CompareNotice[]): CompareOffset[] {
    const offsets: CompareOffset[] = []
    for (const raw of listOf(query, 'off')) {
        const [rawId, rawMs, ...rest] = raw.split(':')
        const capId = idOf(rawId)
        if (!capId || rawMs === undefined || rest.length > 0 || !INTEGER.test(rawMs.trim())) {
            notices.push({ param: 'off', reason: 'malformed', value: raw })
        } else if (offsets.some(offset => offset.capId === capId)) {
            notices.push({ param: 'off', reason: 'duplicate', value: capId })
        } else if (!allowed.has(capId)) {
            notices.push({ param: 'off', reason: 'outside-set', value: capId })
        } else {
            offsets.push({ capId, ms: Number(rawMs.trim()) })
        }
    }
    return offsets
}

function parsePairs(query: URLSearchParams, members: ReadonlySet<string>, notices: CompareNotice[]): ComparePair[] {
    const pairs: ComparePair[] = []
    for (const raw of listOf(query, 'pair')) {
        const [rawRunner, rawReference, ...rest] = raw.split(':')
        const runner = idOf(rawRunner)
        const reference = rawReference === undefined ? null : idOf(rawReference)
        const value = `${runner ?? rawRunner}:${reference ?? rawReference}`
        if (!runner || !reference || rest.length > 0 || runner === reference) {
            notices.push({ param: 'pair', reason: 'malformed', value: raw })
        } else if (pairs.some(pair => pair.runner === runner || (pair.runner === reference && pair.reference === runner))) {
            notices.push({ param: 'pair', reason: 'duplicate', value })
        } else if (!members.has(runner) || !members.has(reference)) {
            notices.push({ param: 'pair', reason: 'outside-set', value })
        } else {
            pairs.push({ runner, reference })
        }
    }
    return pairs
}

function parseDrive(query: URLSearchParams, members: ReadonlySet<string>, notices: CompareNotice[]): string | null {
    const raw = singleOf(query, 'drive')
    if (raw === null) return null
    const id = idOf(raw)
    if (!id) {
        notices.push({ param: 'drive', reason: 'malformed', value: raw })
        return null
    }
    if (!members.has(id)) {
        notices.push({ param: 'drive', reason: 'outside-set', value: id })
        return null
    }
    return id
}

function parseSync(query: URLSearchParams, notices: CompareNotice[]): CompareSync {
    const raw = singleOf(query, 'sync')
    if (raw === null) return 'race'
    if (raw === 'position') return 'position'
    notices.push({ param: 'sync', reason: 'malformed', value: raw })
    return 'race'
}

function parseSeconds(query: URLSearchParams, notices: CompareNotice[]): number | null {
    const raw = singleOf(query, 't')
    if (raw === null) return null
    if (!SECONDS.test(raw)) {
        notices.push({ param: 't', reason: 'malformed', value: raw })
        return null
    }
    return Math.round(Number(raw) * 1000) / 1000
}

export function parseCompareQuery(query: string, members: ReadonlySet<string> = new Set()): ParsedCompareUrl {
    const params = new URLSearchParams(query.replace(/^\?/, ''))
    const notices: CompareNotice[] = []
    const runs = parseRuns(params, notices)
    const inSet = new Set([...runs, ...members])
    const state: CompareUrlState = {
        runs,
        refs: parseIds(params, 'ref', new Set(runs), notices),
        data: parseIds(params, 'data', inSet, notices),
        offsets: parseOffsets(params, inSet, notices),
        pairs: parsePairs(params, members, notices),
        drive: parseDrive(params, members, notices),
        sync: parseSync(params, notices),
        t: parseSeconds(params, notices),
    }
    return { state, notices }
}

export function serializeCompareQuery(state: CompareUrlState): string {
    const parts: [CompareParam, string][] = [
        ['runs', state.runs.join(',')],
        ['ref', state.refs.join(',')],
        ['data', state.data.join(',')],
        ['off', state.offsets.map(offset => `${offset.capId}:${offset.ms}`).join(',')],
        ['pair', state.pairs.map(pair => `${pair.runner}:${pair.reference}`).join(',')],
        ['drive', state.drive ?? ''],
        ['sync', state.sync === 'position' ? 'position' : ''],
        ['t', state.t === null ? '' : state.t.toFixed(3)],
    ]
    return parts.filter(([, value]) => value !== '').map(([key, value]) => `${key}=${value}`).join('&')
}
