import { describe, expect, it } from 'vitest'
import {
    capRowDemoCapId,
    isTeamRunRow,
    recordFeedDemoCapId,
    runDemoCapId,
    slowestMemberDemoCapId,
    teamRunCapId,
    type RunDemoMember,
} from './runDemo'

const ARTUREK = 'e385ef45-0f7a-4a3c-9e2a-7f4a1c9d5b31'
const RIDDICK = '40d75495-2b18-4c6e-8a11-6d4e2c7f9a83'

const TEAM_CAP_DETAIL_MEMBERS: RunDemoMember[] = [
    { cap_id: ARTUREK, cap_time_seconds: 54.743, disallowed: false, has_demo: true, user: '265561225428074496' },
    { cap_id: RIDDICK, cap_time_seconds: 54.81, disallowed: false, has_demo: true, user: '596462369698349176' },
]

const WR_TEAM_CAP_ID = 'd5305619-6a01-4f6d-9c2b-1e0d84a6f7c5'
const DSN = '934e9a03-4c72-4d1b-9f88-2a6b5c3d1e40'
const TRIGGER = '46a4177f-8d34-4e29-b7a1-5c9f0e2d3b17'

const WR_TEAM_ROW = {
    cap_id: WR_TEAM_CAP_ID,
    cap_time_seconds: 83.88,
    user_id: null,
    team_size: 2,
    members: [
        { cap_id: DSN, cap_time_seconds: 83.813, verified: true, alias: 'dsn' },
        { cap_id: TRIGGER, cap_time_seconds: 83.88, verified: true, alias: 'TriGGeR' },
    ],
}

const SOLO_CAP_ID = '762aae22-12a2-4be2-9045-db197d676953'

const WR_SOLO_ROW = {
    cap_id: SOLO_CAP_ID,
    cap_time_seconds: 41.2,
    user_id: '228152236587483136',
    members: null,
}

describe('slowest member demo cap id', () => {
    it('picks the member whose time is the team time on a live team cap detail payload', () => {
        expect(slowestMemberDemoCapId(TEAM_CAP_DETAIL_MEMBERS)).toBe(RIDDICK)
    })

    it('picks the slowest member on a live world records team row', () => {
        expect(slowestMemberDemoCapId(WR_TEAM_ROW.members)).toBe(TRIGGER)
    })

    it('never returns the team cap id itself', () => {
        expect(slowestMemberDemoCapId(WR_TEAM_ROW.members)).not.toBe(WR_TEAM_CAP_ID)
        expect(slowestMemberDemoCapId(TEAM_CAP_DETAIL_MEMBERS)).not.toBe(WR_TEAM_CAP_ID)
    })

    it('breaks a tie on the user id string before the cap id', () => {
        const tied: RunDemoMember[] = [
            { cap_id: 'cap-a', cap_time_seconds: 60, user: '900' },
            { cap_id: 'cap-z', cap_time_seconds: 60, user: '100' },
        ]

        expect(slowestMemberDemoCapId(tied)).toBe('cap-z')
    })

    it('falls to the cap id only when the tied members share a user', () => {
        const tied: RunDemoMember[] = [
            { cap_id: 'cap-z', cap_time_seconds: 60, user: '100' },
            { cap_id: 'cap-a', cap_time_seconds: 60, user: '100' },
        ]

        expect(slowestMemberDemoCapId(tied)).toBe('cap-a')
    })

    it('is stable whichever order the roster arrives in', () => {
        const forwards = slowestMemberDemoCapId(TEAM_CAP_DETAIL_MEMBERS)
        const backwards = slowestMemberDemoCapId([...TEAM_CAP_DETAIL_MEMBERS].reverse())

        expect(backwards).toBe(forwards)
    })

    it('leaves the caller roster untouched', () => {
        const roster = [...TEAM_CAP_DETAIL_MEMBERS]
        slowestMemberDemoCapId(roster)

        expect(roster.map(m => m.cap_id)).toEqual([ARTUREK, RIDDICK])
    })

    it('excludes disallowed members even when they are the slowest', () => {
        const roster: RunDemoMember[] = [
            { cap_id: 'cap-clean', cap_time_seconds: 50, user: '1' },
            { cap_id: 'cap-dirty', cap_time_seconds: 99, user: '2', disallowed: true },
        ]

        expect(slowestMemberDemoCapId(roster)).toBe('cap-clean')
    })

    it('excludes members with no usable time', () => {
        const roster: RunDemoMember[] = [
            { cap_id: 'cap-timed', cap_time_seconds: 50, user: '1' },
            { cap_id: 'cap-null', cap_time_seconds: null, user: '2' },
            { cap_id: 'cap-missing', user: '3' },
            { cap_id: 'cap-nan', cap_time_seconds: Number.NaN, user: '4' },
        ]

        expect(slowestMemberDemoCapId(roster)).toBe('cap-timed')
    })

    it('widens to the next slowest member that actually has a demo', () => {
        const roster: RunDemoMember[] = [
            { cap_id: 'cap-slow', cap_time_seconds: 60, user: '1', has_demo: false },
            { cap_id: 'cap-mid', cap_time_seconds: 55, user: '2', has_demo: true },
            { cap_id: 'cap-fast', cap_time_seconds: 50, user: '3', has_demo: true },
        ]

        expect(slowestMemberDemoCapId(roster)).toBe('cap-mid')
    })

    it('prefers a tied member that has a demo over one that does not', () => {
        const roster: RunDemoMember[] = [
            { cap_id: 'cap-a', cap_time_seconds: 60, user: '100', has_demo: false },
            { cap_id: 'cap-b', cap_time_seconds: 60, user: '200', has_demo: true },
        ]

        expect(slowestMemberDemoCapId(roster)).toBe('cap-b')
    })

    it('reports nothing when the roster exposes availability and nobody has a demo', () => {
        const roster: RunDemoMember[] = [
            { cap_id: 'cap-a', cap_time_seconds: 60, user: '1', has_demo: false },
            { cap_id: 'cap-b', cap_time_seconds: 55, user: '2', has_demo: false },
        ]

        expect(slowestMemberDemoCapId(roster)).toBeNull()
    })

    it('returns the slowest member when the payload exposes no availability at all', () => {
        expect(slowestMemberDemoCapId(WR_TEAM_ROW.members)).toBe(TRIGGER)
    })

    it('reports nothing for an empty or absent roster', () => {
        expect(slowestMemberDemoCapId([])).toBeNull()
        expect(slowestMemberDemoCapId(null)).toBeNull()
        expect(slowestMemberDemoCapId(undefined)).toBeNull()
    })
})

