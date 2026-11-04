import { describe, expect, it } from 'vitest'
import { teamCompareOpponent, type RankedTeamRun } from './teamCompareOpponent'

function rankWindow(...seconds: number[]): RankedTeamRun[] {
    return seconds.map(time => ({ entry: { id: `run-${time}`, cap_time_seconds: time } }))
}

describe('teamCompareOpponent', () => {
    it('picks the next faster run in the rank window', () => {
        expect(teamCompareOpponent(rankWindow(60, 61, 62, 63, 64), 'run-62', 62)).toBe('run-61')
        expect(teamCompareOpponent(rankWindow(60, 61, 62, 63, 64), 'run-64', 64)).toBe('run-63')
    })

    it('falls back to the next slower run on the world record', () => {
        expect(teamCompareOpponent(rankWindow(60, 61, 62), 'run-60', 60)).toBe('run-61')
    })

    it('has no opponent when the run is alone on the map', () => {
        expect(teamCompareOpponent(rankWindow(60), 'run-60', 60)).toBeNull()
        expect(teamCompareOpponent([], 'run-60', 60)).toBeNull()
    })

    it('picks the nearest faster run by time when the run is not in the window', () => {
        expect(teamCompareOpponent(rankWindow(60, 61, 62, 63, 64), 'unverified', 62.5)).toBe('run-62')
    })

    it('picks the nearest slower run when nothing in the window is faster', () => {
        expect(teamCompareOpponent(rankWindow(60, 61, 62), 'unverified', 59)).toBe('run-60')
    })

    it('has no opponent without a team time when the run is not in the window', () => {
        expect(teamCompareOpponent(rankWindow(60, 61), 'unverified', null)).toBeNull()
    })
})
