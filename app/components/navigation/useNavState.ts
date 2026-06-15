import { useCallback } from 'react'
import { useNavigation } from './NavigationContext'

/**
 * Per-history-entry UI state. Reads/writes a key on the active navigation
 * entry's state bag, so the value survives Back/Forward to that entry while
 * staying scoped to that single visit. Use for detail-page transient UI state
 * (search/sort/tab/pagination/scroll/expansion) — NOT fetched data, which
 * refetches on remount. See agents/state-patterns.md.
 */
export function useNavState<T>(key: string, def: T): [T, (value: T) => void] {
    const { getEntryState, setEntryState } = useNavigation()
    const value = getEntryState(key, def)
    const set = useCallback((v: T) => setEntryState(key, v), [key, setEntryState])
    return [value, set]
}
