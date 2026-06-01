import { BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { gatewayService } from '@/lib/main/gateway-service'
import { loggingService } from '@/lib/main/logging-service'
import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { gameService } from '@/lib/main/game-service'

export const registerGameHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering game IPC handlers', 'MainProcess')

    handle('launchGame', async (ip: string, port: number) => {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('UT99 install path not found')
        }

        const exePath = join(installPath, 'System', 'UnrealTournament.exe')
        if (!existsSync(exePath)) {
            throw new Error('UnrealTournament.exe not found')
        }

        const url = `unreal://${ip}:${port}`

        loggingService.info(`Launching game with URL: ${url}`, 'GameHandler')

        const gameProcess = spawn(exePath, [url], {
            cwd: join(installPath, 'System'),
            detached: true,
            stdio: 'ignore',
        })

        gameProcess.unref()
    })

    handle('launchGameStandalone', async () => {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('UT99 install path not found')
        }

        const exePath = join(installPath, 'System', 'UnrealTournament.exe')
        if (!existsSync(exePath)) {
            throw new Error('UnrealTournament.exe not found')
        }

        loggingService.info('Launching game standalone', 'GameHandler')

        const gameProcess = spawn(exePath, [], {
            cwd: join(installPath, 'System'),
            detached: true,
            stdio: 'ignore',
        })

        gameProcess.unref()
    })

    handle('fetchServers', async () => {
        try {
            const servers = await gatewayService.get('/server-info')
            return servers
        } catch (error) {
            loggingService.error('Failed to fetch servers', 'GameHandler', error)
            throw error
        }
    })

    handle('fetchPatrons', async () => {
        try {
            const patrons = await gatewayService.get('/patreon')
            return patrons
        } catch (error) {
            loggingService.error('Failed to fetch patrons', 'GameHandler', error)
            throw error
        }
    })

    handle('validateCurrentInstallation', async () => {
        return await gameService.validateCurrentInstallation()
    })

    handle('isGameRunning', async () => {
        return await gameService.isGameRunning()
    })

    handle('pingServer', async (ip: string) => {
        return new Promise((resolve) => {
            // Validate IP address format to prevent command injection
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
            if (!ipRegex.test(ip)) {
                loggingService.warn(`Invalid IP address format: ${ip}`, 'GameHandler')
                resolve(999)
                return
            }

            const platform = process.platform
            const args = platform === 'win32'
                ? ['-n', '1', '-w', '1000', ip]
                : ['-c', '1', '-W', '1', ip]

            const child = spawn('ping', args)
            let output = ''

            child.stdout.on('data', (data) => {
                output += data.toString()
            })

            child.on('error', (err) => {
                loggingService.error(`Ping failed for ${ip}`, 'GameHandler', err)
                resolve(999)
            })

            child.on('close', (code) => {
                if (code === 0) {
                    let timeMatch
                    if (platform === 'win32') {
                        // Windows: e.g. "time=23ms"
                        timeMatch = output.match(/time[=<]?([\d.]+)ms/i)
                    } else {
                        // Unix-like: e.g. "time=23.456 ms"
                        timeMatch = output.match(/time[=<]?([\d.]+)\s*ms/i)
                    }

                    if (timeMatch) {
                        resolve(Math.round(parseFloat(timeMatch[1])))
                        return
                    }

                    // Fallback: try to find any number followed by "ms"
                    const fallbackMatch = output.match(/([\d.]+)\s*ms/i)
                    if (fallbackMatch) {
                        resolve(Math.round(parseFloat(fallbackMatch[1])))
                        return
                    }
                }
                resolve(999) // Failed or timeout
            })
        })
    })
}
