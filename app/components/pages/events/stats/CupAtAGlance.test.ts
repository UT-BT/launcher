import { describe, expect, it } from 'vitest'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { cupAtAGlanceView } from './CupAtAGlance'
import { overviewTeamCards, overviewTeams } from './StatsOverview'
import { DEFAULT_TEAM_SORT } from './statsView'
import type { EventStats } from '@/app/utils/api'

const teamsOf = (stats: EventStats) => overviewTeams(overviewTeamCards(stats, null, DEFAULT_TEAM_SORT))

describe('cupAtAGlanceView', () => {
    it('shows the four pick & ban headlines in order', () => {
        const stats = eventStatsFixture('overviewAll')
        const view = cupAtAGlanceView(stats.records, teamsOf(stats))

        expect(view.mapTiles.map(tile => [tile.label, tile.value, tile.note])).toEqual([
            ['Most picked', '27', 'picks · played 20 times'],
            ['Most banned', '24', 'bans · 3 of them the first ban'],
            ['Banned first most', '7', 'first bans · still played 21 times'],
            ['Picking your map', '47%', '69 of 147 maps'],
        ])
    })
    it('shows the four team headlines with each team in its card colour', () => {
        const stats = eventStatsFixture('overviewAll')
        const teams = teamsOf(stats)
        const view = cupAtAGlanceView(stats.records, teams)

        expect(view.teamTiles.map(tile => [tile.label, tile.value, tile.suffix, tile.note])).toEqual([
            ['Fastest team', '−4%', undefined, 'median run vs the cup median on the same map · 29 runs'],
            ['Fewest caps conceded', '7', undefined, 'caps against in 16 maps'],
            ['Biggest upset', '#15', 'beat #6', '3–1'],
            ['Most comebacks', '5', undefined, 'maps won after the opponent capped first'],
        ])
        expect(view.teamTiles.map(tile => tile.team?.name)).toEqual([
            'Sandbagging', 'Niagra Fools', "Hop n' Twerk", 'Sandbagging',
        ])
        const sandbagging = stats.teams.find(team => team.name === 'Sandbagging')!
        expect(view.teamTiles[0].team).toMatchObject({ accentSlot: 1, members: sandbagging.members })
    })

    it('links the biggest upset to the loser and to the match', () => {
        const stats = eventStatsFixture('overviewAll')
        const upset = cupAtAGlanceView(stats.records, teamsOf(stats)).teamTiles[2].upset

        expect(upset).toMatchObject({
            loser: { id: 'a43b6a15-4dc2-4705-833a-c733b67ca2a5', name: 'Team Trials', accentSlot: 5 },
            matchId: 'b6824418-99a5-4baf-99cf-5b918a74c67d',
        })
    })
    it('leaves out a tile whose record is null', () => {
        const stats = eventStatsFixture('overviewAll')
        const records = { ...stats.records, first_ban: null, fastest_team: null, biggest_upset: null }
        const view = cupAtAGlanceView(records, teamsOf(stats))

        expect(view.mapTiles.map(tile => tile.label)).toEqual(['Most picked', 'Most banned', 'Picking your map'])
        expect(view.teamTiles.map(tile => tile.label)).toEqual(['Fewest caps conceded', 'Most comebacks'])
        expect(view.emptyText).toBeNull()
    })

    it('blurs the most picked map behind the strip', () => {
        const stats = eventStatsFixture('overviewAll')
        expect(cupAtAGlanceView(stats.records, teamsOf(stats)).backdropMap).toBe('CTF-BT-II-AztecCE')

        const withoutPicks = cupAtAGlanceView({ ...stats.records, most_picked: null }, teamsOf(stats))
        expect(withoutPicks.backdropMap).toBeNull()
    })

    it('shows the empty state when no record has data', () => {
        const stats = eventStatsFixture('overviewStageEmpty')
        const view = cupAtAGlanceView(stats.records, teamsOf(stats))

        expect(view.mapTiles).toEqual([])
        expect(view.teamTiles).toEqual([])
        expect(view.emptyText).toBe('Headlines appear once a match in this stage has an official result.')
    })
})
