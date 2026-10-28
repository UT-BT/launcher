import { describe, expect, it } from 'vitest'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { cupAtAGlanceView, type GlanceTile } from './CupAtAGlance'
import { overviewTeamCards, overviewTeams } from './StatsOverview'
import { DEFAULT_TEAM_SORT } from './statsView'
import type { EventStats } from '@/app/utils/api'

const teamsOf = (stats: EventStats) => overviewTeams(overviewTeamCards(stats, null, DEFAULT_TEAM_SORT))

const headline = (tile: GlanceTile) => {
    switch (tile.kind) {
        case 'map': return [tile.label, tile.value, tile.unit, tile.map.display_name]
        case 'rate': return [tile.label, tile.value]
        case 'team': return [tile.label, tile.value, tile.unit, tile.team.name]
        case 'upset': return [tile.label, tile.score, tile.winner.team.name, tile.loser.team.name]
    }
}

describe('cupAtAGlanceView', () => {
    it('shows the pick & ban headlines, then the team headlines, with no footnotes', () => {
        const stats = eventStatsFixture('overviewAll')
        const view = cupAtAGlanceView(stats.records, teamsOf(stats))

        expect(view.tiles.map(headline)).toEqual([
            ['Most picked', '27', 'picks', 'II-AztecCE'],
            ['Most banned', '24', 'bans', 'II-(K)LegendsV4'],
            ['Banned first most', '7', 'first bans', 'II-FaithCB'],
            ['Picker win rate', '47%'],
            ['Fewest caps conceded', '7', 'in 16 maps', 'Niagra Fools'],
            ['Biggest upset', '3–1', "Hop n' Twerk", 'Team Trials'],
            ['Most comebacks', '5', undefined, 'Sandbagging'],
        ])
        expect(view.emptyText).toBeNull()
    })

    it('fills the picker ring with the win rate', () => {
        const stats = eventStatsFixture('overviewAll')
        const rate = cupAtAGlanceView(stats.records, teamsOf(stats)).tiles.find(tile => tile.kind === 'rate')
        expect(rate).toMatchObject({ share: stats.records.picker!.rate })
    })

    it('shows the upset as two seeded teams in their card colours, with no pick & ban link', () => {
        const stats = eventStatsFixture('overviewAll')
        const upset = cupAtAGlanceView(stats.records, teamsOf(stats)).tiles.find(tile => tile.kind === 'upset')

        expect(upset).toEqual({
            kind: 'upset',
            label: 'Biggest upset',
            score: '3–1',
            winner: { team: expect.objectContaining({ name: "Hop n' Twerk" }), seed: 15 },
            loser: { team: expect.objectContaining({ id: 'a43b6a15-4dc2-4705-833a-c733b67ca2a5', name: 'Team Trials', accentSlot: 5 }), seed: 6 },
        })
    })

    it('leaves out a tile whose record is null', () => {
        const stats = eventStatsFixture('overviewAll')
        const records = { ...stats.records, first_ban: null, biggest_upset: null }
        const view = cupAtAGlanceView(records, teamsOf(stats))

        expect(view.tiles.map(tile => tile.label)).toEqual([
            'Most picked', 'Most banned', 'Picker win rate', 'Fewest caps conceded', 'Most comebacks',
        ])
    })

    it('uses the singular for one', () => {
        const stats = eventStatsFixture('overviewAll')
        const records = { ...stats.records, most_picked: { ...stats.records.most_picked!, picks: 1 } }
        expect(cupAtAGlanceView(records, teamsOf(stats)).tiles[0]).toMatchObject({ value: '1', unit: 'pick' })
    })

    it('shows the empty state when no record has data', () => {
        const stats = eventStatsFixture('overviewStageEmpty')
        const view = cupAtAGlanceView(stats.records, teamsOf(stats))

        expect(view.tiles).toEqual([])
        expect(view.emptyText).toBe('Headlines appear once a match in this stage has an official result.')
    })
})
