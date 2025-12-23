import chokidar, { FSWatcher } from 'chokidar'
import { join, basename } from 'path'
import { loggingService } from '@/lib/main/logging-service'
import { getUt99InstallPath, getDemoWatcherConfig, getAuthConfig } from '@/lib/main/config'
import { renameSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { gatewayService } from '@/lib/main/gateway-service'
import { uploadDemo } from '@/app/utils/api'

type LeaderboardResponse = {
    data: Array<{
        cap_time_seconds: number
    }>
    success: boolean
}

export class DemoWatcherService {
    private watcher: FSWatcher | null = null
    private systemPath: string | undefined

    constructor() {
        this.systemPath = undefined
    }

    public startWatching() {
        try {
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
            if (config.autoUpload === 'All Runs') {
                shouldUpload = true
            } else if (config.autoUpload === 'Personal Bests Only') {
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
                try {
                    const { readFileSync } = await import('fs')

                    const buffer = readFileSync(filePath)
                    const blob = new Blob([buffer])

                    await uploadDemo(blob, filename, auth.accessToken)

                    loggingService.info(`Demo uploaded successfully: ${filename}`, 'DemoWatcher')
                } catch (error: any) {
                    loggingService.error(`Failed to upload demo: ${error.message}`, 'DemoWatcher')
                    shouldUpload = false
                }
            }

            if (shouldUpload) {
                try {
                    if (config.postUploadAction === 'Move to Folder') {
                        if (this.systemPath) {
                            const uploadedDir = join(this.systemPath, 'Uploaded')
                            if (!existsSync(uploadedDir)) {
                                mkdirSync(uploadedDir)
                            }
                            const newPath = join(uploadedDir, filename)
                            renameSync(filePath, newPath)
                            loggingService.info(`Moved demo to: ${newPath}`, 'DemoWatcher')
                        }
                    } else if (config.postUploadAction === 'Delete') {
                        unlinkSync(filePath)
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

            loggingService.info(`PB check: ${timeSeconds} < ${previousBest} = ${isPb}`, 'DemoWatcher')
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

            loggingService.info(`WR check: ${timeSeconds} < ${currentWR} = ${isWr}`, 'DemoWatcher')
            return isWr

        } catch (error) {
            loggingService.error('WR Check API error', 'DemoWatcher', error)
            return false
        }
    }

    private getTimeInSeconds(time: string): number {
        const multipliers = [0.001, 1, 60, 3600];
        return time.split('_')
            .reverse()
            .reduce((total, part, index) => {
                const value = parseInt(part, 10) || 0;
                const multiplier = multipliers[index] || 0;
                return total + (value * multiplier);
            }, 0);
    }
}

export const demoWatcherService = new DemoWatcherService()
