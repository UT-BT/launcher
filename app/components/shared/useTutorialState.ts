import { useCallback, useEffect, useState } from 'react'

interface TutorialState {
    seen: boolean
    version: 1
}

const DEFAULT: TutorialState = { seen: false, version: 1 }

function load(key: string): TutorialState {
    if (typeof window === 'undefined') return DEFAULT
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return DEFAULT
        const parsed = JSON.parse(raw)
        return { ...DEFAULT, ...parsed }
    } catch {
        return DEFAULT
    }
}

export function useTutorialState(storageKey: string) {
    const [state, setState] = useState<TutorialState>(() => load(storageKey))

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state))
        } catch {
            // localStorage may be full or unavailable; swallow.
        }
    }, [state, storageKey])

    const markSeen = useCallback(() => setState(s => ({ ...s, seen: true })), [])
    const resetSeen = useCallback(() => setState(s => ({ ...s, seen: false })), [])

    return {
        seen: state.seen,
        markSeen,
        resetSeen,
    }
}
