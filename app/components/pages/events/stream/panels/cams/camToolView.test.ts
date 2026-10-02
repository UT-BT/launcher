import { describe, expect, it } from 'vitest'
import type { CamToolStatus } from '@/lib/conveyor/schemas/stream-kit-schema'
import type { Server } from '@/app/utils/server-utils'
import type { StreamDesk, StreamMatch, StreamMember, StreamPerson } from '../../streamDesk'
import {
    DETECTED_CHOICES,
    NO_PASSWORDS,
    buildCamToolView,
    camErrorMessage,
    normaliseTypedAddress,
    serverAddressOf,
    type CamServerChoices,
    type CamToolViewInput,
} from './camToolView'

const ALICE = '111111111111111111'
const ANNA = '111111111111111112'
const AXEL = '111111111111111113'
const BOB = '222222222222222221'
const BEA = '222222222222222222'
const INSTALL = 'C:\\UnrealTournament'

function person(id: string, name: string): StreamPerson {
    return { id, display_name: name, avatar: '' }
}

function member(id: string, name: string, captain = false): StreamMember {
    return { ...person(id, name), title: null, captain }
}

function server(id: string, ip: string, hostport: number, playerIds: string[], extra: Partial<Server> = {}): Server {
    return {
        id,
        ip,
        hostname: `Server ${id}`,
        hostport,
        map_name: 'CTF-BT-Example',
        player_count: playerIds.length,
        max_players: 16,
        spectators: 0,
        time_limit_minutes: 0,
        remaining_time_seconds: 0,
        goal_team_score: 0,
        red_team_score: 0,
        blue_team_score: 0,
        certified_records: true,
        players: playerIds.map(playerId => ({ id: playerId, name: playerId, ping: 0, time: 0, team: 0, deaths: 0, is_spectator: false })),
        ...extra,
    }
}

type Lineup = StreamMatch['lineup']

function match(lineup: Partial<Lineup> = {}): StreamMatch {
    return {
        id: 'm1',
        reason: 'current',
        stage: { key: 'groups', name: 'Groups' },
        group: null,
        round: { no: 1, label: null },
        best_of: 3,
        mode: 'ctf',
        caps_to_win: 2,
        scheduled_at: null,
        countdown_at: null,
        live_at: null,
        live_since: null,
        live_source: null,
        status: 'scheduled',
        stream_url: null,
        pick_ban_status: 'complete',
        sides: { a: 'a', b: 'b' },
        teams: {
            a: { id: 'ta', name: 'Crimson Tide', match_side: 'a', stage_seed: 1, pre_cup_seed: 1, members: [member(ALICE, 'Alice', true), member(ANNA, 'Anna'), member(AXEL, 'Axel')] },
            b: { id: 'tb', name: 'Azure Wave', match_side: 'b', stage_seed: 2, pre_cup_seed: 2, members: [member(BOB, 'Bob', true), member(BEA, 'Bea')] },
        },
        lineup: {
            a1: person(ALICE, 'Alice'),
            a2: person(ANNA, 'Anna'),
            b1: person(BOB, 'Bob'),
            b2: person(BEA, 'Bea'),
            ...lineup,
        },
        maps: [],
        score: { maps: [], current_map: null, series: { a: 0, b: 0 }, winner: null, live_decided: false, live_counting: true },
        casters: [],
    }
}

function desk(current: StreamMatch | null = match()): StreamDesk {
    return {
        server_now: '2030-10-12T19:00:00+00:00',
        event: { name: 'Cup', slug: 'cup' },
        streamer: { id: '555555555555555555', display_name: 'Streamer', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: null },
        reason: 'current',
        match: current,
        assigned_matches: [],
        next_match: null,
    }
}

const ONE_SERVER = [
    server('s1', '10.0.0.1', 7777, [ALICE, ANNA, BOB, BEA]),
    server('s2', '10.0.0.2', 7777, []),
]

const TWO_SERVERS = [
    server('s1', '10.0.0.1', 7777, [ALICE, ANNA]),
    server('s2', '10.0.0.2', 7788, [BOB, BEA]),
]

function input(overrides: Partial<CamToolViewInput> = {}): CamToolViewInput {
    return {
        desk: desk(),
        servers: ONE_SERVER,
        choices: DETECTED_CHOICES,
        passwords: NO_PASSWORDS,
        installPath: INSTALL,
        status: null,
        fps: 120,
        volume: 50,
        ...overrides,
    }
}

