import { describe, expect, it } from 'vitest'
import { defaultActivityMode, formatHours } from './activityChart'

describe('defaultActivityMode', () => {
    it('keeps playtime while activity is still loading', () => {
        expect(defaultActivityMode([])).toBe('playtime')
    })

    it('keeps playtime when any week recorded hours', () => {
        expect(defaultActivityMode([{ hours: 0 }, { hours: 2.5 }, { hours: 0 }])).toBe('playtime')
    })

    it('falls back to caps when every week is caps-only', () => {
        expect(defaultActivityMode([{ hours: 0 }, { hours: 0 }])).toBe('caps')
    })
})

describe('formatHours', () => {
    it('keeps one decimal from one hour up', () => {
        expect(formatHours(1)).toBe('1.0')
        expect(formatHours(2.25)).toBe('2.3')
        expect(formatHours(12.345)).toBe('12.3')
        expect(formatHours(168)).toBe('168.0')
    })

    it('keeps one decimal below an hour when that loses nothing', () => {
        expect(formatHours(0)).toBe('0.0')
        expect(formatHours(0.3)).toBe('0.3')
        expect(formatHours(0.5)).toBe('0.5')
    })

    it('adds a second decimal below an hour when one would distort the value', () => {
        expect(formatHours(0.45)).toBe('0.45')
        expect(formatHours(0.75)).toBe('0.75')
        expect(formatHours(0.15)).toBe('0.15')
    })

    it('treats non-finite input as zero', () => {
        expect(formatHours(NaN)).toBe('0.0')
        expect(formatHours(Infinity)).toBe('0.0')
    })

    it('gives distinct labels for the tick values recharts generates for sub-hour weeks', () => {
        const tickSets = [
            [0, 0.025, 0.05, 0.075, 0.1],
            [0, 0.065, 0.13, 0.195, 0.26],
            [0, 0.075, 0.15, 0.225, 0.3],
            [0, 0.15, 0.3, 0.45, 0.6],
            [0, 0.2, 0.4, 0.6, 0.8],
            [0, 0.25, 0.5, 0.75, 1],
            [0, 0.75, 1.5, 2.25, 3],
        ]
        for (const ticks of tickSets) {
            const labels = ticks.map(formatHours)
            expect(new Set(labels).size).toBe(labels.length)
        }
    })

    it('never produces a label longer than the axis can fit', () => {
        const widest = [0.075, 0.225, 120, 168].map(formatHours)
        for (const label of widest) expect(label.length).toBeLessThanOrEqual(5)
    })
})
