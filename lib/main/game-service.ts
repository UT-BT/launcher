import { join } from 'path'
import { existsSync, createReadStream, createWriteStream, mkdirSync, copyFileSync, readdirSync, rmSync, renameSync, statSync, readFileSync } from 'fs'
import { app, BrowserWindow, dialog, net } from 'electron'
import { createHash } from 'crypto'
import { gatewayService } from './gateway-service'
import { setUt99InstallPath, setInstalledPatch, getUt99InstallPath, getInstalledPatch, setActiveProfile, getActiveProfile } from './config'
import { loggingService } from './logging-service'
import { parseIni } from '../conveyor/handlers/ini-handler'

export class GameService {
    async selectInstallDirectory(window: BrowserWindow): Promise<string | undefined> {
        const result = await dialog.showOpenDialog(window, {
            properties: ['openDirectory'],
            title: 'Select Unreal Tournament Installation Directory',
        })

        if (result.canceled || result.filePaths.length === 0) {
            return undefined
        }

        return result.filePaths[0]
    }

    private getProfilesDir(): string {
        const dir = join(app.getPath('userData'), 'profiles')
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
        return dir
    }

    private getProfileCount(baseName: string): number {
        const profilesDir = this.getProfilesDir()
        return readdirSync(profilesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .filter(dirent => dirent.name === baseName || dirent.name.startsWith(`${baseName} (`))
            .length
    }

    async createProfile(name: string, installPath: string): Promise<void> {
        const profilesDir = this.getProfilesDir()
        const profilePath = join(profilesDir, name)

        if (!existsSync(profilePath)) {
            mkdirSync(profilePath, { recursive: true })
        }

        const filesToBackUp = ['UnrealTournament.ini', 'User.ini']
        for (const file of filesToBackUp) {
            const source = join(installPath, 'System', file)
            const destination = join(profilePath, file)
            if (existsSync(source)) {
                copyFileSync(source, destination)
                loggingService.info(`Backed up ${file} to profile ${name}`, 'GameService')
            }
        }
        setActiveProfile(name)
    }

    async listProfiles(): Promise<{ name: string; modifiedAt: string }[]> {
        const profilesDir = this.getProfilesDir()
        if (!existsSync(profilesDir)) return []

        return readdirSync(profilesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const profilePath = join(profilesDir, dirent.name)
                const stats = statSync(profilePath)
                return {
                    name: dirent.name,
                    modifiedAt: stats.mtime.toISOString(),
                }
            })
    }

    async switchProfile(name: string): Promise<void> {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('UT99 install path not found')
        }

        const profilesDir = this.getProfilesDir()
        const profilePath = join(profilesDir, name)

        if (!existsSync(profilePath)) {
            throw new Error(`Profile ${name} not found`)
        }

