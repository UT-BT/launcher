import { BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getUt99InstallPath } from '@/lib/main/config'
import { loggingService } from '@/lib/main/logging-service'
import { join, isAbsolute } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Custom INI parser that preserves section names exactly (doesn't escape dots)
const parseIni = (content: string): Record<string, Record<string, string | string[]>> => {
    const lines = content.split(/\r?\n/)
    const config: Record<string, Record<string, string | string[]>> = {}
    let currentSection = ''

    for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
            continue
        }

        const sectionMatch = trimmed.match(/^\[(.+)\]$/)
        if (sectionMatch) {
            currentSection = sectionMatch[1]
            if (!config[currentSection]) {
                config[currentSection] = {}
            }
            continue
        }

        const kvMatch = trimmed.match(/^([^=]+)=(.*)$/)
        if (kvMatch && currentSection) {
            const key = kvMatch[1].trim()
            const value = kvMatch[2].trim()

            const existing = config[currentSection][key]
            if (existing !== undefined) {
                if (Array.isArray(existing)) {
                    existing.push(value)
                } else {
                    config[currentSection][key] = [existing, value]
                }
            } else {
                config[currentSection][key] = value
            }
        }
    }

    return config
}

const stringifyIni = (config: Record<string, Record<string, string | string[]>>): string => {
    let result = ''

    for (const [section, pairs] of Object.entries(config)) {
        result += `[${section}]\n`
        for (const [key, value] of Object.entries(pairs)) {
            if (Array.isArray(value)) {
                for (const v of value) {
                    result += `${key}=${v}\n`
                }
            } else {
                result += `${key}=${value}\n`
            }
        }
        result += '\n'
    }

    return result
}

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
            const config = parseIni(content)

            if (config[section] && config[section][key] !== undefined) {
                const value = config[section][key]
                return Array.isArray(value) ? value[0] : String(value)
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
            const config = parseIni(content)

            if (!config[section]) {
                config[section] = {}
            }

            const existing = config[section][key]
            if (Array.isArray(existing)) {
                existing[0] = value
            } else {
                config[section][key] = value
            }

            const newContent = stringifyIni(config)
            writeFileSync(iniPath, newContent, 'utf-8')

            loggingService.info(`Updated INI value [${section}] ${key}=${value} in ${path}`, 'IniHandler')
        } catch (error) {
            loggingService.error(`Failed to write INI value to ${path}`, 'IniHandler', error)
            throw error
        }
    })

    handle('readIniSection', async (path: string, section: string) => {
        try {
            const iniPath = resolveIniPath(path)
            if (!existsSync(iniPath)) {
                loggingService.warn(`INI file not found: ${iniPath}`, 'IniHandler')
                return undefined
            }

            const content = readFileSync(iniPath, 'utf-8')
            const config = parseIni(content)

            if (config[section]) {
                return config[section]
            }

            return undefined
        } catch (error) {
            loggingService.error(`Failed to read INI section from ${path}`, 'IniHandler', error)
            throw error
        }
    })
}
