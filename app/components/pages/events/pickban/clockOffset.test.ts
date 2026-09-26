import { describe, expect, it } from 'vitest'
import { CLOCK_SAMPLE_WINDOW, addClockSample, clockSample, medianClockOffset } from './clockOffset'

const SERVER_NOW = '2026-09-26T20:00:10.000000+00:00'
const SERVER_NOW_MS = Date.parse('2026-09-26T20:00:10Z')

function collect(samples: number[]) {
    return samples.reduce<readonly number[]>((window, sample) => addClockSample(window, sample), [])
}

describe('clockSample', () => {
    it('measures the server clock against the midpoint of the round trip', () => {
        const sentAt = SERVER_NOW_MS - 30_000 - 100
        const receivedAt = SERVER_NOW_MS - 30_000 + 100

        expect(clockSample(SERVER_NOW, sentAt, receivedAt)).toBe(30_000)
    })

    it('accepts the Z form a response header may use', () => {
        expect(clockSample('2026-09-26T20:00:10Z', SERVER_NOW_MS, SERVER_NOW_MS)).toBe(0)
    })

    it('skips a response without a usable server time', () => {
        expect(clockSample(null, 0, 10)).toBeNull()
        expect(clockSample('not a time', 0, 10)).toBeNull()
    })
})

describe('medianClockOffset', () => {
    it('is zero before any sample arrives', () => {
        expect(medianClockOffset([])).toBe(0)
    })

    it('takes the median of recent samples', () => {
        expect(medianClockOffset(collect([250, 252, 248, 251, 249]))).toBe(250)
        expect(medianClockOffset(collect([248, 249, 251, 252]))).toBe(250)
    })

    it('does not move for one outlier', () => {
        const steady = collect([250, 251, 249, 250, 252, 248])
        const withOutlier = addClockSample(steady, 4_800)

        expect(medianClockOffset(withOutlier)).toBe(medianClockOffset(steady))
        expect(medianClockOffset(addClockSample(steady, -9_000))).toBe(medianClockOffset(steady))
    })

    it('follows a real clock change once most recent samples agree on it', () => {
        const before = collect([250, 251, 249, 250, 252, 248, 250])
        const after = [2_250, 2_250, 2_250, 2_250].reduce((window, sample) => addClockSample(window, sample), before)

        expect(medianClockOffset(after)).toBe(2_250)
    })
})

describe('addClockSample', () => {
    it('keeps only the most recent window of samples', () => {
        const window = collect(Array.from({ length: CLOCK_SAMPLE_WINDOW + 3 }, (_, i) => i))

        expect(window).toHaveLength(CLOCK_SAMPLE_WINDOW)
        expect(window[window.length - 1]).toBe(CLOCK_SAMPLE_WINDOW + 2)
    })

    it('leaves the window untouched when a response had no server time', () => {
        const window = collect([1, 2, 3])

        expect(addClockSample(window, null)).toBe(window)
    })
})
