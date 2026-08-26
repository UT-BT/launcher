import { useEffect, useId, useRef } from 'react'
import { useNavigation } from './NavigationContext'

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
            event.returnValue = message
        }

        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty, message])
}
