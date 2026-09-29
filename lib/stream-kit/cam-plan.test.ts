import { describe, expect, it } from 'vitest'
import { buildCamPlan, type CamPlan, type CamPlanInput } from './cam-plan'

const A1 = '111111111111111111'
const A2 = '222222222222222222'
const B1 = '333333333333333333'
const B2 = '444444444444444444'

const MAIN_INI = [
    '[URL]',
    'Protocol=unreal',
    '',
    '[Engine.Engine]',
    'GameRenderDevice=D3D9Drv.D3D9RenderDevice',
    '',
    '[WinDrv.WindowsClient]',
    'WindowedViewportX=2576',
    'WindowedViewportY=1460',
    'StartupFullscreen=True',
    'Brightness=0.900000',
    'FrameRateLimit=360.000000',
    '',
    '[D3D9Drv.D3D9RenderDevice]',
    'FrameRateLimit=0',
    '',
].join('\r\n')

const USER_INI = [
    '[Engine.Input]',
    'F1=ShowScores',
    '',
    '[DefaultPlayer]',
    'Name=Streamer',
    'Class=BotPack.TFemale1',
    'OverrideClass=',
    'Voice=BotPack.VoiceFemaleOne',
    '',
].join('\r\n')

function input(overrides: Partial<CamPlanInput> = {}): CamPlanInput {
    return {
        installPath: 'D:\\Games\\UnrealTournament',
        lineup: { A1, A2, B1, B2 },
        servers: { A: '203.0.113.10:7777', B: '203.0.113.10:7777' },
        mainIni: MAIN_INI,
        userIni: USER_INI,
        ...overrides,
    }
}

function planOf(camInput: CamPlanInput): CamPlan {
    const result = buildCamPlan(camInput)
    if (!result.ok) throw new Error(`expected a plan, got ${JSON.stringify(result.errors)}`)
    return result.plan
}

