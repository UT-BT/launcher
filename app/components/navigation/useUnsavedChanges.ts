import { useEffect, useId, useRef } from 'react'
import { useNavigation } from './NavigationContext'

/**
 * Warn before losing edits that only exist in component state.
 *
 * Covers both ways out: `registerLeaveGuard` catches in-app navigation, and
 * `beforeunload` catches a reload, a closed tab, and the real anchor links the
 * web build uses for its nav targets.
 */
export function useUnsavedChanges(dirty: boolean, message: string) {
    const { registerLeaveGuard } = useNavigation()
    const key = useId()
    const state = useRef({ dirty, message })
    state.current = { dirty, message }

    useEffect(
        () => registerLeaveGuard(key, () => (state.current.dirty ? state.current.message : null)),
        [key, registerLeaveGuard],
    )

    useEffect(() => {
        if (!dirty) return

        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            // Browsers show their own wording; a non-empty value is what arms it.
            event.returnValue = message
        }

        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty, message])
}
