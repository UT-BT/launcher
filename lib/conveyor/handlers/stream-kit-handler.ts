import { app, BrowserWindow, net } from 'electron'
import { handle } from '@/lib/main/shared'
import { loggingService } from '@/lib/main/logging-service'
import { camService } from '@/lib/main/cam-service'
import { extractKit } from '@/lib/main/kit-extractor'

const CONTEXT = 'StreamKitHandler'

let quitHookInstalled = false

const stopCamsOnQuit = () => {
    if (quitHookInstalled) return
    quitHookInstalled = true
    app.on('will-quit', () => camService.stopAllNow())
}

export const registerStreamKitHandlers = (window: BrowserWindow) => {
    loggingService.info('Registering stream kit IPC handlers', 'MainProcess')
    stopCamsOnQuit()

    handle('planCams', async (request) => camService.plan(request))

    handle('launchCams', async (request) => camService.launch(request))

    handle('retitleCams', async () => camService.retitle())

    handle('getCamStatus', async () => camService.status())

    handle('restartCam', async (slot, request) => camService.restart(slot, request ?? undefined))

    handle('stopCams', async () => camService.stopAll())

    handle('extractStreamKit', async (request) =>
        extractKit(request, {
            supported: process.platform === 'win32',
            allowLocalApi: !app.isPackaged,
            fetch: (url, init) => net.fetch(url, init),
            onProgress: (progress) => {
                if (!window.isDestroyed()) window.webContents.send('stream-kit:kit-progress', progress)
            },
            logger: {
                info: (message, data) => loggingService.info(message, CONTEXT, data),
                error: (message, data) => loggingService.error(message, CONTEXT, data),
            },
        }),
    )
}
