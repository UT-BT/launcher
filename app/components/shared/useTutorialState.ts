import { useCallback, useEffect, useState } from 'react'
import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'

interface TutorialState {
    seen: boolean
    version: 1
}

const DEFAULT: TutorialState = { seen: false, version: 1 }

function load(key: string): TutorialState {
    const stored = getSynced<Partial<TutorialState> | null>(key, null)
    return stored ? { ...DEFAULT, ...stored } : DEFAULT
}

export function useTutorialState(storageKey: string) {
    const [state, setState] = useState<TutorialState>(() => load(storageKey))

    useEffect(() => subscribeSynced(storageKey, () => setState(load(storageKey))), [storageKey])

    const markSeen = useCallback(() => {
        setState(s => {
            const next = { ...s, seen: true }
            setSynced(storageKey, next)
            return next
        })
    }, [storageKey])

    const resetSeen = useCallback(() => {
        setState(s => {
            const next = { ...s, seen: false }
            setSynced(storageKey, next)
            return next
        })
    }, [storageKey])

    return {
        seen: state.seen,
        markSeen,
        resetSeen,
    }
}
