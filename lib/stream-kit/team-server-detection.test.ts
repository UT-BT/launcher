import { describe, expect, it } from 'vitest'
import type { Server } from '@/app/utils/server-utils'
import { detectTeamServers } from './team-server-detection'

const ALICE = '100000000000000001'
const BOB = '100000000000000002'
const CARL = '100000000000000003'
const DANA = '200000000000000001'
const ERIK = '200000000000000002'
const FAYE = '200000000000000003'
const STRANGER = '900000000000000009'

interface TestPlayer {
    id: string
    name: string
    is_spectator: boolean
}

interface TestServer {
    id: string
    ip: string
    hostport: number
    players: TestPlayer[]
}

function player(id: string, name = `player-${id}`, isSpectator = false): TestPlayer {
    return { id, name, is_spectator: isSpectator }
}

function server(id: string, players: TestPlayer[]): TestServer {
    return { id, ip: `203.0.113.${id.length}`, hostport: 7777, players }
}

describe('detectTeamServers', () => {
    it('counts roster members per server and picks the server holding most of the team', () => {
        const eu = server('eu', [player(ALICE), player(STRANGER), player(BOB)])
        const us = server('us', [player(CARL), player(DANA)])
        const servers = [us, eu]

        const detection = detectTeamServers(servers, { A: [ALICE, BOB, CARL], B: [DANA, ERIK] })

        expect(detection.A.servers).toEqual([
            { server: eu, count: 2 },
            { server: us, count: 1 },
        ])
        expect(detection.A.best).toBe(eu)
        expect(detection.A.members).toEqual([
            { discordId: ALICE, servers: [eu] },
            { discordId: BOB, servers: [eu] },
            { discordId: CARL, servers: [us] },
        ])
        expect(detection.B.servers).toEqual([{ server: us, count: 1 }])
        expect(detection.B.best).toBe(us)
        expect(detection.B.members).toEqual([{ discordId: DANA, servers: [us] }])
    })

    it('finds nothing when no roster member is on any server', () => {
        const servers = [server('eu', [player(STRANGER)]), server('us', [])]

        const detection = detectTeamServers(servers, { A: [ALICE, BOB], B: [DANA, ERIK] })

        expect(detection).toEqual({
            A: { servers: [], best: null, members: [] },
            B: { servers: [], best: null, members: [] },
        })
    })

    it('finds nothing in an empty server list', () => {
        expect(detectTeamServers([], { A: [ALICE], B: [DANA] })).toEqual({
            A: { servers: [], best: null, members: [] },
            B: { servers: [], best: null, members: [] },
        })
    })

    it('never matches unlinked players, whose ids are short or empty, even against roster members without a Discord id', () => {
        const eu = server('eu', [player(''), player('7'), player('12345'), player(ALICE)])

        const detection = detectTeamServers([eu], { A: ['', '7', null, undefined, '12345', ALICE], B: ['', '7'] })

        expect(detection.A.members).toEqual([{ discordId: ALICE, servers: [eu] }])
        expect(detection.A.servers).toEqual([{ server: eu, count: 1 }])
        expect(detection.B).toEqual({ servers: [], best: null, members: [] })
    })

    it('ignores roster members who are only spectating', () => {
        const eu = server('eu', [player(ALICE), player(BOB)])
        const us = server('us', [player(CARL, 'carl', true)])

        const detection = detectTeamServers([us, eu], { A: [ALICE, BOB, CARL], B: [] })

        expect(detection.A.servers).toEqual([{ server: eu, count: 2 }])
        expect(detection.A.members.map(member => member.discordId)).toEqual([ALICE, BOB])
    })

    it('finds both teams on one server', () => {
        const eu = server('eu', [player(DANA), player(ALICE), player(ERIK), player(BOB)])
        const us = server('us', [player(STRANGER)])

        const detection = detectTeamServers([us, eu], { A: [ALICE, BOB, CARL], B: [DANA, ERIK, FAYE] })

        expect(detection.A).toEqual({
            servers: [{ server: eu, count: 2 }],
            best: eu,
            members: [{ discordId: ALICE, servers: [eu] }, { discordId: BOB, servers: [eu] }],
        })
        expect(detection.B).toEqual({
            servers: [{ server: eu, count: 2 }],
            best: eu,
            members: [{ discordId: DANA, servers: [eu] }, { discordId: ERIK, servers: [eu] }],
        })
    })

    it('breaks a tie in favour of the server listed first', () => {
        const eu = server('eu', [player(BOB)])
        const us = server('us', [player(ALICE)])

        const detection = detectTeamServers([us, eu], { A: [BOB, ALICE], B: [] })

        expect(detection.A.best).toBe(us)
        expect(detection.A.servers).toEqual([{ server: us, count: 1 }, { server: eu, count: 1 }])
        expect(detection.A.members).toEqual([{ discordId: BOB, servers: [eu] }, { discordId: ALICE, servers: [us] }])
    })

    it('reads the launcher\'s server list as it is loaded', () => {
        const listed: Server = {
            id: 'srv-1',
            ip: '203.0.113.10',
            hostname: '[UTBT.NET] - BunnyTrack Certified Server #1 (Germany)',
            hostport: 7777,
            map_name: 'CTF-BT-Example',
            player_count: 2,
            max_players: 16,
            spectators: 0,
            time_limit_minutes: 30,
            remaining_time_seconds: 900,
            goal_team_score: 0,
            red_team_score: 0,
            blue_team_score: 0,
            certified_records: true,
            players: [
                { id: ALICE, name: 'alice', ping: 40, time: 60, team: 0, deaths: 0, is_spectator: false },
                { id: '3', name: 'guest', ping: 80, time: 30, team: 1, deaths: 1, is_spectator: false },
            ],
        }

        const detection = detectTeamServers([listed], { A: [ALICE], B: [DANA] })

        expect(detection.A.best).toBe(listed)
        expect(detection.A.members).toEqual([{ discordId: ALICE, servers: [listed] }])
        expect(detection.B.best).toBeNull()
    })

    it('counts a member once per server and lists every server they show up on', () => {
        const eu = server('eu', [player(ALICE), player(ALICE)])
        const us = server('us', [player(ALICE), player(BOB)])

        const detection = detectTeamServers([eu, us], { A: [ALICE, BOB, ALICE], B: [] })

        expect(detection.A.servers).toEqual([{ server: us, count: 2 }, { server: eu, count: 1 }])
        expect(detection.A.members).toEqual([
            { discordId: ALICE, servers: [eu, us] },
            { discordId: BOB, servers: [us] },
        ])
    })
})
