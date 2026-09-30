import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CamCommand } from '@/lib/stream-kit/cam-plan'
import { CamLauncher, type CamLauncherOptions, type CamProcess, type CamRequest } from './cam-launcher'
import type { CamTitleTarget, CamWindows } from './cam-windows'

const A1 = '111111111111111111'
const A2 = '222222222222222222'
const B1 = '333333333333333333'
const B2 = '444444444444444444'
const B2_NEW = '555555555555555555'

const MAIN_INI = Buffer.from('[URL]\r\nProtocol=unreal\r\n\r\n[WinDrv.WindowsClient]\r\nWindowedViewportX=2560\r\nStartupFullscreen=True\r\n\r\n[Engine.GameReplicationInfo]\r\nServerName=Café\r\n', 'latin1')
const USER_INI = Buffer.from('[DefaultPlayer]\r\nName=Streämer\r\nOverrideClass=\r\n', 'latin1')

const REQUEST: CamRequest = {
    lineup: { A1, A2, B1, B2 },
    servers: { A: '203.0.113.10:7777', B: '198.51.100.20:7778' },
    fps: 120,
}

class FakeProcess implements CamProcess {
    killed = false
    private exitListeners: ((code: number | null) => void)[] = []

    constructor(readonly pid: number | undefined, readonly command: CamCommand) {}

    onExit(listener: (code: number | null) => void) {
        this.exitListeners.push(listener)
    }

    onError() {}

    kill() {
        this.killed = true
        this.exit(1)
    }

    exit(code: number | null) {
        for (const listener of this.exitListeners) listener(code)
    }
}

class FakeWindows implements CamWindows {
    calls: CamTitleTarget[][] = []
    titled = new Set<number>()

    applyTitles = async (targets: readonly CamTitleTarget[]) => {
        this.calls.push([...targets])
        return new Map(targets.map(target => [target.pid, this.titled.has(target.pid)]))
    }
}

let root: string
let installPath: string
let systemDirectory: string
let processes: FakeProcess[]
let windows: FakeWindows
let nextPid: number

function launcher(overrides: Partial<CamLauncherOptions> = {}) {
    return new CamLauncher({
        supported: true,
        getInstallPath: () => installPath,
        spawnCam: command => {
            const process = new FakeProcess(nextPid++, command)
            processes.push(process)
            return process
        },
        loadWindows: async () => windows,
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        exitTimeoutMs: 50,
        ...overrides,
    })
}

function processFor(slot: string) {
    return processes.filter(process => process.command.args.includes(`INI=UTBTCam${slot}.ini`)).at(-1) as FakeProcess
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'utbt-cams-'))
    installPath = join(root, 'UnrealTournament')
    systemDirectory = join(installPath, 'System')
    mkdirSync(systemDirectory, { recursive: true })
    writeFileSync(join(systemDirectory, 'UnrealTournament.ini'), MAIN_INI)
    writeFileSync(join(systemDirectory, 'User.ini'), USER_INI)
    writeFileSync(join(systemDirectory, 'UnrealTournament.exe'), '')
    processes = []
    windows = new FakeWindows()
    nextPid = 1000
})

afterEach(() => {
    vi.useRealTimers()
    rmSync(root, { recursive: true, force: true })
})

describe('CamLauncher.plan', () => {
    it('plans four cams from the streamer ini files', async () => {
        const result = await launcher().plan(REQUEST)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.cams.map(cam => [cam.slot, cam.server, cam.discordId, cam.windowTitle])).toEqual([
            ['A1', '203.0.113.10:7777', A1, 'UTBT Cam A1'],
            ['A2', '203.0.113.10:7777', A2, 'UTBT Cam A2'],
            ['B1', '198.51.100.20:7778', B1, 'UTBT Cam B1'],
            ['B2', '198.51.100.20:7778', B2, 'UTBT Cam B2'],
        ])
        expect(result.cams[0].command.workingDirectory).toBe(`${installPath}\\System`)
    })

    it('passes plan errors through', async () => {
        const result = await launcher().plan({ ...REQUEST, lineup: { A1, A2, B1 } })
        expect(result).toEqual({ ok: false, errors: [{ code: 'missing-slot', slot: 'B2' }] })
    })

    it('reports a missing install', async () => {
        const result = await launcher({ getInstallPath: () => undefined }).plan(REQUEST)
        expect(result).toEqual({ ok: false, errors: [{ code: 'no-install' }] })
    })

    it('reports an unreadable user ini', async () => {
        rmSync(join(systemDirectory, 'User.ini'))
        const result = await launcher().plan(REQUEST)
        expect(result).toEqual({ ok: false, errors: [{ code: 'ini-unreadable', file: 'user' }] })
    })

    it('refuses on an unsupported platform', async () => {
        const result = await launcher({ supported: false }).plan(REQUEST)
        expect(result).toEqual({ ok: false, errors: [{ code: 'unsupported-platform' }] })
    })
})

