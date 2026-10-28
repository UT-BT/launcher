import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEventTeamStats } from '@/app/utils/api'
import { eventStatsFixture, eventStatsFixtureResponse, type EventStatsFixtureName } from '@/app/utils/fixtures/eventStatsFixtures'
import {
    readTeamOrNotFound, teamPageStatus,
    ACCENT_SLOT_COUNT, DEFAULT_TEAM_SORT, TEAM_SORTS, TIME_NOT_RECORDED, accentSlots, formPips, formSummary, mapRankView, ordinal,
    pathParts, pathText, runTimeText, runView, sortTeams, stageChips, stageScopeLabel, statsMode, teamCardView,
    teamMatchView, teamNames, teamPageTeams, teamTilesView, mapProfileView, mapTableView, teamRunsView,
} from './statsView'

function overviewTeams() {
    return eventStatsFixture('overviewAll').teams
}

describe('statsMode', () => {
    it('shows the stats once the bracket is published', () => {
        expect(statsMode({ published: true })).toBe('stats')
    })

    it('keeps the roster while the bracket is unpublished or not loaded', () => {
        expect(statsMode({ published: false })).toBe('roster')
        expect(statsMode(null)).toBe('roster')
        expect(statsMode(undefined)).toBe('roster')
    })

    it('keeps the roster when the stats read itself says unpublished', () => {
        expect(statsMode(eventStatsFixture('overviewUnpublished'))).toBe('roster')
        expect(statsMode(eventStatsFixture('overviewAll'))).toBe('stats')
    })
})

describe('stageChips', () => {
    const { stages } = eventStatsFixture('overviewAll')

    it('offers All first, then one chip per stage in order', () => {
        expect(stageChips(stages, null)).toEqual([
            { key: null, label: 'All', active: true },
            { key: 'groups', label: 'Group Stage', active: false },
            { key: 'playoffs', label: 'Playoff Stage', active: false },
        ])
    })

    it('marks the selected stage active instead of All', () => {
        expect(stageChips(stages, 'playoffs').map(chip => chip.active)).toEqual([false, false, true])
    })

    it('has only All when the event has no visible stages', () => {
        expect(stageChips(eventStatsFixture('overviewUnpublished').stages, null)).toEqual([{ key: null, label: 'All', active: true }])
    })

    it('labels the scope of the current filter', () => {
        expect(stageScopeLabel(stages, null)).toBe('All stages')
        expect(stageScopeLabel(stages, 'groups')).toBe('Group Stage')
    })
})

describe('sortTeams', () => {
    const names = (key: Parameters<typeof sortTeams>[1], patch?: (teams: ReturnType<typeof overviewTeams>) => void) => {
        const teams = overviewTeams()
        patch?.(teams)
        return sortTeams(teams, key).map(team => team.name)
    }

    it('offers Standing as the default, then Seed, Record and Caps', () => {
        expect(DEFAULT_TEAM_SORT).toBe('standing')
        expect(TEAM_SORTS).toEqual([
            { key: 'standing', label: 'Standing' },
            { key: 'seed', label: 'Seed' },
            { key: 'record', label: 'Record' },
            { key: 'caps', label: 'Caps' },
        ])
    })

    it('orders by furthest stage reached, then record, then seed by default', () => {
        expect(names('standing')).toEqual(['Niagra Fools', 'Sandbagging', "Hop n' Twerk", 'Team Trials', 'KNRK', 'Cranium Bashers'])
    })

    it('puts the Champion first once the cup is decided', () => {
        expect(names('standing', teams => { teams.find(team => team.name === 'KNRK')!.standing = 'champion' })[0]).toBe('KNRK')
    })

    it('orders by seed, with unseeded teams last by name', () => {
        expect(names('seed', teams => {
            teams.find(team => team.name === 'Team Trials')!.seed = null
            teams.find(team => team.name === 'KNRK')!.seed = null
        })).toEqual(['Sandbagging', 'Niagra Fools', "Hop n' Twerk", 'Cranium Bashers', 'KNRK', 'Team Trials'])
    })

    it('orders by record: points, then map difference, then cap difference', () => {
        expect(names('record')).toEqual(['Niagra Fools', 'Sandbagging', "Hop n' Twerk", 'Team Trials', 'KNRK', 'Cranium Bashers'])
    })

    it('orders by caps scored, then fewest conceded', () => {
        expect(names('caps')).toEqual(['Niagra Fools', 'Sandbagging', 'Team Trials', "Hop n' Twerk", 'KNRK', 'Cranium Bashers'])
    })

    it('breaks a full tie by seed', () => {
        expect(names('caps', teams => {
            for (const team of teams) team.record.caps = { for: 5, against: 5 }
        })).toEqual(['Sandbagging', 'Team Trials', 'Niagra Fools', 'KNRK', "Hop n' Twerk", 'Cranium Bashers'])
    })

    it('leaves the input order untouched', () => {
        const teams = overviewTeams()
        sortTeams(teams, 'caps')
        expect(teams.map(team => team.name)).toEqual(overviewTeams().map(team => team.name))
    })
})

