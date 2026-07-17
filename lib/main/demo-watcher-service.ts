import chokidar, { FSWatcher, type ChokidarOptions } from 'chokidar'
import { join } from 'path'
import { loggingService } from '@/lib/main/logging-service'
import { getUt99InstallPath, getDemoWatcherConfig, getAuthConfig, type DemoWatcherConfig } from '@/lib/main/config'
import { readFile, writeFile, rename, unlink, mkdir, access, readdir, stat } from 'fs/promises'
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
        team_run_id?: string | null
    }>
    success: boolean
}

type RetryJob = {
    filePath: string
    filename: string
    fingerprint: string
    btpogId?: string
    firstSeen: number
    nextAttempt: number
    attempts: number
    lastError?: string
}

type WatcherState = {
    version: 1
    jobs: RetryJob[]
    completed: Array<{ fingerprint: string; status: 'uploaded' | 'discarded' | 'rejected'; at: number }>
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
    private retryJobs = new Map<string, RetryJob>()
    private activeFingerprints = new Map<string, string>()
    private lastAddAt = new Map<string, number>()
    private addCounts = new Map<string, number>()
    private retryTimer: ReturnType<typeof setTimeout> | null = null
    private statePath: string | null = null
    private persistenceReady: Promise<void> | null = null
    private stateWrite: Promise<void> = Promise.resolve()

    private static readonly COMPLETED_TTL_MS = 24 * 60 * 60 * 1000
    private static readonly RETRY_INITIAL_MS = 5000
    private static readonly RETRY_MAX_MS = 10 * 60 * 1000
    private static readonly RETRY_LIFETIME_MS = 24 * 60 * 60 * 1000
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
        const fingerprint = this.activeFingerprints.get(filename)
        if (fingerprint) this.completed.set(fingerprint, { status, at: Date.now() })
        this.retryJobs.delete(filename)
        void this.persistState()
    }

    private queueRetry(filePath: string, filename: string, error: string, btpogId?: string) {
        const now = Date.now()
        const previous = this.retryJobs.get(filename)
        const firstSeen = previous?.firstSeen ?? now
        if (now - firstSeen >= DemoWatcherService.RETRY_LIFETIME_MS) {
            this.retryJobs.delete(filename)
            loggingService.error(`Stopped retrying ${filename} after 24 hours; the demo was left untouched. Last error: ${error}`, 'DemoWatcher')
            this.addLogEntry({
                filename,
                status: 'failed',
                timestamp: new Date().toISOString(),
                error: `Retry period expired; source retained: ${error}`,
            })
            void this.persistState()
            return
        }
        const attempts = (previous?.attempts ?? 0) + 1
        const delay = Math.min(
            DemoWatcherService.RETRY_INITIAL_MS * Math.pow(2, Math.min(attempts - 1, 16)),
            DemoWatcherService.RETRY_MAX_MS,
        )
        const fingerprint = this.activeFingerprints.get(filename) ?? previous?.fingerprint ?? filename
        this.retryJobs.set(filename, {
            filePath,
            filename,
            fingerprint,
            btpogId: btpogId ?? previous?.btpogId,
            firstSeen,
            nextAttempt: now + delay,
            attempts,
            lastError: error,
        })
        loggingService.info(`Will retry ${filename} in ${Math.ceil(delay / 1000)}s (attempt ${attempts})`, 'DemoWatcher')
        void this.persistState()
        this.scheduleRetries()
    }

    private pruneMaps() {
        const now = Date.now()

        for (const [name, entry] of this.completed) {
            if (now - entry.at > DemoWatcherService.COMPLETED_TTL_MS) this.completed.delete(name)
        }
        for (const [name, at] of this.lastAddAt) {
            if (now - at > DemoWatcherService.LASTADD_TTL_MS) this.lastAddAt.delete(name)
        }
    }

    private async fingerprint(filePath: string): Promise<string> {
        const info = await stat(filePath)
        return `${filePath.toLowerCase()}|${info.size}|${Math.round(info.mtimeMs)}`
    }

    private async initialisePersistence(): Promise<void> {
        this.statePath = join(app.getPath('userData'), 'demo-watcher-state.json')
        try {
            const raw = JSON.parse(await readFile(this.statePath, 'utf8')) as WatcherState
            if (raw.version === 1) {
                const now = Date.now()
                for (const entry of raw.completed ?? []) {
                    if (now - entry.at < DemoWatcherService.COMPLETED_TTL_MS) {
                        this.completed.set(entry.fingerprint, { status: entry.status, at: entry.at })
                    }
                }
                for (const job of raw.jobs ?? []) {
                    if (now - job.firstSeen < DemoWatcherService.RETRY_LIFETIME_MS) this.retryJobs.set(job.filename, job)
                }
            }
        } catch (error: any) {
            if (error?.code !== 'ENOENT') loggingService.warn('Could not restore demo retry state; startup recovery will rescan recent demos.', 'DemoWatcher', error)
        }
        this.scheduleRetries()
    }

    private async persistState(): Promise<void> {
        if (this.persistenceReady) await this.persistenceReady
        if (!this.statePath) return
        this.pruneMaps()
        const state: WatcherState = {
            version: 1,
            jobs: [...this.retryJobs.values()],
            completed: [...this.completed.entries()].map(([fingerprint, entry]) => ({ fingerprint, ...entry })),
        }
        const temporary = `${this.statePath}.tmp`
        const write = async () => {
            try {
                await writeFile(temporary, JSON.stringify(state), 'utf8')
                await rename(temporary, this.statePath as string)
            } catch (error) {
                loggingService.warn('Failed to persist demo retry state', 'DemoWatcher', error)
            }
        }
        this.stateWrite = this.stateWrite.then(write, write)
        await this.stateWrite
    }

    private scheduleRetries() {
        if (this.retryTimer) clearTimeout(this.retryTimer)
        if (this.retryJobs.size === 0) return
        const next = Math.min(...[...this.retryJobs.values()].map(job => job.nextAttempt))
        this.retryTimer = setTimeout(() => void this.processDueRetries(), Math.max(250, next - Date.now()))
    }

    private async processDueRetries() {
        this.retryTimer = null
        const now = Date.now()
        const due = [...this.retryJobs.values()].filter(job => job.nextAttempt <= now)
        for (const job of due) {
            if (!existsSync(job.filePath)) {
                this.retryJobs.delete(job.filename)
                continue
            }
            await this.handleNewFile(job.filePath, true)
        }
        await this.persistState()
        this.scheduleRetries()
    }

    private async recoverRecentDemos() {
        if (!this.systemPath) return
        try {
            const cutoff = Date.now() - DemoWatcherService.RETRY_LIFETIME_MS
            const names = await readdir(this.systemPath)
            for (const name of names) {
                if (!name.toLowerCase().endsWith('.dem')) continue
                const filePath = join(this.systemPath, name)
                const info = await stat(filePath)
                if (info.isFile() && info.mtimeMs >= cutoff) await this.handleNewFile(filePath, true)
            }
        } catch (error) {
            loggingService.warn('Failed to scan recent demos during startup recovery', 'DemoWatcher', error)
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

            if (!this.persistenceReady) this.persistenceReady = this.initialisePersistence()

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

            void this.persistenceReady.then(() => {
                this.scheduleRetries()
                return this.recoverRecentDemos()
            })

        } catch (error) {
            loggingService.error('Failed to start demo watcher', 'DemoWatcher', error)
        }
    }

    public stopWatching() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer)
            this.retryTimer = null
        }
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

    private async handleNewFile(filePath: string, force = false) {
        const DEMO_REGEX = /^CTF-BT(?:(?!__).)+__(?:\d{2}m_\d{2}s_\d{3}ms|\d{3}h_\d{2}m_\d{2}s_\d{3}ms)__\d{4}-\d{2}-\d{2}-\d{2}h\d{2}m_Run\d+\.dem$/;
        const filename = filePath.split(/[/\\]/).pop() || filePath

        if (!DEMO_REGEX.test(filename)) {
            loggingService.debug(`Ignoring non-demo file: ${filename}`, 'DemoWatcher')
            return
        }

        this.pruneMaps()

        let fingerprint: string
        try {
            fingerprint = await this.fingerprint(filePath)
            this.activeFingerprints.set(filename, fingerprint)
        } catch (error: any) {
            loggingService.warn(`Could not inspect ${filename}: ${error?.message ?? error}`, 'DemoWatcher')
            return
        }

        const done = this.completed.get(fingerprint)
        if (done) {
            loggingService.debug(`Skipping ${filename}: already ${done.status}`, 'DemoWatcher')
            return
        }

        const queued = this.retryJobs.get(filename)
        if (!force && queued) {
            loggingService.debug(`Skipping ${filename}: durable retry is already scheduled`, 'DemoWatcher')
            return
        }

        const lastAdd = this.lastAddAt.get(filename) ?? 0
        const nowMs = Date.now()
        if (!force && nowMs - lastAdd < DemoWatcherService.ADD_DEBOUNCE_MS) {
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
            const parts = filename.split('__')
            const map = parts[0]
            const time = parts[1]
            const timeInSeconds = this.getTimeInSeconds(time)

            loggingService.debug(`Map: ${map}, Time: ${time} (${timeInSeconds} seconds)`, 'DemoWatcher')

            const config = getDemoWatcherConfig()

            if (config.autoUpload === 'Never') {
                const paused = this.retryJobs.get(filename)
                if (paused) {
                    if (Date.now() - paused.firstSeen >= DemoWatcherService.RETRY_LIFETIME_MS) {
                        this.retryJobs.delete(filename)
                    } else {
                        paused.nextAttempt = Date.now() + DemoWatcherService.RETRY_MAX_MS
                    }
                    void this.persistState()
                    this.scheduleRetries()
                }
                return
            }

            const existingJob = this.retryJobs.get(filename)
            const btpogId = existingJob?.btpogId || await this.extractBtpogId(filePath)
            if (!btpogId) {
                this.queueRetry(filePath, filename, 'No BTPog ID found in the demo yet')
                return
            }

            try {
                const cap = await this.checkCap(btpogId)
                if (!cap.found) {
                    this.queueRetry(filePath, filename, 'No matching cap found yet', btpogId)
                } else if (!cap.certified) {
                    loggingService.info(`Leaving ${filename} untouched: its cap is not certified (BTPog ID: ${btpogId})`, 'DemoWatcher')
                    this.markCompleted(filename, 'rejected')
                } else if (cap.teamRunId) {
                    await this.processTeamDemo(filePath, filename, config, btpogId)
                } else {
                    await this.processSoloDemo(filePath, filename, map, timeInSeconds, config, btpogId)
                }
            } catch (error: any) {
                this.queueRetry(filePath, filename, `Cap lookup failed: ${error?.message ?? error}`, btpogId)
            }
        } finally {
            this.processingFiles.delete(filename)
        }
    }

    private async processSoloDemo(
        filePath: string,
        filename: string,
        map: string,
        timeInSeconds: number,
        config: DemoWatcherConfig,
        btpogId?: string,
    ): Promise<void> {
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
                    this.queueRetry(filePath, filename, 'User is not logged in', btpogId)
                    return
                }
            } else if (config.autoUpload === 'World Records Only') {
                shouldUpload = await this.checkIsWR(map, timeInSeconds)
                shouldDiscard = !shouldUpload
            }
        } catch (error: any) {
            loggingService.warn(`PB/WR check failed for ${filename}; will retry later: ${error?.message ?? error}`, 'DemoWatcher')
            this.queueRetry(filePath, filename, `PB/WR check failed: ${error?.message ?? error}`, btpogId)
            return
        }

        if (shouldDiscard) {
            await this.discardDemo(filePath, filename, config)
        }

        if (shouldUpload) {
            await this.performUpload(filePath, filename, config, btpogId)
        }
    }

    private async processTeamDemo(
        filePath: string,
        filename: string,
        config: DemoWatcherConfig,
        btpogId: string,
    ): Promise<void> {
        // Team verification is atomic: every certified member demo is evidence, so PB/WR
        // preferences do not gate it and we do not wait for the aggregate to complete.
        await this.performUpload(filePath, filename, config, btpogId)
    }

    private async discardDemo(filePath: string, filename: string, config: DemoWatcherConfig): Promise<void> {
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
        this.markCompleted(filename, 'discarded')
    }

    private async performUpload(
        filePath: string,
        filename: string,
        config: DemoWatcherConfig,
        verifiedBtpogId?: string,
    ): Promise<void> {
        const auth = getAuthConfig()
        if (!auth) {
            loggingService.warn('Cannot upload demo: User not logged in', 'DemoWatcher')
            this.queueRetry(filePath, filename, 'User is not logged in', verifiedBtpogId)
            return
        }

        loggingService.info(`Uploading demo: ${filename}`, 'DemoWatcher')

        if (verifiedBtpogId) {
            loggingService.info(`Verified team run demo ${filename} (BTPog ID: ${verifiedBtpogId}). Proceeding with upload.`, 'DemoWatcher')
        } else {
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
        }

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

        if (!success) {
            this.queueRetry(filePath, filename, 'Upload failed after local retries', verifiedBtpogId)
            return
        }

        this.markCompleted(filename, 'uploaded')

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

    private async checkCap(btpogId: string): Promise<{ found: boolean; certified: boolean; teamRunId: string | null }> {
        const endpoint = `/caps?btpog_ids=${btpogId}&columns=cap_type,team_run_id`
        const response = await gatewayService.get<CapResponse>(endpoint)

        if (!response.success) {
            throw new Error('Team certification check: API returned success=false')
        }

        if (!response.data || response.data.length === 0) {
            return { found: false, certified: false, teamRunId: null }
        }

        const certifiedCap = response.data.find((cap) => cap.cap_type === 2)
        return {
            found: true,
            certified: certifiedCap != null,
            teamRunId: certifiedCap?.team_run_id || null,
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
