export type PlaybackMediaEvent = 'waiting' | 'seeking' | 'seeked' | 'canplay' | 'error'

export interface PlaybackMedia {
    play: () => void
    pause: () => void
    seek: (time: number) => void
    currentTime: () => number
    duration: () => number
    canPlay: () => boolean
    setRate: (rate: number) => void
    setMuted: (muted: boolean) => void
    subscribe: (listener: (event: PlaybackMediaEvent) => void) => () => void
}

export interface PlaybackTimeSource {
    now: () => number
    requestFrame: (callback: () => void) => () => void
}
