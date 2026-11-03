import { RACE_TARGET, type ClockTarget } from './clockTargets'
import {
    DRIFT_RESEEK_FRAMES,
    FALLBACK_FPS,
    MAX_PLAYBACK_RATE,
    MIN_PLAYBACK_RATE,
    POSITION_CATCH_UP_SECONDS,
    POSITION_RATE_MAX_FACTOR,
    POSITION_RATE_MIN_FACTOR,
    POSITION_RESEEK_SECONDS,
    SEEK_TOLERANCE_SECONDS,
    SKIP_SECONDS,
    START_GATE_LIMIT_SECONDS,
} from './playbackConstants'
import type { PlaybackMedia, PlaybackMediaEvent, PlaybackTimeSource } from './playbackMedia'

export interface PlaybackRun {
    id: string
    cap: number
    group?: string
    offset?: number
    fps?: number | null
    media: PlaybackMedia | null
    hidden?: boolean
}

export interface PlaybackState {
    playing: boolean
    t: number
    end: number
    rate: number
    stalled: string[]
    frozen: string[]
    errored: string[]
    runTimes: Readonly<Record<string, number>>
    cue: string | null
}

export interface SetTargetsOptions {
    clearCue?: boolean
}

export interface PlaybackController {
    getState: () => PlaybackState
    subscribe: (listener: () => void) => () => void
    setRuns: (runs: readonly PlaybackRun[]) => void
    setGroupTarget: (group: string, target: ClockTarget) => void
    resetTargets: () => void
    setTargets: (targets: ReadonlyMap<string, ClockTarget>, options?: SetTargetsOptions) => void
    cue: (id: string, at: number, targets: ReadonlyMap<string, ClockTarget>) => void
    clearCue: () => void
    play: () => void
    pause: () => void
    seek: (t: number) => void
    beginScrub: () => void
    endScrub: () => void
    stepFrame: (direction: 1 | -1) => void
    skip: (direction: 1 | -1) => void
    setRate: (rate: number) => void
    dispose: () => void
}

export interface PlaybackControllerOptions {
    time: PlaybackTimeSource
}

interface Track {
    run: PlaybackRun
    unsubscribe: () => void
    errored: boolean
    playing: boolean
    parkedAt: number | null
    rateFactor: number
}

type MediaTrack = Track & { run: { media: PlaybackMedia } }

interface Placement {
    position: number
    active: boolean
}

interface StartGate {
    t0: number
    since: number
    from: Map<Track, number>
}

interface CueLayer {
    id: string
    targets: ReadonlyMap<string, ClockTarget>
}

const MAX_RECONCILE_PASSES = 3
const RATE_FACTOR_TOLERANCE = 0.01

function clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, value))
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((value, i) => value === b[i])
}

function sameRecord(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key])
}

function groupOf(run: PlaybackRun): string {
    return run.group ?? run.id
}

function offsetOf(run: PlaybackRun): number {
    return run.offset ?? 0
}

function placedDifferently(before: PlaybackRun, after: PlaybackRun): boolean {
    return before.cap !== after.cap
        || offsetOf(before) !== offsetOf(after)
        || groupOf(before) !== groupOf(after)
        || (before.hidden === true && after.hidden !== true)
}

function sameState(a: PlaybackState, b: PlaybackState): boolean {
    return a.playing === b.playing && a.t === b.t && a.end === b.end && a.rate === b.rate
        && sameList(a.stalled, b.stalled) && sameList(a.frozen, b.frozen) && sameList(a.errored, b.errored)
        && sameRecord(a.runTimes, b.runTimes) && a.cue === b.cue
}