function runningStatus(targets: Partial<Record<'A1' | 'A2' | 'B1' | 'B2', string | null>>, overrides: Partial<CamToolStatus['cams'][number]> = {}): CamToolStatus {
    return {
        supported: true,
        retitle: { available: true, error: null },
        cams: (['A1', 'A2', 'B1', 'B2'] as const).map(slot => ({
            slot,
            windowTitle: `UTBT Cam ${slot}`,
            running: slot in targets,
            pid: slot in targets ? 100 : null,
            titled: slot in targets,
            server: slot in targets ? '10.0.0.1:7777' : null,
            target: targets[slot] ?? null,
            plannedServer: slot in targets ? '10.0.0.1:7777' : null,
            startedAt: null,
            exitCode: null,
            error: null,
            ...overrides,
        })),
    }
}

const FULL_TARGETS = { A1: ALICE, A2: ANNA, B1: BOB, B2: BEA }

describe('server addresses', () => {
    it('joins a listed server by ip and game port', () => {
        expect(serverAddressOf(server('s', '10.1.2.3', 7790, []))).toBe('10.1.2.3:7790')
    })

    it('normalises a typed address', () => {
        expect(normaliseTypedAddress('  10.0.0.9:7777 ')).toBe('10.0.0.9:7777')
        expect(normaliseTypedAddress('unreal://bt.example.net:7778/')).toBe('bt.example.net:7778')
        expect(normaliseTypedAddress('unreal://10.0.0.9:7790/CTF-BT-Example')).toBe('10.0.0.9:7790')
        expect(normaliseTypedAddress('bt.example.net')).toBe('bt.example.net:7777')
    })

    it('rejects an address it cannot join', () => {
        expect(normaliseTypedAddress('')).toBeNull()
        expect(normaliseTypedAddress('10.0.0:7777')).toBeNull()
        expect(normaliseTypedAddress('10.0.0.1:99999')).toBeNull()
        expect(normaliseTypedAddress('host?x=1')).toBeNull()
    })
})

describe('detection versus override', () => {
    it('uses the detected server for each team by default', () => {
        const view = buildCamToolView(input({ servers: TWO_SERVERS }))
        expect(view.teams.A).toMatchObject({ source: 'detected', address: '10.0.0.1:7777', serverName: 'Server s1', problem: null })
        expect(view.teams.A.detected).toMatchObject({ address: '10.0.0.1:7777', found: 2, rosterSize: 3 })
        expect(view.teams.B).toMatchObject({ source: 'detected', address: '10.0.0.2:7788', serverName: 'Server s2' })
    })

    it('detects from the whole roster, not only the lineup', () => {
        const servers = [server('s1', '10.0.0.1', 7777, [AXEL]), server('s2', '10.0.0.2', 7777, [BOB])]
        const view = buildCamToolView(input({ servers }))
        expect(view.teams.A.address).toBe('10.0.0.1:7777')
    })

    it('a server picked from the list wins over detection', () => {
        const choices: CamServerChoices = { A: { mode: 'list', address: '10.0.0.2:7777' }, B: { mode: 'detected' } }
        const view = buildCamToolView(input({ choices }))
        expect(view.teams.A).toMatchObject({ source: 'list', address: '10.0.0.2:7777', serverName: 'Server s2' })
        expect(view.teams.A.detected?.address).toBe('10.0.0.1:7777')
        expect(view.teams.B).toMatchObject({ source: 'detected', address: '10.0.0.1:7777' })
    })

    it('a picked server that left the list is still used', () => {
        const choices: CamServerChoices = { A: { mode: 'list', address: '10.9.9.9:7777' }, B: { mode: 'detected' } }
        const view = buildCamToolView(input({ choices }))
        expect(view.teams.A).toMatchObject({ source: 'list', address: '10.9.9.9:7777', serverName: null, problem: null })
    })

    it('a typed address wins over detection', () => {
        const choices: CamServerChoices = { A: { mode: 'detected' }, B: { mode: 'typed', address: 'unreal://bt.example.net:7790' } }
        const view = buildCamToolView(input({ choices }))
        expect(view.teams.B).toMatchObject({ source: 'typed', address: 'bt.example.net:7790', problem: null })
    })

    it('a typed address that cannot be joined blocks that team', () => {
        const choices: CamServerChoices = { A: { mode: 'detected' }, B: { mode: 'typed', address: 'not an address' } }
        const view = buildCamToolView(input({ choices }))
        expect(view.teams.B).toMatchObject({ source: 'typed', address: null, problem: 'invalid-address' })
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers.map(blocker => blocker.code)).toEqual(['server'])
    })

    it('a team nobody is playing for asks for a server', () => {
        const servers = [server('s1', '10.0.0.1', 7777, [ALICE])]
        const view = buildCamToolView(input({ servers }))
        expect(view.teams.B).toMatchObject({ source: null, address: null, problem: 'not-detected', detected: null })
        expect(view.launch.blockers).toEqual([expect.objectContaining({ code: 'server', message: expect.stringContaining('Azure Wave') })])
    })

    it('ignores roster members who are only spectating', () => {
        const spectating = server('s1', '10.0.0.1', 7777, [])
        spectating.players = [{ id: BOB, name: 'Bob', ping: 0, time: 0, team: 0, deaths: 0, is_spectator: true }]
        const view = buildCamToolView(input({ servers: [server('s0', '10.0.0.5', 7777, [ALICE]), spectating] }))
        expect(view.teams.B.problem).toBe('not-detected')
    })

    it('waits for the server list before detecting', () => {
        const view = buildCamToolView(input({ servers: null }))
        expect(view.teams.A).toMatchObject({ address: null, problem: 'loading' })
        expect(view.launch.request).toBeNull()
    })
})

