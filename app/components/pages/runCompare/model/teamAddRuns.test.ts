import { describe, expect, it } from 'vitest'
import type { TeamLeaderboardEntry } from '@/app/utils/api'
import type { TeamRun } from '../loading/teamRuns'
import { NO_FILTERS } from './addRuns'
import { TEAM_LIMIT_REACHED } from './setEdits'
import { addTeamRunsEdit, listedTeamEntries, teamAddRunsModel, toggleTeamRunEdit } from './teamAddRuns'
import { composeTeams, INDUSTRY, testMember, testTeam, VIDEO } from './teamTestRuns'

function entryOf(team: TeamRun, overrides: Partial<TeamLeaderboardEntry> = {}): TeamLeaderboardEntry {
    return {
        id: team.teamCapId,
        map: team.map,
        added: '2026-09-13T05:28:47+00:00',
        cap_time_seconds: team.timeSeconds,
        verified: true,
        complete: true,
        disallowed: false,
        state: 'verified',
        team_size: team.members.length,
        user: team.members[0].user,
        medal: 0,
        members: team.members.map(member => ({
            user: member.user,
            alias: member.alias ?? '',
            cap_id: member.capId,
            cap_time_seconds: member.timeSeconds,
            verified: true,
            disallowed: false,
            active_title: null,
            team: member.side,
            has_ghost: member.hasGhost,
            has_zones: member.checkpoints.length > 0,
        })),
        ...overrides,
    }
}

const FASTER = testTeam(1, 60)
const SLOWER = testTeam(2, 75, { members: [testMember(2, 1, 74, { side: 1, hasGhost: false }), testMember(2, 2, 75, { side: 1, hasGhost: false, checkpoints: [] })] })
const SLOWEST = testTeam(3, 80)
const BANNED = testTeam(4, 50)
const TEAMS = [INDUSTRY, FASTER, SLOWER, SLOWEST, BANNED]
const ENTRIES = [
    entryOf(SLOWEST),
    entryOf(INDUSTRY),
    entryOf(SLOWER),
    entryOf(FASTER),
    entryOf(BANNED, { disallowed: true }),
]
const A = INDUSTRY.teamCapId

function viewOf(query: string, overrides: Partial<Parameters<typeof teamAddRunsModel>[0]> = {}) {
    return teamAddRunsModel({ entries: ENTRIES, model: composeTeams(query, TEAMS), videos: new Map(), userId: null, filters: NO_FILTERS, ...overrides })
}

describe('the team leaderboard in the drawer', () => {
    it('lists team runs by time without disallowed ones, the reference pinned first', () => {
        expect(listedTeamEntries(ENTRIES).map(entry => entry.id)).toEqual([FASTER, INDUSTRY, SLOWER, SLOWEST].map(team => team.teamCapId))
        const view = viewOf(`runs=${A}`)
        expect(view.rows.map(row => row.teamCapId)).toEqual([A, FASTER.teamCapId, SLOWER.teamCapId, SLOWEST.teamCapId])
        expect(view.rows[0]).toMatchObject({ reference: true, inComparison: true, time: '1:07.116' })
    })

    it('badges every member with its video, its replay or zones and its side', () => {
        const [s1, s2] = SLOWER.members.map(member => member.capId)
        const view = viewOf(`runs=${A}`, { videos: new Map([[s1, VIDEO], [s2, null]]) })
        const slower = view.rows.find(row => row.teamCapId === SLOWER.teamCapId)!
        expect(slower.members.map(member => member.badges)).toEqual([['Video', 'Zones', 'Set on Blue'], ['No video', 'Set on Blue']])
        const industry = view.rows.find(row => row.teamCapId === A)!
        expect(industry.members.map(member => member.badges)).toEqual([['Replay', 'Set on Red'], ['Zones', 'Set on Red'], ['Replay', 'Set on Red']])
    })

    it('offers the quick-add chips for team runs around the reference', () => {
        const chips = new Map(viewOf(`runs=${A}`, { userId: SLOWEST.members[0].user }).chips.map(chip => [chip.id, chip]))
        expect(chips.get('wr')).toMatchObject({ capIds: [FASTER.teamCapId], disabled: false })
        expect(chips.get('pb')?.capIds).toEqual([SLOWEST.teamCapId])
        expect(chips.get('faster')?.capIds).toEqual([FASTER.teamCapId])
        expect(chips.get('slower')?.capIds).toEqual([SLOWER.teamCapId])
        expect(chips.get('top3')?.capIds).toEqual([FASTER.teamCapId, A, SLOWER.teamCapId])
        expect(viewOf(`runs=${A}`).chips.some(chip => chip.id === 'pb')).toBe(false)
    })

    it('searches member aliases and filters by replay, video and side', () => {
        expect(viewOf(`runs=${A}`, { filters: { ...NO_FILTERS, search: 'krad' } }).rows.map(row => row.teamCapId)).toEqual([A])
        expect(viewOf(`runs=${A}`, { filters: { ...NO_FILTERS, hasReplay: true } }).rows.map(row => row.teamCapId)).not.toContain(SLOWER.teamCapId)
        expect(viewOf(`runs=${A}`, { filters: { ...NO_FILTERS, colour: 'blue' } }).rows.map(row => row.teamCapId)).toEqual([SLOWER.teamCapId])
        const withVideo = viewOf(`runs=${A}`, { videos: new Map([[FASTER.members[1].capId, VIDEO]]), filters: { ...NO_FILTERS, hasVideo: true } })
        expect(withVideo.rows.map(row => row.teamCapId)).toEqual([FASTER.teamCapId])
    })
})

describe('adding team runs from the drawer', () => {
    it('adds a team run and removes it again', () => {
        const model = composeTeams(`runs=${A}`, TEAMS)
        expect(toggleTeamRunEdit(model, FASTER.teamCapId, ENTRIES, new Map()).outcome.query).toBe(`runs=${A},${FASTER.teamCapId}`)
        const two = composeTeams(`runs=${A},${FASTER.teamCapId}`, TEAMS)
        expect(toggleTeamRunEdit(two, FASTER.teamCapId, ENTRIES, new Map()).outcome.query).toBe(`runs=${A}`)
    })

    it('blocks a fifth team run with the explanation, and Top 3 adds all of its runs or none', () => {
        const four = composeTeams(`runs=${[INDUSTRY, FASTER, SLOWER, SLOWEST].map(team => team.teamCapId).join(',')}`, TEAMS)
        const extra = testTeam(5, 90)
        expect(addTeamRunsEdit(four, [extra.teamCapId], ENTRIES, new Map()).outcome).toEqual({ query: null, blocked: TEAM_LIMIT_REACHED })

        const three = composeTeams(`runs=${A},${SLOWER.teamCapId},${SLOWEST.teamCapId}`, TEAMS)
        expect(addTeamRunsEdit(three, [FASTER.teamCapId, A, extra.teamCapId], ENTRIES, new Map()).outcome.blocked).toBe(TEAM_LIMIT_REACHED)
    })

    it('says when the added POVs join as data-only past eight videos', () => {
        const three = composeTeams(`runs=${A},${SLOWER.teamCapId},${SLOWEST.teamCapId}`, TEAMS)
        expect(three.race.tiles).toHaveLength(7)
        const videos = new Map(FASTER.members.map(member => [member.capId, VIDEO]))
        expect(addTeamRunsEdit(three, [FASTER.teamCapId], ENTRIES, videos).note).toBe('Joined as data-only: 8 videos already play.')
    })
})