describe('CamLauncher.launch', () => {
    it('writes separate files per cam under System and leaves the streamer ini files byte-identical', async () => {
        writeFileSync(join(systemDirectory, 'UTBTCamA1.log'), 'Log: LoadMap: 192.0.2.1:7777/BT-Old?Name=Cam\r\n')
        const result = await launcher().launch(REQUEST)
        expect(result.ok).toBe(true)

        expect(readFileSync(join(systemDirectory, 'UnrealTournament.ini')).equals(MAIN_INI)).toBe(true)
        expect(readFileSync(join(systemDirectory, 'User.ini')).equals(USER_INI)).toBe(true)
        expect(readdirSync(root)).toEqual(['UnrealTournament'])
        expect(readdirSync(installPath)).toEqual(['System'])
        expect(readdirSync(systemDirectory).sort()).toEqual([
            'UTBTCamA1.ini', 'UTBTCamA1User.ini',
            'UTBTCamA2.ini', 'UTBTCamA2User.ini',
            'UTBTCamB1.ini', 'UTBTCamB1User.ini',
            'UTBTCamB2.ini', 'UTBTCamB2User.ini',
            'UnrealTournament.exe', 'UnrealTournament.ini', 'User.ini',
        ])

        const camIni = readFileSync(join(systemDirectory, 'UTBTCamB2.ini'), 'latin1')
        expect(camIni).toContain('WindowedViewportX=960\r\n')
        expect(camIni).toContain('ServerName=Café\r\n')
        const camUserIni = readFileSync(join(systemDirectory, 'UTBTCamB2User.ini'), 'latin1')
        expect(camUserIni).toContain('Name=Streämer\r\n')
        expect(camUserIni).toContain('OverrideClass=Botpack.CHSpectator')
    })

    it('writes the requested frame rate into every cam ini', async () => {
        for (const fps of [60, 120] as const) {
            const result = await launcher().launch({ ...REQUEST, fps })
            expect(result.ok).toBe(true)
            for (const slot of ['A1', 'A2', 'B1', 'B2']) {
                expect(readFileSync(join(systemDirectory, `UTBTCam${slot}.ini`), 'latin1')).toContain(`FrameRateLimit=${fps}\r\n`)
            }
        }
    })

    it('spawns four clients from the install with the plan command lines', async () => {
        await launcher().launch(REQUEST)
        expect(processes).toHaveLength(4)
        const a1 = processFor('A1')
        expect(a1.command.executable).toBe(`${installPath}\\System\\UnrealTournament.exe`)
        expect(a1.command.workingDirectory).toBe(`${installPath}\\System`)
        expect(a1.command.args).toEqual([
            `unreal://203.0.113.10:7777?OverrideClass=Botpack.CHSpectator?UTBTSpectator=True?UTBTFollow=${A1}?UTBTHud=Broadcast?UTBTMuteJoinLeave=True`,
            '-NewWindow',
            'INI=UTBTCamA1.ini',
            'USERINI=UTBTCamA1User.ini',
            'LOG=UTBTCamA1.log',
        ])
    })

    it('tracks each cam by PID', async () => {
        const cams = launcher()
        const result = await cams.launch(REQUEST)
        if (!result.ok) throw new Error('launch failed')
        expect(result.status.cams.map(cam => [cam.slot, cam.running, cam.pid, cam.target, cam.plannedServer])).toEqual([
            ['A1', true, 1000, A1, '203.0.113.10:7777'],
            ['A2', true, 1001, A2, '203.0.113.10:7777'],
            ['B1', true, 1002, B1, '198.51.100.20:7778'],
            ['B2', true, 1003, B2, '198.51.100.20:7778'],
        ])
        expect([...cams.runningPids()]).toEqual([1000, 1001, 1002, 1003])
    })

    it('refuses to launch when the game executable is missing', async () => {
        rmSync(join(systemDirectory, 'UnrealTournament.exe'))
        const result = await launcher().launch(REQUEST)
        expect(result).toEqual({ ok: false, errors: [{ code: 'missing-executable' }] })
        expect(processes).toHaveLength(0)
    })

    it('does not spawn anything when the plan is invalid', async () => {
        const result = await launcher().launch({ ...REQUEST, servers: { A: 'nope', B: '198.51.100.20:7778' } })
        expect(result).toEqual({ ok: false, errors: [{ code: 'invalid-server', team: 'A', value: 'nope' }] })
        expect(processes).toHaveLength(0)
    })

    it('replaces cams that are already running', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const first = [...processes]
        await cams.launch(REQUEST)
        expect(first.every(process => process.killed)).toBe(true)
        expect([...cams.runningPids()]).toEqual([1004, 1005, 1006, 1007])
    })

    it('runs overlapping launches one after the other so no cam is left untracked', async () => {
        const cams = launcher()
        await Promise.all([cams.launch(REQUEST), cams.launch(REQUEST)])
        expect(processes).toHaveLength(8)
        expect(processes.slice(0, 4).every(process => process.killed)).toBe(true)
        expect(processes.slice(4).some(process => process.killed)).toBe(false)
        expect([...cams.runningPids()]).toEqual([1004, 1005, 1006, 1007])
    })

    it('stops cams that a launch in progress is starting', async () => {
        const cams = launcher()
        const [, stopped] = await Promise.all([cams.launch(REQUEST), cams.stopAll()])
        expect(processes).toHaveLength(4)
        expect(processes.every(process => process.killed)).toBe(true)
        expect(stopped.cams.every(cam => !cam.running)).toBe(true)
        expect(cams.runningPids().size).toBe(0)
    })

    it('keeps utf-16 ini files in utf-16', async () => {
        const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('[WinDrv.WindowsClient]\r\nStartupFullscreen=True\r\n', 'utf16le')])
        writeFileSync(join(systemDirectory, 'UnrealTournament.ini'), utf16)
        await launcher().launch(REQUEST)
        const camIni = readFileSync(join(systemDirectory, 'UTBTCamA1.ini'))
        expect(camIni.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xfe]))
        expect(camIni.subarray(2).toString('utf16le')).toContain('StartupFullscreen=False')
        expect(readFileSync(join(systemDirectory, 'UnrealTournament.ini')).equals(utf16)).toBe(true)
    })
})

