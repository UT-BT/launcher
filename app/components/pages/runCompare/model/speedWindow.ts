import { SECTOR_COUNT } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { MIN_ZOOM_MS, rangeZoom, type SpeedZoom } from '@/app/components/pages/capDetail/runDelta/speedZoom'
import type { PlaybackState } from '../playback/playbackController'

export const FOLLOW_STEP_MS = 50
export const FOLLOW_MIN_MS = 2000
export const FOLLOW_MAX_MS = 8000
export const ZOOM_FACTOR = 2

export function spanOf(zoom: SpeedZoom | null, durationMs: number): number {
    return zoom ? zoom.endMs - zoom.startMs : durationMs
}

export function followSpanMs(zoom: SpeedZoom | null, durationMs: number): number {
    if (zoom) return spanOf(zoom, durationMs)
    return Math.min(durationMs, Math.max(FOLLOW_MIN_MS, Math.min(FOLLOW_MAX_MS, durationMs / SECTOR_COUNT)))
}

export function windowAround(pair: string, centerMs: number, spanMs: number, durationMs: number): SpeedZoom {
    return rangeZoom(pair, centerMs - spanMs / 2, centerMs + spanMs / 2, durationMs)
}

export function zoomStep(pair: string, zoom: SpeedZoom | null, direction: 'in' | 'out', centerMs: number, durationMs: number): SpeedZoom | null {
    const current = spanOf(zoom, durationMs)
    const span = direction === 'in' ? current / ZOOM_FACTOR : current * ZOOM_FACTOR
    if (span >= durationMs) return null
    const center = zoom ? (zoom.startMs + zoom.endMs) / 2 : centerMs
    return windowAround(pair, center, Math.max(MIN_ZOOM_MS, span), durationMs)
}

export function canZoomIn(zoom: SpeedZoom | null, durationMs: number): boolean {
    return durationMs > MIN_ZOOM_MS && spanOf(zoom, durationMs) > MIN_ZOOM_MS
}

export function shiftedWindow(zoom: SpeedZoom, deltaMs: number, durationMs: number): SpeedZoom {
    return rangeZoom(zoom.pair, zoom.startMs + deltaMs, zoom.endMs + deltaMs, durationMs)
}

export function resizedWindow(zoom: SpeedZoom, edge: 'start' | 'end', atMs: number, durationMs: number): SpeedZoom {
    const clamped = Math.min(durationMs, Math.max(0, atMs))
    if (edge === 'start') return rangeZoom(zoom.pair, Math.min(clamped, zoom.endMs - MIN_ZOOM_MS), zoom.endMs, durationMs)
    return rangeZoom(zoom.pair, zoom.startMs, Math.max(clamped, zoom.startMs + MIN_ZOOM_MS), durationMs)
}

export function runMsOf(state: PlaybackState, capId: string): number {
    return Math.round((state.runTimes[capId] ?? state.t) * 1000)
}

export function followStep(ms: number): number {
    return Math.round(ms / FOLLOW_STEP_MS) * FOLLOW_STEP_MS
}