describe('buildCamPlan command lines', () => {
    it('launches the install exe from its System folder with the connect URL, NewWindow and per-cam file switches', () => {
        const cam = planOf(input()).cams[0]

        expect(cam.command).toEqual({
            executable: 'D:\\Games\\UnrealTournament\\System\\UnrealTournament.exe',
            workingDirectory: 'D:\\Games\\UnrealTournament\\System',
            args: [
                `unreal://203.0.113.10:7777?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${A1}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
                '-NewWindow',
                'INI=UTBTCamA1.ini',
                'USERINI=UTBTCamA1User.ini',
                'LOG=UTBTCamA1.log',
            ],
        })
    })

    it('gives every cam its own ini, user ini and log file in the System folder', () => {
        const cams = planOf(input()).cams

        expect(cams.map(cam => cam.files)).toEqual([
            { ini: 'UTBTCamA1.ini', userIni: 'UTBTCamA1User.ini', log: 'UTBTCamA1.log' },
            { ini: 'UTBTCamA2.ini', userIni: 'UTBTCamA2User.ini', log: 'UTBTCamA2.log' },
            { ini: 'UTBTCamB1.ini', userIni: 'UTBTCamB1User.ini', log: 'UTBTCamB1.log' },
            { ini: 'UTBTCamB2.ini', userIni: 'UTBTCamB2User.ini', log: 'UTBTCamB2.log' },
        ])
        expect(cams.map(cam => cam.command.args.slice(1))).toEqual([
            ['-NewWindow', 'INI=UTBTCamA1.ini', 'USERINI=UTBTCamA1User.ini', 'LOG=UTBTCamA1.log'],
            ['-NewWindow', 'INI=UTBTCamA2.ini', 'USERINI=UTBTCamA2User.ini', 'LOG=UTBTCamA2.log'],
            ['-NewWindow', 'INI=UTBTCamB1.ini', 'USERINI=UTBTCamB1User.ini', 'LOG=UTBTCamB1.log'],
            ['-NewWindow', 'INI=UTBTCamB2.ini', 'USERINI=UTBTCamB2User.ini', 'LOG=UTBTCamB2.log'],
        ])
    })

    it('accepts an install path with a trailing separator', () => {
        const cam = planOf(input({ installPath: 'C:\\UnrealTournament\\' })).cams[0]

        expect(cam.command.executable).toBe('C:\\UnrealTournament\\System\\UnrealTournament.exe')
        expect(cam.command.workingDirectory).toBe('C:\\UnrealTournament\\System')
    })

    it('trims spaces around a typed install path', () => {
        const cam = planOf(input({ installPath: '  C:\\UnrealTournament\\ ' })).cams[0]

        expect(cam.command.executable).toBe('C:\\UnrealTournament\\System\\UnrealTournament.exe')
        expect(cam.command.workingDirectory).toBe('C:\\UnrealTournament\\System')
    })
})

describe('buildCamPlan per-instance ini', () => {
    it('replaces the windowing and frame cap keys, adds the missing ones, and leaves everything else as it was', () => {
        const cam = planOf(input()).cams[0]

        expect(cam.iniContent).toBe([
            '[URL]',
            'Protocol=unreal',
            '',
            '[Engine.Engine]',
            'GameRenderDevice=D3D9Drv.D3D9RenderDevice',
            '',
            '[WinDrv.WindowsClient]',
            'WindowedViewportX=960',
            'WindowedViewportY=540',
            'StartupFullscreen=False',
            'Brightness=0.900000',
            'FrameRateLimit=60',
            'StartupBorderless=False',
            '',
            '[D3D9Drv.D3D9RenderDevice]',
            'FrameRateLimit=0',
            '',
        ].join('\r\n'))
    })

    it('adds the client section when the main ini has none', () => {
        const mainIni = '[URL]\nProtocol=unreal\n'

        const cam = planOf(input({ mainIni })).cams[0]

        expect(cam.iniContent).toBe([
            '[URL]',
            'Protocol=unreal',
            '',
            '[WinDrv.WindowsClient]',
            'WindowedViewportX=960',
            'WindowedViewportY=540',
            'StartupFullscreen=False',
            'StartupBorderless=False',
            'FrameRateLimit=60',
            '',
        ].join('\n'))
    })

    it('matches section and key names without regard to case and keeps spaces around unrelated values', () => {
        const mainIni = [
            '[windrv.windowsclient]',
            'startupfullscreen = True',
            'CaptureMouse = True',
            'EPPCustomCurvePoints=',
        ].join('\r\n')

        const cam = planOf(input({ mainIni })).cams[0]

        expect(cam.iniContent).toBe([
            '[windrv.windowsclient]',
            'StartupFullscreen=False',
            'CaptureMouse = True',
            'EPPCustomCurvePoints=',
            'WindowedViewportX=960',
            'WindowedViewportY=540',
            'StartupBorderless=False',
            'FrameRateLimit=60',
        ].join('\r\n'))
    })

    it('gives all four cams the same ini content', () => {
        const cams = planOf(input()).cams

        expect(new Set(cams.map(cam => cam.iniContent)).size).toBe(1)
    })
})

describe('buildCamPlan per-instance user ini', () => {
    it('copies the streamer\'s user ini with the default player set to spectate', () => {
        const cam = planOf(input()).cams[0]

        expect(cam.userIniContent).toBe([
            '[Engine.Input]',
            'F1=ShowScores',
            '',
            '[DefaultPlayer]',
            'Name=Streamer',
            'Class=BotPack.TFemale1',
            'OverrideClass=Botpack.CHSpectator',
            'Voice=BotPack.VoiceFemaleOne',
            '',
        ].join('\r\n'))
    })

    it('adds the default player section when the user ini has none', () => {
        const cam = planOf(input({ userIni: '[Engine.Input]\r\nF1=ShowScores\r\n' })).cams[0]

        expect(cam.userIniContent).toBe([
            '[Engine.Input]',
            'F1=ShowScores',
            '',
            '[DefaultPlayer]',
            'OverrideClass=Botpack.CHSpectator',
            '',
        ].join('\r\n'))
    })
})

describe('buildCamPlan join options', () => {
    it('joins every cam as a quiet spectator following its lineup player with the Broadcast HUD and join/leave muted', () => {
        const cams = planOf(input()).cams

        expect(cams.map(cam => cam.joinOptions)).toEqual([A1, A2, B1, B2].map(discordId => ({
            OverrideClass: 'Botpack.CHSpectator',
            UTBTSpectator: 'True',
            UTBTFollow: discordId,
            UTBTHud: 'Broadcast',
            UTBTMuteJoinLeave: 'True',
        })))
    })

    it('carries the join options on the connect URL in UT option syntax', () => {
        const cam = planOf(input()).cams[3]

        expect(cam.url).toBe(
            `unreal://203.0.113.10:7777?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${B2}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
        )
        expect(cam.command.args[0]).toBe(cam.url)
    })
})

describe('buildCamPlan window titles', () => {
    it('titles the cams UTBT Cam A1, A2, B1 and B2 in slot order', () => {
        const cams = planOf(input()).cams

        expect(cams.map(cam => [cam.slot, cam.windowTitle])).toEqual([
            ['A1', 'UTBT Cam A1'],
            ['A2', 'UTBT Cam A2'],
            ['B1', 'UTBT Cam B1'],
            ['B2', 'UTBT Cam B2'],
        ])
    })
})

describe('buildCamPlan errors', () => {
    it('refuses to plan when a lineup slot is missing', () => {
        expect(buildCamPlan(input({ lineup: { A1, A2, B1 } }))).toEqual({
            ok: false,
            errors: [{ code: 'missing-slot', slot: 'B2' }],
        })
        expect(buildCamPlan(input({ lineup: { A1, A2: null, B1, B2: '' } }))).toEqual({
            ok: false,
            errors: [{ code: 'missing-slot', slot: 'A2' }, { code: 'missing-slot', slot: 'B2' }],
        })
    })

    it('refuses Discord ids that are not all digits or too short to be a Discord id', () => {
        for (const bad of ['11111111111111111x', '1111 1111111111111', '12345', '111111111111111111?UTBTHud=Default']) {
            expect(buildCamPlan(input({ lineup: { A1, A2, B1: bad, B2 } }))).toEqual({
                ok: false,
                errors: [{ code: 'invalid-discord-id', slot: 'B1', value: bad }],
            })
        }
    })

    it('refuses to plan when a team has no server', () => {
        expect(buildCamPlan(input({ servers: { A: '203.0.113.10:7777' } }))).toEqual({
            ok: false,
            errors: [{ code: 'missing-server', team: 'B' }],
        })
        expect(buildCamPlan(input({ servers: { A: '  ', B: '203.0.113.10:7777' } }))).toEqual({
            ok: false,
            errors: [{ code: 'missing-server', team: 'A' }],
        })
    })

    it('refuses server addresses that are not host:port', () => {
        const bad = [
            '203.0.113.10',
            '203.0.113.10:',
            ':7777',
            '203.0.113.10:0',
            '203.0.113.10:65536',
            '203.0.113.10:77a7',
            '256.0.113.10:7777',
            '203.0.113:7777',
            'unreal://203.0.113.10:7777',
            'eu server.example.net:7777',
            '-eu.example.net:7777',
            '203.0.113.10:7777?UTBTFollow=1',
        ]
        for (const address of bad) {
            expect(buildCamPlan(input({ servers: { A: '203.0.113.10:7777', B: address } }))).toEqual({
                ok: false,
                errors: [{ code: 'invalid-server', team: 'B', value: address }],
            })
        }
    })

    it('accepts host names and IPv4 addresses with any valid port', () => {
        for (const address of ['eu.example.net:7777', 'localhost:1', '10.0.0.255:65535', 'UT-Server-2.example.net:7800']) {
            expect(buildCamPlan(input({ servers: { A: address, B: address } })).ok).toBe(true)
        }
    })

    it('refuses to plan without an install path or ini contents', () => {
        expect(buildCamPlan(input({ installPath: ' ', mainIni: '', userIni: '\r\n' }))).toEqual({
            ok: false,
            errors: [
                { code: 'missing-install-path' },
                { code: 'missing-ini', file: 'main' },
                { code: 'missing-ini', file: 'user' },
            ],
        })
    })

    it('reports every problem at once instead of a partial plan', () => {
        const result = buildCamPlan(input({
            lineup: { A1: 'abc', A2, B1 },
            servers: { A: 'nowhere' },
        }))

        expect(result).toEqual({
            ok: false,
            errors: [
                { code: 'invalid-discord-id', slot: 'A1', value: 'abc' },
                { code: 'missing-slot', slot: 'B2' },
                { code: 'invalid-server', team: 'A', value: 'nowhere' },
                { code: 'missing-server', team: 'B' },
            ],
        })
    })
})

describe('buildCamPlan server layouts', () => {
    it('sends all four cams to the one server both teams play on', () => {
        const cams = planOf(input({ servers: { A: '203.0.113.10:7777', B: '203.0.113.10:7777' } })).cams

        expect(cams.map(cam => [cam.slot, cam.team, cam.discordId, cam.server])).toEqual([
            ['A1', 'A', A1, '203.0.113.10:7777'],
            ['A2', 'A', A2, '203.0.113.10:7777'],
            ['B1', 'B', B1, '203.0.113.10:7777'],
            ['B2', 'B', B2, '203.0.113.10:7777'],
        ])
        expect(cams.every(cam => cam.command.args[0].startsWith('unreal://203.0.113.10:7777?'))).toBe(true)
    })

    it('sends each team\'s cams to that team\'s server when the teams play on two servers', () => {
        const cams = planOf(input({ servers: { A: '203.0.113.10:7777', B: 'eu.example.net:7800' } })).cams

        expect(cams.map(cam => [cam.slot, cam.server])).toEqual([
            ['A1', '203.0.113.10:7777'],
            ['A2', '203.0.113.10:7777'],
            ['B1', 'eu.example.net:7800'],
            ['B2', 'eu.example.net:7800'],
        ])
        expect(cams.map(cam => cam.command.args[0])).toEqual([
            `unreal://203.0.113.10:7777?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${A1}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
            `unreal://203.0.113.10:7777?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${A2}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
            `unreal://eu.example.net:7800?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${B1}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
            `unreal://eu.example.net:7800?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${B2}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
        ])
    })

    it('trims spaces around a typed server address', () => {
        const cam = planOf(input({ servers: { A: '  203.0.113.10:7777 ', B: '203.0.113.10:7777' } })).cams[0]

        expect(cam.server).toBe('203.0.113.10:7777')
        expect(cam.command.args[0].startsWith('unreal://203.0.113.10:7777?')).toBe(true)
    })
})
