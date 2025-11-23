import { BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { loggingService } from '@/lib/main/logging-service'
import { join, isAbsolute } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as ini from 'ini'

export const registerIniHandlers = (_window: BrowserWindow) => {
    loggingService.info('Registering INI IPC handlers', 'MainProcess')

    const resolveIniPath = (path: string) => {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('UT99 install path not found')
        }

        if (isAbsolute(path)) {
            return path
        }

        return join(installPath, 'System', path)
    }

    handle('readIniValue', async (path: string, section: string, key: string) => {
        try {
            const iniPath = resolveIniPath(path)
            if (!existsSync(iniPath)) {
                loggingService.warn(`INI file not found: ${iniPath}`, 'IniHandler')
                return undefined
            }

            const content = readFileSync(iniPath, 'utf-8')
            const config = ini.parse(content)

            if (config[section] && config[section][key] !== undefined) {
                return String(config[section][key])
            }

            return undefined
        } catch (error) {
            loggingService.error(`Failed to read INI value from ${path}`, 'IniHandler', error)
            throw error
        }
    })

    handle('writeIniValue', async (path: string, section: string, key: string, value: string) => {
        try {
            const iniPath = resolveIniPath(path)
            if (!existsSync(iniPath)) {
                throw new Error(`INI file not found: ${iniPath}`)
            }

            const content = readFileSync(iniPath, 'utf-8')
            const config = ini.parse(content)

            if (!config[section]) {
                config[section] = {}
            }

            config[section][key] = value

            const newContent = ini.stringify(config)
            writeFileSync(iniPath, newContent, 'utf-8')

            loggingService.info(`Updated INI value [${section}] ${key}=${value} in ${path}`, 'IniHandler')
        } catch (error) {
            loggingService.error(`Failed to write INI value to ${path}`, 'IniHandler', error)
            throw error
        }
    })
}