describe('uncertified servers', () => {
    const uncertified = (id: string, ip: string, port: number, ids: string[]) => server(id, ip, port, ids, { certified_records: false })

    it('flags a detected server whose caps will not count', () => {
        const view = buildCamToolView(input({ servers: [uncertified('s1', '10.0.0.1', 7777, [ALICE, ANNA, BOB, BEA])] }))

        expect(view.teams.A.uncertified).toBe(true)
        expect(view.teams.B.uncertified).toBe(true)
    })

    it('does not flag a certified server', () => {
        const view = buildCamToolView(input())

        expect(view.teams.A.uncertified).toBe(false)
        expect(view.teams.B.uncertified).toBe(false)
    })

    it('flags only the team on the uncertified server', () => {
        const view = buildCamToolView(input({ servers: [server('s1', '10.0.0.1', 7777, [ALICE, ANNA]), uncertified('s2', '10.0.0.2', 7788, [BOB, BEA])] }))

        expect(view.teams.A.uncertified).toBe(false)
        expect(view.teams.B.uncertified).toBe(true)
    })

    it('follows a server picked from the list', () => {
        const servers = [server('s1', '10.0.0.1', 7777, [ALICE, ANNA, BOB, BEA]), uncertified('s2', '10.0.0.2', 7788, [])]
        const view = buildCamToolView(input({ servers, choices: { ...DETECTED_CHOICES, B: { mode: 'list', address: '10.0.0.2:7788' } } }))

        expect(view.teams.A.uncertified).toBe(false)
        expect(view.teams.B.uncertified).toBe(true)
    })

    it('follows a typed address that names a listed server', () => {
        const servers = [server('s1', '10.0.0.1', 7777, [ALICE, ANNA, BOB, BEA]), uncertified('s2', '10.0.0.2', 7788, [])]
        const view = buildCamToolView(input({ servers, choices: { ...DETECTED_CHOICES, A: { mode: 'typed', address: '10.0.0.2:7788' } } }))

        expect(view.teams.A.uncertified).toBe(true)
        expect(view.teams.B.uncertified).toBe(false)
    })

    it('does not flag an address that is not on the server list', () => {
        const view = buildCamToolView(input({ choices: { ...DETECTED_CHOICES, A: { mode: 'typed', address: 'bt.example.net:7790' } } }))

        expect(view.teams.A.uncertified).toBe(false)
    })

    it('does not flag anything while the server list loads', () => {
        const view = buildCamToolView(input({ servers: null }))

        expect(view.teams.A.uncertified).toBe(false)
    })
})

