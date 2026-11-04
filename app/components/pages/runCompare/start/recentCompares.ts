import { useState } from 'react'
import { parseCompareQuery, serializeCompareQuery } from '../url/compareUrl'

const STORAGE_KEY = 'utbt:compareRecent:v1'
export const RECENT_LIMIT = 6
export const RECENT_NAME_MAX = 60

export interface RecentCompare {
    key: string
    query: string
    title: string
    name: string | null
    map: string
    runs: number
    team: boolean
    at: number
}

export interface RecentInput {
    query: string
    title: string
    map: string
    runs: number
    team: boolean
}

function isRecent(value: unknown): value is Omit<RecentCompare, 'name'> & { name?: unknown } {
    if (typeof value !== 'object' || value === null) return false
    const entry = value as Record<string, unknown>
    return typeof entry.key === 'string' && typeof entry.query === 'string' && typeof entry.title === 'string'
        && typeof entry.map === 'string' && typeof entry.runs === 'number' && typeof entry.team === 'boolean'
        && typeof entry.at === 'number'
}

export function parseRecent(raw: string | null): RecentCompare[] {
    try {
        const value: unknown = JSON.parse(raw ?? '[]')
        if (!Array.isArray(value)) return []
        return value.filter(isRecent).slice(0, RECENT_LIMIT).map(entry => ({ ...entry, name: typeof entry.name === 'string' ? entry.name : null }))
    } catch {
        return []
    }
}

export function recentEntry(input: RecentInput, at: number): RecentCompare | null {
    const { state } = parseCompareQuery(input.query)
    if (state.runs.length === 0) return null
    return {
        key: [...state.runs].sort().join(','),
        query: serializeCompareQuery({ ...state, t: null }),
        title: input.title,
        name: null,
        map: input.map,
        runs: input.runs,
        team: input.team,
        at,
    }
}

export function withRecent(list: readonly RecentCompare[], entry: RecentCompare): RecentCompare[] {
    const name = list.find(item => item.key === entry.key)?.name ?? entry.name
    return [{ ...entry, name }, ...list.filter(item => item.key !== entry.key)].slice(0, RECENT_LIMIT)
}

export function cleanRecentName(raw: string): string | null {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, RECENT_NAME_MAX)
    return name.length > 0 ? name : null
}

export function renamedRecent(list: readonly RecentCompare[], key: string, raw: string): RecentCompare[] {
    return list.map(item => (item.key === key ? { ...item, name: cleanRecentName(raw) } : item))
}

export function recentLabel(entry: RecentCompare, mapName: string): string {
    if (entry.name) return entry.name
    const suffix = ` on ${mapName}`
    return entry.title.endsWith(suffix) ? entry.title.slice(0, -suffix.length) : entry.title
}

function loadRecent(): RecentCompare[] {
    try {
        return parseRecent(window.localStorage.getItem(STORAGE_KEY))
    } catch {
        return []
    }
}

function saveRecent(list: readonly RecentCompare[]): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
        return
    }
}

export function rememberCompare(input: RecentInput): void {
    const entry = recentEntry(input, Date.now())
    if (entry) saveRecent(withRecent(loadRecent(), entry))
}

export interface RecentCompares {
    list: RecentCompare[]
    rename: (key: string, name: string) => void
    remove: (key: string) => void
    clear: () => void
}

export function useRecentCompares(): RecentCompares {
    const [list, setList] = useState(loadRecent)
    const update = (next: RecentCompare[]) => {
        saveRecent(next)
        setList(next)
    }
    return {
        list,
        rename: (key, name) => update(renamedRecent(list, key, name)),
        remove: key => update(list.filter(item => item.key !== key)),
        clear: () => update([]),
    }
}
