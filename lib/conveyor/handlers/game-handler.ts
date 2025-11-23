import { BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { gatewayService } from '@/lib/main/gateway-service'
import { loggingService } from '@/lib/main/logging-service'
import { spawn, execFile } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

export const registerGameHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering game IPC handlers', 'MainProcess')

    handle('launchGame', async (ip: string, port: number, password?: string, asSpectator?: boolean) => {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('UT99 install path not found')
        }

        const exePath = join(installPath, 'System', 'UnrealTournament.exe')
        if (!existsSync(exePath)) {
            throw new Error('UnrealTournament.exe not found')
        }

        let url = `unreal://${ip}:${port}`
        const params: string[] = []

        if (password) params.push(`password=${password}`)
        if (asSpectator) params.push('Class=Botpack.CHSpectator')

        if (params.length > 0) {
            url += `?${params.join('&')}`
        }
        loggingService.info(`Launching game with URL: ${url}`, 'GameHandler')

        const gameProcess = spawn(exePath, [url], {
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
            const pingCommand = platform === 'win32' ? 'ping' : 'ping'
            const args = platform === 'win32'
                ? ['-n', '1', '-w', '1000', ip]
                : ['-c', '1', '-W', '1', ip]

            const child = execFile(pingCommand, args)

            let output = ''
            child.stdout?.on('data', (data) => {
                output += data.toString()
            })

            child.on('close', (code) => {
                if (code === 0) {
                    const timeMatch = output.match(/time[=<]([\d.]+)/i)
                    if (timeMatch) {
                        resolve(Math.round(parseFloat(timeMatch[1])))
                        return
                    }
                }
                resolve(999) // Failed or timeout
            })
        })
    })
}