describe('accentSlots', () => {
    const slotsByName = (teams: { id: string; name: string; seed: number | null }[]) => {
        const slots = accentSlots(teams)
        return Object.fromEntries(teams.map(team => [team.name, slots[team.id]]))
    }

    it('has a 12-slot palette', () => {
        expect(ACCENT_SLOT_COUNT).toBe(12)
    })

    it('gives seed 1 slot 0 and follows seed order, wrapping after 12', () => {
        expect(slotsByName(overviewTeams())).toEqual({
            Sandbagging: 1,
            'Team Trials': 5,
            'Niagra Fools': 8,
            KNRK: 11,
            "Hop n' Twerk": 2,
            'Cranium Bashers': 3,
        })
        expect(slotsByName([{ id: 'a', name: 'A', seed: 1 }, { id: 'm', name: 'M', seed: 13 }])).toEqual({ A: 0, M: 0 })
    })

    it('puts unseeded teams after the last seed, by name', () => {
        const teams = overviewTeams()
        teams.find(team => team.name === 'Team Trials')!.seed = null
        teams.find(team => team.name === 'KNRK')!.seed = null
        const slots = slotsByName(teams)
        expect(slots.KNRK).toBe(4)
        expect(slots['Team Trials']).toBe(5)
        expect(slots.Sandbagging).toBe(1)
    })

    it('keeps a team on the same slot when a stage filter shows fewer teams', () => {
        const all = accentSlots(overviewTeams())
        const fewer = accentSlots(overviewTeams().filter(team => team.seed !== 2))
        for (const [id, slot] of Object.entries(fewer)) expect(slot).toBe(all[id])
    })

    it('colours the team page the same way as the overview', () => {
        const page = eventStatsFixture('team')
        const slots = accentSlots(teamPageTeams(page))
        const overview = accentSlots(overviewTeams())
        expect(slots[page.team.id]).toBe(overview[page.team.id])
        for (const match of page.matches) {
            if (match.opponent && overview[match.opponent.id] !== undefined) expect(slots[match.opponent.id]).toBe(overview[match.opponent.id])
        }
    })

    it('never gives both sides of a played match the same colour in the fixture', () => {
        const page = eventStatsFixture('team')
        const slots = accentSlots(teamPageTeams(page))
        for (const match of page.matches.filter(m => m.opponent)) {
            expect(slots[match.opponent!.id]).not.toBe(slots[page.team.id])
        }
    })
})

describe('teamPageTeams', () => {
    it('lists the team and each opponent once', () => {
        expect(teamPageTeams(eventStatsFixture('team')).map(team => team.name)).toEqual([
            "Hop n' Twerk", 'KNRK', 'Cranium Bashers', 'Team Trials', 'Sandbagging', 'Niagra Fools', 'Autism Spectrum Gang',
        ])
    })
})

