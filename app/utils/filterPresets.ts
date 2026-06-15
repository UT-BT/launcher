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
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.map((p: { filters?: PresetFilterShape }) => {
            if (migrate && p?.filters) p.filters = migrate(p.filters)
            return p as FilterPreset<T>
        })
    } catch {
        return []
    }
}

export function persistPresets<T>(storageKey: string, presets: FilterPreset<T>[]): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify(presets))
    } catch {
        return
    }
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
