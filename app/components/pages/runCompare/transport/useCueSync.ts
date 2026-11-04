import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ClockTarget } from '../playback/clockTargets'
import type { PlaybackController } from '../playback/playbackController'
import { cueTargets, positionTarget, type PositionKnot, type PositionLink } from '../playback/syncTargets'
import { adjacentCue, type CueModel, type CuePoint } from '../model/cueModel'
import type { SyncModel } from '../model/positionModel'
import { usePlaybackSelector } from '../stage/usePlaybackSelector'

export interface CueSync {
    active: string | null
    cue: (point: CuePoint) => void
    previousCue: () => void
    nextCue: () => void
}

interface PushedTargets {
    mode: SyncModel['mode']
    references: readonly string[]
    targets: ReadonlyMap<string, ClockTarget>
}

interface CachedTarget {
    link: PositionLink
    target: ClockTarget
}

const NO_LINKS: PositionLink[] = []

function sameKnots(a: readonly PositionKnot[], b: readonly PositionKnot[]): boolean {
    return a.length === b.length && a.every((knot, i) => knot[0] === b[i][0] && knot[1] === b[i][1])
}

function sameReferences(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((capId, i) => capId === b[i])
}

function sameTargets(a: ReadonlyMap<string, ClockTarget>, b: ReadonlyMap<string, ClockTarget>): boolean {
    return a.size === b.size && [...a].every(([group, target]) => b.get(group) === target)
}

function activeCueOf(state: { cue: string | null }): string | null {
    return state.cue
}

export function useCueSync(controller: PlaybackController | null, cues: CueModel, sync: SyncModel): CueSync {
    const links = sync.mode === 'position' ? sync.links : NO_LINKS
    const cache = useRef(new Map<string, CachedTarget>())
    const pushed = useRef<PushedTargets | null>(null)

    const targets = useMemo(() => {
        const next = new Map<string, CachedTarget>()
        links.forEach(link => {
            const cached = cache.current.get(link.capId)
            const reusable = cached && cached.link.reference === link.reference && sameKnots(cached.link.knots, link.knots)
            next.set(link.capId, reusable ? cached : { link, target: positionTarget(link.knots) })
        })
        cache.current = next
        return new Map([...next].map(([group, { target }]) => [group, target]))
    }, [links])

    useEffect(() => {
        if (!controller) return
        const previous = pushed.current
        const next: PushedTargets = { mode: sync.mode, references: cues.references, targets }
        if (previous && previous.mode === next.mode && sameReferences(previous.references, next.references) && sameTargets(previous.targets, next.targets)) return
        pushed.current = next
        controller.setTargets(targets, { clearCue: previous !== null })
    }, [controller, targets, sync.mode, cues.references])

    const cue = useCallback((point: CuePoint) => {
        controller?.cue(point.key, point.atMs / 1000, cueTargets(point, links))
    }, [controller, links])

    const step = useCallback((direction: 1 | -1) => {
        if (!controller) return
        const point = adjacentCue(cues, controller.getState().t, direction)
        if (point) cue(point)
    }, [controller, cues, cue])

    return {
        active: usePlaybackSelector(controller, activeCueOf),
        cue,
        previousCue: useCallback(() => step(-1), [step]),
        nextCue: useCallback(() => step(1), [step]),
    }
}
