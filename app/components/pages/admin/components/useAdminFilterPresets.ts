import { useCallback, useMemo, useState } from 'react'
import {
  loadPresets, persistPresets, newPresetId, presetFiltersMatch, type FilterPreset,
} from '@/app/utils/filterPresets'

export function useAdminFilterPresets<TFilters extends object>(opts: {
  storageKey: string
  current: TFilters
  isDefault: (f: TFilters) => boolean
  onApply: (f: TFilters) => void
}) {
  const { storageKey, current, isDefault, onApply } = opts
  const [presets, setPresets] = useState<FilterPreset<TFilters>[]>(() => loadPresets<TFilters>(storageKey))
  const [activeId, setActiveId] = useState<string | null>(null)

  const persist = useCallback((next: FilterPreset<TFilters>[]) => {
    setPresets(next)
    persistPresets(storageKey, next)
  }, [storageKey])

  const onSave = useCallback((name: string, filters: TFilters) => {
    const id = newPresetId()
    persist([...presets, { id, name, filters }])
    setActiveId(id)
  }, [presets, persist])

  const onLoad = useCallback((preset: FilterPreset<TFilters>) => {
    setActiveId(preset.id)
    onApply(preset.filters)
  }, [onApply])

  const onDelete = useCallback((preset: FilterPreset<TFilters>) => {
    persist(presets.filter((p) => p.id !== preset.id))
    setActiveId((cur) => (cur === preset.id ? null : cur))
  }, [presets, persist])

  const activePreset = useMemo(() => {
    if (!activeId) return null
    const found = presets.find((p) => p.id === activeId)
    if (!found) return null
    return presetFiltersMatch(current, found.filters) ? found : null
  }, [activeId, presets, current])

  const captureCurrentFilters = useCallback(() => current, [current])

  return {
    presets,
    activePreset,
    hasActiveFilters: !isDefault(current),
    onSave,
    onLoad,
    onDelete,
    captureCurrentFilters,
  }
}
