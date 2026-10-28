import { describe, expect, it } from 'vitest'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { mapStatsView } from './MapStatsTable'
import { overviewTeamCards, overviewTeams } from './StatsOverview'
import { DEFAULT_TEAM_SORT } from './statsView'
import type { EventStats } from '@/app/utils/api'

const teamsOf = (stats: EventStats) => overviewTeams(overviewTeamCards(stats, null, DEFAULT_TEAM_SORT))

describe('mapStatsView', () => {
    it('names the team that holds each fastest cup run, in its card colour', () => {
        const stats = eventStatsFixture('overviewAll')
        const view = mapStatsView(stats.maps, teamsOf(stats))

        expect(view.rows.map(row => [row.displayName, row.fastest?.run.time, row.fastestTeam?.name])).toEqual([
            ['II-AztecCE', '02:09.016', 'Sandbagging'],
            ['II-FaithCB', '01:53.559', 'Niagra Fools'],
            ['II-(K)LegendsV4', '01:14.088', 'Sandbagging'],
            ['II-SkaarjInvasion-vF2', '01:33.127', 'Sandbagging'],
            ['II-FleurdelysV2', '02:16.973', 'Team Trials'],
        ])
        expect(view.rows[4].fastestTeam?.accentSlot).toBe(5)
        expect(view.rows[4].fastest?.run.members.map(member => member.alias)).toEqual(['Vernon', 'Bugatti'])
    })

    it('shows the deciders column only when a map was a decider', () => {
        const stats = eventStatsFixture('overviewAll')
        const teams = teamsOf(stats)
        expect(mapStatsView(stats.maps, teams).columns.map(column => column.id)).not.toContain('deciders')

        const withDecider = stats.maps.map((map, index) => (index === 1 ? { ...map, deciders: 2 } : map))
        const view = mapStatsView(withDecider, teams)
        expect(view.columns.map(column => column.id)).toContain('deciders')
        expect(view.rows[1].deciders).toBe('2')
    })

    it('has no fastest team when the map has no linked run', () => {
        const stats = eventStatsFixture('overviewAll')
        const maps = stats.maps.map(map => ({ ...map, fastest_run: null }))

        expect(mapStatsView(maps, teamsOf(stats)).rows.every(row => row.fastest === null && row.fastestTeam === null)).toBe(true)
    })

    it('has the empty state for a stage without maps', () => {
        const stats = eventStatsFixture('overviewStageEmpty')
        const view = mapStatsView(stats.maps, teamsOf(stats))

        expect(view.rows).toEqual([])
        expect(view.emptyText).toBe('No maps played in this stage yet.')
    })
})
