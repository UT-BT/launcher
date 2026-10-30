import { app, BrowserWindow, net } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, unlinkSync, createReadStream, type WriteStream } from 'fs'
import { exec } from 'child_process'
import { createHash } from 'crypto'
import { loggingService } from './logging-service'
import { ut99DownloadCancelledError } from '@/app/utils/ut99Install'

export class InstallationService {
    private downloadUrl = 'https://archive.org/download/ut-goty/UT_GOTY_CD1.iso'
    private tempDir = join(app.getPath('temp'), 'utbt-ut99')
    private isoPath = join(this.tempDir, 'UT_GOTY_CD1.iso')
    private currentDownload: AbortController | null = null
    private readonly EXPECTED_HASH = 'e5127537f44086f5ed36a9d29f992c00'

    constructor() {
        if (!existsSync(this.tempDir)) {
            mkdirSync(this.tempDir, { recursive: true })
        }
    }

    private async verifyIsoHash(): Promise<boolean> {
        return new Promise((resolve, _reject) => {
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
        const controller = new AbortController()
        this.currentDownload = controller
        try {
            await this.fetchISO(window, controller.signal)
        } finally {
            if (this.currentDownload === controller) {
                this.currentDownload = null
            }
        }
    }

    private async fetchISO(window: BrowserWindow, signal: AbortSignal): Promise<void> {
        // Check if file exists and is valid
        if (existsSync(this.isoPath)) {
            loggingService.info('ISO exists, verifying hash...', 'InstallationService')
            const isValid = await this.verifyIsoHash()
            if (signal.aborted) {
                throw ut99DownloadCancelledError()
            }
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

        if (signal.aborted) {
            throw ut99DownloadCancelledError()
        }

        return new Promise((resolve, reject) => {
            const request = net.request(this.downloadUrl)
            let file: WriteStream | null = null

            const removePartialIso = () => {
                try {
                    unlinkSync(this.isoPath)
                } catch {
                    // Best-effort cleanup of partial ISO; ignore unlink failure.
                }
            }

            const onAbort = () => {
                loggingService.info('ISO download cancelled', 'InstallationService')
                request.abort()
                if (file) {
                    file.destroy()
                    file.on('close', removePartialIso)
                }
                reject(ut99DownloadCancelledError())
            }
            signal.addEventListener('abort', onAbort, { once: true })

            const settle = (outcome: () => void) => {
                signal.removeEventListener('abort', onAbort)
                outcome()
            }

            request.on('response', (response) => {
                if (signal.aborted) return
                if (response.statusCode >= 400) {
                    settle(() => reject(new Error(`Failed to download: ${response.statusCode}`)))
                    return
                }

                const totalBytes = parseInt(response.headers['content-length'] as string || '0', 10)
                let downloadedBytes = 0
                const stream = createWriteStream(this.isoPath)
                file = stream

                stream.on('error', (err) => {
                    loggingService.error('ISO write stream error', 'InstallationService', err)
                    removePartialIso()
                    settle(() => reject(err))
                })

                stream.on('finish', () => {
                    this.verifyIsoHash().then(isValid => {
                        if (isValid) {
                            settle(resolve)
                        } else {
                            settle(() => reject(new Error('Download corrupt: Hash mismatch')))
                        }
                    }).catch(err => settle(() => reject(err)))
                })

                response.on('data', (chunk) => {
                    if (signal.aborted) return
                    downloadedBytes += chunk.length
                    stream.write(chunk)
                    const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
                    window.webContents.send('iso-download-progress', { progress, totalBytes, downloadedBytes })
                })

                response.on('end', () => {
                    if (signal.aborted) return
                    stream.end()
                })

                response.on('error', (err) => {
                    stream.destroy()
                    removePartialIso()
                    settle(() => reject(err))
                })
            })

            request.on('error', (err) => {
                settle(() => reject(err))
            })

            request.end()
        })
    }

    cancelDownload() {
        this.currentDownload?.abort()
    }

    private psQuote(value: string): string {
        return value.replace(/'/g, "''")
    }

    async unmountISO(): Promise<void> {
        return new Promise((resolve) => {
            const dismountCommand = `powershell -Command "Dismount-DiskImage -ImagePath '${this.psQuote(this.isoPath)}'"`
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
            const mountCommand = `powershell -Command "Mount-DiskImage -ImagePath '${this.psQuote(this.isoPath)}' -PassThru | Get-Volume | Select-Object -ExpandProperty DriveLetter"`

            exec(mountCommand, (error, stdout, stderr) => {
                if (error) {
                    loggingService.error('Failed to mount ISO', 'InstallationService', { error, stderr })
                    reject(error)
                    return
                }

                const driveLetter = stdout.trim()
                if (!driveLetter) {
                    // Try to get drive letter again if already mounted
                    const getDriveCommand = `powershell -Command "Get-DiskImage -ImagePath '${this.psQuote(this.isoPath)}' | Get-Volume | Select-Object -ExpandProperty DriveLetter"`
                    exec(getDriveCommand, (err, out, _serr) => {
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

            const command = `powershell -Command "Start-Process -FilePath '${this.psQuote(setupPath)}' -Wait"`

            exec(command, (error, _stdout, stderr) => {
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
