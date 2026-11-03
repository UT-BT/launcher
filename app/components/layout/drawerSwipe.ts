export const SWIPE_SLOP_PX = 10
export const FLING_PX_PER_MS = 0.5
export const FLING_WINDOW_MS = 100

export type SwipeAxis = 'undecided' | 'horizontal' | 'vertical'

export function swipeAxis(dx: number, dy: number): SwipeAxis {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_SLOP_PX) return 'undecided'
    return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
}

export function drawerDragOffset(dx: number, width: number): number {
    return Math.max(-width, Math.min(0, dx))
}

export function closesDrawer(offset: number, width: number, velocity: number): boolean {
    if (offset >= 0) return false
    return offset <= -width / 3 || velocity <= -FLING_PX_PER_MS
}

export function releaseVelocity(lastVelocity: number, sinceLastMoveMs: number): number {
    return sinceLastMoveMs > FLING_WINDOW_MS ? 0 : lastVelocity
}