describe('CamLauncher window titles', () => {
    it('titles each cam window by PID when launched', async () => {
        windows.titled = new Set([1000, 1001, 1002, 1003])
        const result = await launcher().launch(REQUEST)
        expect(windows.calls[0]).toEqual([
            { pid: 1000, title: 'UTBT Cam A1' },
            { pid: 1001, title: 'UTBT Cam A2' },
            { pid: 1002, title: 'UTBT Cam B1' },
            { pid: 1003, title: 'UTBT Cam B2' },
        ])
        if (!result.ok) throw new Error('launch failed')
        expect(result.status.cams.every(cam => cam.titled)).toBe(true)
        expect(result.status.retitle).toEqual({ available: true, error: null })
    })

    it('reports a cam whose window is not titled yet', async () => {
        windows.titled = new Set([1000, 1001, 1002])
        const result = await launcher().launch(REQUEST)
        if (!result.ok) throw new Error('launch failed')
        expect(result.status.cams.map(cam => cam.titled)).toEqual([true, true, true, false])
    })

    it('re-applies the titles every few seconds while cams run and stops afterwards', async () => {
        vi.useFakeTimers()
        const cams = launcher({ retitleIntervalMs: 2000 })
        await cams.launch(REQUEST)
        expect(windows.calls).toHaveLength(1)
        await vi.advanceTimersByTimeAsync(2000)
        expect(windows.calls).toHaveLength(2)
        windows.titled = new Set([1000, 1001, 1002, 1003])
        await vi.advanceTimersByTimeAsync(2000)
        expect(windows.calls).toHaveLength(3)
        expect((await cams.status()).cams.every(cam => cam.titled)).toBe(true)

        await cams.stopAll()
        await vi.advanceTimersByTimeAsync(10000)
        expect(windows.calls).toHaveLength(3)
    })

    it('keeps cams running when window titling cannot load', async () => {
        const result = await launcher({ loadWindows: async () => { throw new Error('native module missing') } }).launch(REQUEST)
        if (!result.ok) throw new Error('launch failed')
        expect(result.status.retitle).toEqual({ available: false, error: 'native module missing' })
        expect(result.status.cams.every(cam => cam.running && !cam.titled)).toBe(true)
    })

    it('retitles on demand', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        windows.titled = new Set([1000, 1001, 1002, 1003])
        const status = await cams.retitle()
        expect(status.cams.every(cam => cam.titled)).toBe(true)
    })
})

