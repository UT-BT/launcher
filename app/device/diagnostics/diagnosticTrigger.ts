export const LONG_PRESS_MS = 600
export const LONG_PRESS_TOLERANCE_PX = 10

export interface Point {
    x: number
    y: number
}

export function isMobileDebugRequested(search: string): boolean {
    return new URLSearchParams(search).getAll('debug').includes('mobile')
}

export function movedBeyondLongPressTolerance(start: Point, point: Point): boolean {
    return Math.hypot(point.x - start.x, point.y - start.y) > LONG_PRESS_TOLERANCE_PX
}
