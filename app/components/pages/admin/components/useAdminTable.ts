import { useCallback, useMemo, useState } from 'react'

export interface AdminColumn {
  id: string
  label: string
  required?: boolean
}

interface Prefs {
  hidden: string[]
  order: string[]
  filtersOpen: boolean
}

function normalizeOrder(savedOrder: unknown, columns: AdminColumn[]): string[] {
  const known = columns.map((c) => c.id)
  const saved = Array.isArray(savedOrder) ? (savedOrder as unknown[]).filter((id): id is string => typeof id === 'string' && known.includes(id)) : []
  return [...saved, ...known.filter((id) => !saved.includes(id))]
}

function load(key: string, columns: AdminColumn[], defaultHidden: string[], defaultFiltersOpen: boolean): Prefs {
  const base: Prefs = { hidden: defaultHidden, order: columns.map((c) => c.id), filtersOpen: defaultFiltersOpen }
  if (typeof window === 'undefined') return base
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return base
    const p = JSON.parse(raw)
    return {
      hidden: Array.isArray(p.hidden) ? p.hidden : defaultHidden,
      order: normalizeOrder(p.order, columns),
      filtersOpen: typeof p.filtersOpen === 'boolean' ? p.filtersOpen : defaultFiltersOpen,
    }
  } catch {
    return base
  }
}

export function useAdminTable(storageKey: string, columns: AdminColumn[], opts?: { defaultHidden?: string[]; defaultFiltersOpen?: boolean }) {
  const defaultHidden = opts?.defaultHidden ?? []
  const defaultFiltersOpen = opts?.defaultFiltersOpen ?? true
  const [prefs, setPrefs] = useState<Prefs>(() => load(storageKey, columns, defaultHidden, defaultFiltersOpen))

  const required = useMemo(() => new Set(columns.filter((c) => c.required).map((c) => c.id)), [columns])
  const hidden = useMemo(() => new Set(prefs.hidden.filter((id) => !required.has(id))), [prefs.hidden, required])

  const isVisible = useCallback((id: string) => !hidden.has(id), [hidden])
  const visibility = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, !hidden.has(c.id)])) as Record<string, boolean>,
    [columns, hidden],
  )
  const visibleCount = columns.filter((c) => !hidden.has(c.id)).length

  const columnLabels = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, c.label])) as Record<string, string>,
    [columns],
  )
  const columnOrder = useMemo(() => normalizeOrder(prefs.order, columns), [prefs.order, columns])

  const persist = useCallback((next: Prefs) => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
  }, [storageKey])

  const toggle = useCallback((id: string) => {
    if (required.has(id)) return
    setPrefs((prev) => {
      const set = new Set(prev.hidden)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      const next = { ...prev, hidden: [...set] }
      persist(next)
      return next
    })
  }, [required, persist])

  const onReorder = useCallback((source: string, target: string) => {
    if (source === target) return
    setPrefs((prev) => {
      const order = normalizeOrder(prev.order, columns)
      const from = order.indexOf(source)
      if (from === -1) return prev
      order.splice(from, 1)
      const to = order.indexOf(target)
      if (to === -1) return prev
      order.splice(to, 0, source)
      const next = { ...prev, order }
      persist(next)
      return next
    })
  }, [columns, persist])

  const setFiltersOpen = useCallback((open: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, filtersOpen: open }
      persist(next)
      return next
    })
  }, [persist])

  return {
    isVisible, visibility, visibleCount, toggle, columns,
    columnOrder, columnLabels, onReorder, requiredColumns: required,
    filtersOpen: prefs.filtersOpen, setFiltersOpen,
  }
}
