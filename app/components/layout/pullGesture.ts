export interface PullStart {
    pointerType: string
    primary: boolean
    scrollTop: number
    scrollLocks: number
}

export interface PullPathStep {
    box: Pick<Element, 'scrollWidth' | 'clientWidth' | 'scrollHeight' | 'clientHeight' | 'scrollTop'>
    style: Pick<CSSStyleDeclaration, 'touchAction' | 'overflowX' | 'overflowY'>
    rangeInput: boolean
}

export interface PullPoint {
    x: number
    y: number
}

export type PullGesture =
    | { phase: 'idle' }
    | { phase: 'armed'; pointerId: number; start: PullPoint }
    | { phase: 'pulling'; pointerId: number; start: PullPoint; distance: number }

export const PULL_TRIGGER_PX = 70

export const IDLE_PULL: PullGesture = { phase: 'idle' }

export function pullArmed(pointerId: number, start: PullPoint): PullGesture {
    return { phase: 'armed', pointerId, start }
}

export function pullMoved(gesture: PullGesture, pointerId: number, point: PullPoint): PullGesture {
    if (gesture.phase === 'idle' || gesture.pointerId !== pointerId) return gesture
    const dx = point.x - gesture.start.x
    const dy = point.y - gesture.start.y
    if (gesture.phase === 'pulling') return { ...gesture, distance: Math.max(0, dy) }
    if (dx === 0 && dy === 0) return gesture
    if (dy <= 0 || Math.abs(dx) > dy) return IDLE_PULL
    return { phase: 'pulling', pointerId, start: gesture.start, distance: dy }
}

export function pullTriggers(gesture: PullGesture): boolean {
    return gesture.phase === 'pulling' && gesture.distance >= PULL_TRIGGER_PX
}

const PULL_FOLLOW = 0.6
const PULL_FOLLOW_MAX_PX = PULL_TRIGGER_PX * 2

export function pullOffset(distance: number): number {
    return Math.round(Math.min(Math.max(0, distance), PULL_FOLLOW_MAX_PX) * PULL_FOLLOW)
}

export type PullBlocker = 'not-touch' | 'scrolled' | 'overlay' | 'horizontal-scroller' | 'touch-control' | 'inner-scroller'

const AT_TOP_PX = 1
const OVERFLOW_PX = 1
const SCROLLING = new Set(['auto', 'scroll'])
const VERTICAL_PAN = /\b(auto|manipulation|pan-y|pan-up)\b/

function scrollsSideways({ box, style }: PullPathStep): boolean {
    return SCROLLING.has(style.overflowX) && box.scrollWidth > box.clientWidth + OVERFLOW_PX
}

function takesItsOwnDrags({ style, rangeInput }: PullPathStep): boolean {
    return rangeInput || !VERTICAL_PAN.test(style.touchAction)
}

function scrolledDownInside({ box, style }: PullPathStep): boolean {
    return SCROLLING.has(style.overflowY) && box.scrollHeight > box.clientHeight + OVERFLOW_PX && box.scrollTop > 0
}

function pathBlocker(step: PullPathStep): PullBlocker | null {
    if (scrollsSideways(step)) return 'horizontal-scroller'
    if (takesItsOwnDrags(step)) return 'touch-control'
    if (scrolledDownInside(step)) return 'inner-scroller'
    return null
}

export function pullBlocker(start: PullStart, path: readonly PullPathStep[]): PullBlocker | null {
    if (start.pointerType !== 'touch' || !start.primary) return 'not-touch'
    if (start.scrollTop >= AT_TOP_PX) return 'scrolled'
    if (start.scrollLocks > 0) return 'overlay'
    for (const step of path) {
        const blocker = pathBlocker(step)
        if (blocker) return blocker
    }
    return null
}
