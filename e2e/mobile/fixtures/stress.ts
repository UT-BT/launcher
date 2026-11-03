export const STRESS_VARIANTS = ['long-text', 'most-columns', 'empty', 'single-row'] as const

export type StressVariant = (typeof STRESS_VARIANTS)[number]

const MAP_KEYS = new Set(['map', 'map_name', 'mapName', 'mapname'])
const NAME_KEYS = new Set(['alias', 'name', 'author', 'title', 'hostname', 'team_name', 'teamName', 'display_name', 'displayName', 'username'])
const MAP_SUFFIX = '-RemasteredWithAnExtraordinarilyLongMapNameEdition'
const NAME_SUFFIX = '-TheUnbelievablyLongPlayerAliasOfDoom'

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEmpty(value: unknown): boolean {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
}

function looksLikeMap(key: string, value: string): boolean {
    return MAP_KEYS.has(key) || (key === 'name' && /^[A-Z]{2,4}-/.test(value))
}

function stretched(key: string, value: unknown): unknown {
    if (typeof value !== 'string' || !value) return value
    if (looksLikeMap(key, value)) return `${value}${MAP_SUFFIX}`
    if (NAME_KEYS.has(key)) return `${value}${NAME_SUFFIX}`
    return value
}

function longText(value: unknown, inRow: boolean): unknown {
    if (Array.isArray(value)) return value.map(item => longText(item, true))
    if (!isObject(value)) return value
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, inRow ? stretched(key, longText(field, true)) : longText(field, false)]))
}

function filledRows(rows: unknown[]): unknown[] {
    const objects = rows.filter(isObject)
    if (objects.length !== rows.length) return rows
    const donor: Json = {}
    for (const row of objects) {
        for (const [key, field] of Object.entries(row)) {
            if (!(key in donor) || isEmpty(donor[key])) donor[key] = field
        }
    }
    return objects.map(row => {
        const filled: Json = { ...row }
        for (const [key, field] of Object.entries(donor)) if (isEmpty(filled[key]) && !isEmpty(field) && !Array.isArray(field)) filled[key] = field
        return filled
    })
}

function mostColumns(value: unknown): unknown {
    if (Array.isArray(value)) return filledRows(value.map(mostColumns))
    if (!isObject(value)) return value
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, mostColumns(field)]))
}

function resized(value: unknown, keep: 0 | 1): unknown {
    if (Array.isArray(value)) return value.slice(0, keep).map(item => resized(item, keep))
    if (!isObject(value)) return value
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [
        key,
        key === 'count' && typeof field === 'number' ? Math.min(field, keep) : resized(field, keep),
    ]))
}

export function stressed(variant: StressVariant, body: unknown): unknown {
    switch (variant) {
        case 'long-text': return longText(body, false)
        case 'most-columns': return mostColumns(body)
        case 'empty': return resized(body, 0)
        case 'single-row': return resized(body, 1)
    }
}
