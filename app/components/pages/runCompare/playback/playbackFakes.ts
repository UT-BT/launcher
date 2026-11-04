import type { PlaybackMedia, PlaybackMediaEvent, PlaybackTimeSource } from './playbackMedia'

export type MediaCommand =
    | { type: 'play' }
    | { type: 'pause' }
    | { type: 'seek'; time: number }
    | { type: 'rate'; rate: number }
    | { type: 'muted'; muted: boolean }

export interface FakeMediaOptions {
    ready?: boolean
    position?: number
    duration?: number
    startDelayMs?: number
    seekFrames?: number
    syncEvents?: boolean
}

export interface FakeMedia extends PlaybackMedia {
    readonly commands: MediaCommand[]
    readonly playing: boolean
    readonly seeking: boolean
    readonly rate: number
    position: number
    seeks: () => number[]
    clearCommands: () => void
    stall: () => void
    recover: () => void
    fail: () => void
    drift: (seconds: number) => void
    finishSeek: () => void
}

export interface FakeTime extends PlaybackTimeSource {
    readonly frameMs: number
    media: (options?: FakeMediaOptions) => FakeMedia
    frames: (count: number) => void
    seconds: (seconds: number) => void
}

interface DrivenMedia extends FakeMedia {
    advance: (ms: number) => void
}

function createFakeMedia(options: FakeMediaOptions): DrivenMedia {
    const commands: MediaCommand[] = []
    const listeners = new Set<(event: PlaybackMediaEvent) => void>()
    const queued: PlaybackMediaEvent[] = []
    const duration = options.duration ?? Number.NaN
    const seekFrames = options.seekFrames ?? 1
    let ready = options.ready ?? true
    let playing = false
    let seeking = false
    let seekFramesLeft = 0
    let startDelayLeft = 0
    let rate = 1

    const emit = (event: PlaybackMediaEvent) => listeners.forEach(listener => listener(event))
    const clampToMedia = (time: number) => {
        const atLeastZero = Math.max(0, time)
        return Number.isFinite(duration) ? Math.min(duration, atLeastZero) : atLeastZero
    }
    const completeSeek = () => {
        seeking = false
        emit('seeked')
        if (ready) emit('canplay')
    }

    const media: DrivenMedia = {
        commands,
        get playing() { return playing },
        get seeking() { return seeking },
        get rate() { return rate },
        position: clampToMedia(options.position ?? 0),
        play: () => {
            commands.push({ type: 'play' })
            if (playing) return
            playing = true
            startDelayLeft = options.startDelayMs ?? 0
        },
        pause: () => {
            commands.push({ type: 'pause' })
            playing = false
        },
        seek: time => {
            commands.push({ type: 'seek', time })
            media.position = clampToMedia(time)
            seeking = true
            seekFramesLeft = seekFrames
            if (options.syncEvents) emit('seeking')
            else queued.push('seeking')
        },
        currentTime: () => media.position,
        duration: () => duration,
        canPlay: () => ready && !seeking,
        setRate: next => {
            commands.push({ type: 'rate', rate: next })
            rate = next
        },
        setMuted: muted => { commands.push({ type: 'muted', muted }) },
        subscribe: listener => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        seeks: () => commands.flatMap(command => (command.type === 'seek' ? [command.time] : [])),
        clearCommands: () => { commands.length = 0 },
        stall: () => {
            ready = false
            emit('waiting')
        },
        recover: () => {
            ready = true
            emit('canplay')
        },
        fail: () => emit('error'),
        drift: seconds => { media.position = clampToMedia(media.position + seconds) },
        finishSeek: () => {
            if (seeking) completeSeek()
        },
        advance: ms => {
            if (playing && ready && !seeking) {
                if (startDelayLeft > 0) startDelayLeft -= ms
                else media.position = clampToMedia(media.position + (ms / 1000) * rate)
            }
            queued.splice(0).forEach(emit)
            if (seeking && Number.isFinite(seekFramesLeft)) {
                seekFramesLeft -= 1
                if (seekFramesLeft <= 0) completeSeek()
            }
        },
    }
    return media
}

export function createFakeTime(frameMs = 1000 / 60): FakeTime {
    let now = 0
    let nextFrameId = 0
    const pending = new Map<number, () => void>()
    const driven: DrivenMedia[] = []

    const step = () => {
        now += frameMs
        driven.forEach(media => media.advance(frameMs))
        const due = [...pending.values()]
        pending.clear()
        due.forEach(callback => callback())
    }
    const frames = (count: number) => {
        for (let i = 0; i < count; i += 1) step()
    }

    return {
        frameMs,
        now: () => now,
        requestFrame: callback => {
            nextFrameId += 1
            const id = nextFrameId
            pending.set(id, callback)
            return () => { pending.delete(id) }
        },
        media: (options = {}) => {
            const media = createFakeMedia(options)
            driven.push(media)
            return media
        },
        frames,
        seconds: seconds => frames(Math.round((seconds * 1000) / frameMs)),
    }
}
