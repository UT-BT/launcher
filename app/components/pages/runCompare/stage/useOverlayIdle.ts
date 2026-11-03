import { useEffect, useState } from 'react'
import type { PlaybackController } from '../playback/playbackController'
import { watchOverlayIdle } from './overlayIdle'

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown'] as const

export function useOverlayIdle(controller: PlaybackController | null): boolean {
    const [shown, setShown] = useState(true)

    useEffect(() => {
        if (!controller) return
        const watch = watchOverlayIdle(controller, setShown)
        WAKE_EVENTS.forEach(type => window.addEventListener(type, watch.wake, { passive: true }))
        return () => {
            watch.dispose()
            WAKE_EVENTS.forEach(type => window.removeEventListener(type, watch.wake))
        }
    }, [controller])

    return shown
}
