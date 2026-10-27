import { describe, expect, it } from 'vitest'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { overviewTeamCards } from './StatsOverview'
import { DEFAULT_TEAM_SORT, accentSlots, sortTeams } from './statsView'

describe('overviewTeamCards', () => {
    it('lists the teams in the view-model default order', () => {
        const stats = eventStatsFixture('overviewAll')
        const cards = overviewTeamCards(stats, null, DEFAULT_TEAM_SORT)
        expect(cards.map(card => card.id)).toEqual(sortTeams(stats.teams, 'standing').map(team => team.id))
    })

    it('follows the chosen sort', () => {
        const stats = eventStatsFixture('overviewAll')
        for (const sort of ['seed', 'record', 'caps'] as const) {
            expect(overviewTeamCards(stats, null, sort).map(card => card.id)).toEqual(sortTeams(stats.teams, sort).map(team => team.id))
        }
    })

    it('colours a stage-filtered team as it is coloured across all stages', () => {
        const all = eventStatsFixture('overviewAll')
        const stage = eventStatsFixture('overviewStageEmpty')
        const unseededId = stage.teams[0].id
        const allTeams = all.teams.map(team => (team.id === unseededId ? { ...team, seed: null } : team))
        stage.teams[0].seed = null
        const expected = accentSlots(allTeams)[unseededId]

        const card = overviewTeamCards(stage, allTeams, DEFAULT_TEAM_SORT).find(entry => entry.id === unseededId)!
        expect(card.accentSlot).toBe(expected)
        expect(accentSlots(stage.teams)[unseededId]).not.toBe(expected)
    })

    it('names form opponents from the all-stages list', () => {
        const all = eventStatsFixture('overviewAll')
        const team = all.teams.find(entry => entry.form.length > 0)!
        const opponentId = team.form[0].opponent_id
        const opponent = all.teams.find(entry => entry.id === opponentId)!
        const scoped = { ...all, teams: [team] }

        const card = overviewTeamCards(scoped, all.teams, DEFAULT_TEAM_SORT)[0]
        expect(card.form[0].title).toContain(opponent.name)
    })

    it('keeps member names out of the card text', () => {
        const stats = eventStatsFixture('overviewAll')
        for (const card of overviewTeamCards(stats, null, DEFAULT_TEAM_SORT)) {
            const text = [card.name, card.seedLabel, card.standing.label, card.pathText, card.formSummary, card.recordsHeld?.label ?? '']
            for (const member of card.members) {
                if (member.alias && !card.name.includes(member.alias)) {
                    expect(text.join(' ')).not.toContain(member.alias)
                }
            }
        }
    })
})