describe('run demo cap id', () => {
    it('keeps the server field authoritative over the roster', () => {
        const resolved = runDemoCapId({
            demoCapId: 'server-chosen',
            members: TEAM_CAP_DETAIL_MEMBERS,
            ownCapId: WR_TEAM_CAP_ID,
            teamCapId: WR_TEAM_CAP_ID,
        })

        expect(resolved).toBe('server-chosen')
    })

    it('derives the roster answer only when the server sent none', () => {
        expect(runDemoCapId({ members: TEAM_CAP_DETAIL_MEMBERS })).toBe(RIDDICK)
        expect(runDemoCapId({ demoCapId: null, members: TEAM_CAP_DETAIL_MEMBERS })).toBe(RIDDICK)
    })

    it('falls back to the row cap id for a row that is not a team result', () => {
        expect(runDemoCapId({ ownCapId: SOLO_CAP_ID })).toBe(SOLO_CAP_ID)
        expect(runDemoCapId({ ownCapId: SOLO_CAP_ID, teamCapId: null })).toBe(SOLO_CAP_ID)
    })

    it('refuses to hand back a row id that is the team cap id', () => {
        expect(runDemoCapId({ ownCapId: WR_TEAM_CAP_ID, teamCapId: WR_TEAM_CAP_ID })).toBeNull()
    })

    it('still hands back the row cap id when it differs from the team cap id', () => {
        expect(runDemoCapId({ ownCapId: SOLO_CAP_ID, teamCapId: WR_TEAM_CAP_ID })).toBe(SOLO_CAP_ID)
    })

    it('reports nothing when there is neither a server field, a roster, nor a row id', () => {
        expect(runDemoCapId({})).toBeNull()
        expect(runDemoCapId({ demoCapId: null, members: [], ownCapId: null })).toBeNull()
    })
})

describe('world record feed rows', () => {
    it('ignores roster entries that carry no cap id, as the summary feed sends', () => {
        const summaryTeamRow = {
            id: WR_TEAM_CAP_ID,
            members: [
                { userId: '265561225428074496', alias: 'Arturek ;)', activeTitle: null },
                { userId: '596462369698349176', alias: 'Riddick', activeTitle: null },
            ],
        }

        expect(recordFeedDemoCapId(summaryTeamRow)).toBeNull()
    })

    it('derives the run demo from the roster on a team row the api has not upgraded', () => {
        expect(recordFeedDemoCapId({ id: WR_TEAM_ROW.cap_id, members: WR_TEAM_ROW.members })).toBe(TRIGGER)
    })

    it('never hands the team cap id to the replay layer while the roster identifies the row as a team', () => {
        const resolved = recordFeedDemoCapId({ id: WR_TEAM_ROW.cap_id, members: WR_TEAM_ROW.members })

        expect(resolved).not.toBe(WR_TEAM_CAP_ID)
        expect(WR_TEAM_ROW.members.map(m => m.cap_id)).toContain(resolved)
    })

    it('treats a row with an empty roster the same way the links do, as solo', () => {
        expect(isTeamRunRow({ cap_id: SOLO_CAP_ID, members: [] })).toBe(false)
        expect(recordFeedDemoCapId({ id: SOLO_CAP_ID, members: [] })).toBe(SOLO_CAP_ID)
    })

    it('uses a solo row own cap id, as the api does once it sends the field', () => {
        expect(recordFeedDemoCapId({ id: SOLO_CAP_ID, members: null })).toBe(SOLO_CAP_ID)
    })

    it('prefers the server field on both kinds of row', () => {
        expect(recordFeedDemoCapId({ id: WR_TEAM_CAP_ID, demoCapId: TRIGGER, members: WR_TEAM_ROW.members })).toBe(TRIGGER)
        expect(recordFeedDemoCapId({ id: SOLO_CAP_ID, demoCapId: 'server-chosen', members: null })).toBe('server-chosen')
    })
})

