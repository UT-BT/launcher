import type { CapComparison } from '@/app/utils/api'
import { RACE_TARGET, type ClockTarget } from './clockTargets'

export type PositionKnot = readonly [referenceMs: number, deltaMs: number]

export interface PositionLink {
    capId: string
    reference: string
    knots: readonly PositionKnot[]
}

export interface CueTargetPoint {
    atMs: number
    runTimesMs: ReadonlyMap<string, number>
}

interface Mapping {
    at: number[]
    to: number[]
}

export function offsetTarget(seconds: number): ClockTarget {
    return { runTime: t => t + seconds, masterTime: runTime => runTime - seconds }
}

export function comparisonKnots(comparison: Pick<CapComparison, 'segments' | 'separations'>): PositionKnot[] {
    const edges = comparison.separations.flatMap((separation): PositionKnot[] => [
        [separation.start_ms, separation.start_delta_ms],
        [separation.end_ms, separation.end_delta_ms],
    ])
    return [...comparison.segments.flat(), ...edges]
}

function mappingOf(knots: readonly PositionKnot[]): Mapping {
    const at: number[] = []
    const to: number[] = []
    const sorted = knots.map((knot, order) => ({ knot, order })).sort((a, b) => a.knot[0] - b.knot[0] || a.order - b.order)
    for (const { knot: [referenceMs, deltaMs] } of sorted) {
        const seconds = referenceMs / 1000
        if (at.length > 1 && seconds === at[at.length - 2]) {
            at.pop()
            to.pop()
        }
        at.push(seconds)
        to.push(Math.max((referenceMs + deltaMs) / 1000, to[to.length - 1] ?? Number.NEGATIVE_INFINITY))
    }
    return { at, to }
}

function lastAtOrBelow(values: readonly number[], value: number): number {
    let low = 0
    let high = values.length - 1
    while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (values[middle] <= value) low = middle
        else high = middle - 1
    }
    return low
}

function firstAtOrAbove(values: readonly number[], value: number): number {
    let low = 0
    let high = values.length - 1
    while (low < high) {
        const middle = Math.floor((low + high) / 2)
        if (values[middle] >= value) high = middle
        else low = middle + 1
    }
    return low
}

function forward({ at, to }: Mapping, referenceTime: number): number {
    const last = at.length - 1
    if (last < 0) return referenceTime
    if (referenceTime <= at[0]) return to[0] + (referenceTime - at[0])
    if (referenceTime >= at[last]) return to[last] + (referenceTime - at[last])
    const i = lastAtOrBelow(at, referenceTime)
    return to[i] + ((referenceTime - at[i]) / (at[i + 1] - at[i])) * (to[i + 1] - to[i])
}

function inverse({ at, to }: Mapping, runTime: number): number {
    const last = at.length - 1
    if (last < 0) return runTime
    if (runTime <= to[0]) return at[0] + (runTime - to[0])
    if (runTime >= to[last]) return at[last] + (runTime - to[last])
    const i = firstAtOrAbove(to, runTime) - 1
    return at[i] + ((runTime - to[i]) / (to[i + 1] - to[i])) * (at[i + 1] - at[i])
}

function slopeAt({ at, to }: Mapping, referenceTime: number): number {
    const last = at.length - 1
    if (last < 1 || referenceTime < at[0] || referenceTime >= at[last]) return 1
    const i = lastAtOrBelow(at, referenceTime)
    return (to[i + 1] - to[i]) / (at[i + 1] - at[i])
}

export function positionTarget(knots: readonly PositionKnot[], base: ClockTarget = RACE_TARGET): ClockTarget {
    const mapping = mappingOf(knots)
    return {
        runTime: t => forward(mapping, base.runTime(t)),
        masterTime: runTime => base.masterTime(inverse(mapping, runTime)),
        slope: t => slopeAt(mapping, base.runTime(t)) * (base.slope?.(t) ?? 1),
    }
}

export function positionTargets(links: readonly PositionLink[]): Map<string, ClockTarget> {
    return new Map(links.map(link => [link.capId, positionTarget(link.knots)]))
}

export function cueTargets(point: CueTargetPoint, links: readonly PositionLink[] = []): Map<string, ClockTarget> {
    const targets = new Map<string, ClockTarget>()
    point.runTimesMs.forEach((runTimeMs, capId) => targets.set(capId, offsetTarget((runTimeMs - point.atMs) / 1000)))
    links.forEach(link => targets.set(link.capId, positionTarget(link.knots, targets.get(link.reference) ?? RACE_TARGET)))
    return targets
}
