import type { StreamCaster } from '../../streamDesk'

export const CASTERS_MAX = 4
export const CASTER_NAME_MAX = 40
export const BRB_MESSAGE_MAX = 200

export interface CasterEntry {
    userId: string | null
    name: string
}

export type CasterPayloadEntry = { user: string } | { name: string }

export function castersFromDesk(casters: StreamCaster[]): CasterEntry[] {
    return casters.map(caster => ({ userId: caster.id, name: caster.display_name ?? '' }))
}

export function canAddCaster(entries: CasterEntry[]): boolean {
    return entries.length < CASTERS_MAX
}

export function addUserCaster(entries: CasterEntry[], userId: string, name: string): CasterEntry[] {
    if (!canAddCaster(entries) || entries.some(entry => entry.userId === userId)) return entries
    return [...entries, { userId, name }]
}

export function addNamedCaster(entries: CasterEntry[], rawName: string): CasterEntry[] {
    const name = rawName.trim().slice(0, CASTER_NAME_MAX)
    if (!name || !canAddCaster(entries)) return entries
    if (entries.some(entry => entry.userId === null && entry.name.toLowerCase() === name.toLowerCase())) return entries
    return [...entries, { userId: null, name }]
}

export function removeCaster(entries: CasterEntry[], index: number): CasterEntry[] {
    if (index < 0 || index >= entries.length) return entries
    return entries.filter((_, position) => position !== index)
}

export function moveCaster(entries: CasterEntry[], index: number, offset: -1 | 1): CasterEntry[] {
    const target = index + offset
    if (index < 0 || index >= entries.length || target < 0 || target >= entries.length) return entries
    const moved = [...entries]
    moved[index] = entries[target]
    moved[target] = entries[index]
    return moved
}

export function casterPayload(entries: CasterEntry[]): CasterPayloadEntry[] {
    return entries.map(entry => (entry.userId !== null ? { user: entry.userId } : { name: entry.name }))
}

export function casterUserIds(entries: CasterEntry[]): Set<string> {
    return new Set(entries.flatMap(entry => (entry.userId !== null ? [entry.userId] : [])))
}