function overviewTeam(name: string) {
    return overviewTeams().find(team => team.name === name)!
}

describe('formPips', () => {
    const names = teamNames(overviewTeams())

    it('keeps the last results oldest first, each titled with its opponent', () => {
        expect(formPips(overviewTeam('Sandbagging').form, names).map(pip => [pip.result, pip.title])).toEqual([
            ['W', 'Won vs Cranium Bashers'],
            ['W', 'Won vs KNRK'],
            ['W', "Won vs Hop n' Twerk"],
            ['W', 'Won vs Team Trials'],
            ['D', 'Drew vs Niagra Fools'],
        ])
        expect(formPips(overviewTeam('KNRK').form, names)[0]).toEqual({
            result: 'L',
            title: "Lost vs Hop n' Twerk",
            matchId: overviewTeam('KNRK').form[0].match_id,
            opponentId: overviewTeam("Hop n' Twerk").id,
        })
    })

    it('titles a result without an opponent name when the opponent is unknown', () => {
        expect(formPips([{ result: 'W', match_id: 'm', opponent_id: 'nobody' }], names)[0].title).toBe('Won')
    })

    it('summarises the pips for screen readers, or says there are none yet', () => {
        expect(formSummary(formPips(overviewTeam('KNRK').form, names))).toBe('Last 5 results')
        expect(formSummary(formPips(eventStatsFixture('overviewStageEmpty').teams[0].form, names))).toBe('No results yet')
    })
})

describe('pathParts', () => {
    it('shows an advancement to a stage not generated yet as the next step', () => {
        const parts = pathParts(overviewTeam('Sandbagging').path)
        expect(parts).toEqual([
            { label: 'Group A · 2nd', next: false },
            { label: 'Final Stage', next: true },
        ])
        expect(pathText(parts)).toBe('Group A · 2nd → Final Stage')
    })

    it('does not repeat a target the team already plays in', () => {
        expect(pathText(pathParts(overviewTeam('KNRK').path))).toBe('Group A · 5th → Playoff Stage · 0-0')
    })

    it('labels a stage without groups by its name', () => {
        expect(pathParts([{ stage_key: 'final', stage_name: 'Final Stage', group: null, finish: '', advanced_to: null }])).toEqual([
            { label: 'Final Stage', next: false },
        ])
    })
})

describe('teamCardView', () => {
    const teams = overviewTeams()
    const context = { slots: accentSlots(teams), names: teamNames(teams) }

    it('gives a card everything it renders for a team holding records', () => {
        const card = teamCardView(overviewTeam('Sandbagging'), context)
        expect(card).toMatchObject({
            id: overviewTeam('Sandbagging').id,
            name: 'Sandbagging',
            accentSlot: 1,
            seedLabel: 'Seed 2',
            standing: { key: 'alive', label: 'Alive' },
            pathText: 'Group A · 2nd → Final Stage',
            record: { matches: '4-1-0', maps: '14-0-3', caps: '29–13' },
            formSummary: 'Last 5 results',
            recordsHeld: {
                label: '3 cup records',
                title: 'II-AztecCE 02:09.016 · II-(K)LegendsV4 01:14.088 · II-SkaarjInvasion-vF2 01:33.127',
            },
        })
        expect(card.form).toHaveLength(5)
        expect(card.members).toEqual(overviewTeam('Sandbagging').members)
    })

    it('uses the singular for one cup record and leaves the note out for none', () => {
        expect(teamCardView(overviewTeam('Team Trials'), context).recordsHeld?.label).toBe('1 cup record')
        expect(teamCardView(overviewTeam('KNRK'), context).recordsHeld).toBeNull()
    })

    it('shows dashes, not zeros, before a team has an official result in scope', () => {
        const empty = eventStatsFixture('overviewStageEmpty').teams[0]
        expect(teamCardView(empty, context).record).toEqual({ matches: '—', maps: '—', caps: '—' })
        expect(teamCardView(empty, context).formSummary).toBe('No results yet')
    })

    it('labels every standing chip and an unseeded team', () => {
        const team = overviewTeam('KNRK')
        const label = (standing: typeof team.standing) => teamCardView({ ...team, standing }, context).standing.label
        expect(['alive', 'eliminated', 'champion', 'withdrawn', 'disqualified'].map(s => label(s as typeof team.standing)))
            .toEqual(['Alive', 'Eliminated', 'Champion', 'Withdrawn', 'Disqualified'])
        expect(teamCardView({ ...team, seed: null }, context).seedLabel).toBe('Unseeded')
    })
})

