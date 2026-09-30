import { spawn } from 'child_process'
import type { CamCommand } from '@/lib/stream-kit/cam-plan'
import { getUt99InstallPath } from './config'
import { loggingService } from './logging-service'
import { CamLauncher, type CamProcess } from './cam-launcher'
import { loadCamWindows } from './cam-windows'

const CONTEXT = 'CamService'

function spawnCam(command: CamCommand): CamProcess {
    const child = spawn(command.executable, command.args, {
        cwd: command.workingDirectory,
        detached: true,
        stdio: 'ignore',
    })
    child.unref()
    return {
        pid: child.pid,
        onExit: listener => {
            child.on('exit', code => listener(code))
        },
        onError: listener => {
            child.on('error', listener)
        },
        kill: () => {
            child.kill()
        },
    }
}

export const camService = new CamLauncher({
    supported: process.platform === 'win32',
    getInstallPath: getUt99InstallPath,
    spawnCam,
    loadWindows: loadCamWindows,
    logger: {
        info: (message, data) => loggingService.info(message, CONTEXT, data),
        warn: (message, data) => loggingService.warn(message, CONTEXT, data),
        error: (message, data) => loggingService.error(message, CONTEXT, data),
    },
})
