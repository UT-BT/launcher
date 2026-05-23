import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { gameService } from '@/lib/main/game-service'
import { loggingService } from '@/lib/main/logging-service'
import { parseIni, stringifyIni } from './ini-handler'

const FAVORITES_SECTION = 'ClientSettings'
const FAVORITES_KEY = 'FavoriteMaps'
const FAVORITES_INI_NAME = 'UTBT_MapVote.ini'

type SyncResult = { ok: boolean; reason?: string }
type ReadResult = SyncResult & { mapNames: string[] }

const resolveFavoritesIniPath = (): string | null => {
    const installPath = getUt99InstallPath()
    if (!installPath) {
        return null
    }
    return join(installPath, 'System', FAVORITES_INI_NAME)
}

const isValidInstall = async (): Promise<boolean> => {
    const result = await gameService.validateCurrentInstallation()
    return Boolean(result?.valid)
}

export const writeFavoritesIniInternal = async (mapNames: string[]): Promise<SyncResult> => {
    if (!(await isValidInstall())) {
        return { ok: false, reason: 'no-install' }
    }

    const iniPath = resolveFavoritesIniPath()
    if (!iniPath) {
        return { ok: false, reason: 'no-install' }
    }

    const dedup: string[] = []
    const seen = new Set<string>()
    for (const name of mapNames) {
        if (!name || typeof name !== 'string') continue
        if (seen.has(name)) continue
        seen.add(name)
        dedup.push(name)
    }

    try {
        let content = ''
        if (existsSync(iniPath)) {
            content = readFileSync(iniPath, 'utf-8')
        } else {
            const dir = dirname(iniPath)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }
        }

        const config = parseIni(content)
        if (!config[FAVORITES_SECTION]) {
            config[FAVORITES_SECTION] = {}
        }

        // Remove any existing FavoriteMaps[*] entries and the bare key, then write the new array.
        for (const k of Object.keys(config[FAVORITES_SECTION])) {
            if (k === FAVORITES_KEY || /^FavoriteMaps\[\d+\]$/.test(k)) {
                delete config[FAVORITES_SECTION][k]
            }
        }
        for (let i = 0; i < dedup.length; i++) {
            config[FAVORITES_SECTION][`${FAVORITES_KEY}[${i}]`] = dedup[i]
        }

        writeFileSync(iniPath, stringifyIni(config), 'utf-8')
        loggingService.info(`Wrote ${dedup.length} favorite maps to ${iniPath}`, 'FavoritesHandler')
        return { ok: true }
    } catch (error) {
        loggingService.error('Failed to write favorites INI', 'FavoritesHandler', error)
        return { ok: false, reason: 'write-error' }
    }
}

export const readFavoritesIniInternal = async (): Promise<ReadResult> => {
    if (!(await isValidInstall())) {
        return { ok: false, reason: 'no-install', mapNames: [] }
    }

    const iniPath = resolveFavoritesIniPath()
    if (!iniPath) {
        return { ok: false, reason: 'no-install', mapNames: [] }
    }

    if (!existsSync(iniPath)) {
        return { ok: true, mapNames: [] }
    }

    try {
        const content = readFileSync(iniPath, 'utf-8')
        const config = parseIni(content)
        const section = config[FAVORITES_SECTION]
        if (!section) {
            return { ok: true, mapNames: [] }
        }

        const indexed: Array<{ index: number; value: string }> = []
        const unindexed: string[] = []

        for (const [key, raw] of Object.entries(section)) {
            const values = Array.isArray(raw) ? raw : [raw]
            const match = key.match(/^FavoriteMaps\[(\d+)\]$/)
            if (match) {
                for (const v of values) {
                    if (v) indexed.push({ index: Number(match[1]), value: v })
                }
            } else if (key === FAVORITES_KEY) {
                for (const v of values) {
                    if (v) unindexed.push(v)
                }
            }
        }

        indexed.sort((a, b) => a.index - b.index)
        const ordered = [...indexed.map((entry) => entry.value), ...unindexed]

        const seen = new Set<string>()
        const dedup: string[] = []
        for (const name of ordered) {
            if (seen.has(name)) continue
            seen.add(name)
            dedup.push(name)
        }

        return { ok: true, mapNames: dedup }
    } catch (error) {
        loggingService.error('Failed to read favorites INI', 'FavoritesHandler', error)
        return { ok: false, reason: 'read-error', mapNames: [] }
    }
}

let backgroundPollerActive = false

export const startBackgroundGamePoller = (window: BrowserWindow) => {
    if (backgroundPollerActive) {
        return
    }
    backgroundPollerActive = true

    let wasRunning = false

    const interval = setInterval(async () => {
        if (window.isDestroyed()) {
            clearInterval(interval)
            backgroundPollerActive = false
            return
        }
        try {
            const running = await gameService.isGameRunning()
            if (running && !wasRunning) {
                wasRunning = true
                loggingService.info('Detected game start (background poller)', 'FavoritesHandler')
            } else if (!running && wasRunning) {
                wasRunning = false
                loggingService.info('Detected game close — emitting favorites:game-closed', 'FavoritesHandler')
                window.webContents.send('favorites:game-closed')
            }
        } catch (error) {
            loggingService.error('Background game poller error', 'FavoritesHandler', error)
        }
    }, 5000)

    window.on('closed', () => {
        clearInterval(interval)
        backgroundPollerActive = false
    })
}

export const registerFavoritesHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering favorites IPC handlers', 'MainProcess')

    handle('writeFavoritesIni', async (mapNames: string[]) => {
        return writeFavoritesIniInternal(mapNames)
    })

    handle('readFavoritesIni', async () => {
        return readFavoritesIniInternal()
    })
}