function teamPage() {
    return eventStatsFixture('team')
}

function teamMatch(idPrefix: string) {
    return teamPage().matches.find(match => match.id.startsWith(idPrefix))!
}

describe('teamTilesView', () => {
    it('gives the three team page tiles', () => {
        const tiles = teamTilesView(teamPage())
        expect(tiles.matches.value).toBe('3-0-2')
        expect(tiles.matches.form.map(pip => pip.title)).toEqual([
            'Won vs KNRK', 'Won vs Cranium Bashers', 'Won vs Team Trials', 'Lost vs Sandbagging', 'Lost vs Niagra Fools',
        ])
        expect(tiles.maps).toBe('8-1-7')
        expect(tiles.caps).toBe('18–17')
    })

    it('shows dashes before any map is played in scope', () => {
        const page = teamPage()
        page.team = eventStatsFixture('overviewStageEmpty').teams[0]
        const tiles = teamTilesView(page)
        expect(tiles.matches).toMatchObject({ value: '—', summary: 'No results yet' })
        expect(tiles.maps).toBe('—')
        expect(tiles.caps).toBe('—')
    })
})

describe('ordinal', () => {
    it('gives the English suffix, teens included', () => {
        expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal))
            .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'])
    })
})

describe('mapRankView', () => {
    it('reads the rank among the teams with a run on the map', () => {
        expect(mapRankView({ rank: 3, of: 14 })).toEqual({ position: '3rd', of: 'of 14', top: false })
    })

    it('marks the fastest team on the map', () => {
        expect(mapRankView({ rank: 1, of: 9 })).toEqual({ position: '1st', of: 'of 9', top: true })
    })

    it('has nothing without a run', () => {
        expect(mapRankView(null)).toBeNull()
    })
})

describe('runTimeText', () => {
    it('formats team times through the cap-time format with millisecond precision', () => {
        expect(runTimeText(119.932)).toBe('01:59.932')
        expect(runTimeText(3725.5)).toBe('1:02:05.500')
    })

    it('shows a dash for a missing time', () => {
        expect(runTimeText(null)).toBe('—')
    })
})

describe('runView', () => {
    it('gives the team time and the own cap time of each player', () => {
        const run = teamMatch('f7d978c1').maps[0].runs_for[0]
        expect(runView(run)).toMatchObject({
            time: '01:59.932',
            teamCapId: 'c4fbd258-678b-422b-8dee-4056821fe0c0',
            region: 'Germany',
            replay: 'demo',
        })
        expect(runView(run).members.map(member => [member.alias, member.time])).toEqual([['Decl', '01:59.531'], ['ShX', '01:59.932']])
    })

    it('offers a ghost replay, or none', () => {
        const run = teamMatch('f7d978c1').maps[0].runs_for[0]
        expect(runView({ ...run, has_demo: false, has_ghost: true }).replay).toBe('ghost')
        expect(runView({ ...run, has_demo: false, has_ghost: false }).replay).toBeNull()
        expect(runView({ ...run, server: null }).region).toBeNull()
    })
})

