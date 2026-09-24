import { parseApiInstant } from '@/app/utils/timezone'

export const CLOCK_SAMPLE_WINDOW = 7

export function clockSample(serverNow: string | null | undefined, sentAt: number, receivedAt: number): number | null {
    const serverInstant = parseApiInstant(serverNow)
    if (serverInstant === null) return null
    return serverInstant - (sentAt + receivedAt) / 2
}

export function addClockSample(
    samples: readonly number[],
    sample: number | null,
    windowSize = CLOCK_SAMPLE_WINDOW,
): readonly number[] {
    if (sample === null) return samples
    return [...samples, sample].slice(-windowSize)
}

export function medianClockOffset(samples: readonly number[]): number {
    if (samples.length === 0) return 0
    const sorted = [...samples].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
