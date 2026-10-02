import { app, BrowserWindow, dialog, net } from 'electron'
import { handle } from '@/lib/main/shared'
import { loggingService } from '@/lib/main/logging-service'
import { camService } from '@/lib/main/cam-service'
import { getCamFps, getCamVolume, setCamFps, setCamVolume } from '@/lib/main/config'
import { extractKit } from '@/lib/main/kit-extractor'
import { validateKitFolder } from '@/lib/main/kit-folder'

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

    handle('getCamFps', () => getCamFps())

    handle('setCamFps', (fps) => {
        setCamFps(fps)
        return getCamFps()
    })

    handle('getCamVolume', () => getCamVolume())

    handle('setCamVolume', (volume) => {
        setCamVolume(volume)
        return getCamVolume()
    })

    handle('selectKitFolder', async (current) => {
        const start = validateKitFolder(current)
        const result = await dialog.showOpenDialog(window, {
            title: 'Choose your stream kit folder',
            defaultPath: start.ok ? start.folder : undefined,
            properties: ['openDirectory', 'createDirectory'],
        })
        return result.canceled ? null : (result.filePaths[0] ?? null)
    })

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