describe('one server and two servers', () => {
    it('sends all four cams to one server when both teams share it', () => {
        const view = buildCamToolView(input({ servers: ONE_SERVER }))
        expect(view.layout).toBe('one-server')
        expect(view.launch.request).toEqual({
            lineup: { A1: ALICE, A2: ANNA, B1: BOB, B2: BEA },
            servers: { A: '10.0.0.1:7777', B: '10.0.0.1:7777' },
            passwords: { A: null, B: null },
            fps: 120,
            volume: 50,
        })
    })

    it('sends each team to its own server', () => {
        const view = buildCamToolView(input({ servers: TWO_SERVERS }))
        expect(view.layout).toBe('two-servers')
        expect(view.launch.request?.servers).toEqual({ A: '10.0.0.1:7777', B: '10.0.0.2:7788' })
    })

    it('counts a typed address naming a listed server as the same server', () => {
        const choices: CamServerChoices = { A: { mode: 'detected' }, B: { mode: 'typed', address: '10.0.0.1' } }
        const view = buildCamToolView(input({ servers: TWO_SERVERS, choices }))
        expect(view.layout).toBe('one-server')
    })

    it('has no layout until both teams have a server', () => {
        const view = buildCamToolView(input({ servers: [server('s1', '10.0.0.1', 7777, [ALICE])] }))
        expect(view.layout).toBeNull()
    })
})

describe('server passwords', () => {
    it('sends no password until one is typed', () => {
        const view = buildCamToolView(input())
        expect(view.launch.request?.passwords).toEqual({ A: null, B: null })
        expect(view.passwords.A).toMatchObject({ value: '', effective: '', sharedFrom: null, invalid: false })
    })

    it('shares one typed password with the other team when both play on one server', () => {
        const view = buildCamToolView(input({ servers: ONE_SERVER, passwords: { A: ' cup2026 ', B: '' } }))
        expect(view.launch.request?.passwords).toEqual({ A: 'cup2026', B: 'cup2026' })
        expect(view.passwords.A.sharedFrom).toBeNull()
        expect(view.passwords.B.sharedFrom).toBe('A')
    })

    it('keeps each team to its own password on two servers', () => {
        const view = buildCamToolView(input({ servers: TWO_SERVERS, passwords: { A: 'cup2026', B: '' } }))
        expect(view.launch.request?.passwords).toEqual({ A: 'cup2026', B: null })
        expect(view.passwords.B.sharedFrom).toBeNull()
    })

    it('prefers a team\'s own password over the shared one', () => {
        const view = buildCamToolView(input({ servers: ONE_SERVER, passwords: { A: 'cup2026', B: 'other' } }))
        expect(view.launch.request?.passwords).toEqual({ A: 'cup2026', B: 'other' })
        expect(view.passwords.B.sharedFrom).toBeNull()
    })

    it('blocks the launch on a password the game can\'t take, without sharing it', () => {
        const view = buildCamToolView(input({ servers: ONE_SERVER, passwords: { A: 'two words', B: '' } }))
        expect(view.launch.request).toBeNull()
        expect(view.passwords.A.invalid).toBe(true)
        expect(view.passwords.B).toMatchObject({ sharedFrom: null, invalid: false })
        expect(view.launch.blockers).toEqual([
            expect.objectContaining({ code: 'password', team: 'A', message: expect.stringContaining('Crimson Tide') }),
        ])
    })
})

