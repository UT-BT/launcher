import { describe, expect, it } from 'vitest'
import { eventStatsFixture } from '@/app/utils/fixtures/eventStatsFixtures'
import { ACCENT_SLOT_COUNT, teamTilesView } from '@/app/components/pages/events/stats/statsView'
import { backdropMapName, emptyStageStats, expandedMatchIds, pickBanStepViews, teamAccentColor, teamPageAccentSlots } from './teamPageView'

function teamStats() {
    return eventStatsFixture('team')
}

describe('backdropMapName', () => {
    it('picks the map the team played most', () => {
        expect(backdropMapName(teamStats().map_profile)).toBe('CTF-BT-II-FaithCB')
    })

    it('has no backdrop before any map is played', () => {
        const rows = teamStats().map_profile.map(row => ({ ...row, played: 0 }))
        expect(backdropMapName(rows)).toBeNull()
        expect(backdropMapName([])).toBeNull()
    })
})

describe('teamPageAccentSlots', () => {
    const cranium = '5e08b92e-7d37-45ca-8684-f3826845fdeb'
    const spectrum = '801fbd24-028f-4bb7-8a2e-09bcde7f7cf6'

    function withUnseededCranium() {
        const overview = eventStatsFixture('overviewAll')
        const stats = teamStats()
        overview.teams = overview.teams.map(team => (team.id === cranium ? { ...team, seed: null } : team))
        overview.teams.push({ ...overview.teams[0], id: 'alpha', name: 'Alpha', seed: null })
        stats.matches = stats.matches.map(match => (
            match.opponent?.id === cranium ? { ...match, opponent: { ...match.opponent, seed: null } } : match
        ))
        return { overview, stats }
    }

    it('gives an unseeded opponent the same colour its overview card has', () => {
        const { overview, stats } = withUnseededCranium()
        expect(teamPageAccentSlots(overview.teams, stats)[cranium]).toBe(4)
    })

    it('colours an opponent missing from the overview list by its own seed', () => {
        const { overview, stats } = withUnseededCranium()
        expect(teamPageAccentSlots(overview.teams, stats)[spectrum]).toBe(9)
    })

    it('falls back to the team page’s own teams before the overview has loaded', () => {
        const { stats } = withUnseededCranium()
        const slots = teamPageAccentSlots(null, stats)
        expect(slots[cranium]).toBe(3)
        expect(slots['0afeb020-f471-4988-9201-2676902cc2b3']).toBe(2)
    })
})

describe('expandedMatchIds', () => {
    const latestComplete = '9fb5eabd-288c-4a3c-9195-35b7a772d04a'
    const firstComplete = 'f7d978c1-58f0-4428-a604-2294862864a1'
    const live = '27ab7518-294d-521b-8ccc-b056aa51fdd4'

    it('opens only the most recent complete match by default, skipping live and upcoming ones', () => {
        expect([...expandedMatchIds(teamStats().matches, {})]).toEqual([latestComplete])
    })

    it('follows the viewer’s toggles over the default', () => {
        const expanded = expandedMatchIds(teamStats().matches, { [latestComplete]: false, [firstComplete]: true })
        expect([...expanded]).toEqual([firstComplete])
    })

    it('never expands a live or upcoming match, since it has nothing to show', () => {
        expect(expandedMatchIds(teamStats().matches, { [live]: true }).has(live)).toBe(false)
    })

    it('opens the latest complete match, not a later forfeit', () => {
        const matches = teamStats().matches.map(match => (match.id === latestComplete ? { ...match, status: 'forfeit' as const } : match))
        expect([...expandedMatchIds(matches, {})]).toEqual(['1e3f5eae-05c7-49d4-8a66-9d17ff905b27'])
    })

    it('lets the viewer open a forfeit', () => {
        const matches = teamStats().matches.map(match => (match.id === latestComplete ? { ...match, status: 'forfeit' as const } : match))
        expect(expandedMatchIds(matches, { [latestComplete]: true }).has(latestComplete)).toBe(true)
    })

    it('opens nothing when no match has a result yet', () => {
        const matches = teamStats().matches.filter(match => match.status === 'live' || match.status === 'scheduled')
        expect(expandedMatchIds(matches, {}).size).toBe(0)
    })
})

describe('emptyStageStats', () => {
    it('shows a team with no matches in the chosen stage as blank tiles and no timeline', () => {
        const empty = emptyStageStats(teamStats().team)
        expect(empty.matches).toEqual([])
        expect(empty.map_profile).toEqual([])
        expect(empty.runs).toEqual([])
        expect(teamTilesView(empty)).toEqual({
            matches: { value: '—', form: [], summary: 'No results yet' },
            maps: '—',
            caps: '—',
        })
    })

    it('keeps who the team is', () => {
        const { team } = teamStats()
        const empty = emptyStageStats(team)
        expect(empty.team).toMatchObject({ id: team.id, name: team.name, seed: team.seed, members: team.members })
    })
})

describe('pickBanStepViews', () => {
    const names = { 'def1673e-b430-4770-8956-4cd2de9cf57d': 'KNRK', '0afeb020-f471-4988-9201-2676902cc2b3': "Hop n' Twerk" }

    it('numbers the steps in order and names who acted', () => {
        const steps = pickBanStepViews(teamStats().matches[0].pick_ban!, names)
        expect(steps).toHaveLength(8)
        expect(steps[0]).toEqual({
            key: 0,
            number: 1,
            action: 'ban',
            actionLabel: 'Ban',
            teamId: 'def1673e-b430-4770-8956-4cd2de9cf57d',
            teamName: 'KNRK',
            displayName: 'II-CoZyliciouS',
        })
        expect(steps[2]).toMatchObject({ number: 3, action: 'pick', actionLabel: 'Pick', teamName: "Hop n' Twerk", displayName: 'II-FaithCB' })
    })

    it('labels a decider step with no acting team', () => {
        const pickBan = teamStats().matches[0].pick_ban!
        pickBan.steps.push({ ...pickBan.steps[0], index: 8, action: 'decider', segment: 'decider', team_id: null })
        expect(pickBanStepViews(pickBan, names)[8]).toMatchObject({
            number: 9, action: 'decider', actionLabel: 'Decider', teamId: null, teamName: null,
        })
    })
})

describe('teamAccentColor', () => {
    it('gives each of the 12 slots its own theme-aware colour variable', () => {
        const colours = Array.from({ length: ACCENT_SLOT_COUNT }, (_, slot) => teamAccentColor(slot))
        expect(new Set(colours).size).toBe(ACCENT_SLOT_COUNT)
        expect(teamAccentColor(3)).toBe('var(--team-accent-3)')
    })

    it('wraps a slot past the palette', () => {
        expect(teamAccentColor(ACCENT_SLOT_COUNT + 2)).toBe(teamAccentColor(2))
    })

    it('falls back to the last slot for a team without one', () => {
        expect(teamAccentColor(undefined)).toBe(teamAccentColor(ACCENT_SLOT_COUNT - 1))
    })
})
