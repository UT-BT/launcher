export interface ZoomPoint {
    x: number
    y: number
}

export interface ZoomFrame {
    width: number
    height: number
}

export interface Zoom {
    scale: number
    x: number
    y: number
}

export const MAX_ZOOM = 4
export const TAP_ZOOM = 2.5
export const UNZOOMED: Zoom = { scale: 1, x: 0, y: 0 }

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value)) + 0
}

function distance(a: ZoomPoint, b: ZoomPoint): number {
    return Math.hypot(b.x - a.x, b.y - a.y)
}

function midpoint(a: ZoomPoint, b: ZoomPoint): ZoomPoint {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function zoomAround(zoom: Zoom, from: ZoomPoint, to: ZoomPoint, scale: number, frame: ZoomFrame): Zoom {
    const next = clamp(scale, 1, MAX_ZOOM)
    const contentX = (from.x - zoom.x) / zoom.scale
    const contentY = (from.y - zoom.y) / zoom.scale
    return clampZoom({ scale: next, x: to.x - contentX * next, y: to.y - contentY * next }, frame)
}

export function clampZoom(zoom: Zoom, frame: ZoomFrame): Zoom {
    const scale = clamp(zoom.scale, 1, MAX_ZOOM)
    return {
        scale,
        x: clamp(zoom.x, frame.width - frame.width * scale, 0),
        y: clamp(zoom.y, frame.height - frame.height * scale, 0),
    }
}

export function pinchZoom(start: Zoom, from: [ZoomPoint, ZoomPoint], to: [ZoomPoint, ZoomPoint], frame: ZoomFrame): Zoom {
    const spread = distance(from[0], from[1])
    if (spread === 0) return start
    const ratio = distance(to[0], to[1]) / spread
    return zoomAround(start, midpoint(from[0], from[1]), midpoint(to[0], to[1]), start.scale * ratio, frame)
}

export function panZoom(start: Zoom, from: ZoomPoint, to: ZoomPoint, frame: ZoomFrame): Zoom {
    return clampZoom({ scale: start.scale, x: start.x + to.x - from.x, y: start.y + to.y - from.y }, frame)
}

export function toggleZoom(zoom: Zoom, point: ZoomPoint, frame: ZoomFrame): Zoom {
    if (zoom.scale > 1) return UNZOOMED
    return zoomAround(zoom, point, point, TAP_ZOOM, frame)
}
