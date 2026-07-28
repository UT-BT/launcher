import { API_BASE_URL } from '@/app/utils/api'

/**
 * Which stored derivative to request. The API keeps a WebP at each of these
 * widths beside the canonical PNG; pick the one that covers the rendered box on
 * a 2x display.
 */
export type MapThumbnailSize = 'thumb' | 'card' | 'hero'

export const SCREENSHOT_SIZE_PX: Record<MapThumbnailSize, number> = {
    thumb: 96,   // list rows and inline cells, ~28-48px
    card: 256,   // poster grids and medium tiles, ~96-192px
    hero: 1024,  // detail-page heroes and full-bleed backdrops
}

/** Blurred backdrops never need more than the smallest derivative. */
export const SCREENSHOT_BLUR_PX = SCREENSHOT_SIZE_PX.thumb

export type ScreenshotStage = 'derived' | 'canonical' | 'default'

function buster(version?: string | number | null): string {
    return version != null ? `?v=${encodeURIComponent(String(version))}` : ''
}

export function derivedScreenshotUrl(mapName: string, px: number, version?: string | number | null): string {
    return `${API_BASE_URL}/screenshots/derived/${px}/${encodeURIComponent(mapName)}.webp${buster(version)}`
}

export function canonicalScreenshotUrl(mapName: string, version?: string | number | null): string {
    return `${API_BASE_URL}/screenshots/${encodeURIComponent(mapName)}.png${buster(version)}`
}

export function defaultScreenshotUrl(): string {
    return `${API_BASE_URL}/screenshots/default.png`
}

export function screenshotUrlFor(
    stage: ScreenshotStage,
    mapName: string,
    size: MapThumbnailSize,
    version?: string | number | null,
): string {
    if (stage === 'derived') return derivedScreenshotUrl(mapName, SCREENSHOT_SIZE_PX[size], version)
    if (stage === 'canonical') return canonicalScreenshotUrl(mapName, version)
    return defaultScreenshotUrl()
}

/**
 * Derived WebP -> canonical PNG -> default, in that order.
 *
 * The canonical step is not redundant: derivative writes are best-effort on the
 * API side (a failed WebP must never fail a mapper's upload), so a WebP can be
 * missing while the PNG is perfectly fine.
 */
export function nextScreenshotStage(stage: ScreenshotStage): ScreenshotStage {
    return stage === 'derived' ? 'canonical' : 'default'
}
