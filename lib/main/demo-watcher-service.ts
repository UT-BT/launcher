import chokidar, { FSWatcher, type ChokidarOptions } from 'chokidar'
import { join } from 'path'
import { loggingService } from '@/lib/main/logging-service'
import { getUt99InstallPath, getDemoWatcherConfig, getAuthConfig } from '@/lib/main/config'
import { readFile, rename, unlink, mkdir, access } from 'fs/promises'
import { existsSync, type Stats } from 'fs'
import { gatewayService } from '@/lib/main/gateway-service'
import { uploadDemo } from '@/app/utils/api'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'

const execFilePromise = promisify(execFile)

type LeaderboardResponse = {
    data: Array<{
        cap_time_seconds: number
    }>
    success: boolean
}

type CapResponse = {
    data: Array<{
        cap_type: number
    }>
    success: boolean
}

export interface UploadLogEntry {
    filename: string
    status: 'success' | 'failed' | 'uploading'
    timestamp: string
    error?: string
    attempt?: number
    maxAttempts?: number
}


export class DemoWatcherService {
    private watcher: FSWatcher | null = null
    private systemPath: string | undefined
    private uploadLogs: UploadLogEntry[] = []
    private processingFiles = new Set<string>()

    private completed = new Map<string, { status: 'uploaded' | 'discarded' | 'rejected'; at: number }>()
    private deferred = new Map<string, number>()
    private lastAddAt = new Map<string, number>()
    private addCounts = new Map<string, number>()

    private static readonly COMPLETED_TTL_MS = 24 * 60 * 60 * 1000
    private static readonly COMPLETED_MAX = 500
    private static readonly DEFER_MS = 10 * 60 * 1000
    private static readonly ADD_DEBOUNCE_MS = 3000
    private static readonly LASTADD_TTL_MS = 60 * 1000

    constructor() {
        this.systemPath = undefined
    }

    public getUploadLogs(): UploadLogEntry[] {
        return this.uploadLogs
    }

    public addLogEntry(entry: UploadLogEntry) {
        this.uploadLogs.unshift(entry)
        if (this.uploadLogs.length > 50) {
            this.uploadLogs.pop()
        }
    }

    public updateLogStatus(filename: string, status: 'success' | 'failed', error?: string) {
        const entry = this.uploadLogs.find(e => e.filename === filename && e.status === 'uploading')
        if (entry) {
            entry.status = status
            entry.error = error
        }
    }

    public updateLogAttempt(filename: string, attempt: number, maxAttempts: number) {
        const entry = this.uploadLogs.find(e => e.filename === filename && e.status === 'uploading')
        if (entry) {
            entry.attempt = attempt
            entry.maxAttempts = maxAttempts
        }
    }


    private markCompleted(filename: string, status: 'uploaded' | 'discarded' | 'rejected') {
        this.completed.set(filename, { status, at: Date.now() })
        this.deferred.delete(filename)
    }

    private markDeferred(filename: string) {
        this.deferred.set(filename, Date.now() + DemoWatcherService.DEFER_MS)
    }

    private pruneMaps() {
        const now = Date.now()

        for (const [name, entry] of this.completed) {
            if (now - entry.at > DemoWatcherService.COMPLETED_TTL_MS) this.completed.delete(name)
        }
        if (this.completed.size > DemoWatcherService.COMPLETED_MAX) {
            const oldestFirst = [...this.completed.entries()].sort((a, b) => a[1].at - b[1].at)
            const excess = this.completed.size - DemoWatcherService.COMPLETED_MAX
            for (let i = 0; i < excess; i++) this.completed.delete(oldestFirst[i][0])
        }

        for (const [name, until] of this.deferred) {
            if (now >= until) this.deferred.delete(name)
        }
        for (const [name, at] of this.lastAddAt) {
            if (now - at > DemoWatcherService.LASTADD_TTL_MS) this.lastAddAt.delete(name)
        }
    }

