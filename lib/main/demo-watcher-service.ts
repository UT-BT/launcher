import chokidar, { FSWatcher } from 'chokidar'
import { join } from 'path'
import { loggingService } from '@/lib/main/logging-service'
import { getUt99InstallPath, getDemoWatcherConfig, getAuthConfig } from '@/lib/main/config'
import { readFile, rename, unlink, mkdir, access } from 'fs/promises'
import { existsSync } from 'fs'
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

            loggingService.info(`Starting demo watcher on: ${watchPattern}`, 'DemoWatcher')

            this.watcher = chokidar.watch(watchPattern, {
                persistent: true,
                ignoreInitial: true,
                depth: 0,
            })

            this.watcher
                .on('add', (path) => this.handleNewFile(path))
                .on('error', (error) => loggingService.error('Watcher error', 'DemoWatcher', error))

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

        loggingService.info(`New demo detected: ${filename}`, 'DemoWatcher')

        const parts = filename.split('__');
        const map = parts[0];
        const time = parts[1];
        const timeInSeconds = this.getTimeInSeconds(time);

        loggingService.debug(`Map: ${map}, Time: ${time} (${timeInSeconds} seconds)`, 'DemoWatcher')

        const config = getDemoWatcherConfig()
        let shouldUpload = false

        try {
            if (config.autoUpload === 'Personal Bests Only') {
                const auth = getAuthConfig()
                if (auth?.discordId) {
                    shouldUpload = await this.checkIsPB(map, timeInSeconds, auth.discordId)
                } else {
                    loggingService.warn('Cannot check PB: User not logged in', 'DemoWatcher')
                }
            } else if (config.autoUpload === 'World Records Only') {
                shouldUpload = await this.checkIsWR(map, timeInSeconds)
            }
        } catch (error) {
            loggingService.error('Failed to check PB/WR status', 'DemoWatcher', error)
        }

        if (shouldUpload) {
            const auth = getAuthConfig()
            if (!auth) {
                loggingService.warn('Cannot upload demo: User not logged in', 'DemoWatcher')
            } else {
                loggingService.info(`Uploading demo: ${filename}`, 'DemoWatcher')

                // Verify demo before uploading
                const btpogId = await this.extractBtpogId(filePath)
                if (!btpogId) {
                    loggingService.warn(`Ignoring demo ${filename}: No BTPog ID found`, 'DemoWatcher')
                    return
                }

                const isCertified = await this.checkIsCertified(btpogId)
                if (!isCertified) {
                    loggingService.info(`Ignoring demo ${filename}: Run is not certified (BTPog ID: ${btpogId})`, 'DemoWatcher')
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
                        const isLastAttempt = attempts === maxAttempts
                        const errorMessage = error.message || 'Unknown error'
                        const shouldRetry = errorMessage.includes('No matching cap found') || errorMessage.includes('Network Error')

                        if (!shouldRetry || isLastAttempt) {
                            loggingService.error(`Failed to upload demo ${filename}: ${errorMessage}`, 'DemoWatcher')
                            this.updateLogStatus(filename, 'failed', errorMessage)
                            break
                        }

                        const delay = attempts * 2000
                        loggingService.warn(`Upload failed for ${filename}, retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`, 'DemoWatcher')

                        await new Promise(resolve => setTimeout(resolve, delay))
                    }
                }

                if (!success) shouldUpload = false

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
    }

    private async checkIsPB(mapName: string, timeSeconds: number, discordId: string): Promise<boolean> {
        try {
            const endpoint = `/caps/leaderboard/map/${encodeURIComponent(mapName)}?user=${discordId}&unverified_limit=0&verified_limit=1&columns=cap_time_seconds`
            const response = await gatewayService.get<LeaderboardResponse>(endpoint)

            if (!response.success) {
                loggingService.warn('PB check failed: API returned success=false', 'DemoWatcher')
                return false
            }

            if (!response.data || response.data.length === 0) {
                loggingService.info(`PB check: No previous time found for ${mapName}. New PB!`, 'DemoWatcher')
                return true
            }

            const previousBest = response.data[0].cap_time_seconds
            const isPb = timeSeconds < previousBest

            loggingService.debug(`PB check: ${timeSeconds} < ${previousBest} = ${isPb}`, 'DemoWatcher')
            return isPb

        } catch (error) {
            loggingService.error('PB Check API error', 'DemoWatcher', error)
            return false
        }
    }

    private async checkIsWR(mapName: string, timeSeconds: number): Promise<boolean> {
        try {
            const endpoint = `/caps/leaderboard/map/${encodeURIComponent(mapName)}?unverified_limit=0&verified_limit=1&columns=cap_time_seconds`
            const response = await gatewayService.get<LeaderboardResponse>(endpoint)

            if (!response.success) {
                loggingService.warn('WR check failed: API returned success=false', 'DemoWatcher')
                return false
            }

            if (response.data.length === 0) {
                loggingService.info(`WR check: No previous time found for ${mapName}. New WR!`, 'DemoWatcher')
                return true
            }

            const currentWR = response.data[0].cap_time_seconds
            const isWr = timeSeconds < currentWR

            loggingService.debug(`WR check: ${timeSeconds} < ${currentWR} = ${isWr}`, 'DemoWatcher')
            return isWr

        } catch (error) {
            loggingService.error('WR Check API error', 'DemoWatcher', error)
            return false
        }
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
