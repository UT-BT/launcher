import { useSyncExternalStore, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(onChange: () => void): () => void {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}

function prefersReducedMotion(): boolean {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function PickBanMotionConfig({ children }: { children: ReactNode }) {
    const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion, () => false)
    return <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>{children}</MotionConfig>
}
