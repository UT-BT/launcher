import type { VisualViewportState } from '@/app/device/deviceEnvironment'

export interface SheetBounds {
    top: number
    height: number
}

const UNZOOMED_TOLERANCE = 0.01

export function sheetBounds(viewport: VisualViewportState): SheetBounds | null {
    if (Math.abs(viewport.scale - 1) > UNZOOMED_TOLERANCE) return null
    return { top: viewport.offsetTop, height: viewport.height }
}
