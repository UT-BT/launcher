import { describe, expect, it } from 'vitest'
import { medalMultiplierLabel, medalThresholdsFromWorldRecord, teamWorldRecord } from './medalThresholds'

describe('medalThresholdsFromWorldRecord', () => {
    it('scales the world record by the medal multipliers', () => {
        const thresholds = medalThresholdsFromWorldRecord(100)
        expect(thresholds.world_record).toBe(100)
        expect(thresholds.champion_medal).toBeCloseTo(102.5, 9)
        expect(thresholds.gold_medal).toBeCloseTo(112.5, 9)
        expect(thresholds.silver_medal).toBeCloseTo(130, 9)
        expect(thresholds.bronze_medal).toBeCloseTo(160, 9)
    })
})

describe('medalMultiplierLabel', () => {
    it('describes each multiplier as a percentage over the world record', () => {
        expect(medalMultiplierLabel('champion_medal')).toBe('WR + 2.5%')
        expect(medalMultiplierLabel('gold_medal')).toBe('WR + 12.5%')
        expect(medalMultiplierLabel('silver_medal')).toBe('WR + 30%')
        expect(medalMultiplierLabel('bronze_medal')).toBe('WR + 60%')
    })
})

describe('teamWorldRecord', () => {
    it('is the fastest verified team run', () => {
        expect(teamWorldRecord([
            { verified: false, cap_time_seconds: 50 },
            { verified: true, cap_time_seconds: 80 },
            { verified: true, cap_time_seconds: 70 },
        ])).toBe(70)
    })

    it('is null without a verified run', () => {
        expect(teamWorldRecord([{ verified: false, cap_time_seconds: 50 }])).toBeNull()
        expect(teamWorldRecord([])).toBeNull()
    })
})
