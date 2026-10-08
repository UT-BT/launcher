import { uploadOwnMapScreenshot, type MapMetadata } from '@/app/utils/api'

export const SCREENSHOT_OUTPUT_SIZE = 1024
export const SCREENSHOT_MIN_SOURCE_EDGE = 256
export const SCREENSHOT_MAX_ZOOM = 4
export const SCREENSHOT_ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp'

export type ScreenshotDestination =
    | { kind: 'map'; mapName: string; accessToken?: string; onUploaded: (map: MapMetadata) => void }
    | { kind: 'callback'; mapName: string; onCropped: (image: Blob, filename: string) => Promise<void> | void }

export interface CropRect {
    sourceX: number
    sourceY: number
    sourceEdge: number
    outputEdge: number
}

export function screenshotTooSmall(width: number, height: number): boolean {
    return Math.min(width, height) < SCREENSHOT_MIN_SOURCE_EDGE
}

export function screenshotMaxZoom(sourceEdge: number): number {
    return Math.max(1, Math.min(SCREENSHOT_MAX_ZOOM, sourceEdge / SCREENSHOT_MIN_SOURCE_EDGE))
}

export function screenshotCropRect({ frame, baseScale, zoom, offset }: {
    frame: number
    baseScale: number
    zoom: number
    offset: { x: number; y: number }
}): CropRect {
    const scale = baseScale * zoom
    const sourceEdge = frame / scale
    return {
        sourceX: -offset.x / scale,
        sourceY: -offset.y / scale,
        sourceEdge,
        outputEdge: Math.min(SCREENSHOT_OUTPUT_SIZE, Math.round(sourceEdge)),
    }
}

export function screenshotDestinationReady(destination: ScreenshotDestination): boolean {
    return destination.kind === 'callback' || !!destination.accessToken
}

export async function deliverScreenshot(destination: ScreenshotDestination, image: Blob): Promise<void> {
    const filename = `${destination.mapName}.png`
    if (destination.kind === 'callback') {
        await destination.onCropped(image, filename)
        return
    }
    if (!destination.accessToken) throw new Error('Sign in to change this screenshot.')
    const updated = await uploadOwnMapScreenshot(destination.accessToken, destination.mapName, image, filename)
    destination.onUploaded(updated)
}
