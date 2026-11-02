import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hostOf, requestPath } from './data'
import type { ApiHost, FixtureRoute, FixtureSet } from './types'

export const RECORDED_DIR = join(__dirname, 'recorded')

export interface RecordedResponse {
    host: ApiHost
    path: string
    query: string
    status: number
    body: unknown
}

export interface Recording {
    set: string
    responses: RecordedResponse[]
}

export function emptyRecording(set: string): Recording {
    return { set, responses: [] }
}

function pairsOf(query: string): string[] {
    return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`)
}

export function canonicalQuery(query: string): string {
    const params = new URLSearchParams(query)
    params.sort()
    return params.toString()
}

function likeness(recorded: string, requested: string): number {
    const want = pairsOf(requested)
    const have = pairsOf(recorded)
    const shared = have.filter(pair => want.includes(pair)).length
    const keysOf = (pairs: string[]) => new Set(pairs.map(pair => pair.slice(0, pair.indexOf('='))))
    const wantKeys = keysOf(want)
    const haveKeys = keysOf(have)
    const strayKeys = [...haveKeys].filter(key => !wantKeys.has(key)).length + [...wantKeys].filter(key => !haveKeys.has(key)).length
    return shared * 2 - strayKeys
}

export function pickRecorded(responses: readonly RecordedResponse[], url: URL): RecordedResponse | undefined {
    const host = hostOf(url)
    const path = requestPath(url)
    const query = canonicalQuery(url.search)
    const candidates = responses.filter(entry => entry.host === host && entry.path === path)
    const exact = candidates.find(entry => entry.query === query)
    if (exact) return exact
    return candidates.reduce<RecordedResponse | undefined>(
        (best, entry) => !best || likeness(entry.query, query) > likeness(best.query, query) ? entry : best,
        undefined,
    )
}

function requestKey(entry: RecordedResponse): string {
    return `${entry.host} ${entry.path}?${entry.query}`
}

export function addResponse(recording: Recording, response: RecordedResponse): Recording {
    const entry = { ...response, query: canonicalQuery(response.query) }
    if (recording.responses.some(existing => requestKey(existing) === requestKey(entry))) return recording
    const responses = [...recording.responses, entry].sort((a, b) => requestKey(a) < requestKey(b) ? -1 : requestKey(a) > requestKey(b) ? 1 : 0)
    return { ...recording, responses }
}

export const LIST_LIMIT = 300

function hasLongList(value: unknown, limit: number): boolean {
    if (Array.isArray(value)) return value.length > limit || value.some(item => hasLongList(item, limit))
    return Boolean(value) && typeof value === 'object' && Object.values(value as object).some(field => hasLongList(field, limit))
}

function stringsIn(value: unknown, into: Set<string>): Set<string> {
    if (typeof value === 'string') into.add(value)
    else if (value && typeof value === 'object') for (const field of Object.values(value)) stringsIn(field, into)
    return into
}

function mentions(row: unknown, mentioned: Set<string>): boolean {
    return [...stringsIn(row, new Set())].some(value => mentioned.has(value))
}

function trimmed(value: unknown, limit: number, mentioned: Set<string>): unknown {
    if (Array.isArray(value)) {
        const items = value.map(item => trimmed(item, limit, mentioned))
        if (items.length <= limit) return items
        const kept = new Set(items.filter(item => mentions(item, mentioned)).slice(0, limit))
        for (const item of items) if (kept.size < limit) kept.add(item)
        return items.filter(item => kept.has(item))
    }
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, trimmed(field, limit, mentioned)]))
}

export function trimRecording(recording: Recording, limit = LIST_LIMIT): Recording {
    const mentioned = new Set<string>()
    for (const entry of recording.responses) if (!hasLongList(entry.body, limit)) stringsIn(entry.body, mentioned)
    return {
        ...recording,
        responses: recording.responses.map(entry => hasLongList(entry.body, limit) ? { ...entry, body: trimmed(entry.body, limit, mentioned) } : entry),
    }
}

function recordingFile(set: string): string {
    return join(RECORDED_DIR, `${set}.json`)
}

export function hasRecording(set: string): boolean {
    return existsSync(recordingFile(set))
}

export function readRecording(set: string): Recording {
    return JSON.parse(readFileSync(recordingFile(set), 'utf8')) as Recording
}

export function writeRecording(recording: Recording): void {
    mkdirSync(RECORDED_DIR, { recursive: true })
    writeFileSync(recordingFile(recording.set), `${JSON.stringify(recording, null, 2)}\n`)
}

export function recordedFixtureSet(set: string): FixtureSet {
    return fixtureSetOf(readRecording(set))
}

export function fixtureSetOf({ set, responses }: Recording): FixtureSet {
    const paths = [...new Set(responses.map(entry => `${entry.host} ${entry.path}`))]
    const routes: FixtureRoute[] = paths.map(key => {
        const [host, path] = key.split(' ') as [ApiHost, string]
        return {
            host,
            path,
            reply: url => {
                const entry = pickRecorded(responses, url)!
                return { status: entry.status, json: entry.body }
            },
        }
    })
    return { name: set, routes }
}
