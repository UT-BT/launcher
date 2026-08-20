import { describe, expect, it } from 'vitest'
import { formatTeamHours, isTeamStatSort } from './teamStats'

describe('formatTeamHours', () => {
    it('falls back to minutes under an hour', () => {
        expect(formatTeamHours(0)).toBe('0 m')
        expect(formatTeamHours(90)).toBe('2 m')
        expect(formatTeamHours(3540)).toBe('59 m')
    })

    it('keeps one decimal between 1 and 10 hours', () => {
        expect(formatTeamHours(3600)).toBe('1.0 h')
        expect(formatTeamHours(19800)).toBe('5.5 h')
    })

    it('rounds to whole hours from 10 hours up', () => {
        expect(formatTeamHours(36000)).toBe('10 h')
        expect(formatTeamHours(360000)).toBe('100 h')
    })

    it('switches to thousands past 1000 hours', () => {
        expect(formatTeamHours(3600 * 1500)).toBe('1.5k h')
    })

    it('treats missing and negative totals as zero', () => {
        expect(formatTeamHours(null)).toBe('0 m')
        expect(formatTeamHours(undefined)).toBe('0 m')
        expect(formatTeamHours(-60)).toBe('0 m')
    })
})

describe('isTeamStatSort', () => {
    it('matches only the aggregate metrics', () => {
        expect(isTeamStatSort('world_records')).toBe(true)
        expect(isTeamStatSort('caps')).toBe(true)
        expect(isTeamStatSort('playtime')).toBe(true)
        expect(isTeamStatSort('added')).toBe(false)
        expect(isTeamStatSort('members')).toBe(false)
        expect(isTeamStatSort('name')).toBe(false)
    })
})
