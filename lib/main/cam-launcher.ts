import { existsSync } from 'fs'
import { open, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import {
    buildCamPlan,
    CAM_SLOTS,
    CAM_WINDOW_TITLES,
    type CamCommand,
    type CamFiles,
    type CamPlanCam,
    type CamPlanError,
    type CamPlanInput,
    type CamSlot,
    type CamTeam,
} from '@/lib/stream-kit/cam-plan'
import { resolveWithin } from './path-safety'
import { EMPTY_CAM_LOG_STATE, readCamLogChunk, type CamLogState } from './cam-log'
import type { CamWindows } from './cam-windows'

export type CamRequest = Pick<CamPlanInput, 'lineup' | 'servers'>

export type CamToolError =
    | CamPlanError
    | { code: 'unsupported-platform' }
    | { code: 'no-install' }
    | { code: 'ini-unreadable'; file: 'main' | 'user' }
    | { code: 'missing-executable' }
    | { code: 'write-failed'; slot: CamSlot }
    | { code: 'not-launched'; slot: CamSlot }

export interface CamPlanSummary {
    slot: CamSlot
    team: CamTeam
    discordId: string
    server: string
    windowTitle: string
    url: string
    files: CamFiles
    command: CamCommand
}

export type CamPlanResponse =
    | { ok: true; cams: CamPlanSummary[] }
    | { ok: false; errors: CamToolError[] }

export interface CamStatus {
    slot: CamSlot
    windowTitle: string
    running: boolean
    pid: number | null
    titled: boolean
    server: string | null
    target: string | null
    plannedServer: string | null
    startedAt: string | null
    exitCode: number | null
    error: string | null
}

export interface CamToolStatus {
    supported: boolean
    retitle: { available: boolean; error: string | null }
    cams: CamStatus[]
}

export type CamActionResponse =
    | { ok: true; status: CamToolStatus }
    | { ok: false; errors: CamToolError[] }

export interface CamProcess {
    pid: number | undefined
    onExit: (listener: (code: number | null) => void) => void
    onError: (listener: (error: Error) => void) => void
    kill: () => void
}

export interface CamLogger {
    info: (message: string, data?: unknown) => void
    warn: (message: string, data?: unknown) => void
    error: (message: string, data?: unknown) => void
}

export interface CamLauncherOptions {
    supported: boolean
    getInstallPath: () => string | undefined
    spawnCam: (command: CamCommand) => CamProcess
    loadWindows: () => Promise<CamWindows>
    logger: CamLogger
    retitleIntervalMs?: number
    exitTimeoutMs?: number
    now?: () => Date
}

type IniEncoding = 'latin1' | 'utf16le'

interface IniText {
    text: string
    encoding: IniEncoding
}

interface PreparedPlan {
    systemDirectory: string
    cams: CamPlanCam[]
    encodings: { main: IniEncoding; user: IniEncoding }
}

type CamFileTarget = Pick<PreparedPlan, 'systemDirectory' | 'encodings'>

interface CamLog {
    state: CamLogState
    offset: number
    encoding: IniEncoding | null
}

interface CamRecord {
    cam: CamPlanCam
    systemDirectory: string
    encodings: PreparedPlan['encodings']
    process: CamProcess
    pid: number | null
    running: boolean
    titled: boolean
    startedAt: string
    exitCode: number | null
    error: string | null
    exited: Promise<void>
    log: CamLog
    logRead: Promise<void> | null
}

const MAIN_INI = 'UnrealTournament.ini'
const USER_INI = 'User.ini'
const UTF16_BOM = Buffer.from([0xff, 0xfe])
const MAX_LOG_READ_BYTES = 4 * 1024 * 1024
const DEFAULT_RETITLE_INTERVAL_MS = 2000
const DEFAULT_EXIT_TIMEOUT_MS = 5000

function decodeIni(bytes: Buffer): IniText {
    if (bytes.subarray(0, 2).equals(UTF16_BOM)) {
        return { text: bytes.subarray(2).toString('utf16le'), encoding: 'utf16le' }
    }
    return { text: bytes.toString('latin1'), encoding: 'latin1' }
}

function encodeIni(text: string, encoding: IniEncoding): Buffer {
    return encoding === 'utf16le'
        ? Buffer.concat([UTF16_BOM, Buffer.from(text, 'utf16le')])
        : Buffer.from(text, 'latin1')
}

function summarise(cam: CamPlanCam): CamPlanSummary {
    return {
        slot: cam.slot,
        team: cam.team,
        discordId: cam.discordId,
        server: cam.server,
        windowTitle: cam.windowTitle,
        url: cam.url,
        files: cam.files,
        command: cam.command,
    }
}

function freshLog(): CamLog {
    return { state: EMPTY_CAM_LOG_STATE, offset: 0, encoding: null }
}

export class CamLauncher {
    private readonly records = new Map<CamSlot, CamRecord>()
    private retitleTimer: ReturnType<typeof setInterval> | null = null
    private retitlePass: Promise<void> | null = null
    private windows: Promise<CamWindows> | null = null
    private retitleError: string | null = null
    private pending: Promise<unknown> = Promise.resolve()

    constructor(private readonly options: CamLauncherOptions) {}

    async plan(request: CamRequest): Promise<CamPlanResponse> {
        const prepared = await this.preparePlan(request)
        if (!prepared.ok) return prepared
        return { ok: true, cams: prepared.plan.cams.map(summarise) }
    }

    launch(request: CamRequest): Promise<CamActionResponse> {
        return this.exclusive(() => this.launchCams(request))
    }

    restart(slot: CamSlot, request?: CamRequest): Promise<CamActionResponse> {
        return this.exclusive(() => this.restartCam(slot, request))
    }

    stopAll(): Promise<CamToolStatus> {
        return this.exclusive(() => this.stopAllCams())
    }

    async retitle(): Promise<CamToolStatus> {
        await this.runRetitlePass()
        this.syncRetitleLoop()
        return this.status()
    }

    async status(): Promise<CamToolStatus> {
        const cams = await Promise.all(CAM_SLOTS.map(slot => this.camStatus(slot)))
        return {
            supported: this.options.supported,
            retitle: { available: this.retitleError === null, error: this.retitleError },
            cams,
        }
    }

    runningPids(): Set<number> {
        const pids = new Set<number>()
        for (const record of this.records.values()) {
            if (record.running && record.pid !== null) pids.add(record.pid)
        }
        return pids
    }

    stopAllNow(): void {
        for (const record of this.records.values()) {
            if (record.running) record.process.kill()
        }
        this.stopRetitleLoop()
    }

    private exclusive<T>(run: () => Promise<T>): Promise<T> {
        const result = this.pending.then(run, run)
        this.pending = result.catch(() => undefined)
        return result
    }

    private async launchCams(request: CamRequest): Promise<CamActionResponse> {
        const prepared = await this.preparePlan(request)
        if (!prepared.ok) return prepared
        const { plan } = prepared
        if (!existsSync(plan.cams[0].command.executable)) {
            return { ok: false, errors: [{ code: 'missing-executable' }] }
        }

        await this.stopAllCams()
        const writeErrors: CamToolError[] = []
        for (const cam of plan.cams) {
            if (!(await this.writeCamFiles(cam, plan))) writeErrors.push({ code: 'write-failed', slot: cam.slot })
        }
        if (writeErrors.length > 0) return { ok: false, errors: writeErrors }

        for (const cam of plan.cams) this.startCam(cam, plan)
        this.options.logger.info('Launched stream cams', { pids: [...this.runningPids()] })
        await this.retitle()
        return { ok: true, status: await this.status() }
    }

    private async restartCam(slot: CamSlot, request?: CamRequest): Promise<CamActionResponse> {
        const current = this.records.get(slot)
        let cam: CamPlanCam
        let plan: CamFileTarget
        if (request) {
            const prepared = await this.preparePlan(request)
            if (!prepared.ok) return prepared
            cam = prepared.plan.cams.find(candidate => candidate.slot === slot) as CamPlanCam
            plan = prepared.plan
        } else if (current) {
            cam = current.cam
            plan = current
        } else {
            return { ok: false, errors: [{ code: 'not-launched', slot }] }
        }
        if (!existsSync(cam.command.executable)) {
            return { ok: false, errors: [{ code: 'missing-executable' }] }
        }

        await this.stopCam(slot)
        if (!(await this.writeCamFiles(cam, plan))) {
            return { ok: false, errors: [{ code: 'write-failed', slot }] }
        }
        this.startCam(cam, plan)
        this.options.logger.info('Restarted stream cam', { slot, pid: this.records.get(slot)?.pid })
        await this.retitle()
        return { ok: true, status: await this.status() }
    }

    private async stopAllCams(): Promise<CamToolStatus> {
        await Promise.all(CAM_SLOTS.map(slot => this.stopCam(slot)))
        this.stopRetitleLoop()
        return this.status()
    }

    private async preparePlan(request: CamRequest): Promise<{ ok: true; plan: PreparedPlan } | { ok: false; errors: CamToolError[] }> {
        if (!this.options.supported) return { ok: false, errors: [{ code: 'unsupported-platform' }] }
        const installPath = this.options.getInstallPath()
        if (!installPath) return { ok: false, errors: [{ code: 'no-install' }] }
        const systemDirectory = join(installPath, 'System')

        const errors: CamToolError[] = []
        const main = await this.readIni(systemDirectory, MAIN_INI)
        const user = await this.readIni(systemDirectory, USER_INI)
        if (!main) errors.push({ code: 'ini-unreadable', file: 'main' })
        if (!user) errors.push({ code: 'ini-unreadable', file: 'user' })
        if (!main || !user) return { ok: false, errors }

        const result = buildCamPlan({
            installPath,
            lineup: request.lineup,
            servers: request.servers,
            mainIni: main.text,
            userIni: user.text,
        })
        if (!result.ok) return { ok: false, errors: result.errors }
        return {
            ok: true,
            plan: {
                systemDirectory,
                cams: result.plan.cams,
                encodings: { main: main.encoding, user: user.encoding },
            },
        }
    }

    private async readIni(systemDirectory: string, name: string): Promise<IniText | null> {
        try {
            return decodeIni(await readFile(resolveWithin(systemDirectory, name)))
        } catch (error) {
            this.options.logger.warn(`Could not read ${name} for the cam plan`, error)
            return null
        }
    }

    private async writeCamFiles(cam: CamPlanCam, plan: CamFileTarget): Promise<boolean> {
        try {
            await writeFile(resolveWithin(plan.systemDirectory, cam.files.ini), encodeIni(cam.iniContent, plan.encodings.main))
            await writeFile(resolveWithin(plan.systemDirectory, cam.files.userIni), encodeIni(cam.userIniContent, plan.encodings.user))
            await rm(resolveWithin(plan.systemDirectory, cam.files.log), { force: true }).catch(error => {
                this.options.logger.warn(`Could not clear the old log of cam ${cam.slot}`, error)
            })
            return true
        } catch (error) {
            this.options.logger.error(`Could not write the files of cam ${cam.slot}`, error)
            return false
        }
    }

    private startCam(cam: CamPlanCam, plan: CamFileTarget): void {
        let markExited: () => void = () => {}
        const exited = new Promise<void>(resolve => {
            markExited = resolve
        })
        const now = this.options.now?.() ?? new Date()
        let process: CamProcess
        try {
            process = this.options.spawnCam(cam.command)
        } catch (error) {
            process = { pid: undefined, onExit: () => {}, onError: () => {}, kill: () => {} }
            markExited()
            this.options.logger.error(`Could not start cam ${cam.slot}`, error)
        }
        const record: CamRecord = {
            cam,
            systemDirectory: plan.systemDirectory,
            encodings: plan.encodings,
            process,
            pid: process.pid ?? null,
            running: process.pid !== undefined,
            titled: false,
            startedAt: now.toISOString(),
            exitCode: null,
            error: process.pid === undefined ? 'The cam did not start' : null,
            exited,
            log: freshLog(),
            logRead: null,
        }
        process.onExit(code => {
            record.running = false
            record.titled = false
            record.exitCode = code
            markExited()
        })
        process.onError(error => {
            record.running = false
            record.titled = false
            record.error = error.message
            markExited()
        })
        this.records.set(cam.slot, record)
    }

    private async stopCam(slot: CamSlot): Promise<void> {
        const record = this.records.get(slot)
        if (!record?.running) return
        record.process.kill()
        const timeoutMs = this.options.exitTimeoutMs ?? DEFAULT_EXIT_TIMEOUT_MS
        let timer: ReturnType<typeof setTimeout> | undefined
        await Promise.race([
            record.exited,
            new Promise<void>(resolve => {
                timer = setTimeout(resolve, timeoutMs)
            }),
        ])
        clearTimeout(timer)
        record.running = false
        record.titled = false
    }

    private loadWindows(): Promise<CamWindows> {
        this.windows ??= this.options.loadWindows()
        return this.windows
    }

    private runRetitlePass(): Promise<void> {
        this.retitlePass ??= this.retitleRunningCams().finally(() => {
            this.retitlePass = null
        })
        return this.retitlePass
    }

    private async retitleRunningCams(): Promise<void> {
        const running = [...this.records.values()].filter(record => record.running && record.pid !== null)
        if (running.length === 0) return
        let windows: CamWindows
        try {
            windows = await this.loadWindows()
        } catch (error) {
            if (this.retitleError === null) this.options.logger.error('Cam window titles are unavailable', error)
            this.retitleError = error instanceof Error ? error.message : String(error)
            return
        }
        try {
            const results = await windows.applyTitles(running.map(record => ({ pid: record.pid as number, title: record.cam.windowTitle })))
            for (const record of running) {
                if (record.running) record.titled = results.get(record.pid as number) ?? false
            }
        } catch (error) {
            this.options.logger.warn('Cam window retitle pass failed', error)
        }
    }

    private syncRetitleLoop(): void {
        if (this.runningPids().size === 0) {
            this.stopRetitleLoop()
            return
        }
        if (this.retitleTimer !== null) return
        this.retitleTimer = setInterval(() => {
            void this.runRetitlePass().then(() => this.syncRetitleLoop())
        }, this.options.retitleIntervalMs ?? DEFAULT_RETITLE_INTERVAL_MS)
    }

    private stopRetitleLoop(): void {
        if (this.retitleTimer === null) return
        clearInterval(this.retitleTimer)
        this.retitleTimer = null
    }

    private async camStatus(slot: CamSlot): Promise<CamStatus> {
        const record = this.records.get(slot)
        if (!record) {
            return {
                slot,
                windowTitle: CAM_WINDOW_TITLES[slot],
                running: false,
                pid: null,
                titled: false,
                server: null,
                target: null,
                plannedServer: null,
                startedAt: null,
                exitCode: null,
                error: null,
            }
        }
        await this.refreshLog(record)
        return {
            slot,
            windowTitle: record.cam.windowTitle,
            running: record.running,
            pid: record.pid,
            titled: record.running && record.titled,
            server: record.log.state.server,
            target: record.cam.discordId,
            plannedServer: record.cam.server,
            startedAt: record.startedAt,
            exitCode: record.exitCode,
            error: record.error,
        }
    }

    private refreshLog(record: CamRecord): Promise<void> {
        record.logRead ??= this.readLog(record).finally(() => {
            record.logRead = null
        })
        return record.logRead
    }

    private async readLog(record: CamRecord): Promise<void> {
        let path: string
        let size: number
        try {
            path = resolveWithin(record.systemDirectory, record.cam.files.log)
            size = (await stat(path)).size
        } catch {
            return
        }
        if (size < record.log.offset) record.log = freshLog()
        if (size === record.log.offset) return

        const handle = await open(path, 'r').catch(() => null)
        if (!handle) return
        try {
            if (record.log.encoding === null) {
                const head = Buffer.alloc(2)
                const { bytesRead } = await handle.read(head, 0, 2, 0)
                if (bytesRead < 2) return
                const utf16 = head.equals(UTF16_BOM)
                record.log.encoding = utf16 ? 'utf16le' : 'latin1'
                if (utf16) record.log.offset = 2
            }
            let start = record.log.offset
            if (size - start > MAX_LOG_READ_BYTES) {
                start = size - MAX_LOG_READ_BYTES
                if (record.log.encoding === 'utf16le' && start % 2 === 1) start += 1
                record.log.state = { ...record.log.state, remainder: '' }
            }
            let length = size - start
            if (record.log.encoding === 'utf16le') length -= length % 2
            if (length <= 0) return
            const bytes = Buffer.alloc(length)
            const { bytesRead } = await handle.read(bytes, 0, length, start)
            record.log.offset = start + bytesRead
            record.log.state = readCamLogChunk(record.log.state, bytes.subarray(0, bytesRead).toString(record.log.encoding))
        } finally {
            await handle.close()
        }
    }
}
