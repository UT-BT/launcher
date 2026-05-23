import { useCallback, useEffect, useState } from 'react'

const KEY = 'utbt:mapsPageTutorial:v1'

interface TutorialState {
    seen: boolean
    version: 1
}

const DEFAULT: TutorialState = { seen: false, version: 1 }

function load(): TutorialState {
    if (typeof window === 'undefined') return DEFAULT
    try {
        const raw = window.localStorage.getItem(KEY)
        if (!raw) return DEFAULT
        const parsed = JSON.parse(raw)
        return { ...DEFAULT, ...parsed }
    } catch {
        return DEFAULT
    }
}

export function useMapsTutorialState() {
    const [state, setState] = useState<TutorialState>(load)

    useEffect(() => {
        try {
            window.localStorage.setItem(KEY, JSON.stringify(state))
        } catch {
            // localStorage may be full or unavailable; swallow.
        }
    }, [state])

    const markSeen = useCallback(() => setState(s => ({ ...s, seen: true })), [])
    const resetSeen = useCallback(() => setState(s => ({ ...s, seen: false })), [])

    return {
        seen: state.seen,
        markSeen,
        resetSeen,
    }
}
