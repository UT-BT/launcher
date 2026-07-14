import { describe, expect, it } from 'vitest'
import { formatCapTime, formatDelta, displayMapName } from './format'

describe('formatCapTime', () => {
    it('rounds float64 representation error up to the stored millisecond', () => {
        expect(formatCapTime(73.6)).toBe('01:13.600')
        expect(formatCapTime(73.59999999999999)).toBe('01:13.600')
    })

    it('formats exact API values verbatim', () => {
        expect(formatCapTime(Number('73.600'))).toBe('01:13.600')
        expect(formatCapTime(Number('73.599'))).toBe('01:13.599')
        expect(formatCapTime(12.345)).toBe('00:12.345')
    })

    it('carries a rounded-up millisecond into the seconds field', () => {
        expect(formatCapTime(59.9995)).toBe('01:00.000')
        expect(formatCapTime(59.999)).toBe('00:59.999')
    })

    it('rounds sub-millisecond values to zero', () => {
        expect(formatCapTime(0.0004)).toBe('00:00.000')
        expect(formatCapTime(0)).toBe('00:00.000')
    })

    it('formats hours', () => {
        expect(formatCapTime(3723.456)).toBe('1:02:03.456')
    })
})

describe('formatDelta', () => {
    it('rounds sub-minute deltas via toFixed', () => {
        expect(formatDelta(0.6)).toBe('0.600s')
    })

    it('routes minute-plus deltas through formatCapTime rounding', () => {
        expect(formatDelta(73.6)).toBe('01:13.600')
    })
})

describe('displayMapName', () => {
    it('strips BT prefixes', () => {
        expect(displayMapName('CTF-BT-Example')).toBe('Example')
    })
})
