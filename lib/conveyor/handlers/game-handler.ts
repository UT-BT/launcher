import { BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { gatewayService } from '@/lib/main/gateway-service'
import { loggingService } from '@/lib/main/logging-service'
import { spawn } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

export const registerGameHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering game IPC handlers', 'MainProcess')

    handle('launchGame', async (ip: string, port: number, password?: string) => {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('UT99 install path not found')
        }

        const exePath = join(installPath, 'System', 'UnrealTournament.exe')
        if (!existsSync(exePath)) {
            throw new Error('UnrealTournament.exe not found')
        }

        const url = `unreal://${ip}:${port}${password ? `?password=${password}` : ''}`
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
}
