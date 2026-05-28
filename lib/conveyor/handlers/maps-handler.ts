import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { Unzip } from 'zip-lib'

import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { gameService } from '@/lib/main/game-service'
import { loggingService } from '@/lib/main/logging-service'

type ExtractResult =
    | { ok: true; installPath: string; extracted: string[]; skipped: string[] }
    | { ok: false; reason: string }

export const extractMapToInstallInternal = async (
    mapName: string,
    bytes: Uint8Array,
): Promise<ExtractResult> => {
    if (bytes.length === 0) {
        return { ok: false, reason: 'empty-zip' }
    }

    const validation = await gameService.validateCurrentInstallation()
    if (!validation?.valid) {
        return { ok: false, reason: 'no-install' }
    }

    const installPath = getUt99InstallPath()
    if (!installPath) {
        return { ok: false, reason: 'no-install' }
    }

    const extracted: string[] = []
    const skipped: string[] = []

    const unzip = new Unzip({
        overwrite: false,
        onEntry: (event) => {
            if (event.entryName.endsWith('/')) return
            const dest = join(installPath, event.entryName)
            if (existsSync(dest)) {
                skipped.push(event.entryName)
                event.preventDefault()
            } else {
                extracted.push(event.entryName)
            }
        },
    })

    try {
        await unzip.extract(Buffer.from(bytes), installPath)
    } catch (err) {
        loggingService.error(`Failed to extract map "${mapName}" zip`, 'MapsHandler', err)
        return { ok: false, reason: 'extract-error' }
    }

    loggingService.info(
        `Extracted map "${mapName}" → ${installPath} (${extracted.length} extracted, ${skipped.length} skipped)`,
        'MapsHandler',
    )
    return { ok: true, installPath, extracted, skipped }
}

export const registerMapsHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering maps IPC handlers', 'MapsHandler')

    handle('extractMapToInstall', async (mapName: string, bytes: Uint8Array) => {
        return extractMapToInstallInternal(mapName, bytes)
    })
}