describe('teamMatchView', () => {
    const names = teamNames(teamPageTeams(teamPage()))

    it('renders a complete match with its score, side and maps', () => {
        const view = teamMatchView(teamMatch('f7d978c1'), names)
        expect(view).toMatchObject({
            state: 'result',
            meta: 'Group Stage · Group A · Round 5',
            opponentLabel: 'KNRK',
            side: 'BLUE',
            score: '2–0',
            result: 'W',
            statusLabel: 'W',
            pickBanLink: 'Replay pick & ban',
            note: null,
        })
        expect(view.maps.map(map => map.displayName)).toEqual(['II-FaithCB', 'II-SkaarjInvasion-vF2', 'II-DoubleVision-CE', 'II-FleurdelysV2'])
    })

    it('puts a placeholder per recorded cap that has no linked run', () => {
        const skaarj = teamMatchView(teamMatch('f7d978c1'), names).maps[1]
        expect(skaarj).toMatchObject({ score: '1–1', result: 'D', pickLabel: 'Picked by KNRK', notPlayedText: null })
        expect(skaarj.sides.for.runs).toHaveLength(1)
        expect(skaarj.sides.for.placeholders).toEqual([])
        expect(skaarj.sides.against.runs).toEqual([])
        expect(skaarj.sides.against.placeholders).toEqual(['Time not recorded'])
        expect(skaarj.sides.against.noCapsText).toBeNull()
    })

    it('repeats the placeholder once per unrecorded cap', () => {
        const match = teamMatch('f7d978c1')
        match.maps[1] = { ...match.maps[1], unrecorded_against: 2 }
        expect(teamMatchView(match, names).maps[1].sides.against.placeholders).toEqual([TIME_NOT_RECORDED, TIME_NOT_RECORDED])
    })

    it('says No caps for a side that did not score', () => {
        const faith = teamMatchView(teamMatch('f7d978c1'), names).maps[0]
        expect(faith.sides.against).toEqual({ runs: [], placeholders: [], noCapsText: 'No caps' })
        expect(faith.pickLabel).toBe("Picked by Hop n' Twerk")
    })

    it('marks a map that was not played', () => {
        const unplayed = teamMatchView(teamMatch('f7d978c1'), names).maps[3]
        expect(unplayed).toMatchObject({ played: false, score: null, result: null, notPlayedText: 'Not played: the series was already decided.' })
        expect(unplayed.sides.for).toEqual({ runs: [], placeholders: [], noCapsText: null })
    })

    it('labels a decider instead of a picker', () => {
        const match = teamMatch('f7d978c1')
        match.maps[2] = { ...match.maps[2], kind: 'decider', picked_by: null }
        expect(teamMatchView(match, names).maps[2].pickLabel).toBe('Decider')
    })

    it('renders a live match as Live without any numbers', () => {
        expect(teamMatchView(teamMatch('27ab7518'), names)).toMatchObject({
            state: 'live',
            statusLabel: 'Live',
            meta: 'Playoff Stage · 1-0',
            opponentLabel: 'Autism Spectrum Gang',
            score: null,
            result: null,
            maps: [],
            pickBanLink: 'Watch pick & ban',
            note: 'Stats update when the result is official.',
        })
    })

    it('never shows numbers for a live match even if the payload carries some', () => {
        const match = { ...teamMatch('27ab7518'), score: { for: 1, against: 0 }, result: 'W' as const, maps: teamMatch('f7d978c1').maps }
        expect(teamMatchView(match, names)).toMatchObject({ score: null, result: null, maps: [] })
    })

    it('renders a scheduled match as upcoming with the opponent still open', () => {
        expect(teamMatchView(teamMatch('d57e9a47'), names)).toMatchObject({
            state: 'upcoming',
            statusLabel: 'Upcoming',
            meta: 'Playoff Stage',
            opponent: null,
            opponentLabel: 'Opponent to be decided',
            side: null,
            score: null,
            maps: [],
            note: 'Pick & ban opens before the match.',
        })
    })

    it('says a forfeit played no maps', () => {
        const match = { ...teamMatch('f7d978c1'), status: 'forfeit' as const, maps: [] }
        expect(teamMatchView(match, names)).toMatchObject({ state: 'result', score: '2–0', note: 'Decided by forfeit: no maps were played.' })
    })
})