export function createPlaybackController({ time }: PlaybackControllerOptions): PlaybackController {
    const listeners = new Set<() => void>()
    const targets = new Map<string, ClockTarget>()
    let cueLayer: CueLayer | null = null
    let tracks: Track[] = []
    let t = 0
    let rate = 1
    let wantPlay = false
    let running = false
    let scrubbing = false
    let gate: StartGate | null = null
    let lastNow = 0
    let cancelFrame: (() => void) | null = null
    let reconciling = false
    let reconcileAgain = false
    let state: PlaybackState = buildState()

    function targetOf(run: PlaybackRun): ClockTarget {
        const group = groupOf(run)
        return cueLayer?.targets.get(group) ?? targets.get(group) ?? RACE_TARGET
    }

    function rateFactorOf(track: Track, gap = 0): number {
        const { slope } = targetOf(track.run)
        if (!slope) return 1
        return clamp(slope(t) + gap / POSITION_CATCH_UP_SECONDS, POSITION_RATE_MIN_FACTOR, POSITION_RATE_MAX_FACTOR)
    }

    function applyRateFactor(track: Track, rateFactor: number) {
        const settled = rateFactor === 1 ? track.rateFactor === 1 : Math.abs(track.rateFactor - rateFactor) < RATE_FACTOR_TOLERANCE
        if (settled) return
        track.rateFactor = rateFactor
        track.run.media?.setRate(rate * rateFactor)
    }

    function timelineEnd(): number {
        return tracks.reduce((end, { run }) => {
            const capAt = targetOf(run).masterTime(run.cap)
            return Math.max(end, run.cap, Number.isFinite(capAt) ? capAt : 0)
        }, 0)
    }

    function mediaEnd(track: Track): number {
        const capFrame = track.run.cap + offsetOf(track.run)
        const duration = track.run.media?.duration() ?? Number.NaN
        return Number.isFinite(duration) && duration > 0 ? Math.min(capFrame, duration) : capFrame
    }

    function placement(track: Track): Placement {
        const raw = targetOf(track.run).runTime(t) + offsetOf(track.run)
        const end = mediaEnd(track)
        if (raw >= end) return { position: end, active: false }
        if (raw < 0) return { position: 0, active: false }
        return { position: raw, active: true }
    }

    function participates(track: Track): track is MediaTrack {
        return track.run.media != null && !track.run.hidden && !track.errored
    }

    function onLastFrame(track: MediaTrack): boolean {
        return track.run.media.currentTime() >= mediaEnd(track) - SEEK_TOLERANCE_SECONDS
    }

    function activeTracks(): MediaTrack[] {
        return tracks.filter(participates).filter(track => placement(track).active)
    }

    function blocking(): MediaTrack[] {
        return activeTracks().filter(track => !onLastFrame(track))
    }

    function fpsOf(run: PlaybackRun): number {
        return run.fps != null && run.fps > 0 ? run.fps : FALLBACK_FPS
    }

    function driftToleranceOf(run: PlaybackRun): number {
        return DRIFT_RESEEK_FRAMES / fpsOf(run)
    }

    function lowestFps(): number {
        const lowest = tracks
            .filter(participates)
            .reduce((low, { run }) => Math.min(low, fpsOf(run)), Number.POSITIVE_INFINITY)
        return Number.isFinite(lowest) ? lowest : FALLBACK_FPS
    }

    function stalledTracks(): Track[] {
        return blocking().filter(track => !track.run.media.canPlay())
    }

    function buildState(): PlaybackState {
        const runTimes: Record<string, number> = {}
        const frozen: string[] = []
        tracks.forEach(({ run }) => {
            const runTime = targetOf(run).runTime(t)
            runTimes[run.id] = clamp(runTime, 0, run.cap)
            if (runTime >= run.cap) frozen.push(run.id)
        })
        return {
            playing: wantPlay,
            t,
            end: timelineEnd(),
            rate,
            stalled: stalledTracks().map(track => track.run.id),
            frozen,
            errored: tracks.filter(track => track.errored).map(track => track.run.id),
            runTimes,
            cue: cueLayer?.id ?? null,
        }
    }

    function publish() {
        const next = buildState()
        if (sameState(state, next)) return
        state = next
        listeners.forEach(listener => listener())
    }

    function pauseTrack(track: Track) {
        if (track.playing) track.run.media?.pause()
        track.playing = false
    }

    function stopMedia() {
        if (running) advanceClock(time.now())
        tracks.forEach(pauseTrack)
        running = false
        gate = null
    }

    function park(track: MediaTrack, position: number) {
        pauseTrack(track)
        if (track.parkedAt != null && Math.abs(track.parkedAt - position) <= SEEK_TOLERANCE_SECONDS) return
        track.parkedAt = position
        const { media } = track.run
        if (Math.abs(media.currentTime() - position) > SEEK_TOLERANCE_SECONDS) media.seek(position)
    }

    function align(track: MediaTrack, tolerance: number) {
        const { position, active } = placement(track)
        if (!active) {
            park(track, position)
            return
        }
        track.parkedAt = null
        if (Math.abs(track.run.media.currentTime() - position) > tolerance) track.run.media.seek(position)
        applyRateFactor(track, rateFactorOf(track))
    }

    function hide(track: Track) {
        pauseTrack(track)
        track.parkedAt = null
    }

    function release(track: Track) {
        hide(track)
        track.unsubscribe()
    }

    function startMedia() {
        const from = new Map<Track, number>()
        blocking().forEach(track => {
            track.run.media.play()
            track.playing = true
            from.set(track, track.run.media.currentTime())
        })
        running = true
        lastNow = time.now()
        gate = from.size > 0 ? { t0: t, since: lastNow, from } : null
    }

    function alignAndStart() {
        blocking().forEach(track => align(track, driftToleranceOf(track.run)))
        if (stalledTracks().length === 0) startMedia()
    }

    function reconcileOnce() {
        tracks.filter(participates).forEach(track => {
            const { position, active } = placement(track)
            if (!active) park(track, position)
        })
        const holding = scrubbing || stalledTracks().length > 0
        if (wantPlay && !holding) {
            if (running && blocking().some(track => !track.playing)) stopMedia()
            if (!running) alignAndStart()
        } else if (running) {
            stopMedia()
        }
    }

    function reconcile() {
        if (reconciling) {
            reconcileAgain = true
            return
        }
        reconciling = true
        try {
            let passes = 0
            do {
                reconcileAgain = false
                reconcileOnce()
                passes += 1
            } while (reconcileAgain && passes < MAX_RECONCILE_PASSES)
        } finally {
            reconciling = false
        }
        publish()
    }

    function updateGate(open: StartGate, now: number) {
        let started = true
        let least = Number.POSITIVE_INFINITY
        open.from.forEach((position, track) => {
            if (!track.playing || !track.run.media) return
            const advanced = (track.run.media.currentTime() - position) / track.rateFactor
            if (advanced > 0) least = Math.min(least, advanced)
            else started = false
        })
        const waited = (now - open.since) / 1000
        if (!started && waited < START_GATE_LIMIT_SECONDS) return
        t = clamp(open.t0 + (Number.isFinite(least) ? least : waited * rate), 0, timelineEnd())
        gate = null
    }

    function correctDrift() {
        activeTracks().forEach(track => {
            const { media } = track.run
            if (!track.playing || !media.canPlay()) return
            const { position } = placement(track)
            const gap = position - media.currentTime()
            if (!targetOf(track.run).slope) {
                if (Math.abs(gap) > driftToleranceOf(track.run)) media.seek(position)
            } else if (Math.abs(gap) > POSITION_RESEEK_SECONDS) {
                media.seek(position)
            } else {
                applyRateFactor(track, rateFactorOf(track, gap))
            }
        })
    }

    function advanceClock(now: number) {
        if (gate) updateGate(gate, now)
        else t = Math.min(timelineEnd(), t + ((now - lastNow) / 1000) * rate)
        lastNow = now
    }

    function tick() {
        cancelFrame = null
        if (!wantPlay) return
        if (running) {
            advanceClock(time.now())
            if (!gate) correctDrift()
            if (t >= timelineEnd()) wantPlay = false
        }
        reconcile()
        if (wantPlay) ensureFrame()
    }

    function ensureFrame() {
        if (cancelFrame) return
        cancelFrame = time.requestFrame(tick)
    }

    function onMediaEvent(track: Track, event: PlaybackMediaEvent) {
        if (!tracks.includes(track)) return
        if (event === 'error') {
            track.errored = true
            track.playing = false
        }
        reconcile()
    }

    function moveTo(next: number) {
        t = clamp(next, 0, timelineEnd())
        gate = null
        lastNow = time.now()
        tracks.filter(participates).forEach(track => align(track, SEEK_TOLERANCE_SECONDS))
    }

    function retargetChanged(change: () => void) {
        const before = new Map(tracks.map(track => [track, targetOf(track.run)]))
        change()
        retarget(track => targetOf(track.run) !== before.get(track))
    }

    function retarget(affected: (track: Track) => boolean) {
        t = Math.min(t, timelineEnd())
        tracks
            .filter(participates)
            .filter(affected)
            .forEach(track => align(track, SEEK_TOLERANCE_SECONDS))
        reconcile()
    }

    function attach(run: PlaybackRun, replaced: Track | undefined): Track {
        const errored = replaced?.errored === true && run.media == null
        const track: Track = { run, unsubscribe: () => {}, errored, playing: false, parkedAt: null, rateFactor: 1 }
        if (run.media) {
            run.media.setRate(rate)
            track.unsubscribe = run.media.subscribe(event => onMediaEvent(track, event))
        }
        return track
    }

    return {
        getState: () => state,
        subscribe: listener => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        setRuns: runs => {
            const previous = new Map(tracks.map(track => [track.run.id, track]))
            const moved = new Set<Track>()
            tracks = runs.map(run => {
                const existing = previous.get(run.id)
                if (existing && existing.run.media === run.media) {
                    previous.delete(run.id)
                    if (placedDifferently(existing.run, run)) moved.add(existing)
                    if (run.hidden && !existing.run.hidden) hide(existing)
                    existing.run = run
                    return existing
                }
                const track = attach(run, existing)
                moved.add(track)
                return track
            })
            previous.forEach(release)
            retarget(track => moved.has(track))
        },
        setGroupTarget: (group, target) => {
            targets.set(group, target)
            retarget(track => groupOf(track.run) === group)
        },
        resetTargets: () => {
            targets.clear()
            cueLayer = null
            retarget(() => true)
        },
        setTargets: (next, options = {}) => {
            retargetChanged(() => {
                targets.clear()
                next.forEach((target, group) => targets.set(group, target))
                if (options.clearCue) cueLayer = null
            })
        },
        cue: (id, at, cued) => {
            if (!Number.isFinite(at)) return
            cueLayer = { id, targets: new Map(cued) }
            moveTo(at)
            reconcile()
        },
        clearCue: () => {
            if (cueLayer) retargetChanged(() => { cueLayer = null })
        },
        play: () => {
            if (t >= timelineEnd()) {
                cueLayer = null
                moveTo(0)
            }
            wantPlay = true
            reconcile()
            ensureFrame()
        },
        pause: () => {
            wantPlay = false
            reconcile()
        },
        seek: next => {
            if (!Number.isFinite(next)) return
            cueLayer = null
            moveTo(next)
            reconcile()
        },
        beginScrub: () => {
            scrubbing = true
            if (cueLayer) retargetChanged(() => { cueLayer = null })
            else reconcile()
        },
        endScrub: () => {
            scrubbing = false
            reconcile()
        },
        stepFrame: direction => {
            wantPlay = false
            reconcile()
            moveTo(t + direction / lowestFps())
            reconcile()
        },
        skip: direction => {
            cueLayer = null
            moveTo(t + direction * SKIP_SECONDS)
            reconcile()
        },
        setRate: next => {
            if (!Number.isFinite(next)) return
            if (running) advanceClock(time.now())
            rate = clamp(next, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE)
            tracks.forEach(track => {
                if (!track.errored) track.run.media?.setRate(rate * track.rateFactor)
            })
            reconcile()
        },
        dispose: () => {
            cancelFrame?.()
            cancelFrame = null
            wantPlay = false
            running = false
            gate = null
            cueLayer = null
            tracks.forEach(release)
            tracks = []
            listeners.clear()
        },
    }
}
