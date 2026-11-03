export interface OffsetNudge {
    label: string
    ms: number
}

const MINUS = '−'
const COARSE_MS = 100

export function offsetNudges(fps: number): OffsetNudge[] {
    const frameMs = Math.max(1, Math.round(1000 / fps))
    return [
        { label: `${MINUS}${COARSE_MS} ms`, ms: -COARSE_MS },
        { label: `${MINUS}1 frame`, ms: -frameMs },
        { label: '+1 frame', ms: frameMs },
        { label: `+${COARSE_MS} ms`, ms: COARSE_MS },
    ]
}

export function formatOffset(ms: number): string {
    if (ms === 0) return '0 ms'
    return `${ms > 0 ? '+' : MINUS}${Math.abs(ms)} ms`
}
