import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { gameService } from '@/lib/main/game-service'
import { loggingService } from '@/lib/main/logging-service'

type SaveResult =
    | { ok: true; path: string; bytes: number }
    | { ok: false; reason: string }

const sanitizeFilename = (name: string): string => {
    let n = name.replace(/[/\\:*?"<>|]/g, '_').trim()
    if (!n.toLowerCase().endsWith('.dem')) n += '.dem'
    return n
}

export const saveDemoToSystemInternal = async (filename: string, bytes: Uint8Array): Promise<SaveResult> => {
    if (bytes.length === 0) {
        return { ok: false, reason: 'empty' }
    }

    const validation = await gameService.validateCurrentInstallation()
    if (!validation?.valid) {
        return { ok: false, reason: 'no-install' }
    }

    const installPath = getUt99InstallPath()
    if (!installPath) {
        return { ok: false, reason: 'no-install' }
    }

    const destDir = join(installPath, 'System')
    if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
    }
    const safeName = sanitizeFilename(filename)
    const destPath = join(destDir, safeName)

    try {
        writeFileSync(destPath, Buffer.from(bytes))
        loggingService.info(
            `Saved demo → ${destPath} (${bytes.length} bytes)`,
            'DemosHandler',
        )
        return { ok: true, path: destPath, bytes: bytes.length }
    } catch (err) {
        loggingService.error('Failed to save demo to System folder', 'DemosHandler', err)
        return { ok: false, reason: 'write-error' }
    }
}

export const registerDemosHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering demos IPC handlers', 'DemosHandler')

    handle('saveDemoToSystem', async (filename: string, bytes: Uint8Array) => {
        return saveDemoToSystemInternal(filename, bytes)
    })
}
