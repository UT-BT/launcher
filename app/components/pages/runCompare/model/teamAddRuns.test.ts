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
        expect(view.rows[0]).toMatchObject({ reference: true, inComparison: true, time: '01:07.116' })
    })

    it('numbers each team run by its place on the map, the pinned reference included', () => {
        expect(viewOf(`runs=${A}`).rows.map(row => [row.teamCapId, row.rank])).toEqual([
            [A, 2],
            [FASTER.teamCapId, 1],
            [SLOWER.teamCapId, 3],
            [SLOWEST.teamCapId, 4],
        ])
    })

    it('notes only what each member lacks, and keeps each member’s side', () => {
        const [s1, s2] = SLOWER.members.map(member => member.capId)
        const view = viewOf(`runs=${A}`, { videos: new Map([[s1, VIDEO], [s2, null]]) })
        const slower = view.rows.find(row => row.teamCapId === SLOWER.teamCapId)!
        expect(slower.members.map(member => [member.video, member.side, member.badges])).toEqual([
            ['video', 1, ['Checkpoints only']],
            ['none', 1, ['Graph only', 'Final time only']],
        ])
        const industry = view.rows.find(row => row.teamCapId === A)!
        expect(industry.members.map(member => [member.side, member.badges])).toEqual([[0, []], [0, ['Checkpoints only']], [0, []]])
    })

    it('says the board mixes sides only when members were set on both', () => {
        expect(viewOf(`runs=${A}`).mixed).toBe(true)
        const red = [INDUSTRY, FASTER, SLOWEST].map(team => entryOf(team))
        expect(viewOf(`runs=${A}`, { entries: red }).mixed).toBe(false)
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

    it('searches member aliases and filters by video and side', () => {
        expect(viewOf(`runs=${A}`, { filters: { ...NO_FILTERS, search: 'krad' } }).rows.map(row => row.teamCapId)).toEqual([A])
        expect(viewOf(`runs=${A}`, { filters: { ...NO_FILTERS, colour: 'blue' } }).rows.map(row => row.teamCapId)).toEqual([SLOWER.teamCapId])
        const withVideo = viewOf(`runs=${A}`, { videos: new Map([[FASTER.members[1].capId, VIDEO]]), filters: { ...NO_FILTERS, video: 'video' } })
        expect(withVideo.rows.map(row => row.teamCapId)).toEqual([FASTER.teamCapId])
        const recorded = viewOf(`runs=${A}`, { videos: new Map([[FASTER.members[1].capId, VIDEO]]), filters: { ...NO_FILTERS, video: 'utrecorder' } })
        expect(recorded.rows.map(row => row.teamCapId)).toEqual([FASTER.teamCapId])
        expect(viewOf(`runs=${A}`, { picked: [SLOWER.teamCapId] }).rows.filter(row => row.inComparison).map(row => row.teamCapId)).toEqual([SLOWER.teamCapId])
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

    it('says when the added POVs join as a graph only past eight videos', () => {
        const three = composeTeams(`runs=${A},${SLOWER.teamCapId},${SLOWEST.teamCapId}`, TEAMS)
        expect(three.race.tiles).toHaveLength(7)
        const videos = new Map(FASTER.members.map(member => [member.capId, VIDEO]))
        expect(addTeamRunsEdit(three, [FASTER.teamCapId], ENTRIES, videos).note).toBe('Joined as a graph only: 8 videos already play.')
    })
})
