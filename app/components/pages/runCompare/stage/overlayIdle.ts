import { OVERLAY_IDLE_MS } from '../model/overlayModel'
import type { PlaybackController } from '../playback/playbackController'

export type PlayingSource = Pick<PlaybackController, 'getState' | 'subscribe'>

export interface OverlayIdleWatch {
    wake: () => void
    dispose: () => void
}

export function watchOverlayIdle(source: PlayingSource, onShown: (shown: boolean) => void): OverlayIdleWatch {
    let playing = source.getState().playing
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
        clearTimeout(timer)
        if (playing) timer = setTimeout(() => onShown(false), OVERLAY_IDLE_MS)
    }
    const wake = () => {
        onShown(true)
        arm()
    }
    const unsubscribe = source.subscribe(() => {
        const next = source.getState().playing
        if (next === playing) return
        playing = next
        wake()
    })
    arm()
    return {
        wake,
        dispose: () => {
            clearTimeout(timer)
            unsubscribe()
        },
    }
}
