import { useCallback } from 'react'
import { useNavigation } from './NavigationContext'

export function useNavState<T>(key: string, def: T): [T, (value: T) => void] {
    const { getEntryState, setEntryState } = useNavigation()
    const value = getEntryState(key, def)
    const set = useCallback((v: T) => setEntryState(key, v), [key, setEntryState])
    return [value, set]
}