describe('lineup', () => {
    it('lists the four slots in cam order with names and window titles', () => {
        const view = buildCamToolView(input())
        expect(view.lineup.map(slot => [slot.slot, slot.person?.display_name, slot.windowTitle, slot.problem])).toEqual([
            ['A1', 'Alice', 'UTBT Cam A1', null],
            ['A2', 'Anna', 'UTBT Cam A2', null],
            ['B1', 'Bob', 'UTBT Cam B1', null],
            ['B2', 'Bea', 'UTBT Cam B2', null],
        ])
    })

    it('blocks launch on an empty slot', () => {
        const view = buildCamToolView(input({ desk: desk(match({ b2: null })) }))
        expect(view.lineup[3].problem).toBe('empty')
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers).toEqual([
            { code: 'lineup', slots: ['B2'], message: expect.stringMatching(/B2.*Match panel/) },
        ])
    })

    it('blocks launch on a player without a linked Discord account', () => {
        const view = buildCamToolView(input({ desk: desk(match({ a2: person('4242', 'Unlinked') })) }))
        expect(view.lineup[1]).toMatchObject({ problem: 'unlinked', discordId: null })
        expect(view.launch.blockers).toEqual([
            { code: 'lineup', slots: ['A2'], message: expect.stringContaining('Discord') },
        ])
    })

    it('names every slot that is missing an id in one message', () => {
        const view = buildCamToolView(input({ desk: desk(match({ a1: null, b1: person('7', 'Short') })) }))
        expect(view.launch.blockers).toEqual([expect.objectContaining({ code: 'lineup', slots: ['A1', 'B1'] })])
    })

    it('needs a current match', () => {
        const view = buildCamToolView(input({ desk: desk(null) }))
        expect(view.lineup.every(slot => slot.problem === 'empty')).toBe(true)
        expect(view.launch.blockers[0]).toMatchObject({ code: 'no-match' })
    })

    it('waits for the desk', () => {
        const view = buildCamToolView(input({ desk: null }))
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers[0]).toMatchObject({ code: 'no-match' })
    })
})

describe('cam fps', () => {
    it('carries the chosen frame rate on the launch request', () => {
        for (const fps of [60, 120] as const) {
            expect(buildCamToolView(input({ fps })).launch.request?.fps).toBe(fps)
        }
    })

    it('holds launch while the frame rate preference is still being read', () => {
        const view = buildCamToolView(input({ fps: undefined }))
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers).toEqual([])
    })
})

describe('cam volume', () => {
    it('carries the chosen volume on the launch request', () => {
        for (const volume of [0, 35, 100]) {
            expect(buildCamToolView(input({ volume })).launch.request?.volume).toBe(volume)
        }
    })

    it('holds launch while the volume preference is still being read', () => {
        const view = buildCamToolView(input({ volume: undefined }))
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers).toEqual([])
    })
})

describe('install path', () => {
    it('blocks launch without an install path and points to the settings', () => {
        const view = buildCamToolView(input({ installPath: null }))
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers).toEqual([
            { code: 'install-path', message: expect.stringContaining('Settings') },
        ])
    })

    it('treats a blank install path as missing', () => {
        const view = buildCamToolView(input({ installPath: '   ' }))
        expect(view.launch.blockers.map(blocker => blocker.code)).toEqual(['install-path'])
    })

    it('holds launch while the install path is still being read', () => {
        const view = buildCamToolView(input({ installPath: undefined }))
        expect(view.launch.request).toBeNull()
        expect(view.launch.blockers).toEqual([])
    })

    it('lists every blocker at once', () => {
        const view = buildCamToolView(input({ installPath: null, desk: desk(match({ a1: null })), servers: [] }))
        expect(view.launch.blockers.map(blocker => blocker.code)).toEqual(['lineup', 'server', 'server', 'install-path'])
    })
})

