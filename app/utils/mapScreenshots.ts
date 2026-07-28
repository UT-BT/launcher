import { API_BASE_URL } from '@/app/utils/api'

export type MapThumbnailSize = 'thumb' | 'card' | 'hero'

export const SCREENSHOT_SIZE_PX: Record<MapThumbnailSize, number> = {
    thumb: 96,
    card: 256,
    hero: 1024,
}

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

export function nextScreenshotStage(stage: ScreenshotStage): ScreenshotStage {
    return stage === 'derived' ? 'canonical' : 'default'
}