    private classifyPath(p: string): { flaky: boolean; cloud?: string; placement?: string; drive: string } {
        const lower = p.toLowerCase()
        const result: { flaky: boolean; cloud?: string; placement?: string; drive: string } = {
            flaky: false,
            drive: p.slice(0, 2),
        }

        const oneDriveRoots = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial]
            .filter((v): v is string => !!v)
            .map((v) => v.toLowerCase())

        if (oneDriveRoots.some((root) => lower.startsWith(root)) || lower.includes('\\onedrive')) {
            result.cloud = 'OneDrive'
            result.flaky = true
        }
        if (lower.includes('\\desktop\\')) {
            result.placement = 'Desktop'
            result.flaky = true
        }
        return result
    }

    /** Diagnostics-only: log a raw chokidar event with file stats + a per-file add counter. */
    private logEvt(event: string, p: string, stats?: Stats) {
        const name = p.split(/[/\\]/).pop() || p
        let extra = ''
        if (event === 'add') {
            const count = (this.addCounts.get(name) ?? 0) + 1
            this.addCounts.set(name, count)
            extra += ` addCount=${count}`
        }
        if (stats) extra += ` size=${stats.size} mtimeMs=${Math.round(stats.mtimeMs)} ino=${stats.ino}`
        loggingService.debug(`evt=${event} ${name}${extra}`, 'DemoDiag')
    }

    public startWatching() {
        try {
            this.stopWatching()

            const installPath = getUt99InstallPath()
            if (!installPath) {
                loggingService.warn('UT99 Install Path not found. Demo watcher will not start.', 'DemoWatcher')
                return
            }

            this.systemPath = join(installPath, 'System')

            const watchPattern = join(this.systemPath, '.')

            const classification = this.classifyPath(this.systemPath)
            const diagnostics = process.env.UTBT_DEMO_DIAG === '1'

            loggingService.info(`Starting demo watcher on: ${watchPattern}`, 'DemoWatcher')

            const options: ChokidarOptions = {
                persistent: true,
                ignoreInitial: true,
                depth: 0,
                awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
            }

            if (classification.flaky) {
                options.usePolling = true
                options.interval = 1000
                options.binaryInterval = 1000
            }

            if (diagnostics) {
                options.alwaysStat = true
            }

            loggingService.info(
                `Demo watcher mode: polling=${!!options.usePolling}, awaitWriteFinish=on, diagnostics=${diagnostics}`,
                'DemoWatcher',
                classification
            )

            this.watcher = chokidar.watch(watchPattern, options)

            this.watcher
                .on('add', (path, stats) => {
                    if (diagnostics) this.logEvt('add', path, stats)
                    this.handleNewFile(path)
                })
                .on('error', (error) => loggingService.error('Watcher error', 'DemoWatcher', error))

            if (diagnostics) {
                this.watcher
                    .on('change', (path, stats) => this.logEvt('change', path, stats))
                    .on('unlink', (path) => this.logEvt('unlink', path))
                    .on('addDir', (path) => this.logEvt('addDir', path))
                    .on('unlinkDir', (path) => this.logEvt('unlinkDir', path))
                    .on('raw', (event, path, details) =>
                        loggingService.debug(`raw=${event} ${path} ${JSON.stringify(details)}`, 'DemoDiag'))
                    .on('ready', () => loggingService.info('Watcher ready', 'DemoDiag'))
            }

        } catch (error) {
            loggingService.error('Failed to start demo watcher', 'DemoWatcher', error)
        }
    }

    public stopWatching() {
        if (this.watcher) {
            this.watcher.close()
            this.watcher = null
            loggingService.info('Demo watcher stopped', 'DemoWatcher')
        }
    }

    public restart() {
        loggingService.info('Restarting demo watcher...', 'DemoWatcher')
        this.stopWatching()
        this.startWatching()
    }

    private async handleNewFile(filePath: string) {
        const DEMO_REGEX = /^CTF-BT(?:(?!__).)+__(?:\d{2}m_\d{2}s_\d{3}ms|\d{3}h_\d{2}m_\d{2}s_\d{3}ms)__\d{4}-\d{2}-\d{2}-\d{2}h\d{2}m_Run\d+\.dem$/;
        const filename = filePath.split(/[/\\]/).pop() || filePath

        if (!DEMO_REGEX.test(filename)) {
            loggingService.debug(`Ignoring non-demo file: ${filename}`, 'DemoWatcher')
            return
        }

        this.pruneMaps()

        const done = this.completed.get(filename)
        if (done) {
            loggingService.debug(`Skipping ${filename}: already ${done.status}`, 'DemoWatcher')
            return
        }

        const deferUntil = this.deferred.get(filename)
        if (deferUntil && Date.now() < deferUntil) {
            loggingService.debug(`Deferring re-check of ${filename} (backoff active)`, 'DemoWatcher')
            return
        }

        const lastAdd = this.lastAddAt.get(filename) ?? 0
        const nowMs = Date.now()
        if (nowMs - lastAdd < DemoWatcherService.ADD_DEBOUNCE_MS) {
            loggingService.debug(`Debounced duplicate add for ${filename}`, 'DemoWatcher')
            return
        }
        this.lastAddAt.set(filename, nowMs)

        loggingService.info(`New demo detected: ${filename}`, 'DemoWatcher')

        if (this.processingFiles.has(filename)) {
            loggingService.debug(`File ${filename} is already being processed, skipping.`, 'DemoWatcher')
            return
        }

        this.processingFiles.add(filename)

        try {
            const parts = filename.split('__');
            const map = parts[0];
            const time = parts[1];
            const timeInSeconds = this.getTimeInSeconds(time);

            loggingService.debug(`Map: ${map}, Time: ${time} (${timeInSeconds} seconds)`, 'DemoWatcher')

            const config = getDemoWatcherConfig()
            let shouldUpload = false
            let shouldDiscard = false

            try {
                if (config.autoUpload === 'Personal Bests Only') {
                    const auth = getAuthConfig()
                    if (auth?.discordId) {
                        shouldUpload = await this.checkIsPB(map, timeInSeconds, auth.discordId)
                        shouldDiscard = !shouldUpload
                    } else {
                        loggingService.warn('Cannot check PB: User not logged in', 'DemoWatcher')
                        this.markDeferred(filename)
                        return
                    }
                } else if (config.autoUpload === 'World Records Only') {
                    shouldUpload = await this.checkIsWR(map, timeInSeconds)
                    shouldDiscard = !shouldUpload
                }
            } catch (error: any) {
                // PB/WR lookup failed (network/API error). Do NOT discard a potentially
                // good demo on a transient failure — defer and retry on a later event.
                loggingService.warn(`PB/WR check failed for ${filename}; will retry later: ${error?.message ?? error}`, 'DemoWatcher')
                this.markDeferred(filename)
                return
            }

            if (shouldDiscard) {
                try {
                    if (config.discardDemoAction === 'Move to Folder') {
                        if (this.systemPath) {
                            const discardedDir = join(this.systemPath, 'Discarded')
                            try {
                                await access(discardedDir)
                            } catch {
                                await mkdir(discardedDir)
                            }
                            const newPath = join(discardedDir, filename)
                            await rename(filePath, newPath)
                            loggingService.info(`Moved demo to: ${newPath}`, 'DemoWatcher')
                        }
                    } else if (config.discardDemoAction == 'Delete') {
                        await unlink(filePath)
                        loggingService.info(`Deleted demo: ${filename}`, 'DemoWatcher')
                    }
                } catch (error) {
                    loggingService.error('Failed to perform discard action', 'DemoWatcher', error)
                }
                // A slower-than-best run will never become a PB/WR — never reprocess it.
                this.markCompleted(filename, 'discarded')
            }

            if (shouldUpload) {
                const auth = getAuthConfig()
                if (!auth) {
                    loggingService.warn('Cannot upload demo: User not logged in', 'DemoWatcher')
                    this.markDeferred(filename)
                    return
                } else {
                    loggingService.info(`Uploading demo: ${filename}`, 'DemoWatcher')

                    // Verify demo before uploading
                    const btpogId = await this.extractBtpogId(filePath)
                    if (!btpogId) {
                        loggingService.warn(`Ignoring demo ${filename}: No BTPog ID found`, 'DemoWatcher')
                        this.markCompleted(filename, 'rejected')
                        return
                    }

                    const isCertified = await this.checkIsCertified(btpogId)
                    if (!isCertified) {
                        loggingService.info(`Ignoring demo ${filename}: Run is not certified (BTPog ID: ${btpogId})`, 'DemoWatcher')
                        this.markCompleted(filename, 'rejected')
                        return
                    }

                    loggingService.info(`Verified demo ${filename} (BTPog ID: ${btpogId}). Proceeding with upload.`, 'DemoWatcher')

                    this.addLogEntry({
                        filename,
                        status: 'uploading',
                        timestamp: new Date().toISOString(),
                        attempt: 1,
                        maxAttempts: 5
                    })

                    let attempts = 0
                    const maxAttempts = 5
                    let success = false

                    while (attempts < maxAttempts && !success) {
                        attempts++
                        if (attempts > 1) {
                            this.updateLogAttempt(filename, attempts, maxAttempts)
                        }

                        try {
                            const buffer = await readFile(filePath)
                            const blob = new Blob([buffer])

                            await uploadDemo(blob, filename, auth.accessToken)
                            success = true

                            loggingService.info(`Demo uploaded successfully: ${filename}`, 'DemoWatcher')
                            this.updateLogStatus(filename, 'success')
                        } catch (error: any) {
                            const errorMessage = error.message || 'Unknown error'
                            const lower = errorMessage.toLowerCase()

                            if (lower.includes('already verified') || lower.includes('already exists')) {
                                loggingService.info(`Demo ${filename} already on server (${errorMessage}); treating as success`, 'DemoWatcher')
                                success = true
                                this.updateLogStatus(filename, 'success')
                                break
                            }

                            const isLastAttempt = attempts === maxAttempts

                            const isFileSystemError = ['EBUSY', 'EPERM', 'EACCES', 'EIO'].includes(error.code)
                            const isCloudError = lower.includes('cloud') || (typeof error.code === 'string' && error.code.includes('CLOUD'))
                            const shouldRetry = isFileSystemError || isCloudError || lower.includes('no matching cap found') || lower.includes('network error')

                            if (!shouldRetry || isLastAttempt) {
                                loggingService.error(`Failed to upload demo ${filename}: ${errorMessage}`, 'DemoWatcher')
                                this.updateLogStatus(filename, 'failed', errorMessage)
                                break
                            }

                            const delay = attempts * 2000
                            loggingService.warn(`Upload failed for ${filename} (${error.code || 'API Error'}), retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`, 'DemoWatcher')

                            await new Promise(resolve => setTimeout(resolve, delay))
                        }
                    }

                    if (success) {
                        this.markCompleted(filename, 'uploaded')
                    } else {
                        shouldUpload = false
                        this.markDeferred(filename)
                    }

                }

                if (shouldUpload) {
                    try {
                        if (config.postUploadAction === 'Move to Folder') {
                            if (this.systemPath) {
                                const uploadedDir = join(this.systemPath, 'Uploaded')
                                try {
                                    await access(uploadedDir)
                                } catch {
                                    await mkdir(uploadedDir)
                                }
                                const newPath = join(uploadedDir, filename)
                                await rename(filePath, newPath)
                                loggingService.info(`Moved demo to: ${newPath}`, 'DemoWatcher')
                            }
                        } else if (config.postUploadAction === 'Delete') {
                            await unlink(filePath)
                            loggingService.info(`Deleted demo: ${filename}`, 'DemoWatcher')
                        }
                    } catch (error) {
                        loggingService.error('Failed to perform post-upload action', 'DemoWatcher', error)
                    }
                }
            }
        } finally {
            this.processingFiles.delete(filename)
        }
    }

    private async checkIsPB(mapName: string, timeSeconds: number, discordId: string): Promise<boolean> {
        const endpoint = `/caps/leaderboard/map/${encodeURIComponent(mapName)}?user=${discordId}&unverified_limit=0&verified_limit=1&columns=cap_time_seconds`
        const response = await gatewayService.get<LeaderboardResponse>(endpoint)

        if (!response.success) {
            throw new Error('PB check: API returned success=false')
        }

        if (!response.data || response.data.length === 0) {
            loggingService.info(`PB check: No previous time found for ${mapName}. New PB!`, 'DemoWatcher')
            return true
        }

        const previousBest = response.data[0].cap_time_seconds
        const isPb = timeSeconds < previousBest

        loggingService.debug(`PB check: ${timeSeconds} < ${previousBest} = ${isPb}`, 'DemoWatcher')
        return isPb
    }

    private async checkIsWR(mapName: string, timeSeconds: number): Promise<boolean> {
        const endpoint = `/caps/leaderboard/map/${encodeURIComponent(mapName)}?unverified_limit=0&verified_limit=1&columns=cap_time_seconds`
        const response = await gatewayService.get<LeaderboardResponse>(endpoint)

        if (!response.success) {
            throw new Error('WR check: API returned success=false')
        }

        if (response.data.length === 0) {
            loggingService.info(`WR check: No previous time found for ${mapName}. New WR!`, 'DemoWatcher')
            return true
        }

        const currentWR = response.data[0].cap_time_seconds
        const isWr = timeSeconds < currentWR

        loggingService.debug(`WR check: ${timeSeconds} < ${currentWR} = ${isWr}`, 'DemoWatcher')
        return isWr
    }

    private async checkIsCertified(btpogId: string): Promise<boolean> {
        try {
            const endpoint = `/caps?btpog_ids=${btpogId}&columns=cap_type`
            const response = await gatewayService.get<CapResponse>(endpoint)

            if (!response.success) {
                loggingService.warn(`Certification check failed for ${btpogId}: API returned success=false`, 'DemoWatcher')
                return false
            }

            if (!response.data || response.data.length === 0) {
                loggingService.warn(`Certification check failed for ${btpogId}: No cap data found`, 'DemoWatcher')
                return false
            }

            const isCertified = response.data.some((cap) => cap.cap_type === 2)
            return isCertified
        } catch (error) {
            loggingService.error(`Certification check API error for ${btpogId}`, 'DemoWatcher', error)
            return false
        }
    }

    private getTimeInSeconds(time: string): number {
        const multipliers = [0.001, 1, 60, 3600];
        const result = time.split('_')
            .reverse()
            .reduce((total, part, index) => {
                const value = parseInt(part, 10) || 0;
                const multiplier = multipliers[index] || 0;
                return total + (value * multiplier);
            }, 0);
        return parseFloat(result.toFixed(3));
    }

    public async extractBtpogId(demoFp: string): Promise<string> {
        // Only ever hand an existing .dem file to the strings binary
        if (!demoFp.toLowerCase().endsWith('.dem') || !existsSync(demoFp)) {
            loggingService.warn('Rejected non-demo path for extractBtpogId', 'DemoWatcher')
            return ''
        }

        let scriptPath: string
        if (app.isPackaged) {
            scriptPath = join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', 'ut99-strings.exe')
        } else {
            scriptPath = join(app.getAppPath(), 'resources', 'bin', 'ut99-strings.exe')
        }

        if (!existsSync(scriptPath)) {
            loggingService.error(`Binary tool not found at ${scriptPath}`, 'DemoWatcher')
            return ''
        }

        try {
            const { stdout } = await execFilePromise(scriptPath, ['--length', '40', demoFp])
            const idCount: Record<string, number> = {}

            if (stdout) {
                const lines = stdout.split('\n')
                for (const line of lines) {
                    if (line.includes('BTPOG')) {
                        const parts = line.split(':')
                        if (parts.length >= 2) {
                            const id = parts[1].trim()
                            idCount[id] = (idCount[id] || 0) + 1
                        }
                    }
                }
            }

            const ids = Object.keys(idCount)
            if (ids.length > 0) {
                const maximum = ids.reduce((a, b) => idCount[a] > idCount[b] ? a : b)
                if (idCount[maximum] < 2) {
                    return ''
                }
                return maximum
            }
        } catch (error) {
            loggingService.error('Error running strings tool', 'DemoWatcher', error)
        }

        return ''
    }
}

export const demoWatcherService = new DemoWatcherService()
