import type { PlaybackMedia, PlaybackMediaEvent, PlaybackTimeSource } from './playbackMedia'

const HAVE_FUTURE_DATA = 3
const FORWARDED_EVENTS: readonly PlaybackMediaEvent[] = ['waiting', 'seeking', 'seeked', 'canplay', 'error']

export function createVideoMedia(video: HTMLVideoElement): PlaybackMedia {
    return {
        play: () => {
            Promise.resolve(video.play()).catch(() => undefined)
        },
        pause: () => video.pause(),
        seek: time => { video.currentTime = time },
        currentTime: () => video.currentTime,
        duration: () => video.duration,
        canPlay: () => video.readyState >= HAVE_FUTURE_DATA && !video.seeking,
        setRate: rate => { video.playbackRate = rate },
        setMuted: muted => { video.muted = muted },
        subscribe: listener => {
            const handlers = FORWARDED_EVENTS.map(event => [event, () => listener(event)] as const)
            handlers.forEach(([event, handler]) => video.addEventListener(event, handler))
            return () => handlers.forEach(([event, handler]) => video.removeEventListener(event, handler))
        },
    }
}

export const browserTimeSource: PlaybackTimeSource = {
    now: () => performance.now(),
    requestFrame: callback => {
        const id = requestAnimationFrame(callback)
        return () => cancelAnimationFrame(id)
    },
}
