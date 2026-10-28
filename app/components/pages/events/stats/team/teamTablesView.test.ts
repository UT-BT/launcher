import { describe, expect, it } from 'vitest'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { teamNames, teamPageTeams } from '@/app/components/pages/events/stats/statsView'
import type { EventTeamRun } from '@/app/utils/api'
import {
    COMPACT_RUN_LIMIT, DEFAULT_TEAM_RUN_SORT, nextTeamRunSort, runDateText, sortTeamRuns, teamRunsPage, wdlBarSegments,
} from './teamTablesView'

function teamStats() {
    return eventStatsFixture('team')
}

function names() {
    return teamNames(teamPageTeams(teamStats()))
}

function times(runs: readonly EventTeamRun[]) {
    return runs.map(run => run.team_time_seconds)
}

describe('sortTeamRuns', () => {
    it('defaults to play order, oldest run first', () => {
        const sorted = sortTeamRuns(teamStats(), DEFAULT_TEAM_RUN_SORT)
        expect(DEFAULT_TEAM_RUN_SORT).toEqual({ key: 'date', dir: 'asc' })
        expect(sorted).toHaveLength(18)
        const dates = sorted.map(run => Date.parse(run.completed_at))
        expect(dates).toEqual([...dates].sort((a, b) => a - b))
    })

    it('reverses on descending time', () => {
        const sorted = sortTeamRuns(teamStats(), { key: 'time', dir: 'desc' })
        expect(times(sorted)).toEqual([...times(teamStats().runs)].sort((a, b) => b - a))
    })

    it('sorts by map name, fastest first within a map', () => {
        const sorted = sortTeamRuns(teamStats(), { key: 'map', dir: 'asc' })
        const faith = sorted.filter(run => run.display_name === 'II-FaithCB')
        expect(sorted[0].display_name).toBe('II-(K)LegendsV4')
        expect(sorted.at(-1)!.display_name).toBe('II-SkaarjInvasion-vF2')
        expect(times(faith)).toEqual([119.932, 124.497, 147.881, 165.233])
    })

    it('keeps the fastest-first tie-break when a column is descending', () => {
        const sorted = sortTeamRuns(teamStats(), { key: 'map', dir: 'desc' })
        expect(sorted[0].display_name).toBe('II-SkaarjInvasion-vF2')
        expect(times(sorted.filter(run => run.display_name === 'II-SkaarjInvasion-vF2'))).toEqual([148.049, 151.147, 168.79])
    })

    it('sorts by opponent name', () => {
        const lookup = names()
        const sorted = sortTeamRuns(teamStats(), { key: 'opponent', dir: 'asc' })
        const labels = sorted.map(run => lookup[run.opponent_id])
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    })

    it('sorts by stage in play order, not alphabetically', () => {
        const stats = teamStats()
        const playoffs = { ...stats.runs[0], stage_key: 'playoffs', stage_name: 'Finals', team_time_seconds: 50 }
        const withPlayoffs = { ...stats, runs: [playoffs, ...stats.runs] }
        const sorted = sortTeamRuns(withPlayoffs, { key: 'stage', dir: 'asc' })
        expect(sorted.at(-1)!.stage_name).toBe('Finals')
        expect(sortTeamRuns(withPlayoffs, { key: 'stage', dir: 'desc' })[0].stage_name).toBe('Finals')
    })

    it('sorts by completion date', () => {
        const sorted = sortTeamRuns(teamStats(), { key: 'date', dir: 'desc' })
        const dates = sorted.map(run => run.completed_at)
        expect(dates).toEqual([...dates].sort().reverse())
    })

    it('does not reorder the payload', () => {
        const stats = teamStats()
        const before = times(stats.runs)
        sortTeamRuns(stats, { key: 'time', dir: 'asc' })
        expect(times(stats.runs)).toEqual(before)
    })
})

describe('nextTeamRunSort', () => {
    it('flips the direction of the active column', () => {
        expect(nextTeamRunSort({ key: 'time', dir: 'asc' }, 'time')).toEqual({ key: 'time', dir: 'desc' })
        expect(nextTeamRunSort({ key: 'time', dir: 'desc' }, 'time')).toEqual({ key: 'time', dir: 'asc' })
    })

    it('starts a new column ascending', () => {
        expect(nextTeamRunSort({ key: 'time', dir: 'desc' }, 'date')).toEqual({ key: 'date', dir: 'asc' })
    })
})

describe('teamRunsPage', () => {
    const rows = Array.from({ length: 18 }, (_, index) => index)

    it('shows the first 12 rows with a "Show all" label', () => {
        const page = teamRunsPage(rows, false)
        expect(COMPACT_RUN_LIMIT).toBe(12)
        expect(page.rows).toEqual(rows.slice(0, 12))
        expect(page.showAllLabel).toBe('Show all 18 runs')
    })

    it('shows every row once expanded', () => {
        expect(teamRunsPage(rows, true)).toEqual({ rows, showAllLabel: null })
    })

    it('needs no button for a short list', () => {
        expect(teamRunsPage(rows.slice(0, 12), false)).toEqual({ rows: rows.slice(0, 12), showAllLabel: null })
    })
})

describe('runDateText', () => {
    it('reads the date in the display timezone', () => {
        const lateUtc = '2026-10-04T23:30:00+00:00'
        expect(runDateText(lateUtc, 'UTC')).toContain('4')
        expect(runDateText(lateUtc, 'Asia/Tokyo')).toContain('5')
        expect(runDateText(lateUtc, 'UTC')).not.toBe(runDateText(lateUtc, 'Asia/Tokyo'))
    })

    it('falls back to the local zone for an unknown timezone', () => {
        expect(runDateText('2026-10-04T12:00:00+00:00', 'Not/AZone')).toBeTruthy()
    })

    it('shows a dash for an unreadable date', () => {
        expect(runDateText('', 'UTC')).toBe('—')
    })
})

describe('wdlBarSegments', () => {
    it('gives one segment per result with its width', () => {
        expect(wdlBarSegments({ w: 0.5, d: 0.25, l: 0.25 })).toEqual([
            { result: 'W', width: '50%' },
            { result: 'D', width: '25%' },
            { result: 'L', width: '25%' },
        ])
    })

    it('drops empty results', () => {
        expect(wdlBarSegments({ w: 2 / 3, d: 0, l: 1 / 3 }).map(segment => segment.result)).toEqual(['W', 'L'])
        expect(wdlBarSegments({ w: 0, d: 0, l: 0 })).toEqual([])
    })
})