describe('cam status', () => {
    it('shows four idle cams before a launch', () => {
        const view = buildCamToolView(input())
        expect(view.cams.map(cam => [cam.slot, cam.running, cam.stale])).toEqual([
            ['A1', false, false],
            ['A2', false, false],
            ['B1', false, false],
            ['B2', false, false],
        ])
        expect(view.anyRunning).toBe(false)
    })

    it('shows the server and who each cam follows by name', () => {
        const view = buildCamToolView(input({ status: runningStatus(FULL_TARGETS) }))
        expect(view.anyRunning).toBe(true)
        expect(view.cams[0]).toMatchObject({ slot: 'A1', running: true, titled: true, server: '10.0.0.1:7777', serverName: 'Server s1', stale: false })
        expect(view.cams[0].target).toEqual({ discordId: ALICE, name: 'Alice' })
        expect(view.cams[3].target).toEqual({ discordId: BEA, name: 'Bea' })
    })

    it('marks a cam that followed its player to another server', () => {
        const status = runningStatus(FULL_TARGETS)
        status.cams[2] = { ...status.cams[2], server: '10.0.0.2:7777' }
        const view = buildCamToolView(input({ status }))
        expect(view.cams[2]).toMatchObject({ server: '10.0.0.2:7777', serverName: 'Server s2', movedServer: true })
        expect(view.cams[0].movedServer).toBe(false)
    })

    it('flags the cam whose lineup slot changed after launch', () => {
        const view = buildCamToolView(input({ status: runningStatus(FULL_TARGETS), desk: desk(match({ a2: person(AXEL, 'Axel') })) }))
        expect(view.cams.map(cam => cam.stale)).toEqual([false, true, false, false])
        expect(view.cams[1].staleMessage).toBe("Restart cam A2: it follows a different player from the lineup's A2.")
        expect(view.staleSlots).toEqual(['A2'])
    })

    it('flags a swap within a team on both cams', () => {
        const view = buildCamToolView(input({ status: runningStatus(FULL_TARGETS), desk: desk(match({ b1: person(BEA, 'Bea'), b2: person(BOB, 'Bob') })) }))
        expect(view.staleSlots).toEqual(['B1', 'B2'])
    })

    it('flags a cam whose slot was emptied', () => {
        const view = buildCamToolView(input({ status: runningStatus(FULL_TARGETS), desk: desk(match({ b2: null })) }))
        expect(view.cams[3].stale).toBe(true)
        expect(view.cams[3].staleMessage).toContain('restarting it keeps its old player')
    })

    it('warns that a restart keeps the old player while launch is blocked', () => {
        const view = buildCamToolView(input({ status: runningStatus(FULL_TARGETS), desk: desk(match({ a2: person(AXEL, 'Axel') })), installPath: null }))
        expect(view.cams[1].stale).toBe(true)
        expect(view.cams[1].staleMessage).toContain('Fix the launch problems above first')
    })

    it('pairs each cam with its own lineup slot', () => {
        const view = buildCamToolView(input({ status: runningStatus(FULL_TARGETS) }))
        expect(view.cams.map(cam => [cam.slot, cam.lineup.slot, cam.lineup.person?.display_name])).toEqual([
            ['A1', 'A1', 'Alice'],
            ['A2', 'A2', 'Anna'],
            ['B1', 'B1', 'Bob'],
            ['B2', 'B2', 'Bea'],
        ])
    })

    it('clears the flag once the cam follows the new player', () => {
        const status = runningStatus({ ...FULL_TARGETS, A2: AXEL })
        const view = buildCamToolView(input({ status, desk: desk(match({ a2: person(AXEL, 'Axel') })) }))
        expect(view.staleSlots).toEqual([])
        expect(view.cams[1].target).toEqual({ discordId: AXEL, name: 'Axel' })
    })

    it('never flags a cam that is not running', () => {
        const status = runningStatus(FULL_TARGETS, { running: false, pid: null, exitCode: 1 })
        const view = buildCamToolView(input({ status, desk: desk(match({ a2: person(AXEL, 'Axel') })) }))
        expect(view.staleSlots).toEqual([])
        expect(view.anyRunning).toBe(false)
    })

    it('keeps an unknown target as its id', () => {
        const view = buildCamToolView(input({ status: runningStatus({ A1: '999999999999999999' }) }))
        expect(view.cams[0].target).toEqual({ discordId: '999999999999999999', name: null })
    })

    it('reports a failed retitle', () => {
        const status = { ...runningStatus(FULL_TARGETS, { titled: false }), retitle: { available: false, error: 'koffi missing' } }
        const view = buildCamToolView(input({ status }))
        expect(view.retitleError).toContain('koffi missing')
        expect(view.cams[0].titled).toBe(false)
    })
})

describe('launcher errors', () => {
    it('points install errors to the settings', () => {
        expect(camErrorMessage({ code: 'no-install' })).toContain('Settings')
        expect(camErrorMessage({ code: 'missing-install-path' })).toContain('Settings')
        expect(camErrorMessage({ code: 'missing-executable' })).toContain('UnrealTournament.exe')
    })

    it('names the slot or team the error is about', () => {
        expect(camErrorMessage({ code: 'invalid-discord-id', slot: 'B1', value: '12' })).toContain('B1')
        expect(camErrorMessage({ code: 'missing-server', team: 'A' })).toContain('Team A')
        expect(camErrorMessage({ code: 'invalid-password', team: 'B' })).toContain('Team B')
        expect(camErrorMessage({ code: 'write-failed', slot: 'A2' })).toContain('A2')
        expect(camErrorMessage({ code: 'ini-unreadable', file: 'user' })).toContain('User.ini')
    })
})
