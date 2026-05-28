import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { loggingService } from './logging-service'
import { getUpdaterConfig, setUpdaterConfig } from './config'

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

export type UpdaterState = {
  phase: UpdaterPhase
  version?: string
  releaseNotes?: string
  releaseDate?: string
  progressPercent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  error?: string
  allowPrerelease: boolean
  currentVersion: string
  lastCheckTrigger: 'auto' | 'manual' | null
  lastCheckedAt?: string
}

class UpdaterService {
  private mainWindow: BrowserWindow | null = null
  private state: UpdaterState
  private wired = false
  private lastTrigger: 'auto' | 'manual' = 'auto'

  constructor() {
    this.state = {
      phase: 'idle',
      allowPrerelease: getUpdaterConfig().allowPrerelease,
      currentVersion: app.getVersion(),
      lastCheckTrigger: null,
    }
  }

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = this.state.allowPrerelease
    autoUpdater.logger = {
      info: (msg: unknown) => loggingService.info(String(msg), 'Updater'),
      warn: (msg: unknown) => loggingService.warn(String(msg), 'Updater'),
      error: (msg: unknown) => loggingService.error(String(msg), 'Updater'),
      debug: (msg: unknown) => loggingService.debug(String(msg), 'Updater'),
    }

    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true
    }

    if (!this.wired) {
      this.wireEvents()
      this.wired = true
    }
  }

  getState(): UpdaterState {
    return { ...this.state }
  }

  async check(manual: boolean): Promise<void> {
    this.lastTrigger = manual ? 'manual' : 'auto'
    if (this.state.phase === 'checking' || this.state.phase === 'downloading') {
      return
    }
    this.update({
      phase: 'checking',
      error: undefined,
      lastCheckTrigger: this.lastTrigger,
    })
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err)
      loggingService.error('checkForUpdates failed', 'Updater', { message: rawMessage })
      this.update({ phase: 'error', error: this.friendlyError(rawMessage) })
    }
  }

  async download(): Promise<void> {
    if (this.state.phase !== 'available') {
      return
    }
    this.update({ phase: 'downloading', progressPercent: 0 })
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err)
      loggingService.error('downloadUpdate failed', 'Updater', { message: rawMessage })
      this.update({ phase: 'error', error: this.friendlyError(rawMessage) })
    }
  }

  quitAndInstall(): void {
    if (this.state.phase !== 'downloaded') {
      return
    }
    this.update({ phase: 'installing' })
    autoUpdater.quitAndInstall(false, true)
  }

  setAllowPrerelease(value: boolean): void {
    setUpdaterConfig({ allowPrerelease: value })
    autoUpdater.allowPrerelease = value
    this.update({ allowPrerelease: value })
  }

  private wireEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.update({ phase: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      this.update({
        phase: 'available',
        version: info.version,
        releaseNotes: this.normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
        lastCheckedAt: new Date().toISOString(),
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      this.update({
        phase: 'not-available',
        version: info?.version,
        lastCheckedAt: new Date().toISOString(),
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.update({
        phase: 'downloading',
        progressPercent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.update({
        phase: 'downloaded',
        version: info.version,
        releaseNotes: this.normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
        progressPercent: 100,
      })
    })

    autoUpdater.on('error', (err) => {
      const message = err instanceof Error ? err.message : String(err)
      loggingService.error('autoUpdater error', 'Updater', { message })
      this.update({ phase: 'error', error: this.friendlyError(message) })
    })
  }

  private normalizeReleaseNotes(notes: unknown): string | undefined {
    if (!notes) return undefined
    if (typeof notes === 'string') return this.stripAttribution(notes)
    if (Array.isArray(notes)) {
      const joined = notes
        .map((n) => {
          if (typeof n === 'string') return n
          if (n && typeof n === 'object' && 'note' in n) return String((n as { note?: string }).note ?? '')
          return ''
        })
        .filter(Boolean)
        .join('\n\n')
      return this.stripAttribution(joined)
    }
    return undefined
  }

  private stripAttribution(notes: string): string {
    return notes.replace(
      /\s+by\s+(?:<a\b[^>]*>)?@[\w-]+(?:<\/a>)?\s+in\s+(?:<a\b[^>]*>)?(?:#\d+|https?:\/\/[^\s<]+)(?:<\/a>)?/gi,
      '',
    )
  }

  private friendlyError(raw: string): string {
    if (/Cannot find latest\.yml/i.test(raw) && /404/.test(raw)) {
      return 'The latest release is missing update metadata (latest.yml). Try toggling release candidates off, or wait for a newer build.'
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|getaddrinfo/i.test(raw)) {
      return 'Could not reach GitHub to check for updates. Check your internet connection.'
    }
    if (/404/.test(raw)) {
      return 'Update metadata not found on GitHub (404).'
    }
    const firstLine = raw.split('\n')[0]?.trim() ?? raw
    return firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine
  }

  private update(patch: Partial<UpdaterState>): void {
    this.state = { ...this.state, ...patch }
    this.mainWindow?.webContents.send('updater:state-changed', this.state)
  }
}

export const updaterService = new UpdaterService()
