import { BrowserWindow, net, app } from 'electron'
import { join } from 'path'
import { createWriteStream, existsSync, mkdirSync, createReadStream } from 'fs'
import { extract } from 'zip-lib'
import { gatewayService } from './gateway-service'
import { getUt99InstallPath, setInstalledPatch } from './config'
import { loggingService } from './logging-service'
import { createHash } from 'crypto'

interface PatchData {
    active: boolean
    tag: string
    exe_md5: string
    sha256: string
    asset_url: string
    asset_name: string
    release_notes_url: string
    channel: string
}

interface PatchResponse {
    success: boolean
    data: PatchData[]
}

export class PatchService {
    private currentRequest: Electron.ClientRequest | null = null
    private cacheDir: string

    constructor() {
        this.cacheDir = join(app.getPath('userData'), 'patch-cache')
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true })
        }
    }

    async fetchPatches(): Promise<PatchData[]> {
        try {
            const response = await gatewayService.get<PatchResponse>('/patches')
            if (response && response.success && response.data) {
                return response.data.filter(patch => patch.active)
            }
            return []
        } catch (error) {
            loggingService.error('Failed to fetch patches', 'PatchService', error)
            return []
        }
    }

    async installPatch(patch: PatchData, window: BrowserWindow): Promise<void> {
        const installPath = getUt99InstallPath()
        if (!installPath) {
            throw new Error('No installation path configured')
        }

        const cachedPatchPath = join(this.cacheDir, patch.asset_name)
        let needsDownload = true

        if (existsSync(cachedPatchPath)) {
            window.webContents.send('patch-install-status', { status: 'verifying', tag: patch.tag })
            const cachedHash = await this.calculateFileSHA256Hash(cachedPatchPath)
            if (cachedHash === patch.sha256) {
                loggingService.info('Using cached patch', 'PatchService', { tag: patch.tag })
                needsDownload = false
            } else {
                loggingService.info('Cached patch hash mismatch, re-downloading', 'PatchService', {
                    tag: patch.tag,
                    expected: patch.sha256,
                    actual: cachedHash
                })
            }
        }

        try {
            if (needsDownload) {
                window.webContents.send('patch-install-status', { status: 'downloading', tag: patch.tag })
                await this.downloadPatch(patch.asset_url, cachedPatchPath, window)

                window.webContents.send('patch-install-status', { status: 'verifying', tag: patch.tag })
                const downloadedHash = await this.calculateFileSHA256Hash(cachedPatchPath)
                if (downloadedHash !== patch.sha256) {
                    throw new Error('Hash verification failed')
                }
            }

            window.webContents.send('patch-install-status', { status: 'extracting', tag: patch.tag })
            await extract(cachedPatchPath, installPath)

            const exePath = join(installPath, 'System', 'UnrealTournament.exe')
            const exeHash = await this.calculateFileMD5Hash(exePath)
            setInstalledPatch({
                tag: patch.tag,
                sha256: exeHash,
                installedAt: new Date().toISOString(),
            })

            window.webContents.send('patch-install-status', { status: 'complete', tag: patch.tag })
        } catch (error) {
            loggingService.error('Failed to install patch', 'PatchService', error)
            window.webContents.send('patch-install-status', {
                status: 'error',
                tag: patch.tag,
                message: error instanceof Error ? error.message : 'Unknown error'
            })
            throw error
        }
    }

    private async downloadPatch(url: string, destination: string, window: BrowserWindow): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = net.request(url)

            request.on('response', (response) => {
                if (response.statusCode >= 400) {
                    reject(new Error(`Download failed: ${response.statusCode}`))
                    return
                }

                const totalBytes = parseInt(response.headers['content-length'] as string || '0', 10)
                let downloadedBytes = 0
                const file = createWriteStream(destination)

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length
                    file.write(chunk)
                    const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
                    window.webContents.send('patch-install-progress', { progress })
                })

                response.on('end', () => {
                    file.end()
                    resolve()
                })

                response.on('error', (err) => {
                    file.close()
                    reject(err)
                })
            })

            request.on('error', reject)

            this.currentRequest = request
            request.end()
        })
    }

    private calculateFileSHA256Hash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('sha256')
            const stream = createReadStream(filePath)

            stream.on('data', (data) => hash.update(data))
            stream.on('end', () => resolve(hash.digest('hex')))
            stream.on('error', reject)
        })
    }

    private calculateFileMD5Hash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5')
            const stream = createReadStream(filePath)

            stream.on('data', (data) => hash.update(data))
            stream.on('end', () => resolve(hash.digest('hex')))
            stream.on('error', reject)
        })
    }

    cancelDownload() {
        if (this.currentRequest) {
            this.currentRequest.abort()
            this.currentRequest = null
        }
    }
}

export const patchService = new PatchService()
