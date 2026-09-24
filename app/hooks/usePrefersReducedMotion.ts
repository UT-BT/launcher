import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(onChange: () => void): () => void {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
}

function prefersReducedMotion(): boolean {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion, () => false)
}
