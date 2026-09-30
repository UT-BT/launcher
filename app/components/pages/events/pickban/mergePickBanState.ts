import type { PickBanState } from '@/app/utils/api'

const IDENTITY_FIELD_BY_COLLECTION: { [collection: string]: string } = {
    plan: 'index',
    pool: 'map',
    members: 'id',
}

function isRecord(value: unknown): value is { [key: string]: unknown } {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shareArray(previous: unknown[], next: unknown[], identityField: string | undefined): unknown[] {
    const keyOf = (item: unknown, index: number) => (identityField && isRecord(item) ? item[identityField] : index)
    const previousByKey = new Map(previous.map((item, index) => [keyOf(item, index), item]))
    const merged = next.map((item, index) => {
        const key = keyOf(item, index)
        return previousByKey.has(key) ? share(previousByKey.get(key), item) : item
    })
    const unchanged = merged.length === previous.length && merged.every((item, index) => item === previous[index])
    return unchanged ? previous : merged
}

function shareRecord(previous: { [key: string]: unknown }, next: { [key: string]: unknown }): { [key: string]: unknown } {
    const merged: { [key: string]: unknown } = {}
    let unchanged = Object.keys(previous).length === Object.keys(next).length
    for (const key of Object.keys(next)) {
        const known = key in previous
        merged[key] = known ? share(previous[key], next[key], IDENTITY_FIELD_BY_COLLECTION[key]) : next[key]
        if (!known || merged[key] !== previous[key]) unchanged = false
    }
    return unchanged ? previous : merged
}

function share(previous: unknown, next: unknown, identityField?: string): unknown {
    if (Object.is(previous, next)) return previous
    if (Array.isArray(previous) && Array.isArray(next)) return shareArray(previous, next, identityField)
    if (isRecord(previous) && isRecord(next)) return shareRecord(previous, next)
    return next
}

export function mergePickBanState(previous: PickBanState | null, next: PickBanState): PickBanState {
    return previous === null ? next : (share(previous, next) as PickBanState)
}
