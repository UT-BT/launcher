import { useEffect, useState } from 'react'

import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'

export interface FilterPreset<TFilters> {
    id: string
    name: string
    filters: TFilters
}

type PresetFilterShape = Record<string, unknown>

export function loadPresets<T>(
    storageKey: string,
    migrate?: (filters: PresetFilterShape) => PresetFilterShape,
): FilterPreset<T>[] {
    const parsed = getSynced<unknown>(storageKey, [])
    if (!Array.isArray(parsed)) return []
    const presets: FilterPreset<T>[] = []
    for (const p of parsed as { filters?: PresetFilterShape }[]) {
        try {
            if (migrate && p?.filters) p.filters = migrate(p.filters)
            presets.push(p as FilterPreset<T>)
        } catch { /* skip malformed presets, e.g. written by another client version */ }
    }
    return presets
}

export function persistPresets<T>(storageKey: string, presets: FilterPreset<T>[]): void {
    setSynced(storageKey, presets)
}

export function useSyncedPresets<T>(
    storageKey: string,
    migrate?: (filters: PresetFilterShape) => PresetFilterShape,
) {
    const [presets, setPresets] = useState<FilterPreset<T>[]>(() => loadPresets<T>(storageKey, migrate))
    useEffect(
        () => subscribeSynced(storageKey, () => setPresets(loadPresets<T>(storageKey, migrate))),
        [storageKey, migrate],
    )
    return [presets, setPresets] as const
}

export function newPresetId(): string {
    try {
        return crypto.randomUUID()
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }
}

export function presetFiltersMatch<T extends object>(a: T, b: T): boolean {
    return (Object.keys(b) as (keyof T)[]).every(k => {
        const av = a[k]
        const bv = b[k]
        if (Array.isArray(av) && Array.isArray(bv)) {
            if (av.length !== bv.length) return false
            const sa = [...av].sort()
            const sb = [...bv].sort()
            return sa.every((v, i) => v === sb[i])
        }
        return av === bv
    })
}