describe('mapTableView', () => {
    it('gives the desktop columns, with the map and fastest run always shown', () => {
        const view = mapTableView(eventStatsFixture('overviewAll').maps)
        expect(view.hasDeciders).toBe(false)
        expect(view.columns.map(column => column.id)).toEqual(['map', 'played', 'picks', 'bans', 'firstBans', 'picker', 'fastest'])
        expect(view.columns.filter(column => column.required).map(column => column.id)).toEqual(['map', 'fastest'])
    })

    it('gives each row its desktop cells and its phone stat cells', () => {
        const aztec = mapTableView(eventStatsFixture('overviewAll').maps).rows[0]
        expect(aztec).toMatchObject({
            map: 'CTF-BT-II-AztecCE',
            displayName: 'II-AztecCE',
            played: '20',
            picks: { value: '27', share: 1 },
            firstBans: '5',
            pickerRate: '55%',
            pickerRecord: '11/20',
        })
        expect(aztec.bans.value).toBe('14')
        expect(aztec.bans.share).toBeCloseTo(14 / 24)
        expect(aztec.fastest?.run.time).toBe('02:09.016')
        expect(aztec.fastest?.teamId).toBe(overviewTeam('Sandbagging').id)
        expect(aztec.compact).toEqual([
            { label: 'Played', value: '20' },
            { label: 'Picks', value: '27' },
            { label: 'Bans', value: '14' },
            { label: '1st bans', value: '5' },
            { label: 'Picker wins', value: '55%' },
        ])
    })

    it('adds the deciders column and phone cell only when the event has deciders', () => {
        const maps = eventStatsFixture('overviewAll').maps
        maps[1].deciders = 2
        const view = mapTableView(maps)
        expect(view.hasDeciders).toBe(true)
        expect(view.columns.map(column => column.id)).toContain('deciders')
        expect(view.rows[1].compact.at(-1)).toEqual({ label: 'Deciders', value: '2' })
        expect(view.rows[0].compact.at(-1)).toEqual({ label: 'Deciders', value: '0' })
    })

    it('shows a dash for a map without a picker rate or a fastest run', () => {
        const maps = eventStatsFixture('overviewAll').maps
        maps[0] = { ...maps[0], picker_win_rate: null, fastest_run: null }
        expect(mapTableView(maps).rows[0]).toMatchObject({ pickerRate: '—', fastest: null })
    })

    it('has no rows and an empty note for a stage with no played maps', () => {
        expect(mapTableView(eventStatsFixture('overviewStageEmpty').maps)).toMatchObject({ rows: [], emptyText: 'No maps played in this stage yet.' })
    })
})

