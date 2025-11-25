import { app, BrowserWindow, net } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, unlinkSync, createReadStream } from 'fs'
import { exec } from 'child_process'
import { createHash } from 'crypto'
import { loggingService } from './logging-service'

export class InstallationService {
    private downloadUrl = 'https://archive.org/download/ut-goty/UT_GOTY_CD1.iso'
    private tempDir = join(app.getPath('temp'), 'utbt-ut99')
    private isoPath = join(this.tempDir, 'UT_GOTY_CD1.iso')
    private currentRequest: Electron.ClientRequest | null = null
    private readonly EXPECTED_HASH = 'e5127537f44086f5ed36a9d29f992c00'

    constructor() {
        if (!existsSync(this.tempDir)) {
            mkdirSync(this.tempDir, { recursive: true })
        }
    }

    private async verifyIsoHash(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!existsSync(this.isoPath)) {
                resolve(false)
                return
            }

            const hash = createHash('md5')
            const stream = createReadStream(this.isoPath)

            stream.on('data', (data) => hash.update(data))
            stream.on('end', () => {
                const fileHash = hash.digest('hex')
                loggingService.info(`ISO Hash: ${fileHash}`, 'InstallationService')
                resolve(fileHash === this.EXPECTED_HASH)
            })
            stream.on('error', (err) => {
                loggingService.error('Hash verification failed', 'InstallationService', err)
                resolve(false)
            })
        })
    }

    async downloadISO(window: BrowserWindow): Promise<void> {
        // Check if file exists and is valid
        if (existsSync(this.isoPath)) {
            loggingService.info('ISO exists, verifying hash...', 'InstallationService')
            const isValid = await this.verifyIsoHash()
            if (isValid) {
                loggingService.info('Existing ISO is valid, skipping download', 'InstallationService')
                window.webContents.send('iso-download-progress', { progress: 100, totalBytes: 0, downloadedBytes: 0 })
                return
            }
            loggingService.info('Existing ISO is invalid, re-downloading', 'InstallationService')
            try {
                unlinkSync(this.isoPath)
            } catch (e) {
                loggingService.warn('Failed to delete existing ISO', 'InstallationService', e)
            }
        }

        return new Promise((resolve, reject) => {
            const request = net.request(this.downloadUrl)

            request.on('response', (response) => {
                if (response.statusCode >= 400) {
                    reject(new Error(`Failed to download: ${response.statusCode}`))
                    return
                }

                const totalBytes = parseInt(response.headers['content-length'] as string || '0', 10)
                let downloadedBytes = 0
                const file = createWriteStream(this.isoPath)

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length
                    file.write(chunk)
                    const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
                    window.webContents.send('iso-download-progress', { progress, totalBytes, downloadedBytes })
                })

                response.on('end', () => {
                    file.end()
                    // Verify hash after download
                    this.verifyIsoHash().then(isValid => {
                        if (isValid) {
                            resolve()
                        } else {
                            reject(new Error('Download corrupt: Hash mismatch'))
                        }
                    }).catch(reject)
                })

                response.on('error', (err) => {
                    file.close()
                    try {
                        unlinkSync(this.isoPath)
                    } catch { }
                    reject(err)
                })
            })

            request.on('error', (err) => {
                reject(err)
            })

            this.currentRequest = request
            request.end()
        })
    }

    cancelDownload() {
        if (this.currentRequest) {
            this.currentRequest.abort()
            this.currentRequest = null
        }
    }

    async unmountISO(): Promise<void> {
        return new Promise((resolve) => {
            const dismountCommand = `powershell -Command "Dismount-DiskImage -ImagePath '${this.isoPath}'"`
            exec(dismountCommand, (error) => {
                if (error) {
                    loggingService.warn('Failed to unmount ISO', 'InstallationService', error)
                } else {
                    loggingService.info('ISO unmounted successfully', 'InstallationService')
                }
                resolve()
            })
        })
    }

    async mountAndRun(): Promise<void> {
        try {
            const driveLetter = await this.mountISO()
            await this.runSetup(driveLetter)
        } finally {
            await this.unmountISO()
        }
    }

    private mountISO(): Promise<string> {
        return new Promise((resolve, reject) => {
            const mountCommand = `powershell -Command "Mount-DiskImage -ImagePath '${this.isoPath}' -PassThru | Get-Volume | Select-Object -ExpandProperty DriveLetter"`

            exec(mountCommand, (error, stdout, stderr) => {
                if (error) {
                    loggingService.error('Failed to mount ISO', 'InstallationService', { error, stderr })
                    reject(error)
                    return
                }

                const driveLetter = stdout.trim()
                if (!driveLetter) {
                    // Try to get drive letter again if already mounted
                    const getDriveCommand = `powershell -Command "Get-DiskImage -ImagePath '${this.isoPath}' | Get-Volume | Select-Object -ExpandProperty DriveLetter"`
                    exec(getDriveCommand, (err, out, serr) => {
                        if (err || !out.trim()) {
                            reject(new Error('Could not determine drive letter for mounted ISO'))
                            return
                        }
                        resolve(out.trim())
                    })
                    return
                }

                resolve(driveLetter)
            })
        })
    }

    private runSetup(driveLetter: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const setupPath = `${driveLetter}:\\Setup.exe`
            loggingService.info(`Running setup from ${setupPath}`, 'InstallationService')

            const command = `powershell -Command "Start-Process -FilePath '${setupPath}' -Wait"`

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    loggingService.error('Setup failed or was cancelled', 'InstallationService', { error, stderr })
                    reject(error)
                    return
                }
                loggingService.info('Setup finished', 'InstallationService')
                resolve()
            })
        })
    }
}

export const installationService = new InstallationService()