describe('CamLauncher status', () => {
    it('reads the server each cam is on from its own log', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        writeFileSync(join(systemDirectory, 'UTBTCamA1.log'), 'Log: Browse: 203.0.113.10/Index.unr?Name=Cam\r\nLog: LoadMap: 203.0.113.10/BT-Colors?Name=Cam\r\n')
        writeFileSync(join(systemDirectory, 'UTBTCamB1.log'), 'Log: LoadMap: 198.51.100.20:7778/BT-Maze?Name=Cam\r\n')

        const status = await cams.status()
        expect(status.cams.map(cam => cam.server)).toEqual(['203.0.113.10:7777', null, '198.51.100.20:7778', null])
    })

    it('shows the new server after a cross-server follow', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const log = join(systemDirectory, 'UTBTCamA2.log')
        writeFileSync(log, 'Log: LoadMap: 203.0.113.10:7777/BT-Colors?Name=Cam\r\n')
        expect((await cams.status()).cams[1].server).toBe('203.0.113.10:7777')

        appendFileSync(log, 'Log: Browse: 192.0.2.50:7790/Index.unr?Name=Cam\r\nLog: LoadMap: 192.0.2.50:7790/BT-Other?Name=Cam\r\n')
        const status = (await cams.status()).cams[1]
        expect(status.server).toBe('192.0.2.50:7790')
        expect(status.plannedServer).toBe('203.0.113.10:7777')
        expect(status.target).toBe(A2)
    })

    it('reads a utf-16 log', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const log = join(systemDirectory, 'UTBTCamB2.log')
        writeFileSync(log, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Log: LoadMap: 198.51.100.20:7778/BT-Maze?Name=Cam\r\n', 'utf16le')]))
        expect((await cams.status()).cams[3].server).toBe('198.51.100.20:7778')
    })

    it('starts over when a relaunched cam rewrites its log', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const log = join(systemDirectory, 'UTBTCamA1.log')
        writeFileSync(log, 'Log: Some long line that pads the file out\r\nLog: LoadMap: 203.0.113.10:7777/BT-Colors?Name=Cam\r\n')
        expect((await cams.status()).cams[0].server).toBe('203.0.113.10:7777')
        writeFileSync(log, 'Log: LoadMap: Entry?Name=Cam\r\n')
        expect((await cams.status()).cams[0].server).toBeNull()
    })

    it('marks a cam that exited as not running', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        processFor('B1').exit(0)
        const status = await cams.status()
        expect(status.cams[2]).toMatchObject({ slot: 'B1', running: false, titled: false, exitCode: 0 })
        expect(cams.runningPids().has(1002)).toBe(false)
    })

    it('lists all four slots before anything launched', async () => {
        const status = await launcher().status()
        expect(status.cams.map(cam => [cam.slot, cam.windowTitle, cam.running])).toEqual([
            ['A1', 'UTBT Cam A1', false],
            ['A2', 'UTBT Cam A2', false],
            ['B1', 'UTBT Cam B1', false],
            ['B2', 'UTBT Cam B2', false],
        ])
    })
})

describe('CamLauncher.restart and stopAll', () => {
    it('relaunches only the one cam', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const [a1, a2, b1, b2] = ['A1', 'A2', 'B1', 'B2'].map(processFor)
        const result = await cams.restart('B1')
        expect(result.ok).toBe(true)
        expect(b1.killed).toBe(true)
        expect([a1, a2, b2].some(process => process.killed)).toBe(false)
        expect(processes).toHaveLength(5)
        expect(processFor('B1').pid).toBe(1004)
        expect([...cams.runningPids()].sort()).toEqual([1000, 1001, 1003, 1004])
    })

    it('restarts with the current lineup when given one', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const result = await cams.restart('B2', { ...REQUEST, lineup: { ...REQUEST.lineup, B2: B2_NEW } })
        if (!result.ok) throw new Error('restart failed')
        expect(processFor('B2').command.args[0]).toContain(`UTBTFollow=${B2_NEW}`)
        expect(result.status.cams.map(cam => cam.target)).toEqual([A1, A2, B1, B2_NEW])
        expect(processes.slice(0, 3).some(process => process.killed)).toBe(false)
    })

    it('restarts with the frame rate of the request it is given', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        await cams.restart('A2', { ...REQUEST, fps: 60 })
        expect(readFileSync(join(systemDirectory, 'UTBTCamA2.ini'), 'latin1')).toContain('FrameRateLimit=60\r\n')
        expect(readFileSync(join(systemDirectory, 'UTBTCamA1.ini'), 'latin1')).toContain('FrameRateLimit=120\r\n')
    })

    it('restarts a cam that had exited', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        processFor('A1').exit(1)
        const result = await cams.restart('A1')
        if (!result.ok) throw new Error('restart failed')
        expect(result.status.cams[0]).toMatchObject({ running: true, pid: 1004 })
    })

    it('refuses to restart a cam that was never launched', async () => {
        expect(await launcher().restart('A1')).toEqual({ ok: false, errors: [{ code: 'not-launched', slot: 'A1' }] })
    })

    it('stops all four cams', async () => {
        const cams = launcher()
        await cams.launch(REQUEST)
        const status = await cams.stopAll()
        expect(processes.every(process => process.killed)).toBe(true)
        expect(status.cams.every(cam => !cam.running)).toBe(true)
        expect(cams.runningPids().size).toBe(0)
    })
})