        const filesToRestore = ['UnrealTournament.ini', 'User.ini']
        for (const file of filesToRestore) {
            const source = join(profilePath, file)
            const destination = join(installPath, 'System', file)
            if (existsSync(source)) {
                copyFileSync(source, destination)
                loggingService.info(`Restored ${file} from profile ${name}`, 'GameService')
            }
        }
        setActiveProfile(name)
    }

    async renameProfile(oldName: string, newName: string): Promise<void> {
        const profilesDir = this.getProfilesDir()
        const oldPath = join(profilesDir, oldName)
        const newPath = join(profilesDir, newName)

        if (!existsSync(oldPath)) {
            throw new Error(`Profile ${oldName} not found`)
        }

        if (existsSync(newPath)) {
            throw new Error(`Profile ${newName} already exists`)
        }

        renameSync(oldPath, newPath)
        loggingService.info(`Renamed profile from ${oldName} to ${newName}`, 'GameService')

        if (getActiveProfile() === oldName) {
            setActiveProfile(newName)
        }
    }

    async getActiveProfile(): Promise<string | undefined> {
        return getActiveProfile()
    }

    async deleteProfile(name: string): Promise<void> {
        const profilesDir = this.getProfilesDir()
        const profilePath = join(profilesDir, name)

        if (existsSync(profilePath)) {
            rmSync(profilePath, { recursive: true, force: true })
            loggingService.info(`Deleted profile ${name}`, 'GameService')

            if (getActiveProfile() === name) {
                setActiveProfile(undefined)
            }
        }
    }

    async checkProfileSync(name: string): Promise<boolean> {
        const installPath = getUt99InstallPath()
        if (!installPath) return false

        const profilesDir = this.getProfilesDir()
        const profilePath = join(profilesDir, name)
        if (!existsSync(profilePath)) return false

        const filesToCheck = ['User.ini', 'UnrealTournament.ini']

        for (const file of filesToCheck) {
            const gameFile = join(installPath, 'System', file)
            const profileFile = join(profilePath, file)

            if (!existsSync(gameFile) || !existsSync(profileFile)) continue

            const gameConfig = parseIni(readFileSync(gameFile, 'utf-8'))
            const profileConfig = parseIni(readFileSync(profileFile, 'utf-8'))

            const sectionsToTrack = file === 'User.ini'
                ? this.getTrackedUserSections(gameConfig)
                : this.getTrackedUtSections(gameConfig)

            for (const section of sectionsToTrack) {
                const gameSection = gameConfig[section] || {}
                const profileSection = profileConfig[section] || {}

                // Compare all keys in this section
                const allKeys = new Set([...Object.keys(gameSection), ...Object.keys(profileSection)])

                for (const key of allKeys) {
                    // Ignore specific noisy keys
                    if (file === 'UnrealTournament.ini' && (key === 'RunCount' || key === 'LocalTime')) continue

                    const gameVal = JSON.stringify(gameSection[key])
                    const profileVal = JSON.stringify(profileSection[key])

                    if (gameVal !== profileVal) {
                        loggingService.debug(`Sync mismatch in ${file} [${section}] ${key}: ${gameVal} vs ${profileVal}`, 'GameService')
                        return true // Found a difference
                    }
                }
            }
        }

        return false // No differences found in tracked sections
    }

    private getTrackedUserSections(config: Record<string, any>): string[] {
        const sections = ['DefaultPlayer', 'Engine.Player', 'Engine.PlayerPawn']
        if (config['Engine.Input']) sections.push('Engine.Input')
        if (config['Aliases']) sections.push('Aliases')
        return sections
    }

    private getTrackedUtSections(config: Record<string, any>): string[] {
        const sections = ['Engine.Engine', 'Engine.GameEngine', 'WinDrv.WindowsClient', 'Engine.Player', 'Engine.GameInfo']

        for (const section of Object.keys(config)) {
            if (section.endsWith('RenderDevice') || section.endsWith('AudioSubsystem')) {
                sections.push(section)
            }
        }

        return sections
    }

    async validateCurrentInstallation(): Promise<{ valid: boolean; version?: string }> {
        const installPath = getUt99InstallPath()
        const installedPatch = getInstalledPatch()

        if (!installPath || !installedPatch) {
            return { valid: false }
        }

        // Check if installation path still exists
        const requiredFolders = ['System', 'Textures', 'Maps', 'Music', 'Sounds']
        const requiredFiles = [
            join('System', 'UnrealTournament.exe'),
            join('System', 'User.ini'),
            join('System', 'UnrealTournament.ini'),
        ]

        for (const folder of requiredFolders) {
            if (!existsSync(join(installPath, folder))) {
                loggingService.warn('Installation path invalid - missing folder', 'GameService', { folder })
                return { valid: false }
            }
        }

        for (const file of requiredFiles) {
            if (!existsSync(join(installPath, file))) {
                loggingService.warn('Installation path invalid - missing file', 'GameService', { file })
                return { valid: false }
            }
        }

        // Calculate current exe hash
        const exePath = join(installPath, 'System', 'UnrealTournament.exe')
        let hash: string
        try {
            hash = await this.calculateFileHash(exePath)
        } catch (error) {
            loggingService.error('Failed to calculate hash', 'GameService', error)
            return { valid: false }
        }

        // Fetch active patches and verify
        try {
            interface PatchData {
                active: boolean
                tag: string
                exe_md5: string
                sha256: string
            }

            interface PatchResponse {
                success: boolean
                data: PatchData[]
            }

            const response = await gatewayService.get<PatchResponse>('/patches')
            if (response && response.success && response.data) {
                const matchingPatch = response.data.find(
                    (patch) => patch.active && patch.exe_md5 === hash
                )

                if (matchingPatch) {
                    // Update if tag changed
                    if (matchingPatch.tag !== installedPatch.tag) {
                        setInstalledPatch({
                            tag: matchingPatch.tag,
                            sha256: hash,
                            installedAt: installedPatch.installedAt,
                        })
                        loggingService.info('Updated patch tag', 'GameService', {
                            old: installedPatch.tag,
                            new: matchingPatch.tag
                        })
                    }
                    return { valid: true, version: matchingPatch.tag }
                } else {
                    // Patch no longer active or hash doesn't match
                    loggingService.warn('Installed patch not found in active patches', 'GameService', { hash })
                    setInstalledPatch({
                        tag: 'Unsupported',
                        sha256: hash,
                        installedAt: installedPatch.installedAt,
                    })
                    return { valid: true, version: 'Unsupported' }
                }
            }
        } catch (error) {
            loggingService.error('Failed to validate installation', 'GameService', error)
        }

        return { valid: true, version: installedPatch.tag }
    }

    async validateAndSetInstallPath(path: string, window?: BrowserWindow): Promise<{ success: boolean; error?: string; version?: string }> {
        // 1. Validate Directory Structure
        const requiredFolders = ['System', 'Textures', 'Maps', 'Music', 'Sounds']
        const requiredFiles = [
            join('System', 'UnrealTournament.exe'),
            join('System', 'User.ini'),
            join('System', 'UnrealTournament.ini'),
        ]

        for (const folder of requiredFolders) {
            if (!existsSync(join(path, folder))) {
                return { success: false, error: 'Invalid Unreal Tournament 1999 directory. Please select a valid directory.' }
            }
        }

        for (const file of requiredFiles) {
            if (!existsSync(join(path, file))) {
                return { success: false, error: 'Invalid Unreal Tournament 1999 directory. Please select a valid directory.' }
            }
        }

        // 2. Calculate MD5 of UnrealTournament.exe
        const exePath = join(path, 'System', 'UnrealTournament.exe')
        let hash: string
        try {
            hash = await this.calculateFileHash(exePath)
        } catch (error) {
            loggingService.error('Failed to calculate hash', 'GameService', error)
            return { success: false, error: 'Invalid Unreal Tournament 1999 directory. Please select a valid directory.' }
        }

        // 3. Lookup Version
        let version = 'Unsupported'
        try {
            interface PatchData {
                active: boolean
                tag: string
                exe_md5: string
                sha256: string
            }

            interface PatchResponse {
                success: boolean
                data: PatchData[]
            }

            const response = await gatewayService.get<PatchResponse>('/patches')
            if (response && response.success && response.data) {
                const matchingPatch = response.data.find(
                    (patch) => patch.active && patch.exe_md5 === hash
                )
                if (matchingPatch) {
                    version = matchingPatch.tag
                }
            }
        } catch (error) {
            loggingService.warn('Failed to lookup version', 'GameService', error)
            // version remains 'Unsupported'
        }

        // 4. Save Settings
        setUt99InstallPath(path)
        setInstalledPatch({
            tag: version,
            sha256: hash,
            installedAt: new Date().toISOString(),
        })

        // 5. Create "Original" and "Default" profiles if needed
        try {
            const originalCount = this.getProfileCount('Original')
            const originalName = 'Original' + (originalCount > 0 ? ` (${originalCount})` : '')
            await this.createProfile(originalName, path)

            const defaultCount = this.getProfileCount('Default')
            const defaultName = 'Default' + (defaultCount > 0 ? ` (${defaultCount})` : '')
            await this.createProfile(defaultName, path)

            loggingService.info('Created Original and Default profiles', 'GameService', { originalName, defaultName })
        } catch (error) {
            loggingService.error('Failed to create initial profiles', 'GameService', error)
        }

        // 6. Notify renderer of successful installation path update
        if (window) {
            window.webContents.send('installation-path-updated', { version })

            // 7. Install Custom Announcer
            this.installCustomAnnouncer(path, window).catch(err => {
                loggingService.error('Failed to install custom announcer', 'GameService', err)
            })
        }

        return { success: true, version }
    }

    private async installCustomAnnouncer(installPath: string, window: BrowserWindow): Promise<void> {
        const url = gatewayService.getUrl('/assets/ut/Announcer.uax')
        const destination = join(installPath, 'Sounds', 'Announcer.uax')

        loggingService.info('Downloading custom announcer', 'GameService', { url, destination })

        return new Promise((resolve) => {
            const request = net.request(url)

            request.on('response', (response) => {
                if (response.statusCode >= 400) {
                    loggingService.error('Failed to download announcer', 'GameService', { statusCode: response.statusCode })
                    resolve() // Resolve anyway to not block flow
                    return
                }

                const totalBytes = parseInt(response.headers['content-length'] as string || '0', 10)
                let downloadedBytes = 0
                const file = createWriteStream(destination)

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length
                    file.write(chunk)
                    const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
                    window.webContents.send('announcer-install-progress', { progress })
                })

                response.on('end', () => {
                    file.end()
                    loggingService.info('Custom announcer installed', 'GameService')
                    window.webContents.send('announcer-install-complete')
                    resolve()
                })

                response.on('error', (err) => {
                    file.close()
                    loggingService.error('Error writing announcer file', 'GameService', err)
                    resolve() // Resolve anyway
                })
            })

            request.on('error', (err) => {
                loggingService.error('Request error for announcer', 'GameService', err)
                resolve() // Resolve anyway
            })

            request.end()
        })
    }

    private calculateFileHash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5')
            const stream = createReadStream(filePath)

            stream.on('data', (data) => hash.update(data))
            stream.on('end', () => resolve(hash.digest('hex')))
            stream.on('error', reject)
        })
    }
}

export const gameService = new GameService()