describe('mapProfileView', () => {
    it('gives the desktop columns, with the map, best time and rank always shown', () => {
        const view = mapProfileView(teamPage().map_profile)
        expect(view.columns.map(column => column.id)).toEqual(['map', 'picked', 'bannedBy', 'bannedAgainst', 'played', 'wdl', 'caps', 'best', 'rank'])
        expect(view.columns.filter(column => column.required).map(column => column.id)).toEqual(['map', 'best', 'rank'])
    })

    it('gives each row its desktop cells and its phone stat cells', () => {
        const faith = mapProfileView(teamPage().map_profile).rows[0]
        expect(faith).toMatchObject({
            displayName: 'II-FaithCB',
            picked: '2',
            bannedBy: '0',
            bannedAgainst: '1',
            played: '3',
            wdl: '2-0-1',
            caps: '4–2',
        })
        expect(faith.wdlShares.w).toBeCloseTo(2 / 3)
        expect(faith.wdlShares.l).toBeCloseTo(1 / 3)
        expect(faith.bestRun?.time).toBe('01:59.932')
        expect(faith.compact).toEqual([
            { label: 'Picked', value: '2' },
            { label: 'Banned', value: '0' },
            { label: 'Banned vs', value: '1' },
            { label: 'Played', value: '3' },
            { label: 'W-D-L', value: '2-0-1' },
            { label: 'Caps', value: '4–2' },
        ])
    })

    it('shows dashes for a map that was only banned', () => {
        const extant = mapProfileView(teamPage().map_profile).rows.find(row => row.displayName === 'II-Extant')!
        expect(extant).toMatchObject({ played: '0', wdl: null, caps: '—', bestRun: null, rank: null })
        expect(extant.wdlShares).toEqual({ w: 0, d: 0, l: 0 })
        expect(extant.compact.find(cell => cell.label === 'W-D-L')).toEqual({ label: 'W-D-L', value: '—' })
    })
})

describe('teamRunsView', () => {
    it('gives the desktop columns, with the map and time always shown', () => {
        const view = teamRunsView(teamPage())
        expect(view.columns.map(column => column.id)).toEqual(['map', 'time', 'players', 'opponent', 'stage', 'date', 'replay'])
        expect(view.columns.filter(column => column.required).map(column => column.id)).toEqual(['map', 'time'])
    })

    it('gives each run its opponent and stage, and a one-line phone subtitle', () => {
        const view = teamRunsView(teamPage())
        expect(view.rows).toHaveLength(18)
        expect(view.rows[0]).toMatchObject({
            displayName: 'II-FaithCB',
            opponentLabel: 'KNRK',
            stageName: 'Group Stage',
            completedAt: '2026-10-04T19:12:20.085119+00:00',
            compactSubtitle: 'vs KNRK',
        })
        expect(view.rows[0].run.time).toBe('01:59.932')
    })

    it('has an empty note when no run is linked in scope', () => {
        expect(teamRunsView({ ...teamPage(), runs: [] })).toMatchObject({ rows: [], emptyText: 'No linked runs in this stage yet.' })
    })
})

describe('the team page read', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    function serve(response: () => Response) {
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response())))
    }

    const fixture = (name: EventStatsFixtureName) => () => eventStatsFixtureResponse(name)

    it('gives the team page payload for a known team', async () => {
        serve(fixture('team'))
        expect(await readTeamOrNotFound(fetchEventTeamStats('', '2v2-cup-2026', 'team-1'))).toEqual(eventStatsFixture('team'))
    })

    it('turns the unknown-team error into not found', async () => {
        serve(fixture('teamNotFound'))
        expect(await readTeamOrNotFound(fetchEventTeamStats('', '2v2-cup-2026', 'nobody'))).toBeNull()
    })

    it('still fails on any other error', async () => {
        serve(() => new Response(JSON.stringify({ success: false, error: 'Boom' }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
        await expect(readTeamOrNotFound(fetchEventTeamStats('', '2v2-cup-2026', 'team-1'))).rejects.toMatchObject({ status: 500 })
    })
})

describe('teamPageStatus', () => {
    const page = eventStatsFixture('team')

    it('is loading until the first read settles', () => {
        expect(teamPageStatus({ data: undefined, loading: true, error: null })).toBe('loading')
    })

    it('is an error when the read failed', () => {
        expect(teamPageStatus({ data: undefined, loading: false, error: 'Failed' })).toBe('error')
    })

    it('is not found when the read found no such team', () => {
        expect(teamPageStatus({ data: null, loading: false, error: null })).toBe('not-found')
    })

    it('is ready with a payload, and stays ready while it refreshes', () => {
        expect(teamPageStatus({ data: page, loading: false, error: null })).toBe('ready')
        expect(teamPageStatus({ data: page, loading: true, error: null })).toBe('ready')
    })
})