describe('cap rows carrying their own team cap id', () => {
    it('uses the row own cap id when the row is not a team result', () => {
        expect(capRowDemoCapId({ id: SOLO_CAP_ID, isTeam: false })).toBe(SOLO_CAP_ID)
        expect(capRowDemoCapId({ id: SOLO_CAP_ID })).toBe(SOLO_CAP_ID)
    })

    it('uses the member cap id of a team row rather than its team cap id', () => {
        expect(capRowDemoCapId({ id: DSN, isTeam: true, teamCapId: WR_TEAM_CAP_ID })).toBe(DSN)
    })

    it('refuses a team row whose own id is the team cap id', () => {
        expect(capRowDemoCapId({ id: WR_TEAM_CAP_ID, isTeam: true, teamCapId: WR_TEAM_CAP_ID })).toBeNull()
    })

    it('keeps the server field authoritative', () => {
        expect(capRowDemoCapId({ id: SOLO_CAP_ID, demoCapId: 'server-chosen' })).toBe('server-chosen')
    })
})

describe('team row identification', () => {
    it('reads the explicit team cap id when the api sends one', () => {
        expect(isTeamRunRow({ cap_id: SOLO_CAP_ID, team_cap_id: WR_TEAM_CAP_ID })).toBe(true)
        expect(teamRunCapId({ cap_id: SOLO_CAP_ID, team_cap_id: WR_TEAM_CAP_ID })).toBe(WR_TEAM_CAP_ID)
    })

    it('recognises a team row on an api that sends no team cap id', () => {
        expect(isTeamRunRow(WR_TEAM_ROW)).toBe(true)
        expect(teamRunCapId(WR_TEAM_ROW)).toBe(WR_TEAM_CAP_ID)
    })

    it('leaves a solo row alone', () => {
        expect(isTeamRunRow(WR_SOLO_ROW)).toBe(false)
        expect(teamRunCapId(WR_SOLO_ROW)).toBeNull()
    })

    it('treats an empty roster with no team cap id as solo', () => {
        expect(isTeamRunRow({ cap_id: SOLO_CAP_ID, members: [] })).toBe(false)
        expect(teamRunCapId({ cap_id: SOLO_CAP_ID, members: [] })).toBeNull()
    })

    it('treats a row with neither signal as solo', () => {
        expect(isTeamRunRow({ cap_id: SOLO_CAP_ID })).toBe(false)
        expect(teamRunCapId({ cap_id: SOLO_CAP_ID })).toBeNull()
    })

    it('keeps the server team cap id when both signals are present', () => {
        expect(teamRunCapId({ ...WR_TEAM_ROW, team_cap_id: 'server-team-cap' })).toBe('server-team-cap')
    })
})

describe('the ids a team result can hand to the demo converter', () => {
    it('resolves a team result to a member cap id on both api shapes', () => {
        const beforeDeploy = recordFeedDemoCapId({ id: WR_TEAM_ROW.cap_id, members: WR_TEAM_ROW.members })
        const afterDeploy = recordFeedDemoCapId({
            id: WR_TEAM_ROW.cap_id,
            demoCapId: TRIGGER,
            members: WR_TEAM_ROW.members,
        })
        const memberIds = WR_TEAM_ROW.members.map(m => m.cap_id)

        expect(memberIds).toContain(beforeDeploy)
        expect(memberIds).toContain(afterDeploy)
        expect(beforeDeploy).not.toBe(WR_TEAM_ROW.cap_id)
        expect(afterDeploy).not.toBe(WR_TEAM_ROW.cap_id)
    })

    it('resolves a team cap detail to a member cap id whether or not the server sent one', () => {
        const beforeDeploy = runDemoCapId({ members: TEAM_CAP_DETAIL_MEMBERS })
        const afterDeploy = runDemoCapId({ demoCapId: RIDDICK, members: TEAM_CAP_DETAIL_MEMBERS })
        const memberIds = TEAM_CAP_DETAIL_MEMBERS.map(m => m.cap_id)

        expect(memberIds).toContain(beforeDeploy)
        expect(memberIds).toContain(afterDeploy)
        expect(beforeDeploy).not.toBe(WR_TEAM_CAP_ID)
    })
})
